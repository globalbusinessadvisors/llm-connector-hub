# Streaming Guide

Stream LLM responses in real-time for better user experience.

## Basic Streaming

```typescript
const stream = await hub.streamComplete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Write a short story about a robot.' }
  ]
});

for await (const chunk of stream) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
```

## Stream Chunks

```typescript
interface StreamChunk {
  content?: string;           // Incremental content
  role?: MessageRole;         // Message role
  finish_reason?: FinishReason; // Why stream ended
  function_call?: Partial<FunctionCall>;
  tool_calls?: Partial<ToolCall>[];
}
```

## Advanced Patterns

### Buffering

```typescript
let buffer = '';

for await (const chunk of stream) {
  buffer += chunk.content || '';
  
  // Emit complete sentences
  const sentences = buffer.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    sentences.forEach(sentence => console.log(sentence));
    buffer = buffer.substring(sentences.join('').length);
  }
}
```

### Progress Tracking

```typescript
let totalTokens = 0;

for await (const chunk of stream) {
  totalTokens += chunk.content?.length || 0;
  
  console.log(`Progress: ${totalTokens} characters`);
  process.stdout.write(chunk.content || '');
}
```

### Error Handling

```typescript
try {
  for await (const chunk of stream) {
    process.stdout.write(chunk.content || '');
  }
} catch (error) {
  console.error('Stream error:', error);
} finally {
  console.log('\nStream ended');
}
```

## Provider-Specific Streaming

### OpenAI

```typescript
const stream = await hub.streamComplete({
  provider: 'openai',
  model: 'gpt-4',
  messages: [...],
  stream_options: {
    include_usage: true  // Include token usage
  }
});
```

### Anthropic

```typescript
const stream = await hub.streamComplete({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  messages: [...],
  max_tokens: 1024  // Required for Anthropic
});
```

## Best Practices

1. **Handle backpressure**: Don't overwhelm clients
2. **Timeout protection**: Set appropriate timeouts
3. **Error recovery**: Gracefully handle stream interruptions
4. **Resource cleanup**: Always close streams
5. **Rate limiting**: Be mindful of streaming rate limits

## Next Steps

- [Providers Guide](./providers.md)
- [Error Handling](./error-handling.md)
