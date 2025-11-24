# LLM Connector Hub - Deployment Guide

This directory contains all deployment configurations and infrastructure-as-code for the LLM Connector Hub.

## Directory Structure

```
deployment/
├── kubernetes/              # Kubernetes manifests
│   ├── namespace.yaml       # Namespace definition
│   ├── configmap.yaml       # Configuration maps
│   ├── secrets.yaml         # Secret templates
│   ├── serviceaccount.yaml  # Service accounts and RBAC
│   ├── deployment.yaml      # Deployment and Redis
│   ├── service.yaml         # Services (LoadBalancer and internal)
│   ├── hpa.yaml             # Horizontal Pod Autoscaler
│   ├── poddisruptionbudget.yaml # Pod disruption budgets
│   └── ingress.yaml         # Ingress and TLS configuration
└── README.md                # This file
```

## Prerequisites

### Required Tools

- **Docker** (v20.10+)
- **kubectl** (v1.24+)
- **Helm** (v3.10+) - Optional but recommended
- **docker-compose** (v2.0+) - For local development

### Kubernetes Cluster

- Kubernetes v1.24+
- Ingress controller (nginx-ingress or AWS ALB)
- cert-manager (for TLS certificates)
- metrics-server (for HPA)

## Quick Start

### Local Development with Docker Compose

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# 2. Start all services
docker-compose up -d

# 3. Check service health
docker-compose ps
curl http://localhost:8080/health

# 4. View logs
docker-compose logs -f llm-connector-hub

# 5. Access Grafana dashboards
open http://localhost:3000
# Username: admin, Password: admin

# 6. Stop services
docker-compose down
```

### Production Deployment to Kubernetes

#### 1. Prepare Environment

```bash
# Set your kubectl context
kubectl config use-context your-production-cluster

# Create namespace
kubectl apply -f kubernetes/namespace.yaml
```

#### 2. Configure Secrets

```bash
# Edit secrets file with your actual API keys
cp kubernetes/secrets.yaml kubernetes/secrets.prod.yaml
# Edit secrets.prod.yaml with real values

# Apply secrets (DO NOT commit this file!)
kubectl apply -f kubernetes/secrets.prod.yaml -n llm-connector-hub

# Or use kubectl directly
kubectl create secret generic llm-connector-hub-secrets \
  --from-literal=OPENAI_API_KEY=sk-... \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-... \
  -n llm-connector-hub
```

#### 3. Deploy Application

```bash
# Using the deploy script
./scripts/deploy.sh

# Or manually
kubectl apply -f kubernetes/ -n llm-connector-hub

# Check deployment status
kubectl rollout status deployment/llm-connector-hub -n llm-connector-hub
```

#### 4. Verify Deployment

```bash
# Check pods
kubectl get pods -n llm-connector-hub

# Check services
kubectl get svc -n llm-connector-hub

# Check ingress
kubectl get ingress -n llm-connector-hub

# View logs
kubectl logs -f deployment/llm-connector-hub -n llm-connector-hub
```

## Deployment Strategies

### Rolling Update (Default)

```bash
# Update deployment with new image
kubectl set image deployment/llm-connector-hub \
  llm-connector-hub=llm-connector-hub:v1.1.0 \
  -n llm-connector-hub

# Monitor rollout
kubectl rollout status deployment/llm-connector-hub -n llm-connector-hub
```

### Blue-Green Deployment

```bash
# 1. Deploy new version with different label
kubectl apply -f kubernetes/deployment-v2.yaml

# 2. Test new version
kubectl port-forward svc/llm-connector-hub-v2 8081:80

# 3. Switch service to new version
kubectl patch svc llm-connector-hub -p '{"spec":{"selector":{"version":"v2"}}}'

# 4. Clean up old version
kubectl delete deployment llm-connector-hub-v1
```

### Canary Deployment

```bash
# 1. Deploy canary with reduced replicas
kubectl apply -f kubernetes/deployment-canary.yaml

# 2. Monitor metrics and errors
kubectl logs -f -l app=llm-connector-hub,version=canary

# 3. Gradually increase canary replicas
kubectl scale deployment/llm-connector-hub-canary --replicas=5

# 4. Once stable, replace main deployment
kubectl apply -f kubernetes/deployment.yaml
kubectl delete deployment llm-connector-hub-canary
```

## Scaling

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment/llm-connector-hub --replicas=5 -n llm-connector-hub
```

### Auto-scaling (HPA)

```bash
# HPA is configured in kubernetes/hpa.yaml
# It automatically scales based on:
# - CPU utilization (target: 70%)
# - Memory utilization (target: 80%)

# Check HPA status
kubectl get hpa -n llm-connector-hub

# Describe HPA
kubectl describe hpa llm-connector-hub-hpa -n llm-connector-hub
```

