/**
 * Tests for AnthropicStreamParser
 */

import { describe, it, expect } from 'vitest';
import {
  parseSSEString,
  isValidStreamEvent,
} from '../AnthropicStreamParser';
import type { AnthropicStreamEvent } from '../AnthropicTransformer';

describe('AnthropicStreamParser', () => {
  describe('parseSSEString', () => {
    it('should parse message_start event', () => {
      const sse = `event: message_start
data: {"type":"message_start","message":{"id":"msg_123","role":"assistant"}}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message_start');
      expect((events[0] as any).message.id).toBe('msg_123');
    });

    it('should parse content_block_start event', () => {
      const sse = `event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('content_block_start');
      expect((events[0] as any).index).toBe(0);
    });

    it('should parse content_block_delta event', () => {
      const sse = `event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('content_block_delta');
      expect((events[0] as any).delta.text).toBe('Hello');
    });

    it('should parse multiple events', () => {
      const sse = `event: message_start
data: {"type":"message_start","message":{"id":"msg_123"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}

event: message_stop
data: {"type":"message_stop"}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('message_start');
      expect(events[1].type).toBe('content_block_start');
      expect(events[2].type).toBe('content_block_delta');
      expect(events[3].type).toBe('message_stop');
    });

    it('should handle events without event field', () => {
      const sse = `data: {"type":"ping"}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ping');
    });

    it('should skip empty lines and comments', () => {
      const sse = `: this is a comment

data: {"type":"ping"}


: another comment
data: {"type":"message_stop"}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('ping');
      expect(events[1].type).toBe('message_stop');
    });

    it('should handle multi-line data fields', () => {
      const sse = `event: content_block_delta
data: {"type":"content_block_delta",
data: "index":0,
data: "delta":{"type":"text_delta","text":"Hello"}}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('content_block_delta');
    });

    it('should parse error event', () => {
      const sse = `event: error
data: {"type":"error","error":{"type":"api_error","message":"Internal error"}}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect((events[0] as any).error.message).toBe('Internal error');
    });

    it('should handle message_delta event with usage', () => {
      const sse = `event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":20}}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message_delta');
      expect((events[0] as any).delta.stop_reason).toBe('end_turn');
      expect((events[0] as any).usage.output_tokens).toBe(20);
    });

    it('should handle tool use events', () => {
      const sse = `event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_123","name":"get_weather"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":\\"Paris\\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

`;

      const events = parseSSEString(sse);

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('content_block_start');
      expect((events[0] as any).content_block.type).toBe('tool_use');
      expect(events[1].type).toBe('content_block_delta');
      expect((events[1] as any).delta.type).toBe('input_json_delta');
      expect(events[2].type).toBe('content_block_stop');
    });

    it('should return empty array for empty string', () => {
      const events = parseSSEString('');
      expect(events).toHaveLength(0);
    });

    it('should return empty array for whitespace only', () => {
      const events = parseSSEString('   \n\n  \n');
      expect(events).toHaveLength(0);
    });
  });

  describe('isValidStreamEvent', () => {
    it('should validate message_start event', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_start',
        message: { id: 'msg_123' },
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should validate content_block_start event', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text' },
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should validate content_block_delta event', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should validate content_block_stop event', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_stop',
        index: 0,
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should validate message_delta event', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 20 },
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should validate message_stop event', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_stop',
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should validate ping event', () => {
      const event: AnthropicStreamEvent = {
        type: 'ping',
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should validate error event', () => {
      const event: AnthropicStreamEvent = {
        type: 'error',
        error: { type: 'api_error', message: 'Error occurred' },
      };

      expect(isValidStreamEvent(event)).toBe(true);
    });

    it('should reject null', () => {
      expect(isValidStreamEvent(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidStreamEvent(undefined)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(isValidStreamEvent('string')).toBe(false);
      expect(isValidStreamEvent(123)).toBe(false);
    });

    it('should reject object without type', () => {
      expect(isValidStreamEvent({})).toBe(false);
    });

    it('should reject message_start without message', () => {
      expect(isValidStreamEvent({ type: 'message_start' })).toBe(false);
    });

    it('should reject content_block_start without index', () => {
      expect(isValidStreamEvent({
        type: 'content_block_start',
        content_block: {},
      })).toBe(false);
    });

    it('should reject content_block_delta without delta', () => {
      expect(isValidStreamEvent({
        type: 'content_block_delta',
        index: 0,
      })).toBe(false);
    });

    it('should reject content_block_stop without index', () => {
      expect(isValidStreamEvent({ type: 'content_block_stop' })).toBe(false);
    });

    it('should reject message_delta without delta', () => {
      expect(isValidStreamEvent({ type: 'message_delta' })).toBe(false);
    });

    it('should reject error event without error field', () => {
      expect(isValidStreamEvent({ type: 'error' })).toBe(false);
    });

    it('should reject unknown event type', () => {
      expect(isValidStreamEvent({ type: 'unknown_type' })).toBe(false);
    });
  });
});
