/**
 * Tests for AnthropicTransformer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformMessages,
  transformResponse,
  transformStreamEvent,
  StreamAccumulator,
  ensureMaxTokens,
} from '../AnthropicTransformer';
import type { Message } from '@llm-dev-ops/connector-hub-core';
import type { AnthropicResponse, AnthropicStreamEvent } from '../AnthropicTransformer';

describe('AnthropicTransformer', () => {
  describe('transformMessages', () => {
    it('should extract system message from messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];

      const [systemMessage, anthropicMessages] = transformMessages(messages);

      expect(systemMessage).toBe('You are a helpful assistant.');
      expect(anthropicMessages).toHaveLength(1);
      expect(anthropicMessages[0].role).toBe('user');
    });

    it('should concatenate multiple system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'First instruction.' },
        { role: 'system', content: 'Second instruction.' },
        { role: 'user', content: 'Hello!' },
      ];

      const [systemMessage, anthropicMessages] = transformMessages(messages);

      expect(systemMessage).toBe('First instruction.\n\nSecond instruction.');
      expect(anthropicMessages).toHaveLength(1);
    });

    it('should handle messages without system message', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const [systemMessage, anthropicMessages] = transformMessages(messages);

      expect(systemMessage).toBeUndefined();
      expect(anthropicMessages).toHaveLength(2);
    });

    it('should transform simple text messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const [, anthropicMessages] = transformMessages(messages);

      expect(anthropicMessages[0]).toEqual({
        role: 'user',
        content: [{ type: 'text', text: 'Hello!' }],
      });
      expect(anthropicMessages[1]).toEqual({
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }],
      });
    });

    it('should transform multimodal content with images', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: 'data:image/jpeg;base64,/9j/4AAQ...' },
          ],
        },
      ];

      const [, anthropicMessages] = transformMessages(messages);

      expect(anthropicMessages[0].content).toHaveLength(2);
      expect(anthropicMessages[0].content[0]).toEqual({
        type: 'text',
        text: 'What is in this image?',
      });
      expect(anthropicMessages[0].content[1]).toMatchObject({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
        },
      });
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

      const [, anthropicMessages] = transformMessages(messages);

      expect(anthropicMessages[0].content[1]).toMatchObject({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: 'base64data...',
        },
      });
    });

    it('should transform tool calls to tool_use blocks', () => {
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

      const [, anthropicMessages] = transformMessages(messages);

      expect(anthropicMessages[0].content).toHaveLength(2);
      expect(anthropicMessages[0].content[0]).toEqual({
        type: 'text',
        text: 'Let me check that.',
      });
      expect(anthropicMessages[0].content[1]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: { location: 'Paris' },
      });
    });

    it('should skip function and tool role messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'function' as any, content: 'Function result' },
        { role: 'assistant', content: 'Response' },
      ];

      const [, anthropicMessages] = transformMessages(messages);

      expect(anthropicMessages).toHaveLength(2);
      expect(anthropicMessages[0].role).toBe('user');
      expect(anthropicMessages[1].role).toBe('assistant');
    });

    it('should extract text from ContentPart array in system message', () => {
      const messages: Message[] = [
        {
          role: 'system',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
        { role: 'user', content: 'Hello' },
      ];

      const [systemMessage] = transformMessages(messages);

      expect(systemMessage).toBe('First part\nSecond part');
    });
  });

  describe('transformResponse', () => {
    it('should transform simple text response', () => {
      const response: AnthropicResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello there!' },
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
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

    it('should concatenate multiple text blocks', () => {
      const response: AnthropicResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'First block.' },
          { type: 'text', text: 'Second block.' },
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      const result = transformResponse(response);

      expect(result.content).toBe('First block.\nSecond block.');
    });

    it('should extract tool calls', () => {
      const response: AnthropicResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check.' },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_weather',
            input: { location: 'Paris' },
          },
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 15,
          output_tokens: 25,
        },
      };

      const result = transformResponse(response);

      expect(result.content).toBe('Let me check.');
      expect(result.finish_reason).toBe('tool_calls');
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0]).toEqual({
        id: 'toolu_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location":"Paris"}',
        },
      });
    });

    it('should map stop reasons correctly', () => {
      const testCases: Array<[string | null, string]> = [
        ['end_turn', 'stop'],
        ['max_tokens', 'length'],
        ['stop_sequence', 'stop'],
        ['tool_use', 'tool_calls'],
        [null, 'stop'],
      ];

      for (const [anthropicReason, expectedReason] of testCases) {
        const response: AnthropicResponse = {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          model: 'claude-3-opus-20240229',
          stop_reason: anthropicReason as any,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = transformResponse(response);
        expect(result.finish_reason).toBe(expectedReason);
      }
    });

    it('should calculate total tokens correctly', () => {
      const response: AnthropicResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      };

      const result = transformResponse(response);

      expect(result.usage.total_tokens).toBe(150);
    });
  });

  describe('transformStreamEvent', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
      accumulator = new StreamAccumulator();
    });

    it('should handle message_start event', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_start',
        message: {
          id: 'msg_123',
          role: 'assistant',
        },
      };

      const chunk = transformStreamEvent(event, accumulator);

      expect(chunk).toEqual({ role: 'assistant' });
    });

    it('should handle content_block_delta with text', () => {
      const startEvent: AnthropicStreamEvent = {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      };
      transformStreamEvent(startEvent, accumulator);

      const deltaEvent: AnthropicStreamEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      };

      const chunk = transformStreamEvent(deltaEvent, accumulator);

      expect(chunk).toEqual({ content: 'Hello' });
    });

    it('should accumulate text deltas', () => {
      const startEvent: AnthropicStreamEvent = {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      };
      transformStreamEvent(startEvent, accumulator);

      transformStreamEvent({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello ' },
      }, accumulator);

      transformStreamEvent({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'world' },
      }, accumulator);

      expect(accumulator.getFullText()).toBe('Hello world');
    });

    it('should handle message_delta with stop_reason', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 20 },
      };

      const chunk = transformStreamEvent(event, accumulator);

      expect(chunk?.finish_reason).toBe('stop');
    });

    it('should handle tool use blocks in streaming', () => {
      const startEvent: AnthropicStreamEvent = {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'get_weather',
        },
      };
      transformStreamEvent(startEvent, accumulator);

      const deltaEvent: AnthropicStreamEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"location":' },
      };
      transformStreamEvent(deltaEvent, accumulator);

      const delta2Event: AnthropicStreamEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '"Paris"}' },
      };
      transformStreamEvent(delta2Event, accumulator);

      const toolCalls = accumulator.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        id: 'toolu_123',
        name: 'get_weather',
        input: '{"location":"Paris"}',
      });
    });

    it('should return null for content_block_stop', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_stop',
        index: 0,
      };

      const chunk = transformStreamEvent(event, accumulator);

      expect(chunk).toBeNull();
    });

    it('should return null for message_stop', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_stop',
      };

      const chunk = transformStreamEvent(event, accumulator);

      expect(chunk).toBeNull();
    });

    it('should return null for ping', () => {
      const event: AnthropicStreamEvent = {
        type: 'ping',
      };

      const chunk = transformStreamEvent(event, accumulator);

      expect(chunk).toBeNull();
    });

    it('should throw for error event', () => {
      const event: AnthropicStreamEvent = {
        type: 'error',
        error: { type: 'api_error', message: 'Something went wrong' },
      };

      expect(() => transformStreamEvent(event, accumulator)).toThrow('Anthropic streaming error');
    });
  });

  describe('StreamAccumulator', () => {
    it('should accumulate text across multiple blocks', () => {
      const accumulator = new StreamAccumulator();

      accumulator.startTextBlock(0);
      accumulator.appendText(0, 'Hello ');
      accumulator.startTextBlock(1);
      accumulator.appendText(1, 'world');

      expect(accumulator.getFullText()).toBe('Hello world');
    });

    it('should reset state', () => {
      const accumulator = new StreamAccumulator();

      accumulator.startTextBlock(0);
      accumulator.appendText(0, 'Hello');

      accumulator.reset();

      expect(accumulator.getFullText()).toBe('');
    });

    it('should handle tool use blocks', () => {
      const accumulator = new StreamAccumulator();

      accumulator.startToolUseBlock(0, {
        id: 'tool_1',
        name: 'test_tool',
      } as any);
      accumulator.appendJson(0, '{"arg":"value"}');

      const toolCalls = accumulator.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe('tool_1');
      expect(toolCalls[0].name).toBe('test_tool');
      expect(toolCalls[0].input).toBe('{"arg":"value"}');
    });
  });

  describe('ensureMaxTokens', () => {
    it('should use provided maxTokens if defined', () => {
      expect(ensureMaxTokens(100, 1024)).toBe(100);
    });

    it('should use default if maxTokens is undefined', () => {
      expect(ensureMaxTokens(undefined, 1024)).toBe(1024);
    });

    it('should use provided maxTokens even if 0', () => {
      expect(ensureMaxTokens(0, 1024)).toBe(0);
    });

    it('should use default for various default values', () => {
      expect(ensureMaxTokens(undefined, 512)).toBe(512);
      expect(ensureMaxTokens(undefined, 2048)).toBe(2048);
      expect(ensureMaxTokens(undefined, 4096)).toBe(4096);
    });
  });
});
