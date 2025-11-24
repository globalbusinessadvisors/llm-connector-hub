#!/bin/bash

# Build script for LLM Connector Hub
# Builds all packages in the workspace

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
CLEAN=false
VERBOSE=false
PRODUCTION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -p|--production)
            PRODUCTION=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -c, --clean       Clean build artifacts before building"
            echo "  -v, --verbose     Enable verbose output"
            echo "  -p, --production  Build for production (optimizations enabled)"
            echo "  -h, --help        Show this help message"
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
echo -e "${BLUE}  LLM Connector Hub - Build Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to project root
cd "${PROJECT_ROOT}"

# Clean if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}Cleaning build artifacts...${NC}"
    npm run clean || true
    rm -rf packages/*/dist
    rm -rf packages/*/build
    rm -rf packages/*/*.tsbuildinfo
    echo -e "${GREEN}Clean complete!${NC}"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm ci
    echo -e "${GREEN}Dependencies installed!${NC}"
    echo ""
fi

# Set environment for production build
if [ "$PRODUCTION" = true ]; then
    export NODE_ENV=production
    echo -e "${BLUE}Building for production...${NC}"
else
    echo -e "${BLUE}Building for development...${NC}"
fi

# Build each package
PACKAGES=("core" "providers" "middleware" "hub")
FAILED_PACKAGES=()

for PACKAGE in "${PACKAGES[@]}"; do
    echo -e "${BLUE}Building @llm-connector-hub/${PACKAGE}...${NC}"

    if [ "$VERBOSE" = true ]; then
        npm run build --workspace=packages/${PACKAGE}
    else
        npm run build --workspace=packages/${PACKAGE} > /dev/null 2>&1
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ @llm-connector-hub/${PACKAGE} built successfully${NC}"
    else
        echo -e "${RED}✗ @llm-connector-hub/${PACKAGE} build failed${NC}"
        FAILED_PACKAGES+=("${PACKAGE}")
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"

# Check if any packages failed
if [ ${#FAILED_PACKAGES[@]} -eq 0 ]; then
    echo -e "${GREEN}All packages built successfully!${NC}"
    exit 0
else
    echo -e "${RED}Failed to build the following packages:${NC}"
    for PACKAGE in "${FAILED_PACKAGES[@]}"; do
        echo -e "${RED}  - @llm-connector-hub/${PACKAGE}${NC}"
    done
    exit 1
fi
