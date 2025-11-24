/**
 * Azure OpenAI Request/Response Transformer
 *
 * Transforms between unified LLM Connector Hub format and Azure OpenAI API format.
 * Azure OpenAI uses the same API format as OpenAI, with the main difference being
 * the URL structure (deployment-based) and authentication (API key header).
 */

import type {
  Message,
  ContentPart,
  FinishReason,
  Usage,
  StreamChunk,
  ToolCall,
} from '@llm-dev-ops/connector-hub-core';

// Re-declare function definition type
type FunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

/**
 * Azure OpenAI message format
 */
export interface AzureMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content?: string | AzureContentPart[] | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: AzureToolCall[];
  tool_call_id?: string;
}

/**
 * Azure OpenAI content part (for vision)
 */
export type AzureContentPart = AzureTextPart | AzureImagePart;

export interface AzureTextPart {
  type: 'text';
  text: string;
}

export interface AzureImagePart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Azure OpenAI tool call format
 */
export interface AzureToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Azure OpenAI function definition
 */
export interface AzureFunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Azure OpenAI tool definition
 */
export interface AzureTool {
  type: 'function';
  function: AzureFunctionDefinition;
}

/**
 * Azure OpenAI request format
 */
export interface AzureRequest {
  messages: AzureMessage[];
  model?: string; // Optional in Azure since deployment name is in URL
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  functions?: AzureFunctionDefinition[];
  function_call?: 'none' | 'auto' | { name: string };
  tools?: AzureTool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

/**
 * Azure OpenAI response format
 */
export interface AzureResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AzureMessage;
    finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

/**
 * Azure OpenAI streaming chunk format
 */
export interface AzureStreamChunk {
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
    finish_reason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | null;
  }>;
  system_fingerprint?: string;
}

/**
 * Transforms unified messages to Azure OpenAI format
 *
 * Key transformations:
 * - Converts message roles (system, user, assistant, function, tool)
 * - Transforms content to text or content parts (for vision)
 * - Handles tool calls and function calls
 *
 * @param messages - Unified messages
 * @returns Azure OpenAI messages
 */
export function transformMessages(messages: Message[]): AzureMessage[] {
  const azureMessages: AzureMessage[] = [];

  for (const message of messages) {
    const azureMessage: AzureMessage = {
      role: message.role as AzureMessage['role'],
    };

    // Transform content
    if (typeof message.content === 'string') {
      azureMessage.content = message.content;
    } else if (Array.isArray(message.content)) {
      // Check if we have any images
      const hasImages = message.content.some(
        (part) => part.type === 'image_url' || part.type === 'image_base64'
      );

      if (hasImages) {
        // Use content parts format for vision
        azureMessage.content = transformContentParts(message.content);
      } else {
        // Extract text only
        azureMessage.content = extractTextFromContentParts(message.content);
      }
    }

    // Add tool calls for assistant messages
    if (message.role === 'assistant' && message.tool_calls) {
      azureMessage.tool_calls = message.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    // Add name and tool_call_id for function/tool messages
    if (message.role === 'function' || message.role === 'tool') {
      if (message.name) {
        azureMessage.name = message.name;
      }
      if (message.tool_call_id) {
        azureMessage.tool_call_id = message.tool_call_id;
      }
    }

    azureMessages.push(azureMessage);
  }

  return azureMessages;
}

/**
 * Transforms unified content parts to Azure OpenAI format
 */
function transformContentParts(parts: ContentPart[]): AzureContentPart[] {
  const azureParts: AzureContentPart[] = [];

  for (const part of parts) {
    if (part.type === 'text') {
      azureParts.push({
        type: 'text',
        text: part.text,
      });
    } else if (part.type === 'image_url') {
      azureParts.push({
        type: 'image_url',
        image_url: {
          url: part.image_url || '',
          detail: 'auto',
        },
      });
    } else if (part.type === 'image_base64') {
      // Convert base64 to data URL
      const dataUrl = part.image_base64?.startsWith('data:')
        ? part.image_base64
        : `data:image/jpeg;base64,${part.image_base64}`;

      azureParts.push({
        type: 'image_url',
        image_url: {
          url: dataUrl,
          detail: 'auto',
        },
      });
    }
  }

  return azureParts;
}

/**
 * Extracts text from content parts
 */
function extractTextFromContentParts(parts: ContentPart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/**
 * Transforms function definitions to Azure OpenAI tools format
 *
 * @param functions - Unified function definitions
 * @returns Azure OpenAI tools
 */
export function transformTools(
  functions: FunctionDefinition[] | undefined
): AzureTool[] | undefined {
  if (!functions || functions.length === 0) {
    return undefined;
  }

  return functions.map((fn) => ({
    type: 'function' as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    },
  }));
}

/**
 * Transforms Azure OpenAI response to unified format
 *
 * @param response - Azure OpenAI response
 * @returns Unified response data
 */
export function transformResponse(response: AzureResponse): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
  tool_calls?: ToolCall[];
} {
  const choice = response.choices[0];

  if (!choice) {
    throw new Error('No choices in Azure OpenAI response');
  }

  const message = choice.message;
  const content = typeof message.content === 'string' ? message.content : '';

  // Extract tool calls
  const tool_calls: ToolCall[] | undefined = message.tool_calls
    ? message.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }))
    : undefined;

  // Map finish reason
  const finish_reason = mapFinishReason(choice.finish_reason);

  // Map usage
  const usage: Usage = {
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    total_tokens: response.usage.total_tokens,
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
 * Maps Azure OpenAI finish reason to unified format
 */
function mapFinishReason(
  finishReason: string | null
): FinishReason {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'function_call':
    case 'tool_calls':
      return 'tool_calls';
    case 'content_filter':
      return 'content_filter';
    default:
      return 'stop';
  }
}

