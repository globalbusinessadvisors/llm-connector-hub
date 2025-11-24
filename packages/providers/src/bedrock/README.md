# AWS Bedrock Provider

Complete AWS Bedrock provider implementation for the LLM Connector Hub, following the same pattern as the existing Anthropic and Google providers.

## Overview

The AWS Bedrock provider enables seamless integration with multiple foundation models available on Amazon Bedrock, including:

- **Anthropic Claude** (3.5 Sonnet, 3 Opus, 3 Sonnet, 3 Haiku)
- **Meta Llama** (3.3 70B, 3.1 405B, 3.1 70B, 3.1 8B)
- **Mistral AI** (Large 2, Small)

## Features

- ✅ Support for latest Bedrock models
- ✅ Streaming support via AWS EventStream
- ✅ Function calling support (Claude, Llama, Mistral Large)
- ✅ Vision support (Claude models)
- ✅ Multi-modal content handling
- ✅ Proper AWS credential management
- ✅ Comprehensive error mapping
- ✅ Retry logic with exponential backoff
- ✅ Model-specific request/response transformation
- ✅ TypeScript type definitions

## Architecture

### File Structure

```
bedrock/
├── BedrockProvider.ts      # Main provider implementation
├── BedrockTransformer.ts   # Request/response transformation
├── BedrockErrorMapper.ts   # Error handling and mapping
├── BedrockConfig.ts        # Configuration and validation
├── BedrockStreamParser.ts  # EventStream parsing
├── index.ts                # Module exports
└── README.md               # This file
```

### Components

#### 1. BedrockProvider.ts
Main provider class implementing the unified LLM interface:
- `complete()` - Synchronous completion requests
- `stream()` - Streaming completion requests
- `healthCheck()` - Provider health verification
- Retry logic with exponential backoff
- AWS credential handling

#### 2. BedrockTransformer.ts
Handles transformation between unified format and model-specific formats:
- **Claude**: Messages API format with content blocks
- **Llama**: Prompt-based format with special tokens
- **Mistral**: Instruction format with special tags
- Request/response transformation
- Tool/function calling transformation

#### 3. BedrockErrorMapper.ts
Maps AWS Bedrock errors to unified error types:
- `AccessDeniedException` → authentication error
- `ThrottlingException` → rate_limit error
- `ModelTimeoutException` → timeout error
- `ValidationException` → invalid_request error
- Error message formatting
- Retry decision logic

#### 4. BedrockConfig.ts
Configuration management and model information:
- AWS credentials (access key, secret, session token)
- Region configuration
- Model ARN definitions
- Model capabilities (vision, streaming, function calling)
- Configuration validation

#### 5. BedrockStreamParser.ts
Parses AWS EventStream format for streaming responses:
- EventStream binary format handling
- Model-specific chunk parsing (Claude, Llama, Mistral)
- Stream accumulation
- Usage tracking

## Supported Models

### Anthropic Claude

```typescript
import { BEDROCK_MODELS } from './BedrockConfig';

// Claude 3.5 Sonnet v2 (latest)
BEDROCK_MODELS.CLAUDE_3_5_SONNET_V2
// 'anthropic.claude-3-5-sonnet-20241022-v2:0'

// Claude 3 Opus (most capable)
BEDROCK_MODELS.CLAUDE_3_OPUS
// 'anthropic.claude-3-opus-20240229-v1:0'

// Claude 3 Haiku (fastest)
BEDROCK_MODELS.CLAUDE_3_HAIKU
// 'anthropic.claude-3-haiku-20240307-v1:0'
```

**Features**: Vision, Streaming, Function Calling, 200K context window

### Meta Llama

```typescript
// Llama 3.3 70B Instruct
BEDROCK_MODELS.LLAMA_3_3_70B
// 'meta.llama3-3-70b-instruct-v1:0'

// Llama 3.1 405B Instruct (largest)
BEDROCK_MODELS.LLAMA_3_1_405B
// 'meta.llama3-1-405b-instruct-v1:0'

// Llama 3.1 70B Instruct
BEDROCK_MODELS.LLAMA_3_1_70B
// 'meta.llama3-1-70b-instruct-v1:0'
```

**Features**: Streaming, Function Calling, 128K context window

### Mistral AI

```typescript
// Mistral Large 2
BEDROCK_MODELS.MISTRAL_LARGE_2
// 'mistral.mistral-large-2407-v1:0'

// Mistral Small
BEDROCK_MODELS.MISTRAL_SMALL
// 'mistral.mistral-small-2402-v1:0'
```

**Features**: Streaming, Function Calling (Large only), 128K context window

## Usage

### Basic Setup

```typescript
import { BedrockProvider, BEDROCK_MODELS } from '@llm-dev-ops/connector-hub-providers';

const provider = new BedrockProvider({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // Optional: sessionToken for temporary credentials
  sessionToken: process.env.AWS_SESSION_TOKEN,
});

await provider.initialize();
```

