/**
 * Benchmark Reporter
 * Formats and exports benchmark results in various formats
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BenchmarkResult,
  formatTime,
  formatMemory,
  formatOpsPerSecond,
} from './setup';
import { checkThreshold, PerformanceThresholds } from './config';

export interface BenchmarkSuite {
  name: string;
  description: string;
  timestamp: number;
  duration: number;
  results: BenchmarkResult[];
  systemInfo: SystemInfo;
  thresholds?: PerformanceThresholds;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
}

export interface ComparisonResult {
  baseline: BenchmarkSuite;
  current: BenchmarkSuite;
  improvements: {
    name: string;
    improvement: number; // Percentage
    baselineOps: number;
    currentOps: number;
  }[];
  regressions: {
    name: string;
    regression: number; // Percentage
    baselineOps: number;
    currentOps: number;
  }[];
}

/**
 * Get system information
 */
export function getSystemInfo(): SystemInfo {
  const os = require('os');
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
  };
}

/**
 * Format benchmark results as a markdown table
 */
export function formatAsMarkdown(suite: BenchmarkSuite): string {
  let output = `# ${suite.name}\n\n`;
  output += `${suite.description}\n\n`;
  output += `**Timestamp:** ${new Date(suite.timestamp).toISOString()}\n`;
  output += `**Duration:** ${(suite.duration / 1000).toFixed(2)}s\n\n`;

  // System Information
  output += `## System Information\n\n`;
  output += `- **Platform:** ${suite.systemInfo.platform} (${suite.systemInfo.arch})\n`;
  output += `- **Node.js:** ${suite.systemInfo.nodeVersion}\n`;
  output += `- **CPUs:** ${suite.systemInfo.cpus}\n`;
  output += `- **Memory:** ${formatMemory(suite.systemInfo.totalMemory)}\n\n`;

  // Results Table
  output += `## Results\n\n`;
  output += `| Benchmark | Iterations | Avg | Min | Max | P50 | P95 | P99 | Ops/sec | Memory |\n`;
  output += `|-----------|------------|-----|-----|-----|-----|-----|-----|---------|--------|\n`;

  for (const result of suite.results) {
    output += `| ${result.name} `;
    output += `| ${result.iterations.toLocaleString()} `;
    output += `| ${formatTime(result.averageTime)} `;
    output += `| ${formatTime(result.minTime)} `;
    output += `| ${formatTime(result.maxTime)} `;
    output += `| ${formatTime(result.p50)} `;
    output += `| ${formatTime(result.p95)} `;
    output += `| ${formatTime(result.p99)} `;
    output += `| ${formatOpsPerSecond(result.opsPerSecond)} `;
    output += `| ${result.memoryUsage ? formatMemory(result.memoryUsage.heapUsed) : 'N/A'} |\n`;
  }

  output += `\n`;

  // Detailed Statistics
  output += `## Detailed Statistics\n\n`;
  for (const result of suite.results) {
    output += `### ${result.name}\n\n`;
    output += `- **Iterations:** ${result.iterations.toLocaleString()}\n`;
    output += `- **Total Time:** ${formatTime(result.totalTime)}\n`;
    output += `- **Average:** ${formatTime(result.averageTime)}\n`;
    output += `- **Std Dev:** ${formatTime(result.stdDev)}\n`;
    output += `- **Min:** ${formatTime(result.minTime)}\n`;
    output += `- **Max:** ${formatTime(result.maxTime)}\n`;
    output += `- **Median:** ${formatTime(result.medianTime)}\n`;
    output += `- **P95:** ${formatTime(result.p95)}\n`;
    output += `- **P99:** ${formatTime(result.p99)}\n`;
    output += `- **Ops/sec:** ${formatOpsPerSecond(result.opsPerSecond)}\n`;

    if (result.memoryUsage) {
      output += `- **Memory (Heap):** ${formatMemory(result.memoryUsage.heapUsed)}\n`;
      output += `- **Memory (RSS):** ${formatMemory(result.memoryUsage.rss)}\n`;
    }

    output += `\n`;
  }

  return output;
}

/**
 * Format benchmark results as JSON
 */
export function formatAsJSON(suite: BenchmarkSuite): string {
  return JSON.stringify(suite, null, 2);
}

