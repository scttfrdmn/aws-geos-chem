#!/bin/bash
# Auto-generated script to check the status of 7-day benchmark jobs

cd $(dirname $0)/..
./check_benchmark_status.sh \
  --name 7day-benchmark-test \
  --graviton === Running graviton benchmark using geos-chem-benchmark-graviton-7day ===
Output path: s3://benchmarkingstack-geoschembenchmarkresultsca52c809-yfi9i55q3xr5/7day-benchmark-test/G3-C7G-4-TRANSPORT-7D
Submitted job with ID: 48cf274b-3f75-4fb6-bf75-844108047db4
48cf274b-3f75-4fb6-bf75-844108047db4 \
  --intel === Running intel benchmark using geos-chem-benchmark-intel-7day ===
Output path: s3://benchmarkingstack-geoschembenchmarkresultsca52c809-yfi9i55q3xr5/7day-benchmark-test/IN-C7I-4-TRANSPORT-7D
Submitted job with ID:  \
  --amd === Running amd benchmark using geos-chem-benchmark-amd-7day ===
Output path: s3://benchmarkingstack-geoschembenchmarkresultsca52c809-yfi9i55q3xr5/7day-benchmark-test/AMD-C7A-4-TRANSPORT-7D
Submitted job with ID:  \
  $@
