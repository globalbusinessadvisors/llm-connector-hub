//! Benchmarks module - canonical benchmark interface
//!
//! This module provides the standard benchmark infrastructure used across
//! all 25 benchmark-target repositories.

pub mod io;
pub mod markdown;
pub mod result;

use crate::adapters::all_targets;
use result::BenchmarkResult;
use std::time::Instant;
use tracing::{info, warn};

/// Run all benchmarks and return results.
///
/// This is the canonical entrypoint for the benchmark suite.
/// It iterates through all registered benchmark targets, executes them,
/// and collects the results.
///
/// # Returns
///
/// A vector of `BenchmarkResult` containing metrics for each benchmark target.
///
/// # Example
///
/// ```no_run
/// use connector_hub_benchmarks::run_all_benchmarks;
///
/// #[tokio::main]
/// async fn main() {
///     let results = run_all_benchmarks().await;
///     for result in results {
///         println!("{}: {:?}", result.target_id, result.metrics);
///     }
/// }
/// ```
pub async fn run_all_benchmarks() -> Vec<BenchmarkResult> {
    let targets = all_targets();
    let mut results = Vec::with_capacity(targets.len());

    info!("Starting benchmark suite with {} targets", targets.len());

    for target in targets {
        let target_id = target.id();
        info!("Running benchmark: {}", target_id);

        let start = Instant::now();
        match target.run().await {
            Ok(metrics) => {
                let elapsed = start.elapsed();
                info!(
                    "Benchmark {} completed in {:?}",
                    target_id, elapsed
                );
                results.push(BenchmarkResult::new(target_id, metrics));
            }
            Err(e) => {
                warn!("Benchmark {} failed: {}", target_id, e);
                let error_metrics = serde_json::json!({
                    "error": e.to_string(),
                    "status": "failed"
                });
                results.push(BenchmarkResult::new(target_id, error_metrics));
            }
        }
    }

    info!("Benchmark suite completed: {} results", results.len());
    results
}

/// Run benchmarks for specific targets by ID.
///
/// # Arguments
///
/// * `target_ids` - List of target IDs to run
///
/// # Returns
///
/// A vector of `BenchmarkResult` for the specified targets.
pub async fn run_benchmarks_by_id(target_ids: &[&str]) -> Vec<BenchmarkResult> {
    let all = all_targets();
    let mut results = Vec::new();

    for target in all {
        if target_ids.contains(&target.id().as_str()) {
            let target_id = target.id();
            info!("Running benchmark: {}", target_id);

            match target.run().await {
                Ok(metrics) => {
                    results.push(BenchmarkResult::new(target_id, metrics));
                }
                Err(e) => {
                    warn!("Benchmark {} failed: {}", target_id, e);
                    let error_metrics = serde_json::json!({
                        "error": e.to_string(),
                        "status": "failed"
                    });
                    results.push(BenchmarkResult::new(target_id, error_metrics));
                }
            }
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_run_all_benchmarks() {
        let results = run_all_benchmarks().await;
        assert!(!results.is_empty(), "Should have at least one benchmark result");
    }
}
