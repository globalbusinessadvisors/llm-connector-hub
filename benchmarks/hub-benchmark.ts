/**
 * Hub Benchmark
 * Measures ConnectorHub orchestration and provider selection performance
 */

import { runBenchmark, BenchmarkResult, createMockRequest, createMockResponse } from './setup';

/**
 * Mock provider interface
 */
interface IProvider {
  readonly name: string;
  readonly health: number; // 0-1
  readonly latency: number; // milliseconds
  complete(request: any): Promise<any>;
}

/**
 * Mock providers
 */
class MockProvider implements IProvider {
  constructor(
    public readonly name: string,
    public health: number = 1,
    public latency: number = 100
  ) {}

  async complete(request: any): Promise<any> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, this.latency));
    return createMockResponse();
  }
}

/**
 * Provider selection strategies
 */
enum SelectionStrategy {
  RoundRobin = 'round-robin',
  LowestLatency = 'lowest-latency',
  HealthBased = 'health-based',
  Random = 'random',
}

/**
 * Mock provider registry
 */
class ProviderRegistry {
  private providers: Map<string, IProvider> = new Map();
  private roundRobinIndex = 0;

  register(provider: IProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregister(name: string): void {
    this.providers.delete(name);
  }

  get(name: string): IProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): IProvider[] {
    return Array.from(this.providers.values());
  }

  select(strategy: SelectionStrategy = SelectionStrategy.RoundRobin): IProvider | undefined {
    const providers = this.getAll();
    if (providers.length === 0) return undefined;

    switch (strategy) {
      case SelectionStrategy.RoundRobin:
        const provider = providers[this.roundRobinIndex % providers.length];
        this.roundRobinIndex++;
        return provider;

      case SelectionStrategy.LowestLatency:
        return providers.reduce((lowest, current) =>
          current.latency < lowest.latency ? current : lowest
        );

      case SelectionStrategy.HealthBased:
        // Weight by health score
        const healthyProviders = providers.filter((p) => p.health > 0.5);
        if (healthyProviders.length === 0) return providers[0];

        const totalHealth = healthyProviders.reduce((sum, p) => sum + p.health, 0);
        let random = Math.random() * totalHealth;

        for (const provider of healthyProviders) {
          random -= provider.health;
          if (random <= 0) return provider;
        }

        return healthyProviders[0];

      case SelectionStrategy.Random:
        return providers[Math.floor(Math.random() * providers.length)];

      default:
        return providers[0];
    }
  }

  clear(): void {
    this.providers.clear();
    this.roundRobinIndex = 0;
  }
}

/**
 * Mock health monitor
 */
class HealthMonitor {
  private healthScores: Map<string, number> = new Map();
  private latencies: Map<string, number[]> = new Map();

  updateHealth(providerName: string, success: boolean, latency: number): void {
    // Update health score (simple exponential moving average)
    const currentHealth = this.healthScores.get(providerName) || 1;
    const newHealth = currentHealth * 0.9 + (success ? 1 : 0) * 0.1;
    this.healthScores.set(providerName, newHealth);

    // Track latencies
    const latencies = this.latencies.get(providerName) || [];
    latencies.push(latency);
    if (latencies.length > 100) latencies.shift();
    this.latencies.set(providerName, latencies);
  }

  getHealth(providerName: string): number {
    return this.healthScores.get(providerName) || 1;
  }

  getAverageLatency(providerName: string): number {
    const latencies = this.latencies.get(providerName) || [];
    if (latencies.length === 0) return 0;
    return latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  }

  clear(): void {
    this.healthScores.clear();
    this.latencies.clear();
  }
}

/**
 * Mock connector hub
 */
class MockConnectorHub {
  private registry: ProviderRegistry;
  private healthMonitor: HealthMonitor;
  private defaultStrategy: SelectionStrategy;

