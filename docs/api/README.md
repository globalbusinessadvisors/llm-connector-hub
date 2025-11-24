# API Reference

Complete API documentation for LLM Connector Hub.

## Packages

- **[@llm-connector-hub/core](./models.md)** - Core types and interfaces
- **[@llm-connector-hub/hub](./connector-hub.md)** - ConnectorHub orchestrator
- **[@llm-connector-hub/providers](./providers.md)** - Provider implementations
- **[@llm-connector-hub/middleware](./middleware.md)** - Middleware components

## Quick Reference

### ConnectorHub

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';

const hub = new ConnectorHub(config);
hub.registerProvider(name, provider);
hub.use(middleware);
await hub.complete(request);
await hub.streamComplete(request);
```

### Providers

```typescript
import { OpenAIProvider, AnthropicProvider } from '@llm-connector-hub/providers';

const provider = new OpenAIProvider(config);
await provider.complete(request);
await provider.streamComplete(request);
```

### Types

```typescript
import type {
  Message,
  CompletionRequest,
  CompletionResponse,
  StreamChunk
} from '@llm-connector-hub/core';
```

## See Also

- [User Guide](../user-guide/README.md)
- [Getting Started](../getting-started.md)
