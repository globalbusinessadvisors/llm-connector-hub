# Makefile for LLM Connector Hub
# Provides convenient commands for development, testing, and deployment

.PHONY: help install clean build test lint format typecheck docker-build docker-up docker-down deploy

# Variables
DOCKER_REGISTRY ?=
IMAGE_NAME = llm-connector-hub
IMAGE_TAG ?= latest
K8S_NAMESPACE = llm-connector-hub
ENVIRONMENT ?= production

# Colors for output
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[1;33m
NC = \033[0m # No Color

## help: Show this help message
help:
	@echo "$(BLUE)LLM Connector Hub - Available Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make install          - Install dependencies"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make build            - Build all packages"
	@echo "  make build-prod       - Build for production"
	@echo "  make dev              - Start development environment"
	@echo ""
	@echo "$(GREEN)Testing & Quality:$(NC)"
	@echo "  make test             - Run all tests"
	@echo "  make test-coverage    - Run tests with coverage"
	@echo "  make test-watch       - Run tests in watch mode"
	@echo "  make lint             - Run linter"
	@echo "  make lint-fix         - Fix linting issues"
	@echo "  make format           - Format code"
	@echo "  make typecheck        - Run TypeScript type checking"
	@echo "  make check            - Run all checks (lint, typecheck, test)"
	@echo ""
	@echo "$(GREEN)Docker:$(NC)"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-push      - Push Docker image to registry"
	@echo "  make docker-up        - Start docker-compose services"
	@echo "  make docker-down      - Stop docker-compose services"
	@echo "  make docker-logs      - View docker-compose logs"
	@echo ""
	@echo "$(GREEN)Deployment:$(NC)"
	@echo "  make deploy           - Deploy to Kubernetes"
	@echo "  make deploy-dry-run   - Dry run deployment"
	@echo "  make k8s-status       - Check Kubernetes deployment status"
	@echo "  make k8s-logs         - View Kubernetes logs"
	@echo "  make k8s-shell        - Open shell in running pod"
	@echo ""
	@echo "$(GREEN)Release:$(NC)"
	@echo "  make publish          - Publish packages to npm"
	@echo "  make publish-dry-run  - Dry run publish"
	@echo ""
	@echo "$(GREEN)Utilities:$(NC)"
	@echo "  make scripts-exec     - Make all scripts executable"
	@echo "  make verify           - Verify environment setup"

## install: Install dependencies
install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm ci

## clean: Clean build artifacts
clean:
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	npm run clean
	rm -rf packages/*/dist
	rm -rf packages/*/build
	rm -rf packages/*/*.tsbuildinfo
	rm -rf coverage

## build: Build all packages
build:
	@echo "$(BLUE)Building packages...$(NC)"
	./scripts/build.sh

## build-prod: Build for production
build-prod:
	@echo "$(BLUE)Building packages for production...$(NC)"
	./scripts/build.sh --production

## dev: Start development environment
dev:
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker-compose up

## test: Run all tests
test:
	@echo "$(BLUE)Running tests...$(NC)"
	./scripts/test.sh

## test-coverage: Run tests with coverage
test-coverage:
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	./scripts/test.sh --coverage

## test-watch: Run tests in watch mode
test-watch:
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	./scripts/test.sh --watch

## lint: Run linter
lint:
	@echo "$(BLUE)Running linter...$(NC)"
	./scripts/lint.sh

## lint-fix: Fix linting issues
lint-fix:
	@echo "$(BLUE)Fixing linting issues...$(NC)"
	./scripts/lint.sh --fix

## format: Format code
format:
	@echo "$(BLUE)Formatting code...$(NC)"
	./scripts/lint.sh --format

## typecheck: Run TypeScript type checking
typecheck:
	@echo "$(BLUE)Running type checking...$(NC)"
	npm run typecheck

## check: Run all checks
check: lint typecheck test
	@echo "$(GREEN)All checks passed!$(NC)"

## docker-build: Build Docker image
docker-build:
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	@if [ -n "$(DOCKER_REGISTRY)" ]; then \
		docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG); \
	fi

## docker-push: Push Docker image to registry
docker-push:
	@if [ -z "$(DOCKER_REGISTRY)" ]; then \
		echo "$(YELLOW)Error: DOCKER_REGISTRY not set$(NC)"; \
		echo "Usage: make docker-push DOCKER_REGISTRY=your-registry.com"; \
		exit 1; \
	fi
	@echo "$(BLUE)Pushing Docker image...$(NC)"
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

## docker-up: Start docker-compose services
docker-up:
	@echo "$(BLUE)Starting docker-compose services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "$(BLUE)Health check: http://localhost:8080/health$(NC)"
	@echo "$(BLUE)Grafana: http://localhost:3000$(NC)"

## docker-down: Stop docker-compose services
docker-down:
	@echo "$(BLUE)Stopping docker-compose services...$(NC)"
	docker-compose down

## docker-logs: View docker-compose logs
docker-logs:
	docker-compose logs -f llm-connector-hub

## deploy: Deploy to Kubernetes
deploy:
	@echo "$(BLUE)Deploying to Kubernetes...$(NC)"
	./scripts/deploy.sh -e $(ENVIRONMENT) -n $(K8S_NAMESPACE)

## deploy-dry-run: Dry run deployment
deploy-dry-run:
	@echo "$(BLUE)Dry run deployment...$(NC)"
	./scripts/deploy.sh -e $(ENVIRONMENT) -n $(K8S_NAMESPACE) --dry-run

## k8s-status: Check Kubernetes deployment status
k8s-status:
	@echo "$(BLUE)Checking deployment status...$(NC)"
	kubectl get all -n $(K8S_NAMESPACE)

## k8s-logs: View Kubernetes logs
k8s-logs:
	kubectl logs -f deployment/llm-connector-hub -n $(K8S_NAMESPACE)

## k8s-shell: Open shell in running pod
k8s-shell:
	kubectl exec -it deployment/llm-connector-hub -n $(K8S_NAMESPACE) -- /bin/sh

## publish: Publish packages to npm
publish:
	@echo "$(BLUE)Publishing packages...$(NC)"
	./scripts/publish.sh

## publish-dry-run: Dry run publish
publish-dry-run:
	@echo "$(BLUE)Dry run publish...$(NC)"
	./scripts/publish.sh --dry-run

## scripts-exec: Make all scripts executable
scripts-exec:
	@echo "$(BLUE)Making scripts executable...$(NC)"
	chmod +x scripts/*.sh
	@echo "$(GREEN)Done!$(NC)"

## verify: Verify environment setup
verify:
	@echo "$(BLUE)Verifying environment setup...$(NC)"
	@echo ""
	@echo "Node.js version:"
	@node --version || echo "$(YELLOW)Node.js not found$(NC)"
	@echo ""
	@echo "npm version:"
	@npm --version || echo "$(YELLOW)npm not found$(NC)"
	@echo ""
	@echo "Docker version:"
	@docker --version || echo "$(YELLOW)Docker not found$(NC)"
	@echo ""
	@echo "kubectl version:"
	@kubectl version --client --short 2>/dev/null || echo "$(YELLOW)kubectl not found$(NC)"
	@echo ""
	@echo "$(GREEN)Verification complete!$(NC)"

# Default target
.DEFAULT_GOAL := help
