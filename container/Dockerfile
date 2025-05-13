# Base Image: Amazon Linux 2023 for ARM64
FROM --platform=linux/arm64 amazonlinux:2023

LABEL maintainer="GEOS-Chem Cloud Team <info@example.com>"
LABEL description="GEOS-Chem container optimized for AWS Graviton processors"
LABEL version="1.0.0"

# Environment variables
ENV GC_VERSION="13.4.0"
ENV GC_ROOT="/opt/geos-chem"
ENV GC_DATA_ROOT="/data"
ENV PATH="${GC_ROOT}/bin:${PATH}"
ENV LD_LIBRARY_PATH="${GC_ROOT}/lib:${LD_LIBRARY_PATH}"

# Install system dependencies
RUN dnf update -y && \
    dnf install -y \
    wget \
    git \
    gcc \
    gcc-gfortran \
    gcc-c++ \
    make \
    cmake \
    netcdf-devel \
    netcdf-fortran-devel \
    hdf5-devel \
    openmpi-devel \
    python3 \
    python3-pip \
    python3-devel \
    vim \
    htop \
    aws-cli \
    jq \
    tar \
    gzip \
    zip \
    unzip \
    curl \
    which && \
    dnf clean all

# Set up Python environment
RUN python3 -m pip install --upgrade pip && \
    python3 -m pip install \
    numpy \
    scipy \
    pandas \
    matplotlib \
    xarray \
    netCDF4 \
    pyyaml \
    boto3 \
    cartopy \
    jupyter \
    jupyterlab \
    gcpy \
    h5py

# Create directories
RUN mkdir -p ${GC_ROOT} && \
    mkdir -p ${GC_ROOT}/bin && \
    mkdir -p ${GC_ROOT}/lib && \
    mkdir -p ${GC_DATA_ROOT}

# Clone GEOS-Chem source code
WORKDIR /tmp
RUN git clone https://github.com/geoschem/GCClassic.git && \
    cd GCClassic && \
    git checkout 13.4.0 && \
    git submodule update --init --recursive

# Set ARM-specific optimization flags
ENV FFLAGS="-O3 -mcpu=neoverse-v1 -ffast-math -fallow-argument-mismatch -march=armv8-a+crc"
ENV CFLAGS="-O3 -mcpu=neoverse-v1 -ffast-math -march=armv8-a+crc"
ENV CXXFLAGS="-O3 -mcpu=neoverse-v1 -ffast-math -march=armv8-a+crc"

# Build GEOS-Chem
WORKDIR /tmp/GCClassic/build
RUN cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=${GC_ROOT} \
    -DRUNDIR=/opt/geos-chem/rundir && \
    make -j$(nproc) && \
    make install

# Set up default run directory
RUN mkdir -p /opt/geos-chem/rundir && \
    cp -r /tmp/GCClassic/rundir/* /opt/geos-chem/rundir/

# Add utility scripts
COPY scripts/download_data.py /usr/local/bin/
COPY scripts/run_geos_chem.sh /usr/local/bin/
COPY scripts/process_results.py /usr/local/bin/
COPY scripts/entrypoint.sh /usr/local/bin/

# Make scripts executable
RUN chmod +x /usr/local/bin/download_data.py && \
    chmod +x /usr/local/bin/run_geos_chem.sh && \
    chmod +x /usr/local/bin/process_results.py && \
    chmod +x /usr/local/bin/entrypoint.sh

# Clean up
RUN rm -rf /tmp/GCClassic

# Set working directory to run directory
WORKDIR /opt/geos-chem/rundir

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]