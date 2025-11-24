/**
 * Anthropic Request/Response Transformer
 *
 * Transforms between unified LLM Connector Hub format and Anthropic API format.
 * Handles the key differences in Anthropic's API:
 * - System messages are separate from the messages array
 * - Content blocks structure (text, image, tool_use, tool_result)
 * - Different streaming event format
 */

import type {
  Message,
  ContentPart,
  FinishReason,
  Usage,
  StreamChunk,
  ToolCall,
} from '@llm-connector-hub/core';

/**
 * Anthropic API message format
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContentBlock[];
}

/**
 * Anthropic content block types
 */
export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicImageBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: string;
    data?: string;
    url?: string;
  };
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | AnthropicContentBlock[];
  is_error?: boolean;
}

/**
 * Anthropic API request format
 */
export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  metadata?: {
    user_id?: string;
  };
}

/**
 * Anthropic API response format
 */
export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic streaming event types
 */
export type AnthropicStreamEvent =
  | { type: 'message_start'; message: Partial<AnthropicResponse> }
  | { type: 'content_block_start'; index: number; content_block: Partial<AnthropicContentBlock> }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string; stop_sequence: string | null }; usage: { output_tokens: number } }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error'; error: { type: string; message: string } };

/**
 * Transforms unified messages to Anthropic format
 *
 * Key transformations:
 * - Extracts system message (first message with role='system')
 * - Converts remaining messages to Anthropic format
 * - Transforms content to content blocks
 * - Handles tool calls and tool results
 *
 * @param messages - Unified messages
 * @returns Tuple of [system message, Anthropic messages]
 */
export function transformMessages(messages: Message[]): [string | undefined, AnthropicMessage[]] {
  let systemMessage: string | undefined;
  const anthropicMessages: AnthropicMessage[] = [];

  for (const message of messages) {
    // Extract system message
    if (message.role === 'system') {
      const content = typeof message.content === 'string'
        ? message.content
        : extractTextFromContentParts(message.content);

      // Concatenate multiple system messages
      systemMessage = systemMessage
        ? `${systemMessage}\n\n${content}`
        : content;
      continue;
    }

    // Skip function/tool role messages (these are handled separately)
    if (message.role === 'function' || message.role === 'tool') {
      // Tool results should be converted to tool_result blocks
      if (message.tool_call_id) {
        const lastMsg = anthropicMessages[anthropicMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          const content = typeof message.content === 'string'
            ? message.content
            : extractTextFromContentParts(message.content);

          lastMsg.content.push({
            type: 'tool_result',
            tool_use_id: message.tool_call_id,
            content,
          });
        }
      }
      continue;
    }

    // Convert user and assistant messages
    if (message.role === 'user' || message.role === 'assistant') {
      const contentBlocks = transformContentToBlocks(message);

      // Add tool calls as tool_use blocks for assistant messages
      if (message.role === 'assistant' && message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          });
        }
      }

      anthropicMessages.push({
        role: message.role,
        content: contentBlocks,
      });
    }
  }

  return [systemMessage, anthropicMessages];
}

/**
 * Transforms message content to Anthropic content blocks
 */
function transformContentToBlocks(message: Message): AnthropicContentBlock[] {
  if (typeof message.content === 'string') {
    return [{ type: 'text', text: message.content }];
  }

  const blocks: AnthropicContentBlock[] = [];

  for (const part of message.content) {
    if (part.type === 'text') {
      blocks.push({
        type: 'text',
        text: part.text,
      });
    } else if (part.type === 'image_url') {
      // Anthropic uses base64 encoded images
      if (part.image_url?.startsWith('data:')) {
        const [mediaType, data] = parseDataUrl(part.image_url);
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data,
          },
        });
      } else if (part.image_url) {
        blocks.push({
          type: 'image',
          source: {
            type: 'url',
            media_type: 'image/jpeg', // Default
            url: part.image_url,
          },
        });
      }
    } else if (part.type === 'image_base64') {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg', // Default
          data: part.image_base64,
        },
      });
    }
  }

  return blocks;
}

/**
 * Parses a data URL into media type and data
 */
function parseDataUrl(dataUrl: string): [string, string] {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return ['image/jpeg', dataUrl]; // Fallback
  }
  return [match[1] || 'image/jpeg', match[2] || ''];
}

/**
 * Extracts text from content parts
 */
function extractTextFromContentParts(parts: ContentPart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n');
}

/**
 * Transforms Anthropic response to unified format
 *
 * @param response - Anthropic API response
 * @returns Unified response data
 */
