# LLM Connector Hub - Examples

This directory contains comprehensive examples demonstrating how to use the LLM Connector Hub in various scenarios, from basic usage to production-ready deployments.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Examples Overview](#examples-overview)
- [Running Examples](#running-examples)
- [Example Details](#example-details)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the packages:**
   ```bash
   npm run build
   ```

3. **Set up environment variables:**
   ```bash
   # Required for most examples
   export OPENAI_API_KEY="sk-..."

   # Optional for multi-provider examples
   export ANTHROPIC_API_KEY="sk-ant-..."
   export GOOGLE_API_KEY="..."

   # Optional configuration
   export OPENAI_ORG_ID="org-..."
   export LOG_LEVEL="info"
   export NODE_ENV="development"
   ```

4. **Run an example:**
   ```bash
   npx tsx examples/basic-completion.ts
   ```

## Environment Setup

### Required Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | Yes (for OpenAI) | OpenAI API key | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Yes (for Anthropic) | Anthropic API key | `sk-ant-...` |
| `GOOGLE_API_KEY` | Yes (for Google) | Google API key | `AIza...` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_ORG_ID` | - | OpenAI organization ID |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `NODE_ENV` | `development` | Environment (development, production) |
| `LLM_CONNECTOR_CONFIG` | `./config/production.json` | Path to config file |

### Creating API Keys

#### OpenAI
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)

#### Anthropic
1. Go to [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Click "Create Key"
3. Copy the key (starts with `sk-ant-`)

#### Google
1. Go to [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Create an API key
3. Enable Vertex AI API

## Examples Overview

| Example | Difficulty | Features Demonstrated |
|---------|-----------|----------------------|
| [basic-completion.ts](#1-basic-completion) | Beginner | Simple requests, error handling |
| [streaming-completion.ts](#2-streaming-completion) | Beginner | Streaming responses, real-time output |
| [multi-provider.ts](#3-multi-provider) | Intermediate | Multiple providers, failover, comparison |
| [with-middleware.ts](#4-middleware) | Intermediate | Retry, logging, metrics, rate limiting |
| [advanced-features.ts](#5-advanced-features) | Advanced | Caching, function calling, multimodal |
| [production-ready.ts](#6-production-ready) | Advanced | Full production configuration |

## Running Examples

### Using npx (Recommended)

```bash
# Run a specific example
npx tsx examples/basic-completion.ts

# Run with environment variables inline
OPENAI_API_KEY=sk-... npx tsx examples/basic-completion.ts
```

### Using npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "example:basic": "tsx examples/basic-completion.ts",
    "example:streaming": "tsx examples/streaming-completion.ts",
    "example:multi": "tsx examples/multi-provider.ts",
    "example:middleware": "tsx examples/with-middleware.ts",
    "example:advanced": "tsx examples/advanced-features.ts",
    "example:production": "tsx examples/production-ready.ts"
  }
}
```

Then run:
```bash
npm run example:basic
```

### Using ts-node

```bash
npx ts-node examples/basic-completion.ts
```

## Example Details

### 1. Basic Completion

**File:** `basic-completion.ts`

**Description:** Demonstrates the simplest way to use LLM Connector Hub with a single provider.

**Features:**
- Initialize ConnectorHub with OpenAI
- Send a basic completion request
- Display formatted responses
- Handle errors gracefully
- Multi-turn conversations

**Run:**
```bash
npx tsx examples/basic-completion.ts
```

**Expected Output:**
```
=== Basic Completion Example ===

Step 1: Initializing OpenAI provider...
✓ Provider initialized

Step 2: Building ConnectorHub...
✓ Hub created

...

=== Response ===
An API (Application Programming Interface) is a set of rules...

=== Usage Information ===
Model: gpt-3.5-turbo
Provider: openai
Prompt tokens: 45
Completion tokens: 78
Total tokens: 123
```

**Key Concepts:**
- Provider initialization
- Request building with CompletionRequestBuilder
- Response handling
- Error categorization

---

### 2. Streaming Completion

**File:** `streaming-completion.ts`

**Description:** Shows how to use streaming completions for real-time response display.

**Features:**
- Setup streaming requests
- Display chunks as they arrive
- Handle stream errors
- Combine chunks into final text
- Progress indicators
- Sequential streaming

**Run:**
```bash
npx tsx examples/streaming-completion.ts
```

**Expected Output:**
```
=== Streaming Completion Example ===

Initializing ConnectorHub...
✓ Hub initialized

Starting stream...

=== Story ===

Once upon a time, in the year 2157...
[text streams in real-time]

=== Stream Complete ===
Finish reason: stop
Total chunks: 42
Time to first chunk: 234ms
Total time: 1456ms
```

**Key Concepts:**
- Streaming vs non-streaming requests
- AsyncIterator usage
- Chunk processing
- Performance metrics

---

### 3. Multi-Provider

**File:** `multi-provider.ts`

**Description:** Demonstrates working with multiple LLM providers simultaneously.

**Features:**
- Configure multiple providers (OpenAI, Anthropic)
- Compare responses from different providers
- Automatic failover between providers
- Health monitoring
- Provider selection strategies

**Run:**
```bash
# With multiple providers
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
npx tsx examples/multi-provider.ts

# With single provider
export OPENAI_API_KEY="sk-..."
npx tsx examples/multi-provider.ts
```

**Expected Output:**
```
=== Multi-Provider Example ===

✓ OpenAI provider configured
✓ Anthropic provider configured

Question: What are the three laws of robotics?

================================================================================

Requesting from openai...
✓ Response received in 1234ms

Requesting from anthropic...
✓ Response received in 1567ms

=== Response Comparison ===

Provider: OPENAI
Model: gpt-3.5-turbo
Duration: 1234ms
Tokens: 156

Response: [OpenAI's response]

---

Provider: ANTHROPIC
Model: claude-3-haiku-20240307
Duration: 1567ms
Tokens: 142

Response: [Anthropic's response]
```

**Key Concepts:**
- Multiple provider configuration
- Provider-specific model selection
- Response comparison
- Failover strategies
- Health checks

---

### 4. Middleware

**File:** `with-middleware.ts`

**Description:** Shows how to use middleware for cross-cutting concerns.

**Features:**
- Retry middleware with exponential backoff
- Logging middleware for observability
- Metrics collection
- Rate limiting concepts
- Circuit breaker pattern
- Complete middleware pipeline

**Run:**
```bash
npx tsx examples/with-middleware.ts
```

**Expected Output:**
```
=== Logging Middleware Example ===

Creating hub with logging middleware...
✓ Hub created with logging

Sending request (watch for logs)...
[LOG] Request to openai: { model: 'gpt-3.5-turbo', ... }
[LOG] Response from openai: { content: '...', tokens: 45 }

=== Retry Middleware Example ===

Creating hub with retry middleware...
✓ Hub created with retry policy:
  - Max attempts: 3
  - Initial delay: 1000ms
  - Backoff multiplier: 2x

...
```

**Key Concepts:**
- Middleware pipeline
- Retry policies
- Exponential backoff
- Logging best practices
- Metrics collection
- Error handling middleware

---

### 5. Advanced Features

**File:** `advanced-features.ts`

**Description:** Demonstrates advanced capabilities of the framework.

**Features:**
- Response caching for performance
- Health monitoring and status checks
- Custom provider selection strategies
- Function calling (tools/agents)
- Multimodal requests (text + images)
- JSON mode for structured output
- Advanced configuration options

**Run:**
```bash
npx tsx examples/advanced-features.ts
```

**Expected Output:**
```
=== Caching Example ===

Creating hub with caching enabled...
✓ Hub created with cache (TTL: 1 hour, Max: 100 entries)

First request (will call API)...
✓ Response: Paris
Time: 1456ms

Second identical request (should use cache)...
✓ Response: Paris
Time: 12ms
Speed improvement: 12133% faster

=== Function Calling Example ===

Defined functions:
  1. get_weather - Get weather information
  2. get_stock_price - Get stock prices

=== Model wants to call functions ===

Function: get_weather
Arguments: {"location": "New York", "unit": "celsius"}

Function: get_stock_price
Arguments: {"symbol": "AAPL"}
```

**Key Concepts:**
- Response caching strategies
- Health monitoring configuration
- Provider selection algorithms
- Function/tool definitions
- Multimodal content
- Structured output with JSON mode

---

### 6. Production-Ready

**File:** `production-ready.ts`

**Description:** Complete production-grade configuration example.

**Features:**
- Complete configuration management
- Secrets management best practices
- Comprehensive error handling
- Monitoring and observability
- Performance optimization
- Security considerations
- Resource cleanup

**Run:**
```bash
# With environment variables
npx tsx examples/production-ready.ts

# With config file
export LLM_CONNECTOR_CONFIG=./config/production.json
npx tsx examples/production-ready.ts
```

**Expected Output:**
```
=== Production-Ready Configuration Example ===

Loading production configuration...
✓ Loading config from: ./config/production.json

Validating configuration...
✓ Configuration validated successfully

Initializing ConnectorHub...
✓ Adding OpenAI provider
✓ Adding Anthropic provider

Configuring middleware:
✓ Metrics collection
✓ Logging
✓ Retry logic

Configuring cache:
  Type: memory
  TTL: 3600s
  Max size: 1000

=== Pre-flight Health Check ===
✓ openai: HEALTHY
✓ anthropic: HEALTHY

=== Processing Sample Request ===
Input validated (65 chars)

=== Request Successful ===
Response: [detailed response about error handling]

=== Metrics ===
Duration: 1234ms
Provider: openai
Model: gpt-3.5-turbo
Tokens: 456
```

**Key Concepts:**
- Configuration management
- Environment-based configuration
- Secrets management
- Input validation
- Output sanitization
- Comprehensive error handling
- Monitoring best practices
- Security hardening
- Resource cleanup

## Troubleshooting

### Common Issues

#### 1. API Key Not Set

**Error:**
```
Error: OPENAI_API_KEY environment variable is required
```

**Solution:**
```bash
export OPENAI_API_KEY="sk-your-key-here"
```

#### 2. Package Not Built

**Error:**
```
Cannot find module '@llm-connector-hub/core'
```

**Solution:**
```bash
npm run build
```

#### 3. Network/Timeout Errors

**Error:**
```
Error: Request timeout
```

**Solutions:**
- Check internet connection
- Increase timeout in provider configuration
- Check provider status page

#### 4. Rate Limit Errors

**Error:**
```
Error: 429 - Rate limit exceeded
```

**Solutions:**
- Wait before retrying
- Implement rate limiting middleware
- Upgrade API plan

#### 5. Authentication Errors

**Error:**
```
Error: 401 - Unauthorized
```

**Solutions:**
- Verify API key is correct
- Check API key hasn't expired
- Ensure proper permissions

### Debug Mode

Enable detailed logging:

```bash
export LOG_LEVEL=debug
npx tsx examples/basic-completion.ts
```

### TypeScript Errors

If you encounter TypeScript compilation errors:

```bash
# Clean build
npm run clean
npm install
npm run build

# Check types
npm run typecheck
```

## Best Practices

### 1. Error Handling

Always wrap API calls in try-catch blocks:

```typescript
try {
  const response = await hub.complete('openai', request);
  console.log(response.message.content);
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    // Handle specific error types
  }
}
```

### 2. Environment Variables

Never hardcode API keys:

```typescript
// ❌ Bad
const apiKey = "sk-1234567890abcdef";

// ✅ Good
const apiKey = process.env['OPENAI_API_KEY'];
if (!apiKey) {
  throw new Error('OPENAI_API_KEY is required');
}
```

### 3. Request Configuration

Use appropriate parameters for your use case:

```typescript
// For deterministic responses (testing, production)
.temperature(0)

// For creative responses (content generation)
.temperature(0.8)

// Always set max tokens to prevent runaway costs
.maxTokens(500)
```

### 4. Middleware Order

Add middleware in the correct order (outer to inner):

```typescript
ConnectorHub.builder()
  .addProvider(provider)
  .addMiddleware(new MetricsMiddleware())  // Outermost
  .addMiddleware(new LoggingMiddleware())
  .addMiddleware(new RetryMiddleware())    // Innermost
  .build();
```

### 5. Resource Cleanup

Always clean up resources:

```typescript
try {
  // Use the hub
} finally {
  // Cleanup
  await hub.shutdown(); // If implemented
}
```

### 6. Caching

Use caching for deterministic queries:

```typescript
// ✅ Good for caching (temperature = 0)
const request = new CompletionRequestBuilder()
  .userMessage('What is the capital of France?')
  .temperature(0)  // Deterministic
  .build();

// ❌ Bad for caching (temperature > 0)
const request = new CompletionRequestBuilder()
  .userMessage('Write a creative story')
  .temperature(0.8)  // Non-deterministic
  .build();
```

### 7. Cost Optimization

Monitor and control costs:

```typescript
// Use cheaper models for simple tasks
.model('gpt-3.5-turbo')  // Instead of gpt-4

// Limit max tokens
.maxTokens(100)  // Don't allow unlimited

// Enable caching
.enableCache({ ttl: 3600 })

// Use streaming for better UX without extra cost
.stream(true)
```

### 8. Security

Validate and sanitize all inputs/outputs:

```typescript
// Validate input length
if (userInput.length > MAX_LENGTH) {
  throw new Error('Input too long');
}

// Sanitize output
const sanitized = output
  .replace(/API_KEY:\s*sk-[^\s]+/g, 'API_KEY: [REDACTED]')
  .trim();
```

## Additional Resources

### Documentation
- [Main README](../README.md) - Project overview
- [Architecture](../ARCHITECTURE.md) - System architecture
- [API Reference](../docs/api/README.md) - Detailed API docs

### Provider Documentation
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Google Vertex AI](https://cloud.google.com/vertex-ai/docs)

### Community
- [GitHub Issues](https://github.com/your-org/llm-connector-hub/issues)
- [Discussions](https://github.com/your-org/llm-connector-hub/discussions)

## Contributing

Found a bug in an example or want to add a new one?

1. Fork the repository
2. Create a feature branch
3. Add or update examples
4. Update this README
5. Submit a pull request

## License

These examples are part of the LLM Connector Hub project and are licensed under either:

- Apache License, Version 2.0
- MIT License

at your option.

---

**Need help?** Open an issue on [GitHub](https://github.com/your-org/llm-connector-hub/issues)!
