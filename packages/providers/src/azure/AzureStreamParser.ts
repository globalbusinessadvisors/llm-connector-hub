/**
 * Azure OpenAI SSE Stream Parser
 *
 * Parses Server-Sent Events (SSE) from Azure OpenAI's streaming API.
 * Azure OpenAI uses the same streaming format as OpenAI:
 * - Each line starts with "data: "
 * - JSON objects are sent for each chunk
 * - Stream ends with "data: [DONE]"
 */

import type { AzureStreamChunk } from './AzureTransformer';

/**
 * Parsed SSE event
 */
export interface SSEEvent {
  data?: string;
  event?: string;
  id?: string;
  retry?: number;
}

/**
 * Parse Server-Sent Events from a stream
 *
 * This generator function parses SSE format used by Azure OpenAI:
 * ```
 * data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,...}
 *
 * data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,...}
 *
 * data: [DONE]
 * ```
 *
 * @param stream - Readable stream of text
 * @yields Parsed Azure OpenAI stream chunks
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<AzureStreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          yield* processBuffer(buffer);
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
        if (!line.trim()) {
          continue;
        }

        const chunk = parseSSELine(line);
        if (chunk) {
          yield chunk;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Process remaining buffer content
 */
function* processBuffer(buffer: string): Generator<AzureStreamChunk> {
  const lines = buffer.split('\n');
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const chunk = parseSSELine(line);
    if (chunk) {
      yield chunk;
    }
  }
}

/**
 * Parses a single SSE line
 *
 * Azure OpenAI SSE format:
 * ```
 * data: {"id":"chatcmpl-123",...}
 * data: [DONE]
 * ```
 *
 * @param line - Raw SSE line
 * @returns Parsed Azure OpenAI chunk or null
 */
function parseSSELine(line: string): AzureStreamChunk | null {
  // Ignore comments (lines starting with :)
  if (line.startsWith(':')) {
    return null;
  }

  // Handle data lines
  if (line.startsWith('data: ')) {
    const data = line.slice(6).trim();

    // Check for end of stream
    if (data === '[DONE]') {
      return null;
    }

    // Parse JSON data
    try {
      const parsed = JSON.parse(data) as AzureStreamChunk;
      return parsed;
    } catch (error) {
      console.error('Failed to parse Azure OpenAI stream chunk:', error, data);
      return null;
    }
  }

  // Ignore other SSE fields (event, id, retry)
  return null;
}

/**
 * Alternative parser for Node.js streams
 *
 * @param stream - Node.js Readable stream
 * @yields Parsed Azure OpenAI stream chunks
 */
export async function* parseSSEStreamNode(
  stream: NodeJS.ReadableStream
): AsyncGenerator<AzureStreamChunk> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    // Convert chunk to string
    const chunkStr =
      typeof chunk === 'string'
        ? chunk
        : decoder.decode(chunk as Uint8Array, { stream: true });

    buffer += chunkStr;

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const parsed = parseSSELine(line);
      if (parsed) {
        yield parsed;
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const lines = buffer.split('\n');
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const parsed = parseSSELine(line);
      if (parsed) {
        yield parsed;
      }
    }
  }
}

/**
 * Parse SSE from a string (useful for testing)
 *
 * @param sseString - Complete SSE string
 * @returns Array of parsed Azure OpenAI chunks
 */
export function parseSSEString(sseString: string): AzureStreamChunk[] {
  const chunks: AzureStreamChunk[] = [];
  const lines = sseString.split('\n');

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const chunk = parseSSELine(line);
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
 * @returns AsyncIterable of Azure OpenAI stream chunks
 */
export async function* parseStreamingResponse(
  response: Response
): AsyncGenerator<AzureStreamChunk> {
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
export function isValidStreamChunk(chunk: unknown): chunk is AzureStreamChunk {
  if (!chunk || typeof chunk !== 'object') {
    return false;
  }

  const c = chunk as Record<string, unknown>;

  // Must have id, object, created, and model fields
  if (
    typeof c['id'] !== 'string' ||
    typeof c['object'] !== 'string' ||
    typeof c['created'] !== 'number' ||
    typeof c['model'] !== 'string'
  ) {
    return false;
  }

  // Must have choices array
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
 * Combines multiple text chunks into a single string
 *
 * @param chunks - Array of stream chunks
 * @returns Combined text content
 */
export function combineChunks(chunks: AzureStreamChunk[]): string {
  let text = '';

  for (const chunk of chunks) {
    if (chunk.choices && chunk.choices.length > 0) {
      const delta = chunk.choices[0]?.delta;
      if (delta && delta.content) {
        text += delta.content;
      }
    }
  }

  return text;
}

/**
 * Extracts finish reason from the final chunk
 *
 * @param chunks - Array of stream chunks
 * @returns Finish reason or null
 */
export function extractFinishReason(
  chunks: AzureStreamChunk[]
): string | null {
  // Look for finish_reason in chunks (usually in the last chunk)
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk?.choices && chunk.choices.length > 0) {
      const choice = chunk.choices[0];
      if (choice?.finish_reason) {
        return choice.finish_reason;
      }
    }
  }

  return null;
}
