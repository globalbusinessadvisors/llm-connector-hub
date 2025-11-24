#!/bin/bash

# Version Bump Script
# Usage: ./scripts/version-bump.sh [patch|minor|major]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUMP_TYPE=${1:-patch}

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}Error: Invalid bump type '${BUMP_TYPE}'${NC}"
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Version Bump: ${BUMP_TYPE}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Get current version
CURRENT_VERSION=$(node -p "require('./packages/core/package.json').version")
echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"

# Bump version in all packages
echo -e "${YELLOW}Bumping version...${NC}"
npm version ${BUMP_TYPE} --workspaces --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./packages/core/package.json').version")
echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"
echo ""

# Update root package.json
npm version ${BUMP_TYPE} --no-git-tag-version

echo -e "${GREEN}✓ Version bumped from ${CURRENT_VERSION} to ${NEW_VERSION}${NC}"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Commit changes: git add . && git commit -m 'chore: bump version to ${NEW_VERSION}'"
echo "  3. Create tag: git tag v${NEW_VERSION}"
echo "  4. Push changes: git push && git push --tags"
echo "  5. Publish: ./scripts/publish.sh"
