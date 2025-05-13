#!/bin/bash
# gchp-node-setup.sh - Setup script for GCHP compute nodes

# Exit on any error
set -e

LOG_DIR="/var/log/gchp-setup"
LOG_FILE="${LOG_DIR}/setup-$(date +%Y%m%d-%H%M%S).log"

# Create log directory
mkdir -p ${LOG_DIR}

# Start logging
exec > >(tee -a ${LOG_FILE}) 2>&1

echo "=== Starting GCHP node setup ==="
echo "Hostname: $(hostname)"
echo "Node type: ${SLURM_JOB_PARTITION:-headnode}"
echo "Instance type: $(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
echo "Time: $(date)"

# Determine if the node is ARM64 (Graviton) or x86_64
ARCH=$(arch)
echo "Architecture: $ARCH"

# Install common dependencies
echo "=== Installing common dependencies ==="
apt-get update
apt-get install -y \
    git \
    wget \
    cmake \
    build-essential \
    python3-pip \
    python3-dev \
    libnetcdf-dev \
    libnetcdff-dev \
    netcdf-bin \
    csh \
    flex \
    libfl-dev \
    libfabric-dev \
    libfftw3-dev \
    htop \
    vim \
    awscli

# Install Python packages
echo "=== Installing Python packages ==="
python3 -m pip install --upgrade pip
python3 -m pip install \
    numpy \
    scipy \
    pandas \
    xarray \
    netCDF4 \
    matplotlib \
    cartopy \
    PyYAML \
    boto3

# Setup MPI environment
echo "=== Setting up MPI environment ==="
if [ -d "/opt/amazon/openmpi" ]; then
    echo "Amazon-optimized OpenMPI found"
    # Set up paths for Amazon-optimized OpenMPI
    echo 'export PATH=/opt/amazon/openmpi/bin:$PATH' >> /etc/profile.d/gchp.sh
    echo 'export LD_LIBRARY_PATH=/opt/amazon/openmpi/lib:$LD_LIBRARY_PATH' >> /etc/profile.d/gchp.sh
else
    echo "Installing OpenMPI"
    # Install OpenMPI if not already provided
    apt-get install -y libopenmpi-dev openmpi-bin
fi

# Mount shared GCHP data if not already mounted
echo "=== Setting up data mounts ==="
if [ ! -d "/gcgrid/data" ]; then
    echo "Creating GEOS-Chem data directory"
    mkdir -p /gcgrid/data
fi

# Setup FSx Lustre for shared storage
if [ ! -d "/fsx/gchp" ]; then
    echo "Creating GCHP working directory on FSx"
    mkdir -p /fsx/gchp/runs
    mkdir -p /fsx/gchp/output
    chmod 1777 /fsx/gchp/runs
    chmod 1777 /fsx/gchp/output
fi

# Create container storage directory for Singularity/Apptainer
if [ ! -d "/fsx/containers" ]; then
    echo "Creating container directory on FSx"
    mkdir -p /fsx/containers
    chmod 1777 /fsx/containers
fi

# Install Apptainer/Singularity for containers
echo "=== Installing Apptainer ==="
apt-get install -y \
    apptainer \
    squashfs-tools

# Architecture-specific optimizations
echo "=== Applying architecture-specific optimizations ==="
if [ "$ARCH" == "aarch64" ]; then
    echo "Applying Graviton optimizations"
    
    # Environment variables for Graviton
    cat > /etc/profile.d/graviton.sh << 'EOL'
# Graviton optimization environment variables
export ARMPL_VERBOSE=1
export ARMPL_LARGE_BUFFER_NODES=1500000
export ARMPL_LARGE_BUFFERS=1

# Optimize OpenMPI for Graviton + EFA
export OMPI_MCA_btl_vader_single_copy_mechanism=none
export OMPI_MCA_rmaps_base_mapping_policy=slot
export OMPI_MCA_hwloc_base_binding_policy=core
export OMPI_MCA_mpi_leave_pinned=1
EOL

else
    echo "Applying x86_64 optimizations"
    
    # Environment variables for x86_64
    cat > /etc/profile.d/x86.sh << 'EOL'
