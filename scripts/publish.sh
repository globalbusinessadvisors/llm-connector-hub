#!/bin/bash

# NPM Publishing Script for @llm-dev-ops packages
# This script automates the publishing process for all packages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  LLM Connector Hub - NPM Publisher${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if user is logged in to npm
if ! npm whoami &> /dev/null; then
    echo -e "${RED}Error: You are not logged in to npm${NC}"
    echo "Please run: npm login"
    exit 1
fi

NPM_USER=$(npm whoami)
echo -e "${GREEN}✓ Logged in as: ${NPM_USER}${NC}"
echo ""

# Verify organization access
echo -e "${YELLOW}Checking organization access...${NC}"
if ! npm access ls-packages @llm-dev-ops 2>/dev/null | grep -q "@llm-dev-ops"; then
    echo -e "${YELLOW}Warning: Cannot verify access to @llm-dev-ops organization${NC}"
    echo -e "${YELLOW}Make sure you have publish access to the organization${NC}"
    echo ""
fi

# Clean and build
echo -e "${YELLOW}Cleaning previous builds...${NC}"
npm run clean

echo -e "${YELLOW}Building all packages...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Run tests
echo -e "${YELLOW}Running tests...${NC}"
npm test -- --run

if [ $? -ne 0 ]; then
    echo -e "${RED}Tests failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tests passed${NC}"
echo ""

# Get current version
VERSION=$(node -p "require('./packages/core/package.json').version")
echo -e "${YELLOW}Current version: ${VERSION}${NC}"
echo ""

# Ask for confirmation
read -p "Do you want to publish version ${VERSION} to npm? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Publishing cancelled${NC}"
    exit 0
fi

# Dry run first
echo -e "${YELLOW}Running dry-run...${NC}"
npm run publish:dry-run

echo ""
read -p "Dry-run complete. Continue with actual publish? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Publishing cancelled${NC}"
    exit 0
fi

# Publish packages in order
echo ""
echo -e "${GREEN}Publishing packages...${NC}"
echo ""

PACKAGES=("core:connector-hub-core" "providers:connector-hub-providers" "middleware:connector-hub-middleware" "hub:connector-hub" "cli:connector-hub-cli")

for pkg_info in "${PACKAGES[@]}"; do
    IFS=':' read -r dir name <<< "$pkg_info"
    echo -e "${YELLOW}Publishing @llm-dev-ops/${name}...${NC}"

    cd "packages/${dir}"

    if npm publish --access public; then
        echo -e "${GREEN}✓ Published @llm-dev-ops/${name}@${VERSION}${NC}"
    else
        echo -e "${RED}✗ Failed to publish @llm-dev-ops/${name}${NC}"
        cd ../..
        exit 1
    fi

    cd ../..
    echo ""
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All packages published successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Published packages:"
echo "  - @llm-dev-ops/connector-hub-core@${VERSION}"
echo "  - @llm-dev-ops/connector-hub-providers@${VERSION}"
echo "  - @llm-dev-ops/connector-hub-middleware@${VERSION}"
echo "  - @llm-dev-ops/connector-hub@${VERSION}"
echo "  - @llm-dev-ops/connector-hub-cli@${VERSION}"
echo ""
echo "Installation command:"
echo "  npm install @llm-dev-ops/connector-hub"
echo ""
echo "CLI installation:"
echo "  npm install -g @llm-dev-ops/connector-hub-cli"
