# LLM-Connector-Hub: Workspace Structure

## Complete Project Organization

This document describes the complete workspace structure for the LLM-Connector-Hub project.

---

## Workspace Layout

```
llm-connector-hub/
├── Cargo.toml                      # Workspace root configuration
├── Cargo.lock                      # Dependency lock file
├── README.md                       # Project overview
├── LICENSE                         # MIT or Apache 2.0
├── ARCHITECTURE.md                 # System architecture documentation
├── TRAIT_SPECIFICATIONS.md         # Detailed trait contracts
├── DATA_MODELS.md                  # Data structure specifications
├── IMPLEMENTATION_ROADMAP.md       # Development plan
├── WORKSPACE_STRUCTURE.md          # This file
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Continuous integration
│       ├── security.yml            # Security scanning
│       └── release.yml             # Release automation
│
├── .vscode/
│   ├── settings.json               # VS Code settings
│   ├── launch.json                 # Debug configurations
│   └── tasks.json                  # Build tasks
│
├── config/
│   ├── development.yaml            # Development configuration
│   ├── production.yaml             # Production configuration
│   └── examples/
│       ├── simple.yaml
│       ├── multi-provider.yaml
│       └── microservice.yaml
│
├── crates/                         # Workspace crates
│   ├── llm-connector-core/         # Core traits and models
│   │   ├── Cargo.toml
│   │   ├── README.md
│   │   └── src/
│   │       ├── lib.rs              # Public exports
│   │       ├── traits/
│   │       │   ├── mod.rs
│   │       │   ├── provider.rs     # LLMProvider trait
│   │       │   ├── middleware.rs   # Middleware trait
│   │       │   ├── config.rs       # ProviderConfig trait
│   │       │   ├── cache.rs        # CacheStrategy trait
│   │       │   ├── rate_limit.rs   # RateLimiter trait
│   │       │   └── metrics.rs      # MetricsCollector trait
│   │       ├── models/
│   │       │   ├── mod.rs
│   │       │   ├── request.rs      # CompletionRequest
│   │       │   ├── response.rs     # CompletionResponse
│   │       │   ├── message.rs      # Message, Content, Role
│   │       │   ├── tool.rs         # Tool, Function definitions
│   │       │   ├── stream.rs       # StreamChunk, Delta
│   │       │   ├── metadata.rs     # Provider metadata
│   │       │   └── error.rs        # Error types
│   │       ├── builder/
│   │       │   ├── mod.rs
│   │       │   └── request.rs      # Type-state request builder
│   │       └── types.rs            # Common type aliases
│   │
│   ├── llm-connector-providers/    # Provider implementations
│   │   ├── Cargo.toml
│   │   ├── README.md
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── openai/
│   │       │   ├── mod.rs
│   │       │   ├── client.rs       # OpenAI HTTP client
│   │       │   ├── config.rs       # OpenAI configuration
│   │       │   ├── models.rs       # OpenAI-specific models
│   │       │   ├── transform.rs    # Request/response transformation
│   │       │   ├── error.rs        # Error mapping
│   │       │   ├── streaming.rs    # SSE parsing
│   │       │   └── tests.rs        # Unit tests
│   │       ├── anthropic/
│   │       │   ├── mod.rs
│   │       │   ├── client.rs
│   │       │   ├── config.rs
│   │       │   ├── models.rs
│   │       │   ├── transform.rs
│   │       │   ├── error.rs
│   │       │   ├── streaming.rs
│   │       │   └── tests.rs
│   │       ├── google/
│   │       │   ├── mod.rs
│   │       │   ├── client.rs
│   │       │   ├── config.rs
│   │       │   └── ... (similar structure)
│   │       ├── aws_bedrock/
│   │       │   ├── mod.rs
│   │       │   ├── client.rs
│   │       │   ├── config.rs
│   │       │   ├── auth.rs         # AWS SigV4 signing
│   │       │   └── ... (similar structure)
│   │       ├── azure/
│   │       │   └── ... (similar structure)
│   │       ├── common/
│   │       │   ├── mod.rs
│   │       │   ├── http.rs         # Shared HTTP utilities
│   │       │   └── stream.rs       # Stream parsing utilities
│   │       └── tests/
│   │           ├── fixtures/       # Test data
│   │           └── integration.rs
│   │
│   ├── llm-connector-middleware/   # Middleware implementations
│   │   ├── Cargo.toml
│   │   ├── README.md
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── auth.rs             # Authentication middleware
│   │       ├── retry.rs            # Retry with backoff
│   │       ├── logging.rs          # Structured logging
│   │       ├── rate_limit.rs       # Rate limiting
│   │       ├── metrics.rs          # Metrics collection
│   │       ├── circuit_breaker.rs  # Circuit breaker pattern
│   │       ├── sanitize.rs         # Data sanitization
│   │       └── tests/
│   │
│   ├── llm-connector-hub/          # Hub orchestrator
│   │   ├── Cargo.toml
│   │   ├── README.md
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── hub.rs              # ConnectorHub implementation
│   │       ├── builder.rs          # Hub builder
│   │       ├── config.rs           # Hub configuration
│   │       ├── registry/
│   │       │   ├── mod.rs
│   │       │   └── provider.rs     # Provider registry
│   │       ├── cache/
│   │       │   ├── mod.rs
│   │       │   ├── memory.rs       # In-memory LRU cache
│   │       │   ├── redis.rs        # Redis cache
│   │       │   └── key.rs          # Cache key generation
│   │       ├── rate_limit/
│   │       │   ├── mod.rs
│   │       │   ├── token_bucket.rs # Token bucket limiter
│   │       │   ├── fixed_window.rs # Fixed window limiter
│   │       │   └── sliding_window.rs
│   │       ├── selector/
│   │       │   ├── mod.rs
│   │       │   ├── cost.rs         # Cost-based selection
│   │       │   ├── latency.rs      # Latency-based selection
│   │       │   ├── round_robin.rs  # Round-robin selection
│   │       │   └── failover.rs     # Failover selection
│   │       ├── plugin/
│   │       │   ├── mod.rs
│   │       │   ├── registry.rs     # Plugin registry
│   │       │   └── lifecycle.rs    # Plugin lifecycle
│   │       ├── security/
│   │       │   ├── mod.rs
│   │       │   ├── credentials.rs  # Credential management
│   │       │   ├── vault.rs        # Vault integration
│   │       │   └── signing.rs      # Request signing
│   │       └── tests/
│   │
│   └── llm-connector-service/      # Standalone service
│       ├── Cargo.toml
│       ├── README.md
│       ├── build.rs                # Build script (proto compilation)
│       ├── proto/
│       │   └── llm_service.proto   # gRPC protocol definition
│       └── src/
│           ├── main.rs             # Service entry point
│           ├── config.rs           # Service configuration
│           ├── api/
│           │   ├── mod.rs
│           │   ├── rest.rs         # REST API (Axum)
│           │   ├── grpc.rs         # gRPC service (Tonic)
│           │   ├── handlers.rs     # Request handlers
│           │   └── middleware.rs   # HTTP middleware
│           ├── observability/
│           │   ├── mod.rs
│           │   ├── logging.rs      # Structured logging setup
│           │   ├── metrics.rs      # Prometheus metrics
│           │   └── tracing.rs      # OpenTelemetry tracing
│           └── tests/
│               ├── api_test.rs
│               └── integration_test.rs
│
├── examples/                       # Usage examples
│   ├── simple_completion.rs        # Basic usage
│   ├── streaming.rs                # Streaming example
│   ├── provider_switching.rs       # Runtime provider selection
│   ├── custom_middleware.rs        # Custom middleware
│   ├── custom_provider.rs          # Custom provider plugin
│   ├── batch_processing.rs         # Batch requests
│   ├── cost_optimization.rs        # Cost-based selection
│   └── microservice/
│       └── main.rs                 # Full microservice example
│
├── tests/                          # Integration tests
│   ├── common/
│   │   ├── mod.rs
│   │   └── fixtures.rs             # Test fixtures
│   ├── providers/
│   │   ├── openai_test.rs
│   │   ├── anthropic_test.rs
│   │   └── ... (other providers)
│   ├── middleware_test.rs
│   ├── hub_test.rs
│   └── end_to_end_test.rs
│
├── benches/                        # Performance benchmarks
│   ├── request_throughput.rs
│   ├── latency.rs
│   ├── cache_performance.rs
│   └── serialization.rs
│
├── deployment/                     # Deployment configurations
│   ├── docker/
│   │   ├── Dockerfile              # Service container
│   │   ├── Dockerfile.dev          # Development container
│   │   └── docker-compose.yml      # Multi-service setup
│   ├── kubernetes/
│   │   ├── namespace.yaml
│   │   ├── deployment.yaml         # Service deployment
│   │   ├── service.yaml            # Service exposure
│   │   ├── configmap.yaml          # Configuration
│   │   ├── secret.yaml             # Secrets (example)
│   │   ├── hpa.yaml                # Horizontal Pod Autoscaler
│   │   └── ingress.yaml            # Ingress configuration
│   ├── helm/
│   │   └── llm-connector/
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       └── templates/
│   │           ├── deployment.yaml
│   │           ├── service.yaml
│   │           ├── configmap.yaml
│   │           └── ... (other resources)
│   └── terraform/
│       ├── main.tf                 # Infrastructure as code
│       ├── variables.tf
│       └── outputs.tf
│
├── docs/                           # Documentation
│   ├── README.md
│   ├── getting-started.md
│   ├── user-guide/
│   │   ├── README.md
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   ├── providers.md
│   │   ├── middleware.md
│   │   ├── plugins.md
│   │   └── troubleshooting.md
│   ├── api/
│   │   ├── README.md
│   │   ├── rest-api.md             # REST API reference
│   │   ├── grpc-api.md             # gRPC API reference
│   │   └── library-api.md          # Rust library API
│   ├── deployment/
│   │   ├── README.md
│   │   ├── docker.md
│   │   ├── kubernetes.md
│   │   ├── aws.md
│   │   ├── azure.md
│   │   └── gcp.md
│   ├── development/
│   │   ├── README.md
│   │   ├── contributing.md
│   │   ├── testing.md
│   │   ├── benchmarking.md
│   │   └── releasing.md
│   ├── examples/
│   │   ├── README.md
│   │   ├── basic-usage.md
│   │   ├── streaming.md
│   │   ├── custom-provider.md
│   │   └── production-setup.md
│   ├── diagrams/
│   │   ├── architecture.png
│   │   ├── request-flow.png
│   │   ├── deployment.png
│   │   └── ... (other diagrams)
│   └── adr/                        # Architecture Decision Records
│       ├── 0001-trait-based-design.md
│       ├── 0002-async-first.md
│       ├── 0003-provider-selection.md
│       └── ... (other ADRs)
│
├── scripts/                        # Utility scripts
│   ├── setup-dev.sh                # Development environment setup
│   ├── run-tests.sh                # Test runner
│   ├── benchmark.sh                # Run benchmarks
│   ├── generate-docs.sh            # Documentation generation
│   ├── release.sh                  # Release automation
│   └── security-audit.sh           # Security scanning
│
└── tools/                          # Development tools
    ├── mock-server/                # Mock LLM API server for testing
    │   ├── Cargo.toml
    │   └── src/
    │       └── main.rs
    └── load-test/                  # Load testing tool
        ├── Cargo.toml
        └── src/
            └── main.rs
```