export function transformResponse(response: AnthropicResponse): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
  tool_calls?: ToolCall[];
} {
  // Extract text content
  const textBlocks = response.content.filter(
    (block): block is AnthropicTextBlock => block.type === 'text'
  );
  const content = textBlocks.map(block => block.text).join('\n');

  // Extract tool calls
  const toolUseBlocks = response.content.filter(
    (block): block is AnthropicToolUseBlock => block.type === 'tool_use'
  );

  const tool_calls: ToolCall[] | undefined = toolUseBlocks.length > 0
    ? toolUseBlocks.map(block => ({
        id: block.id,
        type: 'function' as const,
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      }))
    : undefined;

  // Map stop reason
  const finish_reason = mapStopReason(response.stop_reason);

  // Map usage
  const usage: Usage = {
    prompt_tokens: response.usage.input_tokens,
    completion_tokens: response.usage.output_tokens,
    total_tokens: response.usage.input_tokens + response.usage.output_tokens,
  };

  return {
    content,
    role: 'assistant',
    finish_reason,
    usage,
    tool_calls,
  };
}

/**
 * Maps Anthropic stop reason to unified format
 */
function mapStopReason(stopReason: string | null): FinishReason {
  switch (stopReason) {
    case 'end_turn':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'stop_sequence':
      return 'stop';
    case 'tool_use':
      return 'tool_calls';
    default:
      return 'stop';
  }
}

/**
 * Transforms Anthropic streaming event to unified stream chunk
 *
 * @param event - Anthropic streaming event
 * @param accumulator - Accumulator for building complete content blocks
 * @returns Stream chunk or null if event doesn't produce a chunk
 */
export function transformStreamEvent(
  event: AnthropicStreamEvent,
  accumulator: StreamAccumulator
): StreamChunk | null {
  switch (event.type) {
    case 'message_start':
      accumulator.reset();
      return {
        role: 'assistant',
      };

    case 'content_block_start':
      if (event.content_block.type === 'text') {
        accumulator.startTextBlock(event.index);
      } else if (event.content_block.type === 'tool_use') {
        accumulator.startToolUseBlock(event.index, event.content_block);
      }
      return null;

    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        accumulator.appendText(event.index, event.delta.text);
        return {
          content: event.delta.text,
        };
      } else if (event.delta.type === 'input_json_delta') {
        accumulator.appendJson(event.index, event.delta.partial_json);
      }
      return null;

    case 'content_block_stop':
      accumulator.finalizeBlock(event.index);
      return null;

    case 'message_delta':
      const chunk: StreamChunk = {};
      if (event.delta.stop_reason) {
        chunk.finish_reason = mapStopReason(event.delta.stop_reason);
      }

      // Include tool calls if any were accumulated
      const toolCalls = accumulator.getToolCalls();
      if (toolCalls.length > 0) {
        chunk.tool_calls = toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.input,
          },
        }));
      }

      return chunk;

    case 'message_stop':
      return null;

    case 'ping':
      return null;

    case 'error':
      throw new Error(`Anthropic streaming error: ${event.error.message}`);

    default:
      return null;
  }
}

/**
 * Accumulator for building complete content blocks from streaming events
 */
export class StreamAccumulator {
  private textBlocks: Map<number, string> = new Map();
  private toolUseBlocks: Map<number, { id: string; name: string; input: string }> = new Map();

  reset(): void {
    this.textBlocks.clear();
    this.toolUseBlocks.clear();
  }

  startTextBlock(index: number): void {
    this.textBlocks.set(index, '');
  }

  startToolUseBlock(index: number, block: Partial<AnthropicToolUseBlock>): void {
    if (block.id && block.name) {
      this.toolUseBlocks.set(index, {
        id: block.id,
        name: block.name,
        input: '',
      });
    }
  }

  appendText(index: number, text: string): void {
    const current = this.textBlocks.get(index) ?? '';
    this.textBlocks.set(index, current + text);
  }

  appendJson(index: number, json: string): void {
    const block = this.toolUseBlocks.get(index);
    if (block) {
      block.input += json;
    }
  }

  finalizeBlock(_index: number): void {
    // Tool use blocks are finalized when message_delta arrives
  }

  getToolCalls(): Array<{ id: string; name: string; input: string }> {
    return Array.from(this.toolUseBlocks.values());
  }

  getFullText(): string {
    return Array.from(this.textBlocks.values()).join('');
  }
}

/**
 * Validates that a request has required max_tokens
 * Anthropic requires max_tokens to be specified
 */
export function ensureMaxTokens(maxTokens: number | undefined, defaultMaxTokens: number): number {
  return maxTokens ?? defaultMaxTokens;
}
