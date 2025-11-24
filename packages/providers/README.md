# @llm-dev-ops/providers

LLM provider implementations for the LLM Connector Hub - unified integrations for Anthropic Claude and Google Gemini.

## Overview

This package provides production-ready implementations of LLM providers that conform to the `IProvider` interface from `@llm-dev-ops/core`. Each provider includes:

- Request/response transformation to unified format
- Streaming support with SSE parsing
- Comprehensive error handling and mapping
- Model-specific configuration and validation
- Safety controls and content filtering
- Automatic retry logic

## Installation

```bash
npm install @llm-dev-ops/providers @llm-dev-ops/core
```

## Supported Providers

### Anthropic (Claude)
- **Models:** claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307, claude-2.1, claude-2.0, claude-instant-1.2
- **Features:** Streaming, function calling, vision (Claude 3), long context windows
- **Max Tokens:** 4096 (output), up to 200K context window

### Google AI (Gemini)
- **Models:** gemini-pro, gemini-pro-vision, gemini-ultra
- **Features:** Streaming, function calling, vision, safety controls
- **Max Tokens:** 2048 (output), up to 32K context window

## Usage

### Anthropic Provider

```typescript
import { Anthropic } from '@llm-dev-ops/providers';
import { CompletionRequestBuilder, MessageBuilder } from '@llm-dev-ops/core';

// Create provider
const provider = new Anthropic.AnthropicProvider();

// Initialize with API key
await provider.initialize({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-3-sonnet-20240229',
  maxRetries: 3,
});

// Make a completion request
const request = new CompletionRequestBuilder()
  .withModel('claude-3-sonnet-20240229')
  .addMessage(MessageBuilder.user('Explain quantum computing'))
  .withTemperature(0.7)
  .withMaxTokens(1024)
  .build();

const response = await provider.complete(request);
console.log(response.choices[0].message.content);
```

### Google Provider

```typescript
import { Google } from '@llm-dev-ops/providers';
import { CompletionRequestBuilder, MessageBuilder } from '@llm-dev-ops/core';

// Create provider from environment variable
const provider = Google.createGoogleProviderFromEnv();

// Or create with explicit config
const providerWithConfig = new Google.GoogleProvider();
await providerWithConfig.initialize({
  apiKey: process.env.GOOGLE_AI_API_KEY,
  defaultModel: 'gemini-pro',
  safetySettings: Google.DEFAULT_SAFETY_SETTINGS,
});

// Make a completion request
const request = new CompletionRequestBuilder()
  .withModel('gemini-pro')
  .addMessage(MessageBuilder.user('What is machine learning?'))
  .withTemperature(0.8)
  .withMaxTokens(2048)
  .build();

const response = await provider.complete(request);
console.log(response.choices[0].message.content);
```

## Streaming

### Anthropic Streaming

```typescript
import { Anthropic } from '@llm-dev-ops/providers';

const stream = await provider.stream(request);

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    process.stdout.write(delta);
  }
}
```

### Google Streaming

```typescript
import { Google } from '@llm-dev-ops/providers';

const stream = await provider.stream(request);

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    process.stdout.write(delta);
  }
}
```

## Advanced Features

### Vision Support

Both Anthropic Claude 3 and Google Gemini Pro Vision support image inputs:

```typescript
import { MessageBuilder } from '@llm-dev-ops/core';

const request = new CompletionRequestBuilder()
  .withModel('claude-3-sonnet-20240229')
  .addMessage(
    MessageBuilder.user([
      { type: 'text', text: 'What is in this image?' },
      {
        type: 'image',
        imageUrl: {
          url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        },
      },
    ])
  )
  .build();

const response = await provider.complete(request);
```

### Function Calling

```typescript
import { CompletionRequestBuilder } from '@llm-dev-ops/core';

const request = new CompletionRequestBuilder()
  .withModel('claude-3-sonnet-20240229')
  .addMessage({ role: 'user', content: 'What is the weather in Boston?' })
  .withTools([
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather in a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City and state' },
          },
          required: ['location'],
        },
      },
    },
  ])
  .build();

const response = await provider.complete(request);

// Check for tool calls
if (response.choices[0].finishReason === 'tool_calls') {
  const toolCall = response.choices[0].message.toolCalls[0];
  console.log('Function:', toolCall.function.name);
  console.log('Arguments:', toolCall.function.arguments);
}
```

### Safety Settings (Google)

```typescript
import { Google } from '@llm-dev-ops/providers';

const provider = new Google.GoogleProvider();
await provider.initialize({
  apiKey: process.env.GOOGLE_AI_API_KEY,
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
  ],
});
```

## Error Handling

Both providers include comprehensive error mapping:

```typescript
import { ProviderError, RateLimitError } from '@llm-dev-ops/core';
import { Anthropic } from '@llm-dev-ops/providers';

try {
  const response = await provider.complete(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    const retryAfter = error.getRetryAfter();
    console.log(`Rate limited. Retry in ${retryAfter}ms`);
  } else if (error instanceof ProviderError) {
    console.log(`Provider error: ${error.message}`);
    console.log(`Provider: ${error.getProvider()}`);
    console.log(`Retryable: ${error.isRetryable()}`);
  }
}
```

## Configuration

### Anthropic Configuration

```typescript
interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: AnthropicModel;
  maxRetries?: number;
  timeout?: number;
  maxTokens?: number;
}
```

### Google Configuration

```typescript
interface GoogleConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: GoogleModel;
  maxRetries?: number;
  timeout?: number;
  safetySettings?: GoogleSafetySetting[];
}
```

## Model Information

### Query Model Capabilities

```typescript
import { Anthropic, Google } from '@llm-dev-ops/providers';

// Anthropic
const modelInfo = Anthropic.getModelInfo('claude-3-sonnet-20240229');
console.log('Supports vision:', Anthropic.supportsVision('claude-3-sonnet-20240229'));
console.log('Max tokens:', Anthropic.getMaxTokens('claude-3-sonnet-20240229'));

// Google
const geminiInfo = Google.getModelInfo('gemini-pro');
console.log('Supports streaming:', Google.supportsStreaming('gemini-pro'));
console.log('Context window:', Google.getContextWindow('gemini-pro'));
```

## Health Checks

All providers support health checks:

```typescript
const health = await provider.healthCheck();

console.log('Status:', health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log('Response time:', health.responseTime);
console.log('Details:', health.details);
```

## Utilities

### Stream Accumulator

```typescript
import { Anthropic } from '@llm-dev-ops/providers';

const accumulator = new Anthropic.StreamAccumulator();

for await (const chunk of stream) {
  accumulator.add(chunk);
}

const fullResponse = accumulator.toResponse();
```

## Environment Variables

Set API keys via environment variables:

- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_AI_API_KEY` - Google AI API key

## TypeScript Support

This package is written in TypeScript with strict mode enabled and provides full type definitions for all provider APIs, configurations, and responses.

## Testing

```bash
npm test
npm run test:coverage
```

## License

MIT OR Apache-2.0
