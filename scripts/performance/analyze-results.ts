#!/usr/bin/env node
/**
 * Analyze Benchmark Results
 * Parse, analyze, and visualize benchmark results
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BenchmarkSuite,
  loadBenchmarkSuite,
  compareBenchmarks,
  formatComparisonAsMarkdown,
  formatAsMarkdown,
} from '../../benchmarks/reporter';
import { formatTime, formatMemory, formatOpsPerSecond } from '../../benchmarks/setup';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  resultsDir?: string;
  baseline?: string;
  current?: string;
  output?: string;
  format?: 'json' | 'markdown' | 'csv';
} {
  const args = process.argv.slice(2);

  return {
    resultsDir: args.find((arg) => arg.startsWith('--dir='))?.split('=')[1],
    baseline: args.find((arg) => arg.startsWith('--baseline='))?.split('=')[1],
    current: args.find((arg) => arg.startsWith('--current='))?.split('=')[1],
    output: args.find((arg) => arg.startsWith('--output='))?.split('=')[1],
    format: (args.find((arg) => arg.startsWith('--format='))?.split('=')[1] as any) || 'markdown',
  };
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Usage: tsx scripts/performance/analyze-results.ts [options]

Options:
  --dir=PATH          Directory containing benchmark results
  --baseline=FILE     Baseline results file for comparison
  --current=FILE      Current results file for comparison
  --output=FILE       Output file for analysis report
  --format=TYPE       Output format: json, markdown, csv (default: markdown)

Examples:
  # Analyze all results in directory
  tsx scripts/performance/analyze-results.ts --dir=benchmarks/results

  # Compare two result files
  tsx scripts/performance/analyze-results.ts --baseline=baseline.json --current=current.json

  # Generate report to file
  tsx scripts/performance/analyze-results.ts --dir=benchmarks/results --output=report.md
`);
}

/**
 * Find all result files in directory
 */
function findResultFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json') && file.includes('benchmark'))
    .map((file) => path.join(dir, file))
    .sort((a, b) => {
      const statA = fs.statSync(a);
      const statB = fs.statSync(b);
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
}

/**
 * Analyze trends across multiple benchmark runs
 */
function analyzeTrends(suites: BenchmarkSuite[]): void {
  if (suites.length < 2) {
    console.log('Not enough results for trend analysis (need at least 2 runs)\n');
    return;
  }

  console.log('\n📈 Trend Analysis\n');
  console.log(`Analyzing ${suites.length} benchmark runs...\n`);

  // Group results by benchmark name
  const resultsByName = new Map<string, Array<{ timestamp: number; value: number }>>();

  for (const suite of suites) {
    for (const result of suite.results) {
      const existing = resultsByName.get(result.name) || [];
      existing.push({
        timestamp: suite.timestamp,
        value: result.averageTime,
      });
      resultsByName.set(result.name, existing);
    }
  }

  // Calculate trends
  console.log('Performance Trends (latest vs oldest):\n');

  for (const [name, values] of resultsByName.entries()) {
    if (values.length < 2) continue;

    values.sort((a, b) => a.timestamp - b.timestamp);
    const oldest = values[0].value;
    const latest = values[values.length - 1].value;
    const change = ((latest - oldest) / oldest) * 100;

    const trend = change > 0 ? '📉' : '📈';
    const color = change > 0 ? 'slower' : 'faster';

    console.log(
      `${trend} ${name.substring(0, 50).padEnd(50)} ${Math.abs(change).toFixed(1)}% ${color}`
    );
  }

  console.log('');
}

/**
 * Generate performance report
 */
function generateReport(suites: BenchmarkSuite[]): string {
  let report = '# Performance Analysis Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  if (suites.length === 0) {
    report += 'No benchmark results found.\n';
    return report;
  }

  // Latest results
  const latest = suites[0];
  report += '## Latest Benchmark Results\n\n';
  report += `- **Date:** ${new Date(latest.timestamp).toISOString()}\n`;
  report += `- **Duration:** ${(latest.duration / 1000).toFixed(2)}s\n`;
  report += `- **Tests:** ${latest.results.length}\n\n`;

  // Top performers
  report += '### Top Performers\n\n';
  const topPerformers = [...latest.results]
    .sort((a, b) => b.opsPerSecond - a.opsPerSecond)
    .slice(0, 10);

  report += '| Benchmark | Ops/sec | Avg Time |\n';
  report += '|-----------|---------|----------|\n';

  for (const result of topPerformers) {
    report += `| ${result.name} | ${formatOpsPerSecond(result.opsPerSecond)} | ${formatTime(result.averageTime)} |\n`;
  }

  report += '\n';

  // Slowest operations
  report += '### Slowest Operations\n\n';
  const slowest = [...latest.results]
    .sort((a, b) => b.averageTime - a.averageTime)
    .slice(0, 10);

  report += '| Benchmark | Avg Time | P99 Time |\n';
  report += '|-----------|----------|----------|\n';

  for (const result of slowest) {
    report += `| ${result.name} | ${formatTime(result.averageTime)} | ${formatTime(result.p99)} |\n`;
  }

  report += '\n';

  // Memory usage
  report += '### Memory Usage\n\n';
  const withMemory = latest.results.filter((r) => r.memoryUsage);

  if (withMemory.length > 0) {
    const totalMemory = withMemory.reduce((sum, r) => sum + (r.memoryUsage?.heapUsed || 0), 0);
    const avgMemory = totalMemory / withMemory.length;

    report += `- **Average Memory per Test:** ${formatMemory(avgMemory)}\n`;
    report += `- **Total Memory Growth:** ${formatMemory(totalMemory)}\n\n`;

    // Highest memory consumers
    const memoryConsumers = [...withMemory]
      .sort((a, b) => (b.memoryUsage?.heapUsed || 0) - (a.memoryUsage?.heapUsed || 0))
      .slice(0, 5);

    report += '#### Highest Memory Consumers\n\n';
    report += '| Benchmark | Memory Used |\n';
    report += '|-----------|--------------|\n';

    for (const result of memoryConsumers) {
      report += `| ${result.name} | ${formatMemory(result.memoryUsage?.heapUsed || 0)} |\n`;
    }

    report += '\n';
  }

  // Comparison with baseline if available
  if (suites.length > 1) {
    report += '## Comparison with Baseline\n\n';
    const comparison = compareBenchmarks(suites[suites.length - 1], suites[0]);

    if (comparison.improvements.length > 0) {
      report += '### Improvements\n\n';
      report += '| Benchmark | Improvement | Baseline | Current |\n';
      report += '|-----------|-------------|----------|----------|\n';

      for (const imp of comparison.improvements) {
        report += `| ${imp.name} | +${imp.improvement.toFixed(1)}% | ${formatOpsPerSecond(imp.baselineOps)} | ${formatOpsPerSecond(imp.currentOps)} |\n`;
      }

      report += '\n';
    }

    if (comparison.regressions.length > 0) {
      report += '### Regressions\n\n';
      report += '| Benchmark | Regression | Baseline | Current |\n';
      report += '|-----------|------------|----------|----------|\n';

      for (const reg of comparison.regressions) {
        report += `| ${reg.name} | -${reg.regression.toFixed(1)}% | ${formatOpsPerSecond(reg.baselineOps)} | ${formatOpsPerSecond(reg.currentOps)} |\n`;
      }

      report += '\n';
    }
  }

  // System information
  report += '## System Information\n\n';
  report += `- **Platform:** ${latest.systemInfo.platform} (${latest.systemInfo.arch})\n`;
  report += `- **Node.js:** ${latest.systemInfo.nodeVersion}\n`;
  report += `- **CPUs:** ${latest.systemInfo.cpus}\n`;
  report += `- **Memory:** ${formatMemory(latest.systemInfo.totalMemory)}\n\n`;

  return report;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  try {
    // Compare two specific files
    if (args.baseline && args.current) {
      console.log('\n📊 Comparing benchmark results...\n');

      const baseline = loadBenchmarkSuite(args.baseline);
      const current = loadBenchmarkSuite(args.current);

      const comparison = compareBenchmarks(baseline, current);
      const report = formatComparisonAsMarkdown(comparison);

      console.log(report);

      if (args.output) {
        fs.writeFileSync(args.output, report, 'utf-8');
        console.log(`\n✅ Comparison saved to: ${args.output}\n`);
      }

      return;
    }

    // Analyze directory of results
    const resultsDir = args.resultsDir || './benchmarks/results';
    const resultFiles = findResultFiles(resultsDir);

    if (resultFiles.length === 0) {
      console.log(`\n❌ No benchmark results found in: ${resultsDir}\n`);
      return;
    }

    console.log(`\n📊 Analyzing ${resultFiles.length} benchmark result(s)...\n`);

    const suites = resultFiles.map((file) => loadBenchmarkSuite(file));

    // Display latest results
    console.log('Latest Results:\n');
    console.log(`  Date: ${new Date(suites[0].timestamp).toLocaleString()}`);
    console.log(`  Tests: ${suites[0].results.length}`);
    console.log(`  Duration: ${(suites[0].duration / 1000).toFixed(2)}s\n`);

    // Trend analysis
    analyzeTrends(suites);

    // Generate full report
    const report = generateReport(suites);

    if (args.output) {
      fs.writeFileSync(args.output, report, 'utf-8');
      console.log(`\n✅ Report saved to: ${args.output}\n`);
    } else {
      console.log('\n' + '='.repeat(80));
      console.log(report);
      console.log('='.repeat(80) + '\n');
    }
  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as analyzeResults };
