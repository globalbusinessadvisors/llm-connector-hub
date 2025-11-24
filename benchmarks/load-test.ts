/**
 * Load Test
 * Progressive load testing with ramp-up, peak, endurance, and spike scenarios
 */

import {
  createMockRequest,
  createMockResponse,
  formatOpsPerSecond,
  formatMemory,
  sleep,
} from './setup';
import { SCENARIOS } from './config';

/**
 * Load test results
 */
interface LoadTestResult {
  scenario: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgThroughput: number;
  peakThroughput: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  memoryStats: {
    start: number;
    peak: number;
    end: number;
    growth: number;
  };
}

/**
 * Mock LLM service with configurable latency
 */
class MockService {
  private baseLatency: number;
  private jitter: number;

  constructor(baseLatency: number = 50, jitter: number = 20) {
    this.baseLatency = baseLatency;
    this.jitter = jitter;
  }

  async process(request: any): Promise<any> {
    const latency = this.baseLatency + Math.random() * this.jitter;
    await sleep(latency);
    return createMockResponse();
  }

  setLatency(latency: number): void {
    this.baseLatency = latency;
  }
}

/**
 * Load test coordinator
 */
class LoadTestCoordinator {
  private service: MockService;
  private activeRequests: number = 0;
  private completedRequests: number = 0;
  private failedRequests: number = 0;
  private latencies: number[] = [];
  private throughputSamples: number[] = [];
  private startMemory: number = 0;
  private peakMemory: number = 0;
  private monitorInterval?: NodeJS.Timeout;

  constructor(service: MockService) {
    this.service = service;
  }

  async executeRequest(): Promise<void> {
    this.activeRequests++;
    const startTime = Date.now();

    try {
      await this.service.process(createMockRequest(3));
      const latency = Date.now() - startTime;
      this.latencies.push(latency);
      this.completedRequests++;
    } catch (error) {
      this.failedRequests++;
    } finally {
      this.activeRequests--;
    }
  }

  startMonitoring(): void {
    this.startMemory = process.memoryUsage().heapUsed;
    this.peakMemory = this.startMemory;

    let lastCompletedCount = 0;

    this.monitorInterval = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory > this.peakMemory) {
        this.peakMemory = currentMemory;
      }

      // Calculate throughput
      const newCompletions = this.completedRequests - lastCompletedCount;
      this.throughputSamples.push(newCompletions);
      lastCompletedCount = this.completedRequests;
    }, 1000);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }

  getResults(scenario: string, duration: number): LoadTestResult {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const avgLatency = this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length;

    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    const avgThroughput =
      (this.completedRequests / duration) * 1000; // Convert to per second
    const peakThroughput = Math.max(...this.throughputSamples, 0);

    const endMemory = process.memoryUsage().heapUsed;

    return {
      scenario,
      duration,
      totalRequests: this.completedRequests + this.failedRequests,
      successfulRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      avgThroughput,
      peakThroughput,
      avgLatency,
      p95Latency: sortedLatencies[p95Index] || 0,
      p99Latency: sortedLatencies[p99Index] || 0,
      memoryStats: {
        start: this.startMemory,
        peak: this.peakMemory,
        end: endMemory,
        growth: endMemory - this.startMemory,
      },
    };
  }

  reset(): void {
    this.activeRequests = 0;
    this.completedRequests = 0;
    this.failedRequests = 0;
    this.latencies = [];
    this.throughputSamples = [];
  }
}

/**
 * Ramp-up load test
 */
