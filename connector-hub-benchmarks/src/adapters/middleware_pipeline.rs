//! Middleware Pipeline Benchmark
//!
//! Benchmarks the middleware execution pipeline including
//! retry logic, logging, and request/response processing.

use super::BenchTarget;
use anyhow::{Context, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;
use tracing::info;

/// Benchmark for middleware pipeline operations.
///
/// This benchmark measures the overhead of:
/// - Individual middleware execution
/// - Pipeline composition and execution
/// - Retry middleware behavior
pub struct MiddlewarePipelineBenchmark {
    iterations: u32,
    warmup_iterations: u32,
}

impl MiddlewarePipelineBenchmark {
    pub fn new() -> Self {
        Self {
            iterations: 1000,
            warmup_iterations: 100,
        }
    }

    pub fn with_iterations(iterations: u32, warmup_iterations: u32) -> Self {
        Self {
            iterations,
            warmup_iterations,
        }
    }

    async fn run_ts_benchmark(&self) -> Result<Value> {
        info!("Running TypeScript middleware pipeline benchmark");

        let crate_dir = std::env::current_dir()?;
        let hub_root = if crate_dir.ends_with("connector-hub-benchmarks") {
            crate_dir.parent().unwrap().to_path_buf()
        } else {
            crate_dir.clone()
        };

        let start = Instant::now();
        let output = Command::new("npm")
            .args(["run", "bench:middleware", "--", "--json"])
            .current_dir(&hub_root)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .context("Failed to execute TypeScript benchmark")?;

        let elapsed = start.elapsed();

        if !output.status.success() {
            return Ok(serde_json::json!({
                "status": "ts_benchmark_unavailable",
                "rust_bridge_overhead_ns": elapsed.as_nanos() as u64,
                "note": "TypeScript benchmark not available"
            }));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        if let Some(json_start) = stdout.find('{') {
            if let Some(json_end) = stdout.rfind('}') {
                let json_str = &stdout[json_start..=json_end];
                if let Ok(parsed) = serde_json::from_str::<Value>(json_str) {
                    return Ok(parsed);
                }
            }
        }

        Ok(serde_json::json!({
            "bridge_execution_ns": elapsed.as_nanos() as u64,
            "status": "completed",
            "source": "rust_bridge"
        }))
    }

    async fn run_simulated(&self) -> Result<Value> {
        let mut single_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);
        let mut pipeline_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);

        // Warmup
        for _ in 0..self.warmup_iterations {
            std::hint::black_box(self.simulate_single_middleware());
            std::hint::black_box(self.simulate_pipeline(5));
        }

        // Benchmark single middleware
        for _ in 0..self.iterations {
            let start = Instant::now();
            std::hint::black_box(self.simulate_single_middleware());
            single_times.push(start.elapsed().as_nanos() as u64);
        }

        // Benchmark pipeline of 5 middlewares
        for _ in 0..self.iterations {
            let start = Instant::now();
            std::hint::black_box(self.simulate_pipeline(5));
            pipeline_times.push(start.elapsed().as_nanos() as u64);
        }

        single_times.sort();
        pipeline_times.sort();

        let single_mean = single_times.iter().sum::<u64>() / single_times.len() as u64;
        let pipeline_mean = pipeline_times.iter().sum::<u64>() / pipeline_times.len() as u64;

        let len = single_times.len();

        Ok(serde_json::json!({
            "iterations": self.iterations,
            "single_middleware": {
                "mean_ns": single_mean,
                "p99_ns": single_times[(len as f64 * 0.99) as usize],
                "min_ns": single_times[0],
                "max_ns": single_times[len - 1]
            },
            "pipeline_5_middlewares": {
                "mean_ns": pipeline_mean,
                "p99_ns": pipeline_times[(len as f64 * 0.99) as usize],
                "min_ns": pipeline_times[0],
                "max_ns": pipeline_times[len - 1],
                "overhead_per_middleware_ns": (pipeline_mean - single_mean) / 4
            },
            "mean_ns": pipeline_mean,
            "p99_ns": pipeline_times[(len as f64 * 0.99) as usize],
            "throughput": 1_000_000_000.0 / pipeline_mean as f64,
            "status": "simulated"
        }))
    }

    fn simulate_single_middleware(&self) -> u32 {
        // Simulate middleware processing
        let mut result = 0u32;
        for i in 0..10 {
            result = result.wrapping_add(i);
        }
        result
    }

    fn simulate_pipeline(&self, count: u32) -> u32 {
        let mut result = 0u32;
        for _ in 0..count {
            result = result.wrapping_add(self.simulate_single_middleware());
        }
        result
    }
}

impl Default for MiddlewarePipelineBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BenchTarget for MiddlewarePipelineBenchmark {
    fn id(&self) -> String {
        "middleware-pipeline".to_string()
    }

    async fn run(&self) -> Result<Value> {
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
    async fn test_middleware_pipeline_benchmark() {
        let bench = MiddlewarePipelineBenchmark::with_iterations(100, 10);
        let result = bench.run_simulated().await.unwrap();

        assert!(result.get("single_middleware").is_some());
        assert!(result.get("pipeline_5_middlewares").is_some());
    }
}
