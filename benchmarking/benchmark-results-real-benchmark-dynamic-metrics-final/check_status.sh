#!/bin/bash
# Auto-generated script to check the status of real benchmark jobs

cd $(dirname $0)/..
./check_benchmark_status.sh \
  --name real-benchmark-dynamic-metrics-final \
  --graviton ca28f457-8b78-4d53-8045-568f3a1d6380 \
  --intel a4f6c17e-caaa-48ee-b58e-78e3c9a4716a \
  --amd eef6cd40-3b2c-4aa0-8d35-77e3447fa9bb \
  "$@"
