#!/bin/bash

# Test script for LLM Connector Hub
# Runs all tests with optional coverage reporting

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
COVERAGE=false
WATCH=false
VERBOSE=false
UPDATE_SNAPSHOTS=false
PACKAGE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -w|--watch)
            WATCH=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -u|--update-snapshots)
            UPDATE_SNAPSHOTS=true
            shift
            ;;
        -p|--package)
            PACKAGE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -c, --coverage           Generate coverage report"
            echo "  -w, --watch              Run tests in watch mode"
            echo "  -v, --verbose            Enable verbose output"
            echo "  -u, --update-snapshots   Update test snapshots"
            echo "  -p, --package <name>     Run tests for specific package"
            echo "  -h, --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Run all tests"
            echo "  $0 -c                   # Run all tests with coverage"
            echo "  $0 -p core              # Run tests for core package only"
            echo "  $0 -w -p providers      # Watch mode for providers package"
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
echo -e "${BLUE}  LLM Connector Hub - Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to project root
cd "${PROJECT_ROOT}"

# Build test command
TEST_CMD="npm test"

if [ "$COVERAGE" = true ]; then
    TEST_CMD="npm run test:coverage"
    echo -e "${BLUE}Running tests with coverage...${NC}"
elif [ "$WATCH" = true ]; then
    TEST_CMD="npm test -- --watch"
    echo -e "${BLUE}Running tests in watch mode...${NC}"
else
    echo -e "${BLUE}Running tests...${NC}"
fi

# Add package filter if specified
if [ -n "$PACKAGE" ]; then
    TEST_CMD="${TEST_CMD} --workspace=packages/${PACKAGE}"
    echo -e "${YELLOW}Testing package: @llm-connector-hub/${PACKAGE}${NC}"
fi

# Add update snapshots flag
if [ "$UPDATE_SNAPSHOTS" = true ]; then
    TEST_CMD="${TEST_CMD} -- -u"
    echo -e "${YELLOW}Updating test snapshots...${NC}"
fi

# Add verbose flag
if [ "$VERBOSE" = true ]; then
    TEST_CMD="${TEST_CMD} -- --reporter=verbose"
fi

echo ""

# Run tests
eval "${TEST_CMD}"

TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}========================================${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"

    # Show coverage summary if coverage was enabled
    if [ "$COVERAGE" = true ]; then
        echo ""
        echo -e "${BLUE}Coverage report generated at:${NC}"
        echo -e "${BLUE}  coverage/index.html${NC}"
        echo ""
        echo -e "${BLUE}To view coverage:${NC}"
        echo -e "${BLUE}  open coverage/index.html${NC}"
    fi

    exit 0
else
    echo -e "${RED}Tests failed!${NC}"
    exit 1
fi
