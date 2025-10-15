# GEOS-Chem AWS Cloud Runner Project Status

## Project Overview
This project implements a full AWS Cloud Runner system for GEOS-Chem chemistry transport model simulations, including benchmarking across different processor architectures (ARM64/Graviton, Intel x86, AMD x86) and a web-based user interface for simulation management.

## Current Status
The project consists of several components in different stages of completion:

### 1. Benchmarking System (Complete)
- Architecture-specific containers for ARM64 and AMD64
- Performance metrics: throughput, hours per simulation day, cost per simulation day
- Real computational benchmarks across processor types
- AWS Batch integration with job submission and monitoring

### 2. AWS CDK Infrastructure (Partially Complete)
- Core infrastructure stack design
- Benchmarking stack implementation
- Initial web application stack
- Job management components defined but not fully implemented

### 3. Web Interface (Partially Complete)
- React application structure and component organization
- Authentication module skeleton
- UI components for simulation configuration, monitoring, and results
- Redux store configuration

### 4. GCHP Support (Initial Structure)
- Initial MPI configuration
- GCHP-specific container templates
- Multi-node job configuration for AWS Batch

## Implementation Plan

### Phase 1: Complete Core Components (6 weeks)
- Finalize core infrastructure with testing
- Optimize benchmarking containers for production
- Complete authentication integration
- Implement job management API

### Phase 2: User Interface Development (6 weeks)
- Complete simulation configuration wizard
- Implement job monitoring dashboard
- Develop results visualization components

### Phase 3: Integration and Advanced Features (4 weeks)
- Implement cost management system
- Add GCHP support with AWS Batch multi-node jobs
- Create deployment automation

### Phase 4: Testing, Documentation, and Optimization (4 weeks)
- Comprehensive testing across all components
- Create user and administrator documentation
- Performance optimization

## Performance Summary
Latest benchmarks demonstrate:
- **AMD EPYC Genoa**: Best performance (8228.57 days/day) and cost-efficiency ($0.001982/sim day)
- **AWS Graviton3**: Close second (7854.54 days/day, $0.002077/sim day)
- **Intel Sapphire Rapids**: Significantly slower (3927.27 days/day, $0.004766/sim day)

## Key File Locations
- **Benchmarking**: `/Users/scttfrdmn/src/aws-geos-chem/benchmarking/`
- **Container Code**: `/Users/scttfrdmn/src/aws-geos-chem/container/`
- **CDK Infrastructure**: `/Users/scttfrdmn/src/aws-geos-chem/aws-geos-chem-cdk/`
- **Web Interface**: `/Users/scttfrdmn/src/aws-geos-chem/web-interface/`

## Primary Scripts
- **Run Benchmarks**: `./benchmarking/run_real_benchmark.sh`
- **Create Job Definitions**: `./benchmarking/create_real_job_definition.sh`
- **Build Containers**: `./container/build_benchmark.sh`
- **Deploy Infrastructure**: `cd aws-geos-chem-cdk && npm run deploy:dev`
- **Run Web Interface**: `cd web-interface && npm start`

## Documentation
- Detailed benchmark reports: `benchmarking/final-benchmark-results/benchmark-comparison.md`
- Implementation summaries: `benchmarking/METRIC-FIX-SUMMARY.md`
- CDK infrastructure: `aws-geos-chem-cdk/README.md`
- Web interface: `web-interface/README.md`
- Infrastructure design: `infrastructure-design.md`