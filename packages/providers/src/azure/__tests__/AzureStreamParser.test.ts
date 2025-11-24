/**
 * Tests for AzureStreamParser
 * Note: Azure uses the same SSE format as OpenAI
 */

import { describe, it, expect } from 'vitest';
import {
  parseSSEString,
  isValidStreamChunk,
} from '../AzureStreamParser';

describe('AzureStreamParser', () => {
  describe('parseSSEString', () => {
    it('should parse content delta', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
    });

    it('should parse multiple chunks', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].choices[0].delta.role).toBe('assistant');
      expect(chunks[1].choices[0].delta.content).toBe('Hello');
    });

    it('should stop at [DONE] marker', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: [DONE]

data: {"id":"chatcmpl-456","object":"chat.completion.chunk","created":1677652289,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Should not appear"},"finish_reason":null}]}

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
    });

    it('should handle finish_reason', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].finish_reason).toBe('stop');
    });

    it('should return empty array for empty string', () => {
      const chunks = parseSSEString('');
      expect(chunks).toHaveLength(0);
    });
  });

  describe('isValidStreamChunk', () => {
    it('should validate valid chunk', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: { content: 'Hello' },
          finish_reason: null,
        }],
      };

      expect(isValidStreamChunk(chunk)).toBe(true);
    });

    it('should reject invalid chunk', () => {
      expect(isValidStreamChunk(null)).toBe(false);
      expect(isValidStreamChunk({})).toBe(false);
      expect(isValidStreamChunk({ id: 'test' })).toBe(false);
    });
  });
});
