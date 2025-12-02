//! I/O utilities for benchmark results
//!
//! This module provides functions to read and write benchmark results
//! to the canonical output directories.

use super::markdown::generate_markdown_report;
use super::result::BenchmarkResult;
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::info;

/// Default output directory for benchmark results.
pub const OUTPUT_DIR: &str = "benchmarks/output";

/// Default raw output directory for detailed results.
pub const RAW_OUTPUT_DIR: &str = "benchmarks/output/raw";

/// Default summary file name.
pub const SUMMARY_FILE: &str = "summary.md";

/// Ensure the output directories exist.
///
/// Creates the canonical output directories if they don't exist:
/// - `benchmarks/output/`
/// - `benchmarks/output/raw/`
///
/// # Arguments
///
/// * `base_path` - Base path for the benchmark crate
///
/// # Returns
///
/// The path to the output directory.
pub fn ensure_output_dirs(base_path: &Path) -> Result<PathBuf> {
    let output_dir = base_path.join(OUTPUT_DIR);
    let raw_dir = base_path.join(RAW_OUTPUT_DIR);

    fs::create_dir_all(&output_dir)
        .with_context(|| format!("Failed to create output directory: {:?}", output_dir))?;

    fs::create_dir_all(&raw_dir)
        .with_context(|| format!("Failed to create raw output directory: {:?}", raw_dir))?;

    info!("Output directories ensured at {:?}", output_dir);
    Ok(output_dir)
}

/// Write benchmark results to JSON file.
///
/// # Arguments
///
/// * `results` - Vector of benchmark results
/// * `output_path` - Path to write the JSON file
///
/// # Returns
///
/// `Ok(())` on success.
pub fn write_results_json(results: &[BenchmarkResult], output_path: &Path) -> Result<()> {
    let json = serde_json::to_string_pretty(results)
        .context("Failed to serialize benchmark results to JSON")?;

    fs::write(output_path, json)
        .with_context(|| format!("Failed to write results to {:?}", output_path))?;

    info!("Wrote {} results to {:?}", results.len(), output_path);
    Ok(())
}

/// Write benchmark summary to markdown file.
///
/// # Arguments
///
/// * `results` - Vector of benchmark results
/// * `output_path` - Path to write the markdown file
/// * `title` - Optional title for the report
///
/// # Returns
///
/// `Ok(())` on success.
pub fn write_summary_markdown(
    results: &[BenchmarkResult],
    output_path: &Path,
    title: Option<&str>,
) -> Result<()> {
    let markdown = generate_markdown_report(results, title);

    fs::write(output_path, markdown)
        .with_context(|| format!("Failed to write summary to {:?}", output_path))?;

    info!("Wrote summary to {:?}", output_path);
    Ok(())
}

/// Save all benchmark results to canonical output locations.
///
/// This writes:
/// - `benchmarks/output/summary.md` - Human-readable summary
/// - `benchmarks/output/raw/results-{timestamp}.json` - Raw JSON results
///
/// # Arguments
///
/// * `results` - Vector of benchmark results
/// * `base_path` - Base path for the benchmark crate
///
/// # Returns
///
/// `Ok(())` on success.
pub fn save_results(results: &[BenchmarkResult], base_path: &Path) -> Result<()> {
    let output_dir = ensure_output_dirs(base_path)?;
    let raw_dir = base_path.join(RAW_OUTPUT_DIR);

    // Write summary markdown
    let summary_path = output_dir.join(SUMMARY_FILE);
    write_summary_markdown(results, &summary_path, Some("Connector Hub Benchmark Results"))?;

    // Write raw JSON with timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let json_path = raw_dir.join(format!("results-{}.json", timestamp));
    write_results_json(results, &json_path)?;

    // Also write latest results
    let latest_path = raw_dir.join("results-latest.json");
    write_results_json(results, &latest_path)?;

    info!(
        "Saved {} benchmark results to {:?}",
        results.len(),
        output_dir
    );
    Ok(())
}

/// Read benchmark results from a JSON file.
///
/// # Arguments
///
/// * `input_path` - Path to the JSON file
///
/// # Returns
///
/// Vector of benchmark results.
pub fn read_results_json(input_path: &Path) -> Result<Vec<BenchmarkResult>> {
    let json = fs::read_to_string(input_path)
        .with_context(|| format!("Failed to read results from {:?}", input_path))?;

    let results: Vec<BenchmarkResult> = serde_json::from_str(&json)
        .context("Failed to deserialize benchmark results")?;

    info!("Read {} results from {:?}", results.len(), input_path);
    Ok(results)
}

/// List all result files in the raw output directory.
///
/// # Arguments
///
/// * `base_path` - Base path for the benchmark crate
///
/// # Returns
///
/// Vector of paths to result files.
pub fn list_result_files(base_path: &Path) -> Result<Vec<PathBuf>> {
    let raw_dir = base_path.join(RAW_OUTPUT_DIR);

    if !raw_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files: Vec<PathBuf> = fs::read_dir(&raw_dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .map_or(false, |ext| ext == "json")
        })
        .collect();

    files.sort();
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    #[test]
    fn test_ensure_output_dirs() {
        let temp_dir = TempDir::new().unwrap();
        let result = ensure_output_dirs(temp_dir.path());
        assert!(result.is_ok());

        let output_dir = temp_dir.path().join(OUTPUT_DIR);
        let raw_dir = temp_dir.path().join(RAW_OUTPUT_DIR);
        assert!(output_dir.exists());
        assert!(raw_dir.exists());
    }

    #[test]
    fn test_write_and_read_json() {
        let temp_dir = TempDir::new().unwrap();
        let json_path = temp_dir.path().join("test.json");

        let results = vec![BenchmarkResult::new(
            "test".to_string(),
            json!({"value": 42}),
        )];

        write_results_json(&results, &json_path).unwrap();
        let read_results = read_results_json(&json_path).unwrap();

        assert_eq!(read_results.len(), 1);
        assert_eq!(read_results[0].target_id, "test");
    }
}
