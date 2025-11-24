/**
 * Tests for GoogleConfig
 */

import { describe, it, expect } from 'vitest';
import {
  validateGoogleConfig,
  mergeWithDefaults,
  getModelInfo,
  supportsVision,
  supportsStreaming,
  supportsTools,
  getMaxTokens,
  getContextWindow,
  GoogleConfigError,
  GOOGLE_MODELS,
  DEFAULT_GOOGLE_CONFIG,
  DEFAULT_SAFETY_SETTINGS,
} from '../GoogleConfig';

describe('GoogleConfig', () => {
  describe('validateGoogleConfig', () => {
    it('should accept valid config', () => {
      const config = {
        apiKey: 'test-api-key',
      };

      expect(() => validateGoogleConfig(config)).not.toThrow();
    });

    it('should throw if API key is missing', () => {
      const config = {
        apiKey: '',
      };

      expect(() => validateGoogleConfig(config)).toThrow(GoogleConfigError);
      expect(() => validateGoogleConfig(config)).toThrow('API key is required');
    });

    it('should throw if API key is not a string', () => {
      const config = {
        apiKey: 123 as any,
      };

      expect(() => validateGoogleConfig(config)).toThrow('API key must be a non-empty string');
    });

    it('should throw if timeout is negative', () => {
      const config = {
        apiKey: 'test-api-key',
        timeout: -1000,
      };

      expect(() => validateGoogleConfig(config)).toThrow('Timeout must be a positive number');
    });

    it('should throw if maxRetries is negative', () => {
      const config = {
        apiKey: 'test-api-key',
        maxRetries: -1,
      };

      expect(() => validateGoogleConfig(config)).toThrow('Max retries must be a non-negative number');
    });

    it('should throw if defaultMaxTokens is zero or negative', () => {
      const config = {
        apiKey: 'test-api-key',
        defaultMaxTokens: 0,
      };

      expect(() => validateGoogleConfig(config)).toThrow('Default max tokens must be a positive number');
    });

    it('should throw if baseUrl is invalid', () => {
      const config = {
        apiKey: 'test-api-key',
        baseUrl: 'not-a-url',
      };

      expect(() => validateGoogleConfig(config)).toThrow('Base URL must be a valid HTTP(S) URL');
    });

    it('should throw if safety settings is not an array', () => {
      const config = {
        apiKey: 'test-api-key',
        defaultSafetySettings: {} as any,
      };

      expect(() => validateGoogleConfig(config)).toThrow('Safety settings must be an array');
    });

    it('should throw if safety settings are incomplete', () => {
      const config = {
        apiKey: 'test-api-key',
        defaultSafetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT' } as any],
      };

      expect(() => validateGoogleConfig(config)).toThrow('Each safety setting must have category and threshold');
    });

    it('should accept config with all valid optional fields', () => {
      const config = {
        apiKey: 'test-api-key',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        timeout: 30000,
        maxRetries: 3,
        defaultMaxTokens: 2048,
        debug: true,
        defaultSafetySettings: DEFAULT_SAFETY_SETTINGS,
      };

      expect(() => validateGoogleConfig(config)).not.toThrow();
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge config with defaults', () => {
      const config = {
        apiKey: 'test-api-key',
      };

      const merged = mergeWithDefaults(config);

      expect(merged.apiKey).toBe('test-api-key');
      expect(merged.baseUrl).toBe(DEFAULT_GOOGLE_CONFIG.baseUrl);
      expect(merged.timeout).toBe(DEFAULT_GOOGLE_CONFIG.timeout);
      expect(merged.maxRetries).toBe(DEFAULT_GOOGLE_CONFIG.maxRetries);
      expect(merged.defaultMaxTokens).toBe(DEFAULT_GOOGLE_CONFIG.defaultMaxTokens);
      expect(merged.debug).toBe(DEFAULT_GOOGLE_CONFIG.debug);
      expect(merged.defaultSafetySettings).toEqual(DEFAULT_SAFETY_SETTINGS);
    });

    it('should preserve user-provided values', () => {
      const config = {
        apiKey: 'test-api-key',
        timeout: 10000,
        maxRetries: 5,
        defaultMaxTokens: 4096,
        debug: true,
      };

      const merged = mergeWithDefaults(config);

      expect(merged.timeout).toBe(10000);
      expect(merged.maxRetries).toBe(5);
      expect(merged.defaultMaxTokens).toBe(4096);
      expect(merged.debug).toBe(true);
    });

    it('should include additional headers if provided', () => {
      const config = {
        apiKey: 'test-api-key',
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
    it('should return model info for known models', () => {
      const info = getModelInfo(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST);

      expect(info).toBeDefined();
      expect(info?.name).toBe('Gemini 1.5 Pro (Latest)');
      expect(info?.supportsVision).toBe(true);
      expect(info?.supportsStreaming).toBe(true);
    });

    it('should return undefined for unknown models', () => {
      const info = getModelInfo('unknown-model');

      expect(info).toBeUndefined();
    });
  });

  describe('supportsVision', () => {
    it('should return true for vision-capable models', () => {
      expect(supportsVision(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST)).toBe(true);
      expect(supportsVision(GOOGLE_MODELS.GEMINI_PRO_VISION)).toBe(true);
    });

    it('should return false for text-only models', () => {
      expect(supportsVision(GOOGLE_MODELS.GEMINI_PRO)).toBe(false);
    });

    it('should return false for unknown models', () => {
      expect(supportsVision('unknown-model')).toBe(false);
    });
  });

  describe('supportsStreaming', () => {
    it('should return true for all known models', () => {
      expect(supportsStreaming(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST)).toBe(true);
      expect(supportsStreaming(GOOGLE_MODELS.GEMINI_PRO)).toBe(true);
    });

    it('should default to true for unknown models', () => {
      expect(supportsStreaming('unknown-model')).toBe(true);
    });
  });

  describe('supportsTools', () => {
    it('should return true for tool-capable models', () => {
      expect(supportsTools(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST)).toBe(true);
      expect(supportsTools(GOOGLE_MODELS.GEMINI_PRO)).toBe(true);
    });

    it('should return false for models without tool support', () => {
      expect(supportsTools(GOOGLE_MODELS.GEMINI_PRO_VISION)).toBe(false);
    });

    it('should return false for unknown models', () => {
      expect(supportsTools('unknown-model')).toBe(false);
    });
  });

  describe('getMaxTokens', () => {
    it('should return max tokens for known models', () => {
      expect(getMaxTokens(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST)).toBe(8192);
      expect(getMaxTokens(GOOGLE_MODELS.GEMINI_PRO_VISION)).toBe(4096);
    });

    it('should return undefined for unknown models', () => {
      expect(getMaxTokens('unknown-model')).toBeUndefined();
    });
  });

  describe('getContextWindow', () => {
    it('should return context window for known models', () => {
      expect(getContextWindow(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST)).toBe(2097152);
      expect(getContextWindow(GOOGLE_MODELS.GEMINI_PRO)).toBe(32760);
    });

    it('should return undefined for unknown models', () => {
      expect(getContextWindow('unknown-model')).toBeUndefined();
    });
  });

  describe('GOOGLE_MODELS', () => {
    it('should contain expected model IDs', () => {
      expect(GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST).toBe('gemini-1.5-pro-latest');
      expect(GOOGLE_MODELS.GEMINI_1_5_FLASH_LATEST).toBe('gemini-1.5-flash-latest');
      expect(GOOGLE_MODELS.GEMINI_PRO).toBe('gemini-pro');
      expect(GOOGLE_MODELS.GEMINI_PRO_VISION).toBe('gemini-pro-vision');
      expect(GOOGLE_MODELS.GEMINI_ULTRA).toBe('gemini-ultra');
    });
  });

  describe('DEFAULT_SAFETY_SETTINGS', () => {
    it('should contain all harm categories', () => {
      expect(DEFAULT_SAFETY_SETTINGS).toHaveLength(4);

      const categories = DEFAULT_SAFETY_SETTINGS.map((s) => s.category);
      expect(categories).toContain('HARM_CATEGORY_HARASSMENT');
      expect(categories).toContain('HARM_CATEGORY_HATE_SPEECH');
      expect(categories).toContain('HARM_CATEGORY_SEXUALLY_EXPLICIT');
      expect(categories).toContain('HARM_CATEGORY_DANGEROUS_CONTENT');
    });

    it('should use BLOCK_ONLY_HIGH threshold', () => {
      DEFAULT_SAFETY_SETTINGS.forEach((setting) => {
        expect(setting.threshold).toBe('BLOCK_ONLY_HIGH');
      });
    });
  });
});
