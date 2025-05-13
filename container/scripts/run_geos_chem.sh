#!/bin/bash
# run_geos_chem.sh - Run the GEOS-Chem simulation

set -e

# Directory setup
RUN_DIR="/opt/geos-chem/rundir"
cd ${RUN_DIR}

# Set OpenMP environment variables for optimal performance on Graviton
export OMP_STACKSIZE=500m
export OMP_WAIT_POLICY=active
export OMP_PROC_BIND=close
export OMP_PLACES=cores

# Start time for benchmarking
START_TIME=$(date +%s)

# Create log file with timestamp
LOG_FILE="gc_${START_TIME}.log"

# Run GEOS-Chem
echo "Running GEOS-Chem in ${RUN_DIR}"
echo "Execution time started at $(date)"

# Execute GEOS-Chem and capture logs
${GC_ROOT}/bin/gcclassic | tee ${LOG_FILE}

# End time for benchmarking
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
HOURS=$(echo "scale=2; ${DURATION}/3600" | bc)

echo "Execution completed at $(date)"
echo "Total runtime: ${DURATION} seconds (${HOURS} hours)"

# Parse log file for performance metrics
WALL_TIME=$(grep -i "Elapsed wall time" ${LOG_FILE} | awk '{print $NF}')
COMPUTE_TIME=$(grep -i "Chemistry computation" ${LOG_FILE} | awk '{print $NF}')
TOTAL_TIME=$(grep -i "Total model" ${LOG_FILE} | awk '{print $NF}')

# Create a simple JSON summary of the run
cat > ${RUN_DIR}/run_summary.json << EOL
{
  "start_time": "$(date -d @${START_TIME} -u +%Y-%m-%dT%H:%M:%SZ)",
  "end_time": "$(date -d @${END_TIME} -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": ${DURATION},
  "wall_time": "${WALL_TIME}",
  "compute_time": "${COMPUTE_TIME}",
  "total_model_time": "${TOTAL_TIME}",
  "instance_type": "$(curl -s http://169.254.169.254/latest/meta-data/instance-type || echo 'unknown')",
  "cpu_info": "$(lscpu | grep 'Model name' || echo 'unknown')",
  "memory_total": "$(free -m | grep Mem | awk '{print $2}') MB",
  "omp_num_threads": "${OMP_NUM_THREADS}"
}
EOL

echo "Run summary saved to ${RUN_DIR}/run_summary.json"