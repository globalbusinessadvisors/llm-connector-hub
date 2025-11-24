# Providers Guide

This guide covers all supported LLM providers with detailed setup instructions, capabilities, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [OpenAI](#openai)
3. [Anthropic](#anthropic)
4. [Google Vertex AI](#google-vertex-ai)
5. [Provider Comparison](#provider-comparison)
6. [Provider Selection](#provider-selection)
7. [Custom Providers](#custom-providers)

---

## Overview

LLM Connector Hub supports multiple LLM providers through a unified interface. Each provider implements the same core interface while exposing provider-specific features and capabilities.

### Supported Providers

| Provider | Status | Streaming | Function Calling | Vision | JSON Mode |
|----------|--------|-----------|------------------|--------|-----------|
| OpenAI | Supported | Yes | Yes | Yes | Yes |
| Anthropic | Supported | Yes | Yes | Yes | No |
| Google Vertex AI | Supported | Yes | Yes | Yes | Yes |
| AWS Bedrock | Planned | - | - | - | - |
| Azure OpenAI | Planned | - | - | - | - |

### Provider Interface

All providers implement the `LLMProvider` interface:

```typescript
interface LLMProvider {
  // Send a completion request
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  // Stream a completion request
  streamComplete(request: CompletionRequest): AsyncIterator<StreamChunk>;

  // Get provider metadata
  getMetadata(): ProviderMetadata;

  // Get provider capabilities
  getCapabilities(): ProviderCapabilities;

  // Health check
  healthCheck(): Promise<HealthStatus>;
}
```

---

## OpenAI

OpenAI provides access to GPT models including GPT-4, GPT-3.5, and others.

### Setup

```typescript
import { OpenAIProvider } from '@llm-connector-hub/providers';

const openai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: 'org-123456', // Optional
  baseURL: 'https://api.openai.com/v1' // Optional
});

hub.registerProvider('openai', openai);
```

### Getting an API Key

1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API keys section
4. Create a new API key
5. Add to your `.env` file:

```env
OPENAI_API_KEY=sk-...
```

### Available Models

```typescript
// GPT-4 models
const gpt4 = await hub.complete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...]
});

const gpt4Turbo = await hub.complete({
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  messages: [...]
});

// GPT-3.5 models
const gpt35 = await hub.complete({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  messages: [...]
});

// GPT-4 Vision
const vision = await hub.complete({
  provider: 'openai',
  model: 'gpt-4-vision-preview',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: 'https://...' }
    ]
  }]
});
```

### Features

#### Basic Completion

```typescript
const response = await hub.complete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  temperature: 0.7,
  max_tokens: 500
});
```

#### Streaming

```typescript
const stream = await hub.streamComplete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Write a story about a robot.' }
  ]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content || '');
}
```

#### Function Calling

```typescript
const response = await hub.complete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA'
          }
        },
        required: ['location']
      }
    }
  }],
  tool_choice: 'auto'
});

// Check if function was called
if (response.tool_calls && response.tool_calls.length > 0) {
  const toolCall = response.tool_calls[0];
  console.log('Function:', toolCall.function.name);
  console.log('Arguments:', toolCall.function.arguments);
}
```

#### Vision

```typescript
const response = await hub.complete({
  provider: 'openai',
  model: 'gpt-4-vision-preview',
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'What is in this image?'
      },
      {
        type: 'image_url',
        image_url: 'https://example.com/image.jpg',
        detail: 'high' // 'low' | 'high' | 'auto'
      }
    ]
  }],
  max_tokens: 300
});
```

#### JSON Mode

```typescript
const response = await hub.complete({
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant that outputs JSON.'
    },
    {
      role: 'user',
      content: 'List 3 colors with their hex codes.'
    }
  ],
  response_format: { type: 'json_object' }
});

const data = JSON.parse(response.content);
console.log(data);
```

### Configuration Options

```typescript
const openai = new OpenAIProvider({
  // Required
  apiKey: process.env.OPENAI_API_KEY!,

  // Optional
  organization: 'org-123456',
  baseURL: 'https://api.openai.com/v1',
  timeout: 60000,
  maxRetries: 3,

  // Default model settings
  defaultModel: 'gpt-4',
  defaultTemperature: 0.7,
  defaultMaxTokens: 1000,

  // Advanced
  headers: {
    'OpenAI-Beta': 'assistants=v1'
  }
});
```

### Best Practices

1. **Use GPT-4 for complex tasks**: Better reasoning and instruction following
2. **Use GPT-3.5 for simple tasks**: Faster and cheaper
3. **Set appropriate max_tokens**: Avoid unnecessary costs
4. **Use system messages**: Guide model behavior
5. **Implement retry logic**: Handle rate limits gracefully

---

## Anthropic

Anthropic provides access to Claude models.

### Setup

```typescript
import { AnthropicProvider } from '@llm-connector-hub/providers';

const anthropic = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: 'https://api.anthropic.com' // Optional
});

hub.registerProvider('anthropic', anthropic);
```

### Getting an API Key

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to API keys
4. Create a new API key
5. Add to your `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Available Models

```typescript
// Claude 3 Opus (most capable)
const opus = await hub.complete({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  messages: [...]
});

// Claude 3 Sonnet (balanced)
const sonnet = await hub.complete({
  provider: 'anthropic',
  model: 'claude-3-sonnet-20240229',
  messages: [...]
});

// Claude 3 Haiku (fast)
const haiku = await hub.complete({
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307',
  messages: [...]
});
```

### Features

#### Basic Completion

```typescript
const response = await hub.complete({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  max_tokens: 1024
});
```

Note: Anthropic handles system messages differently. Use the `system` parameter:

```typescript
const response = await hub.complete({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  system: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  max_tokens: 1024
});
```

#### Streaming

```typescript
const stream = await hub.streamComplete({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'Write a story about a robot.' }
  ],
  max_tokens: 1024
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content || '');
}
```

#### Tool Use (Function Calling)

```typescript
const response = await hub.complete({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state'
          }
        },
        required: ['location']
      }
    }
  }],
  max_tokens: 1024
});
```

#### Vision

```typescript
const response = await hub.complete({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'What is in this image?'
      },
      {
        type: 'image_url',
        image_url: 'https://example.com/image.jpg'
      }
    ]
  }],
  max_tokens: 1024
});
```

### Configuration Options

```typescript
const anthropic = new AnthropicProvider({
  // Required
  apiKey: process.env.ANTHROPIC_API_KEY!,

  // Optional
  baseURL: 'https://api.anthropic.com',
  timeout: 60000,
  maxRetries: 3,

  // Default model settings
  defaultModel: 'claude-3-opus-20240229',
  defaultMaxTokens: 1024,

  // Anthropic-specific
  anthropicVersion: '2023-06-01'
});
```

### Best Practices

1. **Always specify max_tokens**: Required parameter for Anthropic
2. **Use system parameter**: Not a message role
3. **Choose appropriate model**: Opus for complex, Haiku for fast
4. **Handle context length**: Claude 3 supports up to 200k tokens
5. **Use vision carefully**: Ensure images are properly formatted

---

## Google Vertex AI

Google provides access to Gemini models through Vertex AI.

### Setup

```typescript
import { GoogleProvider } from '@llm-connector-hub/providers';

