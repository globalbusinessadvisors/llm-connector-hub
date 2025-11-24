# Getting Started with LLM Connector Hub

Welcome to LLM Connector Hub! This guide will help you get up and running quickly with our unified TypeScript framework for interfacing with multiple Large Language Model providers.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Your First Completion Request](#your-first-completion-request)
4. [Basic Configuration](#basic-configuration)
5. [Common Troubleshooting](#common-troubleshooting)
6. [Next Steps](#next-steps)

---

## Installation

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0.0 or later
- **npm** 9.0.0 or later
- An API key from at least one LLM provider (OpenAI, Anthropic, or Google)

### Installing as a Dependency

Add LLM Connector Hub to your TypeScript/JavaScript project:

```bash
npm install llm-connector-hub
```

Or if you're using yarn:

```bash
yarn add llm-connector-hub
```

Or with pnpm:

```bash
pnpm add llm-connector-hub
```

### Development Installation

To work on LLM Connector Hub itself or run examples:

```bash
# Clone the repository
git clone https://github.com/your-org/llm-connector-hub
cd llm-connector-hub

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests to verify installation
npm test
```

---

## Quick Start

Here's the fastest way to make your first LLM request:

### 1. Set Up Your API Key

Create a `.env` file in your project root:

```env
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GOOGLE_API_KEY=your-google-key-here
```

### 2. Create Your First Script

Create a file called `simple-completion.ts`:

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';

async function main() {
  // Initialize the hub with OpenAI provider
  const hub = new ConnectorHub();

  const openai = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4'
  });

  hub.registerProvider('openai', openai);

  // Send a completion request
  const response = await hub.complete({
    provider: 'openai',
    messages: [
      { role: 'user', content: 'Explain quantum computing in simple terms.' }
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  console.log(response.content);
}

main().catch(console.error);
```

### 3. Run Your Script

```bash
npx tsx simple-completion.ts
# or if using ts-node:
ts-node simple-completion.ts
```

You should see a response explaining quantum computing!

---

## Your First Completion Request

Let's break down the components of a completion request and explore different patterns.

### Basic Message Completion

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';

const hub = new ConnectorHub();
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!
});

hub.registerProvider('openai', provider);

// Simple single message
const response = await hub.complete({
  provider: 'openai',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ]
});

console.log(response.content);
```

### Multi-Turn Conversation

```typescript
// Conversation with context
const conversationResponse = await hub.complete({
  provider: 'openai',
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'How do I sort an array in JavaScript?' },
    { role: 'assistant', content: 'You can use the .sort() method...' },
    { role: 'user', content: 'What about sorting numbers?' }
  ]
});
```

### Streaming Responses

For real-time responses as they're generated:

```typescript
const stream = await hub.streamComplete({
  provider: 'openai',
  messages: [
    { role: 'user', content: 'Write a short story about a robot.' }
  ]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content || '');
}
```

### Using Multiple Providers

Switch between providers seamlessly:

```typescript
import { OpenAIProvider, AnthropicProvider } from '@llm-connector-hub/providers';

const hub = new ConnectorHub();

// Register multiple providers
hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!
}));

hub.registerProvider('anthropic', new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!
}));

// Use OpenAI
const gptResponse = await hub.complete({
  provider: 'openai',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Use Anthropic
const claudeResponse = await hub.complete({
  provider: 'anthropic',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

---

## Basic Configuration

### Provider Configuration

Each provider can be configured with specific options:

```typescript
import { OpenAIProvider } from '@llm-connector-hub/providers';

const openai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: 'org-123456',  // Optional
  baseURL: 'https://api.openai.com/v1',  // Optional, defaults to OpenAI
  timeout: 60000,  // 60 seconds
  maxRetries: 3
});
```

### Hub Configuration

Configure the ConnectorHub with middleware and defaults:

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { RetryMiddleware, LoggingMiddleware } from '@llm-connector-hub/middleware';

const hub = new ConnectorHub({
  defaultProvider: 'openai',
  middleware: [
    new RetryMiddleware({ maxAttempts: 3, backoff: 'exponential' }),
    new LoggingMiddleware({ level: 'info' })
  ]
});
```

### Environment Variables

Recommended environment variables:

```env
# Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Optional Configuration
LLM_DEFAULT_PROVIDER=openai
LLM_REQUEST_TIMEOUT=60000
LLM_MAX_RETRIES=3
LLM_LOG_LEVEL=info
```

### TypeScript Configuration

For optimal TypeScript support, add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

---

## Common Troubleshooting

### API Key Errors

**Problem**: `Error: API key is required`

**Solution**:
- Ensure your `.env` file is in the project root
- Verify you're loading environment variables (use `dotenv` package)
- Check the API key is correctly named

```typescript
import 'dotenv/config';  // Add this at the top of your file

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}
```

### Rate Limit Errors

**Problem**: `Error: Rate limit exceeded`

**Solution**:
- Add retry middleware with backoff
- Implement rate limiting on your end
- Check your provider's rate limits

```typescript
import { RetryMiddleware, RateLimitMiddleware } from '@llm-connector-hub/middleware';

hub.use(new RetryMiddleware({
  maxAttempts: 5,
  backoff: 'exponential'
}));

hub.use(new RateLimitMiddleware({
  maxRequests: 50,
  windowMs: 60000  // 50 requests per minute
}));
```

### Timeout Errors

**Problem**: `Error: Request timeout`

**Solution**:
- Increase timeout duration
- Check network connectivity
- Consider using streaming for long responses

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 120000  // Increase to 2 minutes
});
```

### Type Errors

**Problem**: TypeScript type errors with messages or responses

**Solution**:
- Ensure you're using the correct types from `@llm-connector-hub/core`
- Check your TypeScript version (>=5.0 recommended)

```typescript
import type { Message, CompletionRequest } from '@llm-connector-hub/core';

const messages: Message[] = [
  { role: 'user', content: 'Hello!' }
];

const request: CompletionRequest = {
  provider: 'openai',
  messages,
  temperature: 0.7
};
```

### Module Not Found Errors

**Problem**: `Cannot find module '@llm-connector-hub/hub'`

**Solution**:
- Run `npm install` to ensure all dependencies are installed
- Check your imports match the package structure
- Verify packages are built: `npm run build`

### Provider-Specific Errors

#### OpenAI Errors

```typescript
// Invalid model error
try {
  await hub.complete({
    provider: 'openai',
    model: 'gpt-999',  // Invalid model
    messages: [...]
  });
} catch (error) {
  if (error.type === 'invalid_request') {
    console.error('Invalid model specified');
  }
}
```

#### Anthropic Errors

```typescript
// Anthropic requires different message formatting
const response = await hub.complete({
  provider: 'anthropic',
  messages: [
    // Note: system message handling differs
    { role: 'user', content: 'Hello!' }
  ]
});
```

### Debug Mode

Enable detailed logging to troubleshoot issues:

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { LoggingMiddleware } from '@llm-connector-hub/middleware';

const hub = new ConnectorHub({
  middleware: [
    new LoggingMiddleware({
      level: 'debug',  // Set to debug for detailed logs
      includeRequestBody: true,
      includeResponseBody: true
    })
  ]
});
```

---

## Next Steps

Congratulations on completing the getting started guide! Here's where to go next:

### Dive Deeper

1. **[User Guide](./user-guide/README.md)** - Comprehensive guide to all features
2. **[Provider Configuration](./user-guide/providers.md)** - Detailed provider setup
3. **[Middleware Guide](./user-guide/middleware.md)** - Custom middleware and pipelines
4. **[Streaming Guide](./user-guide/streaming.md)** - Advanced streaming patterns

### API Reference

1. **[ConnectorHub API](./api/connector-hub.md)** - Complete API documentation
2. **[Provider Interface](./api/providers.md)** - Provider implementation details
3. **[Data Models](./api/models.md)** - Type definitions and interfaces

### Advanced Topics

1. **[Caching Strategies](./user-guide/caching.md)** - Optimize performance with caching
2. **[Error Handling](./user-guide/error-handling.md)** - Robust error handling patterns
3. **[Health Monitoring](./user-guide/health-monitoring.md)** - Monitor system health

### Deployment

1. **[Docker Deployment](./deployment/docker.md)** - Containerized deployment
2. **[Kubernetes Guide](./deployment/kubernetes.md)** - Production Kubernetes setup
3. **[Security Best Practices](./deployment/security.md)** - Secure your deployment

### Examples

Check out the [examples](../examples/) directory for complete, runnable examples:

- `simple-completion.ts` - Basic completion requests
- `streaming.ts` - Streaming responses
- `multi-provider.ts` - Using multiple providers
- `middleware.ts` - Custom middleware implementation
- `error-handling.ts` - Comprehensive error handling

### Community and Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/llm-connector-hub/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/your-org/llm-connector-hub/discussions)
- **Examples**: [Browse community examples](https://github.com/your-org/llm-connector-hub/tree/main/examples)

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Common Imports

```typescript
// Core types
import type {
  Message,
  CompletionRequest,
  CompletionResponse
} from '@llm-connector-hub/core';

// Hub
import { ConnectorHub } from '@llm-connector-hub/hub';

// Providers
import {
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider
} from '@llm-connector-hub/providers';

// Middleware
import {
  RetryMiddleware,
  LoggingMiddleware,
  CacheMiddleware,
  RateLimitMiddleware
} from '@llm-connector-hub/middleware';
```

### Essential Configuration Template

```typescript
import 'dotenv/config';
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';
import { RetryMiddleware, LoggingMiddleware } from '@llm-connector-hub/middleware';

// Initialize hub
const hub = new ConnectorHub({
  middleware: [
    new RetryMiddleware({ maxAttempts: 3 }),
    new LoggingMiddleware({ level: 'info' })
  ]
});

// Register provider
hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!
}));

// Make request
const response = await hub.complete({
  provider: 'openai',
  messages: [
    { role: 'user', content: 'Your message here' }
  ]
});

console.log(response.content);
```

---

Happy coding! If you run into any issues, check the [troubleshooting section](#common-troubleshooting) or reach out to the community.
