/**
 * Anthropic Provider Configuration
 *
 * Defines configuration options for the Anthropic (Claude) provider,
 * including API authentication, model settings, and request defaults.
 */

/**
 * Configuration interface for Anthropic provider
 */
export interface AnthropicConfig {
  /**
   * Anthropic API key (required)
   * Get your key from https://console.anthropic.com/
   */
  apiKey: string;

  /**
   * Anthropic API version header
   * @default "2023-06-01"
   */
  apiVersion?: string;

  /**
   * Base URL for Anthropic API
   * @default "https://api.anthropic.com"
   */
  baseUrl?: string;

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
   * Note: Anthropic requires max_tokens, so this provides a default
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
export const DEFAULT_ANTHROPIC_CONFIG: Partial<AnthropicConfig> = {
  apiVersion: '2023-06-01',
  baseUrl: 'https://api.anthropic.com',
  timeout: 60000,
  maxRetries: 3,
  defaultMaxTokens: 1024,
  debug: false,
};

/**
 * Supported Anthropic models
 */
export const ANTHROPIC_MODELS = {
  // Claude 3.5 Sonnet (latest)
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_SONNET_LEGACY: 'claude-3-5-sonnet-20240620',

  // Claude 3 Opus (most capable)
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',

  // Claude 3 Sonnet (balanced)
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',

  // Claude 3 Haiku (fastest)
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',

  // Legacy models
  CLAUDE_2_1: 'claude-2.1',
  CLAUDE_2_0: 'claude-2.0',
  CLAUDE_INSTANT_1_2: 'claude-instant-1.2',
} as const;

/**
 * Type for valid Anthropic model names
 */
export type AnthropicModel = (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS] | string;

/**
 * Model capabilities and limits
 */
export interface AnthropicModelInfo {
  name: string;
  maxTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
}

/**
 * Information about available Anthropic models
 */
export const ANTHROPIC_MODEL_INFO: Record<string, AnthropicModelInfo> = {
  [ANTHROPIC_MODELS.CLAUDE_3_5_SONNET]: {
    name: 'Claude 3.5 Sonnet',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_3_5_SONNET_LEGACY]: {
    name: 'Claude 3.5 Sonnet (Legacy)',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_3_OPUS]: {
    name: 'Claude 3 Opus',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_3_SONNET]: {
    name: 'Claude 3 Sonnet',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_3_HAIKU]: {
    name: 'Claude 3 Haiku',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_2_1]: {
    name: 'Claude 2.1',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_2_0]: {
    name: 'Claude 2.0',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    contextWindow: 100000,
  },
  [ANTHROPIC_MODELS.CLAUDE_INSTANT_1_2]: {
    name: 'Claude Instant 1.2',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    contextWindow: 100000,
  },
};

/**
 * Validation error class for configuration
 */
export class AnthropicConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnthropicConfigError';
  }
}

/**
 * Validates Anthropic configuration
 *
 * @param config - Configuration to validate
 * @throws {AnthropicConfigError} If configuration is invalid
 */
export function validateAnthropicConfig(config: AnthropicConfig): void {
  // API key is required
  if (!config.apiKey) {
    throw new AnthropicConfigError('API key is required');
  }

  if (typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
    throw new AnthropicConfigError('API key must be a non-empty string');
  }

  // Validate timeout if provided
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      throw new AnthropicConfigError('Timeout must be a positive number');
    }
  }

  // Validate maxRetries if provided
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      throw new AnthropicConfigError('Max retries must be a non-negative number');
    }
  }

  // Validate defaultMaxTokens if provided
  if (config.defaultMaxTokens !== undefined) {
    if (typeof config.defaultMaxTokens !== 'number' || config.defaultMaxTokens <= 0) {
      throw new AnthropicConfigError('Default max tokens must be a positive number');
    }
  }

  // Validate baseUrl if provided
  if (config.baseUrl !== undefined) {
    if (typeof config.baseUrl !== 'string' || !config.baseUrl.startsWith('http')) {
      throw new AnthropicConfigError('Base URL must be a valid HTTP(S) URL');
    }
  }

  // Validate apiVersion if provided
  if (config.apiVersion !== undefined) {
    if (typeof config.apiVersion !== 'string' || config.apiVersion.trim().length === 0) {
      throw new AnthropicConfigError('API version must be a non-empty string');
    }
  }
}

/**
 * Merges user config with defaults
 *
 * @param config - User-provided configuration
 * @returns Complete configuration with defaults applied
 */
export function mergeWithDefaults(config: AnthropicConfig): Required<Omit<AnthropicConfig, 'additionalHeaders'>> & { additionalHeaders?: Record<string, string> } {
  return {
    apiKey: config.apiKey,
    apiVersion: config.apiVersion ?? DEFAULT_ANTHROPIC_CONFIG.apiVersion!,
    baseUrl: config.baseUrl ?? DEFAULT_ANTHROPIC_CONFIG.baseUrl!,
    timeout: config.timeout ?? DEFAULT_ANTHROPIC_CONFIG.timeout!,
    maxRetries: config.maxRetries ?? DEFAULT_ANTHROPIC_CONFIG.maxRetries!,
    defaultMaxTokens: config.defaultMaxTokens ?? DEFAULT_ANTHROPIC_CONFIG.defaultMaxTokens!,
    debug: config.debug ?? DEFAULT_ANTHROPIC_CONFIG.debug!,
    additionalHeaders: config.additionalHeaders,
  };
}

/**
 * Gets model information
 *
 * @param model - Model name to look up
 * @returns Model information or undefined if not found
 */
export function getModelInfo(model: string): AnthropicModelInfo | undefined {
  return ANTHROPIC_MODEL_INFO[model];
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