---

## Crate Dependencies

### Internal Dependencies

```
llm-connector-core (foundation)
    ↓
    ├── llm-connector-providers (uses core traits)
    ├── llm-connector-middleware (uses core traits)
    └── llm-connector-hub (uses all above)
            ↓
        llm-connector-service (uses hub)
```

### External Dependencies by Crate

#### llm-connector-core
```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
async-trait = "0.1"
futures = "0.3"
```

#### llm-connector-providers
```toml
[dependencies]
llm-connector-core = { path = "../llm-connector-core" }
reqwest = { version = "0.11", features = ["json", "stream"] }
tokio = { version = "1.35", features = ["full"] }
async-trait = "0.1"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
futures = "0.3"
tracing = "0.1"
url = "2.4"

# AWS Bedrock specific
aws-config = { version = "1.0", optional = true }
aws-sdk-bedrockruntime = { version = "1.0", optional = true }
```

#### llm-connector-middleware
```toml
[dependencies]
llm-connector-core = { path = "../llm-connector-core" }
async-trait = "0.1"
tokio = { version = "1.35", features = ["full"] }
tracing = "0.1"
uuid = { version = "1.6", features = ["v4"] }
regex = "1.10"
```

#### llm-connector-hub
```toml
[dependencies]
llm-connector-core = { path = "../llm-connector-core" }
llm-connector-providers = { path = "../llm-connector-providers" }
llm-connector-middleware = { path = "../llm-connector-middleware" }
tokio = { version = "1.35", features = ["full"] }
async-trait = "0.1"
lru = "0.12"
redis = { version = "0.24", optional = true }
sha2 = "0.10"
hmac = "0.12"
secrecy = "0.8"
vaultrs = { version = "0.7", optional = true }
```

