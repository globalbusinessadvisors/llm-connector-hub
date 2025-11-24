/**
 * Utility functions for LLM Connector Hub
 * Provides helper functions for working with messages, tokens, and content
 */

import type { Message, ContentPart } from './types';

/**
 * Creates a system message
 *
 * @param content - Message content (text or content parts)
 * @returns System message object
 */
export function systemMessage(content: string | ContentPart[]): Message {
  return {
    role: 'system',
    content,
  };
}

/**
 * Creates a user message
 *
 * @param content - Message content (text or content parts)
 * @returns User message object
 */
export function userMessage(content: string | ContentPart[]): Message {
  return {
    role: 'user',
    content,
  };
}

/**
 * Creates an assistant message
 *
 * @param content - Message content (text or content parts)
 * @returns Assistant message object
 */
export function assistantMessage(content: string | ContentPart[]): Message {
  return {
    role: 'assistant',
    content,
  };
}

/**
 * Extracts text content from a message
 *
 * If the message content is a string, returns it directly.
 * If the message content is an array of content parts, extracts and concatenates
 * all text parts, ignoring non-text parts like images.
 *
 * @param message - Message to extract text from
 * @returns Extracted text content
 */
export function extractTextContent(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  // Extract text from content parts
  return message.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/**
 * Estimates the number of tokens in a text string
 *
 * Uses a simple heuristic: approximately 1 token per 4 characters.
 * This is a rough approximation and should not be used for precise token counting.
 * For accurate token counting, use the tokenizer for your specific model.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Rough heuristic: ~1 token per 4 characters
  // Most tokenizers produce about 1 token per 4 characters on average
  return Math.ceil(text.length / 4);
}

/**
 * Truncates text to fit within a token limit
 *
 * Uses the same token estimation as estimateTokens().
 * Truncates by characters to approximate the token limit.
 *
 * @param text - Text to truncate
 * @param maxTokens - Maximum number of tokens
 * @returns Truncated text
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Calculate approximate character limit
  // Use 4 characters per token as the heuristic
  const maxChars = maxTokens * 4;

  return text.slice(0, maxChars);
}
