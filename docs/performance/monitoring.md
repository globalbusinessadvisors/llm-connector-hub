# Production Monitoring Guide

## Overview

This guide covers comprehensive monitoring and observability strategies for LLM Connector Hub in production environments. Effective monitoring enables proactive issue detection, performance optimization, and reliable operations at scale.

## Table of Contents

- [Monitoring Architecture](#monitoring-architecture)
- [Key Metrics](#key-metrics)
- [Metrics Collection](#metrics-collection)
- [Dashboards](#dashboards)
- [Alerting](#alerting)
- [Logging](#logging)
- [Tracing](#tracing)
- [Performance Analysis](#performance-analysis)
- [Troubleshooting](#troubleshooting)

## Monitoring Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                  Application Layer                   │
│  ┌──────────────────────────────────────────────┐   │
│  │         LLM Connector Hub                     │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │  MetricsMiddleware                      │  │   │
│  │  │  LoggingMiddleware                      │  │   │
│  │  │  TracingMiddleware                      │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Collection & Aggregation                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ StatsD   │  │ Prom.    │  │ OpenTelemetry    │  │
│  │ Agent    │  │ Exporter │  │ Collector        │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Storage & Processing                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Datadog  │  │ Prom.    │  │ Elasticsearch    │  │
│  │          │  │ TSDB     │  │                  │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Visualization & Alerting                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Grafana  │  │ Datadog  │  │ PagerDuty        │  │
│  │ Dashboard│  │ Dashboard│  │ Alerts           │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Stack Options

#### Option 1: Prometheus + Grafana (Open Source)

**Pros:**
- Free and open source
- Powerful querying (PromQL)
- Large community
- Self-hosted control

**Cons:**
- Setup complexity
- Scaling challenges
- Maintenance overhead

#### Option 2: Datadog (Commercial SaaS)

**Pros:**
- Turnkey solution
- Excellent UI/UX
- Full-stack monitoring
- Automatic anomaly detection

**Cons:**
- Expensive at scale
- Vendor lock-in
- Data privacy concerns

#### Option 3: Elastic Stack (ELK)

**Pros:**
- Unified logs and metrics
- Powerful search
- Flexible
- Can self-host

**Cons:**
- Resource intensive
- Complex configuration
- Scaling costs

## Key Metrics

### Request Metrics

#### Throughput

```typescript
// requests per second
llm_connector_hub_requests_total (counter)
llm_connector_hub_requests_rate (gauge)

// By provider
llm_connector_hub_requests_by_provider{provider="openai"} (counter)

// By model
llm_connector_hub_requests_by_model{model="gpt-4"} (counter)

// By status
llm_connector_hub_requests_by_status{status="success"} (counter)
llm_connector_hub_requests_by_status{status="error"} (counter)
```

#### Latency

```typescript
// Response time distribution
llm_connector_hub_request_duration_seconds (histogram)
  - Buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]

// By provider
llm_connector_hub_request_duration_by_provider{provider="openai"} (histogram)

// By operation
llm_connector_hub_request_duration_by_operation{operation="complete"} (histogram)
llm_connector_hub_request_duration_by_operation{operation="stream"} (histogram)
```

#### Error Rate

```typescript
// Total errors
llm_connector_hub_errors_total (counter)

// By error type
llm_connector_hub_errors_by_type{type="rate_limit"} (counter)
llm_connector_hub_errors_by_type{type="timeout"} (counter)
llm_connector_hub_errors_by_type{type="auth"} (counter)
llm_connector_hub_errors_by_type{type="server_error"} (counter)

// By provider
llm_connector_hub_errors_by_provider{provider="openai"} (counter)
```

### Cache Metrics

```typescript
// Cache operations
llm_connector_hub_cache_hits_total (counter)
llm_connector_hub_cache_misses_total (counter)
llm_connector_hub_cache_writes_total (counter)

// Cache hit rate
llm_connector_hub_cache_hit_rate (gauge)
  - Calculated: hits / (hits + misses)

// Cache latency
llm_connector_hub_cache_operation_duration{operation="get"} (histogram)
llm_connector_hub_cache_operation_duration{operation="set"} (histogram)

// Cache size
llm_connector_hub_cache_size_bytes (gauge)
llm_connector_hub_cache_entries (gauge)

// Evictions
llm_connector_hub_cache_evictions_total (counter)
```

### Resource Metrics

```typescript
// CPU
process_cpu_usage_percent (gauge)
process_cpu_system_seconds_total (counter)
process_cpu_user_seconds_total (counter)

// Memory
process_resident_memory_bytes (gauge)
process_heap_bytes (gauge)
nodejs_heap_size_total_bytes (gauge)
nodejs_heap_size_used_bytes (gauge)
nodejs_external_memory_bytes (gauge)

// Event loop
nodejs_eventloop_lag_seconds (gauge)
nodejs_eventloop_lag_p99_seconds (gauge)

// Garbage collection
nodejs_gc_duration_seconds{kind="major"} (histogram)
nodejs_gc_duration_seconds{kind="minor"} (histogram)
```

### Provider Metrics

```typescript
// Provider availability
llm_connector_hub_provider_available{provider="openai"} (gauge)
  - 1 = available, 0 = unavailable

// Provider latency
llm_connector_hub_provider_latency{provider="openai"} (histogram)

// Provider errors
llm_connector_hub_provider_errors{provider="openai",type="rate_limit"} (counter)

// Token usage
llm_connector_hub_tokens_used{provider="openai",type="input"} (counter)
llm_connector_hub_tokens_used{provider="openai",type="output"} (counter)

// Cost estimation
llm_connector_hub_estimated_cost{provider="openai"} (counter)
```

### Connection Pool Metrics

```typescript
// Active connections
llm_connector_hub_connections_active (gauge)

// Idle connections
llm_connector_hub_connections_idle (gauge)

// Connection acquisition time
llm_connector_hub_connection_acquisition_duration (histogram)

// Connection errors
llm_connector_hub_connection_errors_total (counter)
```

## Metrics Collection

### Using Prometheus

#### Setup MetricsMiddleware

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';
import { Registry, collectDefaultMetrics } from 'prom-client';

// Create registry
const register = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// Add metrics middleware
hub.use(new MetricsMiddleware({
  prometheus: {
    enabled: true,
    register,
    prefix: 'llm_connector_hub_',

    // Custom labels
    defaultLabels: {
      environment: process.env.NODE_ENV,
      service: 'llm-connector-hub',
      version: process.env.APP_VERSION
    }
  }
}));
```

#### Expose Metrics Endpoint

```typescript
import express from 'express';

const app = express();

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(9090, () => {
  console.log('Metrics server listening on :9090');
});
```

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'llm-connector-hub'
    static_configs:
      - targets: ['localhost:9090']

    # Relabeling
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

    # Metric relabeling
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'llm_connector_hub_.*'
        action: keep
```

### Using StatsD

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';
import StatsD from 'node-statsd';

// Create StatsD client
const statsd = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: 8125,
  prefix: 'llm_connector_hub.',
  cacheDns: true,

  // Error handling
  errorHandler: (error) => {
    console.error('StatsD error:', error);
  }
});

// Add metrics middleware
hub.use(new MetricsMiddleware({
  statsd: {
    enabled: true,
    client: statsd,

    // Sample rate
    sampleRate: 1.0,

    // Tags
    tags: {
      environment: process.env.NODE_ENV,
      service: 'llm-connector-hub'
    }
  }
}));
```

### Using OpenTelemetry

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// Create exporter
const exporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
  headers: {
    'api-key': process.env.OTEL_API_KEY
  }
});

// Create meter provider
const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 10000
    })
  ]
});

// Add metrics middleware
hub.use(new MetricsMiddleware({
  opentelemetry: {
    enabled: true,
    meterProvider,
    meterName: 'llm-connector-hub'
  }
}));
```

## Dashboards

### Grafana Dashboard - Overview

```json
{
  "dashboard": {
    "title": "LLM Connector Hub - Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(llm_connector_hub_requests_total[5m])"
        }],
        "type": "graph"
      },
      {
        "title": "P95 Latency",
        "targets": [{
          "expr": "histogram_quantile(0.95, llm_connector_hub_request_duration_seconds_bucket)"
        }],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "rate(llm_connector_hub_errors_total[5m]) / rate(llm_connector_hub_requests_total[5m])"
        }],
        "type": "graph"
      },
      {
        "title": "Cache Hit Rate",
        "targets": [{
          "expr": "llm_connector_hub_cache_hit_rate"
        }],
        "type": "gauge"
      }
    ]
  }
}
```

### Key Dashboard Panels

#### 1. Request Overview

**Metrics:**
- Total requests per second
- Requests by provider
- Requests by status (success/error)
- Request rate trend (24h)

**PromQL Queries:**
```promql
# Total RPS
rate(llm_connector_hub_requests_total[5m])

# By provider
sum(rate(llm_connector_hub_requests_by_provider[5m])) by (provider)

# Success rate
sum(rate(llm_connector_hub_requests_by_status{status="success"}[5m]))
/
sum(rate(llm_connector_hub_requests_total[5m]))
```

#### 2. Latency Distribution

**Metrics:**
- P50, P90, P95, P99 latency
- Latency heatmap
- Latency by provider
- Latency trend (24h)

**PromQL Queries:**
```promql
# Percentiles
histogram_quantile(0.50, llm_connector_hub_request_duration_seconds_bucket)
histogram_quantile(0.90, llm_connector_hub_request_duration_seconds_bucket)
histogram_quantile(0.95, llm_connector_hub_request_duration_seconds_bucket)
histogram_quantile(0.99, llm_connector_hub_request_duration_seconds_bucket)

# By provider
histogram_quantile(0.95,
  sum(rate(llm_connector_hub_request_duration_by_provider_bucket[5m])) by (provider, le)
)
```

#### 3. Error Tracking

**Metrics:**
- Error rate
- Errors by type
- Errors by provider
- Error trend (24h)

**PromQL Queries:**
```promql
# Overall error rate
rate(llm_connector_hub_errors_total[5m])

# By type
sum(rate(llm_connector_hub_errors_by_type[5m])) by (type)

# Error percentage
rate(llm_connector_hub_errors_total[5m])
/
rate(llm_connector_hub_requests_total[5m]) * 100
```

#### 4. Cache Performance

**Metrics:**
- Cache hit rate
- Cache operations per second
- Cache latency
- Cache size and memory usage

**PromQL Queries:**
```promql
# Hit rate
llm_connector_hub_cache_hit_rate

# Operations
rate(llm_connector_hub_cache_hits_total[5m])
rate(llm_connector_hub_cache_misses_total[5m])

# Latency
histogram_quantile(0.95, llm_connector_hub_cache_operation_duration_bucket)

# Size
llm_connector_hub_cache_size_bytes
llm_connector_hub_cache_entries
```

#### 5. Resource Utilization

**Metrics:**
- CPU usage
- Memory usage (heap, RSS)
- Event loop lag
- GC duration and frequency

**PromQL Queries:**
```promql
# CPU
process_cpu_usage_percent

# Memory
process_heap_bytes / process_resident_memory_bytes * 100

# Event loop lag
nodejs_eventloop_lag_seconds

# GC duration
rate(nodejs_gc_duration_seconds_sum[5m])
```

#### 6. Provider Health

**Metrics:**
- Provider availability
- Provider latency
- Provider error rates
- Token usage and costs

**PromQL Queries:**
```promql
# Availability
llm_connector_hub_provider_available

# Latency by provider
histogram_quantile(0.95,
  sum(rate(llm_connector_hub_provider_latency_bucket[5m])) by (provider, le)
)

# Error rate by provider
sum(rate(llm_connector_hub_provider_errors[5m])) by (provider, type)

# Token usage
sum(rate(llm_connector_hub_tokens_used[1h])) by (provider, type)
```

### Dashboard Templates

Complete dashboard templates available at:
- Grafana: `/monitoring/dashboards/grafana/`
- Datadog: `/monitoring/dashboards/datadog/`
- Kibana: `/monitoring/dashboards/kibana/`

## Alerting

### Alert Rules

#### Critical Alerts

**High Error Rate**
```yaml
alert: HighErrorRate
expr: |
  (
    rate(llm_connector_hub_errors_total[5m])
    /
    rate(llm_connector_hub_requests_total[5m])
  ) > 0.05
for: 5m
labels:
  severity: critical
annotations:
  summary: "High error rate detected"
  description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
```

**Service Down**
```yaml
alert: ServiceDown
expr: up{job="llm-connector-hub"} == 0
for: 1m
labels:
  severity: critical
annotations:
  summary: "Service is down"
  description: "LLM Connector Hub instance is unreachable"
```

**High Latency**
```yaml
alert: HighLatency
expr: |
  histogram_quantile(0.95,
    llm_connector_hub_request_duration_seconds_bucket
  ) > 10
for: 5m
labels:
  severity: critical
annotations:
  summary: "High P95 latency"
  description: "P95 latency is {{ $value }}s (threshold: 10s)"
```

#### Warning Alerts

**Elevated Error Rate**
```yaml
alert: ElevatedErrorRate
expr: |
  (
    rate(llm_connector_hub_errors_total[5m])
    /
    rate(llm_connector_hub_requests_total[5m])
  ) > 0.01
for: 10m
labels:
  severity: warning
annotations:
  summary: "Elevated error rate"
  description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"
```

**Low Cache Hit Rate**
```yaml
alert: LowCacheHitRate
expr: llm_connector_hub_cache_hit_rate < 0.5
for: 15m
labels:
  severity: warning
annotations:
  summary: "Low cache hit rate"
  description: "Cache hit rate is {{ $value | humanizePercentage }} (threshold: 50%)"
```

**High Memory Usage**
```yaml
alert: HighMemoryUsage
expr: |
  (
    process_heap_bytes
    /
    nodejs_heap_size_total_bytes
  ) > 0.9
for: 5m
labels:
  severity: warning
annotations:
  summary: "High memory usage"
  description: "Heap usage is {{ $value | humanizePercentage }} (threshold: 90%)"
```

**Provider Degradation**
```yaml
alert: ProviderDegradation
expr: |
  histogram_quantile(0.95,
    sum(rate(llm_connector_hub_provider_latency_bucket[5m])) by (provider, le)
  ) > 15
for: 10m
labels:
  severity: warning
annotations:
  summary: "Provider {{ $labels.provider }} degraded"
  description: "P95 latency for {{ $labels.provider }} is {{ $value }}s"
```

### Alert Configuration

#### Prometheus AlertManager

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

  # Email configuration
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@example.com'
  smtp_auth_username: 'alerts@example.com'
  smtp_auth_password: 'password'

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

  receiver: 'default'

  routes:
    # Critical alerts to PagerDuty
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true

    # All alerts to email
    - match_re:
        severity: ^(critical|warning)$
      receiver: 'email'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'

  - name: 'email'
    email_configs:
      - to: 'team@example.com'
        headers:
          Subject: '{{ .GroupLabels.alertname }} - {{ .GroupLabels.severity }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
        description: '{{ .CommonAnnotations.summary }}'

  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
```

#### Application-Level Alerts

```typescript
import { AlertManager } from '@llm-connector-hub/monitoring';

const alertManager = new AlertManager({
  // Alert thresholds
  thresholds: {
    errorRate: 0.05,        // 5%
    p95Latency: 10000,      // 10s
    cacheHitRate: 0.5,      // 50%
    memoryUsage: 0.9        // 90%
  },

  // Check interval
  checkInterval: 60000,     // 1 minute

  // Notification channels
  notifications: {
    email: {
      enabled: true,
      recipients: ['team@example.com']
    },
    slack: {
      enabled: true,
      webhook: process.env.SLACK_WEBHOOK
    },
    pagerduty: {
      enabled: true,
      serviceKey: process.env.PAGERDUTY_KEY
    }
  }
});

hub.use(alertManager);
```

## Logging

### Structured Logging

```typescript
import { LoggingMiddleware } from '@llm-connector-hub/middleware';
import winston from 'winston';

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'llm-connector-hub',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  },
  transports: [
    // Console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // File - errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760,  // 10MB
      maxFiles: 5
    }),

    // File - all
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Add to hub
hub.use(new LoggingMiddleware({
  logger,

  // Log levels by event
  levels: {
    request: 'info',
    response: 'info',
    error: 'error',
    cache: 'debug'
  },

  // Include in logs
  include: {
    request: ['provider', 'model', 'messages'],
    response: ['content', 'usage'],
    timing: true,
    metadata: true
  },

  // Redact sensitive data
  redact: ['apiKey', 'password', 'token']
}));
```

### Log Formats

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "service": "llm-connector-hub",
  "environment": "production",
  "version": "1.0.0",
  "type": "request",
  "provider": "openai",
  "model": "gpt-4",
  "requestId": "req_abc123",
  "userId": "user_xyz789",
  "duration": 1234,
  "status": "success",
  "usage": {
    "promptTokens": 50,
    "completionTokens": 100,
    "totalTokens": 150
  }
}
```

## Tracing

### Distributed Tracing with OpenTelemetry

```typescript
import { TracingMiddleware } from '@llm-connector-hub/middleware';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Create provider
const provider = new NodeTracerProvider();

// Create exporter
const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
});

// Add span processor
provider.addSpanProcessor(new BatchSpanProcessor(exporter));

// Register provider
provider.register();

// Add to hub
hub.use(new TracingMiddleware({
  opentelemetry: {
    enabled: true,
    provider,
    serviceName: 'llm-connector-hub'
  },

  // Trace all requests
  sampleRate: 1.0,

  // Include in spans
  includePayload: false,  // Don't trace full request/response
  includeHeaders: true,
  includeTiming: true
}));
```

## Performance Analysis

### Request Profiling

```typescript
import { ProfilerMiddleware } from '@llm-connector-hub/middleware';

hub.use(new ProfilerMiddleware({
  enabled: process.env.NODE_ENV === 'development',

  // Sample rate
  sampleRate: 0.1,  // 10% of requests

  // Output
  output: {
    console: true,
    file: 'logs/profiles/',
    format: 'json'
  },

  // What to profile
  profile: {
    cpu: true,
    memory: true,
    timing: true
  }
}));
```

### Slow Request Logging

```typescript
hub.use(new LoggingMiddleware({
  logger,

  // Log slow requests
  slowRequestThreshold: 5000,  // 5 seconds

  // Log handler
  slowRequestHandler: (request, duration) => {
    logger.warn('Slow request detected', {
      requestId: request.id,
      provider: request.provider,
      model: request.model,
      duration,
      threshold: 5000
    });
  }
}));
```

## Troubleshooting

### Common Issues

#### High Latency

**Diagnosis:**
1. Check provider latency: `llm_connector_hub_provider_latency`
2. Check cache performance: `llm_connector_hub_cache_hit_rate`
3. Check middleware overhead: Request profiling
4. Check network: Connection pool metrics

**Resolution:**
- Enable caching
- Optimize middleware
- Increase connection pool
- Choose faster providers

#### Memory Leaks

**Diagnosis:**
1. Monitor heap growth: `nodejs_heap_size_used_bytes`
2. Take heap snapshots
3. Check cache size: `llm_connector_hub_cache_size_bytes`
4. Review middleware lifecycle

**Resolution:**
- Set cache limits
- Fix event listener leaks
- Use Redis for large caches
- Restart instances periodically

#### Cache Miss Rate

**Diagnosis:**
1. Check hit rate: `llm_connector_hub_cache_hit_rate`
2. Review cache configuration
3. Analyze request patterns
4. Check TTL settings

**Resolution:**
- Optimize cache keys
- Adjust TTL
- Implement cache warming
- Increase cache size

## Further Reading

- [Performance Benchmarks](./benchmarks.md)
- [Optimization Guide](./optimization-guide.md)
- [Caching Guide](../user-guide/caching.md)
- [Architecture Overview](../architecture/README.md)
