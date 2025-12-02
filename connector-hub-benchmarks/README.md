# Connector Hub Benchmarks

Canonical Rust benchmark suite for the LLM Connector Hub. This crate provides TS-Rust bridging adapters to benchmark representative Connector Hub operations without modifying any TypeScript code.

## Overview

This crate implements the canonical benchmark interface used across all 25 benchmark-target repositories:

- **`run_all_benchmarks()`**: Main entrypoint returning `Vec<BenchmarkResult>`
- **`BenchmarkResult`**: Standardized struct with `target_id`, `metrics`, and `timestamp`
- **`BenchTarget`** trait: Interface for benchmark targets with `id()` and `run()` methods
- **`all_targets()`**: Registry returning `Vec<Box<dyn BenchTarget>>`

## Directory Structure

```
connector-hub-benchmarks/
├── Cargo.toml
├── README.md
├── src/
│   ├── lib.rs                          # Main library exports
│   ├── bin/
│   │   └── run_benchmarks.rs           # CLI binary
│   ├── benchmarks/
│   │   ├── mod.rs                      # Benchmark orchestration
│   │   ├── result.rs                   # BenchmarkResult struct
│   │   ├── markdown.rs                 # Markdown report generation
│   │   └── io.rs                       # I/O utilities
│   └── adapters/
│       ├── mod.rs                      # BenchTarget trait & registry
│       ├── provider_resolution.rs      # Provider selection benchmarks
│       ├── request_transformation.rs   # Request/response transformation
│       ├── middleware_pipeline.rs      # Middleware overhead
│       ├── cache_operations.rs         # Cache performance
│       └── stream_parsing.rs           # SSE stream parsing
├── benches/
│   └── connector_benchmarks.rs         # Criterion micro-benchmarks
└── benchmarks/
    └── output/
        ├── summary.md                  # Human-readable summary
        └── raw/                        # Raw JSON results
```

## Usage

### Run All Benchmarks

```bash
cd connector-hub-benchmarks
cargo run --bin run_benchmarks
```

### Run Specific Benchmarks

```bash
cargo run --bin run_benchmarks -- run --targets provider-resolution,cache-operations
```

### List Available Targets

```bash
cargo run --bin run_benchmarks -- list
```

### Run Criterion Micro-benchmarks

```bash
cargo bench
```

## Benchmark Targets

| Target | Description |
|--------|-------------|
| `provider-resolution` | Provider selection and initialization latency |
| `request-transformation` | Request/response format conversion |
| `middleware-pipeline` | Middleware composition and execution overhead |
| `cache-operations` | Cache key generation and GET/SET/DELETE ops |
| `stream-parsing` | SSE chunk parsing and aggregation |

## TS-Rust Bridge

The adapters implement a dual-mode execution:

1. **TypeScript Bridge Mode**: Invokes the existing TypeScript benchmark suite via `npm run bench:*` commands and parses the results.

2. **Simulated Mode**: If TypeScript benchmarks are unavailable (e.g., `node_modules` not installed), runs pure Rust simulations of the operations.

This allows the benchmark suite to work both:
- As a standalone Rust benchmark (simulated)
- As a bridge to the comprehensive TypeScript benchmarks

## Output Format

### BenchmarkResult Structure

```rust
pub struct BenchmarkResult {
    pub target_id: String,
    pub metrics: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}
```

### Example Metrics

```json
{
  "iterations": 1000,
  "mean_ns": 1234,
  "p99_ns": 5678,
  "throughput": 810372.77,
  "status": "completed"
}
```

## Integration with TypeScript Suite

This Rust crate complements the existing TypeScript benchmark suite at `/benchmarks/`:

| TypeScript Benchmark | Rust Adapter |
|---------------------|--------------|
| `bench:hub` | `provider-resolution` |
| `bench:provider` | `request-transformation` |
| `bench:middleware` | `middleware-pipeline` |
| `bench:cache` | `cache-operations` |
| `bench:provider` | `stream-parsing` |

## License

MIT OR Apache-2.0
