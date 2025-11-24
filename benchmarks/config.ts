/**
 * Benchmark Configuration
 * Defines test scenarios, thresholds, and performance targets
 */

export interface BenchmarkConfig {
  iterations: {
    micro: number; // For micro-benchmarks (provider overhead, cache ops)
    standard: number; // For standard benchmarks
    stress: number; // For stress tests
  };
  warmup: {
    iterations: number; // Number of warmup iterations
  };
  concurrency: {
    levels: number[]; // Concurrency levels to test
  };
  duration: {
    short: number; // Short duration test (milliseconds)
    medium: number; // Medium duration test
    long: number; // Long duration test
  };
  thresholds: PerformanceThresholds;
  output: {
    resultsDir: string;
    format: 'json' | 'csv' | 'markdown';
    verbose: boolean;
  };
}

export interface PerformanceThresholds {
  providerOverhead: {
    target: number; // Target overhead in microseconds
    warning: number; // Warning threshold
    error: number; // Error threshold (fails benchmark)
  };
  cacheOperations: {
    get: number; // Target for cache get (microseconds)
    set: number; // Target for cache set
    delete: number; // Target for cache delete
  };
  middlewareOverhead: {
    perMiddleware: number; // Target overhead per middleware (microseconds)
    pipeline: number; // Target for full pipeline
  };
  hubOrchestration: {
    providerSelection: number; // Target for provider selection (microseconds)
    endToEnd: number; // Target for end-to-end request (microseconds)
  };
  throughput: {
    minOpsPerSecond: number; // Minimum operations per second
    targetOpsPerSecond: number; // Target operations per second
  };
  memory: {
    maxUnderLoad: number; // Maximum memory usage under load (bytes)
    maxLeakRate: number; // Maximum acceptable leak rate
  };
  cpu: {
    maxUsage: number; // Maximum CPU usage percentage
  };
}

export const DEFAULT_CONFIG: BenchmarkConfig = {
  iterations: {
    micro: 10000,
    standard: 1000,
    stress: 5000,
  },
  warmup: {
    iterations: 100,
  },
  concurrency: {
    levels: [1, 10, 50, 100, 500, 1000],
  },
  duration: {
    short: 10_000, // 10 seconds
    medium: 60_000, // 1 minute
    long: 300_000, // 5 minutes
  },
  thresholds: {
    providerOverhead: {
      target: 1000, // 1ms target
      warning: 1500, // 1.5ms warning
      error: 2000, // 2ms error
    },
    cacheOperations: {
      get: 100, // 0.1ms
      set: 100,
      delete: 100,
    },
    middlewareOverhead: {
      perMiddleware: 500, // 0.5ms per middleware
      pipeline: 2000, // 2ms for full pipeline
    },
    hubOrchestration: {
      providerSelection: 1000, // 1ms
      endToEnd: 2000, // 2ms
    },
    throughput: {
      minOpsPerSecond: 100,
      targetOpsPerSecond: 1000,
    },
    memory: {
      maxUnderLoad: 200 * 1024 * 1024, // 200MB
      maxLeakRate: 0.01, // 1% growth rate
    },
    cpu: {
      maxUsage: 80, // 80%
    },
  },
  output: {
    resultsDir: './benchmarks/results',
    format: 'markdown',
    verbose: false,
  },
};

/**
 * Test scenarios for different benchmark types
 */
export const SCENARIOS = {
  provider: {
    small: {
      name: 'Small Message',
      messageCount: 1,
      messageSize: 100,
    },
    medium: {
      name: 'Medium Conversation',
      messageCount: 5,
      messageSize: 500,
    },
    large: {
      name: 'Large Context',
      messageCount: 20,
      messageSize: 2000,
    },
  },
  cache: {
    small: {
      name: 'Small Cache Keys',
      keySize: 50,
      valueSize: 100,
    },
    medium: {
      name: 'Medium Cache Keys',
      keySize: 100,
      valueSize: 1000,
    },
    large: {
      name: 'Large Cache Keys',
      keySize: 200,
      valueSize: 10000,
    },
  },
  middleware: {
    single: {
      name: 'Single Middleware',
      count: 1,
    },
    few: {
      name: 'Few Middleware',
      count: 3,
    },
    many: {
      name: 'Many Middleware',
      count: 10,
    },
  },
  load: {
    rampUp: {
      name: 'Ramp-up Test',
      startConcurrency: 1,
      endConcurrency: 1000,
      steps: 10,
      stepDuration: 5000, // 5 seconds per step
    },
    peak: {
      name: 'Peak Load Test',
      concurrency: 1000,
      duration: 60000, // 1 minute
    },
    endurance: {
      name: 'Endurance Test',
      concurrency: 100,
      duration: 300000, // 5 minutes
    },
    spike: {
      name: 'Spike Test',
      baseConcurrency: 10,
      spikeConcurrency: 500,
      spikeDuration: 10000, // 10 seconds
      cycles: 3,
    },
  },
};

/**
 * Performance targets for different components
 */
export const TARGETS = {
  provider: {
    anthropic: {
      transformRequest: 500, // 0.5ms
      transformResponse: 500,
    },
    google: {
      transformRequest: 500,
      transformResponse: 500,
    },
    openai: {
      transformRequest: 300, // OpenAI has minimal transformation
      transformResponse: 300,
    },
  },
  cache: {
    memory: {
      get: 10, // 0.01ms for in-memory
      set: 10,
      delete: 10,
    },
    redis: {
      get: 1000, // 1ms for network round-trip
      set: 1000,
      delete: 1000,
    },
  },
  middleware: {
    logging: 200, // 0.2ms
    metrics: 200,
    retry: 100, // Without actual retry
    rateLimit: 50,
    cache: 50,
  },
};

/**
 * Get configuration with optional overrides
 */
export function getConfig(overrides?: Partial<BenchmarkConfig>): BenchmarkConfig {
  if (!overrides) {
    return DEFAULT_CONFIG;
  }

  return {
    iterations: { ...DEFAULT_CONFIG.iterations, ...overrides.iterations },
    warmup: { ...DEFAULT_CONFIG.warmup, ...overrides.warmup },
    concurrency: { ...DEFAULT_CONFIG.concurrency, ...overrides.concurrency },
    duration: { ...DEFAULT_CONFIG.duration, ...overrides.duration },
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...overrides.thresholds,
    },
    output: { ...DEFAULT_CONFIG.output, ...overrides.output },
  };
}

/**
 * Check if a result meets the performance threshold
 */
export function checkThreshold(
  actualValue: number,
  threshold: { target: number; warning: number; error: number }
): {
  status: 'pass' | 'warning' | 'fail';
  message: string;
} {
  if (actualValue <= threshold.target) {
    return {
      status: 'pass',
      message: `✓ Performance target met (${actualValue.toFixed(2)}μs ≤ ${threshold.target}μs)`,
    };
  } else if (actualValue <= threshold.warning) {
    return {
      status: 'pass',
      message: `✓ Within acceptable range (${actualValue.toFixed(2)}μs ≤ ${threshold.warning}μs)`,
    };
  } else if (actualValue <= threshold.error) {
    return {
      status: 'warning',
      message: `⚠ Above target (${actualValue.toFixed(2)}μs > ${threshold.warning}μs)`,
    };
  } else {
    return {
      status: 'fail',
      message: `✗ Performance threshold exceeded (${actualValue.toFixed(2)}μs > ${threshold.error}μs)`,
    };
  }
}
