# LLM-Connector-Hub Architecture Design

## Executive Summary

LLM-Connector-Hub is a unified Rust framework for interfacing with multiple Large Language Model providers (OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI, etc.). The system provides a trait-based abstraction layer enabling seamless provider switching, consistent error handling, request/response normalization, and extensible middleware pipelines.

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Component Design](#component-design)
4. [Data Models](#data-models)
5. [Deployment Architectures](#deployment-architectures)
6. [Extensibility & Plugins](#extensibility--plugins)
7. [Performance & Optimization](#performance--optimization)
8. [Security Architecture](#security-architecture)
9. [SPARC Framework Alignment](#sparc-framework-alignment)

---

## 1. System Overview

### 1.1 Architectural Principles

- **Modularity**: Each LLM provider is an independent, pluggable connector
- **Trait-Based Polymorphism**: Core abstractions defined via Rust traits
- **Type Safety**: Leverage Rust's type system for compile-time guarantees
- **Async-First**: Full async/await support for high-performance I/O
- **Zero-Cost Abstractions**: Minimal runtime overhead
- **Extensibility**: Plugin architecture for custom providers and middleware

### 1.2 Component Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ CLI Client   │  │ REST Service │  │ gRPC Service │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────────┐
│                            ▼  Connector Hub Core                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              ConnectorHub (Orchestrator)                       │ │
│  │  - Provider Registry  - Request Router  - Response Normalizer │ │
│  └────────┬───────────────────────────────────────────┬───────────┘ │
│           │                                           │             │
│  ┌────────▼───────────┐                    ┌──────────▼──────────┐  │
│  │ Middleware Pipeline│                    │  Cache Manager      │  │
│  │ - Auth Interceptor │                    │  - Metadata Cache   │  │
│  │ - Retry Logic      │                    │  - Response Cache   │  │
│  │ - Rate Limiter     │                    │  - Connection Pool  │  │
│  │ - Logging/Metrics  │                    └─────────────────────┘  │
│  └────────┬───────────┘                                             │
└───────────┼─────────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                   Provider Connector Layer                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │  OpenAI    │ │ Anthropic  │ │  Google    │ │   Azure    │       │
│  │ Connector  │ │ Connector  │ │ Connector  │ │  Connector │  ...  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘       │
│        │              │              │              │               │
│  ┌─────▼──────────────▼──────────────▼──────────────▼──────┐       │
│  │         Unified Provider Trait (LLMProvider)            │       │
│  │  - send_completion()  - stream_completion()             │       │
│  │  - get_metadata()     - validate_config()               │       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                    Transport & Protocol Layer                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                      │
│  │   HTTP/2   │ │  Reqwest   │ │   TLS/SSL  │                      │
│  └────────────┘ └────────────┘ └────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architecture

### 2.1 Trait Hierarchy

#### 2.1.1 Primary Traits

```rust
/// Core trait that all LLM providers must implement
#[async_trait]
pub trait LLMProvider: Send + Sync {
    /// Provider identifier (e.g., "openai", "anthropic")
    fn provider_id(&self) -> &str;

    /// Send a completion request
    async fn send_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, ConnectorError>;

    /// Stream completion tokens
    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<'static, Result<StreamChunk, ConnectorError>>, ConnectorError>;

    /// Get provider metadata (models, limits, pricing)
    async fn get_metadata(&self) -> Result<ProviderMetadata, ConnectorError>;

    /// Validate configuration
    fn validate_config(&self, config: &ProviderConfig) -> Result<(), ConfigError>;

    /// Health check
    async fn health_check(&self) -> Result<HealthStatus, ConnectorError>;
}

/// Configuration trait for provider-specific settings
pub trait ProviderConfig: Clone + Send + Sync + Debug {
    /// Provider this config belongs to
    fn provider_id(&self) -> &str;

    /// Validate configuration
    fn validate(&self) -> Result<(), ConfigError>;

    /// Convert to generic config map
    fn to_config_map(&self) -> HashMap<String, String>;
}

/// Middleware trait for request/response interception
#[async_trait]
pub trait Middleware: Send + Sync {
    /// Process request before sending to provider
    async fn on_request(
        &self,
        request: &mut CompletionRequest,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError>;

    /// Process response after receiving from provider
    async fn on_response(
        &self,
        response: &mut CompletionResponse,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError>;

    /// Handle errors
    async fn on_error(
        &self,
        error: &ConnectorError,
        ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError>;
}

/// Plugin trait for extending functionality
pub trait ConnectorPlugin: Send + Sync {
    /// Plugin identifier
    fn plugin_id(&self) -> &str;

    /// Initialize plugin
    fn initialize(&mut self, hub: &ConnectorHub) -> Result<(), PluginError>;

    /// Shutdown hook
    fn shutdown(&mut self) -> Result<(), PluginError>;
}
```

#### 2.1.2 Supporting Traits

```rust
/// Trait for caching strategies
#[async_trait]
pub trait CacheStrategy: Send + Sync {
    async fn get(&self, key: &str) -> Option<Vec<u8>>;
    async fn set(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError>;
    async fn invalidate(&self, key: &str) -> Result<(), CacheError>;
}

/// Trait for rate limiting strategies
#[async_trait]
pub trait RateLimiter: Send + Sync {
    async fn check_limit(&self, provider: &str) -> Result<(), RateLimitError>;
    async fn update_usage(&self, provider: &str, tokens: usize) -> Result<(), RateLimitError>;
}

/// Trait for metrics collection
pub trait MetricsCollector: Send + Sync {
    fn record_request(&self, provider: &str, latency_ms: u64);
    fn record_tokens(&self, provider: &str, input_tokens: usize, output_tokens: usize);
    fn record_error(&self, provider: &str, error_type: &str);
}
```

### 2.2 Type-State Pattern for Request Building

```rust
/// Type-state pattern for safe request construction
pub struct RequestBuilder<State> {
    inner: CompletionRequestInner,
    _state: PhantomData<State>,
}

/// States for type-state pattern
pub struct NoModel;
pub struct WithModel;
pub struct Ready;

impl RequestBuilder<NoModel> {
    pub fn new() -> Self {
        Self {
            inner: CompletionRequestInner::default(),
            _state: PhantomData,
        }
    }

    pub fn model(self, model: impl Into<String>) -> RequestBuilder<WithModel> {
        RequestBuilder {
            inner: CompletionRequestInner {
                model: model.into(),
                ..self.inner
            },
            _state: PhantomData,
        }
    }
}

impl RequestBuilder<WithModel> {
    pub fn messages(mut self, messages: Vec<Message>) -> RequestBuilder<Ready> {
        self.inner.messages = messages;
        RequestBuilder {
            inner: self.inner,
            _state: PhantomData,
        }
    }
}

impl RequestBuilder<Ready> {
    pub fn temperature(mut self, temp: f32) -> Self {
        self.inner.temperature = Some(temp);
        self
    }

    pub fn max_tokens(mut self, tokens: usize) -> Self {
        self.inner.max_tokens = Some(tokens);
        self
    }

    pub fn build(self) -> CompletionRequest {
        CompletionRequest(self.inner)
    }
}
```

---

## 3. Component Design

### 3.1 ConnectorHub (Orchestrator)

The central orchestrator managing provider lifecycle and request routing.

```rust
/// Main entry point for the connector hub
pub struct ConnectorHub {
    /// Registry of available providers
    providers: Arc<RwLock<HashMap<String, Arc<dyn LLMProvider>>>>,

    /// Middleware pipeline
    middleware: Arc<Vec<Arc<dyn Middleware>>>,

    /// Cache manager
    cache: Arc<dyn CacheStrategy>,

    /// Rate limiter
    rate_limiter: Arc<dyn RateLimiter>,

    /// Metrics collector
    metrics: Arc<dyn MetricsCollector>,

    /// Configuration
    config: Arc<HubConfig>,
}

impl ConnectorHub {
    /// Builder pattern for hub construction
    pub fn builder() -> ConnectorHubBuilder {
        ConnectorHubBuilder::default()
    }

    /// Register a provider
    pub async fn register_provider(
        &self,
        provider: Arc<dyn LLMProvider>,
    ) -> Result<(), HubError> {
        let provider_id = provider.provider_id().to_string();
        self.providers.write().await.insert(provider_id, provider);
        Ok(())
    }

    /// Get provider by ID
    pub async fn get_provider(&self, provider_id: &str) -> Option<Arc<dyn LLMProvider>> {
        self.providers.read().await.get(provider_id).cloned()
    }

    /// Send completion request (with middleware pipeline)
    pub async fn send_completion(
        &self,
        provider_id: &str,
        mut request: CompletionRequest,
    ) -> Result<CompletionResponse, ConnectorError> {
        // Get provider
        let provider = self.get_provider(provider_id)
            .await
            .ok_or_else(|| ConnectorError::ProviderNotFound(provider_id.to_string()))?;

        // Rate limiting check
        self.rate_limiter.check_limit(provider_id).await?;

        // Middleware: on_request
        let mut ctx = MiddlewareContext::new(provider_id);
        for middleware in self.middleware.iter() {
            middleware.on_request(&mut request, &mut ctx).await?;
        }

        // Check cache
        if let Some(cached) = self.check_cache(&request).await? {
            return Ok(cached);
        }

        // Send to provider
        let start = Instant::now();
        let result = provider.send_completion(request.clone()).await;
        let latency = start.elapsed().as_millis() as u64;

        // Handle result
        match result {
            Ok(mut response) => {
                // Middleware: on_response
                for middleware in self.middleware.iter() {
                    middleware.on_response(&mut response, &mut ctx).await?;
                }

                // Update cache
                self.update_cache(&request, &response).await?;

                // Metrics
                self.metrics.record_request(provider_id, latency);
                self.metrics.record_tokens(
                    provider_id,
                    response.usage.input_tokens,
                    response.usage.output_tokens,
                );

                Ok(response)
            }
            Err(error) => {
                // Middleware: on_error
                for middleware in self.middleware.iter() {
                    match middleware.on_error(&error, &mut ctx).await? {
                        ErrorAction::Retry => {
                            // Handle retry logic
                        }
                        ErrorAction::Fallback(fallback_provider) => {
                            // Try fallback provider
                            return self.send_completion(&fallback_provider, request).await;
                        }
                        ErrorAction::Propagate => {}
                    }
                }

                self.metrics.record_error(provider_id, error.error_type());
                Err(error)
            }
        }
    }

    /// Stream completion with middleware
    pub async fn stream_completion(
        &self,
        provider_id: &str,
        request: CompletionRequest,
    ) -> Result<BoxStream<'static, Result<StreamChunk, ConnectorError>>, ConnectorError> {
        let provider = self.get_provider(provider_id)
            .await
            .ok_or_else(|| ConnectorError::ProviderNotFound(provider_id.to_string()))?;

        provider.stream_completion(request).await
    }
}
```

### 3.2 Provider Connector Implementation Pattern

Each provider follows a consistent implementation pattern:

```rust
/// Example: OpenAI connector
pub struct OpenAIConnector {
    config: OpenAIConfig,
    client: reqwest::Client,
    base_url: String,
}

impl OpenAIConnector {
    pub fn new(config: OpenAIConfig) -> Result<Self, ConfigError> {
        config.validate()?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .pool_max_idle_per_host(10)
            .build()
            .map_err(|e| ConfigError::HttpClientError(e.to_string()))?;

        Ok(Self {
            config,
            client,
            base_url: "https://api.openai.com/v1".to_string(),
        })
    }
}

#[async_trait]
impl LLMProvider for OpenAIConnector {
    fn provider_id(&self) -> &str {
        "openai"
    }

    async fn send_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, ConnectorError> {
        // Transform unified request to OpenAI format
        let openai_request = self.transform_request(&request)?;

        // Send HTTP request
        let response = self.client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .json(&openai_request)
            .send()
            .await
            .map_err(|e| ConnectorError::NetworkError(e.to_string()))?;

        // Handle errors
        if !response.status().is_success() {
            return Err(self.handle_error_response(response).await?);
        }

        // Parse response
        let openai_response: OpenAIChatResponse = response.json().await
            .map_err(|e| ConnectorError::ParseError(e.to_string()))?;

        // Transform to unified format
        self.transform_response(openai_response)
    }

    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<'static, Result<StreamChunk, ConnectorError>>, ConnectorError> {
        let mut openai_request = self.transform_request(&request)?;
        openai_request.stream = true;

        let response = self.client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .json(&openai_request)
            .send()
            .await
            .map_err(|e| ConnectorError::NetworkError(e.to_string()))?;

        let stream = response.bytes_stream()
            .map_err(|e| ConnectorError::StreamError(e.to_string()))
            .map(|chunk_result| {
                chunk_result.and_then(|chunk| self.parse_stream_chunk(chunk))
            });

        Ok(Box::pin(stream))
    }

    async fn get_metadata(&self) -> Result<ProviderMetadata, ConnectorError> {
        Ok(ProviderMetadata {
            provider_id: "openai".to_string(),
            models: vec![
                ModelInfo {
                    id: "gpt-4".to_string(),
                    max_tokens: 8192,
                    supports_streaming: true,
                    supports_functions: true,
                    pricing: Pricing {
                        input_per_1k_tokens: 0.03,
                        output_per_1k_tokens: 0.06,
                    },
                },
                // ... more models
            ],
            rate_limits: RateLimits {
                requests_per_minute: 3500,
                tokens_per_minute: 90000,
            },
            api_version: "v1".to_string(),
        })
    }

    fn validate_config(&self, config: &ProviderConfig) -> Result<(), ConfigError> {
        // Validation logic
        Ok(())
    }

    async fn health_check(&self) -> Result<HealthStatus, ConnectorError> {
        let response = self.client
            .get(format!("{}/models", self.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => Ok(HealthStatus::Healthy),
            Ok(_) => Ok(HealthStatus::Degraded),
            Err(_) => Ok(HealthStatus::Unhealthy),
        }
    }
}
```

### 3.3 Middleware Components

```rust
/// Authentication middleware
pub struct AuthMiddleware {
    credentials: Arc<RwLock<HashMap<String, Credentials>>>,
}

#[async_trait]
impl Middleware for AuthMiddleware {
    async fn on_request(
        &self,
        request: &mut CompletionRequest,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        // Inject authentication headers
        if let Some(creds) = self.credentials.read().await.get(ctx.provider_id) {
            ctx.metadata.insert("auth_type".to_string(), creds.auth_type.clone());
        }
        Ok(())
    }

    async fn on_response(
        &self,
        _response: &mut CompletionResponse,
        _ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        Ok(())
    }

    async fn on_error(
        &self,
        error: &ConnectorError,
        _ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError> {
        if matches!(error, ConnectorError::AuthenticationError(_)) {
            // Potentially refresh token
        }
        Ok(ErrorAction::Propagate)
    }
}

/// Retry middleware with exponential backoff
pub struct RetryMiddleware {
    max_retries: usize,
    base_delay_ms: u64,
}

#[async_trait]
impl Middleware for RetryMiddleware {
    async fn on_error(
        &self,
        error: &ConnectorError,
        ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError> {
        let retry_count = ctx.metadata
            .get("retry_count")
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0);

        if retry_count < self.max_retries && error.is_retryable() {
            let delay = Duration::from_millis(
                self.base_delay_ms * 2_u64.pow(retry_count as u32)
            );
            tokio::time::sleep(delay).await;

            ctx.metadata.insert(
                "retry_count".to_string(),
                (retry_count + 1).to_string(),
            );

            Ok(ErrorAction::Retry)
        } else {
            Ok(ErrorAction::Propagate)
        }
    }
}

/// Logging/observability middleware
pub struct LoggingMiddleware {
    logger: Arc<dyn Logger>,
}

#[async_trait]
impl Middleware for LoggingMiddleware {
    async fn on_request(
        &self,
        request: &mut CompletionRequest,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        self.logger.log_request(ctx.provider_id, request);
        ctx.metadata.insert("request_id".to_string(), Uuid::new_v4().to_string());
        Ok(())
    }

    async fn on_response(
        &self,
        response: &mut CompletionResponse,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        self.logger.log_response(ctx.provider_id, response);
        Ok(())
    }

    async fn on_error(
        &self,
        error: &ConnectorError,
        ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError> {
        self.logger.log_error(ctx.provider_id, error);
        Ok(ErrorAction::Propagate)
    }
}
```

---

## 4. Data Models

### 4.1 Unified Request/Response Models

```rust
/// Unified completion request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequest {
    /// Model identifier
    pub model: String,

    /// Conversation messages
    pub messages: Vec<Message>,

    /// Sampling temperature (0.0 - 2.0)
    pub temperature: Option<f32>,

    /// Maximum tokens to generate
    pub max_tokens: Option<usize>,

    /// Top-p sampling
    pub top_p: Option<f32>,

    /// Stop sequences
    pub stop: Option<Vec<String>>,

    /// Function calling (OpenAI-style)
    pub functions: Option<Vec<FunctionDefinition>>,

    /// Tool calling (unified format)
    pub tools: Option<Vec<Tool>>,

    /// Provider-specific parameters
    pub provider_params: Option<HashMap<String, serde_json::Value>>,
}

/// Message in conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: Content,
    pub name: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Role {
    System,
    User,
    Assistant,
    Function,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Content {
    Text(String),
    MultiModal(Vec<ContentPart>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContentPart {
    Text { text: String },
    Image { url: String, detail: Option<String> },
}

/// Unified completion response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    /// Response ID
    pub id: String,

    /// Model used
    pub model: String,

    /// Generated choices
    pub choices: Vec<Choice>,

    /// Token usage
    pub usage: Usage,

    /// Provider-specific metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub index: usize,
    pub message: Message,
    pub finish_reason: FinishReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FinishReason {
    Stop,
    Length,
    FunctionCall,
    ToolCalls,
    ContentFilter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub input_tokens: usize,
    pub output_tokens: usize,
    pub total_tokens: usize,
}

/// Streaming chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub id: String,
    pub delta: Delta,
    pub finish_reason: Option<FinishReason>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delta {
    pub role: Option<Role>,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
}
```

### 4.2 Configuration Models

```rust
/// Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider_id: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub timeout_secs: Option<u64>,
    pub max_retries: Option<usize>,
    pub custom_params: HashMap<String, serde_json::Value>,
}

/// OpenAI-specific configuration
#[derive(Debug, Clone)]
pub struct OpenAIConfig {
    pub api_key: String,
    pub organization: Option<String>,
    pub base_url: String,
    pub timeout: Duration,
}

impl ProviderConfig for OpenAIConfig {
    fn provider_id(&self) -> &str {
        "openai"
    }

    fn validate(&self) -> Result<(), ConfigError> {
        if self.api_key.is_empty() {
            return Err(ConfigError::MissingApiKey);
        }
        Ok(())
    }

    fn to_config_map(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();
        map.insert("api_key".to_string(), self.api_key.clone());
        if let Some(org) = &self.organization {
            map.insert("organization".to_string(), org.clone());
        }
        map.insert("base_url".to_string(), self.base_url.clone());
        map
    }
}

/// Anthropic-specific configuration
#[derive(Debug, Clone)]
pub struct AnthropicConfig {
    pub api_key: String,
    pub version: String,
    pub base_url: String,
    pub timeout: Duration,
}

impl ProviderConfig for AnthropicConfig {
    fn provider_id(&self) -> &str {
        "anthropic"
    }

    fn validate(&self) -> Result<(), ConfigError> {
        if self.api_key.is_empty() {
            return Err(ConfigError::MissingApiKey);
        }
        Ok(())
    }

    fn to_config_map(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();
        map.insert("api_key".to_string(), self.api_key.clone());
        map.insert("version".to_string(), self.version.clone());
        map.insert("base_url".to_string(), self.base_url.clone());
        map
    }
}
```

### 4.3 Metadata Models

```rust
/// Provider metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    pub provider_id: String,
    pub models: Vec<ModelInfo>,
    pub rate_limits: RateLimits,
    pub api_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub max_tokens: usize,
    pub supports_streaming: bool,
    pub supports_functions: bool,
    pub supports_vision: bool,
    pub pricing: Pricing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pricing {
    pub input_per_1k_tokens: f64,
    pub output_per_1k_tokens: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimits {
    pub requests_per_minute: usize,
    pub tokens_per_minute: usize,
}
```

### 4.4 Error Hierarchy

```rust
/// Unified error type
#[derive(Debug, thiserror::Error)]
pub enum ConnectorError {
    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    #[error("Authentication failed: {0}")]
    AuthenticationError(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Parsing error: {0}")]
    ParseError(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Provider error: {0}")]
    ProviderError(ProviderErrorDetails),

    #[error("Streaming error: {0}")]
    StreamError(String),

    #[error("Configuration error: {0}")]
    ConfigError(#[from] ConfigError),

    #[error("Middleware error: {0}")]
    MiddlewareError(#[from] MiddlewareError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderErrorDetails {
    pub provider: String,
    pub error_code: String,
    pub message: String,
    pub retry_after: Option<Duration>,
}

impl ConnectorError {
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ConnectorError::RateLimitError(_) |
            ConnectorError::NetworkError(_)
        )
    }

    pub fn error_type(&self) -> &str {
        match self {
            ConnectorError::ProviderNotFound(_) => "provider_not_found",
            ConnectorError::AuthenticationError(_) => "authentication",
            ConnectorError::RateLimitError(_) => "rate_limit",
            ConnectorError::NetworkError(_) => "network",
            ConnectorError::ParseError(_) => "parse",
            ConnectorError::InvalidRequest(_) => "invalid_request",
            ConnectorError::ProviderError(_) => "provider",
            ConnectorError::StreamError(_) => "stream",
            ConnectorError::ConfigError(_) => "config",
            ConnectorError::MiddlewareError(_) => "middleware",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing API key")]
    MissingApiKey,

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("HTTP client error: {0}")]
    HttpClientError(String),
}

#[derive(Debug, thiserror::Error)]
pub enum MiddlewareError {
    #[error("Middleware execution failed: {0}")]
    ExecutionError(String),
}

pub enum ErrorAction {
    Retry,
    Fallback(String),
    Propagate,
}
```

---

## 5. Deployment Architectures

### 5.1 Library Crate (Embedded Use)

**Use Case**: Integrate directly into Rust applications

```toml
# Cargo.toml for library consumers
[dependencies]
llm-connector-hub = "0.1.0"
tokio = { version = "1", features = ["full"] }
```

```rust
// Example usage
use llm_connector_hub::{
    ConnectorHub,
    providers::{OpenAIConnector, AnthropicConnector},
    RequestBuilder,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize hub
    let hub = ConnectorHub::builder()
        .add_provider(OpenAIConnector::new(openai_config)?)
        .add_provider(AnthropicConnector::new(anthropic_config)?)
        .with_retry_middleware(3)
        .with_logging()
        .build()?;

    // Build request
    let request = RequestBuilder::new()
        .model("gpt-4")
        .messages(vec![
            Message::user("Explain quantum computing")
        ])
        .temperature(0.7)
        .max_tokens(500)
        .build();

    // Send request
    let response = hub.send_completion("openai", request).await?;

    println!("{}", response.choices[0].message.content);

    Ok(())
}
```

**Crate Structure**:
```
llm-connector-hub/
├── Cargo.toml
├── src/
│   ├── lib.rs              # Public API
│   ├── core/
│   │   ├── mod.rs
│   │   ├── hub.rs          # ConnectorHub
│   │   ├── traits.rs       # Core traits
│   │   └── builder.rs      # Builder patterns
│   ├── models/
│   │   ├── mod.rs
│   │   ├── request.rs
│   │   ├── response.rs
│   │   └── error.rs
│   ├── providers/
│   │   ├── mod.rs
│   │   ├── openai.rs
│   │   ├── anthropic.rs
│   │   ├── google.rs
│   │   └── aws_bedrock.rs
│   ├── middleware/
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   ├── retry.rs
│   │   ├── logging.rs
│   │   └── rate_limit.rs
│   └── cache/
│       ├── mod.rs
│       ├── memory.rs
│       └── redis.rs
```

### 5.2 Standalone Microservice

**Use Case**: REST/gRPC service for polyglot environments

```rust
// REST API using Axum
use axum::{
    routing::{get, post},
    Json, Router, Extension,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CompletionAPIRequest {
    provider: String,
    model: String,
    messages: Vec<Message>,
    temperature: Option<f32>,
    max_tokens: Option<usize>,
}

async fn completion_handler(
    Extension(hub): Extension<Arc<ConnectorHub>>,
    Json(payload): Json<CompletionAPIRequest>,
) -> Result<Json<CompletionResponse>, StatusCode> {
    let request = RequestBuilder::new()
        .model(payload.model)
        .messages(payload.messages)
        .temperature(payload.temperature.unwrap_or(0.7))
        .max_tokens(payload.max_tokens.unwrap_or(1000))
        .build();

    let response = hub.send_completion(&payload.provider, request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(response))
}

async fn health_handler(
    Extension(hub): Extension<Arc<ConnectorHub>>,
) -> Json<HealthResponse> {
    // Check all providers
    let mut provider_health = HashMap::new();

    for provider_id in ["openai", "anthropic", "google"] {
        if let Some(provider) = hub.get_provider(provider_id).await {
            let status = provider.health_check().await.unwrap_or(HealthStatus::Unknown);
            provider_health.insert(provider_id.to_string(), status);
        }
    }

    Json(HealthResponse { providers: provider_health })
}

#[tokio::main]
async fn main() {
    let hub = Arc::new(build_hub().await);

    let app = Router::new()
        .route("/v1/completions", post(completion_handler))
        .route("/health", get(health_handler))
        .layer(Extension(hub));

    axum::Server::bind(&"0.0.0.0:8080".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

**Service Structure**:
```
llm-connector-service/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── api/
│   │   ├── rest.rs         # REST endpoints
│   │   └── grpc.rs         # gRPC service
│   ├── config.rs           # Service configuration
│   └── observability.rs    # Metrics, tracing
├── proto/
│   └── llm_service.proto   # gRPC definitions
└── Dockerfile
```

**gRPC Service**:
```protobuf
// proto/llm_service.proto
syntax = "proto3";

package llm.connector.v1;

service LLMConnectorService {
  rpc SendCompletion(CompletionRequest) returns (CompletionResponse);
  rpc StreamCompletion(CompletionRequest) returns (stream StreamChunk);
  rpc GetProviderMetadata(ProviderRequest) returns (ProviderMetadata);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}

message CompletionRequest {
  string provider = 1;
  string model = 2;
  repeated Message messages = 3;
  optional float temperature = 4;
  optional int32 max_tokens = 5;
}

message CompletionResponse {
  string id = 1;
  string model = 2;
  repeated Choice choices = 3;
  Usage usage = 4;
}
```

### 5.3 Plugin for LLM-DevOps Platform

**Use Case**: Dynamic plugin loaded by LLM-DevOps orchestrator

```rust
// Plugin interface
use llm_devops_sdk::{Plugin, PluginMetadata};

pub struct LLMConnectorPlugin {
    hub: ConnectorHub,
}

impl Plugin for LLMConnectorPlugin {
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "llm-connector-hub".to_string(),
            version: "0.1.0".to_string(),
            description: "Unified LLM provider connector".to_string(),
            capabilities: vec![
                "llm.completion".to_string(),
                "llm.streaming".to_string(),
            ],
        }
    }

    async fn initialize(&mut self, context: &PluginContext) -> Result<(), PluginError> {
        // Initialize connectors from platform config
        let config: HubConfig = context.get_config("llm-connector")?;
        self.hub = build_hub_from_config(config).await?;
        Ok(())
    }

    async fn execute(
        &self,
        action: &str,
        params: Value,
    ) -> Result<Value, PluginError> {
        match action {
            "completion" => {
                let request: CompletionAPIRequest = serde_json::from_value(params)?;
                let response = self.hub
                    .send_completion(&request.provider, request.into())
                    .await?;
                Ok(serde_json::to_value(response)?)
            }
            _ => Err(PluginError::UnsupportedAction(action.to_string())),
        }
    }

    async fn shutdown(&mut self) -> Result<(), PluginError> {
        // Cleanup
        Ok(())
    }
}

#[no_mangle]
pub extern "C" fn create_plugin() -> *mut dyn Plugin {
    Box::into_raw(Box::new(LLMConnectorPlugin::default()))
}
```

### 5.4 Deployment Configurations

#### Docker Deployment
```dockerfile
# Dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/llm-connector-service /usr/local/bin/
EXPOSE 8080
CMD ["llm-connector-service"]
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-connector-hub
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-connector-hub
  template:
    metadata:
      labels:
        app: llm-connector-hub
    spec:
      containers:
      - name: connector
        image: llm-connector-hub:latest
        ports:
        - containerPort: 8080
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-secrets
              key: openai-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## 6. Extensibility & Plugins

### 6.1 Plugin System Architecture

```rust
/// Plugin registry
pub struct PluginRegistry {
    plugins: HashMap<String, Box<dyn ConnectorPlugin>>,
}

impl PluginRegistry {
    pub fn register(&mut self, plugin: Box<dyn ConnectorPlugin>) -> Result<(), PluginError> {
        let plugin_id = plugin.plugin_id().to_string();

        if self.plugins.contains_key(&plugin_id) {
            return Err(PluginError::DuplicatePlugin(plugin_id));
        }

        self.plugins.insert(plugin_id, plugin);
        Ok(())
    }

    pub fn get(&self, plugin_id: &str) -> Option<&dyn ConnectorPlugin> {
        self.plugins.get(plugin_id).map(|b| &**b)
    }

    pub async fn initialize_all(&mut self, hub: &ConnectorHub) -> Result<(), PluginError> {
        for plugin in self.plugins.values_mut() {
            plugin.initialize(hub)?;
        }
        Ok(())
    }
}

/// Example: Custom provider plugin
pub struct CustomProviderPlugin {
    provider: Option<Arc<dyn LLMProvider>>,
}

impl ConnectorPlugin for CustomProviderPlugin {
    fn plugin_id(&self) -> &str {
        "custom-provider"
    }

    fn initialize(&mut self, hub: &ConnectorHub) -> Result<(), PluginError> {
        // Load custom provider
        let provider = load_custom_provider()?;
        self.provider = Some(Arc::new(provider));

        // Register with hub
        hub.register_provider(self.provider.clone().unwrap())
            .await
            .map_err(|e| PluginError::InitializationError(e.to_string()))?;

        Ok(())
    }

    fn shutdown(&mut self) -> Result<(), PluginError> {
        self.provider = None;
        Ok(())
    }
}
```

### 6.2 Runtime Provider Switching

```rust
/// Provider selection strategy
pub trait ProviderSelector: Send + Sync {
    fn select_provider(
        &self,
        request: &CompletionRequest,
        available: &[String],
    ) -> Option<String>;
}

/// Cost-based selector
pub struct CostOptimizedSelector {
    pricing_cache: Arc<RwLock<HashMap<String, Pricing>>>,
}

impl ProviderSelector for CostOptimizedSelector {
    fn select_provider(
        &self,
        request: &CompletionRequest,
        available: &[String],
    ) -> Option<String> {
        let pricing = self.pricing_cache.read().unwrap();

        available.iter()
            .filter_map(|provider| {
                pricing.get(provider).map(|p| (provider, p))
            })
            .min_by_key(|(_, pricing)| {
                // Estimate cost based on input tokens
                let estimated_cost = pricing.input_per_1k_tokens *
                    (estimate_tokens(&request.messages) as f64 / 1000.0);
                (estimated_cost * 1000.0) as u64
            })
            .map(|(provider, _)| provider.clone())
    }
}

/// Latency-based selector
pub struct LowLatencySelector {
    latency_stats: Arc<RwLock<HashMap<String, LatencyStats>>>,
}

impl ProviderSelector for LowLatencySelector {
    fn select_provider(
        &self,
        _request: &CompletionRequest,
        available: &[String],
    ) -> Option<String> {
        let stats = self.latency_stats.read().unwrap();

        available.iter()
            .filter_map(|provider| {
                stats.get(provider).map(|s| (provider, s.p50_latency_ms))
            })
            .min_by_key(|(_, latency)| *latency)
            .map(|(provider, _)| provider.clone())
    }
}

/// Auto-switching hub extension
impl ConnectorHub {
    pub async fn send_completion_auto(
        &self,
        selector: &dyn ProviderSelector,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, ConnectorError> {
        let available = self.providers.read().await.keys()
            .cloned()
            .collect::<Vec<_>>();

        let selected = selector.select_provider(&request, &available)
            .ok_or(ConnectorError::NoProviderAvailable)?;

        self.send_completion(&selected, request).await
    }
}
```

### 6.3 Versioned API Support

```rust
/// API version trait
pub trait VersionedAPI {
    fn api_version(&self) -> &str;
    fn supported_versions(&self) -> &[&str];
    fn migrate_request(&self, from: &str, to: &str, request: Value) -> Result<Value, MigrationError>;
}

/// Example: OpenAI versioned connector
pub struct OpenAIConnectorV2 {
    config: OpenAIConfig,
    api_version: String,
}

impl VersionedAPI for OpenAIConnectorV2 {
    fn api_version(&self) -> &str {
        &self.api_version
    }

    fn supported_versions(&self) -> &[&str] {
        &["v1", "v2"]
    }

    fn migrate_request(&self, from: &str, to: &str, request: Value) -> Result<Value, MigrationError> {
        match (from, to) {
            ("v1", "v2") => {
                // Migration logic
                Ok(request)
            }
            _ => Err(MigrationError::UnsupportedMigration),
        }
    }
}
```

### 6.4 Middleware Hook System

```rust
/// Hook point definitions
pub enum HookPoint {
    BeforeRequest,
    AfterRequest,
    BeforeTransform,
    AfterTransform,
    OnError,
    OnStreamChunk,
}

/// Hook trait
#[async_trait]
pub trait Hook: Send + Sync {
    fn hook_point(&self) -> HookPoint;

    async fn execute(&self, context: &mut HookContext) -> Result<(), HookError>;
}

/// Hook context
pub struct HookContext {
    pub provider_id: String,
    pub request: Option<CompletionRequest>,
    pub response: Option<CompletionResponse>,
    pub error: Option<ConnectorError>,
    pub metadata: HashMap<String, Value>,
}

/// Hook registry
pub struct HookRegistry {
    hooks: HashMap<HookPoint, Vec<Box<dyn Hook>>>,
}

impl HookRegistry {
    pub fn register(&mut self, hook: Box<dyn Hook>) {
        self.hooks
            .entry(hook.hook_point())
            .or_insert_with(Vec::new)
            .push(hook);
    }

    pub async fn execute_hooks(
        &self,
        point: HookPoint,
        context: &mut HookContext,
    ) -> Result<(), HookError> {
        if let Some(hooks) = self.hooks.get(&point) {
            for hook in hooks {
                hook.execute(context).await?;
            }
        }
        Ok(())
    }
}
```

---

## 7. Performance & Optimization

### 7.1 Connection Pooling

```rust
/// Connection pool for HTTP clients
pub struct ConnectionPool {
    pools: HashMap<String, reqwest::Client>,
    config: PoolConfig,
}

#[derive(Clone)]
pub struct PoolConfig {
    pub max_idle_per_host: usize,
    pub timeout: Duration,
    pub tcp_keepalive: Duration,
}

impl ConnectionPool {
    pub fn new(config: PoolConfig) -> Self {
        Self {
            pools: HashMap::new(),
            config,
        }
    }

    pub fn get_client(&mut self, provider: &str) -> &reqwest::Client {
        self.pools.entry(provider.to_string()).or_insert_with(|| {
            reqwest::Client::builder()
                .pool_max_idle_per_host(self.config.max_idle_per_host)
                .timeout(self.config.timeout)
                .tcp_keepalive(Some(self.config.tcp_keepalive))
                .build()
                .expect("Failed to build HTTP client")
        })
    }
}
```

### 7.2 Request Batching

```rust
/// Batch processor for multiple requests
pub struct BatchProcessor {
    batch_size: usize,
    batch_timeout: Duration,
    pending: Arc<Mutex<Vec<BatchRequest>>>,
}

struct BatchRequest {
    provider: String,
    request: CompletionRequest,
    response_tx: oneshot::Sender<Result<CompletionResponse, ConnectorError>>,
}

impl BatchProcessor {
    pub async fn submit(
        &self,
        provider: String,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, ConnectorError> {
        let (tx, rx) = oneshot::channel();

        let batch_req = BatchRequest {
            provider,
            request,
            response_tx: tx,
        };

        {
            let mut pending = self.pending.lock().await;
            pending.push(batch_req);

            if pending.len() >= self.batch_size {
                self.flush_batch(&mut pending).await;
            }
        }

        rx.await.map_err(|_| ConnectorError::BatchError)?
    }

    async fn flush_batch(&self, batch: &mut Vec<BatchRequest>) {
        // Group by provider
        let mut grouped: HashMap<String, Vec<BatchRequest>> = HashMap::new();
        for req in batch.drain(..) {
            grouped.entry(req.provider.clone())
                .or_insert_with(Vec::new)
                .push(req);
        }

        // Process each provider's batch
        for (provider, requests) in grouped {
            tokio::spawn(async move {
                // Send batched requests to provider
                // Distribute responses back to senders
            });
        }
    }
}
```

### 7.3 Caching Strategies

```rust
/// Memory cache with LRU eviction
pub struct MemoryCache {
    cache: Arc<Mutex<lru::LruCache<String, CachedResponse>>>,
    ttl: Duration,
}

struct CachedResponse {
    response: CompletionResponse,
    cached_at: Instant,
}

#[async_trait]
impl CacheStrategy for MemoryCache {
    async fn get(&self, key: &str) -> Option<Vec<u8>> {
        let cache = self.cache.lock().await;

        cache.peek(key).and_then(|cached| {
            if cached.cached_at.elapsed() < self.ttl {
                serde_json::to_vec(&cached.response).ok()
            } else {
                None
            }
        })
    }

    async fn set(&self, key: &str, value: Vec<u8>, _ttl: Duration) -> Result<(), CacheError> {
        let response: CompletionResponse = serde_json::from_slice(&value)
            .map_err(|e| CacheError::SerializationError(e.to_string()))?;

        let mut cache = self.cache.lock().await;
        cache.put(
            key.to_string(),
            CachedResponse {
                response,
                cached_at: Instant::now(),
            },
        );

        Ok(())
    }

    async fn invalidate(&self, key: &str) -> Result<(), CacheError> {
        let mut cache = self.cache.lock().await;
        cache.pop(key);
        Ok(())
    }
}

/// Redis cache for distributed systems
pub struct RedisCache {
    client: redis::Client,
}

#[async_trait]
impl CacheStrategy for RedisCache {
    async fn get(&self, key: &str) -> Option<Vec<u8>> {
        let mut conn = self.client.get_async_connection().await.ok()?;
        redis::cmd("GET")
            .arg(key)
            .query_async(&mut conn)
            .await
            .ok()
    }

    async fn set(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError> {
        let mut conn = self.client.get_async_connection().await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        redis::cmd("SETEX")
            .arg(key)
            .arg(ttl.as_secs())
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| CacheError::WriteError(e.to_string()))
    }

    async fn invalidate(&self, key: &str) -> Result<(), CacheError> {
        let mut conn = self.client.get_async_connection().await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        redis::cmd("DEL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| CacheError::WriteError(e.to_string()))
    }
}

/// Cache key generation
pub fn generate_cache_key(request: &CompletionRequest) -> String {
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    hasher.update(request.model.as_bytes());
    hasher.update(serde_json::to_string(&request.messages).unwrap().as_bytes());
    hasher.update(request.temperature.unwrap_or(0.0).to_string().as_bytes());

    format!("llm:cache:{:x}", hasher.finalize())
}
```

### 7.4 Rate Limiting

```rust
/// Token bucket rate limiter
pub struct TokenBucketLimiter {
    buckets: Arc<RwLock<HashMap<String, TokenBucket>>>,
}

struct TokenBucket {
    tokens: f64,
    capacity: f64,
    refill_rate: f64,
    last_refill: Instant,
}

#[async_trait]
impl RateLimiter for TokenBucketLimiter {
    async fn check_limit(&self, provider: &str) -> Result<(), RateLimitError> {
        let mut buckets = self.buckets.write().await;

        let bucket = buckets.entry(provider.to_string())
            .or_insert_with(|| TokenBucket {
                tokens: 100.0,
                capacity: 100.0,
                refill_rate: 10.0, // tokens per second
                last_refill: Instant::now(),
            });

        // Refill tokens
        let elapsed = bucket.last_refill.elapsed().as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * bucket.refill_rate).min(bucket.capacity);
        bucket.last_refill = Instant::now();

        // Check if we have tokens
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Ok(())
        } else {
            Err(RateLimitError::LimitExceeded {
                retry_after: Duration::from_secs_f64(1.0 / bucket.refill_rate),
            })
        }
    }

    async fn update_usage(&self, provider: &str, tokens: usize) -> Result<(), RateLimitError> {
        let mut buckets = self.buckets.write().await;

        if let Some(bucket) = buckets.get_mut(provider) {
            bucket.tokens = (bucket.tokens - tokens as f64).max(0.0);
        }

        Ok(())
    }
}
```

---

## 8. Security Architecture

### 8.1 Credential Management

```rust
/// Secure credential storage
pub trait CredentialStore: Send + Sync {
    async fn get_credential(&self, provider: &str) -> Result<Credentials, CredentialError>;
    async fn set_credential(&self, provider: &str, creds: Credentials) -> Result<(), CredentialError>;
    async fn delete_credential(&self, provider: &str) -> Result<(), CredentialError>;
}

#[derive(Clone)]
pub struct Credentials {
    pub auth_type: AuthType,
    pub secret: Secret<String>,
}

pub enum AuthType {
    ApiKey,
    OAuth2,
    AwsSignatureV4,
}

/// Environment-based credential store
pub struct EnvCredentialStore;

#[async_trait]
impl CredentialStore for EnvCredentialStore {
    async fn get_credential(&self, provider: &str) -> Result<Credentials, CredentialError> {
        let key = format!("{}_API_KEY", provider.to_uppercase());
        let secret = std::env::var(&key)
            .map_err(|_| CredentialError::NotFound(provider.to_string()))?;

        Ok(Credentials {
            auth_type: AuthType::ApiKey,
            secret: Secret::new(secret),
        })
    }

    async fn set_credential(&self, _provider: &str, _creds: Credentials) -> Result<(), CredentialError> {
        Err(CredentialError::ReadOnly)
    }

    async fn delete_credential(&self, _provider: &str) -> Result<(), CredentialError> {
        Err(CredentialError::ReadOnly)
    }
}

/// HashiCorp Vault credential store
pub struct VaultCredentialStore {
    client: vaultrs::client::VaultClient,
    mount: String,
}

#[async_trait]
impl CredentialStore for VaultCredentialStore {
    async fn get_credential(&self, provider: &str) -> Result<Credentials, CredentialError> {
        use vaultrs::kv2;

        let secret: HashMap<String, String> = kv2::read(&self.client, &self.mount, provider)
            .await
            .map_err(|e| CredentialError::FetchError(e.to_string()))?;

        let api_key = secret.get("api_key")
            .ok_or_else(|| CredentialError::InvalidFormat)?;

        Ok(Credentials {
            auth_type: AuthType::ApiKey,
            secret: Secret::new(api_key.clone()),
        })
    }

    async fn set_credential(&self, provider: &str, creds: Credentials) -> Result<(), CredentialError> {
        use vaultrs::kv2;

        let mut data = HashMap::new();
        data.insert("api_key".to_string(), creds.secret.expose_secret().clone());

        kv2::set(&self.client, &self.mount, provider, &data)
            .await
            .map_err(|e| CredentialError::StoreError(e.to_string()))
    }

    async fn delete_credential(&self, provider: &str) -> Result<(), CredentialError> {
        use vaultrs::kv2;

        kv2::delete_latest(&self.client, &self.mount, provider)
            .await
            .map_err(|e| CredentialError::DeleteError(e.to_string()))
    }
}
```

### 8.2 Request Signing & Validation

```rust
/// Request signature for integrity
pub struct RequestSigner {
    secret_key: Secret<String>,
}

impl RequestSigner {
    pub fn sign(&self, request: &CompletionRequest) -> String {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        type HmacSha256 = Hmac<Sha256>;

        let payload = serde_json::to_string(request).unwrap();
        let mut mac = HmacSha256::new_from_slice(self.secret_key.expose_secret().as_bytes())
            .expect("HMAC can take key of any size");

        mac.update(payload.as_bytes());

        format!("{:x}", mac.finalize().into_bytes())
    }

    pub fn verify(&self, request: &CompletionRequest, signature: &str) -> bool {
        self.sign(request) == signature
    }
}
```

### 8.3 Data Sanitization

```rust
/// Sanitize sensitive data from logs
pub struct DataSanitizer;

impl DataSanitizer {
    pub fn sanitize_request(request: &CompletionRequest) -> CompletionRequest {
        let mut sanitized = request.clone();

        // Redact sensitive content
        for message in &mut sanitized.messages {
            if let Content::Text(text) = &mut message.content {
                *text = Self::redact_sensitive_patterns(text);
            }
        }

        sanitized
    }

    fn redact_sensitive_patterns(text: &str) -> String {
        // Redact API keys, emails, etc.
        let patterns = [
            (r"sk-[a-zA-Z0-9]{48}", "sk-***REDACTED***"),
            (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "***@***.***"),
            (r"\b\d{3}-\d{2}-\d{4}\b", "***-**-****"), // SSN
        ];

        let mut sanitized = text.to_string();
        for (pattern, replacement) in patterns {
            let re = regex::Regex::new(pattern).unwrap();
            sanitized = re.replace_all(&sanitized, replacement).to_string();
        }

        sanitized
    }
}
```

---

## 9. SPARC Framework Alignment

### 9.1 Specification

**System Purpose**: Unified abstraction layer for LLM provider integration

**Requirements**:
- R1: Support OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI
- R2: Provide unified request/response interface
- R3: Enable runtime provider switching
- R4: Support streaming and batch operations
- R5: Implement comprehensive error handling
- R6: Provide extensible middleware pipeline
- R7: Support multiple deployment modes (library, service, plugin)

**Constraints**:
- C1: Must be async-first for performance
- C2: Zero-cost abstractions where possible
- C3: Type-safe API design
- C4: Backward compatibility for API versions

### 9.2 Pseudocode Architecture

```
MODULE ConnectorHub
  TRAITS:
    - LLMProvider (send_completion, stream_completion, get_metadata)
    - Middleware (on_request, on_response, on_error)
    - CacheStrategy (get, set, invalidate)
    - RateLimiter (check_limit, update_usage)

  COMPONENTS:
    - ProviderRegistry: Map<ProviderID, Provider>
    - MiddlewarePipeline: Vec<Middleware>
    - CacheManager: CacheStrategy implementation
    - RateLimiter: Rate limiting strategy
    - MetricsCollector: Observability

  WORKFLOWS:
    SendCompletion(provider_id, request):
      1. Get provider from registry
      2. Check rate limit
      3. Execute middleware.on_request
      4. Check cache for cached response
      5. Send to provider if cache miss
      6. Execute middleware.on_response
      7. Update cache
      8. Record metrics
      9. Return response

    StreamCompletion(provider_id, request):
      1. Get provider from registry
      2. Execute middleware.on_request
      3. Open stream from provider
      4. Wrap stream with error handling
      5. Return stream to caller
```

### 9.3 Architecture Patterns

**Design Patterns Used**:
1. **Trait Objects**: Dynamic dispatch for providers and middleware
2. **Builder Pattern**: Safe construction of requests and hub
3. **Type-State Pattern**: Compile-time request validation
4. **Strategy Pattern**: Pluggable cache, rate limiting, provider selection
5. **Chain of Responsibility**: Middleware pipeline
6. **Adapter Pattern**: Provider-specific transformations
7. **Factory Pattern**: Provider and middleware creation

### 9.4 Refinement Strategy

**Phase 1 - Core Implementation**:
- Implement core traits and data models
- Build OpenAI and Anthropic connectors
- Basic middleware (auth, logging, retry)
- Memory-based caching

**Phase 2 - Advanced Features**:
- Additional providers (Google, AWS Bedrock, Azure)
- Advanced middleware (rate limiting, circuit breaker)
- Redis caching support
- Provider selection strategies

**Phase 3 - Production Hardening**:
- Comprehensive error handling
- Metrics and observability
- Security enhancements (credential stores, sanitization)
- Performance optimizations (connection pooling, batching)

**Phase 4 - Deployment & Integration**:
- REST/gRPC service implementation
- Plugin system for LLM-DevOps platform
- Docker/Kubernetes deployment
- Documentation and examples

### 9.5 Component Dependencies

```
Core Layer:
  - traits.rs (no dependencies)
  - models.rs (depends on: serde)
  - error.rs (depends on: thiserror)

Provider Layer (depends on Core):
  - openai.rs (depends on: reqwest, serde_json)
  - anthropic.rs (depends on: reqwest, serde_json)
  - google.rs (depends on: reqwest, serde_json)

Middleware Layer (depends on Core):
  - auth.rs
  - retry.rs
  - logging.rs
  - rate_limit.rs

Hub Layer (depends on all above):
  - hub.rs
  - builder.rs
  - plugin.rs

Service Layer (depends on Hub):
  - rest.rs (depends on: axum)
  - grpc.rs (depends on: tonic)
```

---

## 10. Module Structure & File Organization

### 10.1 Workspace Layout

```
llm-connector-hub/
├── Cargo.toml                    # Workspace definition
├── README.md
├── ARCHITECTURE.md              # This document
├── LICENSE
│
├── crates/
│   ├── llm-connector-core/      # Core traits and models
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── traits.rs
│   │       ├── models/
│   │       │   ├── mod.rs
│   │       │   ├── request.rs
│   │       │   ├── response.rs
│   │       │   └── error.rs
│   │       └── types.rs
│   │
│   ├── llm-connector-providers/ # Provider implementations
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── openai/
│   │       │   ├── mod.rs
│   │       │   ├── client.rs
│   │       │   ├── models.rs
│   │       │   └── transform.rs
│   │       ├── anthropic/
│   │       ├── google/
│   │       ├── aws_bedrock/
│   │       └── azure/
│   │
│   ├── llm-connector-middleware/ # Middleware implementations
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── auth.rs
│   │       ├── retry.rs
│   │       ├── logging.rs
│   │       ├── rate_limit.rs
│   │       └── circuit_breaker.rs
│   │
│   ├── llm-connector-hub/       # Main hub orchestrator
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── hub.rs
│   │       ├── builder.rs
│   │       ├── registry.rs
│   │       ├── cache/
│   │       │   ├── mod.rs
│   │       │   ├── memory.rs
│   │       │   └── redis.rs
│   │       └── plugin/
│   │           ├── mod.rs
│   │           └── registry.rs
│   │
│   └── llm-connector-service/   # Standalone service
│       ├── Cargo.toml
│       ├── src/
│       │   ├── main.rs
│       │   ├── api/
│       │   │   ├── rest.rs
│       │   │   └── grpc.rs
│       │   ├── config.rs
│       │   └── observability.rs
│       ├── proto/
│       │   └── llm_service.proto
│       └── Dockerfile
│
├── examples/                    # Usage examples
│   ├── simple_completion.rs
│   ├── streaming.rs
│   ├── provider_switching.rs
│   └── custom_middleware.rs
│
└── tests/                       # Integration tests
    ├── integration_tests.rs
    └── provider_tests/
        ├── openai_test.rs
        └── anthropic_test.rs
```

### 10.2 Cargo Workspace Configuration

```toml
# Root Cargo.toml
[workspace]
members = [
    "crates/llm-connector-core",
    "crates/llm-connector-providers",
    "crates/llm-connector-middleware",
    "crates/llm-connector-hub",
    "crates/llm-connector-service",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
authors = ["LLM-Connector-Hub Contributors"]
license = "MIT OR Apache-2.0"
repository = "https://github.com/your-org/llm-connector-hub"

[workspace.dependencies]
# Shared dependencies
tokio = { version = "1.35", features = ["full"] }
async-trait = "0.1"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
tracing = "0.1"
reqwest = { version = "0.11", features = ["json", "stream"] }
```

---

## Conclusion

This architecture provides a robust, extensible foundation for the LLM-Connector-Hub system. Key strengths:

1. **Modularity**: Clear separation of concerns with trait-based abstractions
2. **Extensibility**: Plugin system and middleware pipeline for customization
3. **Performance**: Async-first design, connection pooling, caching, batching
4. **Type Safety**: Leverages Rust's type system for compile-time guarantees
5. **Deployment Flexibility**: Library, microservice, or plugin modes
6. **Production Ready**: Comprehensive error handling, observability, security

The design follows SPARC principles with clear specification, well-defined architecture patterns, and a phased refinement strategy. The system is ready for implementation with all major components specified in detail.
