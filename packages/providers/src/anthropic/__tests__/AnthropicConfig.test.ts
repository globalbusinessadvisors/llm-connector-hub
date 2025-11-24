/**
 * Tests for AnthropicConfig
 */

import { describe, it, expect } from 'vitest';
import {
  validateAnthropicConfig,
  mergeWithDefaults,
  getModelInfo,
  supportsVision,
  supportsStreaming,
  getMaxTokens,
  AnthropicConfigError,
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_CONFIG,
} from '../AnthropicConfig';

describe('AnthropicConfig', () => {
  describe('validateAnthropicConfig', () => {
    it('should accept valid config', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
      };

      expect(() => validateAnthropicConfig(config)).not.toThrow();
    });

    it('should throw if API key is missing', () => {
      const config = {
        apiKey: '',
      };

      expect(() => validateAnthropicConfig(config)).toThrow(AnthropicConfigError);
      expect(() => validateAnthropicConfig(config)).toThrow('API key is required');
    });

    it('should throw if API key is not a string', () => {
      const config = {
        apiKey: 123 as any,
      };

      expect(() => validateAnthropicConfig(config)).toThrow('API key must be a non-empty string');
    });

    it('should throw if timeout is negative', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
        timeout: -1000,
      };

      expect(() => validateAnthropicConfig(config)).toThrow('Timeout must be a positive number');
    });

    it('should throw if maxRetries is negative', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
        maxRetries: -1,
      };

      expect(() => validateAnthropicConfig(config)).toThrow('Max retries must be a non-negative number');
    });

    it('should throw if defaultMaxTokens is zero or negative', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
        defaultMaxTokens: 0,
      };

      expect(() => validateAnthropicConfig(config)).toThrow('Default max tokens must be a positive number');
    });

    it('should throw if baseUrl is invalid', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
        baseUrl: 'not-a-url',
      };

      expect(() => validateAnthropicConfig(config)).toThrow('Base URL must be a valid HTTP(S) URL');
    });

    it('should throw if apiVersion is empty', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
        apiVersion: '',
      };

      expect(() => validateAnthropicConfig(config)).toThrow('API version must be a non-empty string');
    });

    it('should accept config with all valid optional fields', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
        apiVersion: '2023-06-01',
        baseUrl: 'https://api.anthropic.com',
        timeout: 30000,
        maxRetries: 3,
        defaultMaxTokens: 1024,
        debug: true,
      };

      expect(() => validateAnthropicConfig(config)).not.toThrow();
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user config with defaults', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
      };

      const merged = mergeWithDefaults(config);

      expect(merged.apiKey).toBe('sk-ant-test-key');
      expect(merged.apiVersion).toBe(DEFAULT_ANTHROPIC_CONFIG.apiVersion);
      expect(merged.baseUrl).toBe(DEFAULT_ANTHROPIC_CONFIG.baseUrl);
      expect(merged.timeout).toBe(DEFAULT_ANTHROPIC_CONFIG.timeout);
      expect(merged.maxRetries).toBe(DEFAULT_ANTHROPIC_CONFIG.maxRetries);
      expect(merged.defaultMaxTokens).toBe(DEFAULT_ANTHROPIC_CONFIG.defaultMaxTokens);
      expect(merged.debug).toBe(DEFAULT_ANTHROPIC_CONFIG.debug);
    });

    it('should use user values over defaults', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
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

    it('should preserve additional headers', () => {
      const config = {
        apiKey: 'sk-ant-test-key',
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
    it('should return info for Claude 3.5 Sonnet', () => {
      const info = getModelInfo(ANTHROPIC_MODELS.CLAUDE_3_5_SONNET);

      expect(info).toBeDefined();
      expect(info?.name).toBe('Claude 3.5 Sonnet');
      expect(info?.supportsVision).toBe(true);
      expect(info?.supportsStreaming).toBe(true);
      expect(info?.maxTokens).toBe(8192);
      expect(info?.contextWindow).toBe(200000);
    });

    it('should return info for Claude 3 Opus', () => {
      const info = getModelInfo(ANTHROPIC_MODELS.CLAUDE_3_OPUS);

      expect(info).toBeDefined();
      expect(info?.name).toBe('Claude 3 Opus');
      expect(info?.supportsVision).toBe(true);
      expect(info?.supportsStreaming).toBe(true);
    });

    it('should return info for Claude 3 Haiku', () => {
      const info = getModelInfo(ANTHROPIC_MODELS.CLAUDE_3_HAIKU);

      expect(info).toBeDefined();
      expect(info?.name).toBe('Claude 3 Haiku');
      expect(info?.supportsVision).toBe(true);
    });

    it('should return undefined for unknown model', () => {
      const info = getModelInfo('unknown-model');

      expect(info).toBeUndefined();
    });

    it('should return info for legacy models', () => {
      const info = getModelInfo(ANTHROPIC_MODELS.CLAUDE_2_1);

      expect(info).toBeDefined();
      expect(info?.name).toBe('Claude 2.1');
      expect(info?.supportsVision).toBe(false);
      expect(info?.supportsStreaming).toBe(true);
    });
  });

  describe('supportsVision', () => {
    it('should return true for Claude 3.5 Sonnet', () => {
      expect(supportsVision(ANTHROPIC_MODELS.CLAUDE_3_5_SONNET)).toBe(true);
    });

    it('should return true for Claude 3 Opus', () => {
      expect(supportsVision(ANTHROPIC_MODELS.CLAUDE_3_OPUS)).toBe(true);
    });

    it('should return true for Claude 3 Sonnet', () => {
      expect(supportsVision(ANTHROPIC_MODELS.CLAUDE_3_SONNET)).toBe(true);
    });

    it('should return true for Claude 3 Haiku', () => {
      expect(supportsVision(ANTHROPIC_MODELS.CLAUDE_3_HAIKU)).toBe(true);
    });

    it('should return false for Claude 2.1', () => {
      expect(supportsVision(ANTHROPIC_MODELS.CLAUDE_2_1)).toBe(false);
    });

    it('should return false for Claude 2.0', () => {
      expect(supportsVision(ANTHROPIC_MODELS.CLAUDE_2_0)).toBe(false);
    });

    it('should return false for unknown model', () => {
      expect(supportsVision('unknown-model')).toBe(false);
    });
  });

  describe('supportsStreaming', () => {
    it('should return true for all modern models', () => {
      expect(supportsStreaming(ANTHROPIC_MODELS.CLAUDE_3_5_SONNET)).toBe(true);
      expect(supportsStreaming(ANTHROPIC_MODELS.CLAUDE_3_OPUS)).toBe(true);
      expect(supportsStreaming(ANTHROPIC_MODELS.CLAUDE_3_SONNET)).toBe(true);
      expect(supportsStreaming(ANTHROPIC_MODELS.CLAUDE_3_HAIKU)).toBe(true);
    });

    it('should return true for legacy models', () => {
      expect(supportsStreaming(ANTHROPIC_MODELS.CLAUDE_2_1)).toBe(true);
      expect(supportsStreaming(ANTHROPIC_MODELS.CLAUDE_2_0)).toBe(true);
    });

    it('should return true for unknown model (default)', () => {
      expect(supportsStreaming('unknown-model')).toBe(true);
    });
  });

  describe('getMaxTokens', () => {
    it('should return correct max tokens for Claude 3.5 Sonnet', () => {
      expect(getMaxTokens(ANTHROPIC_MODELS.CLAUDE_3_5_SONNET)).toBe(8192);
    });

    it('should return correct max tokens for Claude 3 Opus', () => {
      expect(getMaxTokens(ANTHROPIC_MODELS.CLAUDE_3_OPUS)).toBe(4096);
    });

    it('should return correct max tokens for Claude 3 Haiku', () => {
      expect(getMaxTokens(ANTHROPIC_MODELS.CLAUDE_3_HAIKU)).toBe(4096);
    });

    it('should return undefined for unknown model', () => {
      expect(getMaxTokens('unknown-model')).toBeUndefined();
    });
  });

  describe('ANTHROPIC_MODELS', () => {
    it('should have all expected models', () => {
      expect(ANTHROPIC_MODELS.CLAUDE_3_5_SONNET).toBe('claude-3-5-sonnet-20241022');
      expect(ANTHROPIC_MODELS.CLAUDE_3_5_SONNET_LEGACY).toBe('claude-3-5-sonnet-20240620');
      expect(ANTHROPIC_MODELS.CLAUDE_3_OPUS).toBe('claude-3-opus-20240229');
      expect(ANTHROPIC_MODELS.CLAUDE_3_SONNET).toBe('claude-3-sonnet-20240229');
      expect(ANTHROPIC_MODELS.CLAUDE_3_HAIKU).toBe('claude-3-haiku-20240307');
      expect(ANTHROPIC_MODELS.CLAUDE_2_1).toBe('claude-2.1');
      expect(ANTHROPIC_MODELS.CLAUDE_2_0).toBe('claude-2.0');
      expect(ANTHROPIC_MODELS.CLAUDE_INSTANT_1_2).toBe('claude-instant-1.2');
    });
  });

  describe('DEFAULT_ANTHROPIC_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_ANTHROPIC_CONFIG.apiVersion).toBe('2023-06-01');
      expect(DEFAULT_ANTHROPIC_CONFIG.baseUrl).toBe('https://api.anthropic.com');
      expect(DEFAULT_ANTHROPIC_CONFIG.timeout).toBe(60000);
      expect(DEFAULT_ANTHROPIC_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_ANTHROPIC_CONFIG.defaultMaxTokens).toBe(1024);
      expect(DEFAULT_ANTHROPIC_CONFIG.debug).toBe(false);
    });
  });
});
