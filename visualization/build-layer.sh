#!/bin/bash
# build-layer.sh - Build the Python layer for scientific packages

set -e

# Define variables
LAYER_DIR="layer"
PYTHON_DIR="${LAYER_DIR}/python"
REQUIREMENTS_FILE="${LAYER_DIR}/requirements.txt"
OUTPUT_DIR="dist"

echo "Building Lambda layer for scientific packages..."

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Install dependencies
echo "Installing Python packages..."
pip install -r "${REQUIREMENTS_FILE}" -t "${PYTHON_DIR}" --upgrade

# Clean up unnecessary files to reduce size
echo "Cleaning up unnecessary files..."
find "${PYTHON_DIR}" -type d -name "tests" -exec rm -rf {} +
find "${PYTHON_DIR}" -type d -name "test" -exec rm -rf {} +
find "${PYTHON_DIR}" -type d -name "__pycache__" -exec rm -rf {} +
find "${PYTHON_DIR}" -type f -name "*.pyc" -delete
find "${PYTHON_DIR}" -type f -name "*.so" | xargs strip 2>/dev/null || true

# Create zip archive
echo "Creating layer archive..."
cd "${LAYER_DIR}"
zip -r "../${OUTPUT_DIR}/scientific-layer.zip" .
cd ..

# Output size information
SIZE=$(du -h "${OUTPUT_DIR}/scientific-layer.zip" | cut -f1)
echo "Layer archive created: ${OUTPUT_DIR}/scientific-layer.zip (${SIZE})"
echo "Done!"