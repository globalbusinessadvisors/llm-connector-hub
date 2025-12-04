//! # Configuration Management Adapter
//!
//! Provides runtime configuration loading using llm-config-core.
//!
//! ## Features
//!
//! - Secure credential management
//! - Environment-based configuration
//! - Configuration hot-reloading
//! - Provider-specific config loading
//!
//! ## Usage
//!
//! ```rust,ignore
//! use connector_hub_core::adapters::config::ConfigAdapter;
//!
//! let config_adapter = ConfigAdapter::new("/path/to/config");
//! let api_key = config_adapter.get_credential("openai", "api_key")?;
//! ```

use crate::error::{ConnectorError, Result};
use llm_config_core::config::Environment;
use serde_json::Value;
use std::collections::HashMap;
use tracing::{debug, info};

/// Configuration adapter
///
/// Wraps llm-config-core for provider configuration management
pub struct ConfigAdapter {
    /// Namespace for connector configurations
    _namespace: String,
    /// Current environment
    environment: Environment,
    /// Cached configurations
    cache: HashMap<String, ProviderConfig>,
}

/// Provider configuration
#[derive(Debug, Clone)]
pub struct ProviderConfig {
    /// Provider name
    pub provider: String,
    /// API endpoint
    pub endpoint: Option<String>,
    /// API key (encrypted/reference)
    pub api_key: Option<String>,
    /// Model configuration
    pub models: Vec<String>,
    /// Additional provider-specific settings
    pub settings: HashMap<String, Value>,
}

impl Default for ConfigAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigAdapter {
    /// Create a new config adapter with default settings
    pub fn new() -> Self {
        Self {
            _namespace: "connector-hub".to_string(),
            environment: Environment::Production,
            cache: HashMap::new(),
        }
    }

    /// Create adapter with custom namespace
    pub fn with_namespace(namespace: impl Into<String>) -> Self {
        Self {
            _namespace: namespace.into(),
            environment: Environment::Production,
            cache: HashMap::new(),
        }
    }

    /// Set environment
    pub fn set_environment(&mut self, env: Environment) {
        self.environment = env;
        // Clear cache when environment changes
        self.cache.clear();
    }

    /// Get provider configuration
    ///
    /// # Arguments
    ///
    /// * `provider` - Provider name (e.g., "openai", "anthropic")
    ///
    /// # Returns
    ///
    /// Provider configuration or error if not found
    pub fn get_provider_config(&mut self, provider: &str) -> Result<&ProviderConfig> {
        // Check cache first
        if self.cache.contains_key(provider) {
            debug!(provider = provider, "Using cached provider config");
            return Ok(self.cache.get(provider).unwrap());
        }

        // Load config from config manager
        info!(
            provider = provider,
            environment = ?self.environment,
            "Loading provider configuration"
        );

        // Integration point with llm-config-core
        // In production:
        // - Use ConfigManager::get() to fetch config
        // - Apply environment overrides
        // - Decrypt secrets
        // - Cache result

        // Placeholder: Create default config
        let config = self.create_default_config(provider);
        self.cache.insert(provider.to_string(), config);

        Ok(self.cache.get(provider).unwrap())
    }

    /// Get credential for provider
    ///
    /// Securely retrieves encrypted credentials from config manager
    pub fn get_credential(&self, provider: &str, credential_name: &str) -> Result<String> {
        debug!(
            provider = provider,
            credential = credential_name,
            "Retrieving provider credential"
        );

        // Integration point with llm-config-core
        // In production:
        // - Use ConfigManager::get_secret()
        // - Decrypt using encryption key
        // - Return plaintext credential

        // Placeholder: Return environment variable pattern
        let env_var = format!("{}_{}", provider.to_uppercase(), credential_name.to_uppercase());
        std::env::var(&env_var).map_err(|_| {
            ConnectorError::Config(format!(
                "Credential not found: {} (looked for env var: {})",
                credential_name, env_var
            ))
        })
    }

    /// Set credential for provider
    ///
    /// Stores encrypted credential in config manager
    pub fn set_credential(
        &mut self,
        provider: &str,
        credential_name: &str,
        _value: &str,
    ) -> Result<()> {
        info!(
            provider = provider,
            credential = credential_name,
            "Storing provider credential"
        );

        // Integration point with llm-config-core
        // In production:
        // - Use ConfigManager::set_secret()
        // - Encrypt value with AES-256-GCM
        // - Store in encrypted storage

        // Placeholder: Log action
        debug!("Credential storage not implemented in Phase 2B");
        Ok(())
    }

