/**
 * AWS Bedrock Request/Response Transformer
 *
 * Transforms between unified LLM Connector Hub format and AWS Bedrock API formats.
 * Handles different model formats (Claude, Llama, Mistral) as each has different APIs.
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

import type { ModelProvider } from './BedrockConfig';

/**
 * Claude (Anthropic) request format on Bedrock
 */
export interface ClaudeBedrockRequest {
  anthropic_version: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<{
      type: 'text' | 'image' | 'tool_use' | 'tool_result';
      text?: string;
      source?: {
        type: 'base64';
        media_type: string;
        data: string;
      };
      id?: string;
      name?: string;
      input?: any;
      tool_use_id?: string;
    }>;
  }>;
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  tools?: Array<{
    name: string;
    description?: string;
    input_schema: Record<string, any>;
  }>;
}

/**
 * Claude (Anthropic) response format on Bedrock
 */
export interface ClaudeBedrockResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Llama request format on Bedrock
 */
export interface LlamaBedrockRequest {
  prompt: string;
  max_gen_len?: number;
  temperature?: number;
  top_p?: number;
}

/**
 * Llama response format on Bedrock
 */
export interface LlamaBedrockResponse {
  generation: string;
  prompt_token_count: number;
  generation_token_count: number;
  stop_reason: string;
}

/**
 * Mistral request format on Bedrock
 */
export interface MistralBedrockRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
}

/**
 * Mistral response format on Bedrock
 */
export interface MistralBedrockResponse {
  outputs: Array<{
    text: string;
    stop_reason?: string;
  }>;
}

/**
 * Unified Bedrock request (discriminated union)
 */
export type BedrockRequest = ClaudeBedrockRequest | LlamaBedrockRequest | MistralBedrockRequest;

/**
 * Unified Bedrock response (discriminated union)
 */
export type BedrockResponse = ClaudeBedrockResponse | LlamaBedrockResponse | MistralBedrockResponse;

/**
 * Transforms unified messages to Bedrock format based on model provider
 *
 * @param messages - Unified messages
 * @param provider - Model provider
 * @param maxTokens - Maximum tokens
 * @param options - Additional options
 * @returns Bedrock-formatted request
 */
export function transformRequest(
  messages: Message[],
  provider: ModelProvider,
  maxTokens: number,
  options: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
    functions?: FunctionDefinition[];
  } = {}
): BedrockRequest {
  switch (provider) {
    case 'anthropic':
      return transformToClaudeRequest(messages, maxTokens, options);
    case 'meta':
      return transformToLlamaRequest(messages, maxTokens, options);
    case 'mistral':
      return transformToMistralRequest(messages, maxTokens, options);
    default:
      // Default to Claude format
      return transformToClaudeRequest(messages, maxTokens, options);
  }
}

/**
 * Transforms messages to Claude (Anthropic) format
 */
function transformToClaudeRequest(
  messages: Message[],
  maxTokens: number,
  options: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
    functions?: FunctionDefinition[];
  }
): ClaudeBedrockRequest {
  let systemMessage: string | undefined;
  const claudeMessages: ClaudeBedrockRequest['messages'] = [];

  for (const message of messages) {
    // Extract system message
    if (message.role === 'system') {
      const content = typeof message.content === 'string'
        ? message.content
        : extractTextFromContentParts(message.content);

      systemMessage = systemMessage
        ? `${systemMessage}\n\n${content}`
        : content;
      continue;
    }

    // Skip function/tool role messages
    if (message.role === 'function' || message.role === 'tool') {
      if (message.tool_call_id) {
        const lastMsg = claudeMessages[claudeMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          const content = typeof message.content === 'string'
            ? message.content
            : extractTextFromContentParts(message.content);

          lastMsg.content.push({
            type: 'tool_result',
            tool_use_id: message.tool_call_id,
            text: content,
          });
        }
      }
      continue;
    }

    // Convert user and assistant messages
    if (message.role === 'user' || message.role === 'assistant') {
      const contentBlocks = transformContentToClaude(message);

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

      claudeMessages.push({
        role: message.role,
        content: contentBlocks,
      });
    }
  }

  const request: ClaudeBedrockRequest = {
    anthropic_version: 'bedrock-2023-05-31',
    messages: claudeMessages,
    max_tokens: maxTokens,
  };

  if (systemMessage) {
    request.system = systemMessage;
  }

  if (options.temperature !== undefined) {
    request.temperature = options.temperature;
  }

  if (options.top_p !== undefined) {
    request.top_p = options.top_p;
  }

  if (options.top_k !== undefined) {
    request.top_k = options.top_k;
  }

  if (options.stop && options.stop.length > 0) {
    request.stop_sequences = options.stop;
  }

  // Add tools/functions if present
  if (options.functions && options.functions.length > 0) {
    request.tools = options.functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters || {},
    }));
  }

  return request;
}

