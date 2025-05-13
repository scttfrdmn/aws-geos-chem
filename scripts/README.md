# GEOS-Chem AWS Cloud Runner Scripts

This directory contains utility scripts for the GEOS-Chem AWS Cloud Runner project.

## Linting Scripts

### lint_all.sh

The main linting script that runs all other linters and provides a unified output.

```bash
./scripts/lint_all.sh
```

### lint_python.py

Lints all Python files in the project using flake8.

```bash
./scripts/lint_python.py
```

Dependencies:
- flake8: `pip install flake8`

Configuration:
- See `.flake8` in the project root for settings

### lint_bash.sh

Lints all Bash scripts in the project using shellcheck.

```bash
./scripts/lint_bash.sh
```

Dependencies:
- shellcheck: Install via package manager (e.g., `brew install shellcheck`)

Configuration:
- See `.shellcheckrc` in the project root for settings

## Setting Up for Development

1. Install dependencies:
   ```bash
   # Install Node.js dependencies
   cd aws-geos-chem-cdk
   npm install
   
   # Install Python linting
   pip install flake8
   
   # Install shellcheck (macOS example)
   brew install shellcheck
   ```

2. Run all linters:
   ```bash
   ./scripts/lint_all.sh
   ```

3. Fix linting issues:
   ```bash
   # Auto-fix TypeScript/JavaScript issues
   cd aws-geos-chem-cdk
   npm run lint:fix
   ```