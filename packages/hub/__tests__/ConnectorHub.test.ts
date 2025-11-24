import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectorHub } from '../src/connector-hub';
import { IProvider, ProviderCapabilities, HealthStatus, ProviderMetrics, CompletionRequest, CompletionResponse, MessageRole, HealthState } from '@llm-connector-hub/core';

class TestProvider implements IProvider {
  constructor(
    public name: string,
    public capabilities: ProviderCapabilities
  ) {}

  version = '1.0.0';

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    return {
      id: '1',
      object: 'chat.completion',
      created: Date.now(),
      model: request.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: `Response from ${this.name}`, functionCall: undefined },
        finishReason: 'stop' as any,
      }],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  }

  async *completeStream(request: CompletionRequest): AsyncIterableIterator<CompletionResponse> {
    yield await this.complete(request);
  }

  async healthCheck(): Promise<HealthStatus> {
    return { state: HealthState.HEALTHY, message: 'OK', timestamp: Date.now() };
  }

  getMetrics(): ProviderMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 100,
      totalTokens: 0,
      lastUpdated: Date.now(),
    };
  }

  resetMetrics(): void {}
  async validateRequest(): Promise<boolean> { return true; }
  estimateTokens(): number { return 100; }
  async shutdown(): Promise<void> {}
}

describe('ConnectorHub', () => {
  let hub: ConnectorHub;
  let provider1: TestProvider;
  let provider2: TestProvider;

  beforeEach(() => {
    hub = new ConnectorHub({ selectionStrategy: 'priority' });
    
    provider1 = new TestProvider('provider1', {
      streaming: true,
      functionCalling: false,
      vision: false,
      embeddings: false,
      maxContextWindow: 4096,
      supportedModels: ['gpt-4'],
    });

    provider2 = new TestProvider('provider2', {
      streaming: true,
      functionCalling: false,
      vision: false,
      embeddings: false,
      maxContextWindow: 4096,
      supportedModels: ['gpt-4'],
    });
  });

  it('should register providers', () => {
    hub.registerProvider(provider1, { apiKey: 'key1' }, { priority: 1 });
    hub.registerProvider(provider2, { apiKey: 'key2' }, { priority: 2 });

    const registry = hub.getRegistry();
    expect(registry.get('provider1')).toBe(provider1);
    expect(registry.get('provider2')).toBe(provider2);
  });

  it('should complete request with explicit provider', async () => {
    hub.registerProvider(provider1, { apiKey: 'key1' });

    const request: CompletionRequest = {
      model: 'gpt-4',
      messages: [{ role: MessageRole.USER, content: 'Hello' }],
    };

    const response = await hub.complete(request, 'provider1');
    
    expect(response).toBeDefined();
    expect(response.choices[0].message.content).toContain('provider1');
  });

  it('should use builder pattern', () => {
    const builtHub = ConnectorHub.builder()
      .selectionStrategy('round-robin')
      .addProvider(provider1, { apiKey: 'key1' })
      .build();

    expect(builtHub).toBeInstanceOf(ConnectorHub);
    expect(builtHub.getRegistry().get('provider1')).toBe(provider1);
  });

  it('should select provider based on priority', async () => {
    hub.registerProvider(provider1, { apiKey: 'key1' }, { priority: 1 });
    hub.registerProvider(provider2, { apiKey: 'key2' }, { priority: 2 });

    const request: CompletionRequest = {
      model: 'gpt-4',
      messages: [{ role: MessageRole.USER, content: 'Hello' }],
    };

    const response = await hub.complete(request);
    
    // Should use provider1 (priority 1 < priority 2)
    expect(response.choices[0].message.content).toContain('provider1');
  });
});
