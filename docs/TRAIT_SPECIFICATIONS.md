# LLM-Connector-Hub: Trait Specifications

## Core Trait Definitions

This document provides detailed specifications for all traits in the LLM-Connector-Hub system, including implementation requirements, semantic contracts, and example implementations.

---

## Table of Contents

1. [LLMProvider Trait](#llmprovider-trait)
2. [Middleware Trait](#middleware-trait)
3. [ProviderConfig Trait](#providerconfig-trait)
4. [CacheStrategy Trait](#cachestrategy-trait)
5. [RateLimiter Trait](#ratelimiter-trait)
6. [MetricsCollector Trait](#metricscollector-trait)
7. [ConnectorPlugin Trait](#connectorplugin-trait)
8. [ProviderSelector Trait](#providerselector-trait)

---

## 1. LLMProvider Trait

### Definition

```rust
use async_trait::async_trait;
use futures::stream::BoxStream;

/// Core trait that all LLM providers must implement.
///
/// This trait defines the contract for interacting with any LLM provider,
/// ensuring a unified interface across different backends.
#[async_trait]
pub trait LLMProvider: Send + Sync {
    /// Returns a unique identifier for this provider.
    ///
    /// # Examples
    /// - "openai"
    /// - "anthropic"
    /// - "google-vertex"
    /// - "aws-bedrock"
    ///
    /// # Requirements
    /// - Must be lowercase
    /// - Must be unique across all providers
    /// - Should not change between versions
    fn provider_id(&self) -> &str;

    /// Sends a completion request to the LLM provider.
    ///
    /// # Arguments
    /// * `request` - Unified completion request
    ///
    /// # Returns
    /// * `Ok(CompletionResponse)` - Successful completion
    /// * `Err(ConnectorError)` - Various error conditions
    ///
    /// # Errors
    /// - `ConnectorError::AuthenticationError` - Invalid credentials
    /// - `ConnectorError::RateLimitError` - Rate limit exceeded
    /// - `ConnectorError::NetworkError` - Network issues
    /// - `ConnectorError::InvalidRequest` - Malformed request
    /// - `ConnectorError::ProviderError` - Provider-specific error
    ///
    /// # Implementation Notes
    /// - Must transform unified request to provider-specific format
    /// - Must transform provider response to unified format
    /// - Should handle provider-specific error codes
    /// - Must respect timeout configurations
    async fn send_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, ConnectorError>;

    /// Streams completion tokens from the LLM provider.
    ///
    /// # Arguments
    /// * `request` - Unified completion request
    ///
    /// # Returns
    /// * `Ok(BoxStream<StreamChunk>)` - Stream of completion chunks
    /// * `Err(ConnectorError)` - Error establishing stream
    ///
    /// # Stream Behavior
    /// - Stream yields `StreamChunk` items as tokens are generated
    /// - Stream completes when generation finishes
    /// - Stream errors propagate as `ConnectorError`
    ///
    /// # Implementation Notes
    /// - Must parse SSE (Server-Sent Events) or provider stream format
    /// - Should handle connection interruptions gracefully
    /// - Must emit proper finish_reason in final chunk
    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<'static, Result<StreamChunk, ConnectorError>>, ConnectorError>;

    /// Retrieves metadata about the provider's capabilities.
    ///
    /// # Returns
    /// * `Ok(ProviderMetadata)` - Provider capabilities and limits
    /// * `Err(ConnectorError)` - Error fetching metadata
    ///
    /// # Metadata Includes
    /// - Available models and their specifications
    /// - Rate limits (requests/minute, tokens/minute)
    /// - Pricing information
    /// - API version
    ///
    /// # Caching
    /// - Implementation should cache metadata internally
    /// - Refresh interval: 1 hour recommended
    async fn get_metadata(&self) -> Result<ProviderMetadata, ConnectorError>;

    /// Validates provider-specific configuration.
    ///
    /// # Arguments
    /// * `config` - Configuration to validate
    ///
    /// # Returns
    /// * `Ok(())` - Configuration is valid
    /// * `Err(ConfigError)` - Configuration issues
    ///
    /// # Validation Checks
    /// - API key format and presence
    /// - URL validity
    /// - Model availability
    /// - Parameter ranges
    fn validate_config(&self, config: &ProviderConfig) -> Result<(), ConfigError>;

    /// Performs a health check on the provider connection.
    ///
    /// # Returns
    /// * `Ok(HealthStatus::Healthy)` - Provider is operational
    /// * `Ok(HealthStatus::Degraded)` - Provider has issues but usable
    /// * `Ok(HealthStatus::Unhealthy)` - Provider is down
    /// * `Err(ConnectorError)` - Health check failed
    ///
    /// # Implementation
    /// - Should be a lightweight operation (e.g., GET /models)
    /// - Timeout should be short (< 5 seconds)
    /// - Should not count against rate limits if possible
    async fn health_check(&self) -> Result<HealthStatus, ConnectorError>;
}
```

### Semantic Contract

**Invariants**:
1. `provider_id()` must return the same value for the lifetime of the object
2. All async methods must be cancellation-safe
3. Errors must be properly categorized using `ConnectorError` variants
4. Response transformations must preserve semantic meaning

**Thread Safety**:
- All implementations must be `Send + Sync`
- Internal state must use appropriate synchronization primitives
- HTTP clients should use connection pooling

**Performance Requirements**:
- `provider_id()`: O(1), no allocation
- `validate_config()`: < 1ms
- `health_check()`: < 5 seconds timeout
- `send_completion()`: Respects request timeout
- `stream_completion()`: First chunk within request timeout

### Example Implementation

```rust
pub struct OpenAIConnector {
    config: OpenAIConfig,
    client: reqwest::Client,
    metadata_cache: Arc<RwLock<Option<(ProviderMetadata, Instant)>>>,
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
        // 1. Transform request
        let openai_req = OpenAIChatRequest {
            model: request.model,
            messages: request.messages.into_iter()
                .map(|m| self.transform_message(m))
                .collect(),
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stop: request.stop,
            stream: false,
        };

        // 2. Send HTTP request
        let response = self.client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .json(&openai_req)
            .send()
            .await
            .map_err(|e| ConnectorError::NetworkError(e.to_string()))?;

        // 3. Handle errors
        if !response.status().is_success() {
            return Err(self.parse_error_response(response).await?);
        }

        // 4. Parse and transform response
        let openai_resp: OpenAIChatResponse = response.json().await
            .map_err(|e| ConnectorError::ParseError(e.to_string()))?;

        Ok(self.transform_response(openai_resp))
    }

    async fn stream_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<BoxStream<'static, Result<StreamChunk, ConnectorError>>, ConnectorError> {
        let mut openai_req = self.build_openai_request(&request)?;
        openai_req.stream = true;

        let response = self.client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .json(&openai_req)
            .send()
            .await
            .map_err(|e| ConnectorError::NetworkError(e.to_string()))?;

        let stream = response.bytes_stream()
            .map_err(|e| ConnectorError::StreamError(e.to_string()))
            .try_filter_map(|chunk| async move {
                self.parse_sse_chunk(chunk).await
            })
            .boxed();

        Ok(stream)
    }

    async fn get_metadata(&self) -> Result<ProviderMetadata, ConnectorError> {
        // Check cache
        {
            let cache = self.metadata_cache.read().await;
            if let Some((metadata, cached_at)) = cache.as_ref() {
                if cached_at.elapsed() < Duration::from_secs(3600) {
                    return Ok(metadata.clone());
                }
            }
        }

        // Fetch fresh metadata
        let metadata = ProviderMetadata {
            provider_id: "openai".to_string(),
            models: vec![
                ModelInfo {
                    id: "gpt-4-turbo-preview".to_string(),
                    max_tokens: 128000,
                    supports_streaming: true,
                    supports_functions: true,
                    supports_vision: true,
                    pricing: Pricing {
                        input_per_1k_tokens: 0.01,
                        output_per_1k_tokens: 0.03,
                    },
                },
                // ... more models
            ],
            rate_limits: RateLimits {
                requests_per_minute: 3500,
                tokens_per_minute: 90000,
            },
            api_version: "v1".to_string(),
        };

        // Update cache
        {
            let mut cache = self.metadata_cache.write().await;
            *cache = Some((metadata.clone(), Instant::now()));
        }

        Ok(metadata)
    }

    fn validate_config(&self, config: &ProviderConfig) -> Result<(), ConfigError> {
        // Check API key
        if config.api_key.is_empty() {
            return Err(ConfigError::MissingApiKey);
        }

        if !config.api_key.starts_with("sk-") {
            return Err(ConfigError::InvalidApiKey("Must start with 'sk-'".to_string()));
        }

        // Validate URL
        if let Some(url) = &config.base_url {
            url::Url::parse(url)
                .map_err(|e| ConfigError::InvalidUrl(e.to_string()))?;
        }

        Ok(())
    }

    async fn health_check(&self) -> Result<HealthStatus, ConnectorError> {
        let response = tokio::time::timeout(
            Duration::from_secs(5),
            self.client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {}", self.config.api_key))
                .send()
        ).await;

        match response {
            Ok(Ok(resp)) if resp.status().is_success() => Ok(HealthStatus::Healthy),
            Ok(Ok(resp)) if resp.status().is_server_error() => Ok(HealthStatus::Degraded),
            Ok(Ok(_)) => Ok(HealthStatus::Unhealthy),
            Ok(Err(_)) | Err(_) => Ok(HealthStatus::Unhealthy),
        }
    }
}
```

---

## 2. Middleware Trait

### Definition

```rust
/// Trait for request/response interception and transformation.
///
/// Middleware enables cross-cutting concerns like authentication,
/// logging, retry logic, and error handling to be applied uniformly
/// across all provider interactions.
#[async_trait]
pub trait Middleware: Send + Sync {
    /// Called before a request is sent to the provider.
    ///
    /// # Arguments
    /// * `request` - Mutable reference to the request (can be modified)
    /// * `ctx` - Middleware context for metadata passing
    ///
    /// # Returns
    /// * `Ok(())` - Continue to next middleware/provider
    /// * `Err(MiddlewareError)` - Abort request processing
    ///
    /// # Use Cases
    /// - Inject authentication headers
    /// - Validate request parameters
    /// - Transform request content
    /// - Record request metrics
    async fn on_request(
        &self,
        request: &mut CompletionRequest,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError>;

    /// Called after a successful response is received.
    ///
    /// # Arguments
    /// * `response` - Mutable reference to the response (can be modified)
    /// * `ctx` - Middleware context with request metadata
    ///
    /// # Returns
    /// * `Ok(())` - Continue to next middleware/caller
    /// * `Err(MiddlewareError)` - Convert to error response
    ///
    /// # Use Cases
    /// - Transform response content
    /// - Extract and store metadata
    /// - Record response metrics
    /// - Validate response structure
    async fn on_response(
        &self,
        response: &mut CompletionResponse,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError>;

    /// Called when an error occurs during request processing.
    ///
    /// # Arguments
    /// * `error` - The error that occurred
    /// * `ctx` - Middleware context
    ///
    /// # Returns
    /// * `Ok(ErrorAction::Retry)` - Retry the request
    /// * `Ok(ErrorAction::Fallback(provider))` - Try different provider
    /// * `Ok(ErrorAction::Propagate)` - Return error to caller
    /// * `Err(MiddlewareError)` - Middleware-specific error
    ///
    /// # Use Cases
    /// - Implement retry logic
    /// - Switch to fallback provider
    /// - Transform error messages
    /// - Record error metrics
    async fn on_error(
        &self,
        error: &ConnectorError,
        ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError>;
}

/// Context passed through the middleware pipeline
#[derive(Debug, Clone)]
pub struct MiddlewareContext {
    /// Provider ID for this request
    pub provider_id: String,

    /// Request start time
    pub start_time: Instant,

    /// Arbitrary metadata for middleware communication
    pub metadata: HashMap<String, String>,
}

impl MiddlewareContext {
    pub fn new(provider_id: impl Into<String>) -> Self {
        Self {
            provider_id: provider_id.into(),
            start_time: Instant::now(),
            metadata: HashMap::new(),
        }
    }

    pub fn elapsed(&self) -> Duration {
        self.start_time.elapsed()
    }
}

/// Action to take in response to an error
#[derive(Debug, Clone)]
pub enum ErrorAction {
    /// Retry the request with the same provider
    Retry,

    /// Fallback to a different provider
    Fallback(String),

    /// Propagate the error to the caller
    Propagate,
}
```

### Semantic Contract

**Invariants**:
1. Middleware must not assume order of execution relative to other middleware
2. Context mutations in `on_request` must be preserved through `on_response`
3. Middleware must handle partial failures gracefully
4. Each middleware method should be idempotent where possible

**Execution Order**:
- `on_request`: Executed in registration order (first registered, first executed)
- `on_response`: Executed in reverse order (last registered, first executed)
- `on_error`: Executed in reverse order

**Error Handling**:
- Errors from `on_request` prevent provider call
- Errors from `on_response` convert successful response to error
- Errors from `on_error` override original error

### Example Implementations

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
        let creds = self.credentials.read().await;

        if let Some(cred) = creds.get(&ctx.provider_id) {
            // Store auth type in context for logging
            ctx.metadata.insert(
                "auth_type".to_string(),
                format!("{:?}", cred.auth_type),
            );

            // Inject provider-specific parameters
            if let Some(ref mut params) = request.provider_params {
                params.insert(
                    "authorization".to_string(),
                    json!({ "type": cred.auth_type }),
                );
            }
        }

        Ok(())
    }

    async fn on_response(
        &self,
        _response: &mut CompletionResponse,
        _ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        // No response transformation needed
        Ok(())
    }

    async fn on_error(
        &self,
        error: &ConnectorError,
        ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError> {
        // Handle token refresh for 401 errors
        if matches!(error, ConnectorError::AuthenticationError(_)) {
            // Attempt to refresh credentials
            if self.refresh_credentials(&ctx.provider_id).await.is_ok() {
                return Ok(ErrorAction::Retry);
            }
        }

        Ok(ErrorAction::Propagate)
    }
}

/// Retry middleware with exponential backoff
pub struct RetryMiddleware {
    max_retries: usize,
    base_delay_ms: u64,
    max_delay_ms: u64,
}

#[async_trait]
impl Middleware for RetryMiddleware {
    async fn on_request(
        &self,
        _request: &mut CompletionRequest,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        // Initialize retry counter
        if !ctx.metadata.contains_key("retry_count") {
            ctx.metadata.insert("retry_count".to_string(), "0".to_string());
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
        ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError> {
        // Only retry on retryable errors
        if !error.is_retryable() {
            return Ok(ErrorAction::Propagate);
        }

        // Get current retry count
        let retry_count: usize = ctx.metadata
            .get("retry_count")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        if retry_count >= self.max_retries {
            tracing::warn!(
                "Max retries ({}) exceeded for provider {}",
                self.max_retries,
                ctx.provider_id
            );
            return Ok(ErrorAction::Propagate);
        }

        // Calculate exponential backoff
        let delay_ms = (self.base_delay_ms * 2_u64.pow(retry_count as u32))
            .min(self.max_delay_ms);

        tracing::info!(
            "Retrying request (attempt {}/{}) after {}ms",
            retry_count + 1,
            self.max_retries,
            delay_ms
        );

        tokio::time::sleep(Duration::from_millis(delay_ms)).await;

        // Update retry count
        ctx.metadata.insert(
            "retry_count".to_string(),
            (retry_count + 1).to_string(),
        );

        Ok(ErrorAction::Retry)
    }
}

/// Logging middleware for observability
pub struct LoggingMiddleware {
    sanitizer: DataSanitizer,
}

#[async_trait]
impl Middleware for LoggingMiddleware {
    async fn on_request(
        &self,
        request: &mut CompletionRequest,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        let request_id = uuid::Uuid::new_v4().to_string();
        ctx.metadata.insert("request_id".to_string(), request_id.clone());

        let sanitized = self.sanitizer.sanitize_request(request);

        tracing::info!(
            request_id = %request_id,
            provider = %ctx.provider_id,
            model = %sanitized.model,
            message_count = sanitized.messages.len(),
            "Sending completion request"
        );

        Ok(())
    }

    async fn on_response(
        &self,
        response: &mut CompletionResponse,
        ctx: &mut MiddlewareContext,
    ) -> Result<(), MiddlewareError> {
        let request_id = ctx.metadata.get("request_id").unwrap();
        let latency = ctx.elapsed();

        tracing::info!(
            request_id = %request_id,
            provider = %ctx.provider_id,
            model = %response.model,
            input_tokens = response.usage.input_tokens,
            output_tokens = response.usage.output_tokens,
            latency_ms = latency.as_millis(),
            "Received completion response"
        );

        Ok(())
    }

    async fn on_error(
        &self,
        error: &ConnectorError,
        ctx: &mut MiddlewareContext,
    ) -> Result<ErrorAction, MiddlewareError> {
        let request_id = ctx.metadata.get("request_id").unwrap();

        tracing::error!(
            request_id = %request_id,
            provider = %ctx.provider_id,
            error_type = error.error_type(),
            error = %error,
            "Request failed"
        );

        Ok(ErrorAction::Propagate)
    }
}
```

---

## 3. ProviderConfig Trait

### Definition

```rust
/// Trait for provider-specific configuration.
///
/// Each provider implementation defines its own config type
/// that implements this trait for unified handling.
pub trait ProviderConfig: Clone + Send + Sync + fmt::Debug {
    /// Returns the provider ID this configuration belongs to.
    fn provider_id(&self) -> &str;

    /// Validates the configuration.
    ///
    /// # Returns
    /// * `Ok(())` - Configuration is valid
    /// * `Err(ConfigError)` - Validation failed
    fn validate(&self) -> Result<(), ConfigError>;

    /// Converts configuration to a generic key-value map.
    ///
    /// # Returns
    /// HashMap with string keys and values (sensitive data excluded)
    ///
    /// # Use Cases
    /// - Serialization for storage
    /// - Logging (without secrets)
    /// - Debugging
    fn to_config_map(&self) -> HashMap<String, String>;

    /// Creates configuration from environment variables.
    ///
    /// # Returns
    /// * `Ok(Self)` - Successfully loaded from environment
    /// * `Err(ConfigError)` - Missing or invalid environment variables
    fn from_env() -> Result<Self, ConfigError>
    where
        Self: Sized;
}
```

### Example Implementations

```rust
#[derive(Clone, Debug)]
pub struct OpenAIConfig {
    pub api_key: String,
    pub organization: Option<String>,
    pub base_url: String,
    pub timeout: Duration,
    pub max_retries: usize,
}

impl ProviderConfig for OpenAIConfig {
    fn provider_id(&self) -> &str {
        "openai"
    }

    fn validate(&self) -> Result<(), ConfigError> {
        // Validate API key
        if self.api_key.is_empty() {
            return Err(ConfigError::MissingApiKey);
        }

        if !self.api_key.starts_with("sk-") {
            return Err(ConfigError::InvalidApiKey(
                "OpenAI API keys must start with 'sk-'".to_string()
            ));
        }

        // Validate URL
        url::Url::parse(&self.base_url)
            .map_err(|e| ConfigError::InvalidUrl(e.to_string()))?;

        // Validate timeout
        if self.timeout.as_secs() == 0 {
            return Err(ConfigError::InvalidParameter(
                "Timeout must be greater than 0".to_string()
            ));
        }

        Ok(())
    }

    fn to_config_map(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();
        map.insert("provider_id".to_string(), "openai".to_string());
        map.insert("api_key".to_string(), "***REDACTED***".to_string());

        if let Some(org) = &self.organization {
            map.insert("organization".to_string(), org.clone());
        }

        map.insert("base_url".to_string(), self.base_url.clone());
        map.insert("timeout_secs".to_string(), self.timeout.as_secs().to_string());
        map.insert("max_retries".to_string(), self.max_retries.to_string());

        map
    }

    fn from_env() -> Result<Self, ConfigError> {
        let api_key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| ConfigError::MissingEnvironmentVariable("OPENAI_API_KEY"))?;

        let organization = std::env::var("OPENAI_ORGANIZATION").ok();

        let base_url = std::env::var("OPENAI_BASE_URL")
            .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

        let timeout_secs = std::env::var("OPENAI_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(60);

        let max_retries = std::env::var("OPENAI_MAX_RETRIES")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(3);

        let config = Self {
            api_key,
            organization,
            base_url,
            timeout: Duration::from_secs(timeout_secs),
            max_retries,
        };

        config.validate()?;

        Ok(config)
    }
}
```

---

## 4. CacheStrategy Trait

### Definition

```rust
/// Trait for caching response data.
///
/// Implementations provide different storage backends
/// (memory, Redis, disk, etc.)
#[async_trait]
pub trait CacheStrategy: Send + Sync {
    /// Retrieves a value from the cache.
    ///
    /// # Arguments
    /// * `key` - Cache key
    ///
    /// # Returns
    /// * `Some(Vec<u8>)` - Cached value (serialized)
    /// * `None` - Cache miss or expired
    async fn get(&self, key: &str) -> Option<Vec<u8>>;

    /// Stores a value in the cache.
    ///
    /// # Arguments
    /// * `key` - Cache key
    /// * `value` - Serialized value to store
    /// * `ttl` - Time-to-live for the entry
    ///
    /// # Returns
    /// * `Ok(())` - Successfully stored
    /// * `Err(CacheError)` - Storage failed
    async fn set(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError>;

    /// Removes a value from the cache.
    ///
    /// # Arguments
    /// * `key` - Cache key to invalidate
    ///
    /// # Returns
    /// * `Ok(())` - Successfully invalidated (or key didn't exist)
    /// * `Err(CacheError)` - Invalidation failed
    async fn invalidate(&self, key: &str) -> Result<(), CacheError>;

    /// Clears all cached entries (optional, default no-op)
    async fn clear(&self) -> Result<(), CacheError> {
        Ok(())
    }

    /// Returns cache statistics (optional)
    async fn stats(&self) -> CacheStats {
        CacheStats::default()
    }
}

#[derive(Debug, Clone, Default)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub size_bytes: u64,
}
```

---

## 5. RateLimiter Trait

### Definition

```rust
/// Trait for rate limiting strategies.
#[async_trait]
pub trait RateLimiter: Send + Sync {
    /// Checks if a request can proceed under current rate limits.
    ///
    /// # Arguments
    /// * `provider` - Provider ID to check limits for
    ///
    /// # Returns
    /// * `Ok(())` - Request can proceed
    /// * `Err(RateLimitError)` - Rate limit exceeded
    ///
    /// # Implementation Notes
    /// - Should be atomic (check + decrement)
    /// - Must handle concurrent requests correctly
    async fn check_limit(&self, provider: &str) -> Result<(), RateLimitError>;

    /// Updates usage after a request completes.
    ///
    /// # Arguments
    /// * `provider` - Provider ID
    /// * `tokens` - Number of tokens consumed
    async fn update_usage(&self, provider: &str, tokens: usize) -> Result<(), RateLimitError>;

    /// Resets rate limits for a provider (optional)
    async fn reset(&self, provider: &str) -> Result<(), RateLimitError> {
        Ok(())
    }

    /// Gets current usage statistics (optional)
    async fn get_usage(&self, provider: &str) -> Option<UsageStats> {
        None
    }
}

#[derive(Debug, Clone)]
pub struct UsageStats {
    pub requests_remaining: usize,
    pub tokens_remaining: usize,
    pub reset_at: Instant,
}
```

---

This specification provides detailed contracts for all core traits. Each trait includes:
- Complete method signatures
- Detailed documentation
- Semantic contracts and invariants
- Thread safety requirements
- Performance characteristics
- Example implementations

Implementations should adhere to these specifications to ensure consistent behavior across the system.
