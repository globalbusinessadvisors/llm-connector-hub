# LLM-Connector-Hub: Data Models Specification

## Complete Data Model Definitions

This document provides comprehensive specifications for all data structures used in the LLM-Connector-Hub system, including serialization formats, validation rules, and transformation patterns.

---

## Table of Contents

1. [Request Models](#request-models)
2. [Response Models](#response-models)
3. [Configuration Models](#configuration-models)
4. [Metadata Models](#metadata-models)
5. [Error Models](#error-models)
6. [Provider-Specific Models](#provider-specific-models)
7. [Transformation Patterns](#transformation-patterns)

---

## 1. Request Models

### 1.1 CompletionRequest

The unified request structure for all LLM providers.

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unified completion request across all providers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompletionRequest {
    /// Model identifier (e.g., "gpt-4", "claude-3-opus")
    pub model: String,

    /// Conversation messages
    pub messages: Vec<Message>,

    /// Sampling temperature (0.0 - 2.0)
    /// Lower values = more deterministic, higher = more creative
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    /// Maximum tokens to generate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<usize>,

    /// Nucleus sampling parameter (0.0 - 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    /// Top-k sampling parameter
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<usize>,

    /// Stop sequences
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,

    /// Presence penalty (-2.0 - 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,

    /// Frequency penalty (-2.0 - 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,

    /// Function calling definitions (OpenAI-style)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub functions: Option<Vec<FunctionDefinition>>,

    /// Tool calling definitions (unified format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,

    /// Tool choice strategy
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<ToolChoice>,

    /// User identifier for abuse monitoring
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,

    /// Random seed for reproducibility (if supported)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,

    /// Provider-specific parameters (extensibility)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_params: Option<HashMap<String, serde_json::Value>>,
}

impl CompletionRequest {
    /// Validates the request for consistency
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Model cannot be empty
        if self.model.is_empty() {
            return Err(ValidationError::EmptyModel);
        }

        // Must have at least one message
        if self.messages.is_empty() {
            return Err(ValidationError::NoMessages);
        }

        // Temperature range
        if let Some(temp) = self.temperature {
            if !(0.0..=2.0).contains(&temp) {
                return Err(ValidationError::InvalidTemperature(temp));
            }
        }

        // Top-p range
        if let Some(top_p) = self.top_p {
            if !(0.0..=1.0).contains(&top_p) {
                return Err(ValidationError::InvalidTopP(top_p));
            }
        }

        // Validate messages
        for (idx, msg) in self.messages.iter().enumerate() {
            msg.validate().map_err(|e| ValidationError::InvalidMessage {
                index: idx,
                error: Box::new(e),
            })?;
        }

        Ok(())
    }

    /// Estimates the number of tokens in the request
    pub fn estimate_tokens(&self) -> usize {
        // Simple estimation: ~4 chars per token
        self.messages.iter()
            .map(|m| m.estimate_tokens())
            .sum::<usize>()
    }
}
```

### 1.2 Message

```rust
/// A single message in the conversation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Message {
    /// Message role
    pub role: Role,

    /// Message content (text or multimodal)
    pub content: Content,

    /// Optional name for the participant
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Tool/function calls made by the assistant
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,

    /// ID of tool call this message is responding to
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl Message {
    /// Creates a system message
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: Content::Text(content.into()),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    /// Creates a user message
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: Content::Text(content.into()),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    /// Creates an assistant message
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: Content::Text(content.into()),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    /// Creates a multimodal user message
    pub fn user_multimodal(parts: Vec<ContentPart>) -> Self {
        Self {
            role: Role::User,
            content: Content::MultiModal(parts),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    /// Validates the message
    pub fn validate(&self) -> Result<(), ValidationError> {
        match self.role {
            Role::System | Role::User | Role::Assistant => {
                if matches!(self.content, Content::Text(ref s) if s.is_empty()) {
                    return Err(ValidationError::EmptyContent);
                }
            }
            Role::Tool => {
                if self.tool_call_id.is_none() {
                    return Err(ValidationError::MissingToolCallId);
                }
            }
            _ => {}
        }

        Ok(())
    }

    /// Estimates token count for this message
    pub fn estimate_tokens(&self) -> usize {
        match &self.content {
            Content::Text(text) => text.len() / 4,
            Content::MultiModal(parts) => {
                parts.iter().map(|p| p.estimate_tokens()).sum()
            }
        }
    }
}

/// Message role
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Function,
    Tool,
}

/// Message content (text or multimodal)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Content {
    /// Plain text content
    Text(String),

    /// Multimodal content (text + images)
    MultiModal(Vec<ContentPart>),
}

impl Content {
    /// Extracts text content (concatenates if multimodal)
    pub fn as_text(&self) -> String {
        match self {
            Content::Text(text) => text.clone(),
            Content::MultiModal(parts) => {
                parts.iter()
                    .filter_map(|p| {
                        if let ContentPart::Text { text } = p {
                            Some(text.as_str())
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        }
    }
}

/// Part of multimodal content
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentPart {
    Text {
        text: String,
    },
    Image {
        /// Image URL or data URI
        url: String,

        /// Detail level for image understanding
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<ImageDetail>,
    },
}

impl ContentPart {
    pub fn estimate_tokens(&self) -> usize {
        match self {
            ContentPart::Text { text } => text.len() / 4,
            ContentPart::Image { detail, .. } => {
                // Image token estimation (OpenAI-style)
                match detail {
                    Some(ImageDetail::Low) => 85,
                    Some(ImageDetail::High) | None => 765,
                }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ImageDetail {
    Low,
    High,
}
```

### 1.3 Tool and Function Definitions

```rust
/// Tool definition (unified format)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Tool {
    /// Tool type (currently only "function")
    #[serde(rename = "type")]
    pub tool_type: ToolType,

    /// Function definition
    pub function: FunctionDefinition,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ToolType {
    Function,
}

/// Function definition for tool calling
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FunctionDefinition {
    /// Function name
    pub name: String,

    /// Function description
    pub description: String,

    /// JSON schema for parameters
    pub parameters: serde_json::Value,
}

/// Tool call made by the assistant
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolCall {
    /// Unique identifier for this tool call
    pub id: String,

    /// Type of tool
    #[serde(rename = "type")]
    pub tool_type: ToolType,

    /// Function call details
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FunctionCall {
    /// Function name
    pub name: String,

    /// JSON-encoded arguments
    pub arguments: String,
}

/// Tool choice strategy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ToolChoice {
    /// Let the model decide
    Auto,

    /// Never use tools
    None,

    /// Force a specific tool
    Required,

    /// Specific tool to use
    Tool { name: String },
}
```

---

## 2. Response Models

### 2.1 CompletionResponse

```rust
/// Unified completion response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    /// Unique response identifier
    pub id: String,

    /// Model that generated the response
    pub model: String,

    /// Generated choices
    pub choices: Vec<Choice>,

    /// Token usage statistics
    pub usage: Usage,

    /// Response creation timestamp (Unix time)
    pub created: u64,

    /// Provider-specific metadata
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

impl CompletionResponse {
    /// Gets the primary response text
    pub fn primary_text(&self) -> Option<&str> {
        self.choices
            .first()
            .and_then(|c| c.message.content.as_ref())
            .map(|content| match content {
                Content::Text(text) => text.as_str(),
                Content::MultiModal(_) => "",
            })
    }

    /// Gets the finish reason for the primary choice
    pub fn finish_reason(&self) -> Option<FinishReason> {
        self.choices.first().map(|c| c.finish_reason)
    }

    /// Calculates total cost based on usage and pricing
    pub fn calculate_cost(&self, pricing: &Pricing) -> f64 {
        let input_cost = (self.usage.input_tokens as f64 / 1000.0) * pricing.input_per_1k_tokens;
        let output_cost = (self.usage.output_tokens as f64 / 1000.0) * pricing.output_per_1k_tokens;
        input_cost + output_cost
    }
}

/// A generated completion choice
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    /// Choice index
    pub index: usize,

    /// Generated message
    pub message: Message,

    /// Reason for completion finish
    pub finish_reason: FinishReason,

    /// Log probabilities (if requested)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<LogProbs>,
}

/// Reason for completion finish
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    /// Natural stop
    Stop,

    /// Max tokens reached
    Length,

    /// Function call made
    FunctionCall,

    /// Tool calls made
    ToolCalls,

    /// Content filtered
    ContentFilter,

    /// Stop sequence matched
    StopSequence,

    /// Error occurred
    Error,
}

/// Token usage statistics
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Usage {
    /// Input tokens (prompt)
    pub input_tokens: usize,

    /// Output tokens (completion)
    pub output_tokens: usize,

    /// Total tokens
    pub total_tokens: usize,
}

impl Usage {
    pub fn new(input_tokens: usize, output_tokens: usize) -> Self {
        Self {
            input_tokens,
            output_tokens,
            total_tokens: input_tokens + output_tokens,
        }
    }
}

/// Log probabilities for tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogProbs {
    pub tokens: Vec<String>,
    pub token_logprobs: Vec<f32>,
    pub top_logprobs: Vec<HashMap<String, f32>>,
}
```

### 2.2 Streaming Response

```rust
/// Streaming completion chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    /// Chunk identifier
    pub id: String,

    /// Model identifier
    pub model: String,

    /// Chunk choices
    pub choices: Vec<StreamChoice>,

    /// Reason for stream end (present in final chunk)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<FinishReason>,

    /// Usage statistics (present in final chunk)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
}

/// A streaming choice delta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChoice {
    pub index: usize,
    pub delta: Delta,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<FinishReason>,
}

/// Delta update in streaming response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<Role>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCallDelta>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallDelta {
    pub index: usize,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub function: Option<FunctionCallDelta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCallDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<String>,
}
```

---

## 3. Configuration Models

### 3.1 Hub Configuration

```rust
/// Main hub configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HubConfig {
    /// Provider configurations
    pub providers: Vec<ProviderConfigEntry>,

    /// Default provider to use
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_provider: Option<String>,

    /// Middleware configuration
    #[serde(default)]
    pub middleware: MiddlewareConfig,

    /// Cache configuration
    #[serde(default)]
    pub cache: CacheConfig,

    /// Rate limiting configuration
    #[serde(default)]
    pub rate_limit: RateLimitConfig,

    /// Observability configuration
    #[serde(default)]
    pub observability: ObservabilityConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfigEntry {
    pub provider_id: String,
    pub enabled: bool,
    pub config: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MiddlewareConfig {
    pub enable_auth: bool,
    pub enable_retry: bool,
    pub enable_logging: bool,
    pub enable_rate_limiting: bool,

    pub retry_max_attempts: Option<usize>,
    pub retry_base_delay_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CacheConfig {
    None,
    Memory {
        max_entries: usize,
        ttl_secs: u64,
    },
    Redis {
        url: String,
        ttl_secs: u64,
    },
}

impl Default for CacheConfig {
    fn default() -> Self {
        CacheConfig::Memory {
            max_entries: 1000,
            ttl_secs: 3600,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RateLimitConfig {
    pub enabled: bool,
    pub strategy: RateLimitStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RateLimitStrategy {
    TokenBucket {
        capacity: f64,
        refill_rate: f64,
    },
    FixedWindow {
        window_secs: u64,
        max_requests: usize,
    },
    SlidingWindow {
        window_secs: u64,
        max_requests: usize,
    },
}

impl Default for RateLimitStrategy {
    fn default() -> Self {
        RateLimitStrategy::TokenBucket {
            capacity: 100.0,
            refill_rate: 10.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ObservabilityConfig {
    pub enable_tracing: bool,
    pub enable_metrics: bool,
    pub tracing_endpoint: Option<String>,
    pub metrics_endpoint: Option<String>,
}
```

---

## 4. Metadata Models

### 4.1 Provider Metadata

```rust
/// Provider capabilities and limits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    /// Provider identifier
    pub provider_id: String,

    /// Provider display name
    pub provider_name: String,

    /// Available models
    pub models: Vec<ModelInfo>,

    /// Rate limits
    pub rate_limits: RateLimits,

    /// API version
    pub api_version: String,

    /// Features supported
    pub features: ProviderFeatures,

    /// Last updated timestamp
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Model identifier
    pub id: String,

    /// Display name
    pub name: String,

    /// Description
    pub description: String,

    /// Maximum context tokens
    pub max_tokens: usize,

    /// Maximum output tokens
    pub max_output_tokens: usize,

    /// Supports streaming
    pub supports_streaming: bool,

    /// Supports function calling
    pub supports_functions: bool,

    /// Supports vision/images
    pub supports_vision: bool,

    /// Supports JSON mode
    pub supports_json_mode: bool,

    /// Pricing information
    pub pricing: Pricing,

    /// Training data cutoff date
    pub training_cutoff: Option<String>,

    /// Model capabilities
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Pricing {
    /// Cost per 1K input tokens (USD)
    pub input_per_1k_tokens: f64,

    /// Cost per 1K output tokens (USD)
    pub output_per_1k_tokens: f64,

    /// Cost per image (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub per_image: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimits {
    /// Requests per minute
    pub requests_per_minute: usize,

    /// Tokens per minute
    pub tokens_per_minute: usize,

    /// Requests per day (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requests_per_day: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderFeatures {
    pub streaming: bool,
    pub function_calling: bool,
    pub tool_calling: bool,
    pub vision: bool,
    pub json_mode: bool,
    pub system_messages: bool,
    pub multimodal: bool,
    pub embeddings: bool,
}
```

---

## 5. Error Models

### 5.1 ConnectorError

```rust
use thiserror::Error;

/// Unified error type for all connector operations
#[derive(Debug, Error)]
pub enum ConnectorError {
    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    #[error("Authentication failed: {0}")]
    AuthenticationError(String),

    #[error("Authorization failed: {0}")]
    AuthorizationError(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Timeout: {0}")]
    TimeoutError(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Content filtered: {0}")]
    ContentFilterError(String),

    #[error("Provider error: {0}")]
    ProviderError(#[from] ProviderErrorDetails),

    #[error("Stream error: {0}")]
    StreamError(String),

    #[error("Configuration error: {0}")]
    ConfigError(#[from] ConfigError),

    #[error("Middleware error: {0}")]
    MiddlewareError(#[from] MiddlewareError),

    #[error("Cache error: {0}")]
    CacheError(#[from] CacheError),

    #[error("Validation error: {0}")]
    ValidationError(#[from] ValidationError),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl ConnectorError {
    /// Determines if the error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ConnectorError::RateLimitError(_) |
            ConnectorError::NetworkError(_) |
            ConnectorError::TimeoutError(_)
        )
    }

    /// Returns the error category
    pub fn error_type(&self) -> &str {
        match self {
            ConnectorError::ProviderNotFound(_) => "provider_not_found",
            ConnectorError::AuthenticationError(_) => "authentication",
            ConnectorError::AuthorizationError(_) => "authorization",
            ConnectorError::RateLimitError(_) => "rate_limit",
            ConnectorError::NetworkError(_) => "network",
            ConnectorError::TimeoutError(_) => "timeout",
            ConnectorError::ParseError(_) => "parse",
            ConnectorError::InvalidRequest(_) => "invalid_request",
            ConnectorError::ModelNotFound(_) => "model_not_found",
            ConnectorError::ContentFilterError(_) => "content_filter",
            ConnectorError::ProviderError(_) => "provider",
            ConnectorError::StreamError(_) => "stream",
            ConnectorError::ConfigError(_) => "config",
            ConnectorError::MiddlewareError(_) => "middleware",
            ConnectorError::CacheError(_) => "cache",
            ConnectorError::ValidationError(_) => "validation",
            ConnectorError::Unknown(_) => "unknown",
        }
    }

    /// Converts to HTTP status code
    pub fn to_http_status(&self) -> u16 {
        match self {
            ConnectorError::AuthenticationError(_) => 401,
            ConnectorError::AuthorizationError(_) => 403,
            ConnectorError::ProviderNotFound(_) => 404,
            ConnectorError::ModelNotFound(_) => 404,
            ConnectorError::InvalidRequest(_) => 400,
            ConnectorError::ValidationError(_) => 400,
            ConnectorError::RateLimitError(_) => 429,
            ConnectorError::TimeoutError(_) => 504,
            _ => 500,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Error)]
#[error("Provider {provider} error: {message} (code: {error_code})")]
pub struct ProviderErrorDetails {
    pub provider: String,
    pub error_code: String,
    pub message: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<Duration>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing API key")]
    MissingApiKey,

    #[error("Invalid API key: {0}")]
    InvalidApiKey(String),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Missing environment variable: {0}")]
    MissingEnvironmentVariable(&'static str),

    #[error("HTTP client error: {0}")]
    HttpClientError(String),

    #[error("Read-only credential store")]
    ReadOnly,
}

#[derive(Debug, Error)]
pub enum MiddlewareError {
    #[error("Middleware execution failed: {0}")]
    ExecutionError(String),

    #[error("Middleware initialization failed: {0}")]
    InitializationError(String),
}

#[derive(Debug, Error)]
pub enum CacheError {
    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Read error: {0}")]
    ReadError(String),

    #[error("Write error: {0}")]
    WriteError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

#[derive(Debug, Error)]
pub enum ValidationError {
    #[error("Empty model")]
    EmptyModel,

    #[error("No messages")]
    NoMessages,

    #[error("Invalid temperature: {0}")]
    InvalidTemperature(f32),

    #[error("Invalid top_p: {0}")]
    InvalidTopP(f32),

    #[error("Empty content")]
    EmptyContent,

    #[error("Missing tool call ID")]
    MissingToolCallId,

    #[error("Invalid message at index {index}: {error}")]
    InvalidMessage {
        index: usize,
        error: Box<ValidationError>,
    },
}
```

---

## 6. Provider-Specific Models

### 6.1 OpenAI Models

```rust
/// OpenAI chat completion request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIChatRequest {
    pub model: String,
    pub messages: Vec<OpenAIMessage>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,

    #[serde(default)]
    pub stream: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<OpenAITool>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIMessage {
    pub role: String,
    pub content: Option<serde_json::Value>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<OpenAIToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAITool {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: OpenAIFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIFunction {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: OpenAIFunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIFunctionCall {
    pub name: String,
    pub arguments: String,
}

/// OpenAI response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIChatResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<OpenAIChoice>,
    pub usage: OpenAIUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIChoice {
    pub index: usize,
    pub message: OpenAIMessage,
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIUsage {
    pub prompt_tokens: usize,
    pub completion_tokens: usize,
    pub total_tokens: usize,
}
```

### 6.2 Anthropic Models

```rust
/// Anthropic messages API request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicRequest {
    pub model: String,
    pub messages: Vec<AnthropicMessage>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,

    pub max_tokens: usize,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,

    #[serde(default)]
    pub stream: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicMessage {
    pub role: String,
    pub content: AnthropicContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AnthropicContent {
    Text(String),
    Blocks(Vec<AnthropicContentBlock>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AnthropicContentBlock {
    Text { text: String },
    Image { source: AnthropicImageSource },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicImageSource {
    #[serde(rename = "type")]
    pub source_type: String,
    pub media_type: String,
    pub data: String,
}

/// Anthropic response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub response_type: String,
    pub role: String,
    pub content: Vec<AnthropicContentBlock>,
    pub model: String,
    pub stop_reason: Option<String>,
    pub usage: AnthropicUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicUsage {
    pub input_tokens: usize,
    pub output_tokens: usize,
}
```

---

## 7. Transformation Patterns

### 7.1 Request Transformation

```rust
/// Trait for transforming unified requests to provider-specific formats
pub trait RequestTransformer {
    type ProviderRequest;

    fn transform(&self, request: &CompletionRequest) -> Result<Self::ProviderRequest, TransformError>;
}

/// OpenAI transformer
pub struct OpenAITransformer;

impl RequestTransformer for OpenAITransformer {
    type ProviderRequest = OpenAIChatRequest;

    fn transform(&self, request: &CompletionRequest) -> Result<OpenAIChatRequest, TransformError> {
        Ok(OpenAIChatRequest {
            model: request.model.clone(),
            messages: request.messages.iter()
                .map(|m| self.transform_message(m))
                .collect::<Result<Vec<_>, _>>()?,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stop: request.stop.clone(),
            presence_penalty: request.presence_penalty,
            frequency_penalty: request.frequency_penalty,
            stream: false,
            tools: request.tools.as_ref().map(|tools| {
                tools.iter().map(|t| self.transform_tool(t)).collect()
            }),
            user: request.user.clone(),
        })
    }
}

/// Anthropic transformer
pub struct AnthropicTransformer;

impl RequestTransformer for AnthropicTransformer {
    type ProviderRequest = AnthropicRequest;

    fn transform(&self, request: &CompletionRequest) -> Result<AnthropicRequest, TransformError> {
        // Extract system message
        let (system, messages): (Vec<_>, Vec<_>) = request.messages.iter()
            .partition(|m| matches!(m.role, Role::System));

        let system_prompt = if !system.is_empty() {
            Some(system.iter()
                .map(|m| m.content.as_text())
                .collect::<Vec<_>>()
                .join("\n\n"))
        } else {
            None
        };

        Ok(AnthropicRequest {
            model: request.model.clone(),
            messages: messages.iter()
                .map(|m| self.transform_message(m))
                .collect::<Result<Vec<_>, _>>()?,
            system: system_prompt,
            max_tokens: request.max_tokens.unwrap_or(4096),
            temperature: request.temperature,
            top_p: request.top_p,
            top_k: request.top_k,
            stop_sequences: request.stop.clone(),
            stream: false,
        })
    }
}
```

This comprehensive data model specification provides all the structures needed for the LLM-Connector-Hub system, with proper serialization, validation, and transformation patterns.
