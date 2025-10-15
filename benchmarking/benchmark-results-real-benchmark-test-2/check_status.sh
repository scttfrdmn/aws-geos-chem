#!/bin/bash
# Auto-generated script to check the status of real benchmark jobs

cd $(dirname $0)/..
./check_benchmark_status.sh \
  --name real-benchmark-test-2 \
  --graviton e76c7476-13dc-4f87-bc58-493c8cd47263 \
  --intel 87822ebc-4394-4061-ab53-47a7ff7df053 \
  --amd 2cf786a8-7bda-44b1-8009-f372f22b9449 \
  "$@"