#### llm-connector-service
```toml
[dependencies]
llm-connector-hub = { path = "../llm-connector-hub" }
tokio = { version = "1.35", features = ["full"] }
axum = "0.7"
tonic = "0.11"
prost = "0.12"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "compression"] }
serde = { version = "1.0", features = ["derive"] }
serde_yaml = "0.9"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
opentelemetry = "0.21"
opentelemetry-otlp = "0.14"
prometheus = "0.13"

[build-dependencies]
tonic-build = "0.11"
```

---

## File Size Estimates

| Directory | Estimated Files | Est. Lines of Code |
|-----------|-----------------|-------------------|
| llm-connector-core | 15-20 | 3,000-4,000 |
| llm-connector-providers | 30-40 | 6,000-8,000 |
| llm-connector-middleware | 10-15 | 2,000-3,000 |
| llm-connector-hub | 20-25 | 4,000-5,000 |
| llm-connector-service | 15-20 | 2,000-3,000 |
| tests | 15-20 | 2,000-3,000 |
| examples | 8-10 | 1,000-1,500 |
| **Total** | **113-150** | **20,000-27,500** |

---

## Development Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/llm-connector-hub
cd llm-connector-hub

# Run setup script
./scripts/setup-dev.sh

# Build workspace
cargo build --workspace
```

### 2. Development Cycle
```bash
# Make changes to code

