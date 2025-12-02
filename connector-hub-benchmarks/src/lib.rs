//! # Connector Hub Benchmarks
//!
//! Canonical benchmark suite for the LLM Connector Hub.
//! Provides TS-Rust bridging adapters to benchmark representative
//! Connector Hub operations without modifying TypeScript code.
//!
//! ## Canonical Interface
//!
//! This crate exposes:
//! - `run_all_benchmarks()` - Main entrypoint returning `Vec<BenchmarkResult>`
//! - `BenchmarkResult` - Standardized result struct
//! - `BenchTarget` trait - Interface for benchmark targets
//! - Adapter implementations for Connector Hub operations

pub mod adapters;
pub mod benchmarks;

pub use benchmarks::result::BenchmarkResult;
pub use benchmarks::run_all_benchmarks;
pub use adapters::{BenchTarget, all_targets};