/**
 * Format benchmark results as CSV
 */
export function formatAsCSV(suite: BenchmarkSuite): string {
  let csv = 'Name,Iterations,Avg(μs),Min(μs),Max(μs),P50(μs),P95(μs),P99(μs),Ops/sec,StdDev(μs),HeapUsed(bytes)\n';

  for (const result of suite.results) {
    csv += `${result.name},`;
    csv += `${result.iterations},`;
    csv += `${result.averageTime.toFixed(2)},`;
    csv += `${result.minTime.toFixed(2)},`;
    csv += `${result.maxTime.toFixed(2)},`;
    csv += `${result.p50.toFixed(2)},`;
    csv += `${result.p95.toFixed(2)},`;
    csv += `${result.p99.toFixed(2)},`;
    csv += `${result.opsPerSecond.toFixed(2)},`;
    csv += `${result.stdDev.toFixed(2)},`;
    csv += `${result.memoryUsage?.heapUsed ?? 0}\n`;
  }

  return csv;
}

/**
 * Create an ASCII bar chart
 */
export function createBarChart(
  results: BenchmarkResult[],
  metric: 'averageTime' | 'opsPerSecond' = 'averageTime',
  width: number = 60
): string {
  const values = results.map((r) => ({
    name: r.name,
    value: r[metric],
  }));

  const maxValue = Math.max(...values.map((v) => v.value));
  const minValue = Math.min(...values.map((v) => v.value));
  const range = maxValue - minValue;

  let chart = '';
  const maxNameLength = Math.max(...values.map((v) => v.name.length));

  for (const item of values) {
    const normalizedValue = range === 0 ? 1 : (item.value - minValue) / range;
    const barLength = Math.round(normalizedValue * width);
    const bar = '█'.repeat(barLength);
    const spaces = ' '.repeat(Math.max(0, width - barLength));

    const formattedValue =
      metric === 'averageTime' ? formatTime(item.value) : formatOpsPerSecond(item.value);

    chart += `${item.name.padEnd(maxNameLength)} │${bar}${spaces}│ ${formattedValue}\n`;
  }

  return chart;
}

/**
 * Compare two benchmark suites
 */
export function compareBenchmarks(
  baseline: BenchmarkSuite,
  current: BenchmarkSuite
): ComparisonResult {
  const improvements: ComparisonResult['improvements'] = [];
  const regressions: ComparisonResult['regressions'] = [];

  // Create a map of baseline results
  const baselineMap = new Map(baseline.results.map((r) => [r.name, r]));

  for (const currentResult of current.results) {
    const baselineResult = baselineMap.get(currentResult.name);
    if (!baselineResult) continue;

    const improvementPercent =
      ((currentResult.opsPerSecond - baselineResult.opsPerSecond) / baselineResult.opsPerSecond) *
      100;

    if (improvementPercent > 5) {
      // Consider significant if > 5%
      improvements.push({
        name: currentResult.name,
        improvement: improvementPercent,
        baselineOps: baselineResult.opsPerSecond,
        currentOps: currentResult.opsPerSecond,
      });
    } else if (improvementPercent < -5) {
      regressions.push({
        name: currentResult.name,
        regression: Math.abs(improvementPercent),
        baselineOps: baselineResult.opsPerSecond,
        currentOps: currentResult.opsPerSecond,
      });
    }
  }

  return {
    baseline,
    current,
    improvements,
    regressions,
  };
}

/**
 * Format comparison results as markdown
 */
