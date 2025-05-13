#!/bin/bash
# Run all linters for the project

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   GEOS-Chem AWS Cloud Runner Linter    ${NC}"
echo -e "${BLUE}========================================${NC}"

# Track exit codes
TS_EXIT=0
PY_EXIT=0
BASH_EXIT=0

# Step 1: Lint TypeScript and JavaScript
echo -e "\n${BLUE}Linting TypeScript and JavaScript files...${NC}"
cd "$PROJECT_ROOT/aws-geos-chem-cdk" || exit 1
if npm run lint; then
  echo -e "${GREEN}TypeScript and JavaScript linting passed!${NC}"
else
  echo -e "${RED}TypeScript and JavaScript linting failed.${NC}"
  TS_EXIT=1
fi

# Step 2: Lint Python
echo -e "\n${BLUE}Linting Python files...${NC}"
if "$PROJECT_ROOT/scripts/lint_python.py"; then
  echo -e "${GREEN}Python linting passed!${NC}"
else
  echo -e "${RED}Python linting failed.${NC}"
  PY_EXIT=1
fi

# Step 3: Lint Bash
echo -e "\n${BLUE}Linting Bash scripts...${NC}"
if "$PROJECT_ROOT/scripts/lint_bash.sh"; then
  echo -e "${GREEN}Bash script linting passed!${NC}"
else
  echo -e "${RED}Bash script linting failed.${NC}"
  BASH_EXIT=1
fi

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}            Linting Summary            ${NC}"
echo -e "${BLUE}========================================${NC}"

EXIT_CODE=$((TS_EXIT + PY_EXIT + BASH_EXIT))

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All linters passed successfully!${NC}"
else
  echo -e "${RED}Some linters reported issues:${NC}"
  [ $TS_EXIT -ne 0 ] && echo -e "${RED}✗ TypeScript/JavaScript${NC}"
  [ $PY_EXIT -ne 0 ] && echo -e "${RED}✗ Python${NC}"
  [ $BASH_EXIT -ne 0 ] && echo -e "${RED}✗ Bash${NC}"
  echo -e "\nPlease fix the issues before committing."
fi

exit $EXIT_CODE