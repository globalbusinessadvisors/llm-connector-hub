/**
 * Tests for OpenAITransformer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformMessages,
  transformResponse,
  transformStreamChunk,
  transformTools,
  StreamAccumulator,
} from '../OpenAITransformer';
import type { Message } from '@llm-dev-ops/connector-hub-core';
import type { OpenAIResponse, OpenAIStreamChunk } from '../OpenAITransformer';

describe('OpenAITransformer', () => {
  describe('transformMessages', () => {
    it('should transform simple text messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages).toHaveLength(2);
      expect(openaiMessages[0]).toEqual({
        role: 'user',
        content: 'Hello!',
      });
      expect(openaiMessages[1]).toEqual({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should keep system messages as-is', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages).toHaveLength(2);
      expect(openaiMessages[0].role).toBe('system');
      expect(openaiMessages[0].content).toBe('You are a helpful assistant.');
    });

    it('should transform multimodal content with images', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: 'https://example.com/image.jpg' },
          ],
        },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages[0].content).toHaveLength(2);
      expect(Array.isArray(openaiMessages[0].content)).toBe(true);
      if (Array.isArray(openaiMessages[0].content)) {
        expect(openaiMessages[0].content[0]).toEqual({
          type: 'text',
          text: 'What is in this image?',
        });
        expect(openaiMessages[0].content[1]).toMatchObject({
          type: 'image_url',
          image_url: {
            url: 'https://example.com/image.jpg',
          },
        });
      }
    });

    it('should handle image_base64 content type', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this' },
            { type: 'image_base64', image_base64: 'base64data...' },
          ],
        },
      ];

      const openaiMessages = transformMessages(messages);

      expect(Array.isArray(openaiMessages[0].content)).toBe(true);
      if (Array.isArray(openaiMessages[0].content)) {
        expect(openaiMessages[0].content[1]).toMatchObject({
          type: 'image_url',
          image_url: {
            url: 'data:image/jpeg;base64,base64data...',
          },
        });
      }
    });

    it('should transform tool calls', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'Let me check that.',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location":"Paris"}',
              },
            },
          ],
        },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages[0].content).toBe('Let me check that.');
      expect(openaiMessages[0].tool_calls).toHaveLength(1);
      expect(openaiMessages[0].tool_calls![0]).toEqual({
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location":"Paris"}',
        },
      });
    });

    it('should extract text from ContentPart array without images', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages[0].content).toBe('First part\nSecond part');
    });

    it('should preserve message name field', () => {
      const messages: Message[] = [
        { role: 'function' as any, content: 'Result', name: 'get_weather' },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages[0].name).toBe('get_weather');
    });

    it('should preserve function_call field', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: null,
          function_call: { name: 'get_weather', arguments: '{"location":"Paris"}' },
        },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages[0].function_call).toEqual({
        name: 'get_weather',
        arguments: '{"location":"Paris"}',
      });
    });

    it('should preserve tool_call_id field', () => {
      const messages: Message[] = [
        {
          role: 'tool' as any,
          content: 'Weather is sunny',
          tool_call_id: 'call_123',
        },
      ];

      const openaiMessages = transformMessages(messages);

      expect(openaiMessages[0].tool_call_id).toBe('call_123');
    });
  });

  describe('transformTools', () => {
    it('should transform function definitions to tools format', () => {
      const functions = [
        {
          name: 'get_weather',
          description: 'Get weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
          },
        },
      ];

      const tools = transformTools(functions);

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
          },
        },
      });
    });
  });

  describe('transformResponse', () => {
    it('should transform simple text response', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello there!',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = transformResponse(response);

      expect(result.content).toBe('Hello there!');
      expect(result.role).toBe('assistant');
      expect(result.finish_reason).toBe('stop');
      expect(result.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      });
      expect(result.tool_calls).toBeUndefined();
    });

    it('should handle null content', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10,
        },
      };

      const result = transformResponse(response);

      expect(result.content).toBe('');
    });

    it('should extract tool calls', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Let me check.',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location":"Paris"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
        },
      };

      const result = transformResponse(response);

      expect(result.content).toBe('Let me check.');
      expect(result.finish_reason).toBe('tool_calls');
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0]).toEqual({
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location":"Paris"}',
        },
      });
    });

    it('should extract function_call', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            function_call: {
              name: 'get_weather',
              arguments: '{"location":"Paris"}',
            },
          },
          finish_reason: 'function_call',
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 10,
          total_tokens: 25,
        },
      };

      const result = transformResponse(response);

      expect(result.finish_reason).toBe('function_call');
      expect(result.function_call).toEqual({
        name: 'get_weather',
        arguments: '{"location":"Paris"}',
      });
    });

    it('should map stop reasons correctly', () => {
      const testCases: Array<[string | null, string]> = [
        ['stop', 'stop'],
        ['length', 'length'],
        ['function_call', 'function_call'],
        ['tool_calls', 'tool_calls'],
        ['content_filter', 'content_filter'],
        [null, 'stop'],
      ];

      for (const [openaiReason, expectedReason] of testCases) {
        const response: OpenAIResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: openaiReason as any,
          }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        };

        const result = transformResponse(response);
        expect(result.finish_reason).toBe(expectedReason);
      }
    });

    it('should throw if choices array is empty', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };

      expect(() => transformResponse(response)).toThrow('OpenAI response missing choices');
    });
  });

  describe('transformStreamChunk', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
      accumulator = new StreamAccumulator();
    });

    it('should handle role in delta', () => {
      const chunk: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null,
        }],
      };

      const streamChunk = transformStreamChunk(chunk, accumulator);

      expect(streamChunk).toEqual({ role: 'assistant' });
    });

    it('should handle content delta', () => {
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

      const streamChunk = transformStreamChunk(chunk, accumulator);

      expect(streamChunk).toEqual({ content: 'Hello' });
      expect(accumulator.getContent()).toBe('Hello');
    });

    it('should accumulate content deltas', () => {
      const chunk1: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hello ' }, finish_reason: null }],
      };

      const chunk2: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'world' }, finish_reason: null }],
      };

      transformStreamChunk(chunk1, accumulator);
      transformStreamChunk(chunk2, accumulator);

      expect(accumulator.getContent()).toBe('Hello world');
    });

    it('should handle finish_reason', () => {
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

      const streamChunk = transformStreamChunk(chunk, accumulator);

      expect(streamChunk?.finish_reason).toBe('stop');
    });

    it('should handle function_call delta', () => {
      const chunk1: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: { function_call: { name: 'get_weather' } },
          finish_reason: null,
        }],
      };

      const chunk2: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: { function_call: { arguments: '{"location":"Paris"}' } },
          finish_reason: null,
        }],
      };

      transformStreamChunk(chunk1, accumulator);
      transformStreamChunk(chunk2, accumulator);

      const functionCall = accumulator.getFunctionCall();
      expect(functionCall).toEqual({
        name: 'get_weather',
        arguments: '{"location":"Paris"}',
      });
    });

    it('should handle tool_calls delta', () => {
      const chunk1: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: 0,
              id: 'call_123',
              type: 'function',
              function: { name: 'get_weather' },
            }],
          },
          finish_reason: null,
        }],
      };

      const chunk2: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: 0,
              function: { arguments: '{"location":"Paris"}' },
            }],
          },
          finish_reason: null,
        }],
      };

      const chunk3: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'tool_calls',
        }],
      };

      transformStreamChunk(chunk1, accumulator);
      transformStreamChunk(chunk2, accumulator);
      const finalChunk = transformStreamChunk(chunk3, accumulator);

      expect(finalChunk?.tool_calls).toHaveLength(1);
      expect(finalChunk?.tool_calls![0]).toEqual({
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location":"Paris"}',
        },
      });
    });

    it('should return null for empty delta', () => {
      const chunk: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: null,
        }],
      };

      const streamChunk = transformStreamChunk(chunk, accumulator);

      expect(streamChunk).toBeNull();
    });

    it('should return null if no choices', () => {
      const chunk: OpenAIStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [],
      };

      const streamChunk = transformStreamChunk(chunk, accumulator);

      expect(streamChunk).toBeNull();
    });
  });

  describe('StreamAccumulator', () => {
    it('should accumulate content', () => {
      const accumulator = new StreamAccumulator();

      accumulator.appendContent('Hello ');
      accumulator.appendContent('world');

      expect(accumulator.getContent()).toBe('Hello world');
    });

    it('should reset state', () => {
      const accumulator = new StreamAccumulator();

      accumulator.appendContent('Hello');
      accumulator.reset();

      expect(accumulator.getContent()).toBe('');
    });

    it('should accumulate function call', () => {
      const accumulator = new StreamAccumulator();

      accumulator.appendFunctionCall({ name: 'get_weather' });
      accumulator.appendFunctionCall({ arguments: '{"location":"Paris"}' });

      expect(accumulator.getFunctionCall()).toEqual({
        name: 'get_weather',
        arguments: '{"location":"Paris"}',
      });
    });

    it('should accumulate tool calls', () => {
      const accumulator = new StreamAccumulator();

      accumulator.appendToolCall({
        index: 0,
        id: 'call_123',
        type: 'function',
        function: { name: 'get_weather' },
      });

      accumulator.appendToolCall({
        index: 0,
        function: { arguments: '{"location":"Paris"}' },
      });

      const toolCalls = accumulator.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location":"Paris"}',
        },
      });
    });

    it('should handle multiple tool calls', () => {
      const accumulator = new StreamAccumulator();

      accumulator.appendToolCall({
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
      });

      accumulator.appendToolCall({
        index: 1,
        id: 'call_2',
        type: 'function',
        function: { name: 'get_time', arguments: '{}' },
      });

      const toolCalls = accumulator.getToolCalls();
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].function.name).toBe('get_weather');
      expect(toolCalls[1].function.name).toBe('get_time');
    });
  });
});
