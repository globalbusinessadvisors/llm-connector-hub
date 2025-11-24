# Publishing Guide

This guide explains how to publish the LLM Connector Hub packages to npm under the `@llm-dev-ops` organization.

## Prerequisites

Before publishing, ensure you have:

1. **NPM Account** with access to the `@llm-dev-ops` organization
2. **Two-Factor Authentication** enabled on your npm account
3. **Organization Membership** - You must be a member of the `@llm-dev-ops` organization with publish rights

## Setup

### 1. Login to NPM

```bash
npm login
```

Enter your npm credentials when prompted.

### 2. Verify Organization Access

Check that you have access to the organization:

```bash
npm access ls-packages @llm-dev-ops
```

If you don't have access, contact the organization owner to add you.

### 3. Verify Two-Factor Authentication

Ensure 2FA is enabled for publishing:

```bash
npm profile get
```

Look for `tfa: auth-and-writes` or `tfa: auth-only`.

## Publishing Process

### Automated Publishing (Recommended)

We provide an automated script that handles the entire publishing process:

```bash
./scripts/publish.sh
```

This script will:
1. Clean previous builds
2. Build all packages
3. Run all tests
4. Show current version
5. Run a dry-run
6. Ask for confirmation
7. Publish all packages in dependency order
8. Verify successful publication

### Manual Publishing

If you prefer manual control:

#### Step 1: Bump Version

Choose the appropriate version bump:

```bash
# Patch version (0.1.0 -> 0.1.1) - Bug fixes
./scripts/version-bump.sh patch

# Minor version (0.1.0 -> 0.2.0) - New features
./scripts/version-bump.sh minor

# Major version (0.1.0 -> 1.0.0) - Breaking changes
./scripts/version-bump.sh major
```

Or manually:
```bash
npm run version:patch  # or version:minor, version:major
```

#### Step 2: Clean and Build

```bash
npm run clean
npm run build
```

#### Step 3: Run Tests

```bash
npm test -- --run
```

Ensure all tests pass before publishing.

#### Step 4: Dry Run

Test the publishing process without actually publishing:

```bash
npm run publish:dry-run
```

Review the output to ensure all files are included correctly.

#### Step 5: Publish

Publish all packages:

```bash
npm run publish:all
```

Or publish individual packages:

```bash
cd packages/core
npm publish --access public

cd ../providers
npm publish --access public

cd ../middleware
npm publish --access public

cd ../hub
npm publish --access public

cd ../cli
npm publish --access public
```

#### Step 6: Commit and Tag

```bash
git add .
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

## Package Publication Order

Packages must be published in dependency order:

1. **@llm-dev-ops/core** - No dependencies
2. **@llm-dev-ops/providers** - Depends on core
3. **@llm-dev-ops/middleware** - Depends on core
4. **@llm-dev-ops/hub** - Depends on core, providers, middleware
5. **@llm-dev-ops/cli** - Depends on all packages

## Verification

### Check Package on NPM

After publishing, verify the packages are available:

```bash
npm view @llm-dev-ops/core
npm view @llm-dev-ops/providers
npm view @llm-dev-ops/middleware
npm view @llm-dev-ops/hub
npm view @llm-dev-ops/cli
```

### Test Installation

Test that users can install the packages:

```bash
# In a new directory
npm init -y
npm install @llm-dev-ops/hub

# Test CLI
npm install -g @llm-dev-ops/cli
llm-hub --version
```

## Published Package Contents

Each package includes:

### @llm-dev-ops/core
- `dist/` - Compiled JavaScript and TypeScript declarations
- `src/` - Source TypeScript files
- `package.json`
- `README.md`

### @llm-dev-ops/providers
- `dist/` - Compiled provider implementations
- `src/` - Source TypeScript files
- `package.json`
- `README.md`

### @llm-dev-ops/middleware
- `dist/` - Compiled middleware components
- `src/` - Source TypeScript files
- `package.json`
- `README.md`

### @llm-dev-ops/hub
- `dist/` - Compiled orchestrator
- `src/` - Source TypeScript files
- `package.json`
- `README.md`

### @llm-dev-ops/cli
- `dist/` - Compiled CLI code
- `bin/` - Executable scripts
- `package.json`
- `README.md`

## Troubleshooting

### Authentication Issues

**Problem:** `npm ERR! code ENEEDAUTH`

**Solution:**
```bash
npm logout
npm login
```

### Organization Access

**Problem:** `npm ERR! code E403`

**Solution:** Request access from the organization owner or verify you're logged in with the correct account.

### Version Already Exists

**Problem:** `npm ERR! code E409` or `npm ERR! You cannot publish over the previously published versions`

**Solution:** Bump the version number:
```bash
./scripts/version-bump.sh patch
```

### Two-Factor Authentication

**Problem:** `npm ERR! code EOTP`

**Solution:** Generate a 2FA token and provide it:
```bash
npm publish --otp=123456
```

### Network Issues

**Problem:** `npm ERR! network`

**Solution:**
- Check your internet connection
- Try again after a few minutes
- Use a different network if possible

## Best Practices

### Before Publishing

1. **Run Full Test Suite**
   ```bash
   npm test -- --run
   npm run test:coverage
   ```

2. **Check TypeScript Compilation**
   ```bash
   npm run typecheck
   ```

3. **Run Linter**
   ```bash
   npm run lint
   ```

4. **Format Code**
   ```bash
   npm run format:check
   ```

5. **Run Benchmarks**
   ```bash
   npm run bench:all
   ```

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

### Changelog

Update `CHANGELOG.md` with:
- New features
- Bug fixes
- Breaking changes
- Performance improvements
- Documentation updates

### Git Workflow

1. Create a release branch
2. Bump versions
3. Update changelog
4. Commit changes
5. Create pull request
6. Merge to main
7. Tag release
8. Publish to npm
9. Create GitHub release

## NPM Organization Setup

### Creating the Organization

If the `@llm-dev-ops` organization doesn't exist:

```bash
npm org create llm-dev-ops
```

### Adding Members

To add team members:

```bash
npm org set llm-dev-ops developers developer-username
```

### Setting Permissions

Configure package access:

```bash
# Make package public
npm access public @llm-dev-ops/core

# Grant publish rights
npm access grant read-write llm-dev-ops:developers @llm-dev-ops/core
```

## Automated Publishing with CI/CD

### GitHub Actions

Add to `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm test -- --run
      - run: npm run publish:all
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Add `NPM_TOKEN` to GitHub Secrets:
1. Generate token: `npm token create`
2. Add to GitHub: Settings > Secrets > Actions > New repository secret

## Support

For publishing issues:
- Check [npm documentation](https://docs.npmjs.com/)
- Contact organization admin
- Open an issue in the repository

## Package URLs

After publishing, packages will be available at:

- Core: https://www.npmjs.com/package/@llm-dev-ops/core
- Providers: https://www.npmjs.com/package/@llm-dev-ops/providers
- Middleware: https://www.npmjs.com/package/@llm-dev-ops/middleware
- Hub: https://www.npmjs.com/package/@llm-dev-ops/hub
- CLI: https://www.npmjs.com/package/@llm-dev-ops/cli
