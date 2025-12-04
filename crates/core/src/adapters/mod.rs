//! # Runtime Integration Adapters
//!
//! This module provides thin, additive adapter layers for runtime integration
//! with upstream dependencies:
//!
//! - **schema**: Schema validation using schema-registry-core
//! - **config**: Configuration loading using llm-config-core
//! - **telemetry**: Observability using llm-observatory-core
//!
//! ## Design Principles
//!
//! 1. **Thin Adapters**: Minimal logic, mostly delegation to upstream
//! 2. **Additive**: Does not modify existing provider code
//! 3. **Backward Compatible**: All Phase 2A APIs preserved
//! 4. **No Circular Imports**: Clear dependency hierarchy

pub mod config;
pub mod schema;
pub mod telemetry;

// Re-export commonly used adapter types
pub use config::{ConfigAdapter, ProviderConfigLoader};
pub use schema::{SchemaValidator, ValidationAdapter};
pub use telemetry::{SpanAdapter, TelemetryCollector};

/// Adapter result type
pub type AdapterResult<T> = Result<T, crate::error::ConnectorError>;

/// Common adapter traits and utilities
pub mod prelude {
    pub use super::{AdapterResult, ConfigAdapter, SchemaValidator, SpanAdapter};
    pub use crate::error::{ConnectorError, Result};
}
