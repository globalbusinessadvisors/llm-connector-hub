/**
 * Google AI Request/Response Transformer
 *
 * Transforms between unified LLM Connector Hub format and Google AI (Gemini) API format.
 * Handles the key differences in Google's API:
 * - Content parts structure (text, inline_data, function_call, function_response)
 * - System instructions as separate parameter
 * - Generation config for parameters
 * - Safety settings
 * - Multiple candidate responses
 */

import type {
  Message,
  ContentPart,
  FinishReason,
  Usage,
  StreamChunk,
} from '@llm-connector-hub/core';

// Re-declare types that may not be exported from core
type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type FunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};
import type { GoogleSafetySetting } from './GoogleConfig';

/**
 * Google AI content part types
 */
export type GoogleContentPart =
  | GoogleTextPart
  | GoogleInlineDataPart
  | GoogleFunctionCallPart
  | GoogleFunctionResponsePart;

export interface GoogleTextPart {
  text: string;
}

export interface GoogleInlineDataPart {
  inline_data: {
    mime_type: string;
    data: string; // base64 encoded
  };
}

export interface GoogleFunctionCallPart {
  function_call: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface GoogleFunctionResponsePart {
  function_response: {
    name: string;
    response: Record<string, unknown>;
  };
}

/**
 * Google AI message format (called "Content" in their API)
 */
export interface GoogleContent {
  role: 'user' | 'model';
  parts: GoogleContentPart[];
}

/**
 * Google AI generation configuration
 */
export interface GoogleGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

/**
 * Google AI tool/function definition
 */
export interface GoogleFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface GoogleTool {
  function_declarations: GoogleFunctionDeclaration[];
}

/**
 * Google AI request format
 */
export interface GoogleRequest {
  contents: GoogleContent[];
  systemInstruction?: {
    parts: GoogleTextPart[];
  };
  generationConfig?: GoogleGenerationConfig;
  safetySettings?: GoogleSafetySetting[];
  tools?: GoogleTool[];
}

/**
 * Google AI candidate response
 */
export interface GoogleCandidate {
  content: GoogleContent;
  finishReason?:
    | 'FINISH_REASON_UNSPECIFIED'
    | 'STOP'
    | 'MAX_TOKENS'
    | 'SAFETY'
    | 'RECITATION'
    | 'OTHER';
  safetyRatings?: Array<{
    category: string;
    probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  citationMetadata?: {
    citations: Array<{
      startIndex?: number;
      endIndex?: number;
      uri?: string;
      license?: string;
    }>;
  };
}

/**
 * Google AI response format
 */
export interface GoogleResponse {
  candidates: GoogleCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  promptFeedback?: {
    blockReason?: 'BLOCK_REASON_UNSPECIFIED' | 'SAFETY' | 'OTHER';
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
}

/**
 * Google AI streaming chunk
 */
export interface GoogleStreamChunk {
  candidates?: GoogleCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Transforms unified messages to Google AI format
 *
 * Key transformations:
 * - Extracts system message (first message with role='system')
 * - Converts user/assistant messages to Google Content format
 * - Transforms content to parts (text, inline_data)
 * - Handles function calls and responses
 *
 * @param messages - Unified messages
 * @returns Tuple of [system instruction, Google contents]
 */
export function transformMessages(
  messages: Message[]
): [GoogleContent['parts'] | undefined, GoogleContent[]] {
  let systemParts: GoogleContent['parts'] | undefined;
  const googleContents: GoogleContent[] = [];

  for (const message of messages) {
    // Extract system message
    if (message.role === 'system') {
      const parts = transformMessageContent(message);
      if (!systemParts) {
        systemParts = parts;
      } else {
        // Concatenate multiple system messages
        systemParts.push(...parts);
      }
      continue;
    }

    // Handle function/tool response messages
    if (message.role === 'function' || message.role === 'tool') {
      if (message.tool_call_id) {
        const content = typeof message.content === 'string'
          ? message.content
          : extractTextFromContentParts(message.content);

        const functionName = message.name || 'unknown_function';

        googleContents.push({
          role: 'model',
          parts: [
            {
              function_response: {
                name: functionName,
                response: {
                  result: content,
                },
              },
            },
          ],
        });
      }
      continue;
    }

    // Convert user and assistant messages
    if (message.role === 'user') {
      const parts = transformMessageContent(message);
      googleContents.push({
        role: 'user',
        parts,
      });
    } else if (message.role === 'assistant') {
      const parts = transformMessageContent(message);

      // Add function calls if present
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          parts.push({
            function_call: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments),
            },
          });
        }
      }

