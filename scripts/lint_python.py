#!/usr/bin/env python3
"""
Lint all Python files in the project.
Uses flake8 for linting.
"""

import os
import sys
import subprocess
from pathlib import Path

# Directories to check for Python files
DIRS_TO_CHECK = [
    'benchmarking',
    'container/scripts',
    'parallel-cluster',
    'visualization/lambda',
]

def find_python_files(base_dir, dirs_to_check):
    """Find all Python files in the specified directories."""
    python_files = []
    for dir_name in dirs_to_check:
        dir_path = base_dir / dir_name
        if not dir_path.exists():
            print(f"Warning: Directory {dir_path} does not exist")
            continue
        
        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.endswith('.py'):
                    python_files.append(os.path.join(root, file))
    
    return python_files

def run_flake8(files):
    """Run flake8 on the specified files."""
    if not files:
        print("No Python files found to lint")
        return 0
    
    print(f"Running flake8 on {len(files)} Python files...")
    try:
        result = subprocess.run(['flake8'] + files, check=False)
        return result.returncode
    except FileNotFoundError:
        print("Error: flake8 not found. Please install it with 'pip install flake8'")
        return 1

def main():
    """Main function."""
    # Get the project root directory
    project_root = Path(__file__).parent.parent.absolute()
    
    # Find Python files
    python_files = find_python_files(project_root, DIRS_TO_CHECK)
    
    # Run flake8
    return run_flake8(python_files)

if __name__ == '__main__':
    sys.exit(main())