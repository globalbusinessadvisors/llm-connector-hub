# Azure OpenAI Provider

Complete provider implementation for Azure OpenAI models, following the unified LLM Connector Hub interface.

## Features

- **Full Model Support**: GPT-5, GPT-5.1, GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-4, GPT-4-32k, GPT-3.5 Turbo, and GPT-3.5 Turbo 16k
- **Streaming**: Real-time token streaming with SSE
- **Function Calling**: Support for tool/function calling
- **Vision**: Image analysis with GPT-4o and GPT-4 Turbo Vision models
- **Error Handling**: Comprehensive error mapping with retry logic
- **Deployment-Based**: Azure's deployment-centric model access
- **Type Safety**: Full TypeScript support with detailed types

## Installation

```bash
npm install @llm-dev-ops/connector-hub-providers
```

## Quick Start

### Basic Usage

```typescript
import { createAzureProvider, AZURE_MODELS } from '@llm-dev-ops/connector-hub-providers/azure';

const provider = createAzureProvider({
  apiKey: 'your-azure-api-key',
  resourceName: 'your-resource-name',
  deploymentName: 'gpt-4o-deployment',
});

await provider.initialize();

const response = await provider.complete({
  model: AZURE_MODELS.GPT_4O,
  messages: [
    { role: 'user', content: 'Hello, Azure OpenAI!' }
  ],
});

console.log(response.message.content);
```

### Using Endpoint URL

```typescript
const provider = createAzureProvider({
  apiKey: 'your-azure-api-key',
  endpoint: 'https://your-resource.openai.azure.com',
  deploymentName: 'gpt-4o-deployment',
});
```

### Environment Variables

```typescript
// Set environment variables:
// AZURE_OPENAI_API_KEY=your-api-key
// AZURE_OPENAI_RESOURCE_NAME=your-resource-name
// AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name

import { createAzureProviderFromEnv } from '@llm-dev-ops/connector-hub-providers/azure';

const provider = createAzureProviderFromEnv();
```

## Configuration

### AzureConfig

```typescript
interface AzureConfig {
  // Required: API key from Azure Portal
  apiKey: string;

  // Required: Deployment name from Azure OpenAI Studio
  deploymentName: string;

  // Either resourceName or endpoint is required
  resourceName?: string;  // e.g., 'my-resource'
  endpoint?: string;      // e.g., 'https://my-resource.openai.azure.com'

  // Optional settings
  apiVersion?: string;              // default: '2024-02-15-preview'
  timeout?: number;                 // default: 60000 (60 seconds)
  maxRetries?: number;              // default: 3
  defaultMaxTokens?: number;        // default: 1024
  additionalHeaders?: Record<string, string>;
  debug?: boolean;                  // default: false
}
```

### Available Models

```typescript
import { AZURE_MODELS } from '@llm-dev-ops/connector-hub-providers/azure';

// GPT-5 series (future support)
AZURE_MODELS.GPT_5
AZURE_MODELS.GPT_5_1

// GPT-4o series
AZURE_MODELS.GPT_4O
AZURE_MODELS.GPT_4O_MINI
AZURE_MODELS.GPT_4O_2024_11_20
AZURE_MODELS.GPT_4O_2024_08_06

// GPT-4 Turbo
AZURE_MODELS.GPT_4_TURBO
AZURE_MODELS.GPT_4_TURBO_2024_04_09

// GPT-4
AZURE_MODELS.GPT_4
AZURE_MODELS.GPT_4_32K

// GPT-3.5 Turbo
AZURE_MODELS.GPT_3_5_TURBO
AZURE_MODELS.GPT_3_5_TURBO_16K
```

## Usage Examples

### Streaming

```typescript
for await (const chunk of provider.stream({
  model: AZURE_MODELS.GPT_4O,
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ],
})) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
```

### Function Calling

```typescript
const response = await provider.complete({
  model: AZURE_MODELS.GPT_4O,
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  functions: [
    {
      name: 'get_weather',
      description: 'Get the current weather in a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
        },
        required: ['location'],
      },
    },
  ],
});

if (response.message.tool_calls) {
  for (const toolCall of response.message.tool_calls) {
    console.log('Function:', toolCall.function.name);
    console.log('Arguments:', toolCall.function.arguments);
  }
}
```

### Vision (Image Analysis)

```typescript
const response = await provider.complete({
  model: AZURE_MODELS.GPT_4O,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        { type: 'image_url', image_url: 'https://example.com/image.jpg' },
      ],
    },
  ],
});

console.log(response.message.content);
```

### With Base64 Images

```typescript
const base64Image = 'iVBORw0KGgoAAAANSUhEUgA...'; // your base64 encoded image

const response = await provider.complete({
  model: AZURE_MODELS.GPT_4O,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image' },
        { type: 'image_base64', image_base64: base64Image },
      ],
    },
  ],
});
```

### Advanced Configuration