/**
 * Transforms content to Claude format
 */
function transformContentToClaude(message: Message): ClaudeBedrockRequest['messages'][0]['content'] {
  if (typeof message.content === 'string') {
    return [{ type: 'text', text: message.content }];
  }

  const blocks: ClaudeBedrockRequest['messages'][0]['content'] = [];

  for (const part of message.content) {
    if (part.type === 'text') {
      blocks.push({
        type: 'text',
        text: part.text,
      });
    } else if (part.type === 'image_url' || part.type === 'image_base64') {
      const imageData = part.type === 'image_base64' ? part.image_base64 : extractBase64FromUrl(part.image_url);
      if (imageData) {
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imageData,
          },
        });
      }
    }
  }

  return blocks;
}

/**
 * Transforms messages to Llama format (uses chat template)
 */
function transformToLlamaRequest(
  messages: Message[],
  maxTokens: number,
  options: {
    temperature?: number;
    top_p?: number;
  }
): LlamaBedrockRequest {
  // Llama uses a prompt-based format with special tokens
  const prompt = convertMessagesToLlamaPrompt(messages);

  const request: LlamaBedrockRequest = {
    prompt,
    max_gen_len: maxTokens,
  };

  if (options.temperature !== undefined) {
    request.temperature = options.temperature;
  }

  if (options.top_p !== undefined) {
    request.top_p = options.top_p;
  }

  return request;
}

/**
 * Converts messages to Llama prompt format
 */
