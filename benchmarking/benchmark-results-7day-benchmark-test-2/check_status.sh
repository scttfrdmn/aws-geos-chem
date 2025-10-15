#!/bin/bash
# Auto-generated script to check the status of 7-day benchmark jobs

cd $(dirname $0)/..
./check_benchmark_status.sh \
  --name 7day-benchmark-test-2 \
  --graviton 0709bc0c-242a-4147-8d91-638dad8d184b \
  --intel b3ef24ba-67c0-48b1-b6cd-3a9391296713 \
  --amd ee22a64f-98e4-44ea-a75e-4f1c205150ca \
  "$@"