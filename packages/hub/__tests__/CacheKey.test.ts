import { describe, it, expect } from 'vitest';
import { CacheKey } from '../src/cache/CacheKey';
import { CompletionRequest, MessageRole } from '@llm-connector-hub/core';

describe('CacheKey', () => {
  it('should generate consistent keys for identical requests', () => {
    const cacheKey = new CacheKey();
    const request: CompletionRequest = {
      model: 'gpt-4',
      messages: [
        { role: MessageRole.USER, content: 'Hello' }
      ],
      temperature: 0.7,
    };

    const key1 = cacheKey.generate(request);
    const key2 = cacheKey.generate(request);

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different messages', () => {
    const cacheKey = new CacheKey();
    const request1: CompletionRequest = {
      model: 'gpt-4',
      messages: [{ role: MessageRole.USER, content: 'Hello' }],
    };
    const request2: CompletionRequest = {
      model: 'gpt-4',
      messages: [{ role: MessageRole.USER, content: 'Hi' }],
    };

    const key1 = cacheKey.generate(request1);
    const key2 = cacheKey.generate(request2);

    expect(key1).not.toBe(key2);
  });

  it('should include provider in key when specified', () => {
    const cacheKey = new CacheKey();
    const request: CompletionRequest = {
      model: 'gpt-4',
      messages: [{ role: MessageRole.USER, content: 'Hello' }],
    };

    const key1 = cacheKey.generate(request, 'openai');
    const key2 = cacheKey.generate(request, 'anthropic');

    expect(key1).not.toBe(key2);
  });

  it('should respect prefix option', () => {
    const cacheKey = new CacheKey({ prefix: 'test' });
    const request: CompletionRequest = {
      model: 'gpt-4',
      messages: [{ role: MessageRole.USER, content: 'Hello' }],
    };

    const key = cacheKey.generate(request);

    expect(key).toMatch(/^test:/);
  });
});
