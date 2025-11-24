/**
 * Tests for OpenAIConfig
 */

import { describe, it, expect } from 'vitest';
import {
  validateOpenAIConfig,
  mergeWithDefaults,
  getModelInfo,
  supportsVision,
  supportsFunctionCalling,
  supportsStreaming,
  getMaxTokens,
  OpenAIConfigError,
  OPENAI_MODELS,
  DEFAULT_OPENAI_CONFIG,
} from '../OpenAIConfig';

describe('OpenAIConfig', () => {
  describe('validateOpenAIConfig', () => {
    it('should accept valid config', () => {
      const config = {
        apiKey: 'sk-test-key',
      };

      expect(() => validateOpenAIConfig(config)).not.toThrow();
    });

    it('should throw if API key is missing', () => {
      const config = {
        apiKey: '',
      };

      expect(() => validateOpenAIConfig(config)).toThrow(OpenAIConfigError);
      expect(() => validateOpenAIConfig(config)).toThrow('API key is required');
    });

    it('should throw if API key is not a string', () => {
      const config = {
        apiKey: 123 as any,
      };

      expect(() => validateOpenAIConfig(config)).toThrow('API key must be a non-empty string');
    });

    it('should throw if timeout is negative', () => {
      const config = {
        apiKey: 'sk-test-key',
        timeout: -1000,
      };

      expect(() => validateOpenAIConfig(config)).toThrow('Timeout must be a positive number');
    });

    it('should throw if maxRetries is negative', () => {
      const config = {
        apiKey: 'sk-test-key',
        maxRetries: -1,
      };

      expect(() => validateOpenAIConfig(config)).toThrow('Max retries must be a non-negative number');
    });

    it('should throw if defaultMaxTokens is zero or negative', () => {
      const config = {
        apiKey: 'sk-test-key',
        defaultMaxTokens: 0,
      };

      expect(() => validateOpenAIConfig(config)).toThrow('Default max tokens must be a positive number');
    });

    it('should throw if baseUrl is invalid', () => {
      const config = {
        apiKey: 'sk-test-key',
        baseUrl: 'not-a-url',
      };

      expect(() => validateOpenAIConfig(config)).toThrow('Base URL must be a valid HTTP(S) URL');
    });

    it('should throw if organizationId is empty string', () => {
      const config = {
        apiKey: 'sk-test-key',
        organizationId: '',
      };

      expect(() => validateOpenAIConfig(config)).toThrow('Organization ID must be a non-empty string');
    });

    it('should accept config with all valid optional fields', () => {
      const config = {
        apiKey: 'sk-test-key',
        baseUrl: 'https://api.openai.com',
        organizationId: 'org-123',
        timeout: 30000,
        maxRetries: 3,
        defaultMaxTokens: 1024,
        debug: true,
      };

      expect(() => validateOpenAIConfig(config)).not.toThrow();
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user config with defaults', () => {
      const config = {
        apiKey: 'sk-test-key',
      };

      const merged = mergeWithDefaults(config);

      expect(merged.apiKey).toBe('sk-test-key');
      expect(merged.baseUrl).toBe(DEFAULT_OPENAI_CONFIG.baseUrl);
      expect(merged.timeout).toBe(DEFAULT_OPENAI_CONFIG.timeout);
      expect(merged.maxRetries).toBe(DEFAULT_OPENAI_CONFIG.maxRetries);
      expect(merged.defaultMaxTokens).toBe(DEFAULT_OPENAI_CONFIG.defaultMaxTokens);
      expect(merged.debug).toBe(DEFAULT_OPENAI_CONFIG.debug);
    });

    it('should use user values over defaults', () => {
      const config = {
        apiKey: 'sk-test-key',
        timeout: 10000,
        maxRetries: 5,
        defaultMaxTokens: 2048,
        debug: true,
      };

      const merged = mergeWithDefaults(config);

      expect(merged.timeout).toBe(10000);
      expect(merged.maxRetries).toBe(5);
      expect(merged.defaultMaxTokens).toBe(2048);
      expect(merged.debug).toBe(true);
    });

    it('should preserve organizationId', () => {
      const config = {
        apiKey: 'sk-test-key',
        organizationId: 'org-123',
      };

      const merged = mergeWithDefaults(config);

      expect(merged.organizationId).toBe('org-123');
    });

    it('should preserve additional headers', () => {
      const config = {
        apiKey: 'sk-test-key',
        additionalHeaders: {
          'X-Custom-Header': 'value',
        },
      };

      const merged = mergeWithDefaults(config);

      expect(merged.additionalHeaders).toEqual({
        'X-Custom-Header': 'value',
      });
    });
  });

  describe('getModelInfo', () => {
    it('should return info for GPT-5', () => {
      const info = getModelInfo(OPENAI_MODELS.GPT_5);

      expect(info).toBeDefined();
      expect(info?.name).toBe('GPT-5');
      expect(info?.supportsVision).toBe(true);
      expect(info?.supportsFunctionCalling).toBe(true);
      expect(info?.supportsStreaming).toBe(true);
      expect(info?.maxTokens).toBe(16384);
      expect(info?.contextWindow).toBe(128000);
    });

    it('should return info for GPT-4o', () => {
      const info = getModelInfo(OPENAI_MODELS.GPT_4O);

      expect(info).toBeDefined();
      expect(info?.name).toBe('GPT-4o');
      expect(info?.supportsVision).toBe(true);
      expect(info?.supportsFunctionCalling).toBe(true);
    });

    it('should return info for GPT-4', () => {
      const info = getModelInfo(OPENAI_MODELS.GPT_4);

      expect(info).toBeDefined();
      expect(info?.name).toBe('GPT-4');
      expect(info?.supportsVision).toBe(false);
      expect(info?.supportsFunctionCalling).toBe(true);
    });

    it('should return info for GPT-3.5 Turbo', () => {
      const info = getModelInfo(OPENAI_MODELS.GPT_3_5_TURBO);

      expect(info).toBeDefined();
      expect(info?.name).toBe('GPT-3.5 Turbo');
      expect(info?.supportsVision).toBe(false);
    });

    it('should return undefined for unknown model', () => {
      const info = getModelInfo('unknown-model');

      expect(info).toBeUndefined();
    });
  });

  describe('supportsVision', () => {
    it('should return true for GPT-5', () => {
      expect(supportsVision(OPENAI_MODELS.GPT_5)).toBe(true);
    });

    it('should return true for GPT-4o', () => {
      expect(supportsVision(OPENAI_MODELS.GPT_4O)).toBe(true);
    });

    it('should return true for GPT-4 Turbo', () => {
      expect(supportsVision(OPENAI_MODELS.GPT_4_TURBO)).toBe(true);
    });

    it('should return false for GPT-4 (non-turbo)', () => {
      expect(supportsVision(OPENAI_MODELS.GPT_4)).toBe(false);
    });

    it('should return false for GPT-3.5 Turbo', () => {
      expect(supportsVision(OPENAI_MODELS.GPT_3_5_TURBO)).toBe(false);
    });

    it('should return false for unknown model', () => {
      expect(supportsVision('unknown-model')).toBe(false);
    });
  });

  describe('supportsFunctionCalling', () => {
    it('should return true for all modern models', () => {
      expect(supportsFunctionCalling(OPENAI_MODELS.GPT_5)).toBe(true);
      expect(supportsFunctionCalling(OPENAI_MODELS.GPT_4O)).toBe(true);
      expect(supportsFunctionCalling(OPENAI_MODELS.GPT_4)).toBe(true);
      expect(supportsFunctionCalling(OPENAI_MODELS.GPT_3_5_TURBO)).toBe(true);
    });

    it('should return true for unknown model (default)', () => {
      expect(supportsFunctionCalling('unknown-model')).toBe(true);
    });
  });

  describe('supportsStreaming', () => {
    it('should return true for all models', () => {
      expect(supportsStreaming(OPENAI_MODELS.GPT_5)).toBe(true);
      expect(supportsStreaming(OPENAI_MODELS.GPT_4O)).toBe(true);
      expect(supportsStreaming(OPENAI_MODELS.GPT_4)).toBe(true);
      expect(supportsStreaming(OPENAI_MODELS.GPT_3_5_TURBO)).toBe(true);
    });

    it('should return true for unknown model (default)', () => {
      expect(supportsStreaming('unknown-model')).toBe(true);
    });
  });

  describe('getMaxTokens', () => {
    it('should return correct max tokens for GPT-5', () => {
      expect(getMaxTokens(OPENAI_MODELS.GPT_5)).toBe(16384);
    });

    it('should return correct max tokens for GPT-4o', () => {
      expect(getMaxTokens(OPENAI_MODELS.GPT_4O)).toBe(16384);
    });

    it('should return correct max tokens for GPT-4', () => {
      expect(getMaxTokens(OPENAI_MODELS.GPT_4)).toBe(8192);
    });

    it('should return correct max tokens for GPT-3.5 Turbo', () => {
      expect(getMaxTokens(OPENAI_MODELS.GPT_3_5_TURBO)).toBe(4096);
    });

    it('should return undefined for unknown model', () => {
      expect(getMaxTokens('unknown-model')).toBeUndefined();
    });
  });

  describe('OPENAI_MODELS', () => {
    it('should have all expected models', () => {
      expect(OPENAI_MODELS.GPT_5).toBe('gpt-5');
      expect(OPENAI_MODELS.GPT_5_1).toBe('gpt-5.1');
      expect(OPENAI_MODELS.GPT_4O).toBe('gpt-4o');
      expect(OPENAI_MODELS.GPT_4O_MINI).toBe('gpt-4o-mini');
      expect(OPENAI_MODELS.GPT_4_TURBO).toBe('gpt-4-turbo');
      expect(OPENAI_MODELS.GPT_4).toBe('gpt-4');
      expect(OPENAI_MODELS.GPT_3_5_TURBO).toBe('gpt-3.5-turbo');
    });
  });

  describe('DEFAULT_OPENAI_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_OPENAI_CONFIG.baseUrl).toBe('https://api.openai.com');
      expect(DEFAULT_OPENAI_CONFIG.timeout).toBe(60000);
      expect(DEFAULT_OPENAI_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_OPENAI_CONFIG.defaultMaxTokens).toBe(1024);
      expect(DEFAULT_OPENAI_CONFIG.debug).toBe(false);
    });
  });
});
