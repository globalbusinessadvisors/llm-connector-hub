# Configuration Guide

This guide provides comprehensive configuration reference for all LLM Connector Hub components.

## Table of Contents

1. [Overview](#overview)
2. [ConnectorHub Configuration](#connectorhub-configuration)
3. [Provider Configuration](#provider-configuration)
4. [Middleware Configuration](#middleware-configuration)
5. [Environment Variables](#environment-variables)
6. [Configuration Files](#configuration-files)
7. [Advanced Configuration](#advanced-configuration)

---

## Overview

LLM Connector Hub supports multiple configuration methods:

- **Code-based configuration**: Direct TypeScript/JavaScript configuration
- **Environment variables**: Standard `.env` file support
- **Configuration files**: JSON or YAML configuration files
- **Dynamic configuration**: Runtime configuration changes

### Configuration Precedence

When multiple configuration sources exist, they are merged in this order (highest to lowest precedence):

1. Explicit code configuration
2. Environment variables
3. Configuration files
4. Default values

---

## ConnectorHub Configuration

The `ConnectorHub` is the main orchestrator and accepts comprehensive configuration options.

### Basic Configuration

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';

const hub = new ConnectorHub({
  defaultProvider: 'openai',
  timeout: 60000,
  maxRetries: 3
});
```

### Complete Configuration Options

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import type { ConnectorHubConfig } from '@llm-connector-hub/core';

const config: ConnectorHubConfig = {
  // Default provider to use when not specified in requests
  defaultProvider: 'openai',

  // Global request timeout in milliseconds
  timeout: 60000,

  // Maximum number of retry attempts
  maxRetries: 3,

  // Retry backoff strategy
  retryBackoff: 'exponential', // 'linear' | 'exponential' | 'constant'

  // Base delay for retries in milliseconds
  retryDelay: 1000,

  // Maximum retry delay in milliseconds
  maxRetryDelay: 30000,

  // Middleware pipeline
  middleware: [],

  // Cache configuration
  cache: {
    enabled: true,
    type: 'memory', // 'memory' | 'redis' | 'custom'
    ttl: 3600 // Time to live in seconds
  },

  // Rate limiting configuration
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000 // 1 minute
  },

  // Logging configuration
  logging: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    includeRequestBody: false,
    includeResponseBody: false
  },

  // Metrics collection
  metrics: {
    enabled: true,
    prefix: 'llm_connector'
  },

  // Health check configuration
  healthCheck: {
    enabled: true,
    interval: 30000, // Check every 30 seconds
    timeout: 5000
  }
};

const hub = new ConnectorHub(config);
```

### Using Configuration Builder

For more fluent configuration:

```typescript
const hub = ConnectorHub.builder()
  .withDefaultProvider('openai')
  .withTimeout(60000)
  .withRetry({
    maxAttempts: 3,
    backoff: 'exponential'
  })
  .withCache({
    type: 'redis',
    url: 'redis://localhost:6379',
    ttl: 3600
  })
  .withLogging({
    level: 'info'
  })
  .build();
```

---

## Provider Configuration

Each provider has its own configuration requirements and options.

### OpenAI Configuration

```typescript
import { OpenAIProvider } from '@llm-connector-hub/providers';

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

  // Advanced options
  headers: {
    'Custom-Header': 'value'
  },

  // Proxy configuration
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    auth: {
      username: 'user',
      password: 'pass'
    }
  }
});
```

### Anthropic Configuration

```typescript
import { AnthropicProvider } from '@llm-connector-hub/providers';

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

  // Anthropic-specific options
  anthropicVersion: '2023-06-01',

  // Advanced options
  headers: {
    'Custom-Header': 'value'
  }
});
```

### Google Vertex AI Configuration

```typescript
import { GoogleProvider } from '@llm-connector-hub/providers';

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

  // Authentication method
  authMethod: 'api-key', // 'api-key' | 'service-account' | 'adc'

  // Service account path (if using service account)
  serviceAccountPath: '/path/to/service-account.json'
});
```

### Provider Registry Configuration

Register multiple providers at once:

```typescript
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider, AnthropicProvider } from '@llm-connector-hub/providers';

const hub = new ConnectorHub();

// Register providers individually
hub.registerProvider('openai', new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!
}));

hub.registerProvider('anthropic', new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!
}));

// Or use batch registration
hub.registerProviders({
  openai: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!
  }),
  anthropic: new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY!
  })
});
```

---

## Middleware Configuration

Middleware provides cross-cutting concerns like retry logic, logging, caching, and rate limiting.

### Retry Middleware

```typescript
import { RetryMiddleware } from '@llm-connector-hub/middleware';

const retryMiddleware = new RetryMiddleware({
  maxAttempts: 3,
  backoff: 'exponential', // 'linear' | 'exponential' | 'constant'
  baseDelay: 1000,
  maxDelay: 30000,

  // Retry conditions
  retryOn: {
    statusCodes: [429, 500, 502, 503, 504],
    errorTypes: ['rate_limit', 'server_error', 'timeout']
  },

  // Callbacks
  onRetry: (attempt, error) => {
    console.log(`Retry attempt ${attempt}:`, error);
  }
});

hub.use(retryMiddleware);
```

### Logging Middleware

```typescript
import { LoggingMiddleware } from '@llm-connector-hub/middleware';

const loggingMiddleware = new LoggingMiddleware({
  level: 'info', // 'debug' | 'info' | 'warn' | 'error'

  // What to log
  includeRequestBody: true,
  includeResponseBody: true,
  includeMetadata: true,
  includeDuration: true,

  // Custom logger
  logger: console, // or custom logger instance

  // Format
  format: 'json', // 'json' | 'pretty' | 'simple'

  // Redaction for sensitive data
  redactKeys: ['apiKey', 'authorization', 'password']
});

hub.use(loggingMiddleware);
```

### Cache Middleware

```typescript
import { CacheMiddleware } from '@llm-connector-hub/middleware';

const cacheMiddleware = new CacheMiddleware({
  type: 'memory', // 'memory' | 'redis' | 'custom'

  // Cache TTL in seconds
  ttl: 3600,

  // Maximum cache size (for memory cache)
  maxSize: 1000,

  // Redis configuration (if using Redis)
  redis: {
    url: 'redis://localhost:6379',
    keyPrefix: 'llm:cache:',
    db: 0
  },

  // Cache key strategy
  keyGenerator: (request) => {
    return `${request.provider}:${request.model}:${hashMessages(request.messages)}`;
  },

  // Cache conditions
  shouldCache: (request, response) => {
    // Only cache successful requests
    return response.status === 'success' && request.messages.length > 0;
  }
});

hub.use(cacheMiddleware);
```

### Rate Limit Middleware

```typescript
import { RateLimitMiddleware } from '@llm-connector-hub/middleware';

const rateLimitMiddleware = new RateLimitMiddleware({
  strategy: 'token-bucket', // 'token-bucket' | 'fixed-window' | 'sliding-window'

  // Token bucket configuration
  maxRequests: 100,
  windowMs: 60000, // 1 minute

  // Token bucket specific
  refillRate: 10, // tokens per second
  bucketSize: 100,

  // Per-provider limits
  providerLimits: {
    openai: {
      maxRequests: 50,
      windowMs: 60000
    },
    anthropic: {
      maxRequests: 30,
      windowMs: 60000
    }
  },

  // Callbacks
  onRateLimitExceeded: (provider, retryAfter) => {
    console.warn(`Rate limit exceeded for ${provider}. Retry after ${retryAfter}ms`);
  }
});

hub.use(rateLimitMiddleware);
```

### Metrics Middleware

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';

const metricsMiddleware = new MetricsMiddleware({
  enabled: true,
  prefix: 'llm_connector',

  // Metrics to collect
  collectDuration: true,
  collectTokenUsage: true,
  collectErrors: true,
  collectCacheHits: true,

  // Labels to include
  labels: ['provider', 'model', 'status'],

  // Custom metrics backend
  backend: 'prometheus', // 'prometheus' | 'statsd' | 'custom'

  // Prometheus specific
  prometheus: {
    port: 9090,
    path: '/metrics'
  }
});

hub.use(metricsMiddleware);
```

### Custom Middleware

Create your own middleware:

```typescript
import { Middleware } from '@llm-connector-hub/core';

class CustomMiddleware implements Middleware {
  async process(request, next) {
    // Pre-processing
    console.log('Before request:', request);

    // Call next middleware
    const response = await next(request);

    // Post-processing
    console.log('After response:', response);

    return response;
  }
}

hub.use(new CustomMiddleware());
```

---

## Environment Variables

### Core Environment Variables

```env
# Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Default Configuration
LLM_DEFAULT_PROVIDER=openai
LLM_REQUEST_TIMEOUT=60000
LLM_MAX_RETRIES=3

# Logging
LLM_LOG_LEVEL=info
LLM_LOG_FORMAT=json

# Caching
LLM_CACHE_ENABLED=true
LLM_CACHE_TYPE=redis
LLM_CACHE_URL=redis://localhost:6379
LLM_CACHE_TTL=3600

# Rate Limiting
LLM_RATE_LIMIT_ENABLED=true
LLM_RATE_LIMIT_MAX_REQUESTS=100
LLM_RATE_LIMIT_WINDOW_MS=60000

# Metrics
LLM_METRICS_ENABLED=true
LLM_METRICS_PORT=9090

# Health Checks
LLM_HEALTH_CHECK_ENABLED=true
LLM_HEALTH_CHECK_INTERVAL=30000
```

### Loading Environment Variables

Using `dotenv`:

```typescript
import 'dotenv/config';
import { ConnectorHub } from '@llm-connector-hub/hub';

const hub = new ConnectorHub({
  defaultProvider: process.env.LLM_DEFAULT_PROVIDER || 'openai',
  timeout: parseInt(process.env.LLM_REQUEST_TIMEOUT || '60000'),
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3')
});
```

### Environment-Specific Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const hub = new ConnectorHub({
  logging: {
    level: isDevelopment ? 'debug' : 'info',
    includeRequestBody: isDevelopment,
    includeResponseBody: isDevelopment
  },

  cache: {
    enabled: isProduction,
    type: isProduction ? 'redis' : 'memory'
  },

  metrics: {
    enabled: isProduction
  }
});
```

---

## Configuration Files

### JSON Configuration

Create `llm-config.json`:

```json
{
  "defaultProvider": "openai",
  "timeout": 60000,
  "maxRetries": 3,
  "providers": {
    "openai": {
      "defaultModel": "gpt-4",
      "timeout": 60000
    },
    "anthropic": {
      "defaultModel": "claude-3-opus-20240229",
      "timeout": 60000
    }
  },
  "cache": {
    "enabled": true,
    "type": "redis",
    "url": "redis://localhost:6379",
    "ttl": 3600
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

Load configuration:

```typescript
import { readFileSync } from 'fs';
import { ConnectorHub } from '@llm-connector-hub/hub';

const config = JSON.parse(readFileSync('./llm-config.json', 'utf-8'));
const hub = new ConnectorHub(config);
```

### YAML Configuration

Create `llm-config.yaml`:

```yaml
defaultProvider: openai
timeout: 60000
maxRetries: 3

providers:
  openai:
    defaultModel: gpt-4
    timeout: 60000
  anthropic:
    defaultModel: claude-3-opus-20240229
    timeout: 60000

cache:
  enabled: true
  type: redis
  url: redis://localhost:6379
  ttl: 3600

logging:
  level: info
  format: json

rateLimit:
  enabled: true
  maxRequests: 100
  windowMs: 60000
```

Load YAML configuration:

```typescript
import { readFileSync } from 'fs';
import yaml from 'yaml';
import { ConnectorHub } from '@llm-connector-hub/hub';

const config = yaml.parse(readFileSync('./llm-config.yaml', 'utf-8'));
const hub = new ConnectorHub(config);
```

---

## Advanced Configuration

### Dynamic Configuration

Update configuration at runtime:

```typescript
const hub = new ConnectorHub();

// Update default provider
hub.setDefaultProvider('anthropic');

// Update timeout
hub.setTimeout(120000);

// Update middleware
hub.use(new LoggingMiddleware({ level: 'debug' }));
```

### Provider-Specific Configuration Override

Override configuration for specific requests:

```typescript
const response = await hub.complete({
  provider: 'openai',
  messages: [...],

  // Override provider configuration for this request
  providerConfig: {
    timeout: 120000,
    maxRetries: 5
  }
});
```

### Conditional Middleware

Apply middleware conditionally:

```typescript
import { ConditionalMiddleware } from '@llm-connector-hub/middleware';

hub.use(new ConditionalMiddleware({
  condition: (request) => request.provider === 'openai',
  middleware: new RateLimitMiddleware({
    maxRequests: 50,
    windowMs: 60000
  })
}));
```

### Configuration Validation

Validate configuration before use:

```typescript
import { validateConfig } from '@llm-connector-hub/core';

const config = {
  defaultProvider: 'openai',
  timeout: 60000
};

try {
  const validated = validateConfig(config);
  const hub = new ConnectorHub(validated);
} catch (error) {
  console.error('Invalid configuration:', error);
}
```

### Configuration Inheritance

Extend base configuration:

```typescript
const baseConfig = {
  timeout: 60000,
  maxRetries: 3,
  logging: { level: 'info' }
};

const devConfig = {
  ...baseConfig,
  logging: {
    ...baseConfig.logging,
    level: 'debug',
    includeRequestBody: true
  }
};

const prodConfig = {
  ...baseConfig,
  cache: {
    enabled: true,
    type: 'redis'
  },
  metrics: {
    enabled: true
  }
};

const hub = new ConnectorHub(
  process.env.NODE_ENV === 'production' ? prodConfig : devConfig
);
```

### Secrets Management

Integrate with secrets management systems:

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

async function loadSecrets() {
  const client = new SecretManagerServiceClient();
  const [apiKey] = await client.accessSecretVersion({
    name: 'projects/my-project/secrets/openai-api-key/versions/latest'
  });

  return {
    openai: {
      apiKey: apiKey.payload.data.toString()
    }
  };
}

const secrets = await loadSecrets();

const hub = new ConnectorHub();
hub.registerProvider('openai', new OpenAIProvider({
  apiKey: secrets.openai.apiKey
}));
```

---

## Best Practices

### 1. Never Hardcode Secrets

```typescript
// Bad
const provider = new OpenAIProvider({
  apiKey: 'sk-...'
});

// Good
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!
});
```

### 2. Use Type-Safe Configuration

```typescript
import type { ConnectorHubConfig } from '@llm-connector-hub/core';

const config: ConnectorHubConfig = {
  defaultProvider: 'openai',
  timeout: 60000
};
```

### 3. Validate Configuration

```typescript
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}
```

### 4. Use Environment-Specific Configuration

```typescript
const config = process.env.NODE_ENV === 'production'
  ? productionConfig
  : developmentConfig;
```

### 5. Document Custom Configuration

```typescript
/**
 * Application-specific LLM configuration
 *
 * - Uses OpenAI for primary requests
 * - Falls back to Anthropic on rate limits
 * - Caches responses for 1 hour
 * - Retries up to 3 times with exponential backoff
 */
const config = { ... };
```

---

## Next Steps

- **[Providers Guide](./providers.md)** - Learn about provider-specific configuration
- **[Middleware Guide](./middleware.md)** - Deep dive into middleware
- **[Caching Guide](./caching.md)** - Optimize with caching
- **[API Reference](../api/connector-hub.md)** - Complete API documentation