export async function runRampUpTest(): Promise<LoadTestResult> {
  console.log('\n🔬 Running Ramp-Up Load Test...\n');

  const service = new MockService(30, 10);
  const coordinator = new LoadTestCoordinator(service);

  const scenario = SCENARIOS.load.rampUp;
  const startTime = Date.now();

  coordinator.startMonitoring();

  const step = (scenario.endConcurrency - scenario.startConcurrency) / scenario.steps;

  console.log(`  Starting at ${scenario.startConcurrency} concurrent requests`);
  console.log(`  Ramping up to ${scenario.endConcurrency} over ${scenario.steps} steps`);
  console.log(`  ${scenario.stepDuration}ms per step\n`);

  for (let i = 0; i < scenario.steps; i++) {
    const concurrency = Math.floor(scenario.startConcurrency + step * i);
    const stepStartTime = Date.now();

    console.log(`  Step ${i + 1}/${scenario.steps}: ${concurrency} concurrent requests`);

    // Launch concurrent workers
    const workers: Promise<void>[] = [];

    for (let j = 0; j < concurrency; j++) {
      workers.push(
        (async () => {
          while (Date.now() - stepStartTime < scenario.stepDuration) {
            await coordinator.executeRequest();
          }
        })()
      );
    }

    await Promise.all(workers);

    const stepCompleted = coordinator['completedRequests'];
    const stepThroughput = (stepCompleted / ((Date.now() - startTime) / 1000)).toFixed(0);

    console.log(`    Completed: ${stepCompleted} (${stepThroughput} req/s)\n`);
  }

  coordinator.stopMonitoring();
  const duration = Date.now() - startTime;
  const result = coordinator.getResults('Ramp-Up Test', duration);

  console.log('  Results:');
  console.log(`    Duration:        ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`    Total Requests:  ${result.totalRequests}`);
  console.log(`    Success Rate:    ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`);
  console.log(`    Avg Throughput:  ${formatOpsPerSecond(result.avgThroughput)}`);
  console.log(`    Peak Throughput: ${formatOpsPerSecond(result.peakThroughput)}`);
  console.log(`    Avg Latency:     ${result.avgLatency.toFixed(0)}ms`);
  console.log(`    P95 Latency:     ${result.p95Latency.toFixed(0)}ms`);
  console.log(`    P99 Latency:     ${result.p99Latency.toFixed(0)}ms`);
  console.log(`    Memory Growth:   ${formatMemory(result.memoryStats.growth)}`);

  console.log('\n✅ Ramp-up test completed\n');

  return result;
}

/**
 * Peak load test
 */
export async function runPeakLoadTest(): Promise<LoadTestResult> {
  console.log('\n🔬 Running Peak Load Test...\n');

  const service = new MockService(30, 10);
  const coordinator = new LoadTestCoordinator(service);

  const scenario = SCENARIOS.load.peak;
  const startTime = Date.now();

  coordinator.startMonitoring();

  console.log(`  Concurrency: ${scenario.concurrency}`);
  console.log(`  Duration:    ${(scenario.duration / 1000).toFixed(0)}s\n`);

  // Launch concurrent workers
  const workers: Promise<void>[] = [];

  for (let i = 0; i < scenario.concurrency; i++) {
    workers.push(
      (async () => {
        while (Date.now() - startTime < scenario.duration) {
          await coordinator.executeRequest();
        }
      })()
    );
  }

  // Progress reporting
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = (elapsed / scenario.duration) * 100;
    const completed = coordinator['completedRequests'];
    const throughput = (completed / (elapsed / 1000)).toFixed(0);

    console.log(
      `  Progress: ${progress.toFixed(0)}% | Completed: ${completed} | Throughput: ${throughput} req/s`
    );
  }, 5000);

  await Promise.all(workers);
  clearInterval(progressInterval);

  coordinator.stopMonitoring();
  const duration = Date.now() - startTime;
  const result = coordinator.getResults('Peak Load Test', duration);

  console.log('\n  Results:');
  console.log(`    Duration:        ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`    Total Requests:  ${result.totalRequests}`);
  console.log(`    Success Rate:    ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`);
  console.log(`    Avg Throughput:  ${formatOpsPerSecond(result.avgThroughput)}`);
  console.log(`    Peak Throughput: ${formatOpsPerSecond(result.peakThroughput)}`);
  console.log(`    Avg Latency:     ${result.avgLatency.toFixed(0)}ms`);
  console.log(`    P95 Latency:     ${result.p95Latency.toFixed(0)}ms`);
  console.log(`    P99 Latency:     ${result.p99Latency.toFixed(0)}ms`);
  console.log(`    Memory Growth:   ${formatMemory(result.memoryStats.growth)}`);

  console.log('\n✅ Peak load test completed\n');

  return result;
}

