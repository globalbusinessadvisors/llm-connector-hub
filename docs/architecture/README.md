# Architecture Documentation

System architecture and design patterns for LLM Connector Hub.

## Contents

- **[Overview](./overview.md)** - System architecture overview
- **[Design Patterns](./design-patterns.md)** - Design patterns used
- **[Data Flow](./data-flow.md)** - Request/response flow
- **[Performance](./performance.md)** - Performance characteristics

## Quick Overview

LLM Connector Hub uses a modular, middleware-based architecture:

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (Your Code, REST API, CLI)            │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│       ConnectorHub (Orchestrator)       │
│  - Provider Registry                    │
│  - Middleware Pipeline                  │
│  - Request Router                       │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│         Middleware Pipeline             │
│  Retry → Logging → Cache → RateLimit   │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│       Provider Connectors               │
│  OpenAI | Anthropic | Google           │
└─────────────────────────────────────────┘
```

## Design Principles

1. **Modularity** - Pluggable providers and middleware
2. **Type Safety** - Full TypeScript support
3. **Extensibility** - Easy to add custom components
4. **Performance** - Async-first, optimized for throughput
5. **Reliability** - Built-in retry, fallback, and error handling

## See Also

- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- [User Guide](../user-guide/README.md)
