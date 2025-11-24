#!/bin/bash

##
## Run Load Tests Script
## Executes load testing scenarios with resource monitoring
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
LOG_FILE="${RESULTS_DIR}/load-test-${TIMESTAMP}.log"

# Print banner
echo ""
echo "=============================================================================="
echo "  LLM Connector Hub - Load Testing Suite"
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

# Parse arguments
TEST_TYPE="${1:-all}"
DURATION="${2:-default}"

# Validate test type
case "$TEST_TYPE" in
    rampup|peak|endurance|spike|all)
        ;;
    *)
        echo -e "${RED}Error: Invalid test type: $TEST_TYPE${NC}"
        echo ""
        echo "Usage: $0 [test-type] [duration]"
        echo ""
        echo "Test Types:"
        echo "  rampup      - Gradual load increase"
        echo "  peak        - Maximum sustained load"
        echo "  endurance   - Long-duration stability test (5 minutes)"
        echo "  spike       - Sudden load spikes"
        echo "  all         - Run all load tests (default)"
        echo ""
        echo "Duration:"
        echo "  default     - Use default durations"
        echo "  short       - Shorter test durations (for quick testing)"
        echo ""
        exit 1
        ;;
esac

# System information
echo -e "${BLUE}System Information:${NC}"
echo "  OS:           $(uname -s)"
echo "  Architecture: $(uname -m)"
echo "  Node.js:      $(node --version)"
echo "  CPUs:         $(node -e "console.log(require('os').cpus().length)")"
echo "  Memory:       $(node -e "console.log((require('os').totalmem() / 1024 / 1024 / 1024).toFixed(2))")"" GB"
echo ""

# Resource monitoring function
monitor_resources() {
    local pid=$1
    local log_file=$2

    echo "timestamp,cpu_percent,memory_mb" > "$log_file"

    while kill -0 $pid 2>/dev/null; do
        local cpu=$(ps -p $pid -o %cpu= 2>/dev/null || echo "0")
        local mem=$(ps -p $pid -o rss= 2>/dev/null || echo "0")
        local mem_mb=$(echo "scale=2; $mem / 1024" | bc)
        local timestamp=$(date +%s)

        echo "$timestamp,$cpu,$mem_mb" >> "$log_file"
        sleep 1
    done
}

# Run load tests
echo -e "${GREEN}Starting load tests...${NC}"
echo ""

# Start logging
exec > >(tee -a "$LOG_FILE")
exec 2>&1

if [[ "$TEST_TYPE" == "all" ]]; then
    echo -e "${BLUE}Running all load test scenarios...${NC}"
    echo ""

    # Ramp-up test
    echo "-------------------------------------------"
    echo " Ramp-Up Load Test"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) -e "
        import { runRampUpTest } from './benchmarks/load-test';
        runRampUpTest().catch(console.error);
    " || true

    echo ""
    echo "Waiting 5 seconds before next test..."
    sleep 5

    # Peak load test
    echo ""
    echo "-------------------------------------------"
    echo " Peak Load Test"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) -e "
        import { runPeakLoadTest } from './benchmarks/load-test';
        runPeakLoadTest().catch(console.error);
    " || true

    echo ""
    echo "Waiting 5 seconds before next test..."
    sleep 5

    # Spike test
    echo ""
    echo "-------------------------------------------"
    echo " Spike Test"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) -e "
        import { runSpikeTest } from './benchmarks/load-test';
        runSpikeTest().catch(console.error);
    " || true

    # Ask about endurance test
    echo ""
    echo -e "${YELLOW}Endurance test takes 5 minutes. Run it? [y/N]${NC}"
    read -t 10 -n 1 run_endurance || run_endurance="n"
    echo ""

    if [[ "$run_endurance" =~ ^[Yy]$ ]]; then
        echo ""
        echo "-------------------------------------------"
        echo " Endurance Test (5 minutes)"
        echo "-------------------------------------------"
        node --expose-gc $(which tsx) -e "
            import { runEnduranceTest } from './benchmarks/load-test';
            runEnduranceTest().catch(console.error);
        " || true
    else
        echo "Skipping endurance test."
    fi

    # Run comprehensive suite
    echo ""
    echo "-------------------------------------------"
    echo " Comprehensive Load Test Suite"
    echo "-------------------------------------------"
    node --expose-gc $(which tsx) benchmarks/load-test.ts

else
    # Run specific test
    case "$TEST_TYPE" in
        rampup)
            echo -e "${BLUE}Running ramp-up load test...${NC}"
            node --expose-gc $(which tsx) -e "
                import { runRampUpTest } from './benchmarks/load-test';
                runRampUpTest().catch(console.error);
            "
            ;;
        peak)
            echo -e "${BLUE}Running peak load test...${NC}"
            node --expose-gc $(which tsx) -e "
                import { runPeakLoadTest } from './benchmarks/load-test';
                runPeakLoadTest().catch(console.error);
            "
            ;;
        endurance)
            echo -e "${BLUE}Running endurance test (5 minutes)...${NC}"
            node --expose-gc $(which tsx) -e "
                import { runEnduranceTest } from './benchmarks/load-test';
                runEnduranceTest().catch(console.error);
            "
            ;;
        spike)
            echo -e "${BLUE}Running spike test...${NC}"
            node --expose-gc $(which tsx) -e "
                import { runSpikeTest } from './benchmarks/load-test';
                runSpikeTest().catch(console.error);
            "
            ;;
    esac
fi

EXIT_CODE=$?

echo ""
echo "=============================================================================="
if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}  Load tests completed successfully!${NC}"
else
    echo -e "${RED}  Load tests failed or encountered errors${NC}"
fi
echo "=============================================================================="
echo ""

# Display log location
echo -e "${BLUE}Results saved to: ${LOG_FILE}${NC}"
echo ""

# Display summary if log has content
if [ -f "$LOG_FILE" ]; then
    echo -e "${BLUE}Summary:${NC}"
    echo "  Log size: $(du -h "$LOG_FILE" | cut -f1)"
    echo ""
fi

exit $EXIT_CODE
