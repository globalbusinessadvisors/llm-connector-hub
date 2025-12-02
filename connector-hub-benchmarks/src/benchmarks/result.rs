//! Benchmark result types - canonical result structure
//!
//! This module defines the standardized `BenchmarkResult` struct used across
//! all 25 benchmark-target repositories for consistent result reporting.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Standardized benchmark result structure.
///
/// This struct contains the exact fields required by the canonical benchmark interface:
/// - `target_id`: Unique identifier for the benchmark target
/// - `metrics`: JSON object containing benchmark measurements
/// - `timestamp`: UTC timestamp when the benchmark was executed
///
/// # Example
///
/// ```
/// use connector_hub_benchmarks::BenchmarkResult;
/// use serde_json::json;
///
/// let result = BenchmarkResult::new(
///     "provider-resolution".to_string(),
///     json!({
///         "mean_ns": 1234567,
///         "p99_ns": 2345678,
///         "throughput": 1000.5
///     })
/// );
///
/// assert_eq!(result.target_id, "provider-resolution");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    /// Unique identifier for the benchmark target
    pub target_id: String,

    /// JSON object containing benchmark metrics
    ///
    /// Common metrics include:
    /// - `mean_ns`: Mean execution time in nanoseconds
    /// - `median_ns`: Median execution time in nanoseconds
    /// - `p50_ns`, `p95_ns`, `p99_ns`: Percentile latencies
    /// - `min_ns`, `max_ns`: Min/max execution times
    /// - `std_dev_ns`: Standard deviation
    /// - `throughput`: Operations per second
    /// - `iterations`: Number of iterations run
    /// - `memory_bytes`: Memory usage
    pub metrics: serde_json::Value,

    /// UTC timestamp when the benchmark was executed
    pub timestamp: DateTime<Utc>,
}

impl BenchmarkResult {
    /// Create a new benchmark result with the current timestamp.
    ///
    /// # Arguments
    ///
    /// * `target_id` - Unique identifier for the benchmark target
    /// * `metrics` - JSON object containing benchmark measurements
    ///
    /// # Returns
    ///
    /// A new `BenchmarkResult` with the current UTC timestamp.
    pub fn new(target_id: String, metrics: serde_json::Value) -> Self {
        Self {
            target_id,
            metrics,
            timestamp: Utc::now(),
        }
    }

    /// Create a benchmark result with a specific timestamp.
    ///
    /// # Arguments
    ///
    /// * `target_id` - Unique identifier for the benchmark target
    /// * `metrics` - JSON object containing benchmark measurements
    /// * `timestamp` - Specific UTC timestamp
    ///
    /// # Returns
    ///
    /// A new `BenchmarkResult` with the specified timestamp.
    pub fn with_timestamp(
        target_id: String,
        metrics: serde_json::Value,
        timestamp: DateTime<Utc>,
    ) -> Self {
        Self {
            target_id,
            metrics,
            timestamp,
        }
    }

    /// Check if the benchmark completed successfully.
    ///
    /// # Returns
    ///
    /// `true` if the metrics don't contain an error status.
    pub fn is_success(&self) -> bool {
        !self.metrics.get("status").map_or(false, |s| s == "failed")
    }

    /// Get a specific metric value.
    ///
    /// # Arguments
    ///
    /// * `key` - The metric key to retrieve
    ///
    /// # Returns
    ///
    /// The metric value if it exists, or `None`.
    pub fn get_metric(&self, key: &str) -> Option<&serde_json::Value> {
        self.metrics.get(key)
    }

    /// Get mean execution time in nanoseconds if available.
    pub fn mean_ns(&self) -> Option<u64> {
        self.metrics.get("mean_ns").and_then(|v| v.as_u64())
    }

    /// Get p99 latency in nanoseconds if available.
    pub fn p99_ns(&self) -> Option<u64> {
        self.metrics.get("p99_ns").and_then(|v| v.as_u64())
    }

    /// Get throughput (ops/sec) if available.
    pub fn throughput(&self) -> Option<f64> {
        self.metrics.get("throughput").and_then(|v| v.as_f64())
    }
}

impl std::fmt::Display for BenchmarkResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "[{}] {} @ {}",
            if self.is_success() { "OK" } else { "FAIL" },
            self.target_id,
            self.timestamp.format("%Y-%m-%d %H:%M:%S UTC")
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_benchmark_result_new() {
        let result = BenchmarkResult::new(
            "test-target".to_string(),
            json!({"mean_ns": 1000, "throughput": 100.5}),
        );

        assert_eq!(result.target_id, "test-target");
        assert_eq!(result.mean_ns(), Some(1000));
        assert_eq!(result.throughput(), Some(100.5));
        assert!(result.is_success());
    }

    #[test]
    fn test_benchmark_result_failed() {
        let result = BenchmarkResult::new(
            "failed-target".to_string(),
            json!({"error": "test error", "status": "failed"}),
        );

        assert!(!result.is_success());
    }

    #[test]
    fn test_benchmark_result_serialization() {
        let result = BenchmarkResult::new(
            "serialize-test".to_string(),
            json!({"value": 42}),
        );

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: BenchmarkResult = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.target_id, result.target_id);
    }
}
