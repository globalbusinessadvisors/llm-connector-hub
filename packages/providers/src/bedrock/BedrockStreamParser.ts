/**
 * AWS Bedrock EventStream Parser
 *
 * Parses AWS EventStream format used by Bedrock's streaming API.
 * EventStream is a binary format that carries events with headers and payloads.
 * Different models (Claude, Llama, Mistral) have different streaming formats.
 */

import type { getModelProvider } from './BedrockConfig';

/**
 * Bedrock streaming event types
 */
export type BedrockStreamEvent =
  | BedrockChunkEvent
  | BedrockMetadataEvent
  | BedrockErrorEvent;

/**
 * Content chunk event
 */
export interface BedrockChunkEvent {
  type: 'chunk';
  bytes: Uint8Array;
  contentType?: string;
}

/**
 * Metadata event
 */
export interface BedrockMetadataEvent {
  type: 'metadata';
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Error event
 */
export interface BedrockErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

/**
 * Claude-specific streaming response format (Messages API on Bedrock)
 */
export interface ClaudeStreamChunk {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  message?: {
    id?: string;
    type?: string;
    role?: string;
    content?: any[];
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  index?: number;
  content_block?: {
    type?: string;
    text?: string;
  };
  delta?: {
    type?: string;
    text?: string;
    stop_reason?: string;
  };
  usage?: {
    output_tokens?: number;
  };
}

/**
 * Llama streaming response format
 */
export interface LlamaStreamChunk {
  generation: string;
  prompt_token_count?: number;
  generation_token_count?: number;
  stop_reason?: string;
}

/**
 * Mistral streaming response format
 */
export interface MistralStreamChunk {
  outputs: Array<{
    text: string;
    stop_reason?: string;
  }>;
}

/**
 * Generic streaming chunk after parsing
 */
export interface ParsedStreamChunk {
  content?: string;
  stopReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  isComplete?: boolean;
}

/**
 * Parses AWS EventStream format
 *
 * This is a simplified parser for the AWS EventStream binary format.
 * In production, you would use @aws-sdk/eventstream-codec for proper parsing.
 *
 * @param stream - Readable stream from Bedrock
 * @yields Parsed stream events
 */
export async function* parseBedrockStream(
  stream: AsyncIterable<Uint8Array>
): AsyncGenerator<BedrockStreamEvent> {
  for await (const chunk of stream) {
    // In AWS EventStream, each chunk can contain multiple events
    // For simplicity, we treat each chunk as a single event
    yield {
      type: 'chunk',
      bytes: chunk,
    };
  }
}

/**
 * Parses Claude streaming chunks (Anthropic Messages API format)
 *
 * @param bytes - Raw bytes from EventStream
 * @returns Parsed chunk or null
 */
export function parseClaudeChunk(bytes: Uint8Array): ParsedStreamChunk | null {
  try {
    const text = new TextDecoder().decode(bytes);

    // Handle empty or whitespace-only chunks
    if (!text.trim()) {
      return null;
    }

    const chunk: ClaudeStreamChunk = JSON.parse(text);

    switch (chunk.type) {
      case 'message_start':
        return {
          usage: chunk.message?.usage ? {
            inputTokens: chunk.message.usage.input_tokens || 0,
            outputTokens: 0,
            totalTokens: chunk.message.usage.input_tokens || 0,
          } : undefined,
        };

      case 'content_block_delta':
        if (chunk.delta?.type === 'text_delta' && chunk.delta.text) {
          return {
            content: chunk.delta.text,
          };
        }
        return null;

      case 'message_delta':
        return {
          stopReason: chunk.delta?.stop_reason,
          usage: chunk.usage ? {
            outputTokens: chunk.usage.output_tokens || 0,
          } : undefined,
        };

      case 'message_stop':
        return {
          isComplete: true,
        };

      default:
        return null;
    }
  } catch (error) {
    console.error('Failed to parse Claude chunk:', error);
    return null;
  }
}

/**
 * Parses Llama streaming chunks
 *
 * @param bytes - Raw bytes from EventStream
 * @returns Parsed chunk or null
 */
export function parseLlamaChunk(bytes: Uint8Array): ParsedStreamChunk | null {
  try {
    const text = new TextDecoder().decode(bytes);

    if (!text.trim()) {
      return null;
    }

    const chunk: LlamaStreamChunk = JSON.parse(text);

    return {
      content: chunk.generation || undefined,
      stopReason: chunk.stop_reason || undefined,
      usage: {
        inputTokens: chunk.prompt_token_count || 0,
        outputTokens: chunk.generation_token_count || 0,
        totalTokens: (chunk.prompt_token_count || 0) + (chunk.generation_token_count || 0),
      },
      isComplete: !!chunk.stop_reason,
    };
  } catch (error) {
    console.error('Failed to parse Llama chunk:', error);
    return null;
  }
}

/**
 * Parses Mistral streaming chunks
 *
 * @param bytes - Raw bytes from EventStream
 * @returns Parsed chunk or null
 */
export function parseMistralChunk(bytes: Uint8Array): ParsedStreamChunk | null {
  try {
    const text = new TextDecoder().decode(bytes);

    if (!text.trim()) {
      return null;
    }

    const chunk: MistralStreamChunk = JSON.parse(text);

    if (chunk.outputs && chunk.outputs.length > 0) {
      const output = chunk.outputs[0];
      if (output) {
        return {
          content: output.text || undefined,
          stopReason: output.stop_reason || undefined,
          isComplete: !!output.stop_reason,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to parse Mistral chunk:', error);
    return null;
  }
}

/**
 * Parses streaming chunk based on model provider
 *
 * @param bytes - Raw bytes from EventStream
 * @param provider - Model provider (anthropic, meta, mistral)
 * @returns Parsed chunk or null
 */
export function parseStreamChunk(
  bytes: Uint8Array,
  provider: ReturnType<typeof getModelProvider>
): ParsedStreamChunk | null {
  switch (provider) {
    case 'anthropic':
      return parseClaudeChunk(bytes);
    case 'meta':
      return parseLlamaChunk(bytes);
    case 'mistral':
      return parseMistralChunk(bytes);
    default:
      // Try to parse as JSON and extract any text field
      try {
        const text = new TextDecoder().decode(bytes);
        if (!text.trim()) {
          return null;
        }
        const parsed = JSON.parse(text);

        // Look for common text fields
        const content = parsed.text || parsed.generation || parsed.content || parsed.output;
        if (content) {
          return { content };
        }
      } catch {
        // Not JSON, return as-is
        const text = new TextDecoder().decode(bytes);
        if (text.trim()) {
          return { content: text };
        }
      }
      return null;
  }
}

/**
 * Stream accumulator for building complete responses
 */
export class StreamAccumulator {
  private content: string = '';
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private stopReason?: string;

  reset(): void {
    this.content = '';
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.stopReason = undefined;
  }

  addChunk(chunk: ParsedStreamChunk): void {
    if (chunk.content) {
      this.content += chunk.content;
    }

    if (chunk.usage) {
      if (chunk.usage.inputTokens !== undefined) {
        this.inputTokens = chunk.usage.inputTokens;
      }
      if (chunk.usage.outputTokens !== undefined) {
        this.outputTokens = chunk.usage.outputTokens;
      }
    }

    if (chunk.stopReason) {
      this.stopReason = chunk.stopReason;
    }
  }

  getContent(): string {
    return this.content;
  }

  getUsage() {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.inputTokens + this.outputTokens,
    };
  }

  getStopReason(): string | undefined {
    return this.stopReason;
  }
}

/**
 * Converts AWS EventStream AsyncIterable to standard async generator
 *
 * @param stream - AWS EventStream
 * @returns Async generator of Uint8Array chunks
 */
export async function* eventStreamToAsyncIterable(
  stream: any
): AsyncGenerator<Uint8Array> {
  // The AWS SDK's EventStream is already an AsyncIterable
  // This function normalizes it to our expected format
  if (Symbol.asyncIterator in stream) {
    for await (const event of stream) {
      // AWS SDK event structure: { chunk?: { bytes?: Uint8Array } }
      if (event.chunk?.bytes) {
        yield event.chunk.bytes;
      }
    }
  }
}
