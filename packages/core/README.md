# @llm-connector-hub/core

Core interfaces, types, and utilities for the LLM Connector Hub.

## Overview

This package provides the foundational building blocks for creating unified LLM provider integrations:

- **Interfaces**: Define contracts for providers, middleware, cache, rate limiters, and circuit breakers
- **Models**: Type-safe data models for requests, responses, messages, and configurations
- **Errors**: Comprehensive error hierarchy with detailed error information
- **Validation**: Zod-based schemas for runtime validation

## Installation

```bash
npm install @llm-connector-hub/core
```

## Features

### Core Interfaces

- **IProvider**: Unified interface for LLM providers (OpenAI, Anthropic, etc.)
- **IMiddleware**: Middleware pipeline for cross-cutting concerns
- **ICache**: Cache interface for response caching
- **IRateLimiter**: Rate limiting to prevent API quota exhaustion
- **ICircuitBreaker**: Circuit breaker pattern for fault tolerance

### Data Models

- **CompletionRequest/Response**: Normalized request/response formats
- **Message**: Support for text, images, and tool calls
- **Config**: Type-safe configuration management
- **Health**: Health check and monitoring
- **Metrics**: Performance and usage metrics

### Error Handling

- **BaseError**: Base class with rich error metadata
- **ProviderError**: Provider-specific errors with retry logic
- **ValidationError**: Field-level validation errors
- **RateLimitError**: Rate limit information and retry timing
- **CircuitBreakerError**: Circuit breaker state information

### Validation

Zod-based schemas for all models with:
- Runtime type validation
- Detailed error messages
- Type inference

## Usage

### Creating a Completion Request

```typescript
import { CompletionRequestBuilder, MessageBuilder } from '@llm-connector-hub/core';

const request = new CompletionRequestBuilder()
  .withModel('gpt-4')
  .addMessage(MessageBuilder.system('You are a helpful assistant'))
  .addMessage(MessageBuilder.user('Hello!'))
  .withTemperature(0.7)
  .withMaxTokens(100)
  .build();
```

### Implementing a Provider

```typescript
import { IProvider, CompletionRequest, CompletionResponse } from '@llm-connector-hub/core';

class MyProvider implements IProvider {
  readonly name = 'my-provider';
  readonly version = '1.0.0';
  readonly capabilities = {
    streaming: true,
    functionCalling: true,
    vision: false,
    embeddings: false,
    maxContextWindow: 8192,
    supportedModels: ['model-1', 'model-2'],
  };

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Implementation
  }

  // ... other methods
}
```

### Using Validation

```typescript
import { validateCompletionRequest } from '@llm-connector-hub/core';

try {
  const validRequest = validateCompletionRequest(data);
  // Use validRequest
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation errors:', error.getFieldErrors());
  }
}
```

### Error Handling

```typescript
import { ProviderError, RateLimitError, CircuitBreakerError } from '@llm-connector-hub/core';

try {
  const response = await provider.complete(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    const retryAfter = error.getRetryAfter();
    console.log(`Rate limited. Retry in ${retryAfter}ms`);
  } else if (error instanceof CircuitBreakerError) {
    console.log(`Circuit breaker open for ${error.getService()}`);
  } else if (error instanceof ProviderError) {
    console.log(`Provider error: ${error.message}`);
  }
}
```

## TypeScript Support

This package is written in TypeScript with strict mode enabled and provides full type definitions.

All interfaces and types are exported for use in your TypeScript projects.

## License

MIT
