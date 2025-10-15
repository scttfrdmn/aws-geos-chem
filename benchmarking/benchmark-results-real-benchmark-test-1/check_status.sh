#!/bin/bash
# Auto-generated script to check the status of real benchmark jobs

cd $(dirname $0)/..
./check_benchmark_status.sh \
  --name real-benchmark-test-1 \
  --graviton a42491fa-9201-4f90-bb6d-eb6bc57cb3ef \
  --intel 6cc09278-1e92-4d0e-9bd3-15c85623cab9 \
  --amd 5d39fbd2-7bf0-4d66-80c8-55c322e7b498 \
  "$@"