# Run tests
cargo test --workspace

# Run clippy
cargo clippy --workspace -- -D warnings

# Format code
cargo fmt --all

# Run benchmarks
./scripts/benchmark.sh
```

### 3. Adding a New Provider
```bash
# Create provider module
mkdir -p crates/llm-connector-providers/src/newprovider

# Implement provider files
# - mod.rs (exports)
# - client.rs (HTTP client)
# - config.rs (configuration)
# - models.rs (provider-specific models)
# - transform.rs (request/response transformation)
# - tests.rs (unit tests)

# Add integration tests
touch tests/providers/newprovider_test.rs

# Update documentation
# Add to docs/user-guide/providers.md
```

### 4. Release Process
```bash
# Update version in Cargo.toml files
./scripts/release.sh --version 0.2.0

# Run full test suite
cargo test --workspace --all-features

# Build release
cargo build --release --workspace

# Generate documentation
cargo doc --workspace --no-deps

# Tag release
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
```

---

## Configuration Management

### Development Configuration
Location: `config/development.yaml`

```yaml
providers:
  - provider_id: openai
    enabled: true
    config:
      api_key: ${OPENAI_API_KEY}
      base_url: https://api.openai.com/v1
      timeout_secs: 30

middleware:
  enable_retry: true
  retry_max_attempts: 3
  enable_logging: true

cache:
  type: memory
  max_entries: 1000
  ttl_secs: 3600
```

### Production Configuration
Location: `config/production.yaml`

```yaml
providers:
  - provider_id: openai
    enabled: true
    config:
      api_key: ${OPENAI_API_KEY}

  - provider_id: anthropic
    enabled: true
    config:
      api_key: ${ANTHROPIC_API_KEY}

middleware:
  enable_auth: true
  enable_retry: true
  retry_max_attempts: 5
  enable_logging: true
  enable_rate_limiting: true

cache:
  type: redis
  url: redis://redis:6379
  ttl_secs: 7200

observability:
  enable_tracing: true
  enable_metrics: true
  tracing_endpoint: http://otel-collector:4317
  metrics_endpoint: http://prometheus:9090
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**`.github/workflows/ci.yml`**:
- Trigger: Push to main, pull requests
- Jobs:
  1. Lint (rustfmt, clippy)
  2. Test (all platforms: Linux, macOS, Windows)
  3. Coverage (using cargo-tarpaulin)
  4. Security audit (cargo-audit)
  5. Build documentation
  6. Benchmark (on main branch only)

**`.github/workflows/release.yml`**:
- Trigger: Tagged release (v*)
- Jobs:
  1. Build release binaries
  2. Create Docker image
  3. Publish to crates.io
  4. Create GitHub release
  5. Deploy documentation

---

This workspace structure provides a comprehensive, well-organized foundation for the LLM-Connector-Hub project, supporting both library and service deployment modes with clear separation of concerns and scalability.
