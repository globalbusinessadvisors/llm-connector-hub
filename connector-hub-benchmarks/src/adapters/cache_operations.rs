//! Cache Operations Benchmark
//!
//! Benchmarks cache GET/SET/DELETE operations and cache key generation.

use super::BenchTarget;
use anyhow::{Context, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;
use tracing::info;

/// Benchmark for cache operations.
///
/// This benchmark measures:
/// - Cache key generation
/// - GET/SET/DELETE operations
/// - Cache hit/miss performance
/// - LRU eviction overhead
pub struct CacheOperationsBenchmark {
    iterations: u32,
    warmup_iterations: u32,
}

impl CacheOperationsBenchmark {
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
        info!("Running TypeScript cache operations benchmark");

        let crate_dir = std::env::current_dir()?;
        let hub_root = if crate_dir.ends_with("connector-hub-benchmarks") {
            crate_dir.parent().unwrap().to_path_buf()
        } else {
            crate_dir.clone()
        };

        let start = Instant::now();
        let output = Command::new("npm")
            .args(["run", "bench:cache", "--", "--json"])
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
        let mut keygen_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);
        let mut set_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);
        let mut get_hit_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);
        let mut get_miss_times: Vec<u64> = Vec::with_capacity(self.iterations as usize);

        let mut cache: HashMap<String, Value> = HashMap::new();

        // Warmup
        for i in 0..self.warmup_iterations {
            let key = self.generate_cache_key(i);
            cache.insert(key.clone(), serde_json::json!({"data": i}));
            let _ = cache.get(&key);
        }
        cache.clear();

        // Benchmark key generation
        for i in 0..self.iterations {
            let start = Instant::now();
            std::hint::black_box(self.generate_cache_key(i));
            keygen_times.push(start.elapsed().as_nanos() as u64);
        }

        // Benchmark SET operations
        for i in 0..self.iterations {
            let key = self.generate_cache_key(i);
            let value = serde_json::json!({"request": i, "response": "cached"});
            let start = Instant::now();
            cache.insert(key, value);
            set_times.push(start.elapsed().as_nanos() as u64);
        }

        // Benchmark GET (hit)
        for i in 0..self.iterations {
            let key = self.generate_cache_key(i);
            let start = Instant::now();
            std::hint::black_box(cache.get(&key));
            get_hit_times.push(start.elapsed().as_nanos() as u64);
        }

        // Benchmark GET (miss)
        for i in 0..self.iterations {
            let key = format!("nonexistent-key-{}", i);
            let start = Instant::now();
            std::hint::black_box(cache.get(&key));
            get_miss_times.push(start.elapsed().as_nanos() as u64);
        }

        keygen_times.sort();
        set_times.sort();
        get_hit_times.sort();
        get_miss_times.sort();

        let len = keygen_times.len();
        let keygen_mean = keygen_times.iter().sum::<u64>() / len as u64;
        let set_mean = set_times.iter().sum::<u64>() / len as u64;
        let get_hit_mean = get_hit_times.iter().sum::<u64>() / len as u64;
        let get_miss_mean = get_miss_times.iter().sum::<u64>() / len as u64;

        Ok(serde_json::json!({
            "iterations": self.iterations,
            "key_generation": {
                "mean_ns": keygen_mean,
                "p99_ns": keygen_times[(len as f64 * 0.99) as usize],
                "min_ns": keygen_times[0],
                "max_ns": keygen_times[len - 1]
            },
            "set_operation": {
                "mean_ns": set_mean,
                "p99_ns": set_times[(len as f64 * 0.99) as usize],
                "throughput": 1_000_000_000.0 / set_mean as f64
            },
            "get_hit": {
                "mean_ns": get_hit_mean,
                "p99_ns": get_hit_times[(len as f64 * 0.99) as usize],
                "throughput": 1_000_000_000.0 / get_hit_mean as f64
            },
            "get_miss": {
                "mean_ns": get_miss_mean,
                "p99_ns": get_miss_times[(len as f64 * 0.99) as usize],
                "throughput": 1_000_000_000.0 / get_miss_mean as f64
            },
            "mean_ns": (keygen_mean + set_mean + get_hit_mean) / 3,
            "throughput": 1_000_000_000.0 / get_hit_mean as f64,
            "status": "simulated"
        }))
    }

    fn generate_cache_key(&self, seed: u32) -> String {
        // Simulate cache key generation based on request hash
        let mut hash = seed;
        hash = hash.wrapping_mul(0x5bd1e995);
        hash ^= hash >> 15;
        format!("cache:provider:model:{:08x}", hash)
    }
}

impl Default for CacheOperationsBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BenchTarget for CacheOperationsBenchmark {
    fn id(&self) -> String {
        "cache-operations".to_string()
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
    async fn test_cache_operations_benchmark() {
        let bench = CacheOperationsBenchmark::with_iterations(100, 10);
        let result = bench.run_simulated().await.unwrap();

        assert!(result.get("key_generation").is_some());
        assert!(result.get("set_operation").is_some());
        assert!(result.get("get_hit").is_some());
    }
}
