/**
 * Benchmark Setup and Utilities
 * Provides timing functions, statistics calculation, and result formatting
 */

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
  opsPerSecond: number;
  memoryUsage?: MemoryUsage;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface TimerResult {
  durationMs: number;
  durationUs: number;
  memoryBefore: MemoryUsage;
  memoryAfter: MemoryUsage;
  memoryDelta: MemoryUsage;
}

/**
 * High-precision timer using process.hrtime.bigint()
 */
export class Timer {
  private startTime: bigint | null = null;
  private memoryBefore: MemoryUsage | null = null;

  start(): void {
    // Force garbage collection if available (run with --expose-gc)
    if (global.gc) {
      global.gc();
    }
    this.memoryBefore = this.getMemoryUsage();
    this.startTime = process.hrtime.bigint();
  }

  stop(): TimerResult {
    const endTime = process.hrtime.bigint();
    const memoryAfter = this.getMemoryUsage();

    if (this.startTime === null || this.memoryBefore === null) {
      throw new Error('Timer not started');
    }

    const durationNs = Number(endTime - this.startTime);
    const durationUs = durationNs / 1000;
    const durationMs = durationUs / 1000;

    const memoryDelta: MemoryUsage = {
      heapUsed: memoryAfter.heapUsed - this.memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - this.memoryBefore.heapTotal,
      external: memoryAfter.external - this.memoryBefore.external,
      rss: memoryAfter.rss - this.memoryBefore.rss,
    };

    return {
      durationMs,
      durationUs,
      memoryBefore: this.memoryBefore,
      memoryAfter,
      memoryDelta,
    };
  }

  private getMemoryUsage(): MemoryUsage {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };
  }
}

/**
 * Run a benchmark function multiple times and collect statistics
 */
export async function runBenchmark(
  name: string,
  fn: () => Promise<void> | void,
  options: {
    iterations?: number;
    warmupIterations?: number;
    collectMemory?: boolean;
  } = {}
): Promise<BenchmarkResult> {
  const iterations = options.iterations ?? 1000;
  const warmupIterations = options.warmupIterations ?? 100;
  const collectMemory = options.collectMemory ?? true;

  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Force GC before actual benchmark
  if (global.gc) {
    global.gc();
  }

  const times: number[] = [];
  const memoryBefore = collectMemory ? process.memoryUsage() : undefined;

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const timer = new Timer();
    timer.start();
    await fn();
    const result = timer.stop();
    times.push(result.durationUs);
  }

  const memoryAfter = collectMemory ? process.memoryUsage() : undefined;

  // Calculate statistics
  const stats = calculateStatistics(times);
  const totalTime = times.reduce((sum, time) => sum + time, 0);

  return {
    name,
    iterations,
    totalTime,
    averageTime: stats.mean,
    minTime: stats.min,
    maxTime: stats.max,
    medianTime: stats.median,
    p50: stats.p50,
    p95: stats.p95,
    p99: stats.p99,
    stdDev: stats.stdDev,
    opsPerSecond: 1_000_000 / stats.mean, // Convert from microseconds
    memoryUsage:
      memoryBefore && memoryAfter
        ? {
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            external: memoryAfter.external - memoryBefore.external,
            rss: memoryAfter.rss - memoryBefore.rss,
          }
        : undefined,
  };
}

/**
 * Calculate statistical measures from timing data
 */
