/**
 * Tests for GoogleTransformer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Message, ToolCall } from '@llm-connector-hub/core';
import {
  transformMessages,
  transformTools,
  transformResponse,
  transformStreamChunk,
  buildGenerationConfig,
  ensureMaxTokens,
  StreamAccumulator,
  type GoogleResponse,
  type GoogleStreamChunk,
} from '../GoogleTransformer';

describe('GoogleTransformer', () => {
  describe('transformMessages', () => {
    it('should transform simple text messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const [systemParts, contents] = transformMessages(messages);

      expect(systemParts).toBeUndefined();
      expect(contents).toHaveLength(2);
      expect(contents[0]).toEqual({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
      expect(contents[1]).toEqual({
        role: 'model',
        parts: [{ text: 'Hi there!' }],
      });
    });

    it('should extract system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];

      const [systemParts, contents] = transformMessages(messages);

      expect(systemParts).toEqual([{ text: 'You are a helpful assistant' }]);
      expect(contents).toHaveLength(1);
      expect(contents[0].role).toBe('user');
    });

    it('should concatenate multiple system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'First instruction' },
        { role: 'system', content: 'Second instruction' },
        { role: 'user', content: 'Hello' },
      ];

      const [systemParts, contents] = transformMessages(messages);

      expect(systemParts).toHaveLength(2);
      expect(systemParts![0]).toEqual({ text: 'First instruction' });
      expect(systemParts![1]).toEqual({ text: 'Second instruction' });
    });

    it('should transform multimodal messages', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_base64', image_base64: 'base64data' },
          ],
        },
      ];

      const [, contents] = transformMessages(messages);

      expect(contents[0].parts).toHaveLength(2);
      expect(contents[0].parts[0]).toEqual({ text: 'What is this?' });
      expect(contents[0].parts[1]).toEqual({
        inline_data: {
          mime_type: 'image/jpeg',
          data: 'base64data',
        },
      });
    });

    it('should handle data URLs for images', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: 'data:image/png;base64,iVBORw0KGgo=' },
          ],
        },
      ];

      const [, contents] = transformMessages(messages);

      expect(contents[0].parts[0]).toEqual({
        inline_data: {
          mime_type: 'image/png',
          data: 'iVBORw0KGgo=',
        },
      });
    });

    it('should handle tool calls', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'Let me check that',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location":"NYC"}',
              },
            },
          ],
        },
      ];

      const [, contents] = transformMessages(messages);

      expect(contents[0].parts).toHaveLength(2);
      expect(contents[0].parts[0]).toEqual({ text: 'Let me check that' });
      expect(contents[0].parts[1]).toEqual({
        function_call: {
          name: 'get_weather',
          args: { location: 'NYC' },
        },
      });
    });

    it('should handle tool responses', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          content: 'Temperature is 72F',
          tool_call_id: 'call_1',
          name: 'get_weather',
        },
      ];

      const [, contents] = transformMessages(messages);

      expect(contents[0].role).toBe('model');
      expect(contents[0].parts[0]).toEqual({
        function_response: {
          name: 'get_weather',
          response: {
            result: 'Temperature is 72F',
          },
        },
      });
    });
  });

  describe('transformTools', () => {
    it('should transform function definitions', () => {
      const functions = [
        {
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      ];

      const tools = transformTools(functions);

      expect(tools).toHaveLength(1);
      expect(tools![0].function_declarations).toHaveLength(1);
      expect(tools![0].function_declarations[0]).toEqual({
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        },
      });
    });

    it('should return undefined for empty functions', () => {
      expect(transformTools([])).toBeUndefined();
      expect(transformTools(undefined)).toBeUndefined();
    });
  });

  describe('transformResponse', () => {
    it('should transform basic response', () => {
      const response: GoogleResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Hello!' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      const transformed = transformResponse(response);

      expect(transformed.content).toBe('Hello!');
      expect(transformed.role).toBe('assistant');
      expect(transformed.finish_reason).toBe('stop');
      expect(transformed.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });

    it('should handle multiple text parts', () => {
      const response: GoogleResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Hello' }, { text: 'World' }],
            },
            finishReason: 'STOP',
          },
        ],
      };

      const transformed = transformResponse(response);

      expect(transformed.content).toBe('Hello\nWorld');
    });

    it('should extract function calls', () => {
      const response: GoogleResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Let me check' },
                {
                  function_call: {
                    name: 'get_weather',
                    args: { location: 'NYC' },
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      const transformed = transformResponse(response);

      expect(transformed.tool_calls).toHaveLength(1);
      expect(transformed.tool_calls![0]).toEqual({
        id: 'call_0',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location":"NYC"}',
        },
      });
    });

    it('should map finish reasons correctly', () => {
      const testCases = [
        { googleReason: 'STOP' as const, expectedReason: 'stop' as const },
        { googleReason: 'MAX_TOKENS' as const, expectedReason: 'length' as const },
        { googleReason: 'SAFETY' as const, expectedReason: 'content_filter' as const },
        { googleReason: 'RECITATION' as const, expectedReason: 'content_filter' as const },
      ];

      for (const { googleReason, expectedReason } of testCases) {
        const response: GoogleResponse = {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Test' }],
              },
              finishReason: googleReason,
            },
          ],
        };

        const transformed = transformResponse(response);
        expect(transformed.finish_reason).toBe(expectedReason);
      }
    });

    it('should throw if no candidates', () => {
      const response: GoogleResponse = {
        candidates: [],
      };

      expect(() => transformResponse(response)).toThrow('No candidates in Google AI response');
    });
  });

  describe('StreamAccumulator', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
      accumulator = new StreamAccumulator();
    });

    it('should accumulate text', () => {
      accumulator.appendText('Hello');
      accumulator.appendText(' World');

      expect(accumulator.getFullText()).toBe('Hello World');
    });

    it('should add function calls', () => {
      accumulator.addFunctionCall({
        name: 'func1',
        args: { key: 'value' },
      });

      const toolCalls = accumulator.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].function.name).toBe('func1');
      expect(toolCalls[0].function.arguments).toBe('{"key":"value"}');
    });

    it('should reset state', () => {
      accumulator.appendText('Hello');
      accumulator.addFunctionCall({
        name: 'func1',
        args: {},
      });

      accumulator.reset();

      expect(accumulator.getFullText()).toBe('');
      expect(accumulator.getToolCalls()).toHaveLength(0);
      expect(accumulator.hasRole).toBe(false);
    });
  });

  describe('transformStreamChunk', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
      accumulator = new StreamAccumulator();
    });

    it('should transform text chunks', () => {
      const chunk: GoogleStreamChunk = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Hello' }],
            },
          },
        ],
      };

      const transformed = transformStreamChunk(chunk, accumulator);

      expect(transformed).toEqual({
        role: 'assistant',
        content: 'Hello',
      });
      expect(accumulator.hasRole).toBe(true);
    });

    it('should not include role in subsequent chunks', () => {
      accumulator.hasRole = true;

      const chunk: GoogleStreamChunk = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Hello' }],
            },
          },
        ],
      };

      const transformed = transformStreamChunk(chunk, accumulator);

      expect(transformed).toEqual({
        content: 'Hello',
      });
    });

    it('should handle finish reason', () => {
      const chunk: GoogleStreamChunk = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [],
            },
            finishReason: 'STOP',
          },
        ],
      };

      const transformed = transformStreamChunk(chunk, accumulator);

      expect(transformed?.finish_reason).toBe('stop');
    });

    it('should return null for empty chunks', () => {
      const chunk: GoogleStreamChunk = {
        candidates: [],
      };

      const transformed = transformStreamChunk(chunk, accumulator);

      expect(transformed).toBeNull();
    });
  });

  describe('ensureMaxTokens', () => {
    it('should return provided value if present', () => {
      expect(ensureMaxTokens(1000, 2048)).toBe(1000);
    });

    it('should return default if not provided', () => {
      expect(ensureMaxTokens(undefined, 2048)).toBe(2048);
    });
  });

  describe('buildGenerationConfig', () => {
    it('should build config with all parameters', () => {
      const config = buildGenerationConfig({
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        max_tokens: 1000,
        stop: ['END'],
        defaultMaxTokens: 2048,
      });

      expect(config).toEqual({
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1000,
        stopSequences: ['END'],
      });
    });

    it('should use defaults for missing parameters', () => {
      const config = buildGenerationConfig({
        defaultMaxTokens: 2048,
      });

      expect(config).toEqual({
        maxOutputTokens: 2048,
      });
    });

    it('should handle partial parameters', () => {
      const config = buildGenerationConfig({
        temperature: 0.5,
        max_tokens: 500,
        defaultMaxTokens: 2048,
      });

      expect(config).toEqual({
        temperature: 0.5,
        maxOutputTokens: 500,
      });
    });
  });
});
