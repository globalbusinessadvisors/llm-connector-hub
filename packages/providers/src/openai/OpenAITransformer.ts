/**
 * OpenAI Request/Response Transformer
 *
 * Transforms between unified LLM Connector Hub format and OpenAI API format.
 * OpenAI uses a straightforward message format with:
 * - Messages array with role and content
 * - Support for images via content array
 * - Function calling via tools/functions
 * - Streaming via SSE
 */

import type {
  Message,
  ContentPart,
  FinishReason,
  Usage,
  StreamChunk,
  ToolCall,
  FunctionDefinition,
} from '@llm-dev-ops/connector-hub-core';

/**
 * OpenAI message format
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | OpenAIContentPart[] | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

/**
 * OpenAI content part types
 */
export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

/**
 * OpenAI tool call format
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenAI tool definition format
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * OpenAI API request format
 */
export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  user?: string;
  tools?: OpenAITool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  functions?: OpenAITool['function'][];
  function_call?: 'none' | 'auto' | { name: string };
}

/**
 * OpenAI API response format
 */
export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      function_call?: {
        name: string;
        arguments: string;
      };
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk format
 */
export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      function_call?: {
        name?: string;
        arguments?: string;
      };
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | null;
  }>;
}

/**
 * Transforms unified messages to OpenAI format
 *
 * @param messages - Unified messages
 * @returns OpenAI formatted messages
 */
export function transformMessages(messages: Message[]): OpenAIMessage[] {
  return messages.map(message => {
    const openaiMessage: OpenAIMessage = {
      role: message.role,
      content: null,
    };

    // Transform content
    if (typeof message.content === 'string') {
      openaiMessage.content = message.content;
    } else if (Array.isArray(message.content)) {
      // Check if there are any image parts
      const hasImages = message.content.some(
        part => part.type === 'image_url' || part.type === 'image_base64'
      );

      if (hasImages) {
        // Use content array format for multimodal
        openaiMessage.content = transformContentParts(message.content);
      } else {
        // Extract text only
        const textParts = message.content.filter(
          (part): part is { type: 'text'; text: string } => part.type === 'text'
        );
        openaiMessage.content = textParts.map(p => p.text).join('\n');
      }
    }

    // Add optional fields
    if (message.name) {
      openaiMessage.name = message.name;
    }

    if (message.function_call) {
      openaiMessage.function_call = message.function_call;
    }

    if (message.tool_calls) {
      openaiMessage.tool_calls = message.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    if (message.tool_call_id) {
      openaiMessage.tool_call_id = message.tool_call_id;
    }

    return openaiMessage;
  });
}

/**
 * Transforms content parts to OpenAI format
 */
function transformContentParts(parts: ContentPart[]): OpenAIContentPart[] {
  const openaiParts: OpenAIContentPart[] = [];

  for (const part of parts) {
    if (part.type === 'text') {
      openaiParts.push({
        type: 'text',
        text: part.text,
      });
    } else if (part.type === 'image_url' && part.image_url) {
      openaiParts.push({
        type: 'image_url',
        image_url: {
          url: part.image_url,
          detail: part.detail,
        },
      });
    } else if (part.type === 'image_base64' && part.image_base64) {
      // Convert base64 to data URL
      const dataUrl = part.image_base64.startsWith('data:')
        ? part.image_base64
        : `data:image/jpeg;base64,${part.image_base64}`;

      openaiParts.push({
        type: 'image_url',
        image_url: {
          url: dataUrl,
          detail: part.detail,
        },
      });
    }
  }

  return openaiParts;
}

/**
 * Transforms function definitions to OpenAI tools format
 */
export function transformTools(functions: FunctionDefinition[]): OpenAITool[] {
  return functions.map(fn => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    },
  }));
}

/**
 * Transforms OpenAI response to unified format
 *
 * @param response - OpenAI API response
 * @returns Unified response data
 */