const google = new GoogleProvider({
  apiKey: process.env.GOOGLE_API_KEY!,
  projectId: 'my-project-123',
  location: 'us-central1' // Optional
});

hub.registerProvider('google', google);
```

### Getting API Access

#### Option 1: API Key

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Enable Vertex AI API
3. Create an API key
4. Add to your `.env` file:

```env
GOOGLE_API_KEY=...
```

#### Option 2: Service Account

```typescript
const google = new GoogleProvider({
  projectId: 'my-project-123',
  authMethod: 'service-account',
  serviceAccountPath: '/path/to/service-account.json'
});
```

### Available Models

```typescript
// Gemini Pro (text and code)
const geminiPro = await hub.complete({
  provider: 'google',
  model: 'gemini-pro',
  messages: [...]
});

// Gemini Pro Vision
const geminiVision = await hub.complete({
  provider: 'google',
  model: 'gemini-pro-vision',
  messages: [...]
});

// Gemini Ultra (most capable, when available)
const geminiUltra = await hub.complete({
  provider: 'google',
  model: 'gemini-ultra',
  messages: [...]
});
```

### Features

#### Basic Completion

```typescript
const response = await hub.complete({
  provider: 'google',
  model: 'gemini-pro',
  messages: [
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  temperature: 0.7,
  max_tokens: 1024
});
```

#### Streaming

```typescript
const stream = await hub.streamComplete({
  provider: 'google',
  model: 'gemini-pro',
  messages: [
    { role: 'user', content: 'Write a story about a robot.' }
  ]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content || '');
}
```

#### Vision

```typescript
const response = await hub.complete({
  provider: 'google',
  model: 'gemini-pro-vision',
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'What is in this image?'
      },
      {
        type: 'image_url',
        image_url: 'https://example.com/image.jpg'
      }
    ]
  }]
});
```

#### Function Calling

```typescript
const response = await hub.complete({
  provider: 'google',
  model: 'gemini-pro',
  messages: [
    { role: 'user', content: 'What is the weather in Tokyo?' }
  ],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  }]
});
```

### Configuration Options

```typescript
const google = new GoogleProvider({
  // Required
  apiKey: process.env.GOOGLE_API_KEY!,
  projectId: 'my-project-123',

  // Optional
  location: 'us-central1',
  timeout: 60000,
  maxRetries: 3,

  // Default model settings
  defaultModel: 'gemini-pro',

  // Authentication
  authMethod: 'api-key', // or 'service-account' or 'adc'
  serviceAccountPath: '/path/to/service-account.json'
});
```

### Best Practices

1. **Enable required APIs**: Ensure Vertex AI API is enabled
2. **Use appropriate regions**: Choose location near your users
3. **Handle authentication**: Use service accounts for production
4. **Monitor quotas**: Track API usage
5. **Use vision model for images**: gemini-pro-vision for image inputs

---

## Provider Comparison

### Feature Comparison

| Feature | OpenAI | Anthropic | Google |
|---------|--------|-----------|--------|
| Streaming | Yes | Yes | Yes |
| Function Calling | Yes | Yes | Yes |
| Vision | Yes | Yes | Yes |
| JSON Mode | Yes | No | Yes |
| Max Context | 128k | 200k | 32k |
| System Messages | Yes | Via param | Yes |

### Performance Comparison

```typescript
// Benchmark different providers
async function benchmarkProviders() {
  const prompt = {
    messages: [
      { role: 'user', content: 'Explain AI in one sentence.' }
    ]
  };

  const providers = ['openai', 'anthropic', 'google'];
  const results = [];

  for (const provider of providers) {
    const start = Date.now();
    await hub.complete({ provider, ...prompt });
    const duration = Date.now() - start;

    results.push({ provider, duration });
  }

  console.table(results);
}
```

### Cost Comparison

Approximate costs (check provider pricing for current rates):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4 | $30 | $60 |
| GPT-3.5 | $1 | $2 |
| Claude 3 Opus | $15 | $75 |
| Claude 3 Sonnet | $3 | $15 |
| Claude 3 Haiku | $0.25 | $1.25 |
| Gemini Pro | $0.50 | $1.50 |

---

## Provider Selection

### Manual Selection

```typescript
// Explicitly choose provider
const response = await hub.complete({
  provider: 'openai',
  messages: [...]
});
```

### Automatic Selection

```typescript
import { ProviderSelector } from '@llm-connector-hub/hub';

