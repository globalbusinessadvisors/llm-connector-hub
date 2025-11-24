/**
 * OpenAI Provider Configuration
 *
 * Defines configuration options for the OpenAI provider,
 * including API authentication, model settings, and request defaults.
 */

/**
 * Configuration interface for OpenAI provider
 */
export interface OpenAIConfig {
  /**
   * OpenAI API key (required)
   * Get your key from https://platform.openai.com/api-keys
   */
  apiKey: string;

  /**
   * Base URL for OpenAI API
   * @default "https://api.openai.com"
   */
  baseUrl?: string;

  /**
   * Organization ID (optional)
   * Used for organization-scoped API requests
   */
  organizationId?: string;

  /**
   * Request timeout in milliseconds
   * @default 60000 (60 seconds)
   */
  timeout?: number;

  /**
   * Maximum retries for failed requests
   * @default 3
   */
  maxRetries?: number;

  /**
   * Default max tokens if not specified in request
   * @default 1024
   */
  defaultMaxTokens?: number;

  /**
   * Additional headers to include in requests
   */
  additionalHeaders?: Record<string, string>;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_OPENAI_CONFIG: Partial<OpenAIConfig> = {
  baseUrl: 'https://api.openai.com',
  timeout: 60000,
  maxRetries: 3,
  defaultMaxTokens: 1024,
  debug: false,
};

/**
 * Supported OpenAI models
 */
export const OPENAI_MODELS = {
  // GPT-5 models (latest)
  GPT_5: 'gpt-5',
  GPT_5_1: 'gpt-5.1',

  // GPT-4o models (optimized)
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',

  // GPT-4 Turbo
  GPT_4_TURBO: 'gpt-4-turbo',
  GPT_4_TURBO_PREVIEW: 'gpt-4-turbo-preview',

  // GPT-4 (standard)
  GPT_4: 'gpt-4',
  GPT_4_32K: 'gpt-4-32k',

  // GPT-3.5 Turbo
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_3_5_TURBO_16K: 'gpt-3.5-turbo-16k',
} as const;

/**
 * Type for valid OpenAI model names
 */
export type OpenAIModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS] | string;

/**
 * Model capabilities and limits
 */
export interface OpenAIModelInfo {
  name: string;
  maxTokens: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
}

/**
 * Information about available OpenAI models
 */
export const OPENAI_MODEL_INFO: Record<string, OpenAIModelInfo> = {
  [OPENAI_MODELS.GPT_5]: {
    name: 'GPT-5',
    maxTokens: 16384,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },
  [OPENAI_MODELS.GPT_5_1]: {
    name: 'GPT-5.1',
    maxTokens: 16384,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },
  [OPENAI_MODELS.GPT_4O]: {
    name: 'GPT-4o',
    maxTokens: 16384,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },
  [OPENAI_MODELS.GPT_4O_MINI]: {
    name: 'GPT-4o Mini',
    maxTokens: 16384,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },
  [OPENAI_MODELS.GPT_4_TURBO]: {
    name: 'GPT-4 Turbo',
    maxTokens: 4096,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },
  [OPENAI_MODELS.GPT_4_TURBO_PREVIEW]: {
    name: 'GPT-4 Turbo Preview',
    maxTokens: 4096,
    supportsVision: true,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },
  [OPENAI_MODELS.GPT_4]: {
    name: 'GPT-4',
    maxTokens: 8192,
    supportsVision: false,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 8192,
  },
  [OPENAI_MODELS.GPT_4_32K]: {
    name: 'GPT-4 32K',
    maxTokens: 8192,
    supportsVision: false,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 32768,
  },
  [OPENAI_MODELS.GPT_3_5_TURBO]: {
    name: 'GPT-3.5 Turbo',
    maxTokens: 4096,
    supportsVision: false,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 16385,
  },
  [OPENAI_MODELS.GPT_3_5_TURBO_16K]: {
    name: 'GPT-3.5 Turbo 16K',
    maxTokens: 4096,
    supportsVision: false,
    supportsFunctionCalling: true,
    supportsStreaming: true,
    contextWindow: 16385,
  },
};