/**
 * Endurance test
 */
export async function runEnduranceTest(): Promise<LoadTestResult> {
  console.log('\n🔬 Running Endurance Test...\n');

  const service = new MockService(30, 10);
  const coordinator = new LoadTestCoordinator(service);

  const scenario = SCENARIOS.load.endurance;
  const startTime = Date.now();

  coordinator.startMonitoring();

  console.log(`  Concurrency: ${scenario.concurrency}`);
  console.log(`  Duration:    ${(scenario.duration / 1000).toFixed(0)}s\n`);
  console.log('  This test will run for 5 minutes...\n');

  // Launch concurrent workers
  const workers: Promise<void>[] = [];

  for (let i = 0; i < scenario.concurrency; i++) {
    workers.push(
      (async () => {
        while (Date.now() - startTime < scenario.duration) {
          await coordinator.executeRequest();
        }
      })()
    );
  }

  // Progress reporting every 30 seconds
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = (elapsed / scenario.duration) * 100;
    const completed = coordinator['completedRequests'];
    const throughput = (completed / (elapsed / 1000)).toFixed(0);
    const currentMemory = process.memoryUsage().heapUsed;

    console.log(
      `  Progress: ${progress.toFixed(0)}% | Completed: ${completed} | Throughput: ${throughput} req/s | Memory: ${formatMemory(currentMemory)}`
    );
  }, 30000);

  await Promise.all(workers);
  clearInterval(progressInterval);

  coordinator.stopMonitoring();
  const duration = Date.now() - startTime;
  const result = coordinator.getResults('Endurance Test', duration);

  console.log('\n  Results:');
  console.log(`    Duration:        ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`    Total Requests:  ${result.totalRequests}`);
  console.log(`    Success Rate:    ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`);
  console.log(`    Avg Throughput:  ${formatOpsPerSecond(result.avgThroughput)}`);
  console.log(`    Peak Throughput: ${formatOpsPerSecond(result.peakThroughput)}`);
  console.log(`    Avg Latency:     ${result.avgLatency.toFixed(0)}ms`);
  console.log(`    P95 Latency:     ${result.p95Latency.toFixed(0)}ms`);
  console.log(`    P99 Latency:     ${result.p99Latency.toFixed(0)}ms`);
  console.log(`    Peak Memory:     ${formatMemory(result.memoryStats.peak)}`);
  console.log(`    Memory Growth:   ${formatMemory(result.memoryStats.growth)}`);

  // Check for memory growth issues
  const growthRate = (result.memoryStats.growth / result.memoryStats.start) * 100;
  if (growthRate > 20) {
    console.log(`    ⚠️  WARNING: High memory growth (${growthRate.toFixed(1)}%)`);
  }

  console.log('\n✅ Endurance test completed\n');

  return result;
}

/**
 * Spike test
 */
export async function runSpikeTest(): Promise<LoadTestResult> {
  console.log('\n🔬 Running Spike Test...\n');

  const service = new MockService(30, 10);
  const coordinator = new LoadTestCoordinator(service);

  const scenario = SCENARIOS.load.spike;
  const startTime = Date.now();

  coordinator.startMonitoring();

  console.log(`  Base Concurrency:  ${scenario.baseConcurrency}`);
  console.log(`  Spike Concurrency: ${scenario.spikeConcurrency}`);
  console.log(`  Spike Duration:    ${(scenario.spikeDuration / 1000).toFixed(0)}s`);
  console.log(`  Cycles:            ${scenario.cycles}\n`);

  for (let cycle = 0; cycle < scenario.cycles; cycle++) {
    console.log(`  Cycle ${cycle + 1}/${scenario.cycles}:`);

    // Base load phase
    console.log(`    Phase 1: Base load (${scenario.baseConcurrency} concurrent)`);
    const baseStartTime = Date.now();
    const baseWorkers: Promise<void>[] = [];

    for (let i = 0; i < scenario.baseConcurrency; i++) {
      baseWorkers.push(
        (async () => {
          while (Date.now() - baseStartTime < scenario.spikeDuration) {
            await coordinator.executeRequest();
          }
        })()
      );
    }

    await Promise.all(baseWorkers);

    // Spike phase
    console.log(`    Phase 2: Spike load (${scenario.spikeConcurrency} concurrent)`);
    const spikeStartTime = Date.now();
    const spikeWorkers: Promise<void>[] = [];

    for (let i = 0; i < scenario.spikeConcurrency; i++) {
      spikeWorkers.push(
        (async () => {
          while (Date.now() - spikeStartTime < scenario.spikeDuration) {
            await coordinator.executeRequest();
          }
        })()
      );
    }

    await Promise.all(spikeWorkers);

    const cycleCompleted = coordinator['completedRequests'];
    console.log(`    Completed: ${cycleCompleted}\n`);
  }

  coordinator.stopMonitoring();
  const duration = Date.now() - startTime;
  const result = coordinator.getResults('Spike Test', duration);

  console.log('  Results:');
  console.log(`    Duration:        ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`    Total Requests:  ${result.totalRequests}`);
  console.log(`    Success Rate:    ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`);
  console.log(`    Avg Throughput:  ${formatOpsPerSecond(result.avgThroughput)}`);
  console.log(`    Peak Throughput: ${formatOpsPerSecond(result.peakThroughput)}`);
  console.log(`    Avg Latency:     ${result.avgLatency.toFixed(0)}ms`);
  console.log(`    P95 Latency:     ${result.p95Latency.toFixed(0)}ms`);
  console.log(`    P99 Latency:     ${result.p99Latency.toFixed(0)}ms`);
  console.log(`    Memory Growth:   ${formatMemory(result.memoryStats.growth)}`);

  console.log('\n✅ Spike test completed\n');

  return result;
}