      googleContents.push({
        role: 'model',
        parts,
      });
    }
  }

  return [systemParts, googleContents];
}

/**
 * Transforms message content to Google content parts
 */
function transformMessageContent(message: Message): GoogleContentPart[] {
  if (typeof message.content === 'string') {
    return [{ text: message.content }];
  }

  const parts: GoogleContentPart[] = [];

  for (const part of message.content) {
    if (part.type === 'text') {
      parts.push({
        text: part.text,
      });
    } else if (part.type === 'image_url') {
      // Convert image URL to inline data
      if (part.image_url?.startsWith('data:')) {
        const [mimeType, data] = parseDataUrl(part.image_url);
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data,
          },
        });
      } else if (part.image_url) {
        // Google AI doesn't support URLs directly, would need to fetch and convert
        // For now, add as text with URL
        parts.push({
          text: `[Image: ${part.image_url}]`,
        });
      }
    } else if (part.type === 'image_base64' && part.image_base64) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg', // Default, could be enhanced
          data: part.image_base64,
        },
      });
    }
  }

  return parts;
}

/**
 * Parses a data URL into mime type and base64 data
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
    .map((p) => p.text)
    .join('\n');
}

/**
 * Transforms function definitions to Google tool format
 *
 * @param functions - Unified function definitions
 * @returns Google tool format
 */
export function transformTools(functions: FunctionDefinition[] | undefined): GoogleTool[] | undefined {
  if (!functions || functions.length === 0) {
    return undefined;
  }

  return [
    {
      function_declarations: functions.map((fn) => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters as GoogleFunctionDeclaration['parameters'],
      })),
    },
  ];
}

/**
 * Transforms Google AI response to unified format
 *
 * @param response - Google AI response
 * @returns Unified response data
 */