/**
 * Validation error class for configuration
 */
export class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIConfigError';
  }
}

/**
 * Validates OpenAI configuration
 *
 * @param config - Configuration to validate
 * @throws {OpenAIConfigError} If configuration is invalid
 */
export function validateOpenAIConfig(config: OpenAIConfig): void {
  // API key is required
  if (!config.apiKey) {
    throw new OpenAIConfigError('API key is required');
  }

  if (typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
    throw new OpenAIConfigError('API key must be a non-empty string');
  }

  // Validate timeout if provided
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      throw new OpenAIConfigError('Timeout must be a positive number');
    }
  }

  // Validate maxRetries if provided
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      throw new OpenAIConfigError('Max retries must be a non-negative number');
    }
  }

  // Validate defaultMaxTokens if provided
  if (config.defaultMaxTokens !== undefined) {
    if (typeof config.defaultMaxTokens !== 'number' || config.defaultMaxTokens <= 0) {
      throw new OpenAIConfigError('Default max tokens must be a positive number');
    }
  }

  // Validate baseUrl if provided
  if (config.baseUrl !== undefined) {
    if (typeof config.baseUrl !== 'string' || !config.baseUrl.startsWith('http')) {
      throw new OpenAIConfigError('Base URL must be a valid HTTP(S) URL');
    }
  }

  // Validate organizationId if provided
  if (config.organizationId !== undefined) {
    if (typeof config.organizationId !== 'string' || config.organizationId.trim().length === 0) {
      throw new OpenAIConfigError('Organization ID must be a non-empty string');
    }
  }
}

/**
 * Merges user config with defaults
 *
 * @param config - User-provided configuration
 * @returns Complete configuration with defaults applied
 */
export function mergeWithDefaults(config: OpenAIConfig): Required<Omit<OpenAIConfig, 'additionalHeaders' | 'organizationId'>> & {
  additionalHeaders?: Record<string, string>;
  organizationId?: string;
} {
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? DEFAULT_OPENAI_CONFIG.baseUrl!,
    timeout: config.timeout ?? DEFAULT_OPENAI_CONFIG.timeout!,
    maxRetries: config.maxRetries ?? DEFAULT_OPENAI_CONFIG.maxRetries!,
    defaultMaxTokens: config.defaultMaxTokens ?? DEFAULT_OPENAI_CONFIG.defaultMaxTokens!,
    debug: config.debug ?? DEFAULT_OPENAI_CONFIG.debug!,
    organizationId: config.organizationId,
    additionalHeaders: config.additionalHeaders,
  };
}

/**
 * Gets model information
 *
 * @param model - Model name to look up
 * @returns Model information or undefined if not found
 */
export function getModelInfo(model: string): OpenAIModelInfo | undefined {
  return OPENAI_MODEL_INFO[model];
}

/**
 * Checks if a model supports vision capabilities
 *
 * @param model - Model name to check
 * @returns True if the model supports vision
 */
export function supportsVision(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsVision ?? false;
}

/**
 * Checks if a model supports function calling
 *
 * @param model - Model name to check
 * @returns True if the model supports function calling
 */
export function supportsFunctionCalling(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsFunctionCalling ?? true; // Most modern models support it
}

/**
 * Checks if a model supports streaming
 *
 * @param model - Model name to check
 * @returns True if the model supports streaming
 */
export function supportsStreaming(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsStreaming ?? true; // Most models support streaming
}

/**
 * Gets the maximum tokens allowed for a model
 *
 * @param model - Model name to check
 * @returns Maximum tokens or undefined if unknown
 */
export function getMaxTokens(model: string): number | undefined {
  const info = getModelInfo(model);
  return info?.maxTokens;
}
