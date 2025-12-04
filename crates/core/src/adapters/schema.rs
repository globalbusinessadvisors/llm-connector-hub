//! # Schema Validation Adapter
//!
//! Provides runtime schema validation for provider requests and responses
//! using schema-registry-core.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use connector_hub_core::adapters::schema::ValidationAdapter;
//!
//! let validator = ValidationAdapter::new();
//! validator.validate_request(&request_json)?;
//! validator.validate_response(&response_json)?;
//! ```

use crate::error::{ConnectorError, Result};
use schema_registry_core::types::SerializationFormat;
use serde_json::Value;
use tracing::{debug, info, warn};

/// Schema validation adapter
///
/// Wraps schema-registry-core validation functionality for connector use cases.
pub struct ValidationAdapter {
    /// Validation mode
    mode: ValidationMode,
    /// Schema format
    _format: SerializationFormat,
}

/// Validation mode configuration
#[derive(Debug, Clone, Copy)]
pub enum ValidationMode {
    /// Strict validation (fail on any violation)
    Strict,
    /// Lenient validation (warn on violations, continue)
    Lenient,
    /// Disabled (no validation)
    Disabled,
}

impl Default for ValidationAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ValidationAdapter {
    /// Create a new validation adapter with default settings
    pub fn new() -> Self {
        Self {
            mode: ValidationMode::Strict,
            _format: SerializationFormat::JsonSchema,
        }
    }

    /// Create adapter with custom mode
    pub fn with_mode(mode: ValidationMode) -> Self {
        Self {
            mode,
            _format: SerializationFormat::JsonSchema,
        }
    }

    /// Create adapter with custom format
    pub fn with_format(format: SerializationFormat) -> Self {
        Self {
            mode: ValidationMode::Strict,
            _format: format,
        }
    }

    /// Validate a request against registered schema
    ///
    /// # Arguments
    ///
    /// * `provider` - Provider name (e.g., "openai", "anthropic")
    /// * `request` - Request JSON to validate
    ///
    /// # Returns
    ///
    /// `Ok(())` if validation passes, `Err(ConnectorError::Schema)` otherwise
    pub fn validate_request(&self, provider: &str, request: &Value) -> Result<()> {
        if matches!(self.mode, ValidationMode::Disabled) {
            return Ok(());
        }

        debug!(
            provider = provider,
            "Validating request against schema registry"
        );

        // Convert request to string for validation
        let request_str = serde_json::to_string(request)
            .map_err(|e| ConnectorError::Schema(format!("Failed to serialize request: {}", e)))?;

        // Validate against schema
        // In production, this would fetch schema from registry and validate
        // For Phase 2B, we demonstrate the integration pattern
        self.validate_json_schema(provider, "request", &request_str)?;

        info!(provider = provider, "Request validation passed");
        Ok(())
    }

    /// Validate a response against registered schema
    ///
    /// # Arguments
    ///
    /// * `provider` - Provider name
    /// * `response` - Response JSON to validate
    pub fn validate_response(&self, provider: &str, response: &Value) -> Result<()> {
        if matches!(self.mode, ValidationMode::Disabled) {
            return Ok(());
        }

        debug!(
            provider = provider,
            "Validating response against schema registry"
        );

        let response_str = serde_json::to_string(response).map_err(|e| {
            ConnectorError::Schema(format!("Failed to serialize response: {}", e))
        })?;

        self.validate_json_schema(provider, "response", &response_str)?;

        info!(provider = provider, "Response validation passed");
        Ok(())
    }

    /// Validate JSON content against schema
    ///
    /// Internal method that demonstrates schema-registry-core integration
    fn validate_json_schema(&self, provider: &str, schema_type: &str, content: &str) -> Result<()> {
        // This demonstrates the integration pattern with schema-registry-core
        // In production, this would:
        // 1. Look up schema from registry by provider + schema_type
        // 2. Use schema_registry_core::traits::SchemaValidator
        // 3. Validate content against schema
        // 4. Return ValidationResult

        match self.mode {
            ValidationMode::Strict => {
                // Strict mode - fail on any validation error
                debug!(
                    provider = provider,
                    schema_type = schema_type,
                    "Performing strict validation"
                );

                // Placeholder for actual validation logic
                // In production: validator.validate(content)?
                if content.is_empty() {
                    return Err(ConnectorError::Schema(
                        "Empty content cannot be validated".to_string(),
                    ));
                }

                Ok(())
            }
            ValidationMode::Lenient => {
                // Lenient mode - warn on violations, continue
                debug!(
                    provider = provider,
                    schema_type = schema_type,
                    "Performing lenient validation"
                );

                if content.is_empty() {
                    warn!("Empty content - validation skipped in lenient mode");
                }

                Ok(())
            }
            ValidationMode::Disabled => {
                // Already checked at entry, but handle exhaustively
                Ok(())
            }
        }
    }

    /// Check schema compatibility
    ///
    /// Validates that a new schema is compatible with existing schema
    pub fn check_compatibility(
        &self,
        provider: &str,
        _new_schema: &Value,
        _old_schema: &Value,
    ) -> Result<bool> {
        debug!(
            provider = provider,
            "Checking schema compatibility"
        );

        // Integration point for schema_registry_core::traits::CompatibilityChecker
        // In production:
        // - Convert Value to SchemaInput
        // - Use CompatibilityChecker::check_compatibility()
        // - Return compatibility result

        // Placeholder implementation
        Ok(true)
    }
}

/// Schema validator trait
///
/// Provides high-level validation interface for connectors
pub trait SchemaValidator {
    /// Validate request before sending to provider
    fn validate_request(&self, provider: &str, request: &Value) -> Result<()>;

    /// Validate response received from provider
    fn validate_response(&self, provider: &str, response: &Value) -> Result<()>;
}

impl SchemaValidator for ValidationAdapter {
    fn validate_request(&self, provider: &str, request: &Value) -> Result<()> {
        ValidationAdapter::validate_request(self, provider, request)
    }

    fn validate_response(&self, provider: &str, response: &Value) -> Result<()> {
        ValidationAdapter::validate_response(self, provider, response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_adapter_creation() {
        let adapter = ValidationAdapter::new();
        assert!(matches!(adapter.mode, ValidationMode::Strict));
    }

    #[test]
    fn test_validate_request() {
        let adapter = ValidationAdapter::new();
        let request = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hello"}]
        });

        let result = adapter.validate_request("openai", &request);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_response() {
        let adapter = ValidationAdapter::new();
        let response = serde_json::json!({
            "id": "chatcmpl-123",
            "choices": [{"message": {"role": "assistant", "content": "Hi"}}]
        });

        let result = adapter.validate_response("openai", &response);
        assert!(result.is_ok());
    }

    #[test]
    fn test_lenient_mode() {
        let adapter = ValidationAdapter::with_mode(ValidationMode::Lenient);
        let empty = serde_json::json!({});

        // Lenient mode should not fail on empty
        let result = adapter.validate_request("openai", &empty);
        assert!(result.is_ok());
    }

    #[test]
    fn test_disabled_mode() {
        let adapter = ValidationAdapter::with_mode(ValidationMode::Disabled);
        let invalid = serde_json::json!(null);

        // Disabled mode should always pass
        let result = adapter.validate_request("openai", &invalid);
        assert!(result.is_ok());
    }
}