    /// Load routing policy for provider
    ///
    /// Retrieves routing configuration from config manager
    pub fn get_routing_policy(&self, provider: &str) -> Result<RoutingPolicy> {
        debug!(provider = provider, "Loading routing policy");

        // Integration point with llm-config-core
        // Load routing rules, rate limits, fallback chains, etc.

        Ok(RoutingPolicy::default())
    }

    /// Helper: Create default provider config
    fn create_default_config(&self, provider: &str) -> ProviderConfig {
        ProviderConfig {
            provider: provider.to_string(),
            endpoint: self.get_default_endpoint(provider),
            api_key: None, // Load from credentials separately
            models: self.get_default_models(provider),
            settings: HashMap::new(),
        }
    }

    /// Get default endpoint for provider
    fn get_default_endpoint(&self, provider: &str) -> Option<String> {
        match provider {
            "openai" => Some("https://api.openai.com/v1".to_string()),
            "anthropic" => Some("https://api.anthropic.com/v1".to_string()),
            "google" => Some("https://generativelanguage.googleapis.com/v1".to_string()),
            _ => None,
        }
    }

    /// Get default models for provider
    fn get_default_models(&self, provider: &str) -> Vec<String> {
        match provider {
            "openai" => vec![
                "gpt-4".to_string(),
                "gpt-4-turbo".to_string(),
                "gpt-3.5-turbo".to_string(),
            ],
            "anthropic" => vec![
                "claude-3-opus-20240229".to_string(),
                "claude-3-sonnet-20240229".to_string(),
                "claude-3-haiku-20240307".to_string(),
            ],
            "google" => vec!["gemini-pro".to_string(), "gemini-ultra".to_string()],
            _ => vec![],
        }
    }
}

/// Routing policy configuration
#[derive(Debug, Clone, Default)]
pub struct RoutingPolicy {
    /// Maximum requests per minute
    pub rate_limit: Option<u32>,
    /// Fallback providers
    pub fallbacks: Vec<String>,
    /// Load balancing strategy
    pub strategy: LoadBalancingStrategy,
}

/// Load balancing strategy
#[derive(Debug, Clone, Default)]
pub enum LoadBalancingStrategy {
    /// Round-robin
    #[default]
    RoundRobin,
    /// Least latency
    LeastLatency,
    /// Cost-optimized
    CostOptimized,
}

/// Provider config loader trait
pub trait ProviderConfigLoader {
    /// Load configuration for provider
    fn load_config(&mut self, provider: &str) -> Result<&ProviderConfig>;

    /// Get credential
    fn get_credential(&self, provider: &str, credential_name: &str) -> Result<String>;
}

impl ProviderConfigLoader for ConfigAdapter {
    fn load_config(&mut self, provider: &str) -> Result<&ProviderConfig> {
        self.get_provider_config(provider)
    }

    fn get_credential(&self, provider: &str, credential_name: &str) -> Result<String> {
        ConfigAdapter::get_credential(self, provider, credential_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_adapter_creation() {
        let adapter = ConfigAdapter::new();
        assert_eq!(adapter._namespace, "connector-hub");
    }

    #[test]
    fn test_get_provider_config() {
        let mut adapter = ConfigAdapter::new();
        let config = adapter.get_provider_config("openai").unwrap();

        assert_eq!(config.provider, "openai");
        assert!(config.endpoint.is_some());
        assert!(!config.models.is_empty());
    }

    #[test]
    fn test_default_endpoints() {
        let mut adapter = ConfigAdapter::new();

        let openai_config = adapter.get_provider_config("openai").unwrap();
        assert_eq!(
            openai_config.endpoint,
            Some("https://api.openai.com/v1".to_string())
        );

        let anthropic_config = adapter.get_provider_config("anthropic").unwrap();
        assert_eq!(
            anthropic_config.endpoint,
            Some("https://api.anthropic.com/v1".to_string())
        );
    }

    #[test]
    fn test_config_caching() {
        let mut adapter = ConfigAdapter::new();

        // First call - loads and caches
        let _config1 = adapter.get_provider_config("openai").unwrap();

        // Second call - from cache
        let _config2 = adapter.get_provider_config("openai").unwrap();

        assert_eq!(adapter.cache.len(), 1);
    }

    #[test]
    fn test_environment_change_clears_cache() {
        let mut adapter = ConfigAdapter::new();

        adapter.get_provider_config("openai").unwrap();
        assert_eq!(adapter.cache.len(), 1);

        adapter.set_environment(Environment::Development);
        assert_eq!(adapter.cache.len(), 0);
    }

    #[test]
    fn test_routing_policy() {
        let adapter = ConfigAdapter::new();
        let policy = adapter.get_routing_policy("openai").unwrap();

        // Default policy should be created
        assert!(matches!(policy.strategy, LoadBalancingStrategy::RoundRobin));
    }
}
