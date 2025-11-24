/**
 * Tests for AzureTransformer
 * Note: Azure uses the same request/response format as OpenAI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformMessages,
  transformResponse,
  transformStreamChunk,
  transformTools,
  StreamAccumulator,
} from '../AzureTransformer';
import type { Message } from '@llm-dev-ops/connector-hub-core';
import type { AzureResponse, AzureStreamChunk } from '../AzureTransformer';

describe('AzureTransformer', () => {
  describe('transformMessages', () => {
    it('should transform simple text messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const azureMessages = transformMessages(messages);

      expect(azureMessages).toHaveLength(2);
      expect(azureMessages[0]).toEqual({
        role: 'user',
        content: 'Hello!',
      });
      expect(azureMessages[1]).toEqual({
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should handle system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];

      const azureMessages = transformMessages(messages);

      expect(azureMessages).toHaveLength(2);
      expect(azureMessages[0].role).toBe('system');
      expect(azureMessages[0].content).toBe('You are a helpful assistant.');
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

      const azureMessages = transformMessages(messages);

      expect(Array.isArray(azureMessages[0].content)).toBe(true);
      if (Array.isArray(azureMessages[0].content)) {
        expect(azureMessages[0].content).toHaveLength(2);
      }
    });

    it('should handle tool calls', () => {
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

      const azureMessages = transformMessages(messages);

      expect(azureMessages[0].tool_calls).toHaveLength(1);
    });
  });

  describe('transformResponse', () => {
    it('should transform simple text response', () => {
      const response: AzureResponse = {
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
      expect(result.usage.total_tokens).toBe(30);
    });

    it('should handle tool calls in response', () => {
      const response: AzureResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location":"Paris"}',
              },
            }],
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

      expect(result.finish_reason).toBe('tool_calls');
      expect(result.tool_calls).toHaveLength(1);
    });
  });

  describe('transformStreamChunk', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
      accumulator = new StreamAccumulator();
    });

    it('should handle content delta', () => {
      const chunk: AzureStreamChunk = {
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
    });

    it('should accumulate content', () => {
      const chunk1: AzureStreamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hello ' }, finish_reason: null }],
      };

      const chunk2: AzureStreamChunk = {
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
  });

  describe('transformTools', () => {
    it('should transform function definitions', () => {
      const functions = [
        {
          name: 'get_weather',
          description: 'Get weather information',
          parameters: { type: 'object', properties: { location: { type: 'string' } } },
        },
      ];

      const tools = transformTools(functions);

      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('get_weather');
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
  });
});
