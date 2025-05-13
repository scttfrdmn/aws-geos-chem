#!/bin/bash
# Lint all bash scripts in the project using shellcheck

# Directories to check for bash scripts
DIRS_TO_CHECK=(
  "container/scripts"
  "parallel-cluster"
  "visualization"
  "benchmarking"
  "scripts"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if shellcheck is installed
if ! command -v shellcheck &> /dev/null; then
  echo -e "${RED}Error: shellcheck is not installed.${NC}"
  echo "Please install it with your package manager:"
  echo "  Homebrew: brew install shellcheck"
  echo "  Apt: apt-get install shellcheck"
  echo "  Yum: yum install shellcheck"
  exit 1
fi

# Get the project root directory
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Find bash scripts
BASH_SCRIPTS=()
for dir in "${DIRS_TO_CHECK[@]}"; do
  dir_path="$PROJECT_ROOT/$dir"
  if [ -d "$dir_path" ]; then
    while IFS= read -r -d '' file; do
      BASH_SCRIPTS+=("$file")
    done < <(find "$dir_path" -type f -name "*.sh" -print0)
  else
    echo -e "${YELLOW}Warning: Directory $dir_path does not exist${NC}"
  fi
done

# Check if any bash scripts were found
if [ ${#BASH_SCRIPTS[@]} -eq 0 ]; then
  echo -e "${YELLOW}No bash scripts found to lint${NC}"
  exit 0
fi

echo -e "Running shellcheck on ${#BASH_SCRIPTS[@]} bash scripts..."

# Run shellcheck on all files
ERRORS=0
for script in "${BASH_SCRIPTS[@]}"; do
  echo -e "Checking ${YELLOW}$script${NC}"
  if ! shellcheck "$script"; then
    ERRORS=$((ERRORS + 1))
  fi
done

# Summary
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All bash scripts passed shellcheck!${NC}"
  exit 0
else
  echo -e "${RED}Found issues in $ERRORS bash script(s)${NC}"
  exit 1
fi