/**
 * Run all load tests
 */
export async function runAllLoadTests(): Promise<LoadTestResult[]> {
  console.log('\n' + '='.repeat(80));
  console.log('  LOAD TESTING SUITE');
  console.log('='.repeat(80) + '\n');

  const results: LoadTestResult[] = [];
  const startTime = Date.now();

  try {
    results.push(await runRampUpTest());
    await sleep(2000); // Brief pause between tests

    results.push(await runPeakLoadTest());
    await sleep(2000);

    // Skip endurance test by default (takes 5 minutes)
    console.log('  ℹ️  Skipping endurance test (5 minutes) - run separately if needed\n');

    results.push(await runSpikeTest());
  } catch (error) {
    console.error('\n❌ Load test failed:', error);
    throw error;
  }

  const duration = Date.now() - startTime;

  console.log('='.repeat(80));
  console.log(`  All load tests completed in ${(duration / 1000).toFixed(1)}s`);
  console.log('='.repeat(80) + '\n');

  // Print summary
  console.log('Summary:\n');
  for (const result of results) {
    console.log(`  ${result.scenario}:`);
    console.log(`    Throughput: ${formatOpsPerSecond(result.avgThroughput)}`);
    console.log(`    P95 Latency: ${result.p95Latency.toFixed(0)}ms`);
    console.log(`    Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`);
    console.log('');
  }

  return results;
}

/**
 * Run load tests if executed directly
 */
if (require.main === module) {
  runAllLoadTests().catch((error) => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}