export function transformResponse(response: OpenAIResponse): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
  tool_calls?: ToolCall[];
  function_call?: { name: string; arguments: string };
} {
  const choice = response.choices[0];
  if (!choice) {
    throw new Error('OpenAI response missing choices');
  }

  const content = choice.message.content ?? '';
  const finish_reason = mapFinishReason(choice.finish_reason);

  // Map tool calls
  const tool_calls: ToolCall[] | undefined = choice.message.tool_calls?.map(tc => ({
    id: tc.id,
    type: 'function',
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  }));

  // Map function call
  const function_call = choice.message.function_call;

  return {
    content,
    role: 'assistant',
    finish_reason,
    usage: response.usage,
    tool_calls,
    function_call,
  };
}

/**
 * Maps OpenAI finish reason to unified format
 */
function mapFinishReason(finishReason: string | null): FinishReason {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'function_call':
      return 'function_call';
    case 'tool_calls':
      return 'tool_calls';
    case 'content_filter':
      return 'content_filter';
    default:
      return 'stop';
  }
}

/**
 * Transforms OpenAI streaming chunk to unified stream chunk
 *
 * @param chunk - OpenAI streaming chunk
 * @param accumulator - Accumulator for building complete content
 * @returns Stream chunk or null if chunk doesn't produce output
 */
export function transformStreamChunk(
  chunk: OpenAIStreamChunk,
  accumulator: StreamAccumulator
): StreamChunk | null {
  const choice = chunk.choices[0];
  if (!choice) {
    return null;
  }

  const delta = choice.delta;
  const streamChunk: StreamChunk = {};

  // Handle role
  if (delta.role) {
    streamChunk.role = delta.role;
  }

  // Handle content
  if (delta.content) {
    accumulator.appendContent(delta.content);
    streamChunk.content = delta.content;
  }

  // Handle function call
  if (delta.function_call) {
    accumulator.appendFunctionCall(delta.function_call);
    streamChunk.function_call = delta.function_call;
  }

  // Handle tool calls
  if (delta.tool_calls) {
    for (const toolCall of delta.tool_calls) {
      accumulator.appendToolCall(toolCall);
    }
    // Don't emit partial tool calls, wait for completion
  }

  // Handle finish reason
  if (choice.finish_reason) {
    streamChunk.finish_reason = mapFinishReason(choice.finish_reason);

    // Emit complete tool calls if any
    const completedToolCalls = accumulator.getToolCalls();
    if (completedToolCalls.length > 0) {
      streamChunk.tool_calls = completedToolCalls;
    }
  }

  // Only return chunk if it has content
  return Object.keys(streamChunk).length > 0 ? streamChunk : null;
}

/**
 * Accumulator for building complete content from streaming chunks
 */
export class StreamAccumulator {
  private content: string = '';
  private functionCall: { name: string; arguments: string } | null = null;
  private toolCalls: Map<number, { id?: string; name?: string; arguments: string }> = new Map();

  reset(): void {
    this.content = '';
    this.functionCall = null;
    this.toolCalls.clear();
  }

  appendContent(text: string): void {
    this.content += text;
  }

  appendFunctionCall(fc: { name?: string; arguments?: string }): void {
    if (!this.functionCall) {
      this.functionCall = { name: '', arguments: '' };
    }
    if (fc.name) {
      this.functionCall.name = fc.name;
    }
    if (fc.arguments) {
      this.functionCall.arguments += fc.arguments;
    }
  }

  appendToolCall(tc: { index: number; id?: string; type?: 'function'; function?: { name?: string; arguments?: string } }): void {
    let toolCall = this.toolCalls.get(tc.index);
    if (!toolCall) {
      toolCall = { arguments: '' };
      this.toolCalls.set(tc.index, toolCall);
    }

    if (tc.id) {
      toolCall.id = tc.id;
    }
    if (tc.function?.name) {
      toolCall.name = tc.function.name;
    }
    if (tc.function?.arguments) {
      toolCall.arguments += tc.function.arguments;
    }
  }

  getContent(): string {
    return this.content;
  }

  getFunctionCall(): { name: string; arguments: string } | null {
    return this.functionCall;
  }

  getToolCalls(): ToolCall[] {
    const calls: ToolCall[] = [];
    for (const [_, tc] of this.toolCalls) {
      if (tc.id && tc.name) {
        calls.push({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        });
      }
    }
    return calls;
  }
}
