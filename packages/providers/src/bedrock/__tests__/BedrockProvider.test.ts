/**
 * Tests for BedrockProvider
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BedrockProvider } from '../BedrockProvider';
import type { CompletionRequest } from '../BedrockProvider';
import { BEDROCK_MODELS } from '../BedrockConfig';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('BedrockProvider', () => {
  let provider: BedrockProvider;

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockReset();

    provider = new BedrockProvider({
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
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
      expect(provider.name).toBe('bedrock');
      expect(provider.version).toBe('1.0.0');
    });

    it('should throw on invalid config', () => {
      expect(() => new BedrockProvider({
        region: '',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      })).toThrow();
    });

    it('should have correct capabilities', () => {
      expect(provider.capabilities).toEqual({
        streaming: true,
        function_calling: true,
        vision: true,
        json_mode: false,
        supports_system_message: true,
      });
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hi' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
      });

      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    it('should not initialize twice', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hi' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 1 },
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
        status: 403,
        json: async () => ({
          message: 'Access denied',
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
          content: [{ type: 'text', text: 'Hi' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 1 },
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
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: CompletionRequest = {
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        max_tokens: 100,
      };

      const response = await provider.complete(request);

      expect(response.message.role).toBe('assistant');
      expect(response.message.content).toBe('Hello! How can I help you?');
      expect(response.finish_reason).toBe('stop');
      expect(response.usage.prompt_tokens).toBe(10);
      expect(response.usage.completion_tokens).toBe(20);
      expect(response.metadata.provider).toBe('bedrock');
    });

    it('should handle system messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 15, output_tokens: 5 },
        }),
      });

      const request: CompletionRequest = {
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello!' },
        ],
        max_tokens: 100,
      };

      await provider.complete(request);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // Bedrock uses a different format - system message is separate
      expect(body.system).toBeDefined();
      expect(body.messages).toBeDefined();
    });

    it('should send correct Bedrock URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      });

      const request: CompletionRequest = {
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 100,
      };

      await provider.complete(request);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('bedrock-runtime');
      expect(url).toContain('us-east-1');
      expect(url).toContain('/model/');
      expect(url).toContain('/invoke');
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
              message: 'Internal error',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              content: [{ type: 'text', text: 'Success after retry' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 10, output_tokens: 10 },
            }),
          });

        const request: CompletionRequest = {
          model: BEDROCK_MODELS.CLAUDE_3_SONNET,
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
        status: 403,
        json: async () => ({
          message: 'Access denied',
        }),
      });

      const request: CompletionRequest = {
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 100,
      };

      await expect(provider.complete(request)).rejects.toThrow();
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
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [],
      };

      expect(() => provider.validateRequest(request)).toThrow('Messages array cannot be empty');
    });

    it('should throw if temperature is out of range', () => {
      const request = {
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [{ role: 'user' as const, content: 'Hello' }],
        temperature: 3.0,
      };

      expect(() => provider.validateRequest(request)).toThrow('Temperature must be between 0 and 1');
    });

    it('should throw if max_tokens is negative', () => {
      const request = {
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [{ role: 'user' as const, content: 'Hello' }],
        max_tokens: -10,
      };

      expect(() => provider.validateRequest(request)).toThrow('Max tokens must be positive');
    });

    it('should accept valid request', () => {
      const request = {
        model: BEDROCK_MODELS.CLAUDE_3_SONNET,
        messages: [{ role: 'user' as const, content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 100,
      };

      expect(() => provider.validateRequest(request)).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on success', async () => {
      const testProvider = new BedrockProvider({
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        timeout: 30000,
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hi' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
      });

      const health = await testProvider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
    });

    it('should return unhealthy status on error', async () => {
      const testProvider = new BedrockProvider({
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        timeout: 30000,
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          message: 'Access denied',
        }),
      });

      const health = await testProvider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeDefined();
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

      expect(metadata.provider).toBe('bedrock');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.capabilities).toEqual(provider.capabilities);
    });
  });
});
