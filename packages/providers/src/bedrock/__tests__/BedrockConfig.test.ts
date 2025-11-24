/**
 * Tests for BedrockConfig
 */

import { describe, it, expect } from 'vitest';
import {
  validateBedrockConfig,
  mergeWithDefaults,
  getModelProvider,
  supportsFunctionCalling,
  supportsVision,
  BedrockConfigError,
  BEDROCK_MODELS,
  DEFAULT_BEDROCK_CONFIG,
} from '../BedrockConfig';

describe('BedrockConfig', () => {
  describe('validateBedrockConfig', () => {
    it('should accept valid config', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      };

      expect(() => validateBedrockConfig(config)).not.toThrow();
    });

    it('should throw if region is missing', () => {
      const config = {
        region: '',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      };

      expect(() => validateBedrockConfig(config)).toThrow(BedrockConfigError);
      expect(() => validateBedrockConfig(config)).toThrow('Region is required');
    });

    it('should throw if accessKeyId is missing', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: '',
        secretAccessKey: 'test-secret',
      };

      expect(() => validateBedrockConfig(config)).toThrow('Access key ID is required');
    });

    it('should throw if secretAccessKey is missing', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: '',
      };

      expect(() => validateBedrockConfig(config)).toThrow('Secret access key is required');
    });

    it('should throw if timeout is negative', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        timeout: -1000,
      };

      expect(() => validateBedrockConfig(config)).toThrow('Timeout must be a positive number');
    });

    it('should throw if maxRetries is negative', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        maxRetries: -1,
      };

      expect(() => validateBedrockConfig(config)).toThrow('Max retries must be a non-negative number');
    });

    it('should accept config with all valid optional fields', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
        timeout: 30000,
        maxRetries: 3,
        defaultMaxTokens: 1024,
        debug: true,
      };

      expect(() => validateBedrockConfig(config)).not.toThrow();
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user config with defaults', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      };

      const merged = mergeWithDefaults(config);

      expect(merged.region).toBe('us-east-1');
      expect(merged.accessKeyId).toBe('test-key');
      expect(merged.secretAccessKey).toBe('test-secret');
      expect(merged.timeout).toBe(DEFAULT_BEDROCK_CONFIG.timeout);
      expect(merged.maxRetries).toBe(DEFAULT_BEDROCK_CONFIG.maxRetries);
      expect(merged.debug).toBe(DEFAULT_BEDROCK_CONFIG.debug);
    });

    it('should use user values over defaults', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        timeout: 10000,
        maxRetries: 5,
        debug: true,
      };

      const merged = mergeWithDefaults(config);

      expect(merged.timeout).toBe(10000);
      expect(merged.maxRetries).toBe(5);
      expect(merged.debug).toBe(true);
    });

    it('should preserve sessionToken', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
      };

      const merged = mergeWithDefaults(config);

      expect(merged.sessionToken).toBe('test-token');
    });
  });

  describe('getModelProvider', () => {
    it('should return anthropic for Claude models', () => {
      expect(getModelProvider(BEDROCK_MODELS.CLAUDE_3_SONNET)).toBe('anthropic');
      expect(getModelProvider(BEDROCK_MODELS.CLAUDE_3_HAIKU)).toBe('anthropic');
      expect(getModelProvider(BEDROCK_MODELS.CLAUDE_3_OPUS)).toBe('anthropic');
    });

    it('should return meta for Llama models', () => {
      expect(getModelProvider(BEDROCK_MODELS.LLAMA_3_70B)).toBe('meta');
      expect(getModelProvider(BEDROCK_MODELS.LLAMA_3_8B)).toBe('meta');
    });

    it('should return mistral for Mistral models', () => {
      expect(getModelProvider(BEDROCK_MODELS.MISTRAL_7B)).toBe('mistral');
      expect(getModelProvider(BEDROCK_MODELS.MISTRAL_LARGE)).toBe('mistral');
    });

    it('should return unknown for unknown models', () => {
      expect(getModelProvider('unknown-model')).toBe('unknown');
    });
  });

  describe('supportsFunctionCalling', () => {
    it('should return true for Claude 3 models', () => {
      expect(supportsFunctionCalling(BEDROCK_MODELS.CLAUDE_3_SONNET)).toBe(true);
      expect(supportsFunctionCalling(BEDROCK_MODELS.CLAUDE_3_OPUS)).toBe(true);
      expect(supportsFunctionCalling(BEDROCK_MODELS.CLAUDE_3_HAIKU)).toBe(true);
    });

    it('should return false for Llama models', () => {
      expect(supportsFunctionCalling(BEDROCK_MODELS.LLAMA_3_70B)).toBe(false);
      expect(supportsFunctionCalling(BEDROCK_MODELS.LLAMA_3_8B)).toBe(false);
    });

    it('should return false for Mistral models', () => {
      expect(supportsFunctionCalling(BEDROCK_MODELS.MISTRAL_7B)).toBe(false);
    });
  });

  describe('supportsVision', () => {
    it('should return true for Claude 3.5 Sonnet', () => {
      expect(supportsVision(BEDROCK_MODELS.CLAUDE_3_5_SONNET)).toBe(true);
    });

    it('should return true for Claude 3 Sonnet and Opus', () => {
      expect(supportsVision(BEDROCK_MODELS.CLAUDE_3_SONNET)).toBe(true);
      expect(supportsVision(BEDROCK_MODELS.CLAUDE_3_OPUS)).toBe(true);
    });

    it('should return true for Claude 3 Haiku', () => {
      expect(supportsVision(BEDROCK_MODELS.CLAUDE_3_HAIKU)).toBe(true);
    });

    it('should return false for non-vision models', () => {
      expect(supportsVision(BEDROCK_MODELS.LLAMA_3_70B)).toBe(false);
      expect(supportsVision(BEDROCK_MODELS.MISTRAL_7B)).toBe(false);
    });
  });

  describe('BEDROCK_MODELS', () => {
    it('should have all expected Claude models', () => {
      expect(BEDROCK_MODELS.CLAUDE_3_5_SONNET).toBeDefined();
      expect(BEDROCK_MODELS.CLAUDE_3_OPUS).toBeDefined();
      expect(BEDROCK_MODELS.CLAUDE_3_SONNET).toBeDefined();
      expect(BEDROCK_MODELS.CLAUDE_3_HAIKU).toBeDefined();
    });

    it('should have Llama models', () => {
      expect(BEDROCK_MODELS.LLAMA_3_70B).toBeDefined();
      expect(BEDROCK_MODELS.LLAMA_3_8B).toBeDefined();
    });

    it('should have Mistral models', () => {
      expect(BEDROCK_MODELS.MISTRAL_7B).toBeDefined();
      expect(BEDROCK_MODELS.MISTRAL_LARGE).toBeDefined();
    });
  });

  describe('DEFAULT_BEDROCK_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_BEDROCK_CONFIG.timeout).toBe(60000);
      expect(DEFAULT_BEDROCK_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_BEDROCK_CONFIG.defaultMaxTokens).toBe(1024);
      expect(DEFAULT_BEDROCK_CONFIG.debug).toBe(false);
    });
  });
});
