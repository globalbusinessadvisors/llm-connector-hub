//! Adapters module - BenchTarget trait and implementations
//!
//! This module provides the canonical `BenchTarget` trait and adapter implementations
//! for benchmarking Connector Hub operations via TS-Rust bridging.

mod provider_resolution;
mod request_transformation;
mod middleware_pipeline;
mod cache_operations;
mod stream_parsing;

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

pub use provider_resolution::ProviderResolutionBenchmark;
pub use request_transformation::RequestTransformationBenchmark;
pub use middleware_pipeline::MiddlewarePipelineBenchmark;
pub use cache_operations::CacheOperationsBenchmark;
pub use stream_parsing::StreamParsingBenchmark;

/// Trait for benchmark targets.
///
/// This is the canonical interface for defining benchmark targets.
/// Each implementation provides an identifier and a run method that
/// executes the benchmark and returns metrics as JSON.
///
/// # Example
///
/// ```no_run
/// use connector_hub_benchmarks::BenchTarget;
/// use anyhow::Result;
/// use serde_json::Value;
/// use async_trait::async_trait;
///
/// struct MyBenchmark;
///
/// #[async_trait]
/// impl BenchTarget for MyBenchmark {
///     fn id(&self) -> String {
///         "my-benchmark".to_string()
///     }
///
///     async fn run(&self) -> Result<Value> {
///         // Execute benchmark
///         Ok(serde_json::json!({
///             "mean_ns": 1000,
///             "throughput": 100.0
///         }))
///     }
/// }
/// ```
#[async_trait]
pub trait BenchTarget: Send + Sync {
    /// Returns the unique identifier for this benchmark target.
    ///
    /// This ID is used in result reporting and should be descriptive
    /// of what the benchmark measures.
    fn id(&self) -> String;

    /// Execute the benchmark and return metrics.
    ///
    /// # Returns
    ///
    /// A JSON object containing benchmark metrics such as:
    /// - `mean_ns`: Mean execution time in nanoseconds
    /// - `p99_ns`: 99th percentile latency
    /// - `throughput`: Operations per second
    /// - `iterations`: Number of iterations performed
    ///
    /// # Errors
    ///
    /// Returns an error if the benchmark fails to execute.
    async fn run(&self) -> Result<Value>;
}

/// Returns all registered benchmark targets.
///
/// This is the canonical registry of all benchmark targets for the
/// Connector Hub. Add new benchmark implementations here.
///
/// # Returns
///
/// A vector of boxed trait objects implementing `BenchTarget`.
pub fn all_targets() -> Vec<Box<dyn BenchTarget>> {
    vec![
        Box::new(ProviderResolutionBenchmark::new()),
        Box::new(RequestTransformationBenchmark::new()),
        Box::new(MiddlewarePipelineBenchmark::new()),
        Box::new(CacheOperationsBenchmark::new()),
        Box::new(StreamParsingBenchmark::new()),
    ]
}

/// Returns benchmark targets filtered by ID prefix.
///
/// # Arguments
///
/// * `prefix` - The prefix to filter by
///
/// # Returns
///
/// A vector of matching benchmark targets.
pub fn targets_by_prefix(prefix: &str) -> Vec<Box<dyn BenchTarget>> {
    all_targets()
        .into_iter()
        .filter(|t| t.id().starts_with(prefix))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_targets_not_empty() {
        let targets = all_targets();
        assert!(!targets.is_empty(), "Should have registered benchmark targets");
    }

    #[test]
    fn test_all_targets_unique_ids() {
        let targets = all_targets();
        let mut ids: Vec<String> = targets.iter().map(|t| t.id()).collect();
        let original_len = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), original_len, "All target IDs should be unique");
    }
}