/**
 * Transforms Azure OpenAI streaming chunk to unified format
 *
 * @param chunk - Azure OpenAI streaming chunk
 * @param accumulator - Accumulator for building complete responses
 * @returns Stream chunk or null if chunk doesn't produce output
 */
export function transformStreamChunk(
  chunk: AzureStreamChunk,
  accumulator: StreamAccumulator
): StreamChunk | null {
  if (!chunk.choices || chunk.choices.length === 0) {
    return null;
  }

  const choice = chunk.choices[0];
  if (!choice || !choice.delta) {
    return null;
  }

  const streamChunk: StreamChunk = {};
  const delta = choice.delta;

  // Set role on first chunk
  if (delta.role) {
    streamChunk.role = delta.role;
    accumulator.hasRole = true;
  }

  // Handle text content
  if (delta.content) {
    streamChunk.content = delta.content;
    accumulator.appendText(delta.content);
  }

  // Handle tool calls
  if (delta.tool_calls) {
    for (const toolCall of delta.tool_calls) {
      accumulator.processToolCallDelta(toolCall);
    }
  }

  // Handle finish reason
  if (choice.finish_reason) {
    streamChunk.finish_reason = mapFinishReason(choice.finish_reason);

    // Include accumulated tool calls in final chunk
    const toolCalls = accumulator.getToolCalls();
    if (toolCalls.length > 0) {
      streamChunk.tool_calls = toolCalls;
    }
  }

  return Object.keys(streamChunk).length > 0 ? streamChunk : null;
}

/**
 * Accumulator for building complete responses from streaming chunks
 */
export class StreamAccumulator {
  private text = '';
  private toolCalls: Map<
    number,
    { id: string; name: string; arguments: string }
  > = new Map();
  public hasRole = false;

  reset(): void {
    this.text = '';
    this.toolCalls.clear();
    this.hasRole = false;
  }

  appendText(text: string): void {
    this.text += text;
  }

  processToolCallDelta(delta: {
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }): void {
    const existing = this.toolCalls.get(delta.index);

    if (!existing) {
      // Start new tool call
      this.toolCalls.set(delta.index, {
        id: delta.id || '',
        name: delta.function?.name || '',
        arguments: delta.function?.arguments || '',
      });
    } else {
      // Update existing tool call
      if (delta.id) {
        existing.id = delta.id;
      }
      if (delta.function?.name) {
        existing.name = delta.function.name;
      }
      if (delta.function?.arguments) {
        existing.arguments += delta.function.arguments;
      }
    }
  }

  getFullText(): string {
    return this.text;
  }

  getToolCalls(): ToolCall[] {
    const calls: ToolCall[] = [];

    // Sort by index to maintain order
    const sorted = Array.from(this.toolCalls.entries()).sort(
      ([a], [b]) => a - b
    );

    for (const [, call] of sorted) {
      if (call.id && call.name) {
        calls.push({
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: call.arguments,
          },
        });
      }
    }

    return calls;
  }
}

/**
 * Ensures max_tokens has a value
 */
export function ensureMaxTokens(
  maxTokens: number | undefined,
  defaultMaxTokens: number
): number {
  return maxTokens ?? defaultMaxTokens;
}
