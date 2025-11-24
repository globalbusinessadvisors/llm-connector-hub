/**
 * Anthropic SSE Stream Parser
 *
 * Parses Server-Sent Events (SSE) from Anthropic's streaming API.
 * Anthropic uses the SSE format with different event types:
 * - message_start
 * - content_block_start
 * - content_block_delta
 * - content_block_stop
 * - message_delta
 * - message_stop
 * - ping
 * - error
 */

import type { AnthropicStreamEvent } from './AnthropicTransformer';

/**
 * Parsed SSE event
 */
export interface SSEEvent {
  event?: string;
  data?: string;
  id?: string;
  retry?: number;
}

/**
 * Parse Server-Sent Events from a stream
 *
 * This generator function parses SSE format:
 * ```
 * event: message_start
 * data: {"type":"message_start","message":{...}}
 *
 * event: content_block_delta
 * data: {"type":"content_block_delta","index":0,"delta":{...}}
 * ```
 *
 * @param stream - Readable stream of text
 * @yields Parsed Anthropic stream events
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<AnthropicStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const event = parseSSEEvent(buffer);
          if (event.data) {
            const anthropicEvent = parseAnthropicEvent(event.data);
            if (anthropicEvent) {
              yield anthropicEvent;
            }
          }
        }
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete events (separated by double newlines)
      const events = buffer.split('\n\n');

      // Keep the last incomplete event in the buffer
      buffer = events.pop() || '';

      // Process complete events
      for (const eventText of events) {
        if (!eventText.trim()) {
          continue;
        }

        const event = parseSSEEvent(eventText);
        if (event.data) {
          const anthropicEvent = parseAnthropicEvent(event.data);
          if (anthropicEvent) {
            yield anthropicEvent;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses a single SSE event block
 *
 * SSE format:
 * ```
 * event: event_type
 * data: {"key":"value"}
 * id: unique-id
 * retry: 3000
 * ```
 *
 * @param eventText - Raw SSE event text
 * @returns Parsed SSE event
 */
function parseSSEEvent(eventText: string): SSEEvent {
  const lines = eventText.split('\n');
  const event: SSEEvent = {};

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    // Handle comments (lines starting with :)
    if (line.startsWith(':')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const field = line.slice(0, colonIndex);
    let value = line.slice(colonIndex + 1);

    // Remove leading space if present
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    switch (field) {
      case 'event':
        event.event = value;
        break;

      case 'data':
        // Multiple data fields should be concatenated with newlines
        event.data = event.data ? `${event.data}\n${value}` : value;
        break;

      case 'id':
        event.id = value;
        break;

      case 'retry':
        const retryValue = parseInt(value, 10);
        if (!isNaN(retryValue)) {
          event.retry = retryValue;
        }
        break;
    }
  }

  return event;
}

/**
 * Parses Anthropic event data JSON
 *
 * @param data - JSON string from SSE data field
 * @returns Parsed Anthropic event or null if invalid
 */
function parseAnthropicEvent(data: string): AnthropicStreamEvent | null {
  try {
    const parsed = JSON.parse(data) as AnthropicStreamEvent;
    return parsed;
  } catch (error) {
    console.error('Failed to parse Anthropic event:', error, data);
    return null;
  }
}

/**
 * Alternative parser for Node.js streams
 *
 * @param stream - Node.js Readable stream
 * @yields Parsed Anthropic stream events
 */
export async function* parseSSEStreamNode(
  stream: NodeJS.ReadableStream
): AsyncGenerator<AnthropicStreamEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    // Convert chunk to string
    const chunkStr = typeof chunk === 'string'
      ? chunk
      : decoder.decode(chunk as Uint8Array, { stream: true });

    buffer += chunkStr;

    // Process complete events
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const eventText of events) {
      if (!eventText.trim()) {
        continue;
      }

      const event = parseSSEEvent(eventText);
      if (event.data) {
        const anthropicEvent = parseAnthropicEvent(event.data);
        if (anthropicEvent) {
          yield anthropicEvent;
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const event = parseSSEEvent(buffer);
    if (event.data) {
      const anthropicEvent = parseAnthropicEvent(event.data);
      if (anthropicEvent) {
        yield anthropicEvent;
      }
    }
  }
}

/**
 * Parse SSE from a string (useful for testing)
 *
 * @param sseString - Complete SSE string
 * @returns Array of parsed Anthropic events
 */
export function parseSSEString(sseString: string): AnthropicStreamEvent[] {
  const events: AnthropicStreamEvent[] = [];
  const eventBlocks = sseString.split('\n\n');

  for (const eventText of eventBlocks) {
    if (!eventText.trim()) {
      continue;
    }

    const event = parseSSEEvent(eventText);
    if (event.data) {
      const anthropicEvent = parseAnthropicEvent(event.data);
      if (anthropicEvent) {
        events.push(anthropicEvent);
      }
    }
  }

  return events;
}

/**
 * Creates an async iterable from a fetch response body
 *
 * This is useful for handling streaming responses from fetch API
 *
 * @param response - Fetch Response object
 * @returns AsyncIterable of Anthropic stream events
 */
export async function* parseStreamingResponse(
  response: Response
): AsyncGenerator<AnthropicStreamEvent> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  yield* parseSSEStream(response.body);
}

/**
 * Validates that a stream event is well-formed
 *
 * @param event - Event to validate
 * @returns True if valid
 */
export function isValidStreamEvent(event: unknown): event is AnthropicStreamEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const e = event as Record<string, unknown>;

  // Must have a type field
  if (typeof e['type'] !== 'string') {
    return false;
  }

  // Validate based on event type
  switch (e['type']) {
    case 'message_start':
      return typeof e['message'] === 'object';

    case 'content_block_start':
      return (
        typeof e['index'] === 'number' &&
        typeof e['content_block'] === 'object'
      );

    case 'content_block_delta':
      return (
        typeof e['index'] === 'number' &&
        typeof e['delta'] === 'object'
      );

    case 'content_block_stop':
      return typeof e['index'] === 'number';

    case 'message_delta':
      return typeof e['delta'] === 'object';

    case 'message_stop':
    case 'ping':
      return true;

    case 'error':
      return (
        typeof e['error'] === 'object' &&
        e['error'] !== null &&
        'message' in e['error']
      );

    default:
      return false;
  }
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
