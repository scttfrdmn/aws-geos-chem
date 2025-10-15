#!/bin/bash
# Auto-generated script to check the status of real benchmark jobs

cd $(dirname $0)/..
./check_benchmark_status.sh \
  --name real-benchmark-dynamic-metrics-fixed \
  --graviton e8fe1b17-2427-4749-8612-9b067dbb081d \
  --intel 8894fe6a-75fd-4ed2-b1c9-f7391f367d4b \
  --amd 8dec5852-f765-4b6e-99e5-7f7c4c5f578b \
  "$@"
