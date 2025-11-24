/**
 * Stress Test
 * Tests system under heavy load with concurrent requests, memory leak detection, and sustained load
 */

import {
  runConcurrent,
  detectMemoryLeak,
  createMockRequest,
  createMockResponse,
  formatTime,
  formatMemory,
  formatOpsPerSecond,
  sleep,
} from './setup';
import { DEFAULT_CONFIG } from './config';

/**
 * Mock service for stress testing
 */
class MockLLMService {
  private requestCount = 0;
  private errorRate = 0;

  async processRequest(request: any): Promise<any> {
    this.requestCount++;

    // Simulate processing time with some variance
    const processingTime = 10 + Math.random() * 20;
    await sleep(processingTime);

    // Simulate occasional errors
    if (Math.random() < this.errorRate) {
      throw new Error('Simulated service error');
    }

    return createMockResponse(`Response to request ${this.requestCount}`);
  }

  setErrorRate(rate: number): void {
    this.errorRate = rate;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  reset(): void {
    this.requestCount = 0;
  }
}

/**
 * Resource monitor
 */
class ResourceMonitor {
  private samples: {
    timestamp: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
  }[] = [];

  private startCpu: NodeJS.CpuUsage;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.startCpu = process.cpuUsage();
  }

  start(intervalMs: number = 1000): void {
    this.intervalId = setInterval(() => {
      this.samples.push({
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  getStats() {
    if (this.samples.length === 0) {
      return null;
    }

    const heapUsed = this.samples.map((s) => s.memory.heapUsed);
    const rss = this.samples.map((s) => s.memory.rss);

    const avgHeap = heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length;
    const maxHeap = Math.max(...heapUsed);
    const minHeap = Math.min(...heapUsed);

    const avgRss = rss.reduce((a, b) => a + b, 0) / rss.length;
    const maxRss = Math.max(...rss);

    // Calculate memory growth rate
    const firstHeap = heapUsed[0];
    const lastHeap = heapUsed[heapUsed.length - 1];
    const heapGrowth = lastHeap - firstHeap;
    const heapGrowthRate = firstHeap > 0 ? (heapGrowth / firstHeap) * 100 : 0;

    // Calculate CPU usage
    const lastCpu = this.samples[this.samples.length - 1].cpu;
    const cpuUser = (lastCpu.user - this.startCpu.user) / 1000; // Convert to ms
    const cpuSystem = (lastCpu.system - this.startCpu.system) / 1000;

    return {
      memory: {
        avgHeap,
        maxHeap,
        minHeap,
        avgRss,
        maxRss,
        heapGrowth,
        heapGrowthRate,
      },
      cpu: {
        user: cpuUser,
        system: cpuSystem,
        total: cpuUser + cpuSystem,
      },
      sampleCount: this.samples.length,
    };
  }

  clear(): void {
    this.samples = [];
    this.startCpu = process.cpuUsage();
  }
}

/**
 * Run concurrent stress test
 */
export async function runConcurrentStressTest(): Promise<void> {
  console.log('\n🔬 Running Concurrent Stress Tests...\n');

  const service = new MockLLMService();
  const concurrencyLevels = DEFAULT_CONFIG.concurrency.levels;

  console.log('Testing concurrent request handling:\n');

  for (const concurrency of concurrencyLevels) {
    const monitor = new ResourceMonitor();
    const request = createMockRequest(5);

    // Force GC before test
    if (global.gc) {
      global.gc();
    }

    const memBefore = process.memoryUsage();
    monitor.start(100);

    const result = await runConcurrent(
      () => service.processRequest(request),
      concurrency,
      concurrency * 10 // Total operations
    );

    monitor.stop();
    const memAfter = process.memoryUsage();
    const stats = monitor.getStats();

    const successRate = ((result.results.length - result.errors.length) / result.results.length) * 100;

    console.log(`  Concurrency: ${concurrency.toString().padStart(4)}`);
    console.log(`    Duration:      ${result.duration.toFixed(0)}ms`);
    console.log(`    Throughput:    ${formatOpsPerSecond(result.opsPerSecond)}`);
    console.log(`    Success Rate:  ${successRate.toFixed(1)}%`);
    console.log(`    Errors:        ${result.errors.length}`);
    console.log(`    Memory Delta:  ${formatMemory(memAfter.heapUsed - memBefore.heapUsed)}`);

    if (stats) {
      console.log(`    Max Heap:      ${formatMemory(stats.memory.maxHeap)}`);
      console.log(`    Heap Growth:   ${stats.memory.heapGrowthRate.toFixed(2)}%`);
    }

    console.log('');

    // Brief pause between tests
    await sleep(500);
  }

  console.log('✅ Concurrent stress tests completed\n');
}

/**
 * Run sustained load test
 */
export async function runSustainedLoadTest(): Promise<void> {
  console.log('\n🔬 Running Sustained Load Tests...\n');

  const service = new MockLLMService();
  const monitor = new ResourceMonitor();

  const durations = [
    { name: 'Short (10s)', ms: 10_000, concurrency: 50 },
    { name: 'Medium (30s)', ms: 30_000, concurrency: 50 },
    { name: 'Long (60s)', ms: 60_000, concurrency: 50 },
  ];

  for (const duration of durations) {
    console.log(`  ${duration.name}:`);

    service.reset();
    monitor.clear();

    if (global.gc) {
      global.gc();
    }

    const startTime = Date.now();
    const startMem = process.memoryUsage();

    monitor.start(1000);

    let completed = 0;
    let errors = 0;

    // Run sustained load
    const workers: Promise<void>[] = [];

    for (let i = 0; i < duration.concurrency; i++) {
      workers.push(
        (async () => {
          while (Date.now() - startTime < duration.ms) {
            try {
              await service.processRequest(createMockRequest(3));
              completed++;
            } catch (error) {
              errors++;
            }
          }
        })()
      );
    }

    await Promise.all(workers);

    monitor.stop();
    const endTime = Date.now();
    const endMem = process.memoryUsage();
    const actualDuration = endTime - startTime;

    const stats = monitor.getStats();
    const opsPerSecond = (completed / actualDuration) * 1000;

    console.log(`    Duration:      ${actualDuration}ms`);
    console.log(`    Completed:     ${completed}`);
    console.log(`    Errors:        ${errors}`);
    console.log(`    Throughput:    ${formatOpsPerSecond(opsPerSecond)}`);
    console.log(`    Memory Delta:  ${formatMemory(endMem.heapUsed - startMem.heapUsed)}`);

    if (stats) {
      console.log(`    Avg Heap:      ${formatMemory(stats.memory.avgHeap)}`);
      console.log(`    Max Heap:      ${formatMemory(stats.memory.maxHeap)}`);
      console.log(`    Heap Growth:   ${stats.memory.heapGrowthRate.toFixed(2)}%`);
      console.log(`    CPU User:      ${stats.cpu.user.toFixed(0)}ms`);
      console.log(`    CPU System:    ${stats.cpu.system.toFixed(0)}ms`);

      // Check for potential issues
      if (stats.memory.heapGrowthRate > 10) {
        console.log(`    ⚠️  WARNING: High memory growth rate detected!`);
      }
      if (stats.memory.maxHeap > DEFAULT_CONFIG.thresholds.memory.maxUnderLoad) {
        console.log(`    ⚠️  WARNING: Memory threshold exceeded!`);
      }
    }

    console.log('');

    // Pause between tests
    await sleep(2000);
  }

  console.log('✅ Sustained load tests completed\n');
}

/**
 * Run memory leak detection
 */
export async function runMemoryLeakTest(): Promise<void> {
  console.log('\n🔬 Running Memory Leak Detection...\n');

  const service = new MockLLMService();

  // Test 1: Basic operation
  console.log('  Testing basic operations:');

  const basicResult = await detectMemoryLeak(async () => {
    await service.processRequest(createMockRequest(1));
  }, 200);

  console.log(`    Iterations:    200`);
  console.log(`    Growth Rate:   ${(basicResult.growthRate * 100).toFixed(2)}%`);
  console.log(`    Leaked:        ${basicResult.leaked ? '❌ YES' : '✅ NO'}`);
  console.log('');

  // Test 2: With large requests
  console.log('  Testing large requests:');

  const largeResult = await detectMemoryLeak(async () => {
    await service.processRequest(createMockRequest(20));
  }, 200);

  console.log(`    Iterations:    200`);
  console.log(`    Growth Rate:   ${(largeResult.growthRate * 100).toFixed(2)}%`);
  console.log(`    Leaked:        ${largeResult.leaked ? '❌ YES' : '✅ NO'}`);
  console.log('');

  // Test 3: Closure leak simulation
  console.log('  Testing potential closure leaks:');

  const closures: any[] = [];

  const closureResult = await detectMemoryLeak(async () => {
    const largeData = new Array(1000).fill('x').join('');
    closures.push(() => largeData); // Intentional leak for testing
    await service.processRequest(createMockRequest(1));
  }, 200);

  console.log(`    Iterations:    200`);
  console.log(`    Growth Rate:   ${(closureResult.growthRate * 100).toFixed(2)}%`);
  console.log(`    Leaked:        ${closureResult.leaked ? '❌ YES (expected)' : '✅ NO'}`);
  console.log('');

  // Cleanup
  closures.length = 0;

  console.log('✅ Memory leak detection completed\n');
}

/**
 * Run error handling stress test
 */
export async function runErrorHandlingTest(): Promise<void> {
  console.log('\n🔬 Running Error Handling Stress Test...\n');

  const service = new MockLLMService();
  const errorRates = [0.01, 0.05, 0.1, 0.25]; // 1%, 5%, 10%, 25%

  for (const errorRate of errorRates) {
    service.setErrorRate(errorRate);
    service.reset();

    const result = await runConcurrent(
      () => service.processRequest(createMockRequest(1)),
      100,
      1000
    );

    const actualErrorRate = (result.errors.length / 1000) * 100;

    console.log(`  Error Rate: ${(errorRate * 100).toFixed(0)}%`);
    console.log(`    Expected Errors: ~${(errorRate * 1000).toFixed(0)}`);
    console.log(`    Actual Errors:   ${result.errors.length}`);
    console.log(`    Actual Rate:     ${actualErrorRate.toFixed(1)}%`);
    console.log(`    Throughput:      ${formatOpsPerSecond(result.opsPerSecond)}`);
    console.log('');
  }

  console.log('✅ Error handling stress test completed\n');
}

/**
 * Run all stress tests
 */
export async function runStressTests(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  STRESS TESTING SUITE');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();

  try {
    await runConcurrentStressTest();
    await runSustainedLoadTest();
    await runMemoryLeakTest();
    await runErrorHandlingTest();
  } catch (error) {
    console.error('\n❌ Stress test failed:', error);
    throw error;
  }

  const duration = Date.now() - startTime;

  console.log('='.repeat(80));
  console.log(`  All stress tests completed in ${(duration / 1000).toFixed(1)}s`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Run stress tests if executed directly
 */
if (require.main === module) {
  runStressTests().catch((error) => {
    console.error('Stress test failed:', error);
    process.exit(1);
  });
}
