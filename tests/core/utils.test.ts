/**
 * Tests for core utility functions
 */

import { describe, expect, it } from 'vitest';

import {
  assistantMessage,
  estimateTokens,
  extractTextContent,
  systemMessage,
  truncateToTokens,
  userMessage,
} from '@llm-connector-hub/core';

describe('Message helpers', () => {
  it('should create system message', () => {
    const msg = systemMessage('You are helpful');
    expect(msg.role).toBe('system');
    expect(msg.content).toBe('You are helpful');
  });

  it('should create user message', () => {
    const msg = userMessage('Hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('should create assistant message', () => {
    const msg = assistantMessage('Hi there');
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Hi there');
  });

  it('should create user message with content parts', () => {
    const msg = userMessage([
      { type: 'text', text: 'Hello' },
      { type: 'image_url', image_url: 'https://example.com/image.jpg' },
    ]);
    expect(msg.role).toBe('user');
    expect(Array.isArray(msg.content)).toBe(true);
  });
});

describe('extractTextContent', () => {
  it('should extract text from string content', () => {
    const msg = userMessage('Hello world');
    expect(extractTextContent(msg)).toBe('Hello world');
  });

  it('should extract text from content parts', () => {
    const msg = userMessage([
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
    ]);
    expect(extractTextContent(msg)).toBe('Hello world');
  });

  it('should ignore non-text content parts', () => {
    const msg = userMessage([
      { type: 'text', text: 'Hello' },
      { type: 'image_url', image_url: 'https://example.com/img.jpg' },
      { type: 'text', text: ' world' },
    ]);
    expect(extractTextContent(msg)).toBe('Hello world');
  });
});

describe('Token estimation', () => {
  it('should estimate tokens', () => {
    expect(estimateTokens('Hello world')).toBeGreaterThan(0);
    expect(estimateTokens('A longer text with more words')).toBeGreaterThan(
      estimateTokens('Short')
    );
  });

  it('should truncate text to token limit', () => {
    const text = 'This is a long text that needs to be truncated';
    const truncated = truncateToTokens(text, 5);
    expect(estimateTokens(truncated)).toBeLessThanOrEqual(5);
  });

  it('should not truncate if under limit', () => {
    const text = 'Short text';
    const truncated = truncateToTokens(text, 100);
    expect(truncated).toBe(text);
  });
});