function convertMessagesToLlamaPrompt(messages: Message[]): string {
  let prompt = '<|begin_of_text|>';

  for (const message of messages) {
    const content = typeof message.content === 'string'
      ? message.content
      : extractTextFromContentParts(message.content);

    switch (message.role) {
      case 'system':
        prompt += `<|start_header_id|>system<|end_header_id|>\n\n${content}<|eot_id|>`;
        break;
      case 'user':
        prompt += `<|start_header_id|>user<|end_header_id|>\n\n${content}<|eot_id|>`;
        break;
      case 'assistant':
        prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${content}<|eot_id|>`;
        break;
    }
  }

  // Add assistant prompt starter
  prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';

  return prompt;
}

/**
 * Transforms messages to Mistral format
 */
function transformToMistralRequest(
  messages: Message[],
  maxTokens: number,
  options: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
  }
): MistralBedrockRequest {
  // Mistral uses a similar prompt-based format
  const prompt = convertMessagesToMistralPrompt(messages);

  const request: MistralBedrockRequest = {
    prompt,
    max_tokens: maxTokens,
  };

  if (options.temperature !== undefined) {
    request.temperature = options.temperature;
  }

  if (options.top_p !== undefined) {
    request.top_p = options.top_p;
  }

  if (options.top_k !== undefined) {
    request.top_k = options.top_k;
  }

  if (options.stop && options.stop.length > 0) {
    request.stop = options.stop;
  }

  return request;
}

/**
 * Converts messages to Mistral prompt format
 */
function convertMessagesToMistralPrompt(messages: Message[]): string {
  let prompt = '';

  for (const message of messages) {
    const content = typeof message.content === 'string'
      ? message.content
      : extractTextFromContentParts(message.content);

    switch (message.role) {
      case 'system':
        prompt += `<s>[INST] ${content} [/INST]</s>\n`;
        break;
      case 'user':
        prompt += `<s>[INST] ${content} [/INST]`;
        break;
      case 'assistant':
        prompt += ` ${content}</s>\n`;
        break;
    }
  }

  return prompt;
}

/**
 * Transforms Bedrock response to unified format
 *
 * @param response - Bedrock response
 * @param provider - Model provider
 * @returns Unified response data
 */
export function transformResponse(
  response: BedrockResponse,
  provider: ModelProvider
): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
  tool_calls?: ToolCall[];
} {
  switch (provider) {
    case 'anthropic':
      return transformClaudeResponse(response as ClaudeBedrockResponse);
    case 'meta':
      return transformLlamaResponse(response as LlamaBedrockResponse);
    case 'mistral':
      return transformMistralResponse(response as MistralBedrockResponse);
    default:
      return transformClaudeResponse(response as ClaudeBedrockResponse);
  }
}

/**
 * Transforms Claude response
 */
function transformClaudeResponse(response: ClaudeBedrockResponse): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
  tool_calls?: ToolCall[];
} {
  const textBlocks = response.content.filter(block => block.type === 'text');
  const content = textBlocks.map(block => block.text || '').join('\n');

  const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
  const tool_calls: ToolCall[] | undefined = toolUseBlocks.length > 0
    ? toolUseBlocks.map(block => ({
        id: block.id || '',
        type: 'function' as const,
        function: {
          name: block.name || '',
          arguments: JSON.stringify(block.input || {}),
        },
      }))
    : undefined;

  return {
    content,
    role: 'assistant',
    finish_reason: mapClaudeStopReason(response.stop_reason),
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
    tool_calls,
  };
}

/**
 * Transforms Llama response
 */
function transformLlamaResponse(response: LlamaBedrockResponse): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
} {
  return {
    content: response.generation,
    role: 'assistant',
    finish_reason: mapLlamaStopReason(response.stop_reason),
    usage: {
      prompt_tokens: response.prompt_token_count,
      completion_tokens: response.generation_token_count,
      total_tokens: response.prompt_token_count + response.generation_token_count,
    },
  };
}

/**
 * Transforms Mistral response
 */
function transformMistralResponse(response: MistralBedrockResponse): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
} {
  const output = response.outputs[0];

  if (!output) {
    throw new Error('No output in Mistral response');
  }

  return {
    content: output.text,
    role: 'assistant',
    finish_reason: mapMistralStopReason(output.stop_reason),
    usage: {
      prompt_tokens: 0, // Mistral doesn't provide token counts in response
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

/**
 * Transforms streaming chunk to unified format
 */
export function transformStreamChunk(
  content: string,
  stopReason?: string,
  provider?: ModelProvider
): StreamChunk {
  const chunk: StreamChunk = {};

  if (content) {
    chunk.content = content;
  }

  if (stopReason) {
    chunk.finish_reason = provider === 'anthropic'
      ? mapClaudeStopReason(stopReason)
      : provider === 'meta'
      ? mapLlamaStopReason(stopReason)
      : mapMistralStopReason(stopReason);
  }

  return chunk;
}

/**
 * Maps Claude stop reason
 */
function mapClaudeStopReason(stopReason: string | null): FinishReason {
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
 * Maps Llama stop reason
 */
function mapLlamaStopReason(stopReason: string): FinishReason {
  switch (stopReason) {
    case 'length':
      return 'length';
    case 'stop':
    case 'end_of_text':
      return 'stop';
    default:
      return 'stop';
  }
}

/**
 * Maps Mistral stop reason
 */
function mapMistralStopReason(stopReason?: string): FinishReason {
  switch (stopReason) {
    case 'length':
      return 'length';
    case 'stop':
      return 'stop';
    default:
      return 'stop';
  }
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
 * Extracts base64 data from image URL
 */
function extractBase64FromUrl(url?: string): string | undefined {
  if (!url) return undefined;

  const match = url.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (match) {
    return match[1];
  }

  return undefined;
}

/**
 * Validates that max_tokens is specified
 */
export function ensureMaxTokens(maxTokens: number | undefined, defaultMaxTokens: number): number {
  return maxTokens ?? defaultMaxTokens;
}
