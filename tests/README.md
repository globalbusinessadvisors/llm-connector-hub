# Tests

This directory contains the test suite for LLM Connector Hub.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch
```

## Test Structure

- `core/` - Tests for core package (interfaces, types, utilities)
- `providers/` - Tests for provider implementations
- `middleware/` - Tests for middleware components
- `hub/` - Tests for the orchestrator
- `integration/` - Integration tests

## Writing Tests

We use Vitest as our testing framework. Example:

```typescript
import { describe, expect, it } from 'vitest';

describe('MyComponent', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## Coverage

Test coverage reports are generated in the `coverage/` directory.
