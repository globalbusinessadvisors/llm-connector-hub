# Health Monitoring Guide

Monitor system health and performance of LLM Connector Hub.

## Health Checks

```typescript
import { HealthCheck } from '@llm-connector-hub/hub';

const health = new HealthCheck({
  interval: 30000,  // Check every 30 seconds
  timeout: 5000,    // 5 second timeout
  providers: ['openai', 'anthropic', 'google']
});

// Get health status
const status = await health.check();
console.log(status);
// {
//   status: 'healthy',
//   providers: {
//     openai: { status: 'healthy', latency: 123 },
//     anthropic: { status: 'healthy', latency: 156 },
//     google: { status: 'degraded', latency: 2000 }
//   }
// }
```

## Metrics Collection

```typescript
import { MetricsMiddleware } from '@llm-connector-hub/middleware';

const metrics = new MetricsMiddleware({
  enabled: true,
  prefix: 'llm_connector',
  collectDuration: true,
  collectTokenUsage: true,
  collectErrors: true
});

hub.use(metrics);

// Export metrics for Prometheus
app.get('/metrics', async (req, res) => {
  const data = await metrics.export();
  res.set('Content-Type', 'text/plain');
  res.send(data);
});
```

## Logging

```typescript
import { LoggingMiddleware } from '@llm-connector-hub/middleware';

const logging = new LoggingMiddleware({
  level: 'info',
  format: 'json',
  includeRequestBody: false,
  includeResponseBody: false,
  includeDuration: true,
  
  // Custom logger
  logger: {
    info: (msg, meta) => console.log(JSON.stringify({ ...msg, ...meta })),
    error: (msg, meta) => console.error(JSON.stringify({ ...msg, ...meta }))
  }
});

hub.use(logging);
```

## Monitoring Dashboard

```typescript
import { Dashboard } from '@llm-connector-hub/monitoring';

const dashboard = new Dashboard({
  port: 3000,
  hub: hub,
  metrics: metrics,
  updateInterval: 1000
});

await dashboard.start();
// Dashboard available at http://localhost:3000
```

## Alerts

```typescript
import { AlertManager } from '@llm-connector-hub/monitoring';

const alerts = new AlertManager({
  rules: [
    {
      name: 'high-error-rate',
      condition: (metrics) => metrics.errorRate > 0.05,
      action: async () => {
        await sendSlackAlert('High error rate detected');
      }
    },
    {
      name: 'high-latency',
      condition: (metrics) => metrics.avgLatency > 5000,
      action: async () => {
        await sendPagerDutyAlert('High latency detected');
      }
    }
  ],
  checkInterval: 60000  // Check every minute
});

await alerts.start();
```

## Best Practices

1. **Monitor key metrics**: Latency, error rate, token usage
2. **Set up alerts**: Be notified of issues quickly
3. **Log appropriately**: Balance detail with performance
4. **Track costs**: Monitor token usage and API costs
5. **Health check endpoints**: Expose health status for orchestrators

## Next Steps

- [Configuration Guide](./configuration.md)
- [Deployment Guide](../deployment/README.md)
