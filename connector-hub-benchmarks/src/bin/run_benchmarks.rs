//! Benchmark CLI for Connector Hub
//!
//! This binary provides the canonical entrypoint for running all benchmarks
//! and writing results to the standard output directories.

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use connector_hub_benchmarks::{
    adapters::all_targets,
    benchmarks::{io, run_all_benchmarks, run_benchmarks_by_id},
};
use std::path::PathBuf;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Parser)]
#[command(name = "connector-hub-benchmarks")]
#[command(author = "LLM-Dev-Ops Team")]
#[command(version = "0.1.0")]
#[command(about = "Canonical benchmark suite for LLM Connector Hub", long_about = None)]
struct Cli {
    /// Enable verbose output
    #[arg(short, long, default_value_t = false)]
    verbose: bool,

    /// Output directory for results (defaults to benchmarks/output)
    #[arg(short, long)]
    output: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Run all benchmarks
    Run {
        /// Only run specific benchmark targets (comma-separated)
        #[arg(short, long)]
        targets: Option<String>,

        /// Write results to output directory
        #[arg(short, long, default_value_t = true)]
        save: bool,
    },

    /// List available benchmark targets
    List,

    /// Show summary of last benchmark run
    Summary,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(if cli.verbose { Level::DEBUG } else { Level::INFO })
        .with_target(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .context("Failed to set tracing subscriber")?;

    // Determine the base path for the benchmark crate
    let base_path = std::env::current_dir()?;
    let crate_path = if base_path.ends_with("connector-hub-benchmarks") {
        base_path
    } else {
        base_path.join("connector-hub-benchmarks")
    };

    match cli.command {
        Some(Commands::Run { targets, save }) => {
            run_benchmarks_command(targets, save, &crate_path).await?;
        }
        Some(Commands::List) => {
            list_targets_command();
        }
        Some(Commands::Summary) => {
            show_summary_command(&crate_path)?;
        }
        None => {
            // Default: run all benchmarks
            run_benchmarks_command(None, true, &crate_path).await?;
        }
    }

    Ok(())
}

async fn run_benchmarks_command(
    targets: Option<String>,
    save: bool,
    crate_path: &PathBuf,
) -> Result<()> {
    info!("Starting Connector Hub Benchmark Suite");
    info!("======================================");

    let results = if let Some(target_list) = targets {
        let target_ids: Vec<&str> = target_list.split(',').map(|s| s.trim()).collect();
        info!("Running {} specific benchmarks", target_ids.len());
        run_benchmarks_by_id(&target_ids).await
    } else {
        info!("Running all benchmarks");
        run_all_benchmarks().await
    };

    // Print results summary
    println!("\n{}", "=".repeat(60));
    println!("BENCHMARK RESULTS");
    println!("{}", "=".repeat(60));

    for result in &results {
        let status = if result.is_success() { "OK" } else { "FAIL" };
        println!("\n[{}] {}", status, result.target_id);

        if let Some(mean) = result.mean_ns() {
            println!("  Mean: {} ns ({:.2} us)", mean, mean as f64 / 1000.0);
        }
        if let Some(p99) = result.p99_ns() {
            println!("  P99:  {} ns ({:.2} us)", p99, p99 as f64 / 1000.0);
        }
        if let Some(throughput) = result.throughput() {
            println!("  Throughput: {:.2} ops/sec", throughput);
        }
    }

    println!("\n{}", "=".repeat(60));

    // Summary stats
    let total = results.len();
    let successful = results.iter().filter(|r| r.is_success()).count();
    println!(
        "Total: {} | Successful: {} | Failed: {}",
        total,
        successful,
        total - successful
    );
    println!("{}", "=".repeat(60));

    // Save results if requested
    if save {
        info!("Saving results to {:?}", crate_path);
        io::save_results(&results, crate_path)?;
        println!("\nResults saved to:");
        println!("  - {}/benchmarks/output/summary.md", crate_path.display());
        println!(
            "  - {}/benchmarks/output/raw/results-latest.json",
            crate_path.display()
        );
    }

    Ok(())
}

fn list_targets_command() {
    println!("Available Benchmark Targets:");
    println!("{}", "=".repeat(40));

    for target in all_targets() {
        println!("  - {}", target.id());
    }

    println!("\nUse --targets to run specific benchmarks:");
    println!("  run_benchmarks run --targets provider-resolution,cache-operations");
}

fn show_summary_command(crate_path: &PathBuf) -> Result<()> {
    let latest_path = crate_path.join("benchmarks/output/raw/results-latest.json");

    if !latest_path.exists() {
        println!("No previous benchmark results found.");
        println!("Run 'run_benchmarks run' to generate results.");
        return Ok(());
    }

    let results = io::read_results_json(&latest_path)?;

    println!("Last Benchmark Results:");
    println!("{}", "=".repeat(60));

    if let Some(first) = results.first() {
        println!(
            "Run at: {}",
            first.timestamp.format("%Y-%m-%d %H:%M:%S UTC")
        );
    }

    println!("\n{}", "-".repeat(60));
    println!(
        "{:<30} {:>10} {:>15}",
        "Target", "Status", "Mean (us)"
    );
    println!("{}", "-".repeat(60));

    for result in &results {
        let status = if result.is_success() { "OK" } else { "FAIL" };
        let mean = result
            .mean_ns()
            .map(|ns| format!("{:.2}", ns as f64 / 1000.0))
            .unwrap_or_else(|| "-".to_string());

        println!("{:<30} {:>10} {:>15}", result.target_id, status, mean);
    }

    println!("{}", "-".repeat(60));

    Ok(())
}