## Monitoring

### Prometheus Metrics

Metrics are exposed at `/metrics` on port 9090.

```bash
# Port forward to access metrics locally
kubectl port-forward svc/llm-connector-hub 9090:9090 -n llm-connector-hub
curl http://localhost:9090/metrics
```

### Grafana Dashboards

With docker-compose, Grafana is available at http://localhost:3000

### Kubernetes Events

```bash
# Watch events in real-time
kubectl get events -n llm-connector-hub -w

# Get recent events
kubectl get events -n llm-connector-hub --sort-by='.lastTimestamp'
```

## Troubleshooting

### Pod Crashes

```bash
# Check pod status
kubectl get pods -n llm-connector-hub

# Describe pod to see events
kubectl describe pod <pod-name> -n llm-connector-hub

# View logs
kubectl logs <pod-name> -n llm-connector-hub

# View previous container logs (if restarted)
kubectl logs <pod-name> --previous -n llm-connector-hub
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints -n llm-connector-hub

# Test service internally
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://llm-connector-hub.llm-connector-hub.svc.cluster.local:8080/health

# Check ingress
kubectl describe ingress llm-connector-hub-ingress -n llm-connector-hub
```

### High Resource Usage

```bash
# Check resource usage
kubectl top pods -n llm-connector-hub

# Check resource limits
kubectl describe pod <pod-name> -n llm-connector-hub | grep -A 5 Limits

# Adjust resources in deployment.yaml
```

### Connection Issues to Redis

```bash
# Check Redis pod
kubectl get pods -l app=llm-redis -n llm-connector-hub

# Test Redis connection
kubectl exec -it <app-pod> -n llm-connector-hub -- \
  sh -c 'nc -zv llm-redis 6379'
```

## Security

### Secrets Management

**Important**: Never commit secrets to version control!

Options for managing secrets:

1. **kubectl**: Create secrets manually
2. **Sealed Secrets**: Encrypt secrets for git storage
3. **External Secrets Operator**: Sync from AWS Secrets Manager, Vault, etc.
4. **Helm**: Use values.yaml with encryption

### Network Policies

Network policies are configured in `kubernetes/ingress.yaml`:

- Only allow ingress from nginx-ingress namespace
- Allow egress to Redis and external APIs
- Deny all other traffic by default

### Pod Security

- Pods run as non-root user (UID 1001)
- Read-only root filesystem
- No privilege escalation
- All capabilities dropped

## Backup and Disaster Recovery

### Redis Data

```bash
# Create Redis snapshot
kubectl exec -it <redis-pod> -n llm-connector-hub -- redis-cli BGSAVE

# Export data
kubectl exec -it <redis-pod> -n llm-connector-hub -- \
  sh -c 'cat /data/dump.rdb' > redis-backup.rdb

# Restore data
kubectl cp redis-backup.rdb <redis-pod>:/data/dump.rdb -n llm-connector-hub
kubectl delete pod <redis-pod> -n llm-connector-hub
```

### Configuration Backup

```bash
# Export all resources
kubectl get all,configmap,secret,ingress,hpa,pdb \
  -n llm-connector-hub -o yaml > backup.yaml
```

## Performance Tuning

### Redis Optimization

```yaml
# In deployment.yaml, Redis container command:
command:
  - redis-server
  - --maxmemory 512mb
  - --maxmemory-policy allkeys-lru
  - --appendonly yes
  - --tcp-backlog 511
  - --timeout 0
  - --tcp-keepalive 300
```

### Node.js Optimization

```yaml
# Environment variables for performance
env:
  - name: NODE_ENV
    value: production
  - name: NODE_OPTIONS
    value: "--max-old-space-size=512"
  - name: UV_THREADPOOL_SIZE
    value: "128"
```

## Cost Optimization

### Right-sizing Resources

```bash
# Use VPA (Vertical Pod Autoscaler) recommendations
kubectl describe vpa llm-connector-hub-vpa -n llm-connector-hub

# Monitor actual usage
kubectl top pods -n llm-connector-hub
```

### Spot Instances (AWS)

```yaml
# Add to deployment.yaml
spec:
  template:
    spec:
      nodeSelector:
        eks.amazonaws.com/capacityType: SPOT
```

## CI/CD Integration

### GitHub Actions

Automated deployment is configured in `.github/workflows/release.yml`

### Manual Deployment from CI/CD

```bash
# Build and push image
docker build -t your-registry/llm-connector-hub:v1.0.0 .
docker push your-registry/llm-connector-hub:v1.0.0

# Deploy using script
./scripts/deploy.sh -t v1.0.0 -r your-registry
```

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/llm-connector-hub/issues
- Documentation: https://github.com/your-org/llm-connector-hub/docs
