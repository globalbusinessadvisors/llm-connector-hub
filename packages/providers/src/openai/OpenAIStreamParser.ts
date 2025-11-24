/**
 * OpenAI SSE Stream Parser
 *
 * Parses Server-Sent Events (SSE) from OpenAI's streaming API.
 * OpenAI uses the SSE format with data-only events:
 * - data: {"id":"...","object":"chat.completion.chunk",...}
 * - data: [DONE]
 */

import type { OpenAIStreamChunk } from './OpenAITransformer';

/**
 * Parse Server-Sent Events from a stream
 *
 * This generator function parses OpenAI's SSE format:
 * ```
 * data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
 *
 * data: [DONE]
 * ```
 *
 * @param stream - Readable stream of text
 * @yields Parsed OpenAI stream chunks
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<OpenAIStreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const chunk = parseChunk(buffer);
          if (chunk) {
            yield chunk;
          }
        }
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (separated by newlines)
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      // Process complete lines
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        // Parse data line
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6); // Remove 'data: ' prefix

          // Check for [DONE] marker
          if (data === '[DONE]') {
            return;
          }

          const chunk = parseChunk(data);
          if (chunk) {
            yield chunk;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses a single chunk of data
 *
 * @param data - JSON string from SSE data field
 * @returns Parsed OpenAI chunk or null if invalid
 */
function parseChunk(data: string): OpenAIStreamChunk | null {
  try {
    const parsed = JSON.parse(data) as OpenAIStreamChunk;
    return parsed;
  } catch (error) {
    console.error('Failed to parse OpenAI chunk:', error, data);
    return null;
  }
}

/**
 * Alternative parser for Node.js streams
 *
 * @param stream - Node.js Readable stream
 * @yields Parsed OpenAI stream chunks
 */
export async function* parseSSEStreamNode(
  stream: NodeJS.ReadableStream
): AsyncGenerator<OpenAIStreamChunk> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    // Convert chunk to string
    const chunkStr = typeof chunk === 'string'
      ? chunk
      : decoder.decode(chunk as Uint8Array, { stream: true });

    buffer += chunkStr;

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      // Parse data line
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);

        // Check for [DONE] marker
        if (data === '[DONE]') {
          return;
        }

        const parsed = parseChunk(data);
        if (parsed) {
          yield parsed;
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6);
      if (data !== '[DONE]') {
        const parsed = parseChunk(data);
        if (parsed) {
          yield parsed;
        }
      }
    }
  }
}

/**
 * Parse SSE from a string (useful for testing)
 *
 * @param sseString - Complete SSE string
 * @returns Array of parsed OpenAI chunks
 */
export function parseSSEString(sseString: string): OpenAIStreamChunk[] {
  const chunks: OpenAIStreamChunk[] = [];
  const lines = sseString.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) {
      continue;
    }

    const data = trimmed.slice(6);

    // Skip [DONE] marker
    if (data === '[DONE]') {
      break;
    }

    const chunk = parseChunk(data);
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Creates an async iterable from a fetch response body
 *
 * This is useful for handling streaming responses from fetch API
 *
 * @param response - Fetch Response object
 * @returns AsyncIterable of OpenAI stream chunks
 */
export async function* parseStreamingResponse(
  response: Response
): AsyncGenerator<OpenAIStreamChunk> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  yield* parseSSEStream(response.body);
}

/**
 * Validates that a stream chunk is well-formed
 *
 * @param chunk - Chunk to validate
 * @returns True if valid
 */
export function isValidStreamChunk(chunk: unknown): chunk is OpenAIStreamChunk {
  if (!chunk || typeof chunk !== 'object') {
    return false;
  }

  const c = chunk as Record<string, unknown>;

  // Must have required fields
  if (typeof c['id'] !== 'string') {
    return false;
  }

  if (c['object'] !== 'chat.completion.chunk') {
    return false;
  }

  if (!Array.isArray(c['choices'])) {
    return false;
  }

  return true;
}

/**
 * Error thrown when SSE parsing fails
 */
export class SSEParseError extends Error {
  constructor(
    message: string,
    public readonly rawData?: string
  ) {
    super(message);
    this.name = 'SSEParseError';
  }
}

/**
 * Helper to consume a stream and collect all chunks
 *
 * Useful for testing or when you need all chunks at once
 *
 * @param stream - Readable stream
 * @returns Array of all chunks
 */
export async function collectStreamChunks(
  stream: ReadableStream<Uint8Array>
): Promise<OpenAIStreamChunk[]> {
  const chunks: OpenAIStreamChunk[] = [];

  for await (const chunk of parseSSEStream(stream)) {
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Helper to extract complete text from stream chunks
 *
 * @param chunks - Array of stream chunks
 * @returns Combined text content
 */
export function extractTextFromChunks(chunks: OpenAIStreamChunk[]): string {
  let text = '';

  for (const chunk of chunks) {
    const choice = chunk.choices[0];
    if (choice?.delta?.content) {
      text += choice.delta.content;
    }
  }

  return text;
}
