# Error Handling Guide

Comprehensive error handling patterns for LLM Connector Hub.

## Error Types

```typescript
type ErrorType = 
  | 'authentication'    // Invalid API key
  | 'rate_limit'        // Rate limit exceeded
  | 'invalid_request'   // Malformed request
  | 'server_error'      // Provider server error
  | 'timeout'           // Request timeout
  | 'network'           // Network connectivity
  | 'unknown';          // Unknown error
```

## Basic Error Handling

```typescript
try {
  const response = await hub.complete({
    provider: 'openai',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  if (error.type === 'authentication') {
    console.error('Invalid API key');
  } else if (error.type === 'rate_limit') {
    console.error('Rate limit exceeded. Retry after:', error.retryAfter);
  } else {
    console.error('Request failed:', error.message);
  }
}
```

## Error Types and Handling

### Authentication Errors

```typescript
try {
  await hub.complete({...});
} catch (error) {
  if (error.type === 'authentication') {
    // Check API key
    console.error('API key is invalid or missing');
    // Refresh credentials or alert admin
  }
}
```

### Rate Limit Errors

```typescript
import { RetryMiddleware } from '@llm-connector-hub/middleware';

hub.use(new RetryMiddleware({
  maxAttempts: 5,
  retryOn: { errorTypes: ['rate_limit'] },
  onRetry: (attempt, error) => {
    if (error.type === 'rate_limit') {
      const delay = error.retryAfter || (attempt * 1000);
      console.log(`Rate limited. Retrying after ${delay}ms`);
    }
  }
}));
```

### Validation Errors

```typescript
try {
  await hub.complete({
    provider: 'openai',
    messages: [], // Invalid: empty messages
    temperature: 2.5 // Invalid: > 2.0
  });
} catch (error) {
  if (error.type === 'invalid_request') {
    console.error('Validation failed:', error.details);
  }
}
```

## Error Recovery Strategies

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

const response = await retryWithBackoff(async () => {
  return await hub.complete({...});
});
```

### Fallback Providers

```typescript
async function completeWithFallback(request) {
  const providers = ['openai', 'anthropic', 'google'];
  
  for (const provider of providers) {
    try {
      return await hub.complete({ ...request, provider });
    } catch (error) {
      console.error(`${provider} failed:`, error);
      // Try next provider
    }
  }
  
  throw new Error('All providers failed');
}
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@llm-connector-hub/middleware';

const breaker = new CircuitBreaker({
  threshold: 5,         // Open after 5 failures
  timeout: 60000,       // Try again after 1 minute
  onOpen: () => console.error('Circuit opened'),
  onHalfOpen: () => console.log('Circuit half-open'),
  onClose: () => console.log('Circuit closed')
});

hub.use(breaker);
```

## Best Practices

1. **Always handle errors**: Never leave try/catch empty
2. **Log errors appropriately**: Include context and stack traces
3. **Retry transient errors**: Rate limits, timeouts, network errors
4. **Don't retry permanent errors**: Authentication, validation errors
5. **Use middleware**: Centralize error handling logic
6. **Monitor error rates**: Alert on unusual error patterns

## Next Steps

- [Middleware Guide](./middleware.md)
- [Health Monitoring](./health-monitoring.md)