export function formatComparisonAsMarkdown(comparison: ComparisonResult): string {
  let output = `# Benchmark Comparison\n\n`;
  output += `**Baseline:** ${new Date(comparison.baseline.timestamp).toISOString()}\n`;
  output += `**Current:** ${new Date(comparison.current.timestamp).toISOString()}\n\n`;

  if (comparison.improvements.length > 0) {
    output += `## Improvements 🎉\n\n`;
    output += `| Benchmark | Improvement | Baseline | Current |\n`;
    output += `|-----------|-------------|----------|----------|\n`;

    for (const imp of comparison.improvements) {
      output += `| ${imp.name} `;
      output += `| +${imp.improvement.toFixed(1)}% `;
      output += `| ${formatOpsPerSecond(imp.baselineOps)} `;
      output += `| ${formatOpsPerSecond(imp.currentOps)} |\n`;
    }
    output += `\n`;
  }

  if (comparison.regressions.length > 0) {
    output += `## Regressions ⚠️\n\n`;
    output += `| Benchmark | Regression | Baseline | Current |\n`;
    output += `|-----------|------------|----------|----------|\n`;

    for (const reg of comparison.regressions) {
      output += `| ${reg.name} `;
      output += `| -${reg.regression.toFixed(1)}% `;
      output += `| ${formatOpsPerSecond(reg.baselineOps)} `;
      output += `| ${formatOpsPerSecond(reg.currentOps)} |\n`;
    }
    output += `\n`;
  }

  if (comparison.improvements.length === 0 && comparison.regressions.length === 0) {
    output += `No significant changes detected (threshold: ±5%)\n\n`;
  }

  return output;
}

/**
 * Save benchmark suite to file
 */
export function saveBenchmarkSuite(
  suite: BenchmarkSuite,
  outputDir: string,
  format: 'json' | 'csv' | 'markdown' = 'json'
): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date(suite.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `${suite.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;

  let content: string;
  let extension: string;

  switch (format) {
    case 'json':
      content = formatAsJSON(suite);
      extension = 'json';
      break;
    case 'csv':
      content = formatAsCSV(suite);
      extension = 'csv';
      break;
    case 'markdown':
      content = formatAsMarkdown(suite);
      extension = 'md';
      break;
  }

  const filepath = path.join(outputDir, `${filename}.${extension}`);
  fs.writeFileSync(filepath, content, 'utf-8');

  return filepath;
}

/**
 * Load benchmark suite from JSON file
 */
export function loadBenchmarkSuite(filepath: string): BenchmarkSuite {
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Print benchmark results to console
 */
export function printResults(suite: BenchmarkSuite, verbose: boolean = false): void {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${suite.name}`);
  console.log('='.repeat(80) + '\n');

  console.log(createBarChart(suite.results, 'opsPerSecond'));
  console.log('');

  if (verbose) {
    console.log(formatAsMarkdown(suite));
  } else {
    // Print summary table
    console.log('Summary:');
    console.log(
      'Name'.padEnd(40) +
        'Avg'.padEnd(12) +
        'P95'.padEnd(12) +
        'P99'.padEnd(12) +
        'Ops/sec'
    );
    console.log('-'.repeat(80));

    for (const result of suite.results) {
      console.log(
        result.name.padEnd(40) +
          formatTime(result.averageTime).padEnd(12) +
          formatTime(result.p95).padEnd(12) +
          formatTime(result.p99).padEnd(12) +
          formatOpsPerSecond(result.opsPerSecond)
      );
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Check results against thresholds and print status
 */
export function checkThresholds(
  results: BenchmarkResult[],
  thresholds: PerformanceThresholds
): {
  passed: number;
  warned: number;
  failed: number;
} {
  let passed = 0;
  let warned = 0;
  let failed = 0;

  console.log('\nThreshold Checks:\n');
  console.log('-'.repeat(80));

  for (const result of results) {
    // Determine which threshold to check based on benchmark name
    let threshold;
    if (result.name.includes('Provider')) {
      threshold = thresholds.providerOverhead;
    } else if (result.name.includes('Cache')) {
      threshold = thresholds.cacheOperations.get;
    } else if (result.name.includes('Middleware')) {
      threshold = thresholds.middlewareOverhead.perMiddleware;
    } else if (result.name.includes('Hub')) {
      threshold = thresholds.hubOrchestration.endToEnd;
    } else {
      continue; // Skip if no matching threshold
    }

    const check = checkThreshold(result.averageTime, threshold);

    let icon = '';
    switch (check.status) {
      case 'pass':
        icon = '✓';
        passed++;
        break;
      case 'warning':
        icon = '⚠';
        warned++;
        break;
      case 'fail':
        icon = '✗';
        failed++;
        break;
    }

    console.log(`${icon} ${result.name.padEnd(40)} ${check.message}`);
  }

  console.log('-'.repeat(80));
  console.log(
    `\nTotal: ${passed} passed, ${warned} warnings, ${failed} failed\n`
  );

  return { passed, warned, failed };
}
