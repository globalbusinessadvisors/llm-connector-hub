//! # Telemetry and Observability Adapter
//!
//! Provides runtime telemetry emission using llm-observatory-core.
//!
//! ## Features
//!
//! - Automatic span creation for provider operations
//! - Token usage tracking
//! - Cost calculation
//! - Latency metrics
//! - Structured logging
//!
//! ## Usage
//!
//! ```rust,ignore
//! use connector_hub_core::adapters::telemetry::SpanAdapter;
//!
//! let telemetry = SpanAdapter::new();
//! let span = telemetry.start_provider_span("openai", "gpt-4");
//! // ... perform operation ...
//! telemetry.finish_span(span, usage, latency)?;
//! ```

use crate::error::{ConnectorError, Result};
use chrono::Utc;
use llm_observatory_core::span::{LlmInput, LlmOutput, LlmSpan, SpanEvent, SpanStatus};
use llm_observatory_core::types::{Cost, Latency, Metadata, Provider, TokenUsage};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;
use tracing::{debug, info};

/// Telemetry adapter for provider operations
pub struct SpanAdapter {
    /// Telemetry collection enabled
    enabled: bool,
    /// Environment (production, staging, etc.)
    environment: String,
    /// Active spans
    active_spans: HashMap<String, ActiveSpan>,
}

/// Active span tracking
struct ActiveSpan {
    /// Observatory span
    span: LlmSpan,
    /// Start time for latency calculation
    start_time: Instant,
}

impl Default for SpanAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SpanAdapter {
    /// Create a new telemetry adapter
    pub fn new() -> Self {
        Self {
            enabled: true,
            environment: "production".to_string(),
            active_spans: HashMap::new(),
        }
    }

    /// Create adapter with custom environment
    pub fn with_environment(env: impl Into<String>) -> Self {
        Self {
            enabled: true,
            environment: env.into(),
            active_spans: HashMap::new(),
        }
    }

