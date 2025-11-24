#!/bin/bash

# Lint script for LLM Connector Hub
# Runs ESLint and Prettier checks

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default values
FIX=false
FORMAT=false
CHECK_TYPES=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--fix)
            FIX=true
            shift
            ;;
        --format)
            FORMAT=true
            shift
            ;;
        -t|--typecheck)
            CHECK_TYPES=true
            shift
            ;;
        -a|--all)
            FIX=true
            FORMAT=true
            CHECK_TYPES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --fix         Auto-fix ESLint issues"
            echo "  --format          Auto-format code with Prettier"
            echo "  -t, --typecheck   Run TypeScript type checking"
            echo "  -a, --all         Run all checks and fixes"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                # Check linting and formatting"
            echo "  $0 -f             # Fix linting issues"
            echo "  $0 --format       # Format code"
            echo "  $0 -a             # Fix, format, and typecheck"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LLM Connector Hub - Linter${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to project root
cd "${PROJECT_ROOT}"

# Track failures
FAILURES=0

# Run ESLint
echo -e "${BLUE}Running ESLint...${NC}"
if [ "$FIX" = true ]; then
    npm run lint:fix
else
    npm run lint
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ESLint passed${NC}"
else
    echo -e "${RED}✗ ESLint failed${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

# Run Prettier
if [ "$FORMAT" = true ]; then
    echo -e "${BLUE}Formatting code with Prettier...${NC}"
    npm run format
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Code formatted${NC}"
    else
        echo -e "${RED}✗ Formatting failed${NC}"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo -e "${BLUE}Checking code formatting...${NC}"
    npm run format:check
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Code formatting is correct${NC}"
    else
        echo -e "${RED}✗ Code formatting issues found${NC}"
        echo -e "${YELLOW}Run with --format to auto-fix${NC}"
        FAILURES=$((FAILURES + 1))
    fi
fi
echo ""

# Run TypeScript type checking
if [ "$CHECK_TYPES" = true ]; then
    echo -e "${BLUE}Running TypeScript type checking...${NC}"
    npm run typecheck
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Type checking passed${NC}"
    else
        echo -e "${RED}✗ Type checking failed${NC}"
        FAILURES=$((FAILURES + 1))
    fi
    echo ""
fi

# Summary
echo -e "${BLUE}========================================${NC}"
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}${FAILURES} check(s) failed!${NC}"
    echo ""
    echo -e "${YELLOW}Tips:${NC}"
    echo -e "${YELLOW}  - Run with -f to auto-fix linting issues${NC}"
    echo -e "${YELLOW}  - Run with --format to auto-format code${NC}"
    echo -e "${YELLOW}  - Run with -a to fix everything automatically${NC}"
    exit 1
fi
