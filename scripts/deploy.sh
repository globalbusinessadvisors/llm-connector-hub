#!/bin/bash

# Deploy script for LLM Connector Hub
# Deploys to Kubernetes cluster

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
K8S_DIR="${PROJECT_ROOT}/deployment/kubernetes"

# Default values
ENVIRONMENT="production"
NAMESPACE="llm-connector-hub"
DRY_RUN=false
BUILD_IMAGE=false
PUSH_IMAGE=false
IMAGE_TAG="latest"
DOCKER_REGISTRY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -b|--build)
            BUILD_IMAGE=true
            shift
            ;;
        -p|--push)
            PUSH_IMAGE=true
            shift
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -e, --environment <env>  Environment (production|staging|development)"
            echo "  -n, --namespace <ns>     Kubernetes namespace"
            echo "  -d, --dry-run            Perform a dry run"
            echo "  -b, --build              Build Docker image before deploying"
            echo "  -p, --push               Push Docker image to registry"
            echo "  -t, --tag <tag>          Docker image tag (default: latest)"
            echo "  -r, --registry <url>     Docker registry URL"
            echo "  -h, --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Deploy to production"
            echo "  $0 -e staging -n llm-staging          # Deploy to staging"
            echo "  $0 -b -p -t v1.0.0                    # Build, push, and deploy with tag"
            echo "  $0 -d                                 # Dry run"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LLM Connector Hub - Deployer${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Namespace:   ${NAMESPACE}${NC}"
echo -e "${BLUE}Image Tag:   ${IMAGE_TAG}${NC}"
echo ""

# Change to project root
cd "${PROJECT_ROOT}"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl not found${NC}"
    echo -e "${YELLOW}Please install kubectl: https://kubernetes.io/docs/tasks/tools/${NC}"
    exit 1
fi

# Check if cluster is accessible
echo -e "${BLUE}Checking Kubernetes cluster connectivity...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    echo -e "${YELLOW}Please configure kubectl to connect to your cluster${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected to cluster${NC}"
echo ""

# Build Docker image if requested
if [ "$BUILD_IMAGE" = true ]; then
    echo -e "${BLUE}Building Docker image...${NC}"

    IMAGE_NAME="llm-connector-hub:${IMAGE_TAG}"
    if [ -n "$DOCKER_REGISTRY" ]; then
        IMAGE_NAME="${DOCKER_REGISTRY}/llm-connector-hub:${IMAGE_TAG}"
    fi

    docker build -t "${IMAGE_NAME}" -f Dockerfile .

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Docker image built: ${IMAGE_NAME}${NC}"
    else
        echo -e "${RED}Docker build failed!${NC}"
        exit 1
    fi
    echo ""
fi

# Push Docker image if requested
if [ "$PUSH_IMAGE" = true ]; then
    if [ -z "$DOCKER_REGISTRY" ]; then
        echo -e "${RED}Error: Docker registry not specified${NC}"
        echo -e "${YELLOW}Use -r or --registry to specify the registry${NC}"
        exit 1
    fi

    echo -e "${BLUE}Pushing Docker image to registry...${NC}"

    IMAGE_NAME="${DOCKER_REGISTRY}/llm-connector-hub:${IMAGE_TAG}"
    docker push "${IMAGE_NAME}"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Docker image pushed: ${IMAGE_NAME}${NC}"
    else
        echo -e "${RED}Docker push failed!${NC}"
        exit 1
    fi
    echo ""
fi

# Create namespace if it doesn't exist
echo -e "${BLUE}Checking namespace...${NC}"
if kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    echo -e "${GREEN}✓ Namespace '${NAMESPACE}' exists${NC}"
else
    echo -e "${YELLOW}Creating namespace '${NAMESPACE}'...${NC}"
    if [ "$DRY_RUN" = true ]; then
        kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml
    else
        kubectl create namespace "${NAMESPACE}"
    fi
    echo -e "${GREEN}✓ Namespace created${NC}"
fi
echo ""

# Deploy Kubernetes resources
echo -e "${BLUE}Deploying Kubernetes resources...${NC}"
echo ""

RESOURCES=(
    "namespace.yaml"
    "configmap.yaml"
    "secrets.yaml"
    "serviceaccount.yaml"
    "deployment.yaml"
    "service.yaml"
    "hpa.yaml"
    "poddisruptionbudget.yaml"
    "ingress.yaml"
)

KUBECTL_CMD="kubectl apply"
if [ "$DRY_RUN" = true ]; then
    KUBECTL_CMD="${KUBECTL_CMD} --dry-run=client"
fi
KUBECTL_CMD="${KUBECTL_CMD} -n ${NAMESPACE} -f"

for RESOURCE in "${RESOURCES[@]}"; do
    RESOURCE_PATH="${K8S_DIR}/${RESOURCE}"

    if [ ! -f "$RESOURCE_PATH" ]; then
        echo -e "${YELLOW}Warning: ${RESOURCE} not found, skipping...${NC}"
        continue
    fi

    echo -e "${BLUE}Applying ${RESOURCE}...${NC}"
    eval "${KUBECTL_CMD} ${RESOURCE_PATH}"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${RESOURCE} applied${NC}"
    else
        echo -e "${RED}✗ Failed to apply ${RESOURCE}${NC}"
        exit 1
    fi
done

echo ""

# Wait for deployment to be ready (if not dry run)
if [ "$DRY_RUN" = false ]; then
    echo -e "${BLUE}Waiting for deployment to be ready...${NC}"
    kubectl rollout status deployment/llm-connector-hub -n "${NAMESPACE}" --timeout=5m

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Deployment ready${NC}"
    else
        echo -e "${RED}Deployment failed or timed out${NC}"
        echo -e "${YELLOW}Check pod status with: kubectl get pods -n ${NAMESPACE}${NC}"
        exit 1
    fi
    echo ""
fi

# Show deployment status
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Status${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
    echo -e "${BLUE}Pods:${NC}"
    kubectl get pods -n "${NAMESPACE}" -l app=llm-connector-hub
    echo ""

    echo -e "${BLUE}Services:${NC}"
    kubectl get services -n "${NAMESPACE}"
    echo ""

    echo -e "${BLUE}Ingress:${NC}"
    kubectl get ingress -n "${NAMESPACE}"
    echo ""

    echo -e "${BLUE}HPA:${NC}"
    kubectl get hpa -n "${NAMESPACE}"
    echo ""

    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo -e "  View pods:        kubectl get pods -n ${NAMESPACE}${NC}"
    echo -e "  View logs:        kubectl logs -f deployment/llm-connector-hub -n ${NAMESPACE}${NC}"
    echo -e "  Describe pod:     kubectl describe pod <pod-name> -n ${NAMESPACE}${NC}"
    echo -e "  Port forward:     kubectl port-forward svc/llm-connector-hub 8080:80 -n ${NAMESPACE}${NC}"
    echo -e "  Delete resources: kubectl delete -f ${K8S_DIR} -n ${NAMESPACE}${NC}"
else
    echo -e "${YELLOW}Dry run complete - no resources were actually deployed${NC}"
fi

exit 0