### Environment Variables

```typescript
import { createBedrockProviderFromEnv } from '@llm-dev-ops/connector-hub-providers';

// Reads from: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
const provider = createBedrockProviderFromEnv();
```

### Synchronous Completion

```typescript
const response = await provider.complete({
  model: BEDROCK_MODELS.CLAUDE_3_5_SONNET_V2,
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.7,
  max_tokens: 1024,
});

console.log(response.message.content);
console.log('Usage:', response.usage);
```

### Streaming

```typescript
const stream = provider.stream({
  model: BEDROCK_MODELS.LLAMA_3_3_70B,
  messages: [
    { role: 'user', content: 'Write a short story about AI.' }
  ],
  max_tokens: 2048,
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

### Function Calling

```typescript
const response = await provider.complete({
  model: BEDROCK_MODELS.CLAUDE_3_5_SONNET_V2,
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  functions: [
    {
      name: 'get_weather',
      description: 'Get the current weather for a location',
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

### Vision (Claude only)

```typescript
const response = await provider.complete({
  model: BEDROCK_MODELS.CLAUDE_3_5_SONNET_V2,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image_url',
          image_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
        }
      ]
    }
  ],
  max_tokens: 1024,
});
```

## AWS SDK Integration

**Important**: This implementation provides the complete structure but requires integration with `@aws-sdk/client-bedrock-runtime` for actual AWS API calls.

### Required Package

```bash
npm install @aws-sdk/client-bedrock-runtime
```

### Integration Points

The provider has placeholder methods that need to be implemented:

1. **`invokeModel()`** - Non-streaming invocation
2. **`invokeModelWithResponseStream()`** - Streaming invocation

See comments in `BedrockProvider.ts` for example implementations using the AWS SDK.

### Example AWS SDK Integration

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

private async invokeModel<T>(modelId: string, body: BedrockRequest): Promise<T> {
  const client = new BedrockRuntimeClient({
    region: this.config.region,
    credentials: {
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      sessionToken: this.config.sessionToken,
    },
  });

  const command = new InvokeModelCommand({
    modelId,
    body: JSON.stringify(body),
    contentType: 'application/json',
    accept: 'application/json',
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  return responseBody as T;
}
```

## Error Handling

The provider maps Bedrock errors to unified error types:

```typescript
try {
  const response = await provider.complete(request);
} catch (error) {
  if (error.type === 'authentication') {
    // Handle auth errors
    console.error('Invalid AWS credentials');
  } else if (error.type === 'rate_limit') {
    // Handle throttling
    console.error('Rate limited, retry after:', error.retryAfter);
  } else if (error.type === 'timeout') {
    // Handle timeouts
    console.error('Request timed out');
  }
}
```

## Configuration Options

```typescript
interface BedrockConfig {
  // AWS credentials (optional if using IAM roles)
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;

  // Required: AWS region
  region: string;

  // Optional settings
  timeout?: number;           // Default: 120000ms (2 minutes)
  maxRetries?: number;        // Default: 3
  defaultMaxTokens?: number;  // Default: 2048
  debug?: boolean;           // Default: false
}
```

## Model Capabilities

Query model capabilities programmatically:

```typescript
import {
  supportsVision,
  supportsStreaming,
  supportsFunctionCalling,
  getMaxTokens
} from './BedrockConfig';

const model = BEDROCK_MODELS.CLAUDE_3_5_SONNET_V2;

console.log('Supports vision:', supportsVision(model));
console.log('Supports streaming:', supportsStreaming(model));
console.log('Supports functions:', supportsFunctionCalling(model));
console.log('Max tokens:', getMaxTokens(model));
```

## Best Practices

1. **Credentials**: Use IAM roles when running in AWS (EC2, Lambda, ECS) instead of access keys
2. **Regions**: Choose regions close to your users for lower latency
3. **Error Handling**: Always implement retry logic for transient errors
4. **Streaming**: Use streaming for long-form content generation
5. **Model Selection**: Choose models based on your latency/capability needs
6. **Token Limits**: Always specify `max_tokens` to control costs
7. **Debug Mode**: Enable debug logging during development

## Testing

```typescript
// Health check
const health = await provider.healthCheck();
console.log('Provider healthy:', health.healthy);
console.log('Latency:', health.latency, 'ms');

// Validate configuration
import { validateBedrockConfig } from './BedrockConfig';

try {
  validateBedrockConfig(config);
  console.log('Configuration valid');
} catch (error) {
  console.error('Invalid configuration:', error.message);
}
```

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Bedrock Runtime API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_Operations_Amazon_Bedrock_Runtime.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-bedrock-runtime/)
- [Anthropic Claude on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude.html)
- [Meta Llama on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-meta.html)
- [Mistral AI on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-mistral.html)

## License

MIT OR Apache-2.0
