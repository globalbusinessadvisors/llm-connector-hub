/**
 * Core type definitions for LLM Connector Hub
 */

export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool';
export type ContentPartType = 'text' | 'image_url' | 'image_base64';
export type ErrorType = 'authentication' | 'rate_limit' | 'invalid_request' | 'server_error' | 'timeout' | 'network' | 'unknown';
export type FinishReason = 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url' | 'image_base64';
  image_url?: string;
  image_base64?: string;
  detail?: 'auto' | 'low' | 'high';
}

export type ContentPart = TextContentPart | ImageContentPart;

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

export interface Message {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}

export interface StreamChunk {
  content?: string;
  role?: MessageRole;
  finish_reason?: FinishReason;
  function_call?: Partial<FunctionCall>;
  tool_calls?: Partial<ToolCall>[];
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ProviderMetadata {
  provider: string;
  model: string;
  raw_response?: unknown;
  [key: string]: unknown;
}

export interface ProviderCapabilities {
  streaming: boolean;
  function_calling: boolean;
  vision: boolean;
  json_mode: boolean;
  max_tokens?: number;
  supports_system_message: boolean;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
  stream?: boolean;
  user?: string;
  functions?: FunctionDefinition[];
  tools?: ToolDefinition[];
}

export interface CompletionChoice {
  index: number;
  message: Message;
  finishReason: FinishReason;
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: Usage;
  metadata?: ProviderMetadata;
}

export interface MiddlewareContext {
  request: CompletionRequest;
  provider: string;
  metadata: Record<string, unknown>;
  startTime: number;
  attemptCount?: number;
  lastError?: Error;
}

export type NextFunction = (context: MiddlewareContext) => Promise<CompletionResponse>;

export interface IMiddleware {
  readonly name: string;
  initialize?(): Promise<void>;
  process(context: MiddlewareContext, next: NextFunction): Promise<CompletionResponse>;
  cleanup?(): Promise<void>;
}