# x86_64 optimization environment variables
export MKL_DEBUG_CPU_TYPE=5
export MKL_ENABLE_INSTRUCTIONS=AVX2

# Optimize OpenMPI for x86 + EFA
export OMPI_MCA_btl_vader_single_copy_mechanism=none
export OMPI_MCA_rmaps_base_mapping_policy=slot
export OMPI_MCA_hwloc_base_binding_policy=core
export OMPI_MCA_mpi_leave_pinned=1
EOL
fi

# Install GCHP container if headnode
if [[ "$(hostname)" == *"head"* ]]; then
    echo "=== Setting up headnode-specific configurations ==="
    
    # Create GCHP container directory
    mkdir -p /shared/gchp-containers
    
    # Pull GCHP container image
    echo "Pulling GCHP container image"
    aws s3 cp s3://${SCRIPTS_BUCKET}/gchp-container.sif /fsx/containers/gchp-latest.sif || echo "Container not found, will be built later"
    
    # Setup Slurm job templates
    mkdir -p /shared/job-templates
    cat > /shared/job-templates/gchp-job.sh << 'EOL'
#!/bin/bash
#SBATCH --job-name=gchp
#SBATCH --ntasks-per-node=64
#SBATCH --nodes=2
#SBATCH --exclusive
#SBATCH --output=gchp_%j.log
#SBATCH --time=24:00:00

# Configuration from job submission
INPUT_CONFIG=${INPUT_CONFIG:-"s3://default-bucket/default-config.yml"}
OUTPUT_LOCATION=${OUTPUT_LOCATION:-"s3://default-bucket/default-output"}
SIMULATION_DAYS=${SIMULATION_DAYS:-7}

# Load environment modules
source /etc/profile.d/gchp.sh

# Create run directory
RUN_DIR="/fsx/gchp/runs/run_${SLURM_JOB_ID}"
mkdir -p $RUN_DIR
cd $RUN_DIR

# Download input configuration
echo "Downloading configuration from $INPUT_CONFIG"
aws s3 cp $INPUT_CONFIG ./config.yml

# Prepare run directory
echo "Setting up run directory"
apptainer exec /fsx/containers/gchp-latest.sif /usr/local/bin/setup_gchp.sh

# Run GCHP
echo "Starting GCHP simulation with $SLURM_NTASKS MPI tasks"
mpirun -np $SLURM_NTASKS apptainer exec /fsx/containers/gchp-latest.sif /opt/geos-chem/bin/gchp

# Process and upload results
echo "Processing and uploading results to $OUTPUT_LOCATION"
apptainer exec /fsx/containers/gchp-latest.sif /usr/local/bin/process_results.py --output-path $OUTPUT_LOCATION

echo "GCHP job completed"
EOL

    chmod +x /shared/job-templates/gchp-job.sh
    
    # Create submission script
    cat > /shared/submit-gchp.sh << 'EOL'
#!/bin/bash
# Script to submit GCHP job

# Usage info
usage() {
    echo "Usage: $0 -c CONFIG_PATH -o OUTPUT_PATH -d SIMULATION_DAYS -n NODES [-q QUEUE]"
    echo "  -c CONFIG_PATH    : S3 path to configuration file"
    echo "  -o OUTPUT_PATH    : S3 path for output storage"
    echo "  -d SIMULATION_DAYS: Number of simulation days"
    echo "  -n NODES          : Number of nodes to use (1-8)"
    echo "  -q QUEUE          : Queue to use (gchp-graviton or gchp-x86, default: gchp-graviton)"
    exit 1
}

# Parse command line arguments
while getopts "c:o:d:n:q:" opt; do
    case $opt in
        c) CONFIG_PATH=$OPTARG ;;
        o) OUTPUT_PATH=$OPTARG ;;
        d) SIMULATION_DAYS=$OPTARG ;;
        n) NODES=$OPTARG ;;
        q) QUEUE=$OPTARG ;;
        *) usage ;;
    esac
done

# Check required parameters
if [ -z "$CONFIG_PATH" ] || [ -z "$OUTPUT_PATH" ] || [ -z "$SIMULATION_DAYS" ] || [ -z "$NODES" ]; then
    usage
