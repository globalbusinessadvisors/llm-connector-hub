# Infrastructure Overview

Complete infrastructure setup for LLM Connector Hub including CI/CD, Docker, and Kubernetes deployment configurations.

## Table of Contents

- [Architecture](#architecture)
- [CI/CD Pipeline](#cicd-pipeline)
- [Docker Setup](#docker-setup)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Automation Scripts](#automation-scripts)
- [Monitoring Stack](#monitoring-stack)
- [File Structure](#file-structure)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       GitHub Actions                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │    CI    │  │ Release  │  │  Security    │              │
│  └──────────┘  └──────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Registry                           │
│              (Docker Hub / ECR / GCR / ACR)                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │                 LLM Connector Hub                   │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │     │
│  │  │  Pod 1   │  │  Pod 2   │  │  Pod 3   │  (HPA)  │     │
│  │  └──────────┘  └──────────┘  └──────────┘         │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │                    Redis Cache                      │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │              Ingress Controller                     │     │
│  │         (nginx / ALB / Cloud Load Balancer)        │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Monitoring Stack                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Prometheus  │  │   Grafana    │  │   Logging    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## CI/CD Pipeline

### 1. Continuous Integration (`.github/workflows/ci.yml`)

Triggered on: `push`, `pull_request` to `main` and `develop` branches

**Pipeline Steps:**
```
Install Dependencies → Lint → Type Check → Test (Node 18/20/22) → Build (Multi-OS)
                                              ↓
                                      Coverage Report
                                              ↓
                                      Upload to Codecov
```

**Features:**
- Parallel execution for faster builds
- Multi-version Node.js testing (18, 20, 22)
- Multi-OS builds (Ubuntu, Windows, macOS)
- Code coverage reporting
- Artifact caching for speed
- Build artifact archival

### 2. Release Automation (`.github/workflows/release.yml`)

Triggered on: Version tags (`v*.*.*`)

**Pipeline Steps:**
```
Validate Version → Run Tests → Build Packages → Publish to npm → Create GitHub Release
                                                                          ↓
                                                                   Generate Changelog
```

**Features:**
- Version validation
- Automated npm publishing with provenance
- GitHub release creation
- Changelog generation
- Release artifact archival
- Skip already published versions

### 3. Security Scanning (`.github/workflows/security.yml`)

Triggered on: `push`, `pull_request`, `schedule` (daily), `workflow_dispatch`

**Security Checks:**
- **npm audit**: Check for known vulnerabilities
- **Snyk**: Advanced vulnerability scanning
- **CodeQL**: Code analysis for security issues
- **TruffleHog**: Secret scanning
- **Dependency Review**: License compliance
- **License Check**: Verify compatible licenses

## Docker Setup

### Multi-Stage Dockerfile

**Stages:**
1. **Builder**: Compiles TypeScript, installs dependencies
2. **Production**: Minimal runtime image with security hardening
3. **Development**: Full development environment with debugging
4. **Test**: Test execution environment

**Security Features:**
- Non-root user (UID 1001)
- Alpine Linux base (minimal attack surface)
- dumb-init for proper signal handling
- Health check configuration
- Read-only root filesystem support

### Docker Compose

**Services:**
- **llm-connector-hub**: Main application
- **redis**: Cache layer
- **prometheus**: Metrics collection
- **grafana**: Metrics visualization
- **node-exporter**: System metrics
- **redis-commander**: Redis management UI (dev only)

**Networking:**
- Custom bridge network for service isolation
- Health checks for all services
- Volume persistence for data

## Kubernetes Deployment

### Resources Included

#### Core Resources
- **Namespace**: `llm-connector-hub`
- **ConfigMap**: Application configuration
- **Secrets**: Sensitive credentials (template)
- **ServiceAccount**: RBAC for pods

#### Workload Resources
- **Deployment**: Main application (3 replicas)
- **Deployment**: Redis cache (1 replica)
- **PersistentVolumeClaim**: Redis data storage

#### Networking
- **Service**: LoadBalancer (external access)
- **Service**: ClusterIP (internal access)
- **Service**: Headless (StatefulSet support)
- **Ingress**: TLS-enabled routing with cert-manager

#### Scaling & Availability
- **HorizontalPodAutoscaler**: CPU/Memory-based autoscaling (3-10 pods)
- **VerticalPodAutoscaler**: Resource optimization recommendations
- **PodDisruptionBudget**: Minimum availability during updates

#### Security
- **NetworkPolicy**: Traffic restriction rules
- **SecurityContext**: Non-root, read-only filesystem
- **RBAC**: Least-privilege access control

### Deployment Features

**High Availability:**
- 3 minimum replicas
- Pod anti-affinity rules
- Rolling update strategy (zero downtime)
- Pod disruption budgets

**Autoscaling:**
- CPU threshold: 70%
- Memory threshold: 80%
- Min replicas: 3
- Max replicas: 10

**Security:**
- Non-root containers (UID 1001)
- Read-only root filesystem
- Dropped capabilities
- Network policies
- Secret management

**Monitoring:**
- Prometheus metrics scraping
- Liveness probes
- Readiness probes
- Startup probes

## Automation Scripts

All scripts located in `/scripts/` directory:

### build.sh
```bash
./scripts/build.sh [OPTIONS]

Options:
  -c, --clean       Clean before building
  -v, --verbose     Verbose output
  -p, --production  Production build
```

**Features:**
- Clean build artifacts
- Workspace package building
- Production optimizations
- Build validation

### test.sh
```bash
./scripts/test.sh [OPTIONS]

Options:
  -c, --coverage           Generate coverage
  -w, --watch              Watch mode
  -p, --package <name>     Test specific package
  -u, --update-snapshots   Update snapshots
```

**Features:**
- Coverage reporting
- Watch mode for development
- Package-specific testing
- Snapshot management

### lint.sh
```bash
./scripts/lint.sh [OPTIONS]

Options:
  -f, --fix        Auto-fix issues
  --format         Format code
  -t, --typecheck  Type checking
  -a, --all        All checks and fixes
```

**Features:**
- ESLint checking
- Prettier formatting
- TypeScript type checking
- Auto-fix capabilities

### publish.sh
```bash
./scripts/publish.sh [OPTIONS]

Options:
  -d, --dry-run     Dry run
  -t, --tag <tag>   NPM dist-tag
  --skip-checks     Skip pre-publish checks
  --access <type>   Package access level
```

**Features:**
- Pre-publish validation
- Version checking
- Duplicate version detection
- Git branch verification
- Tag recommendations

### deploy.sh
```bash
./scripts/deploy.sh [OPTIONS]

Options:
  -e, --environment <env>  Environment
  -n, --namespace <ns>     Kubernetes namespace
  -b, --build              Build Docker image
  -p, --push               Push to registry
  -t, --tag <tag>          Image tag
  -d, --dry-run            Dry run
```

**Features:**
- Environment configuration
- Docker image building
- Registry pushing
- Kubernetes deployment
- Rollout monitoring
- Status reporting

## Monitoring Stack

### Prometheus
- **Port**: 9090
- **Metrics**: Application, Redis, System
- **Retention**: 30 days
- **Config**: `/config/prometheus.yml`

### Grafana
- **Port**: 3000
- **Credentials**: admin/admin (default)
- **Datasources**: Prometheus (auto-configured)
- **Dashboards**: Pre-provisioned dashboards

### Metrics Exposed
- HTTP request rate and latency
- Provider response times
- Cache hit/miss rates
- Error rates and types
- Resource utilization
- Queue depths
- Custom business metrics

## File Structure

```
llm-connector-hub/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Continuous integration
│       ├── release.yml               # Release automation
│       └── security.yml              # Security scanning
│
├── config/
│   ├── prometheus.yml                # Prometheus configuration
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/          # Grafana datasources
│       │   └── dashboards/           # Dashboard provisioning
│       └── dashboards/               # Dashboard definitions
│
├── deployment/
│   ├── kubernetes/
│   │   ├── namespace.yaml            # Namespace
│   │   ├── configmap.yaml            # Configuration
│   │   ├── secrets.yaml              # Secrets template
│   │   ├── serviceaccount.yaml       # RBAC
│   │   ├── deployment.yaml           # App & Redis deployments
│   │   ├── service.yaml              # Services
│   │   ├── ingress.yaml              # Ingress & TLS
│   │   ├── hpa.yaml                  # Autoscaling
│   │   └── poddisruptionbudget.yaml  # PDB
│   └── README.md                     # Deployment guide
│
├── scripts/
│   ├── build.sh                      # Build automation
│   ├── test.sh                       # Test runner
│   ├── lint.sh                       # Linting & formatting
│   ├── publish.sh                    # NPM publishing
│   └── deploy.sh                     # Kubernetes deployment
│
├── Dockerfile                        # Multi-stage Docker build
├── docker-compose.yml                # Local development stack
├── .dockerignore                     # Docker build exclusions
├── Makefile                          # Convenient commands
├── .env.example                      # Environment template
├── DEPLOYMENT.md                     # Deployment documentation
├── QUICK_START.md                    # Quick start guide
└── INFRASTRUCTURE.md                 # This file
```

## Quick Reference

### Local Development
```bash
make install        # Install dependencies
make build          # Build packages
make test           # Run tests
make docker-up      # Start services
```

### CI/CD
```bash
git push            # Triggers CI workflow
git tag v1.0.0      # Triggers release workflow
git push origin v1.0.0
```

### Deployment
```bash
./scripts/deploy.sh                    # Deploy to production
./scripts/deploy.sh -e staging         # Deploy to staging
./scripts/deploy.sh -b -p -t v1.0.0   # Build, push, deploy
```

### Monitoring
```bash
kubectl port-forward svc/prometheus 9090:9090    # Prometheus
kubectl port-forward svc/grafana 3000:3000       # Grafana
```

## Best Practices

### Security
1. Never commit secrets to version control
2. Use external secret management (Vault, AWS Secrets Manager)
3. Rotate API keys regularly
4. Enable all security scanning in CI/CD
5. Review security scan results before merging

### Deployment
1. Always test in staging before production
2. Use semantic versioning
3. Run dry-run before actual deployment
4. Monitor metrics after deployment
5. Have rollback plan ready

### Monitoring
1. Set up alerting for critical metrics
2. Monitor error rates and latencies
3. Track provider-specific metrics
4. Review logs regularly
5. Set up log aggregation for production

### Cost Optimization
1. Use autoscaling to match demand
2. Right-size resource limits
3. Use spot instances where appropriate
4. Monitor resource utilization
5. Clean up unused resources

## Support & Resources

- **Documentation**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Quick Start**: See [QUICK_START.md](QUICK_START.md)
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

## Version

Infrastructure Version: 1.0.0
Last Updated: 2025-11-24