```typescript
const provider = createAzureProvider({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  resourceName: 'my-resource',
  deploymentName: 'gpt-4o-deployment',
  apiVersion: '2024-02-15-preview',
  timeout: 120000, // 2 minutes
  maxRetries: 5,
  defaultMaxTokens: 2048,
  debug: true,
  additionalHeaders: {
    'X-Custom-Header': 'value',
  },
});

// Configure on the fly
provider.configure({
  timeout: 90000,
  maxRetries: 3,
});
```

### Error Handling

```typescript
import {
  mapAzureError,
  isDeploymentError,
  isRateLimitError
} from '@llm-dev-ops/connector-hub-providers/azure';

try {
  const response = await provider.complete({
    model: AZURE_MODELS.GPT_4O,
    messages: [{ role: 'user', content: 'Hello!' }],
  });
} catch (error) {
  const mapped = mapAzureError(error);

  if (isDeploymentError(mapped)) {
    console.error('Deployment not found. Check Azure OpenAI Studio.');
  } else if (isRateLimitError(mapped)) {
    console.error('Rate limited. Retry after:', mapped.retryAfter);
  } else {
    console.error('Error:', mapped.message);
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
  console.error('Provider unhealthy:', health.error);
}
```

## API Reference

### Provider Methods

#### `initialize(): Promise<void>`
Initializes the provider and verifies connectivity.

#### `shutdown(): Promise<void>`
Cleans up resources.

#### `complete(request: CompletionRequest): Promise<CompletionResponse>`
Performs a synchronous completion request.

#### `stream(request: CompletionRequest): AsyncIterable<StreamChunk>`
Performs a streaming completion request.

#### `healthCheck(): Promise<HealthCheckResult>`
Checks provider health and connectivity.

#### `getMetadata(): ProviderMetadata`
Returns provider metadata and capabilities.

#### `configure(config: Partial<AzureConfig>): void`
Updates provider configuration.

### Types

#### CompletionRequest
```typescript
interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  user?: string;
  functions?: FunctionDefinition[];
  presence_penalty?: number;
  frequency_penalty?: number;
}
```

#### CompletionResponse
```typescript
interface CompletionResponse {
  message: Message;
  finish_reason: FinishReason;
  usage: Usage;
  metadata: ProviderMetadata;
}
```

## Azure-Specific Features

### Deployment-Based Access

Unlike standard OpenAI, Azure OpenAI uses deployment names to access models. You must:

1. Create a deployment in Azure OpenAI Studio
2. Use the deployment name in the configuration
3. The deployment determines which model version you're using

```typescript
// Your deployment 'my-gpt4o' might map to 'gpt-4o-2024-11-20'
const provider = createAzureProvider({
  apiKey: 'key',
  resourceName: 'resource',
  deploymentName: 'my-gpt4o', // Your deployment name
});
```

### URL Format

Azure OpenAI uses this URL structure:
```
https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}
```

The provider handles this automatically.

### Authentication

Azure uses the `api-key` header instead of `Authorization: Bearer` token:

```http
POST https://resource.openai.azure.com/openai/deployments/deployment/chat/completions?api-version=2024-02-15-preview
api-key: your-api-key
Content-Type: application/json
```

### API Versions

Azure OpenAI requires an API version parameter. The provider uses `2024-02-15-preview` by default, which is the latest stable version supporting all features.

## Error Types

The provider maps Azure OpenAI errors to these unified types:

- `authentication` - Invalid API key or permissions
- `invalid_request` - Bad request parameters or deployment not found
- `rate_limit` - Rate limit exceeded
- `content_filter` - Content filtered by Azure policy
- `server_error` - Azure service errors
- `timeout` - Request timeout
- `unknown` - Unknown errors

## Best Practices

1. **Use Environment Variables**: Keep API keys secure
2. **Enable Retry Logic**: Network issues are common, use retries
3. **Monitor Rate Limits**: Azure has strict rate limits per deployment
4. **Handle Content Filters**: Azure's content policy may filter requests
5. **Choose Appropriate Models**: Use GPT-4o for best performance
6. **Set Reasonable Timeouts**: Some models can be slow
7. **Use Streaming**: For better UX in long responses
8. **Verify Deployments**: Always check your deployment name matches

## Troubleshooting

### Deployment Not Found
```
Error: Deployment not found. Check your deployment name in Azure Portal.
```
**Solution**: Verify the deployment name in Azure OpenAI Studio.

### Rate Limit Exceeded
```
Error: Rate limit exceeded. Please reduce request frequency.
```
**Solution**: Increase quota in Azure or add exponential backoff.

### Content Filtered
```
Error: Content was filtered by Azure OpenAI content policy.
```
**Solution**: Modify your input to comply with content policy.

### Authentication Failed
```
Error: Invalid API key. Please check your Azure OpenAI credentials.
```
**Solution**: Verify API key in Azure Portal > Keys and Endpoint.

## License

MIT
