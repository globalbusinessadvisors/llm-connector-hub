/**
 * Tests for OpenAIStreamParser
 */

import { describe, it, expect } from 'vitest';
import {
  parseSSEString,
  isValidStreamChunk,
  extractTextFromChunks,
} from '../OpenAIStreamParser';
import type { OpenAIStreamChunk } from '../OpenAITransformer';

describe('OpenAIStreamParser', () => {
  describe('parseSSEString', () => {
    it('should parse simple content delta', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].id).toBe('chatcmpl-123');
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
    });

    it('should parse role delta', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.role).toBe('assistant');
    });

    it('should parse multiple chunks', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(4);
      expect(chunks[0].choices[0].delta.role).toBe('assistant');
      expect(chunks[1].choices[0].delta.content).toBe('Hello');
      expect(chunks[2].choices[0].delta.content).toBe(' world');
      expect(chunks[3].choices[0].finish_reason).toBe('stop');
    });

    it('should handle finish_reason in chunk', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].finish_reason).toBe('stop');
    });

    it('should stop at [DONE] marker', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: [DONE]

data: {"id":"chatcmpl-456","object":"chat.completion.chunk","created":1677652289,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Should not appear"},"finish_reason":null}]}

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
    });

    it('should skip empty lines', () => {
      const sse = `

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}


data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
    });

    it('should handle tool_calls delta', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"Paris\\"}"}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(4);
      expect(chunks[0].choices[0].delta.tool_calls).toBeDefined();
      expect(chunks[0].choices[0].delta.tool_calls![0].id).toBe('call_123');
      expect(chunks[0].choices[0].delta.tool_calls![0].function?.name).toBe('get_weather');
      expect(chunks[3].choices[0].finish_reason).toBe('tool_calls');
    });

    it('should handle function_call delta', () => {
      const sse = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"function_call":{"name":"get_weather","arguments":""}},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"function_call":{"arguments":"{\\"location\\":\\"Paris\\"}"}},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"function_call"}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(3);
      expect(chunks[0].choices[0].delta.function_call).toBeDefined();
      expect(chunks[0].choices[0].delta.function_call!.name).toBe('get_weather');
      expect(chunks[2].choices[0].finish_reason).toBe('function_call');
    });

    it('should return empty array for empty string', () => {
      const chunks = parseSSEString('');
      expect(chunks).toHaveLength(0);
    });

    it('should return empty array for whitespace only', () => {
      const chunks = parseSSEString('   \n\n  \n');
      expect(chunks).toHaveLength(0);
    });

    it('should skip lines without data prefix', () => {
      const sse = `event: message_start
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      expect(chunks).toHaveLength(1);
    });

    it('should handle invalid JSON gracefully', () => {
      const sse = `data: invalid json

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: [DONE]

`;

      const chunks = parseSSEString(sse);

      // Should skip invalid JSON and continue parsing
      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
    });
  });

  describe('isValidStreamChunk', () => {
    it('should validate valid chunk', () => {
      const chunk: OpenAIStreamChunk = {
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

    it('should validate chunk with empty delta', () => {
      const chunk: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };

      expect(isValidStreamChunk(chunk)).toBe(true);
    });

    it('should reject null', () => {
      expect(isValidStreamChunk(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidStreamChunk(undefined)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(isValidStreamChunk('string')).toBe(false);
      expect(isValidStreamChunk(123)).toBe(false);
    });

    it('should reject object without id', () => {
      expect(isValidStreamChunk({
        object: 'chat.completion.chunk',
        choices: [],
      })).toBe(false);
    });

    it('should reject object with wrong object type', () => {
      expect(isValidStreamChunk({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        choices: [],
      })).toBe(false);
    });

    it('should reject object without choices array', () => {
      expect(isValidStreamChunk({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
      })).toBe(false);
    });

    it('should reject object with non-array choices', () => {
      expect(isValidStreamChunk({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        choices: 'not an array',
      })).toBe(false);
    });
  });

  describe('extractTextFromChunks', () => {
    it('should extract text from content deltas', () => {
      const chunks: OpenAIStreamChunk[] = [
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          }],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { content: ' ' },
            finish_reason: null,
          }],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { content: 'world' },
            finish_reason: null,
          }],
        },
      ];

      const text = extractTextFromChunks(chunks);

      expect(text).toBe('Hello world');
    });

    it('should handle chunks without content', () => {
      const chunks: OpenAIStreamChunk[] = [
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null,
          }],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          }],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
          }],
        },
      ];

      const text = extractTextFromChunks(chunks);

      expect(text).toBe('Hello');
    });

    it('should return empty string for chunks with no content', () => {
      const chunks: OpenAIStreamChunk[] = [
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null,
          }],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
          }],
        },
      ];

      const text = extractTextFromChunks(chunks);

      expect(text).toBe('');
    });

    it('should return empty string for empty array', () => {
      const text = extractTextFromChunks([]);

      expect(text).toBe('');
    });
  });
});