export function transformResponse(response: GoogleResponse): {
  content: string;
  role: 'assistant';
  finish_reason: FinishReason;
  usage: Usage;
  tool_calls?: ToolCall[];
  metadata?: Record<string, unknown>;
} {
  // Google can return multiple candidates; we use the first one
  const candidate = response.candidates[0];

  if (!candidate) {
    throw new Error('No candidates in Google AI response');
  }

  // Extract text content from parts
  const textParts = candidate.content.parts.filter(
    (part): part is GoogleTextPart => 'text' in part
  );
  const content = textParts.map((part) => part.text).join('\n');

  // Extract function calls
  const functionCallParts = candidate.content.parts.filter(
    (part): part is GoogleFunctionCallPart => 'function_call' in part
  );

  const tool_calls: ToolCall[] | undefined =
    functionCallParts.length > 0
      ? functionCallParts.map((part, index) => ({
          id: `call_${index}`, // Google doesn't provide IDs, generate them
          type: 'function' as const,
          function: {
            name: part.function_call.name || 'unknown',
            arguments: JSON.stringify(part.function_call.args || {}),
          },
        }))
      : undefined;

  // Map finish reason
  const finish_reason = mapFinishReason(candidate.finishReason);

  // Map usage
  const usage: Usage = {
    prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
    completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
    total_tokens: response.usageMetadata?.totalTokenCount || 0,
  };

  // Include safety ratings and citations in metadata
  const metadata: Record<string, unknown> = {};
  if (candidate.safetyRatings) {
    metadata['safety_ratings'] = candidate.safetyRatings;
  }
  if (candidate.citationMetadata) {
    metadata['citation_metadata'] = candidate.citationMetadata;
  }
  if (response.promptFeedback) {
    metadata['prompt_feedback'] = response.promptFeedback;
  }

  return {
    content,
    role: 'assistant',
    finish_reason,
    usage,
    tool_calls,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/**
 * Maps Google AI finish reason to unified format
 */
function mapFinishReason(
  finishReason: GoogleCandidate['finishReason']
): FinishReason {
  switch (finishReason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
      return 'content_filter';
    case 'FINISH_REASON_UNSPECIFIED':
    case 'OTHER':
    default:
      return 'stop';
  }
}

/**
 * Transforms Google AI streaming chunk to unified format
 *
 * @param chunk - Google AI streaming chunk
 * @param accumulator - Accumulator for building complete responses
 * @returns Stream chunk or null if chunk doesn't produce output
 */
export function transformStreamChunk(
  chunk: GoogleStreamChunk,
  accumulator: StreamAccumulator
): StreamChunk | null {
  if (!chunk.candidates || chunk.candidates.length === 0) {
    return null;
  }

  const candidate = chunk.candidates[0];
  if (!candidate || !candidate.content) {
    return null;
  }

  const streamChunk: StreamChunk = {};

  // Extract text content
  const textParts = candidate.content.parts.filter(
    (part): part is GoogleTextPart => 'text' in part
  );

  if (textParts.length > 0) {
    const text = textParts.map((part) => part.text).join('');
    if (text) {
      streamChunk.content = text;
      accumulator.appendText(text);
    }
  }

  // Handle function calls
  const functionCallParts = candidate.content.parts.filter(
    (part): part is GoogleFunctionCallPart => 'function_call' in part
  );

  if (functionCallParts.length > 0) {
    for (const part of functionCallParts) {
      accumulator.addFunctionCall(part.function_call);
    }
  }

  // Set role on first chunk
  if (!accumulator.hasRole) {
    streamChunk.role = 'assistant';
    accumulator.hasRole = true;
  }

  // Handle finish reason
  if (candidate.finishReason) {
    streamChunk.finish_reason = mapFinishReason(candidate.finishReason);

    // Include accumulated tool calls in final chunk
    const toolCalls = accumulator.getToolCalls();
    if (toolCalls.length > 0) {
      streamChunk.tool_calls = toolCalls as any;
    }
  }

  return Object.keys(streamChunk).length > 0 ? streamChunk : null;
}

/**
 * Accumulator for building complete responses from streaming chunks
 */
export class StreamAccumulator {
  private text = '';
  private functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  public hasRole = false;

  reset(): void {
    this.text = '';
    this.functionCalls = [];
    this.hasRole = false;
  }

  appendText(text: string): void {
    this.text += text;
  }

  addFunctionCall(call: { name: string; args: Record<string, unknown> }): void {
    this.functionCalls.push(call);
  }

  getFullText(): string {
    return this.text;
  }

  getToolCalls(): ToolCall[] {
    return this.functionCalls.map((call, index) => ({
      id: `call_${index}`,
      type: 'function',
      function: {
        name: call.name,
        arguments: JSON.stringify(call.args),
      },
    }));
  }
}

/**
 * Validates that a request has required max_tokens
 * Google AI requires maxOutputTokens in generation config
 */
export function ensureMaxTokens(
  maxTokens: number | undefined,
  defaultMaxTokens: number
): number {
  return maxTokens ?? defaultMaxTokens;
}

/**
 * Builds generation config from request parameters
 */
export function buildGenerationConfig(params: {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  stop?: string[];
  defaultMaxTokens: number;
}): GoogleGenerationConfig {
  const config: GoogleGenerationConfig = {
    maxOutputTokens: ensureMaxTokens(params.max_tokens, params.defaultMaxTokens),
  };

  if (params.temperature !== undefined) {
    config.temperature = params.temperature;
  }

  if (params.top_p !== undefined) {
    config.topP = params.top_p;
  }

  if (params.top_k !== undefined) {
    config.topK = params.top_k;
  }

  if (params.stop && params.stop.length > 0) {
    config.stopSequences = params.stop;
  }

  return config;
}
