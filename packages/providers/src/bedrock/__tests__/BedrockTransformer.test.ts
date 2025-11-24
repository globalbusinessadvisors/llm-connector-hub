/**
 * Tests for BedrockTransformer
 */

import { describe, it, expect } from 'vitest';
import {
  transformRequest,
  transformResponse,
  transformStreamChunk,
  ensureMaxTokens,
} from '../BedrockTransformer';
import type { Message } from '@llm-dev-ops/connector-hub-core';
import type { BedrockResponse } from '../BedrockTransformer';

describe('BedrockTransformer', () => {
  describe('transformRequest', () => {
    it('should transform simple messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const request = transformRequest('anthropic.claude-3-sonnet-20240229-v1:0', messages, {});

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[0].content).toBe('Hello!');
    });

    it('should extract system message', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello!' },
      ];

      const request = transformRequest('anthropic.claude-3-sonnet-20240229-v1:0', messages, {});

      expect(request.system).toBe('You are helpful');
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
    });

    it('should include optional parameters', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const request = transformRequest('anthropic.claude-3-sonnet-20240229-v1:0', messages, {
        max_tokens: 100,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        stop_sequences: ['STOP'],
      });

      expect(request.max_tokens).toBe(100);
      expect(request.temperature).toBe(0.7);
      expect(request.top_p).toBe(0.9);
      expect(request.top_k).toBe(40);
      expect(request.stop_sequences).toEqual(['STOP']);
    });

    it('should handle multimodal content', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: 'data:image/jpeg;base64,abc123' },
          ],
        },
      ];

      const request = transformRequest('anthropic.claude-3-sonnet-20240229-v1:0', messages, {});

      expect(Array.isArray(request.messages[0].content)).toBe(true);
    });

    it('should handle tool definitions', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello!' },
      ];

      const tools = [
        {
          name: 'get_weather',
          description: 'Get weather',
          input_schema: { type: 'object', properties: {} },
        },
      ];

      const request = transformRequest('anthropic.claude-3-sonnet-20240229-v1:0', messages, {
        tools,
      });

      expect(request.tools).toBeDefined();
      expect(request.tools).toHaveLength(1);
    });
  });

  describe('transformResponse', () => {
    it('should transform simple text response', () => {
      const response: BedrockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello there!' },
        ],
        model: 'claude-3-sonnet',
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
      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(20);
      expect(result.usage.total_tokens).toBe(30);
    });

    it('should concatenate multiple text blocks', () => {
      const response: BedrockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world!' },
        ],
        model: 'claude-3-sonnet',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      const result = transformResponse(response);

      expect(result.content).toBe('Hello \nworld!');
    });

    it('should extract tool calls', () => {
      const response: BedrockResponse = {
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
        model: 'claude-3-sonnet',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 15,
          output_tokens: 25,
        },
      };

      const result = transformResponse(response);

      expect(result.finish_reason).toBe('tool_calls');
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0].function.name).toBe('get_weather');
    });

    it('should map stop reasons correctly', () => {
      const testCases: Array<[string | null, string]> = [
        ['end_turn', 'stop'],
        ['max_tokens', 'length'],
        ['stop_sequence', 'stop'],
        ['tool_use', 'tool_calls'],
        [null, 'stop'],
      ];

      for (const [bedrockReason, expectedReason] of testCases) {
        const response: BedrockResponse = {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          model: 'claude-3-sonnet',
          stop_reason: bedrockReason as any,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const result = transformResponse(response);
        expect(result.finish_reason).toBe(expectedReason);
      }
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
  });
});