    /// Enable or disable telemetry
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            info!("Telemetry disabled");
        }
    }

    /// Start a new provider operation span
    ///
    /// # Arguments
    ///
    /// * `provider_name` - Provider (openai, anthropic, etc.)
    /// * `model` - Model name (gpt-4, claude-3-opus, etc.)
    /// * `trace_id` - Optional trace ID for correlation
    ///
    /// # Returns
    ///
    /// Span ID for later finishing
    pub fn start_provider_span(
        &mut self,
        provider_name: &str,
        model: &str,
        trace_id: Option<String>,
    ) -> String {
        if !self.enabled {
            return String::new();
        }

        let span_id = uuid::Uuid::new_v4().to_string();

        debug!(
            provider = provider_name,
            model = model,
            span_id = &span_id,
            "Starting provider operation span"
        );

        // Map provider name to Observatory Provider enum
        let provider = match provider_name {
            "openai" => Provider::OpenAI,
            "anthropic" => Provider::Anthropic,
            "google" => Provider::Google,
            "mistral" => Provider::Mistral,
            "cohere" => Provider::Cohere,
            _ => Provider::Custom(provider_name.to_string()),
        };

        // Create span using Observatory
        let now = Utc::now();
        let span = LlmSpan {
            trace_id: trace_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            span_id: span_id.clone(),
            parent_span_id: None,
            name: format!("llm.{}.completion", provider_name),
            provider,
            model: model.to_string(),
            input: LlmInput::Text {
                prompt: String::new(),  // Will be updated when request is made
            },
            output: None, // Will be set when response received
            status: SpanStatus::Unset,
            token_usage: None,
            cost: None,
            metadata: Metadata {
                user_id: None,
                session_id: None,
                request_id: Some(uuid::Uuid::new_v4()),
                environment: Some(self.environment.clone()),
                tags: vec![
                    format!("provider:{}", provider_name),
                    format!("model:{}", model),
                ],
                attributes: HashMap::new(),
            },
            latency: Latency {
                total_ms: 0,
                ttft_ms: None,
                start_time: now,
                end_time: now,
            },
            attributes: HashMap::new(),
            events: vec![],
        };

        // Track active span
        self.active_spans.insert(
            span_id.clone(),
            ActiveSpan {
                span,
                start_time: Instant::now(),
            },
        );

        info!(
            provider = provider_name,
            model = model,
            span_id = &span_id,
            "Provider span started"
        );

        span_id
    }

    /// Record request input
    pub fn record_request(&mut self, span_id: &str, request: &Value) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let active_span = self.active_spans.get_mut(span_id).ok_or_else(|| {
            ConnectorError::Observatory(format!("Span not found: {}", span_id))
        })?;

        debug!(span_id = span_id, "Recording request input");

        // Convert request to LlmInput
        // In production, this would parse the actual request format
        active_span.span.input = LlmInput::Text {
            prompt: request.to_string(),
        };

        Ok(())
    }

    /// Record response output
    pub fn record_response(&mut self, span_id: &str, response: &Value) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let active_span = self.active_spans.get_mut(span_id).ok_or_else(|| {
            ConnectorError::Observatory(format!("Span not found: {}", span_id))
        })?;

        debug!(span_id = span_id, "Recording response output");

        // Convert response to LlmOutput
        active_span.span.output = Some(LlmOutput {
            content: response.to_string(),
            finish_reason: Some("complete".to_string()),
            metadata: HashMap::new(),
        });

        Ok(())
    }

    /// Record token usage
    pub fn record_usage(
        &mut self,
        span_id: &str,
        prompt_tokens: u32,
        completion_tokens: u32,
    ) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let active_span = self.active_spans.get_mut(span_id).ok_or_else(|| {
            ConnectorError::Observatory(format!("Span not found: {}", span_id))
        })?;

        debug!(
            span_id = span_id,
            prompt_tokens = prompt_tokens,
            completion_tokens = completion_tokens,
            "Recording token usage"
        );

        active_span.span.token_usage = Some(TokenUsage {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens,
        });

        Ok(())
    }

    /// Record cost
    pub fn record_cost(&mut self, span_id: &str, amount_usd: f64) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let active_span = self.active_spans.get_mut(span_id).ok_or_else(|| {
            ConnectorError::Observatory(format!("Span not found: {}", span_id))
        })?;

        debug!(span_id = span_id, cost_usd = amount_usd, "Recording cost");

        // Split cost equally between prompt and completion for now
        // In production, calculate based on actual token counts and pricing
        let half_cost = amount_usd / 2.0;
        active_span.span.cost = Some(Cost {
            amount_usd,
            currency: "USD".to_string(),
            prompt_cost: Some(half_cost),
            completion_cost: Some(half_cost),
        });

        Ok(())
    }

    /// Finish span and emit to Observatory
    ///
    /// # Arguments
    ///
    /// * `span_id` - Span ID from start_provider_span()
    /// * `success` - Whether operation succeeded
    pub fn finish_span(&mut self, span_id: &str, success: bool) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let active_span = self.active_spans.remove(span_id).ok_or_else(|| {
            ConnectorError::Observatory(format!("Span not found: {}", span_id))
        })?;

        let elapsed = active_span.start_time.elapsed();
        let total_ms = elapsed.as_millis() as u64;

        debug!(
            span_id = span_id,
            latency_ms = total_ms,
            success = success,
            "Finishing provider span"
        );

        let mut span = active_span.span;

        // Set final status
        span.status = if success {
            SpanStatus::Ok
        } else {
            SpanStatus::Error
        };

        // Update latency with end time and total duration
        let end_time = Utc::now();
        span.latency.end_time = end_time;
        span.latency.total_ms = total_ms;

        // Emit span to Observatory
        self.emit_span(span)?;

        info!(
            span_id = span_id,
            latency_ms = total_ms,
            "Provider span finished and emitted"
        );

        Ok(())
    }

    /// Emit span to Observatory backend
    fn emit_span(&self, span: LlmSpan) -> Result<()> {
        // Integration point with llm-observatory-core
        // In production:
        // - Serialize span to OTLP format
        // - Send to Observatory collector (gRPC 4317 or HTTP 4318)
        // - Handle backpressure and retries

        debug!(
            trace_id = &span.trace_id,
            span_id = &span.span_id,
            provider = ?span.provider,
            "Emitting span to Observatory"
        );

        // Placeholder: Log span for demonstration
        info!(
            span = ?span,
            "Span emitted (placeholder - in production, sends to Observatory)"
        );

        Ok(())
    }

    /// Record custom event
    pub fn record_event(&mut self, span_id: &str, name: &str, attributes: HashMap<String, Value>) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let active_span = self.active_spans.get_mut(span_id).ok_or_else(|| {
            ConnectorError::Observatory(format!("Span not found: {}", span_id))
        })?;

        debug!(span_id = span_id, event = name, "Recording custom event");

        active_span.span.events.push(SpanEvent {
            timestamp: Utc::now(),
            name: name.to_string(),
            attributes,
        });

        Ok(())
    }
}

