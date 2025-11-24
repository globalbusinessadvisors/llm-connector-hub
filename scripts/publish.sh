#!/bin/bash

# Publish script for LLM Connector Hub
# Publishes all packages to npm registry

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
DRY_RUN=false
TAG="latest"
SKIP_CHECKS=false
ACCESS="public"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        --skip-checks)
            SKIP_CHECKS=true
            shift
            ;;
        --access)
            ACCESS="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -d, --dry-run      Perform a dry run without publishing"
            echo "  -t, --tag <tag>    NPM dist-tag (default: latest)"
            echo "  --skip-checks      Skip pre-publish checks"
            echo "  --access <type>    Package access (public|restricted)"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Publish with all checks"
            echo "  $0 -d                   # Dry run to see what would be published"
            echo "  $0 -t beta              # Publish with 'beta' tag"
            echo "  $0 --skip-checks        # Publish without running checks"
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
echo -e "${BLUE}  LLM Connector Hub - Publisher${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to project root
cd "${PROJECT_ROOT}"

# Pre-publish checks
if [ "$SKIP_CHECKS" = false ]; then
    echo -e "${BLUE}Running pre-publish checks...${NC}"
    echo ""

    # Check if on main branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$DRY_RUN" = false ]; then
        echo -e "${YELLOW}Warning: Not on main branch (current: ${CURRENT_BRANCH})${NC}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Publish cancelled${NC}"
            exit 1
        fi
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo -e "${RED}Error: Uncommitted changes detected${NC}"
        echo -e "${YELLOW}Please commit or stash your changes before publishing${NC}"
        exit 1
    fi

    # Run linting
    echo -e "${BLUE}Running linter...${NC}"
    npm run lint
    if [ $? -ne 0 ]; then
        echo -e "${RED}Linting failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Linting passed${NC}"
    echo ""

    # Run type checking
    echo -e "${BLUE}Running type check...${NC}"
    npm run typecheck
    if [ $? -ne 0 ]; then
        echo -e "${RED}Type checking failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Type checking passed${NC}"
    echo ""

    # Run tests
    echo -e "${BLUE}Running tests...${NC}"
    npm test
    if [ $? -ne 0 ]; then
        echo -e "${RED}Tests failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Tests passed${NC}"
    echo ""
fi

# Build packages
echo -e "${BLUE}Building packages...${NC}"
"${SCRIPT_DIR}/build.sh" --production
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Publishing version: ${VERSION}${NC}"
echo -e "${BLUE}Tag: ${TAG}${NC}"
echo -e "${BLUE}Access: ${ACCESS}${NC}"
echo ""

# Packages to publish
PACKAGES=("core" "providers" "middleware" "hub")
PUBLISHED=()
FAILED=()

# Publish each package
for PACKAGE in "${PACKAGES[@]}"; do
    PACKAGE_DIR="${PROJECT_ROOT}/packages/${PACKAGE}"
    PACKAGE_NAME="@llm-connector-hub/${PACKAGE}"

    echo -e "${BLUE}Publishing ${PACKAGE_NAME}...${NC}"

    cd "${PACKAGE_DIR}"

    # Check if package already exists at this version
    if npm view "${PACKAGE_NAME}@${VERSION}" version &>/dev/null; then
        echo -e "${YELLOW}Version ${VERSION} of ${PACKAGE_NAME} already published, skipping...${NC}"
        continue
    fi

    # Publish command
    PUBLISH_CMD="npm publish --access ${ACCESS} --tag ${TAG}"

    if [ "$DRY_RUN" = true ]; then
        PUBLISH_CMD="${PUBLISH_CMD} --dry-run"
    fi

    # Execute publish
    if eval "${PUBLISH_CMD}"; then
        echo -e "${GREEN}✓ ${PACKAGE_NAME} published successfully${NC}"
        PUBLISHED+=("${PACKAGE_NAME}")
    else
        echo -e "${RED}✗ Failed to publish ${PACKAGE_NAME}${NC}"
        FAILED+=("${PACKAGE_NAME}")
    fi

    echo ""
    cd "${PROJECT_ROOT}"
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Publishing Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ${#PUBLISHED[@]} -gt 0 ]; then
    echo -e "${GREEN}Successfully published:${NC}"
    for PACKAGE in "${PUBLISHED[@]}"; do
        echo -e "${GREEN}  ✓ ${PACKAGE}${NC}"
    done
    echo ""
fi

if [ ${#FAILED[@]} -gt 0 ]; then
    echo -e "${RED}Failed to publish:${NC}"
    for PACKAGE in "${FAILED[@]}"; do
        echo -e "${RED}  ✗ ${PACKAGE}${NC}"
    done
    echo ""
    exit 1
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry run complete - no packages were actually published${NC}"
else
    echo -e "${GREEN}All packages published successfully!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "  1. Create a git tag: git tag -a v${VERSION} -m 'Release ${VERSION}'${NC}"
    echo -e "  2. Push the tag: git push origin v${VERSION}${NC}"
    echo -e "  3. Create a GitHub release${NC}"
fi

exit 0
