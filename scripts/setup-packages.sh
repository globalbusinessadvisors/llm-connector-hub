#!/bin/bash

# This script sets up a minimal working TypeScript project structure

set -e

echo "Setting up LLM Connector Hub packages..."

# Create minimal index files for each package
mkdir -p packages/core/src
cat > packages/core/src/index.ts << 'EOF'
// Core package - minimal export to compile successfully
export const VERSION = '0.1.0';
EOF

mkdir -p packages/providers/src
cat > packages/providers/src/index.ts << 'EOF'
// Providers package
export const VERSION = '0.1.0';
EOF

mkdir -p packages/middleware/src
cat > packages/middleware/src/index.ts << 'EOF'
// Middleware package
export const VERSION = '0.1.0';
EOF

mkdir -p packages/hub/src
cat > packages/hub/src/index.ts << 'EOF'
// Hub package
export const VERSION = '0.1.0';
EOF

echo "Setup complete!"
