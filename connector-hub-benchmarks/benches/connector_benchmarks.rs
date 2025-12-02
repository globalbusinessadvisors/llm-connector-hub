//! Criterion benchmarks for connector-hub operations
//!
//! These benchmarks use Criterion for micro-benchmarking and can be run with:
//! cargo bench

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use serde_json::{json, Value};
use std::collections::HashMap;

fn benchmark_cache_key_generation(c: &mut Criterion) {
    c.bench_function("cache_key_generation", |b| {
        let mut seed = 0u32;
        b.iter(|| {
            seed = seed.wrapping_add(1);
            let hash = seed.wrapping_mul(0x5bd1e995) ^ (seed >> 15);
            black_box(format!("cache:provider:model:{:08x}", hash))
        })
    });
}

fn benchmark_json_transformation(c: &mut Criterion) {
    let request = json!({
        "model": "gpt-4",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, how are you?"}
        ],
        "max_tokens": 1000,
        "temperature": 0.7
    });

    c.bench_function("request_transformation", |b| {
        b.iter(|| {
            let messages = request.get("messages").cloned().unwrap_or(Value::Null);
            black_box(json!({
                "model": request.get("model"),
                "prompt": messages,
                "max_tokens_to_sample": request.get("max_tokens")
            }))
        })
    });
}

fn benchmark_response_transformation(c: &mut Criterion) {
    let response = json!({
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": "I'm doing well!"},
            "finish_reason": "stop"
        }],
        "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18}
    });

    c.bench_function("response_transformation", |b| {
        b.iter(|| {
            black_box(json!({
                "content": response.get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("message")),
                "usage": response.get("usage"),
                "id": response.get("id")
            }))
        })
    });
}

fn benchmark_cache_operations(c: &mut Criterion) {
    let mut cache: HashMap<String, Value> = HashMap::new();
    let value = json!({"data": "cached_response"});

    // Populate cache
    for i in 0..1000 {
        cache.insert(format!("key-{}", i), value.clone());
    }

    c.bench_function("cache_get_hit", |b| {
        let key = "key-500".to_string();
        b.iter(|| black_box(cache.get(&key)))
    });

    c.bench_function("cache_get_miss", |b| {
        let key = "nonexistent-key".to_string();
        b.iter(|| black_box(cache.get(&key)))
    });
}

fn benchmark_sse_parsing(c: &mut Criterion) {
    let chunk = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n";

    c.bench_function("sse_chunk_parsing", |b| {
        b.iter(|| {
            if chunk.starts_with("data: [DONE]") {
                return black_box(None::<String>);
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
                        return black_box(Some(content.to_string()));
                    }
                }
            }
            black_box(None)
        })
    });
}

fn benchmark_provider_selection(c: &mut Criterion) {
    let providers = vec![
        ("openai", true, 100),
        ("anthropic", true, 150),
        ("google", false, 200),
        ("azure", true, 120),
        ("bedrock", true, 180),
    ];

    c.bench_function("provider_selection", |b| {
        b.iter(|| {
            // Select first healthy provider with lowest latency
            black_box(
                providers
                    .iter()
                    .filter(|(_, healthy, _)| *healthy)
                    .min_by_key(|(_, _, latency)| *latency)
                    .map(|(name, _, _)| *name),
            )
        })
    });
}

criterion_group!(
    benches,
    benchmark_cache_key_generation,
    benchmark_json_transformation,
    benchmark_response_transformation,
    benchmark_cache_operations,
    benchmark_sse_parsing,
    benchmark_provider_selection,
);

criterion_main!(benches);
