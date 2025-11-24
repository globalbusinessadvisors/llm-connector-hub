/**
 * Tests for AzureConfig
 */

import { describe, it, expect } from 'vitest';
import {
  validateAzureConfig,
  mergeWithDefaults,
  AzureConfigError,
  DEFAULT_AZURE_CONFIG,
} from '../AzureConfig';

describe('AzureConfig', () => {
  describe('validateAzureConfig', () => {
    it('should accept valid config', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://test-resource.openai.azure.com',
        deploymentName: 'gpt-4-deployment',
      };

      expect(() => validateAzureConfig(config)).not.toThrow();
    });

    it('should throw if API key is missing', () => {
      const config = {
        apiKey: '',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test',
      };

      expect(() => validateAzureConfig(config)).toThrow(AzureConfigError);
      expect(() => validateAzureConfig(config)).toThrow('API key is required');
    });

    it('should throw if endpoint is missing', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: '',
        deploymentName: 'test',
      };

      expect(() => validateAzureConfig(config)).toThrow('Endpoint is required');
    });

    it('should throw if deploymentName is missing', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: '',
      };

      expect(() => validateAzureConfig(config)).toThrow('Deployment name is required');
    });

    it('should throw if endpoint is not a valid URL', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'not-a-url',
        deploymentName: 'test',
      };

      expect(() => validateAzureConfig(config)).toThrow('Endpoint must be a valid HTTP(S) URL');
    });

    it('should throw if timeout is negative', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test',
        timeout: -1000,
      };

      expect(() => validateAzureConfig(config)).toThrow('Timeout must be a positive number');
    });

    it('should throw if maxRetries is negative', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test',
        maxRetries: -1,
      };

      expect(() => validateAzureConfig(config)).toThrow('Max retries must be a non-negative number');
    });

    it('should accept config with all valid optional fields', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test',
        apiVersion: '2024-02-15-preview',
        timeout: 30000,
        maxRetries: 3,
        defaultMaxTokens: 1024,
        debug: true,
      };

      expect(() => validateAzureConfig(config)).not.toThrow();
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user config with defaults', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test',
      };

      const merged = mergeWithDefaults(config);

      expect(merged.apiKey).toBe('test-key');
      expect(merged.endpoint).toBe('https://test.openai.azure.com');
      expect(merged.deploymentName).toBe('test');
      expect(merged.apiVersion).toBe(DEFAULT_AZURE_CONFIG.apiVersion);
      expect(merged.timeout).toBe(DEFAULT_AZURE_CONFIG.timeout);
      expect(merged.maxRetries).toBe(DEFAULT_AZURE_CONFIG.maxRetries);
      expect(merged.debug).toBe(DEFAULT_AZURE_CONFIG.debug);
    });

    it('should use user values over defaults', () => {
      const config = {
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'test',
        timeout: 10000,
        maxRetries: 5,
        debug: true,
      };

      const merged = mergeWithDefaults(config);

      expect(merged.timeout).toBe(10000);
      expect(merged.maxRetries).toBe(5);
      expect(merged.debug).toBe(true);
    });
  });

  describe('DEFAULT_AZURE_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_AZURE_CONFIG.apiVersion).toBeDefined();
      expect(DEFAULT_AZURE_CONFIG.timeout).toBe(60000);
      expect(DEFAULT_AZURE_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_AZURE_CONFIG.debug).toBe(false);
    });
  });
});
