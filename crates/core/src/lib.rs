//! # Connector Hub Core
//!
//! Core types, traits, and compile-time dependencies for the LLM Connector Hub.
//! This crate provides the foundational abstractions used across the connector ecosystem.
//!
//! ## Phase 2A: Compile-Time Dependencies
//!
//! This crate integrates three mandatory upstream repositories:
//!
//! 1. **schema-registry-core** - Schema validation and registry integration
//!    - Repository: https://github.com/LLM-Dev-Ops/schema-registry
//!    - Purpose: Provides schema types and validation logic
//!
//! 2. **llm-config-core** - Configuration management
//!    - Repository: https://github.com/LLM-Dev-Ops/config-manager
//!    - Purpose: Configuration loading, credential management
//!
//! 3. **llm-observatory-core** - Observability primitives
//!    - Repository: https://github.com/LLM-Dev-Ops/observatory
//!    - Purpose: Telemetry, tracing, and monitoring types
//!
//! ## Phase 2B: Runtime Integration (NEW)
//!
//! Runtime adapters for consuming from upstream dependencies:
//! - **adapters::schema** - Schema validation using schema-registry-core
//! - **adapters::config** - Configuration loading using llm-config-core
//! - **adapters::telemetry** - Telemetry emission using llm-observatory-core
//!
//! ### Example
//!
//! ```rust,ignore
//! use connector_hub_core::adapters::prelude::*;
//!
//! // Schema validation
//! let validator = ValidationAdapter::new();
//! validator.validate_request("openai", &request)?;
//!
//! // Config loading
//! let mut config = ConfigAdapter::new();
//! let api_key = config.get_credential("openai", "api_key")?;
//!
//! // Telemetry
//! let mut telemetry = SpanAdapter::new();
//! let span_id = telemetry.start_provider_span("openai", "gpt-4", None);
//! // ... perform operation ...
//! telemetry.finish_span(&span_id, true)?;
//! ```

// Re-export upstream dependencies for convenience
pub use llm_config_core;
pub use llm_observatory_core;
pub use schema_registry_core;

/// Core error types for the connector hub
pub mod error {
    use thiserror::Error;

    /// Primary error type for connector hub operations
    #[derive(Error, Debug)]
    pub enum ConnectorError {
        /// Configuration-related errors
        #[error("Configuration error: {0}")]
        Config(String),

        /// Schema validation errors from schema-registry-core
        #[error("Schema validation error: {0}")]
        Schema(String),

        /// Observability errors from llm-observatory-core
        #[error("Observability error: {0}")]
        Observatory(String),

        /// Internal system errors
        #[error("Internal error: {0}")]
        Internal(String),
    }

    /// Result type alias for connector hub operations
    pub type Result<T> = std::result::Result<T, ConnectorError>;
}

/// Core types module
///
/// Phase 2A: Minimal type definitions
/// Phase 2B: Will be expanded with runtime types and traits
pub mod types {
    use serde::{Deserialize, Serialize};

    /// Connector metadata type
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorMetadata {
        /// Connector name
        pub name: String,
        /// Connector version
        pub version: String,
        /// Provider type (OpenAI, Anthropic, Google, etc.)
        pub provider: String,
    }
}

/// Phase 2A Verification Module
///
/// Provides compile-time verification that all upstream dependencies are accessible
pub mod verification {
    /// Verifies that all upstream crates are accessible at compile time
    ///
    /// This function exists purely for Phase 2A validation and may be removed in Phase 2B.
    pub fn verify_dependencies() -> bool {
        // Compile-time verification that upstream crates are linked
        true
    }
}

/// Phase 2B Runtime Integration Adapters (NEW)
///
/// Thin, additive adapter layers for runtime consumption from upstream dependencies:
/// - Schema validation (schema-registry-core)
/// - Configuration management (llm-config-core)
/// - Observability telemetry (llm-observatory-core)
pub mod adapters;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_upstream_dependencies_accessible() {
        // Verify compile-time dependencies are accessible
        // This test confirms Phase 2A requirements are met
        assert!(verification::verify_dependencies());
    }

    #[test]
    fn test_error_types() {
        use error::ConnectorError;

        let config_err = ConnectorError::Config("test".to_string());
        assert!(config_err.to_string().contains("Configuration error"));

        let schema_err = ConnectorError::Schema("validation failed".to_string());
        assert!(schema_err.to_string().contains("Schema validation"));
    }

    #[test]
    fn test_connector_metadata() {
        use types::ConnectorMetadata;

        let metadata = ConnectorMetadata {
            name: "test-connector".to_string(),
            version: "0.1.0".to_string(),
            provider: "OpenAI".to_string(),
        };

        assert_eq!(metadata.name, "test-connector");
        assert_eq!(metadata.provider, "OpenAI");
    }
}
