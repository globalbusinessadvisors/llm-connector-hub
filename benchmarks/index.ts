#!/usr/bin/env node
/**
 * Main Benchmark Suite
 * Orchestrates all benchmark tests and generates comprehensive reports
 */

import { benchmarkProviders, compareProviders } from './provider-benchmark';
import { benchmarkCache, compareCacheImplementations } from './cache-benchmark';
import { benchmarkMiddleware, analyzeMiddlewareOverhead } from './middleware-benchmark';
import { benchmarkHub, analyzeHubPerformance } from './hub-benchmark';
import { runStressTests } from './stress-test';
import { runAllLoadTests } from './load-test';
import {
  BenchmarkSuite,
  getSystemInfo,
  saveBenchmarkSuite,
  printResults,
  checkThresholds,
} from './reporter';
import { DEFAULT_CONFIG } from './config';
import { BenchmarkResult } from './setup';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  suite: string;
  verbose: boolean;
  save: boolean;
  compareWith?: string;
} {
  const args = process.argv.slice(2);

  const suite = args.find((arg) => !arg.startsWith('--')) || 'all';
  const verbose = args.includes('--verbose') || args.includes('-v');
  const save = args.includes('--save') || args.includes('-s');
  const compareWith = args.find((arg) => arg.startsWith('--compare='))?.split('=')[1];

  return { suite, verbose, save, compareWith };
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Usage: tsx benchmarks/index.ts [suite] [options]

Suites:
  all              Run all benchmarks (default)
  provider         Run provider benchmarks only
  cache            Run cache benchmarks only
  middleware       Run middleware benchmarks only
  hub              Run hub benchmarks only
  stress           Run stress tests only
  load             Run load tests only

Options:
  --verbose, -v    Show detailed results
  --save, -s       Save results to file
  --compare=FILE   Compare with previous results

Examples:
  tsx benchmarks/index.ts
  tsx benchmarks/index.ts provider --verbose
  tsx benchmarks/index.ts all --save
  tsx benchmarks/index.ts provider --compare=results/baseline.json
`);
}

/**
 * Run provider benchmarks
 */
async function runProviderBenchmarks(verbose: boolean): Promise<BenchmarkResult[]> {
  const results = await benchmarkProviders();
  if (verbose) {
    compareProviders(results);
  }
  return results;
}

/**
 * Run cache benchmarks
 */
async function runCacheBenchmarks(verbose: boolean): Promise<BenchmarkResult[]> {
  const results = await benchmarkCache();
  if (verbose) {
    compareCacheImplementations(results);
  }
  return results;
}

/**
 * Run middleware benchmarks
 */
async function runMiddlewareBenchmarks(verbose: boolean): Promise<BenchmarkResult[]> {
  const results = await benchmarkMiddleware();
  if (verbose) {
    analyzeMiddlewareOverhead(results);
  }
  return results;
}

/**
 * Run hub benchmarks
 */
async function runHubBenchmarks(verbose: boolean): Promise<BenchmarkResult[]> {
  const results = await benchmarkHub();
  if (verbose) {
    analyzeHubPerformance(results);
  }
  return results;
}

/**
 * Run all standard benchmarks
 */
async function runAllBenchmarks(verbose: boolean): Promise<BenchmarkResult[]> {
  console.log('\n' + '='.repeat(80));
  console.log('  LLM CONNECTOR HUB - PERFORMANCE BENCHMARK SUITE');
  console.log('='.repeat(80) + '\n');

  const allResults: BenchmarkResult[] = [];

  console.log('📦 Running Provider Benchmarks...');
  allResults.push(...(await runProviderBenchmarks(verbose)));

  console.log('\n📦 Running Cache Benchmarks...');
  allResults.push(...(await runCacheBenchmarks(verbose)));

  console.log('\n📦 Running Middleware Benchmarks...');
  allResults.push(...(await runMiddlewareBenchmarks(verbose)));

  console.log('\n📦 Running Hub Benchmarks...');
  allResults.push(...(await runHubBenchmarks(verbose)));

  return allResults;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { suite, verbose, save, compareWith } = parseArgs();

  if (suite === 'help' || suite === '--help' || suite === '-h') {
    printUsage();
    return;
  }

  const startTime = Date.now();
  let results: BenchmarkResult[] = [];

  try {
    switch (suite) {
      case 'provider':
        results = await runProviderBenchmarks(verbose);
        break;

      case 'cache':
        results = await runCacheBenchmarks(verbose);
        break;

      case 'middleware':
        results = await runMiddlewareBenchmarks(verbose);
        break;

      case 'hub':
        results = await runHubBenchmarks(verbose);
        break;

      case 'stress':
        await runStressTests();
        console.log('\n✅ Stress tests completed successfully\n');
        return;

      case 'load':
        await runAllLoadTests();
        console.log('\n✅ Load tests completed successfully\n');
        return;

      case 'all':
      default:
        results = await runAllBenchmarks(verbose);
        break;
    }

    const duration = Date.now() - startTime;

    // Create benchmark suite
    const benchmarkSuite: BenchmarkSuite = {
      name: `${suite.charAt(0).toUpperCase() + suite.slice(1)} Benchmarks`,
      description: `Performance benchmarks for LLM Connector Hub - ${suite} suite`,
      timestamp: Date.now(),
      duration,
      results,
      systemInfo: getSystemInfo(),
      thresholds: DEFAULT_CONFIG.thresholds,
    };

    // Print results
    printResults(benchmarkSuite, verbose);

    // Check thresholds
    const thresholdResults = checkThresholds(results, DEFAULT_CONFIG.thresholds);

    // Save results if requested
    if (save) {
      const outputDir = DEFAULT_CONFIG.output.resultsDir;
      const jsonPath = saveBenchmarkSuite(benchmarkSuite, outputDir, 'json');
      const mdPath = saveBenchmarkSuite(benchmarkSuite, outputDir, 'markdown');

      console.log('\n📁 Results saved:');
      console.log(`   JSON: ${jsonPath}`);
      console.log(`   Markdown: ${mdPath}\n`);
    }

    // Compare with baseline if requested
    if (compareWith) {
      console.log('\n📊 Comparison with baseline not yet implemented\n');
      // TODO: Implement comparison logic
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log(`  BENCHMARK SUMMARY`);
    console.log('='.repeat(80));
    console.log(`  Suite:           ${benchmarkSuite.name}`);
    console.log(`  Duration:        ${(duration / 1000).toFixed(2)}s`);
    console.log(`  Total Tests:     ${results.length}`);
    console.log(`  Passed:          ${thresholdResults.passed}`);
    console.log(`  Warnings:        ${thresholdResults.warned}`);
    console.log(`  Failed:          ${thresholdResults.failed}`);
    console.log('='.repeat(80) + '\n');

    // Exit with appropriate code
    if (thresholdResults.failed > 0) {
      console.log('❌ Some benchmarks failed to meet performance thresholds\n');
      process.exit(1);
    } else if (thresholdResults.warned > 0) {
      console.log('⚠️  Some benchmarks exceeded target but within acceptable range\n');
      process.exit(0);
    } else {
      console.log('✅ All benchmarks passed performance thresholds\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Benchmark suite failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as runBenchmarks };