// Select based on cost
const costSelector = new ProviderSelector({
  strategy: 'cost',
  providers: ['openai', 'anthropic', 'google']
});

hub.setProviderSelector(costSelector);

// Hub will automatically choose cheapest provider
const response = await hub.complete({
  messages: [...]
});
```

### Fallback Strategy

```typescript
import { FallbackProvider } from '@llm-connector-hub/hub';

const fallback = new FallbackProvider({
  providers: [
    { name: 'openai', priority: 1 },
    { name: 'anthropic', priority: 2 },
    { name: 'google', priority: 3 }
  ]
});

hub.setProviderSelector(fallback);

// If OpenAI fails, falls back to Anthropic, then Google
const response = await hub.complete({
  messages: [...]
});
```

---

## Custom Providers

### Implementing a Custom Provider

```typescript
import { LLMProvider, CompletionRequest, CompletionResponse } from '@llm-connector-hub/core';

class CustomProvider implements LLMProvider {
  private apiKey: string;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Implement your provider logic
    const response = await fetch('https://api.custom-llm.com/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: request.messages,
        model: request.model,
        temperature: request.temperature
      })
    });

    const data = await response.json();

    return {
      content: data.message.content,
      usage: {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens
      },
      metadata: {
        provider: 'custom',
        model: request.model
      }
    };
  }

  async *streamComplete(request: CompletionRequest) {
    // Implement streaming
    // Yield chunks as they arrive
  }

  getMetadata() {
    return {
      name: 'custom',
      version: '1.0.0'
    };
  }

  getCapabilities() {
    return {
      streaming: true,
      function_calling: false,
      vision: false,
      json_mode: false,
      supports_system_message: true
    };
  }

  async healthCheck() {
    try {
      await fetch('https://api.custom-llm.com/health');
      return { status: 'healthy' };
    } catch {
      return { status: 'unhealthy' };
    }
  }
}

// Register custom provider
hub.registerProvider('custom', new CustomProvider({
  apiKey: process.env.CUSTOM_API_KEY!
}));
```

### Using Custom Provider

```typescript
const response = await hub.complete({
  provider: 'custom',
  model: 'custom-model-v1',
  messages: [
    { role: 'user', content: 'Hello!' }
  ]
});
```

---

## Next Steps

- **[Middleware Guide](./middleware.md)** - Add middleware to your providers
- **[Streaming Guide](./streaming.md)** - Advanced streaming patterns
- **[Error Handling](./error-handling.md)** - Handle provider errors
- **[API Reference](../api/providers.md)** - Complete provider API documentation
