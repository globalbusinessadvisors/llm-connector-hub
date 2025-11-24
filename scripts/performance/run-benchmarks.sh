#!/bin/bash

##
## Run Benchmarks Script
## Executes all performance benchmarks and generates reports
##

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESULTS_DIR="./benchmarks/results"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
OUTPUT_FILE="${RESULTS_DIR}/benchmark-${TIMESTAMP}.json"

# Print banner
echo ""
echo "=============================================================================="
echo "  LLM Connector Hub - Performance Benchmarks"
echo "=============================================================================="
echo ""

# Create results directory if it doesn't exist
mkdir -p "${RESULTS_DIR}"

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo -e "${RED}Error: tsx is not installed${NC}"
    echo "Please run: npm install -g tsx"
    exit 1
fi

# Check if --expose-gc flag is available
echo -e "${BLUE}Checking Node.js configuration...${NC}"
node --expose-gc --version > /dev/null 2>&1 || {
    echo -e "${YELLOW}Warning: --expose-gc flag not available. Memory measurements may be less accurate.${NC}"
}

# Parse arguments
SUITE="${1:-all}"
VERBOSE=""
SAVE="--save"

if [[ "$2" == "--verbose" ]] || [[ "$2" == "-v" ]]; then
    VERBOSE="--verbose"
fi

# Run benchmarks
echo -e "${BLUE}Running benchmark suite: ${SUITE}${NC}"
echo ""

if [[ "$SUITE" == "all" ]]; then
    echo -e "${GREEN}Running all benchmarks...${NC}"

    # Run provider benchmarks
    echo ""
    echo "-------------------------------------------"
    echo " Provider Benchmarks"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) benchmarks/provider-benchmark.ts || true

    # Run cache benchmarks
    echo ""
    echo "-------------------------------------------"
    echo " Cache Benchmarks"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) benchmarks/cache-benchmark.ts || true

    # Run middleware benchmarks
    echo ""
    echo "-------------------------------------------"
    echo " Middleware Benchmarks"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) benchmarks/middleware-benchmark.ts || true

    # Run hub benchmarks
    echo ""
    echo "-------------------------------------------"
    echo " Hub Benchmarks"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) benchmarks/hub-benchmark.ts || true

    echo ""
    echo -e "${GREEN}Running comprehensive benchmark suite...${NC}"
    node --expose-gc $(which tsx) benchmarks/index.ts all ${VERBOSE} ${SAVE}

elif [[ "$SUITE" == "stress" ]]; then
    echo -e "${GREEN}Running stress tests...${NC}"
    node --expose-gc $(which tsx) benchmarks/stress-test.ts

elif [[ "$SUITE" == "load" ]]; then
    echo -e "${GREEN}Running load tests...${NC}"
    node --expose-gc $(which tsx) benchmarks/load-test.ts

else
    echo -e "${GREEN}Running ${SUITE} benchmarks...${NC}"
    node --expose-gc $(which tsx) benchmarks/index.ts ${SUITE} ${VERBOSE} ${SAVE}
fi

EXIT_CODE=$?

echo ""
echo "=============================================================================="
if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}  Benchmarks completed successfully!${NC}"
else
    echo -e "${RED}  Benchmarks failed or performance thresholds not met${NC}"
fi
echo "=============================================================================="
echo ""

# List recent results
if [ -d "${RESULTS_DIR}" ] && [ "$(ls -A ${RESULTS_DIR})" ]; then
    echo -e "${BLUE}Recent results:${NC}"
    ls -lt "${RESULTS_DIR}" | head -6
    echo ""
fi

exit $EXIT_CODE
