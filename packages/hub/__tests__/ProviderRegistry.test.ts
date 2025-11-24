import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../src/registry/ProviderRegistry';
import { IProvider, ProviderCapabilities, HealthStatus, ProviderMetrics, CompletionRequest, CompletionResponse, MessageRole, HealthState } from '@llm-connector-hub/core';

class MockProvider implements IProvider {
  name = 'mock-provider';
  version = '1.0.0';
  capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: false,
    vision: false,
    embeddings: false,
    maxContextWindow: 4096,
    supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
  };

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    return {
      id: '1',
      object: 'chat.completion',
      created: Date.now(),
      model: request.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Test response', functionCall: undefined },
        finishReason: 'stop' as any,
      }],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  }

  async *completeStream(request: CompletionRequest): AsyncIterableIterator<CompletionResponse> {
    yield await this.complete(request);
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      state: HealthState.HEALTHY,
      message: 'OK',
      timestamp: Date.now(),
    };
  }

  getMetrics(): ProviderMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokens: 0,
      lastUpdated: Date.now(),
    };
  }

  resetMetrics(): void {}

  async validateRequest(request: CompletionRequest): Promise<boolean> {
    return true;
  }

  estimateTokens(request: CompletionRequest): number {
    return 100;
  }

  async shutdown(): Promise<void> {}
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let mockProvider: MockProvider;

  beforeEach(() => {
    registry = new ProviderRegistry();
    mockProvider = new MockProvider();
  });

  it('should register a provider', () => {
    const entry = registry.register(mockProvider, {
      config: { apiKey: 'test-key' },
      enabled: true,
      priority: 100,
    });

    expect(entry.provider).toBe(mockProvider);
    expect(entry.enabled).toBe(true);
    expect(entry.priority).toBe(100);
  });

  it('should retrieve a registered provider', () => {
    registry.register(mockProvider, {
      config: { apiKey: 'test-key' },
    });

    const provider = registry.get('mock-provider');
    expect(provider).toBe(mockProvider);
  });

  it('should find providers by filter', () => {
    registry.register(mockProvider, {
      config: { apiKey: 'test-key' },
      tags: ['fast', 'cheap'],
    });

    const results = registry.find({ tags: ['fast'] });
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe(mockProvider);
  });

  it('should filter by model support', () => {
    registry.register(mockProvider, {
      config: { apiKey: 'test-key' },
    });

    const gpt4Results = registry.find({ model: 'gpt-4' });
    expect(gpt4Results).toHaveLength(1);

    const claudeResults = registry.find({ model: 'claude-3' });
    expect(claudeResults).toHaveLength(0);
  });

  it('should mark provider as used', () => {
    registry.register(mockProvider, {
      config: { apiKey: 'test-key' },
    });

    registry.markUsed('mock-provider');

    const entries = registry.find({ name: 'mock-provider' });
    expect(entries[0].lastUsedAt).toBeDefined();
    expect(entries[0].lastUsedAt).toBeGreaterThan(0);
  });
});
