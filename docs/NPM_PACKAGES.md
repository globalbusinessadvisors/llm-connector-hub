# NPM Packages

LLM Connector Hub is published as a set of modular npm packages under the `@llm-dev-ops` organization.

## Published Packages

### @llm-dev-ops/core

**Core interfaces, types, and models**

[![npm version](https://img.shields.io/npm/v/@llm-dev-ops/core)](https://www.npmjs.com/package/@llm-dev-ops/core)
[![npm downloads](https://img.shields.io/npm/dm/@llm-dev-ops/core)](https://www.npmjs.com/package/@llm-dev-ops/core)

```bash
npm install @llm-dev-ops/core
```

**Contains:**
- Provider interfaces
- Message types
- Error classes
- Configuration schemas
- Utility functions

**Use when:** Building custom providers or middleware

---

### @llm-dev-ops/providers

**LLM provider implementations**

[![npm version](https://img.shields.io/npm/v/@llm-dev-ops/providers)](https://www.npmjs.com/package/@llm-dev-ops/providers)
[![npm downloads](https://img.shields.io/npm/dm/@llm-dev-ops/providers)](https://www.npmjs.com/package/@llm-dev-ops/providers)

```bash
npm install @llm-dev-ops/providers
```

**Contains:**
- OpenAI provider
- Anthropic (Claude) provider
- Google AI (Gemini) provider
- Request/response transformers
- Streaming support
- Error mapping

**Use when:** Need direct access to individual providers

**Supported Providers:**
- **OpenAI**: GPT-4, GPT-3.5, etc.
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku)
- **Google**: Gemini Pro, Gemini Pro Vision

---

### @llm-dev-ops/middleware

**Middleware components for cross-cutting concerns**

[![npm version](https://img.shields.io/npm/v/@llm-dev-ops/middleware)](https://www.npmjs.com/package/@llm-dev-ops/middleware)
[![npm downloads](https://img.shields.io/npm/dm/@llm-dev-ops/middleware)](https://www.npmjs.com/package/@llm-dev-ops/middleware)

```bash
npm install @llm-dev-ops/middleware
```

**Contains:**
- Retry middleware with exponential backoff
- Rate limiting (token bucket, sliding window)
- Circuit breaker
- Response caching (LRU, Redis)
- Logging middleware
- Metrics collection (Prometheus)
- Middleware pipeline

**Use when:** Need specific middleware features

---

### @llm-dev-ops/hub

**Complete orchestration layer** ⭐ Recommended

[![npm version](https://img.shields.io/npm/v/@llm-dev-ops/hub)](https://www.npmjs.com/package/@llm-dev-ops/hub)
[![npm downloads](https://img.shields.io/npm/dm/@llm-dev-ops/hub)](https://www.npmjs.com/package/@llm-dev-ops/hub)

```bash
npm install @llm-dev-ops/hub
```

**Contains:**
- ConnectorHub orchestrator
- Provider registry
- Health monitoring
- Cache manager
- Builder API
- All providers and middleware

**Use when:** Want the complete solution (recommended for most users)

---

### @llm-dev-ops/cli

**Command-line interface**

[![npm version](https://img.shields.io/npm/v/@llm-dev-ops/cli)](https://www.npmjs.com/package/@llm-dev-ops/cli)
[![npm downloads](https://img.shields.io/npm/dm/@llm-dev-ops/cli)](https://www.npmjs.com/package/@llm-dev-ops/cli)

```bash
npm install -g @llm-dev-ops/cli
```

**Contains:**
- Interactive CLI tool
- Command: `llm-hub`
- Completion requests
- Interactive chat
- Configuration management
- Provider testing

**Use when:** Need CLI access to LLM providers

---

## Installation Examples

### Full Stack (Recommended)

Install everything you need:

```bash
npm install @llm-dev-ops/hub
```

### Minimal Setup

Install only core and specific providers:

```bash
npm install @llm-dev-ops/core @llm-dev-ops/providers
```

### Custom Middleware

Install core, providers, and middleware:

```bash
npm install @llm-dev-ops/core @llm-dev-ops/providers @llm-dev-ops/middleware
```

### CLI Only

Install the CLI globally:

```bash
npm install -g @llm-dev-ops/cli
```

## Usage Examples

### Using @llm-dev-ops/hub (Recommended)

```typescript
import { ConnectorHubBuilder } from '@llm-dev-ops/hub';

const hub = new ConnectorHubBuilder()
  .addOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  })
  .addAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })
  .withRetry({
    maxRetries: 3,
    baseDelay: 1000,
  })
  .withCache({
    type: 'memory',
    maxSize: 100,
  })
  .build();

await hub.initialize();

const response = await hub.complete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.message.content);
```

### Using Individual Providers

```typescript
import { createOpenAIProvider } from '@llm-dev-ops/providers';

const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
});

await provider.initialize();

const response = await provider.complete({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  temperature: 0.7,
  max_tokens: 1000,
});

console.log(response.message.content);
```

### Using Middleware

```typescript
import { createOpenAIProvider } from '@llm-dev-ops/providers';
import { RetryMiddleware, CacheMiddleware, Pipeline } from '@llm-dev-ops/middleware';

const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
});

const pipeline = new Pipeline();
pipeline.use(new RetryMiddleware({ maxRetries: 3 }));
pipeline.use(new CacheMiddleware({ type: 'memory', maxSize: 100 }));

// Use pipeline with provider
// (Manual integration required)
```

### Using CLI

```bash
# Initialize config
llm-hub config init

# Set API keys
llm-hub config set providers.openai.apiKey "sk-..."

# Get a completion
llm-hub complete "What is TypeScript?"

# Start interactive chat
llm-hub chat --provider openai

# Test provider
llm-hub providers test openai
```

## Package Dependencies

```
@llm-dev-ops/core (no dependencies)
    ↓
@llm-dev-ops/providers
    ↓
@llm-dev-ops/middleware
    ↓
@llm-dev-ops/hub
    ↓
@llm-dev-ops/cli
```

## Package Sizes

| Package | Unpacked Size | Bundle Size |
|---------|---------------|-------------|
| core | ~100 KB | ~20 KB |
| providers | ~500 KB | ~80 KB |
| middleware | ~300 KB | ~50 KB |
| hub | ~200 KB | ~40 KB |
| cli | ~150 KB | ~30 KB |

## TypeScript Support

All packages include TypeScript declarations:

```typescript
import type {
  Message,
  CompletionRequest,
  CompletionResponse
} from '@llm-dev-ops/core';

import type {
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider
} from '@llm-dev-ops/providers';

import type {
  IMiddleware,
  RetryConfig,
  CacheConfig
} from '@llm-dev-ops/middleware';

import type {
  ConnectorHub,
  HubConfig
} from '@llm-dev-ops/hub';
```

## Versioning

All packages follow [Semantic Versioning](https://semver.org/):

- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

All packages in the monorepo are versioned together for consistency.

## License

All packages are dual-licensed under **MIT OR Apache-2.0**.

## Support

- **Documentation**: https://github.com/globalbusinessadvisors/llm-connector-hub/tree/main/docs
- **Issues**: https://github.com/globalbusinessadvisors/llm-connector-hub/issues
- **Discussions**: https://github.com/globalbusinessadvisors/llm-connector-hub/discussions

## Links

- **GitHub Repository**: https://github.com/globalbusinessadvisors/llm-connector-hub
- **NPM Organization**: https://www.npmjs.com/org/llm-dev-ops
- **Documentation**: [/docs](../docs)
- **Examples**: [/examples](../examples)
