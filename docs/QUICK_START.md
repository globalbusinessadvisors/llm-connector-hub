# Quick Start Guide

Get LLM Connector Hub up and running in 5 minutes.

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and docker-compose (for local development)

## Option 1: Local Development (Fastest)

```bash
# 1. Clone and install
git clone https://github.com/your-org/llm-connector-hub
cd llm-connector-hub
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your API keys:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# 3. Build and test
npm run build
npm test

# 4. Start development server
npm run dev
```

## Option 2: Docker Compose (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/your-org/llm-connector-hub
cd llm-connector-hub

# 2. Configure environment
cp .env.example .env
# Edit .env and add your API keys

# 3. Start all services
docker-compose up -d

# 4. Check health
curl http://localhost:8080/health

# 5. Access dashboards
# - Application: http://localhost:8080
# - Grafana: http://localhost:3000 (admin/admin)
# - Prometheus: http://localhost:9090
```

## Option 3: Using Makefile

```bash
# Install and build
make install
make build

# Run all checks
make check

# Start with docker-compose
make docker-up

# View logs
make docker-logs

# Stop services
make docker-down
```

## Verify Installation

```bash
# Check service health
curl http://localhost:8080/health

# Test completion endpoint (example)
curl -X POST http://localhost:8080/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Next Steps

1. Read the [User Guide](docs/user-guide/README.md)
2. Explore [Examples](examples/)
3. Check [API Reference](docs/api/README.md)
4. Review [Deployment Guide](DEPLOYMENT.md)

## Common Commands

### Development
```bash
npm run build          # Build all packages
npm test               # Run tests
npm run lint           # Check code quality
npm run typecheck      # Type checking
```

### Docker
```bash
docker-compose up -d   # Start services
docker-compose down    # Stop services
docker-compose logs -f # View logs
```

### Makefile
```bash
make help             # Show all commands
make dev              # Start dev environment
make test             # Run tests
make check            # Run all checks
make docker-up        # Start docker services
```

## Troubleshooting

### Port already in use
```bash
# Change ports in docker-compose.yml or .env
PORT=8081 npm run dev
```

### Missing dependencies
```bash
npm ci                # Clean install
make install          # Or use make
```

### Docker issues
```bash
docker-compose down -v # Stop and remove volumes
docker-compose up --build # Rebuild containers
```

## Getting Help

- Documentation: [README.md](README.md)
- Issues: https://github.com/your-org/llm-connector-hub/issues
- Discussions: https://github.com/your-org/llm-connector-hub/discussions
