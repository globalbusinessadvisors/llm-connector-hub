//! Stream Parsing Benchmark
//!
//! Benchmarks the streaming response parsing for different providers.

use super::BenchTarget;
use anyhow::{Context, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;
use tracing::info;

/// Benchmark for stream parsing operations.
///
/// This benchmark measures:
/// - SSE chunk parsing
/// - Token extraction from stream
/// - Stream aggregation
pub struct StreamParsingBenchmark {
    iterations: u32,
    warmup_iterations: u32,
}

impl StreamParsingBenchmark {
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
        info!("Running TypeScript stream parsing benchmark");

        let crate_dir = std::env::current_dir()?;
        let hub_root = if crate_dir.ends_with("connector-hub-benchmarks") {
            crate_dir.parent().unwrap().to_path_buf()
        } else {
            crate_dir.clone()
        };

        // The TS benchmarks don't have a specific stream parsing benchmark
        // so we'll run the provider benchmark which includes stream tests
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
                "note": "TypeScript benchmark not available"
            }));
        }

        Ok(serde_json::json!({
            "bridge_execution_ns": elapsed.as_nanos() as u64,
            "status": "completed",
            "source": "rust_bridge"
        }))
    }

    async fn run_simulated(&self) -> Result<Value> {
        let mut parse_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);
        let mut aggregate_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);

        // Sample SSE chunks
        let chunks = vec![
            "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\"!\"}}]}\n\n",
            "data: [DONE]\n\n",
        ];

        // Warmup
        for _ in 0..self.warmup_iterations {
            for chunk in &chunks {
                std::hint::black_box(self.parse_sse_chunk(chunk));
            }
            std::hint::black_box(self.aggregate_chunks(&chunks));
        }

        // Benchmark single chunk parsing
        for _ in 0..self.iterations {
            let start = Instant::now();
            for chunk in &chunks {
                std::hint::black_box(self.parse_sse_chunk(chunk));
            }
            parse_times.push(start.elapsed().as_nanos() as u64);
        }

        // Benchmark full stream aggregation
        for _ in 0..self.iterations {
            let start = Instant::now();
            std::hint::black_box(self.aggregate_chunks(&chunks));
            aggregate_times.push(start.elapsed().as_nanos() as u64);
        }

        parse_times.sort();
        aggregate_times.sort();

        let len = parse_times.len();
        let parse_mean = parse_times.iter().sum::<u64>() / len as u64;
        let aggregate_mean = aggregate_times.iter().sum::<u64>() / len as u64;

        Ok(serde_json::json!({
            "iterations": self.iterations,
            "chunks_per_stream": chunks.len(),
            "chunk_parsing": {
                "mean_ns": parse_mean,
                "p99_ns": parse_times[(len as f64 * 0.99) as usize],
                "min_ns": parse_times[0],
                "max_ns": parse_times[len - 1],
                "per_chunk_ns": parse_mean / chunks.len() as u64
            },
            "stream_aggregation": {
                "mean_ns": aggregate_mean,
                "p99_ns": aggregate_times[(len as f64 * 0.99) as usize],
                "min_ns": aggregate_times[0],
                "max_ns": aggregate_times[len - 1]
            },
            "mean_ns": parse_mean,
            "p99_ns": parse_times[(len as f64 * 0.99) as usize],
            "throughput": 1_000_000_000.0 / parse_mean as f64 * chunks.len() as f64,
            "status": "simulated"
        }))
    }

    fn parse_sse_chunk(&self, chunk: &str) -> Option<String> {
        if chunk.starts_with("data: [DONE]") {
            return None;
        }

        if let Some(json_str) = chunk.strip_prefix("data: ") {
            let json_str = json_str.trim();
            if let Ok(value) = serde_json::from_str::<Value>(json_str) {
                if let Some(content) = value
                    .get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("delta"))
                    .and_then(|d| d.get("content"))
                    .and_then(|c| c.as_str())
                {
                    return Some(content.to_string());
                }
            }
        }
        None
    }

    fn aggregate_chunks(&self, chunks: &[&str]) -> String {
        let mut result = String::new();
        for chunk in chunks {
            if let Some(content) = self.parse_sse_chunk(chunk) {
                result.push_str(&content);
            }
        }
        result
    }
}

impl Default for StreamParsingBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BenchTarget for StreamParsingBenchmark {
    fn id(&self) -> String {
        "stream-parsing".to_string()
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
    async fn test_stream_parsing_benchmark() {
        let bench = StreamParsingBenchmark::with_iterations(100, 10);
        let result = bench.run_simulated().await.unwrap();

        assert!(result.get("chunk_parsing").is_some());
        assert!(result.get("stream_aggregation").is_some());
    }

    #[test]
    fn test_parse_sse_chunk() {
        let bench = StreamParsingBenchmark::new();

        let chunk = "data: {\"choices\":[{\"delta\":{\"content\":\"test\"}}]}\n\n";
        assert_eq!(bench.parse_sse_chunk(chunk), Some("test".to_string()));

        let done = "data: [DONE]\n\n";
        assert_eq!(bench.parse_sse_chunk(done), None);
    }
}
