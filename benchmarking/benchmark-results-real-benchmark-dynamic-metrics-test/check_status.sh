#!/bin/bash
# Auto-generated script to check the status of real benchmark jobs

cd $(dirname $0)/..
./check_benchmark_status.sh \
  --name real-benchmark-dynamic-metrics-test \
  --graviton c63df79c-5c33-45da-8326-e5aa3333a95b \
  --intel 70dcbf52-01c0-4861-b194-ec9067d9872e \
  --amd 4d92f3c9-5ce7-44e6-a01c-a1e876942c3b \
  "$@"
