/**
 * Tests for GoogleProvider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleProvider, type CompletionRequest } from '../GoogleProvider';
import { GOOGLE_MODELS } from '../GoogleConfig';

describe('GoogleProvider', () => {
  describe('constructor', () => {
    it('should create provider with valid config', () => {
      const provider = new GoogleProvider({
        apiKey: 'test-key',
      });

      expect(provider.name).toBe('google');
      expect(provider.version).toBe('1.0.0');
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.function_calling).toBe(true);
      expect(provider.capabilities.vision).toBe(true);
    });

    it('should throw on invalid config', () => {
      expect(() => {
        new GoogleProvider({
          apiKey: '',
        });
      }).toThrow('API key is required');
    });

    it('should merge config with defaults', () => {
      const provider = new GoogleProvider({
        apiKey: 'test-key',
        timeout: 10000,
      });

      expect(provider).toBeDefined();
    });
  });

  describe('validateRequest', () => {
    let provider: GoogleProvider;

    beforeEach(() => {
      provider = new GoogleProvider({
        apiKey: 'test-key',
      });
    });

    it('should accept valid request', () => {
      const request: CompletionRequest = {
        model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      expect(() => provider.validateRequest(request)).not.toThrow();
    });

    it('should throw if model is missing', () => {
      const request: CompletionRequest = {
        model: '',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      expect(() => provider.validateRequest(request)).toThrow('Model is required');
    });

    it('should throw if messages are empty', () => {
      const request: CompletionRequest = {
        model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
        messages: [],
      };

      expect(() => provider.validateRequest(request)).toThrow('Messages array cannot be empty');
    });

    it('should throw if temperature is out of range', () => {
      const request: CompletionRequest = {
        model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 3.0,
      };

      expect(() => provider.validateRequest(request)).toThrow('Temperature must be between 0 and 2');
    });

    it('should throw if max_tokens is negative', () => {
      const request: CompletionRequest = {
        model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: -1,
      };

      expect(() => provider.validateRequest(request)).toThrow('Max tokens must be positive');
    });

    it('should throw if top_p is out of range', () => {
      const request: CompletionRequest = {
        model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
        messages: [{ role: 'user', content: 'Hello' }],
        top_p: 1.5,
      };

      expect(() => provider.validateRequest(request)).toThrow('top_p must be between 0 and 1');
    });

    it('should throw if top_k is negative', () => {
      const request: CompletionRequest = {
        model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
        messages: [{ role: 'user', content: 'Hello' }],
        top_k: -1,
      };

      expect(() => provider.validateRequest(request)).toThrow('top_k must be non-negative');
    });

    it('should accept all valid optional parameters', () => {
      const request: CompletionRequest = {
        model: GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST,
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.9,
        top_k: 40,
        stop: ['END'],
      };

      expect(() => provider.validateRequest(request)).not.toThrow();
    });
  });

  describe('capabilities', () => {
    it('should report correct capabilities', () => {
      const provider = new GoogleProvider({
        apiKey: 'test-key',
      });

      expect(provider.capabilities).toEqual({
        streaming: true,
        function_calling: true,
        vision: true,
        json_mode: false,
        supports_system_message: true,
      });
    });
  });

  describe('factory functions', () => {
    it('should create provider with createGoogleProvider', async () => {
      const { createGoogleProvider } = await import('../GoogleProvider');

      const provider = createGoogleProvider({
        apiKey: 'test-key',
      });

      expect(provider).toBeInstanceOf(GoogleProvider);
      expect(provider.name).toBe('google');
    });

    it('should create provider from env with createGoogleProviderFromEnv', async () => {
      const { createGoogleProviderFromEnv } = await import('../GoogleProvider');

      // Mock environment variables
      const originalEnv = process.env.GOOGLE_API_KEY;
      process.env.GOOGLE_API_KEY = 'test-key';

      const provider = createGoogleProviderFromEnv();

      expect(provider).toBeInstanceOf(GoogleProvider);

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.GOOGLE_API_KEY = originalEnv;
      } else {
        delete process.env.GOOGLE_API_KEY;
      }
    });

    it('should throw if GOOGLE_API_KEY is not set', async () => {
      const { createGoogleProviderFromEnv } = await import('../GoogleProvider');

      // Mock environment variables
      const originalEnv = process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      expect(() => createGoogleProviderFromEnv()).toThrow('GOOGLE_API_KEY environment variable is required');

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.GOOGLE_API_KEY = originalEnv;
      }
    });
  });

  describe('initialization', () => {
    it('should initialize and shutdown', async () => {
      const provider = new GoogleProvider({
        apiKey: 'test-key',
      });

      // Mock healthCheck to succeed
      provider.healthCheck = vi.fn().mockResolvedValue({ healthy: true, latency: 100 });

      await provider.initialize();
      await provider.shutdown();

      expect(provider.healthCheck).toHaveBeenCalled();
    });

    it('should throw on initialization failure', async () => {
      const provider = new GoogleProvider({
        apiKey: 'test-key',
      });

      // Mock healthCheck to fail
      provider.healthCheck = vi.fn().mockResolvedValue({
        healthy: false,
        error: 'Connection failed',
      });

      await expect(provider.initialize()).rejects.toThrow('Failed to initialize Google AI provider');
    });
  });

  describe('integration structure', () => {
    it('should have all required methods', () => {
      const provider = new GoogleProvider({
        apiKey: 'test-key',
      });

      expect(provider.complete).toBeDefined();
      expect(provider.stream).toBeDefined();
      expect(provider.healthCheck).toBeDefined();
      expect(provider.validateRequest).toBeDefined();
      expect(provider.listModels).toBeDefined();
      expect(provider.getModelInfo).toBeDefined();
    });

    it('should have readonly properties', () => {
      const provider = new GoogleProvider({
        apiKey: 'test-key',
      });

      // Readonly properties in TypeScript are compile-time only,
      // so we just verify they exist and have correct values
      expect(provider.name).toBe('google');
      expect(provider.version).toBe('1.0.0');
    });
  });
});
