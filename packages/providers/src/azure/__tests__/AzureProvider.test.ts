/**
 * Tests for AzureProvider
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AzureProvider } from '../AzureProvider';
import type { CompletionRequest } from '../AzureProvider';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('AzureProvider', () => {
  let provider: AzureProvider;

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockReset();

    provider = new AzureProvider({
      apiKey: 'test-azure-key-123',
      endpoint: 'https://test-resource.openai.azure.com',
      deploymentName: 'gpt-4-deployment',
      timeout: 30000,
      maxRetries: 2,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with valid config', () => {
      expect(provider).toBeDefined();
      expect(provider.name).toBe('azure');
      expect(provider.version).toBe('1.0.0');
    });

    it('should throw on invalid config', () => {
      expect(() => new AzureProvider({
        apiKey: '',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test',
      })).toThrow();
    });

    it('should have correct capabilities', () => {
      expect(provider.capabilities).toEqual({
        streaming: true,
        function_calling: true,
        vision: true,
        json_mode: true,
        supports_system_message: true,
      });
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hi',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 1,
            total_tokens: 6,
          },
        }),
      });

      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    it('should not initialize twice', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hi',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 1,
            total_tokens: 6,
          },
        }),
      });

      await provider.initialize();
      await provider.initialize();

      // Should only call fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on failed health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error',
            code: '401',
          },
        }),
      });

      await expect(provider.initialize()).rejects.toThrow('Failed to initialize');
    });
  });

  describe('shutdown', () => {
    it('should shutdown successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hi',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 1,
            total_tokens: 6,
          },
        }),
      });

      await provider.initialize();
      await provider.shutdown();

      // After shutdown, should be able to initialize again
      expect(provider['initialized']).toBe(false);
    });
  });

  describe('complete', () => {
    it('should complete a basic request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: CompletionRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        max_tokens: 100,
      };

      const response = await provider.complete(request);

      expect(response.message.role).toBe('assistant');
      expect(response.message.content).toBe('Hello! How can I help you?');
      expect(response.finish_reason).toBe('stop');
      expect(response.usage.total_tokens).toBe(30);
      expect(response.metadata.provider).toBe('azure');
      expect(response.metadata.model).toBe('gpt-4');
    });

    it('should include system message in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 5,
            total_tokens: 20,
          },
        }),
      });

      const request: CompletionRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello!' },
        ],
        max_tokens: 100,
      };

      await provider.complete(request);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toBe('You are helpful');
      expect(body.messages[1].role).toBe('user');
    });

    it('should send correct Azure-specific URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 10,
            total_tokens: 20,
          },
        }),
      });

      const request: CompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 100,
      };

      await provider.complete(request);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('openai.azure.com');
      expect(url).toContain('gpt-4-deployment');
      expect(url).toContain('/chat/completions');
      expect(url).toContain('api-version=');
    });

    it('should send correct Azure headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 10,
            total_tokens: 20,
          },
        }),
      });

      const request: CompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 100,
      };

      await provider.complete(request);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['api-key']).toBe('test-azure-key-123');
    });

    it('should retry on retryable errors', async () => {
      // Use fake timers to control retry delays
      vi.useFakeTimers();

      try {
        mockFetch.mockClear();
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({
              error: {
                message: 'Internal error',
                type: 'server_error',
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              id: 'chatcmpl-123',
              object: 'chat.completion',
              created: 1677652288,
              model: 'gpt-4',
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Success after retry',
                },
                finish_reason: 'stop',
              }],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 10,
                total_tokens: 20,
              },
            }),
          });

        const request: CompletionRequest = {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello!' }],
          max_tokens: 100,
        };

        const responsePromise = provider.complete(request);

        // Fast-forward all timers
        await vi.runAllTimersAsync();

        const response = await responsePromise;

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(response.message.content).toBe('Success after retry');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error',
            code: '401',
          },
        }),
      });

      const request: CompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 100,
      };

      await expect(provider.complete(request)).rejects.toThrow('Invalid API key');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateRequest', () => {
    it('should throw if model is missing', () => {
      const request = {
        model: '',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      expect(() => provider.validateRequest(request)).toThrow('Model is required');
    });

    it('should throw if messages array is empty', () => {
      const request = {
        model: 'gpt-4',
        messages: [],
      };

      expect(() => provider.validateRequest(request)).toThrow('Messages array cannot be empty');
    });

    it('should throw if temperature is out of range', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        temperature: 3.0,
      };

      expect(() => provider.validateRequest(request)).toThrow('Temperature must be between 0 and 2');
    });

    it('should throw if max_tokens is negative', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        max_tokens: -10,
      };

      expect(() => provider.validateRequest(request)).toThrow('Max tokens must be positive');
    });

    it('should accept valid request', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 100,
      };

      expect(() => provider.validateRequest(request)).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on success', async () => {
      const testProvider = new AzureProvider({
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test-deployment',
        timeout: 30000,
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hi',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 1,
            total_tokens: 6,
          },
        }),
      });

      const health = await testProvider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
    });

    it('should return unhealthy status on error', async () => {
      const testProvider = new AzureProvider({
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test-deployment',
        timeout: 30000,
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error',
            code: '401',
          },
        }),
      });

      const health = await testProvider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeDefined();
      expect(health.error).toContain('Invalid API key');
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      provider.configure({ timeout: 45000 });

      expect(provider['config'].timeout).toBe(45000);
    });

    it('should validate new configuration', () => {
      expect(() => provider.configure({ timeout: -1000 })).toThrow();
    });
  });

  describe('getMetadata', () => {
    it('should return provider metadata', () => {
      const metadata = provider.getMetadata();

      expect(metadata.provider).toBe('azure');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.capabilities).toEqual(provider.capabilities);
    });
  });
});
