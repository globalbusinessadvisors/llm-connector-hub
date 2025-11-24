/**
 * Tests for GoogleStreamParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GoogleStreamParser,
  parseSSELine,
  isValidGoogleStreamChunk,
  type GoogleStreamChunk,
} from '../GoogleStreamParser';

describe('GoogleStreamParser', () => {
  let parser: GoogleStreamParser;

  beforeEach(() => {
    parser = new GoogleStreamParser();
  });

  describe('parseChunk', () => {
    it('should parse complete SSE event', () => {
      const input = 'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hello"}]}}]}\n\n';

      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].candidates).toBeDefined();
      expect(chunks[0].candidates![0].content.parts[0]).toEqual({ text: 'Hello' });
    });

    it('should parse multiple events', () => {
      const input =
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hello"}]}}]}\n\n' +
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"World"}]}}]}\n\n';

      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].candidates![0].content.parts[0]).toEqual({ text: 'Hello' });
      expect(chunks[1].candidates![0].content.parts[0]).toEqual({ text: 'World' });
    });

    it('should handle incremental parsing', () => {
      const part1 = 'data: {"candidates":[{"content":';
      const part2 = '{"role":"model","parts":[{"text":"Hello"}]}}]}\n\n';

      let chunks = parser.parseChunk(part1);
      expect(chunks).toHaveLength(0);

      chunks = parser.parseChunk(part2);
      expect(chunks).toHaveLength(1);
    });

    it('should ignore [DONE] marker', () => {
      const input = 'data: [DONE]\n\n';

      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(0);
    });

    it('should handle empty lines', () => {
      const input = '\n\ndata: {"candidates":[]}\n\n';

      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(1);
    });

    it('should handle event field', () => {
      const input =
        'event: message\n' +
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hi"}]}}]}\n\n';

      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(1);
    });

    it('should handle id field', () => {
      const input =
        'id: 123\n' +
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hi"}]}}]}\n\n';

      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(1);
    });

    it('should handle multiline data', () => {
      const input =
        'data: {"candidates":\n' +
        'data: [{"content":{"role":"model","parts":[{"text":"Hi"}]}}]}\n\n';

      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].candidates).toBeDefined();
    });

    it('should handle malformed JSON gracefully', () => {
      const input = 'data: {invalid json}\n\n';

      // Should log error but not throw
      const chunks = parser.parseChunk(input);

      expect(chunks).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should clear internal state', () => {
      parser.parseChunk('data: partial');

      parser.reset();

      const chunks = parser.parseChunk('data: {"candidates":[]}\n\n');
      expect(chunks).toHaveLength(1);
    });
  });

  describe('parseSSELine', () => {
    it('should parse data line', () => {
      const result = parseSSELine('data: test value');

      expect(result).toEqual({
        field: 'data',
        value: 'test value',
      });
    });

    it('should parse event line', () => {
      const result = parseSSELine('event: message');

      expect(result).toEqual({
        field: 'event',
        value: 'message',
      });
    });

    it('should handle lines without leading space', () => {
      const result = parseSSELine('id:123');

      expect(result).toEqual({
        field: 'id',
        value: '123',
      });
    });

    it('should return null for empty lines', () => {
      expect(parseSSELine('')).toBeNull();
      expect(parseSSELine('   ')).toBeNull();
    });

    it('should return null for lines without colon', () => {
      expect(parseSSELine('invalid line')).toBeNull();
    });
  });

  describe('isValidGoogleStreamChunk', () => {
    it('should validate valid chunk with candidates', () => {
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

      expect(isValidGoogleStreamChunk(chunk)).toBe(true);
    });

    it('should validate valid chunk with usageMetadata', () => {
      const chunk: GoogleStreamChunk = {
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      expect(isValidGoogleStreamChunk(chunk)).toBe(true);
    });

    it('should reject chunk without candidates or usageMetadata', () => {
      const chunk = {};

      expect(isValidGoogleStreamChunk(chunk)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidGoogleStreamChunk(null)).toBe(false);
      expect(isValidGoogleStreamChunk(undefined)).toBe(false);
      expect(isValidGoogleStreamChunk('string')).toBe(false);
      expect(isValidGoogleStreamChunk(123)).toBe(false);
    });

    it('should reject chunk with invalid candidates', () => {
      const chunk = {
        candidates: 'invalid',
      };

      expect(isValidGoogleStreamChunk(chunk)).toBe(false);
    });

    it('should reject chunk with candidates missing content', () => {
      const chunk = {
        candidates: [
          {
            finishReason: 'STOP',
          },
        ],
      };

      expect(isValidGoogleStreamChunk(chunk)).toBe(false);
    });
  });
});
