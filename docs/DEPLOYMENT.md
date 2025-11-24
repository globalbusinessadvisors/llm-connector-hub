# Deployment Documentation

Comprehensive guide for deploying LLM Connector Hub in various environments.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Providers](#cloud-providers)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Observability](#monitoring--observability)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

LLM Connector Hub can be deployed in multiple ways:

1. **Local Development**: Using npm scripts or docker-compose
2. **Docker**: Containerized deployment with Docker
3. **Kubernetes**: Production-ready orchestration
4. **Cloud Managed Services**: AWS EKS, GKE, AKS

## Prerequisites

### Required Software

- **Node.js**: 18.x or later
- **npm**: 9.x or later
- **Docker**: 20.10+
- **kubectl**: 1.24+ (for Kubernetes deployments)
- **Helm**: 3.10+ (optional, for Kubernetes)

### Cloud Accounts (Optional)

- AWS account (for EKS deployment)
- Google Cloud account (for GKE deployment)
- Azure account (for AKS deployment)

### API Keys

Required API keys for LLM providers:
- OpenAI API key
- Anthropic API key
- Google API key (optional)
- AWS credentials (optional)
- Azure OpenAI credentials (optional)

## Local Development

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/llm-connector-hub
cd llm-connector-hub

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 4. Build packages
npm run build

# 5. Run tests
npm test

# 6. Start development server
npm run dev
```

### Using Makefile

```bash
# Install dependencies and build
make install
make build

# Run all checks
make check

# Start development environment
make dev
```

## Docker Deployment

### Building the Image

```bash
# Build for production
docker build -t llm-connector-hub:latest .

# Build for development
docker build --target development -t llm-connector-hub:dev .

# Build for testing
docker build --target test -t llm-connector-hub:test .
```

### Running with Docker

```bash
# Run production container
docker run -d \
  --name llm-connector-hub \
  -p 8080:8080 \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  llm-connector-hub:latest

# Check health
curl http://localhost:8080/health

# View logs
docker logs -f llm-connector-hub
```

### Docker Compose

```bash
# Start all services (app, Redis, Prometheus, Grafana)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

#### Accessing Services

- **Application**: http://localhost:8080
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Redis**: localhost:6379

## Kubernetes Deployment

### Prerequisites

1. **Kubernetes Cluster**: Version 1.24+
2. **kubectl**: Configured to access your cluster
3. **Ingress Controller**: nginx-ingress or AWS ALB
4. **cert-manager**: For TLS certificates (optional)
5. **metrics-server**: For autoscaling

### Deployment Steps

#### 1. Prepare Configuration

```bash
# Create namespace
kubectl apply -f deployment/kubernetes/namespace.yaml

# Create secrets (DO NOT use the template in production!)
kubectl create secret generic llm-connector-hub-secrets \
  --from-literal=OPENAI_API_KEY=sk-... \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-... \
  --namespace=llm-connector-hub
```

#### 2. Deploy Application

Using the deploy script:

```bash
# Deploy to production
./scripts/deploy.sh

# Deploy to staging
./scripts/deploy.sh -e staging -n llm-staging

# Dry run
./scripts/deploy.sh --dry-run
```

Using kubectl:

```bash
# Apply all manifests
kubectl apply -f deployment/kubernetes/ -n llm-connector-hub

# Check deployment status
kubectl rollout status deployment/llm-connector-hub -n llm-connector-hub
```

Using Makefile:

```bash
# Deploy
make deploy

# Dry run
make deploy-dry-run

# Check status
make k8s-status
```

#### 3. Verify Deployment

```bash
# Check pods
kubectl get pods -n llm-connector-hub

# Check services
kubectl get svc -n llm-connector-hub

# Check ingress
kubectl get ingress -n llm-connector-hub

# View logs
kubectl logs -f deployment/llm-connector-hub -n llm-connector-hub

# Test health endpoint
kubectl port-forward svc/llm-connector-hub-internal 8080:8080 -n llm-connector-hub
curl http://localhost:8080/health
```

### Updating Deployment

```bash
# Update image
kubectl set image deployment/llm-connector-hub \
  llm-connector-hub=llm-connector-hub:v1.1.0 \
  -n llm-connector-hub

# Monitor rollout
kubectl rollout status deployment/llm-connector-hub -n llm-connector-hub

# Rollback if needed
kubectl rollout undo deployment/llm-connector-hub -n llm-connector-hub
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment/llm-connector-hub --replicas=5 -n llm-connector-hub

# Auto-scaling is configured via HPA
# Edit deployment/kubernetes/hpa.yaml to adjust thresholds
```

## Cloud Providers

### AWS EKS

#### Prerequisites

- AWS CLI configured
- eksctl installed
- IAM permissions

#### Create EKS Cluster

```bash
# Create cluster
eksctl create cluster \
  --name llm-connector-hub \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# Configure kubectl
aws eks update-kubeconfig --name llm-connector-hub --region us-east-1
```

#### Deploy to EKS

```bash
# Install AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller//crds?ref=master"

# Deploy application
./scripts/deploy.sh
```

#### EKS-specific Configuration

Update `deployment/kubernetes/ingress.yaml` with ALB annotations:

```yaml
annotations:
  kubernetes.io/ingress.class: alb
  alb.ingress.kubernetes.io/scheme: internet-facing
  alb.ingress.kubernetes.io/target-type: ip
```

### Google Kubernetes Engine (GKE)

#### Create GKE Cluster

```bash
# Create cluster
gcloud container clusters create llm-connector-hub \
  --region us-central1 \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 5

# Get credentials
gcloud container clusters get-credentials llm-connector-hub --region us-central1
```

#### Deploy to GKE

```bash
# Deploy application
./scripts/deploy.sh
```

### Azure Kubernetes Service (AKS)

#### Create AKS Cluster

```bash
# Create resource group
az group create --name llm-connector-hub-rg --location eastus

# Create cluster
az aks create \
  --resource-group llm-connector-hub-rg \
  --name llm-connector-hub \
  --node-count 3 \
  --node-vm-size Standard_D2_v2 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group llm-connector-hub-rg --name llm-connector-hub
```

#### Deploy to AKS

```bash
# Deploy application
./scripts/deploy.sh
```

## CI/CD Pipeline

### GitHub Actions

Three workflows are configured:

#### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and PR:
- Linting
- Type checking
- Tests with coverage
- Build on multiple platforms

#### 2. Release Workflow (`.github/workflows/release.yml`)

Triggered on version tags:
- Build and test
- Publish to npm
- Create GitHub release
- Generate changelog

Usage:
```bash
# Create and push a tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

#### 3. Security Workflow (`.github/workflows/security.yml`)

Runs daily and on every push:
- npm audit
- Snyk vulnerability scanning
- CodeQL analysis
- Secret scanning
- License compliance

### Required Secrets

Configure these in GitHub repository settings:

- `NPM_TOKEN`: For publishing to npm
- `CODECOV_TOKEN`: For coverage reporting
- `SNYK_TOKEN`: For security scanning

### Manual Release

```bash
# Run all checks
make check

# Publish to npm (with dry run first)
make publish-dry-run
make publish

# Tag and push
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## Monitoring & Observability

### Prometheus Metrics

Metrics are exposed at `/metrics` endpoint:

- Request rate and latency
- Provider performance
- Cache hit/miss rates
- Error rates
- Resource usage

### Grafana Dashboards

Pre-configured dashboards for:
- Application metrics
- Redis metrics
- System metrics
- Provider-specific metrics

### Logging

Structured JSON logging with configurable levels:

```bash
# View logs in Kubernetes
kubectl logs -f deployment/llm-connector-hub -n llm-connector-hub

# Stream logs from all pods
kubectl logs -f -l app=llm-connector-hub -n llm-connector-hub

# View logs in Docker
docker logs -f llm-connector-hub
```

### Tracing

OpenTelemetry integration for distributed tracing (optional).

## Security Best Practices

### Secrets Management

1. **Never commit secrets** to version control
2. Use Kubernetes Secrets or external secret managers
3. Rotate API keys regularly
4. Use least-privilege IAM roles

### Network Security

1. Network policies restrict traffic
2. TLS/SSL for all external communication
3. HTTPS-only ingress
4. Private subnets for worker nodes

### Container Security

1. Run as non-root user
2. Read-only root filesystem
3. No privilege escalation
4. Drop all capabilities
5. Regular security scanning

### Image Security

1. Multi-stage builds for minimal images
2. Regular base image updates
3. Vulnerability scanning with Snyk
4. Image signing (optional)

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n llm-connector-hub

# Check logs
kubectl logs <pod-name> -n llm-connector-hub

# Check resource constraints
kubectl top pods -n llm-connector-hub
```

#### Service Unreachable

```bash
# Check service endpoints
kubectl get endpoints -n llm-connector-hub

# Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://llm-connector-hub.llm-connector-hub.svc.cluster.local:8080/health
```

#### High Memory Usage

```bash
# Check memory usage
kubectl top pods -n llm-connector-hub

# Adjust resource limits in deployment.yaml
# Increase NODE_OPTIONS max-old-space-size
```

#### Redis Connection Issues

```bash
# Check Redis pod
kubectl get pods -l app=llm-redis -n llm-connector-hub

# Test Redis connectivity
kubectl exec -it <app-pod> -n llm-connector-hub -- sh
nc -zv llm-redis 6379
```

### Debug Mode

```bash
# Enable debug logging
kubectl set env deployment/llm-connector-hub LOG_LEVEL=debug -n llm-connector-hub

# Port forward for local debugging
kubectl port-forward svc/llm-connector-hub-internal 8080:8080 -n llm-connector-hub
```

### Getting Help

- Check logs: `make k8s-logs`
- Check status: `make k8s-status`
- Open shell: `make k8s-shell`
- GitHub Issues: https://github.com/your-org/llm-connector-hub/issues

## Additional Resources

- [Kubernetes Documentation](deployment/README.md)
- [Docker Configuration](Dockerfile)
- [CI/CD Workflows](.github/workflows/)
- [Scripts](scripts/)
