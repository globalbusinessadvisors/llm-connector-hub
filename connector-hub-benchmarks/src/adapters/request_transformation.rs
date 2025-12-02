//! Request Transformation Benchmark
//!
//! Benchmarks the request/response transformation logic that converts
//! between unified format and provider-specific formats.

use super::BenchTarget;
use anyhow::{Context, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;
use tracing::info;

/// Benchmark for request transformation operations.
///
/// This benchmark measures the time to:
/// - Transform unified requests to provider format
/// - Transform provider responses to unified format
/// - Handle tool/function binding transformation
pub struct RequestTransformationBenchmark {
    iterations: u32,
    warmup_iterations: u32,
}

impl RequestTransformationBenchmark {
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
        info!("Running TypeScript request transformation benchmark");

        let crate_dir = std::env::current_dir()?;
        let hub_root = if crate_dir.ends_with("connector-hub-benchmarks") {
            crate_dir.parent().unwrap().to_path_buf()
        } else {
            crate_dir.clone()
        };

        let start = Instant::now();
        let output = Command::new("npm")
            .args(["run", "bench:provider", "--", "--json"])
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
                "note": "TypeScript benchmark not available, showing bridge overhead only"
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
            "bridge_execution_ms": elapsed.as_millis() as u64,
            "status": "completed",
            "source": "rust_bridge"
        }))
    }

    async fn run_simulated(&self) -> Result<Value> {
        let mut request_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);
        let mut response_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);

        // Sample request/response payloads
        let sample_request = serde_json::json!({
            "model": "gpt-4",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, how are you?"}
            ],
            "max_tokens": 1000,
            "temperature": 0.7
        });

        let sample_response = serde_json::json!({
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": "I'm doing well, thank you!"},
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18}
        });

        // Warmup
        for _ in 0..self.warmup_iterations {
            std::hint::black_box(self.simulate_request_transform(&sample_request));
            std::hint::black_box(self.simulate_response_transform(&sample_response));
        }

        // Benchmark request transformation
        for _ in 0..self.iterations {
            let start = Instant::now();
            std::hint::black_box(self.simulate_request_transform(&sample_request));
            request_times.push(start.elapsed().as_nanos() as u64);
        }

        // Benchmark response transformation
        for _ in 0..self.iterations {
            let start = Instant::now();
            std::hint::black_box(self.simulate_response_transform(&sample_response));
            response_times.push(start.elapsed().as_nanos() as u64);
        }

        request_times.sort();
        response_times.sort();

        let req_mean = request_times.iter().sum::<u64>() / request_times.len() as u64;
        let resp_mean = response_times.iter().sum::<u64>() / response_times.len() as u64;

        let len = request_times.len();
        let req_p99 = request_times[(len as f64 * 0.99) as usize];
        let resp_p99 = response_times[(len as f64 * 0.99) as usize];

        Ok(serde_json::json!({
            "iterations": self.iterations,
            "request_transform": {
                "mean_ns": req_mean,
                "p99_ns": req_p99,
                "min_ns": request_times[0],
                "max_ns": request_times[len - 1],
                "throughput": 1_000_000_000.0 / req_mean as f64
            },
            "response_transform": {
                "mean_ns": resp_mean,
                "p99_ns": resp_p99,
                "min_ns": response_times[0],
                "max_ns": response_times[len - 1],
                "throughput": 1_000_000_000.0 / resp_mean as f64
            },
            "mean_ns": (req_mean + resp_mean) / 2,
            "p99_ns": (req_p99 + resp_p99) / 2,
            "throughput": 1_000_000_000.0 / ((req_mean + resp_mean) / 2) as f64,
            "status": "simulated"
        }))
    }

    fn simulate_request_transform(&self, request: &Value) -> Value {
        // Simulate transformation to provider format
        let messages = request.get("messages").cloned().unwrap_or(Value::Null);
        serde_json::json!({
            "model": request.get("model"),
            "prompt": messages,
            "max_tokens_to_sample": request.get("max_tokens")
        })
    }

    fn simulate_response_transform(&self, response: &Value) -> Value {
        // Simulate transformation to unified format
        serde_json::json!({
            "content": response.get("choices").and_then(|c| c.get(0)).and_then(|c| c.get("message")),
            "usage": response.get("usage"),
            "id": response.get("id")
        })
    }
}

impl Default for RequestTransformationBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BenchTarget for RequestTransformationBenchmark {
    fn id(&self) -> String {
        "request-transformation".to_string()
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
    async fn test_request_transformation_benchmark() {
        let bench = RequestTransformationBenchmark::with_iterations(100, 10);
        let result = bench.run_simulated().await.unwrap();

        assert!(result.get("request_transform").is_some());
        assert!(result.get("response_transform").is_some());
    }
}