/// Telemetry collector trait
pub trait TelemetryCollector {
    /// Start tracking provider operation
    fn start_operation(&mut self, provider: &str, model: &str) -> String;

    /// Finish tracking operation
    fn finish_operation(&mut self, span_id: &str, success: bool) -> Result<()>;

    /// Record usage metrics
    fn record_usage(&mut self, span_id: &str, prompt_tokens: u32, completion_tokens: u32)
        -> Result<()>;
}

impl TelemetryCollector for SpanAdapter {
    fn start_operation(&mut self, provider: &str, model: &str) -> String {
        self.start_provider_span(provider, model, None)
    }

    fn finish_operation(&mut self, span_id: &str, success: bool) -> Result<()> {
        self.finish_span(span_id, success)
    }

    fn record_usage(
        &mut self,
        span_id: &str,
        prompt_tokens: u32,
        completion_tokens: u32,
    ) -> Result<()> {
        SpanAdapter::record_usage(self, span_id, prompt_tokens, completion_tokens)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_span_adapter_creation() {
        let adapter = SpanAdapter::new();
        assert!(adapter.enabled);
    }

    #[test]
    fn test_start_provider_span() {
        let mut adapter = SpanAdapter::new();
        let span_id = adapter.start_provider_span("openai", "gpt-4", None);

        assert!(!span_id.is_empty());
        assert_eq!(adapter.active_spans.len(), 1);
    }

    #[test]
    fn test_record_usage() {
        let mut adapter = SpanAdapter::new();
        let span_id = adapter.start_provider_span("openai", "gpt-4", None);

        let result = adapter.record_usage(&span_id, 100, 50);
        assert!(result.is_ok());

        let active_span = adapter.active_spans.get(&span_id).unwrap();
        let usage = active_span.span.token_usage.as_ref().unwrap();
        assert_eq!(usage.prompt_tokens, 100);
        assert_eq!(usage.completion_tokens, 50);
        assert_eq!(usage.total_tokens, 150);
    }

    #[test]
    fn test_record_cost() {
        let mut adapter = SpanAdapter::new();
        let span_id = adapter.start_provider_span("openai", "gpt-4", None);

        let result = adapter.record_cost(&span_id, 0.05);
        assert!(result.is_ok());

        let active_span = adapter.active_spans.get(&span_id).unwrap();
        let cost = active_span.span.cost.as_ref().unwrap();
        assert_eq!(cost.amount_usd, 0.05);
        assert_eq!(cost.prompt_cost.unwrap() + cost.completion_cost.unwrap(), 0.05);
    }

    #[test]
    fn test_finish_span() {
        let mut adapter = SpanAdapter::new();
        let span_id = adapter.start_provider_span("openai", "gpt-4", None);

        adapter.record_usage(&span_id, 100, 50).unwrap();
        let result = adapter.finish_span(&span_id, true);

        assert!(result.is_ok());
        assert_eq!(adapter.active_spans.len(), 0);
    }

    #[test]
    fn test_disabled_telemetry() {
        let mut adapter = SpanAdapter::new();
        adapter.set_enabled(false);

        let span_id = adapter.start_provider_span("openai", "gpt-4", None);
        assert!(span_id.is_empty());
        assert_eq!(adapter.active_spans.len(), 0);
    }

    #[test]
    fn test_record_event() {
        let mut adapter = SpanAdapter::new();
        let span_id = adapter.start_provider_span("openai", "gpt-4", None);

        let mut event_data = HashMap::new();
        event_data.insert("retry".to_string(), serde_json::json!(1));
        event_data.insert("reason".to_string(), serde_json::json!("rate_limit"));
        let result = adapter.record_event(&span_id, "retry_attempt", event_data);

        assert!(result.is_ok());

        let active_span = adapter.active_spans.get(&span_id).unwrap();
        assert_eq!(active_span.span.events.len(), 1);
        assert_eq!(active_span.span.events[0].name, "retry_attempt");
    }
}