fi

# Set default queue if not specified
QUEUE=${QUEUE:-"gchp-graviton"}

# Validate inputs
if ! [[ "$SIMULATION_DAYS" =~ ^[0-9]+$ ]]; then
    echo "Error: Simulation days must be a number"
    exit 1
fi

if ! [[ "$NODES" =~ ^[1-8]$ ]]; then
    echo "Error: Number of nodes must be between 1 and 8"
    exit 1
fi

if [[ "$QUEUE" != "gchp-graviton" && "$QUEUE" != "gchp-x86" ]]; then
    echo "Error: Queue must be 'gchp-graviton' or 'gchp-x86'"
    exit 1
fi

# Submit job
TASKS=$((NODES * 64))  # 64 tasks per node
sbatch --export=INPUT_CONFIG=$CONFIG_PATH,OUTPUT_LOCATION=$OUTPUT_PATH,SIMULATION_DAYS=$SIMULATION_DAYS \
       --ntasks=$TASKS \
       --nodes=$NODES \
       --partition=$QUEUE \
       /shared/job-templates/gchp-job.sh
EOL

    chmod +x /shared/submit-gchp.sh
    
    # Create status script
    cat > /shared/gchp-status.sh << 'EOL'
#!/bin/bash
# Script to check GCHP job status

if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [JOB_ID]"
    echo "  Shows status of all GCHP jobs or specific job if JOB_ID is provided"
    exit 0
fi

if [ -n "$1" ]; then
    # Show specific job details
    scontrol show job $1
    
    # Show job's log file if exists
    LOG_FILE=$(find /fsx/gchp/runs -name "gchp_$1.log" 2>/dev/null)
    if [ -n "$LOG_FILE" ]; then
        echo -e "\nLast 20 lines of log file:"
        tail -20 $LOG_FILE
    fi
else
    # Show all jobs
    squeue -o "%.10i %.9P %.8j %.8u %.2t %.10M %.6D %.3C %R"
fi
EOL

    chmod +x /shared/gchp-status.sh
    
    # Create cleanup script
    cat > /shared/gchp-cleanup.sh << 'EOL'
#!/bin/bash
# Script to clean up old GCHP job data

# Usage info
usage() {
    echo "Usage: $0 [-d DAYS] [-y]"
    echo "  -d DAYS : Delete run directories older than DAYS days (default: 14)"
    echo "  -y      : Skip confirmation (yes to all)"
    exit 1
}

# Parse command line arguments
DAYS=14
SKIP_CONFIRM=0

while getopts "d:y" opt; do
    case $opt in
        d) DAYS=$OPTARG ;;
        y) SKIP_CONFIRM=1 ;;
        *) usage ;;
    esac
done

# Validate inputs
if ! [[ "$DAYS" =~ ^[0-9]+$ ]]; then
    echo "Error: Days must be a number"
    exit 1
fi

# Find old run directories
OLD_DIRS=$(find /fsx/gchp/runs -maxdepth 1 -name "run_*" -type d -mtime +$DAYS)

if [ -z "$OLD_DIRS" ]; then
    echo "No run directories older than $DAYS days found."
    exit 0
fi

# Count and print directories to be deleted
COUNT=$(echo "$OLD_DIRS" | wc -l)
echo "Found $COUNT run directories older than $DAYS days:"
echo "$OLD_DIRS"

# Confirm deletion
if [ $SKIP_CONFIRM -eq 0 ]; then
    read -p "Delete these directories? (y/n): " CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Delete directories
echo "Deleting old run directories..."
echo "$OLD_DIRS" | xargs rm -rf

echo "Cleanup completed."
EOL

    chmod +x /shared/gchp-cleanup.sh
    
    # Create symbolic links in /usr/local/bin for easier access
    ln -sf /shared/submit-gchp.sh /usr/local/bin/submit-gchp
    ln -sf /shared/gchp-status.sh /usr/local/bin/gchp-status
    ln -sf /shared/gchp-cleanup.sh /usr/local/bin/gchp-cleanup
    
    echo "Headnode setup completed"
fi

echo "=== Node setup completed ==="
echo "Time: $(date)"

exit 0