  constructor(strategy: SelectionStrategy = SelectionStrategy.RoundRobin) {
    this.registry = new ProviderRegistry();
    this.healthMonitor = new HealthMonitor();
    this.defaultStrategy = strategy;
  }

  registerProvider(provider: IProvider): void {
    this.registry.register(provider);
  }

  async complete(
    request: any,
    options?: { provider?: string; strategy?: SelectionStrategy }
  ): Promise<any> {
    let provider: IProvider | undefined;

    if (options?.provider) {
      // Specific provider requested
      provider = this.registry.get(options.provider);
    } else {
      // Select provider based on strategy
      provider = this.registry.select(options?.strategy || this.defaultStrategy);
    }

    if (!provider) {
      throw new Error('No provider available');
    }

    const startTime = Date.now();
    try {
      const response = await provider.complete(request);
      const latency = Date.now() - startTime;
      this.healthMonitor.updateHealth(provider.name, true, latency);
      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.healthMonitor.updateHealth(provider.name, false, latency);
      throw error;
    }
  }
}

/**
 * Benchmark hub operations
 */
export async function benchmarkHub(): Promise<BenchmarkResult[]> {
  console.log('\n🔬 Running Hub Benchmarks...\n');

  const results: BenchmarkResult[] = [];

  // Benchmark provider registration
  console.log('  Provider Registry:\n');

  const registry = new ProviderRegistry();

  const registerResult = await runBenchmark(
    'Provider Registration',
    () => {
      const provider = new MockProvider('test-provider', 1, 0);
      registry.register(provider);
      registry.unregister('test-provider');
    },
    { iterations: 10000, warmupIterations: 100, collectMemory: true }
  );
  results.push(registerResult);
  console.log(
    `    ✓ ${registerResult.name}: ${registerResult.averageTime.toFixed(2)}μs (${registerResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark provider selection strategies
  console.log('\n  Provider Selection:\n');

  // Setup providers for selection
  registry.clear();
  for (let i = 0; i < 10; i++) {
    registry.register(new MockProvider(`provider-${i}`, Math.random(), Math.random() * 200));
  }

  for (const strategy of Object.values(SelectionStrategy)) {
    const selectResult = await runBenchmark(
      `Provider Selection (${strategy})`,
      () => {
        registry.select(strategy as SelectionStrategy);
      },
      { iterations: 100000, warmupIterations: 1000, collectMemory: true }
    );
    results.push(selectResult);
    console.log(
      `    ✓ ${selectResult.name}: ${selectResult.averageTime.toFixed(2)}μs (${selectResult.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark health monitoring
  console.log('\n  Health Monitoring:\n');

  const healthMonitor = new HealthMonitor();

  const healthUpdateResult = await runBenchmark(
    'Health Score Update',
    () => {
      healthMonitor.updateHealth('test-provider', Math.random() > 0.1, Math.random() * 100);
    },
    { iterations: 100000, warmupIterations: 1000, collectMemory: true }
  );
  results.push(healthUpdateResult);
  console.log(
    `    ✓ ${healthUpdateResult.name}: ${healthUpdateResult.averageTime.toFixed(2)}μs (${healthUpdateResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  const healthGetResult = await runBenchmark(
    'Health Score Retrieval',
    () => {
      healthMonitor.getHealth('test-provider');
    },
    { iterations: 100000, warmupIterations: 1000, collectMemory: true }
  );
  results.push(healthGetResult);
  console.log(
    `    ✓ ${healthGetResult.name}: ${healthGetResult.averageTime.toFixed(2)}μs (${healthGetResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  const latencyCalcResult = await runBenchmark(
    'Average Latency Calculation',
    () => {
      healthMonitor.getAverageLatency('test-provider');
    },
    { iterations: 100000, warmupIterations: 1000, collectMemory: true }
  );
  results.push(latencyCalcResult);
  console.log(
    `    ✓ ${latencyCalcResult.name}: ${latencyCalcResult.averageTime.toFixed(2)}μs (${latencyCalcResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark hub orchestration (without actual network calls)
  console.log('\n  Hub Orchestration (mock, no network):\n');

  const mockHub = new MockConnectorHub(SelectionStrategy.RoundRobin);

  // Register fast mock providers (no latency)
  for (let i = 0; i < 5; i++) {
    mockHub.registerProvider(new MockProvider(`provider-${i}`, 1, 0));
  }

  const orchestrationResult = await runBenchmark(
    'Hub Orchestration (selection + overhead)',
    async () => {
      await mockHub.complete(createMockRequest(1));
    },
    { iterations: 1000, warmupIterations: 10, collectMemory: true }
  );
  results.push(orchestrationResult);
  console.log(
    `    ✓ ${orchestrationResult.name}: ${orchestrationResult.averageTime.toFixed(2)}μs (${orchestrationResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark with different provider counts
  console.log('\n  Scalability (provider count):\n');

  for (const providerCount of [1, 5, 10, 50, 100]) {
    const scalabilityHub = new MockConnectorHub(SelectionStrategy.RoundRobin);

    for (let i = 0; i < providerCount; i++) {
      scalabilityHub.registerProvider(new MockProvider(`provider-${i}`, 1, 0));
    }

    const scalabilityResult = await runBenchmark(
      `Hub with ${providerCount} providers`,
      async () => {
        await scalabilityHub.complete(createMockRequest(1));
      },
      { iterations: 1000, warmupIterations: 10, collectMemory: true }
    );
    results.push(scalabilityResult);
    console.log(
      `    ✓ ${scalabilityResult.name}: ${scalabilityResult.averageTime.toFixed(2)}μs (${scalabilityResult.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  console.log('\n✅ Hub benchmarks completed\n');

  return results;
}

/**
 * Analyze hub performance
 */
export function analyzeHubPerformance(results: BenchmarkResult[]): void {
  console.log('\n📊 Hub Performance Analysis\n');

  // Compare selection strategies
  console.log('Provider Selection Strategy Comparison:');

  const strategies = Object.values(SelectionStrategy);
  const strategyResults = strategies
    .map((strategy) => ({
      strategy,
      result: results.find((r) => r.name.includes(`(${strategy})`)),
    }))
    .filter((s) => s.result);

  strategyResults.sort((a, b) => (a.result?.averageTime || 0) - (b.result?.averageTime || 0));

  for (const { strategy, result } of strategyResults) {
    if (result) {
      console.log(`  ${strategy.padEnd(20)} ${result.averageTime.toFixed(2)}μs`);
    }
  }

  // Analyze scalability
  console.log('\nProvider Count Scalability:');

  const scalabilityResults = results.filter((r) => r.name.includes('Hub with'));

  for (const result of scalabilityResults) {
    const providerCount = parseInt(result.name.match(/\d+/)?.[0] || '0');
    console.log(`  ${providerCount.toString().padStart(3)} providers: ${result.averageTime.toFixed(2)}μs`);
  }

  // Calculate overhead components
  console.log('\nHub Overhead Components:');

  const selection = results.find((r) => r.name.includes('round-robin'));
  const health = results.find((r) => r.name.includes('Health Score Update'));
  const orchestration = results.find((r) => r.name.includes('Hub Orchestration'));

  if (selection) {
    console.log(`  Provider Selection:    ${selection.averageTime.toFixed(2)}μs`);
  }
  if (health) {
    console.log(`  Health Monitoring:     ${health.averageTime.toFixed(2)}μs`);
  }
  if (orchestration) {
    console.log(`  Total Orchestration:   ${orchestration.averageTime.toFixed(2)}μs`);
  }

  console.log('');
}

/**
 * Run hub benchmarks if executed directly
 */
if (require.main === module) {
  benchmarkHub()
    .then((results) => {
      analyzeHubPerformance(results);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
