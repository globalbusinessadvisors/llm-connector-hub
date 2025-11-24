/**
 * Google AI Stream Parser
 *
 * Parses Server-Sent Events (SSE) from Google AI streaming responses.
 * Google AI uses a specific SSE format with JSON data payloads.
 */

import type { GoogleStreamChunk } from './GoogleTransformer';

/**
 * Represents a parsed SSE event from Google AI
 */
export interface ParsedSSEEvent {
  event?: string;
  data?: string;
  id?: string;
  retry?: number;
}

/**
 * Parser for Google AI streaming responses
 *
 * Google AI streams responses as Server-Sent Events (SSE) with the following format:
 * ```
 * data: {"candidates": [...], "usageMetadata": {...}}
 *
 * data: {"candidates": [...]}
 *
 * data: [DONE]
 * ```
 */
export class GoogleStreamParser {
  private buffer = '';
  private eventBuffer: ParsedSSEEvent = {};

  /**
   * Parses a chunk of streaming data
   *
   * @param chunk - Raw chunk data from the stream
   * @returns Array of parsed Google AI stream chunks
   */
  parseChunk(chunk: string): GoogleStreamChunk[] {
    this.buffer += chunk;
    const chunks: GoogleStreamChunk[] = [];

    // Process complete lines
    while (true) {
      const newlineIndex = this.buffer.indexOf('\n');
      if (newlineIndex === -1) {
        break;
      }

      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      const parsedChunk = this.processLine(line);
      if (parsedChunk) {
        chunks.push(parsedChunk);
      }
    }

    return chunks;
  }

  /**
   * Processes a single line from the SSE stream
   *
   * @param line - A single line from the stream
   * @returns Parsed chunk if line completes an event, null otherwise
   */
  private processLine(line: string): GoogleStreamChunk | null {
    // Empty line indicates end of event
    if (line.trim() === '') {
      return this.flushEvent();
    }

    // Parse SSE field
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      // Line without colon, ignore
      return null;
    }

    const field = line.slice(0, colonIndex);
    let value = line.slice(colonIndex + 1);

    // Remove leading space if present
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    // Store field in event buffer
    switch (field) {
      case 'event':
        this.eventBuffer.event = value;
        break;
      case 'data':
        this.eventBuffer.data = (this.eventBuffer.data || '') + value;
        break;
      case 'id':
        this.eventBuffer.id = value;
        break;
      case 'retry':
        this.eventBuffer.retry = parseInt(value, 10);
        break;
      default:
        // Unknown field, ignore
        break;
    }

    return null;
  }

  /**
   * Flushes the event buffer and returns a parsed chunk
   *
   * @returns Parsed chunk or null if buffer is empty
   */
  private flushEvent(): GoogleStreamChunk | null {
    if (!this.eventBuffer.data) {
      this.eventBuffer = {};
      return null;
    }

    const data = this.eventBuffer.data;
    this.eventBuffer = {};

    // Check for end of stream marker
    if (data.trim() === '[DONE]') {
      return null;
    }

    // Parse JSON data
    try {
      const parsed = JSON.parse(data) as GoogleStreamChunk;
      return parsed;
    } catch (error) {
      console.error('Failed to parse Google AI stream chunk:', error, data);
      return null;
    }
  }

  /**
   * Resets the parser state
   */
  reset(): void {
    this.buffer = '';
    this.eventBuffer = {};
  }
}

/**
 * Creates an async generator that parses a stream of text chunks
 *
 * @param stream - Async iterable of text chunks (e.g., from fetch response.body)
 * @yields Parsed Google AI stream chunks
 */
export async function* parseGoogleStream(
  stream: AsyncIterable<Uint8Array>
): AsyncGenerator<GoogleStreamChunk, void, unknown> {
  const parser = new GoogleStreamParser();
  const decoder = new TextDecoder('utf-8');

  try {
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      const parsed = parser.parseChunk(text);

      for (const item of parsed) {
        yield item;
      }
    }

    // Flush any remaining data
    const finalText = decoder.decode();
    if (finalText) {
      const parsed = parser.parseChunk(finalText);
      for (const item of parsed) {
        yield item;
      }
    }
  } finally {
    parser.reset();
  }
}

/**
 * Creates an async generator from a ReadableStream
 *
 * @param stream - ReadableStream (e.g., from fetch response.body)
 * @yields Parsed Google AI stream chunks
 */
export async function* parseGoogleReadableStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<GoogleStreamChunk, void, unknown> {
  const reader = stream.getReader();

  try {
    const parser = new GoogleStreamParser();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const text = decoder.decode(value, { stream: true });
      const parsed = parser.parseChunk(text);

      for (const item of parsed) {
        yield item;
      }
    }

    // Flush any remaining data
    const finalText = decoder.decode();
    if (finalText) {
      const parsed = parser.parseChunk(finalText);
      for (const item of parsed) {
        yield item;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Helper to convert a streaming response into an array (useful for testing)
 *
 * @param stream - Google AI stream chunks
 * @returns Array of all chunks
 */
export async function collectStreamChunks(
  stream: AsyncGenerator<GoogleStreamChunk, void, unknown>
): Promise<GoogleStreamChunk[]> {
  const chunks: GoogleStreamChunk[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Validates a Google AI stream chunk structure
 *
 * @param chunk - Chunk to validate
 * @returns True if chunk is valid
 */
export function isValidGoogleStreamChunk(chunk: unknown): chunk is GoogleStreamChunk {
  if (!chunk || typeof chunk !== 'object') {
    return false;
  }

  const c = chunk as GoogleStreamChunk;

  // Must have candidates or usageMetadata
  if (!c.candidates && !c.usageMetadata) {
    return false;
  }

  // Validate candidates if present
  if (c.candidates) {
    if (!Array.isArray(c.candidates)) {
      return false;
    }

    for (const candidate of c.candidates) {
      if (!candidate.content || !candidate.content.parts) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Error thrown when stream parsing fails
 */
export class GoogleStreamParseError extends Error {
  constructor(
    message: string,
    public readonly rawData?: string
  ) {
    super(message);
    this.name = 'GoogleStreamParseError';
  }
}

/**
 * Parses a single SSE line for testing/debugging
 *
 * @param line - SSE line to parse
 * @returns Parsed field and value
 */
export function parseSSELine(line: string): { field: string; value: string } | null {
  if (line.trim() === '') {
    return null;
  }

  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const field = line.slice(0, colonIndex);
  let value = line.slice(colonIndex + 1);

  if (value.startsWith(' ')) {
    value = value.slice(1);
  }

  return { field, value };
}
