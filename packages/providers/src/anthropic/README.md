# Anthropic (Claude) Provider

Production-ready provider implementation for Anthropic's Claude AI models.

## Features

- **Full Claude API Support**: Complete implementation of Anthropic's Messages API
- **Streaming**: Server-Sent Events (SSE) streaming with proper event parsing
- **System Messages**: Proper handling of system messages (separate from messages array)
- **Vision Support**: Multimodal content with image support
- **Tool Calling**: Full function/tool calling support
- **Error Handling**: Comprehensive error mapping and retry logic
- **Type Safety**: Full TypeScript types with strict mode

## Installation

```bash
npm install @llm-connector-hub/providers
```

## Quick Start

```typescript
import { AnthropicProvider } from '@llm-connector-hub/providers';

// Create provider
const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Complete request
const response = await provider.complete({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  max_tokens: 1024,
});

console.log(response.message.content);
```

## Configuration

```typescript
interface AnthropicConfig {
  apiKey: string;                    // Required: Your Anthropic API key
  apiVersion?: string;               // Default: "2023-06-01"
  baseUrl?: string;                  // Default: "https://api.anthropic.com"
  timeout?: number;                  // Default: 60000 (60 seconds)
  maxRetries?: number;               // Default: 3
  defaultMaxTokens?: number;         // Default: 1024
  additionalHeaders?: Record<string, string>;
  debug?: boolean;                   // Default: false
}
```

## Supported Models

```typescript
import { ANTHROPIC_MODELS } from '@llm-connector-hub/providers';

// Claude 3.5 Sonnet (latest, most capable)
ANTHROPIC_MODELS.CLAUDE_3_5_SONNET          // 'claude-3-5-sonnet-20241022'

// Claude 3 Opus (most capable)
ANTHROPIC_MODELS.CLAUDE_3_OPUS              // 'claude-3-opus-20240229'

// Claude 3 Sonnet (balanced)
ANTHROPIC_MODELS.CLAUDE_3_SONNET            // 'claude-3-sonnet-20240229'

// Claude 3 Haiku (fastest)
ANTHROPIC_MODELS.CLAUDE_3_HAIKU             // 'claude-3-haiku-20240307'
```

## Examples

### Basic Completion

```typescript
const response = await provider.complete({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  max_tokens: 500,
  temperature: 0.7,
});
```

### Streaming

```typescript
for await (const chunk of provider.stream({
  model: 'claude-3-haiku-20240307',
  messages: [{ role: 'user', content: 'Tell me a story.' }],
  max_tokens: 1000,
})) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
```

### Vision (Image Analysis)

```typescript
const response = await provider.complete({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image_url',
          image_url: 'data:image/jpeg;base64,/9j/4AAQ...'
        }
      ]
    }
  ],
  max_tokens: 300,
});
```

### Tool Calling

```typescript
const response = await provider.complete({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'What is the weather in Paris?' }
  ],
  max_tokens: 500,
});

// Check if Claude wants to call a tool
if (response.message.tool_calls) {
  for (const toolCall of response.message.tool_calls) {
    console.log(`Tool: ${toolCall.function.name}`);
    console.log(`Arguments: ${toolCall.function.arguments}`);
  }
}
```

### Health Check

```typescript
const health = await provider.healthCheck();

if (health.healthy) {
  console.log(`Provider healthy, latency: ${health.latency}ms`);
} else {
  console.error(`Provider unhealthy: ${health.error}`);
}
```

## Key Differences from OpenAI

1. **System Messages**: Handled separately, not in the messages array
2. **Max Tokens Required**: Anthropic requires `max_tokens` to be specified
3. **Content Blocks**: Different structure for multimodal content
4. **Streaming Format**: SSE with different event types
5. **API Version Header**: Required `anthropic-version` header

## Architecture

### Components

- **AnthropicProvider**: Main provider class implementing IProvider interface
- **AnthropicConfig**: Configuration with validation
- **AnthropicTransformer**: Request/response transformation
- **AnthropicStreamParser**: SSE stream parsing
- **AnthropicErrorMapper**: Error mapping to unified format

### Request Flow

```
User Request
    ↓
AnthropicProvider.complete()
    ↓
Transform to Anthropic format
    ↓
HTTP Request with retry logic
    ↓
Parse response
    ↓
Transform to unified format
    ↓
Return to user
```

### Error Handling

The provider maps Anthropic errors to unified error types:

- `authentication_error` → `authentication`
- `permission_error` → `authentication`
- `not_found_error` → `invalid_request`
- `rate_limit_error` → `rate_limit`
- `invalid_request_error` → `invalid_request`
- `overloaded_error` → `server_error`
- `api_error` → `server_error`

Retryable errors (rate limit, server errors) are automatically retried with exponential backoff.

## Testing

The provider includes comprehensive tests:

- Configuration validation
- Message transformation
- Stream parsing
- Error mapping
- Provider functionality

Run tests:

```bash
npm test -- packages/providers/src/anthropic
```

## API Reference

### AnthropicProvider

#### Constructor

```typescript
new AnthropicProvider(config: AnthropicConfig)
```

#### Methods

- `initialize(): Promise<void>` - Initialize provider
- `shutdown(): Promise<void>` - Shutdown provider
- `complete(request): Promise<CompletionResponse>` - Synchronous completion
- `stream(request): AsyncIterable<StreamChunk>` - Streaming completion
- `healthCheck(): Promise<HealthCheckResult>` - Health check
- `validateRequest(request): void` - Request validation
- `configure(config): void` - Update configuration
- `getMetadata(): ProviderMetadata` - Get provider metadata

## Best Practices

1. **Always specify max_tokens**: Anthropic requires it
2. **Use system messages wisely**: They're powerful for controlling Claude's behavior
3. **Handle retries**: The provider handles retries automatically for transient errors
4. **Monitor rate limits**: Watch for rate limit errors and implement backoff
5. **Use appropriate models**: Choose based on your needs (speed vs capability)

## Troubleshooting

### Authentication Errors

```typescript
// Check your API key
const health = await provider.healthCheck();
if (!health.healthy && health.error?.includes('authentication')) {
  console.error('Invalid API key. Get one at https://console.anthropic.com/');
}
```

### Rate Limiting

```typescript
try {
  const response = await provider.complete(request);
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
}
```

### Timeout Issues

```typescript
const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120000, // 2 minutes for longer requests
});
```

## License

MIT OR Apache-2.0