export function calculateStatistics(values: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
} {
  if (values.length === 0) {
    throw new Error('Cannot calculate statistics on empty array');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;

  // Standard deviation
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: percentile(sorted, 50),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    stdDev,
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Format time in human-readable format
 */
export function formatTime(microseconds: number): string {
  if (microseconds < 1) {
    return `${(microseconds * 1000).toFixed(2)}ns`;
  } else if (microseconds < 1000) {
    return `${microseconds.toFixed(2)}μs`;
  } else if (microseconds < 1_000_000) {
    return `${(microseconds / 1000).toFixed(2)}ms`;
  } else {
    return `${(microseconds / 1_000_000).toFixed(2)}s`;
  }
}

/**
 * Format memory in human-readable format
 */
export function formatMemory(bytes: number): string {
  const abs = Math.abs(bytes);
  const sign = bytes < 0 ? '-' : '';

  if (abs < 1024) {
    return `${sign}${abs.toFixed(0)}B`;
  } else if (abs < 1024 * 1024) {
    return `${sign}${(abs / 1024).toFixed(2)}KB`;
  } else if (abs < 1024 * 1024 * 1024) {
    return `${sign}${(abs / (1024 * 1024)).toFixed(2)}MB`;
  } else {
    return `${sign}${(abs / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }
}

/**
 * Format operations per second
 */
export function formatOpsPerSecond(ops: number): string {
  if (ops < 1000) {
    return `${ops.toFixed(0)} ops/s`;
  } else if (ops < 1_000_000) {
    return `${(ops / 1000).toFixed(2)}K ops/s`;
  } else {
    return `${(ops / 1_000_000).toFixed(2)}M ops/s`;
  }
}

/**
 * Create a progress bar for terminal output
 */
export function createProgressBar(current: number, total: number, width: number = 40): string {
  const percentage = (current / total) * 100;
  const filled = Math.round((width * current) / total);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage.toFixed(1)}%`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Monitor CPU usage
 */
export async function measureCPUUsage(
  fn: () => Promise<void> | void
): Promise<{ userCPU: number; systemCPU: number }> {
  const startUsage = process.cpuUsage();
  await fn();
  const endUsage = process.cpuUsage(startUsage);

  return {
    userCPU: endUsage.user / 1000, // Convert to milliseconds
    systemCPU: endUsage.system / 1000,
  };
}

/**
 * Detect potential memory leaks
 */
export async function detectMemoryLeak(
  fn: () => Promise<void> | void,
  iterations: number = 100
): Promise<{
  leaked: boolean;
  growthRate: number;
  samples: number[];
}> {
  const samples: number[] = [];

  // Force GC before starting
  if (global.gc) {
    global.gc();
  }

  for (let i = 0; i < iterations; i++) {
    await fn();

    if (i % 10 === 0) {
      if (global.gc) {
        global.gc();
      }
      samples.push(process.memoryUsage().heapUsed);
    }
  }

  // Calculate linear regression to detect growth
  const n = samples.length;
  const sumX = samples.reduce((sum, _, i) => sum + i, 0);
  const sumY = samples.reduce((sum, val) => sum + val, 0);
  const sumXY = samples.reduce((sum, val, i) => sum + i * val, 0);
  const sumX2 = samples.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const growthRate = slope / samples[0]; // Normalize by initial memory

  // Consider it a leak if memory grows by more than 5% per 10 iterations
  const leaked = growthRate > 0.005;

  return {
    leaked,
    growthRate,
    samples,
  };
}

/**
 * Run concurrent operations
 */
export async function runConcurrent<T>(
  fn: () => Promise<T>,
  concurrency: number,
  totalOperations: number
): Promise<{
  results: T[];
  duration: number;
  opsPerSecond: number;
  errors: Error[];
}> {
  const results: T[] = [];
  const errors: Error[] = [];
  const startTime = process.hrtime.bigint();

  let completed = 0;
  let started = 0;

  const runOne = async (): Promise<void> => {
    while (started < totalOperations) {
      const index = started++;
      try {
        const result = await fn();
        results[index] = result;
      } catch (error) {
        errors.push(error as Error);
      }
      completed++;
    }
  };

  // Start concurrent workers
  const workers = Array(concurrency)
    .fill(null)
    .map(() => runOne());

  await Promise.all(workers);

  const endTime = process.hrtime.bigint();
  const durationNs = Number(endTime - startTime);
  const duration = durationNs / 1_000_000; // Convert to milliseconds
  const opsPerSecond = (totalOperations / duration) * 1000;

  return {
    results,
    duration,
    opsPerSecond,
    errors,
  };
}

/**
 * Create a mock provider response for benchmarking
 */
export function createMockResponse(text: string = 'Hello, world!') {
  return {
    id: 'mock-' + Math.random().toString(36).substring(7),
    object: 'chat.completion',
    created: Date.now(),
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant' as const,
          content: text,
        },
        finishReason: 'stop' as const,
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };
}

/**
 * Create a mock completion request
 */
export function createMockRequest(messageCount: number = 1) {
  return {
    model: 'gpt-4',
    messages: Array(messageCount)
      .fill(null)
      .map((_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i + 1}`,
      })),
    temperature: 0.7,
    max_tokens: 100,
  };
}
