# Deployment Guide

Deploy LLM Connector Hub in production environments.

## Deployment Options

- **[Docker](./docker.md)** - Container deployment
- **[Kubernetes](./kubernetes.md)** - Orchestrated deployment
- **[Environment Variables](./environment-variables.md)** - Configuration
- **[Security](./security.md)** - Security best practices
- **[Monitoring](./monitoring.md)** - Observability setup

## Quick Start

### Docker

```bash
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  llm-connector-hub:latest
```

### Kubernetes

```bash
helm install llm-connector ./deployment/helm \
  --set secrets.openai_api_key=sk-...
```

## Production Checklist

- [ ] Configure environment variables
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Enable caching (Redis)
- [ ] Set up health checks
- [ ] Configure auto-scaling
- [ ] Implement security measures
- [ ] Set up backups
- [ ] Configure alerts

## Next Steps

- [Docker Guide](./docker.md)
- [Kubernetes Guide](./kubernetes.md)
- [Security Guide](./security.md)
