# Google AI (Gemini) Provider

This is the Google AI (Gemini) provider implementation for the LLM Connector Hub. It provides a unified interface for interacting with Google's Gemini models.

## Features

- ✅ Full support for Gemini 1.5 Pro, Flash, and legacy models
- ✅ Streaming and non-streaming completions
- ✅ Function/tool calling support
- ✅ Vision capabilities (multimodal input)
- ✅ Safety settings configuration
- ✅ Comprehensive error handling with retry logic
- ✅ Request/response transformation
- ✅ TypeScript type safety

## Installation

```bash
npm install @llm-connector-hub/providers
```

## Quick Start

```typescript
import { GoogleProvider, GOOGLE_MODELS } from '@llm-connector-hub/providers';

// Create provider instance
const provider = new GoogleProvider({
  apiKey: 'your-google-api-key',
});

// Make a completion request
const response = await provider.complete({
  model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
  messages: [
    { role: 'user', content: 'Explain quantum computing in simple terms' }
  ],
  temperature: 0.7,
  max_tokens: 1000,
});

console.log(response.message.content);
```

## Configuration

### Basic Configuration

```typescript
import { GoogleProvider } from '@llm-connector-hub/providers';

const provider = new GoogleProvider({
  apiKey: 'your-api-key',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta', // optional
  timeout: 60000, // optional, default 60s
  maxRetries: 3, // optional, default 3
  defaultMaxTokens: 2048, // optional, default 2048
  debug: false, // optional, default false
});
```

### Environment Variables

You can also create a provider from environment variables:

```typescript
import { createGoogleProviderFromEnv } from '@llm-connector-hub/providers';

// Expects GOOGLE_API_KEY environment variable
const provider = createGoogleProviderFromEnv();
```

Supported environment variables:
- `GOOGLE_API_KEY` (required)
- `GOOGLE_BASE_URL` (optional)
- `GOOGLE_TIMEOUT` (optional)
- `GOOGLE_MAX_RETRIES` (optional)
- `GOOGLE_DEBUG` (optional)

### Safety Settings

Configure content filtering for various harm categories:

```typescript
const provider = new GoogleProvider({
  apiKey: 'your-api-key',
  defaultSafetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    },
    // ... other categories
  ],
});
```

Available thresholds:
- `BLOCK_NONE` - No blocking
- `BLOCK_ONLY_HIGH` - Block only high probability content
- `BLOCK_MEDIUM_AND_ABOVE` - Block medium and high
- `BLOCK_LOW_AND_ABOVE` - Block low, medium, and high

## Usage

### Completion Requests

```typescript
const response = await provider.complete({
  model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 1000,
  top_p: 0.9,
  top_k: 40,
  stop: ['END'],
});

console.log(response.message.content);
console.log(response.usage); // Token usage statistics
console.log(response.finish_reason); // 'stop', 'length', etc.
```

### Streaming Completions

```typescript
const stream = provider.stream({
  model: GOOGLE_MODELS.GEMINI_1_5_FLASH_LATEST,
  messages: [
    { role: 'user', content: 'Write a story about a robot' }
  ],
});

for await (const chunk of stream) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }

  if (chunk.finish_reason) {
    console.log('\nFinish reason:', chunk.finish_reason);
  }
}
```

### Multimodal (Vision) Requests

```typescript
const response = await provider.complete({
  model: GOOGLE_MODELS.GEMINI_1_5_PRO_VISION,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image_base64',
          image_base64: 'base64-encoded-image-data'
        }
      ]
    }
  ],
});
```

### Function/Tool Calling

```typescript
const response = await provider.complete({
  model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
  messages: [
    { role: 'user', content: 'What is the weather in New York?' }
  ],
  functions: [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['location']
      }
    }
  ],
});

if (response.message.tool_calls) {
  for (const toolCall of response.message.tool_calls) {
    console.log('Function:', toolCall.function.name);
    console.log('Arguments:', toolCall.function.arguments);
  }
}
```

### Health Check

```typescript
const health = await provider.healthCheck();

if (health.healthy) {
  console.log('Provider is healthy');
  console.log('Latency:', health.latency, 'ms');
} else {
  console.error('Provider is unhealthy:', health.error);
}
```

### List Available Models

```typescript
const models = await provider.listModels();
console.log('Available models:', models);
```

### Get Model Information

```typescript
import { getModelInfo, GOOGLE_MODELS } from '@llm-connector-hub/providers';

const info = getModelInfo(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST);
console.log('Max tokens:', info?.maxTokens);
console.log('Context window:', info?.contextWindow);
console.log('Supports vision:', info?.supportsVision);
console.log('Supports tools:', info?.supportsTools);
```

## Available Models

### Gemini 1.5 Pro
- `gemini-1.5-pro-latest` - Latest version
- `gemini-1.5-pro` - Stable version
- Context: 2M tokens
- Max output: 8192 tokens
- Vision: ✅ Yes
- Tools: ✅ Yes

### Gemini 1.5 Flash
- `gemini-1.5-flash-latest` - Latest version
- `gemini-1.5-flash` - Stable version
- Context: 1M tokens
- Max output: 8192 tokens
- Vision: ✅ Yes
- Tools: ✅ Yes

### Legacy Models
- `gemini-pro` - Text-only model
- `gemini-pro-vision` - Vision-capable model
- `gemini-ultra` - Experimental model

## Error Handling

The provider includes comprehensive error handling with automatic retries for transient errors:

```typescript
try {
  const response = await provider.complete({
    model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (error) {
  if (error instanceof GoogleProviderError) {
    console.error('Error type:', error.type);
    console.error('Status code:', error.statusCode);
    console.error('Google status:', error.googleStatus);
    console.error('Retryable:', error.retryable);
  }
}
```

Error types:
- `authentication` - Invalid API key or permissions
- `rate_limit` - Rate limit exceeded (retryable)
- `invalid_request` - Bad request parameters
- `server_error` - Google server error (retryable)
- `timeout` - Request timeout (retryable)
- `network` - Network error (retryable)
- `content_filter` - Content blocked by safety filters
- `unknown` - Unknown error

## Type Safety

The provider is fully typed with TypeScript:

```typescript
import type {
  CompletionRequest,
  CompletionResponse,
  GoogleConfig,
  GoogleModel,
} from '@llm-connector-hub/providers';

const config: GoogleConfig = {
  apiKey: 'your-key',
  timeout: 30000,
};

const request: CompletionRequest = {
  model: 'gemini-1.5-pro-latest',
  messages: [{ role: 'user', content: 'Hello' }],
};
```

## Testing

The provider includes comprehensive test coverage (>90%):

```bash
npm test src/google
```

## API Reference

See the [full API documentation](./index.ts) for detailed information about all exported types and functions.

## License

MIT OR Apache-2.0
