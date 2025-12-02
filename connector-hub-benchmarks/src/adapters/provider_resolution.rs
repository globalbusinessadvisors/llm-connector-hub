//! Provider Resolution Benchmark
//!
//! Benchmarks the provider selection and resolution logic in Connector Hub
//! by invoking the TypeScript benchmark suite via child process.

use super::BenchTarget;
use anyhow::{Context, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;
use tracing::{debug, info};

/// Benchmark for provider resolution operations.
///
/// This benchmark measures the time to:
/// - Select a provider based on configuration
/// - Resolve provider endpoints
/// - Initialize provider connections
///
/// It bridges to the TypeScript benchmark suite by invoking
/// `npm run bench:hub` and parsing the results.
pub struct ProviderResolutionBenchmark {
    iterations: u32,
    warmup_iterations: u32,
}

impl ProviderResolutionBenchmark {
    /// Create a new provider resolution benchmark with default settings.
    pub fn new() -> Self {
        Self {
            iterations: 1000,
            warmup_iterations: 100,
        }
    }

    /// Create a new benchmark with custom iteration counts.
    pub fn with_iterations(iterations: u32, warmup_iterations: u32) -> Self {
        Self {
            iterations,
            warmup_iterations,
        }
    }

    /// Execute the TypeScript benchmark and parse results.
    async fn run_ts_benchmark(&self) -> Result<Value> {
        info!("Running TypeScript provider resolution benchmark");

        // Find the connector-hub root directory
        let crate_dir = std::env::current_dir()?;
        let hub_root = if crate_dir.ends_with("connector-hub-benchmarks") {
            crate_dir.parent().unwrap().to_path_buf()
        } else {
            crate_dir.clone()
        };

        debug!("Hub root directory: {:?}", hub_root);

        // Check if node_modules exists and npm is available
        let node_modules = hub_root.join("node_modules");
        if !node_modules.exists() {
            info!("node_modules not found, running npm install first");
            let install_output = Command::new("npm")
                .arg("install")
                .current_dir(&hub_root)
                .output()
                .await
                .context("Failed to run npm install")?;

            if !install_output.status.success() {
                let stderr = String::from_utf8_lossy(&install_output.stderr);
                debug!("npm install stderr: {}", stderr);
            }
        }

        // Run the hub benchmark
        let start = Instant::now();
        let output = Command::new("npm")
            .args(["run", "bench:hub", "--", "--json"])
            .current_dir(&hub_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .context("Failed to execute TypeScript benchmark")?;

        let elapsed = start.elapsed();

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            debug!("Benchmark stderr: {}", stderr);

            // If the TS benchmark fails, return synthetic metrics
            return Ok(serde_json::json!({
                "status": "ts_benchmark_unavailable",
                "rust_bridge_overhead_ns": elapsed.as_nanos() as u64,
                "note": "TypeScript benchmark not available, showing bridge overhead only"
            }));
        }

        // Try to parse JSON output from the benchmark
        let stdout = String::from_utf8_lossy(&output.stdout);

        // Look for JSON in the output
        if let Some(json_start) = stdout.find('{') {
            if let Some(json_end) = stdout.rfind('}') {
                let json_str = &stdout[json_start..=json_end];
                if let Ok(parsed) = serde_json::from_str::<Value>(json_str) {
                    return Ok(parsed);
                }
            }
        }

        // If no JSON found, create metrics from the execution
        Ok(serde_json::json!({
            "bridge_execution_ns": elapsed.as_nanos() as u64,
            "bridge_execution_ms": elapsed.as_millis() as u64,
            "status": "completed",
            "source": "rust_bridge"
        }))
    }

    /// Run a simulated benchmark for testing without TS.
    async fn run_simulated(&self) -> Result<Value> {
        let mut times: Vec<u64> = Vec::with_capacity(self.iterations as usize);

        // Warmup
        for _ in 0..self.warmup_iterations {
            let start = Instant::now();
            // Simulate provider resolution work
            std::hint::black_box(self.simulate_resolution());
            let _ = start.elapsed();
        }

        // Actual benchmark
        for _ in 0..self.iterations {
            let start = Instant::now();
            std::hint::black_box(self.simulate_resolution());
            times.push(start.elapsed().as_nanos() as u64);
        }

        times.sort();
        let len = times.len();

        let mean = times.iter().sum::<u64>() / len as u64;
        let p50 = times[len / 2];
        let p95 = times[(len as f64 * 0.95) as usize];
        let p99 = times[(len as f64 * 0.99) as usize];
        let min = times[0];
        let max = times[len - 1];

        Ok(serde_json::json!({
            "iterations": self.iterations,
            "warmup_iterations": self.warmup_iterations,
            "mean_ns": mean,
            "median_ns": p50,
            "p50_ns": p50,
            "p95_ns": p95,
            "p99_ns": p99,
            "min_ns": min,
            "max_ns": max,
            "throughput": 1_000_000_000.0 / mean as f64,
            "status": "simulated"
        }))
    }

    fn simulate_resolution(&self) -> u32 {
        // Simulate provider selection logic
        let providers = ["openai", "anthropic", "google", "azure", "bedrock"];
        let mut hash = 0u32;
        for (i, p) in providers.iter().enumerate() {
            hash = hash.wrapping_add(p.len() as u32 * (i as u32 + 1));
        }
        hash
    }
}

impl Default for ProviderResolutionBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BenchTarget for ProviderResolutionBenchmark {
    fn id(&self) -> String {
        "provider-resolution".to_string()
    }

    async fn run(&self) -> Result<Value> {
        // Try to run the TypeScript benchmark first
        match self.run_ts_benchmark().await {
            Ok(metrics) => Ok(metrics),
            Err(e) => {
                info!(
                    "TypeScript benchmark unavailable: {}, running simulated benchmark",
                    e
                );
                self.run_simulated().await
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_provider_resolution_benchmark() {
        let bench = ProviderResolutionBenchmark::with_iterations(100, 10);
        let result = bench.run_simulated().await.unwrap();

        assert!(result.get("mean_ns").is_some());
        assert!(result.get("throughput").is_some());
    }
}
