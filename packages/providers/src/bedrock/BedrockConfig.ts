/**
 * AWS Bedrock Provider Configuration
 *
 * Defines configuration options for the AWS Bedrock provider,
 * including AWS credentials, region settings, and model ARN validation.
 */

/**
 * Configuration interface for AWS Bedrock provider
 */
export interface BedrockConfig {
  /**
   * AWS Access Key ID (required unless using environment credentials)
   */
  accessKeyId?: string;

  /**
   * AWS Secret Access Key (required unless using environment credentials)
   */
  secretAccessKey?: string;

  /**
   * AWS Session Token (optional, for temporary credentials)
   */
  sessionToken?: string;

  /**
   * AWS Region (required)
   * @default "us-east-1"
   */
  region: string;

  /**
   * Request timeout in milliseconds
   * @default 120000 (120 seconds)
   */
  timeout?: number;

  /**
   * Maximum retries for failed requests
   * @default 3
   */
  maxRetries?: number;

  /**
   * Default max tokens if not specified in request
   * @default 2048
   */
  defaultMaxTokens?: number;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_BEDROCK_CONFIG: Partial<BedrockConfig> = {
  region: 'us-east-1',
  timeout: 120000, // Bedrock can be slower than other providers
  maxRetries: 3,
  defaultMaxTokens: 2048,
  debug: false,
};

/**
 * Supported AWS Bedrock models
 */
export const BEDROCK_MODELS = {
  // Claude 3.5 Sonnet (latest Anthropic model on Bedrock)
  CLAUDE_3_5_SONNET_V2: 'anthropic.claude-3-5-sonnet-20241022-v2:0',

  // Claude 3 Opus (most capable)
  CLAUDE_3_OPUS: 'anthropic.claude-3-opus-20240229-v1:0',

  // Claude 3 Sonnet
  CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',

  // Claude 3 Haiku (fastest)
  CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',

  // Llama 3.3 70B Instruct
  LLAMA_3_3_70B: 'meta.llama3-3-70b-instruct-v1:0',

  // Llama 3.1 405B Instruct
  LLAMA_3_1_405B: 'meta.llama3-1-405b-instruct-v1:0',

  // Llama 3.1 70B Instruct
  LLAMA_3_1_70B: 'meta.llama3-1-70b-instruct-v1:0',

  // Llama 3.1 8B Instruct
  LLAMA_3_1_8B: 'meta.llama3-1-8b-instruct-v1:0',

  // Mistral Large 2
  MISTRAL_LARGE_2: 'mistral.mistral-large-2407-v1:0',

  // Mistral Small
  MISTRAL_SMALL: 'mistral.mistral-small-2402-v1:0',
} as const;

/**
 * Type for valid Bedrock model names
 */
export type BedrockModel = (typeof BEDROCK_MODELS)[keyof typeof BEDROCK_MODELS] | string;

/**
 * Model provider types
 */
export type ModelProvider = 'anthropic' | 'meta' | 'mistral' | 'amazon' | 'cohere' | 'ai21';

/**
 * Model capabilities and limits
 */
export interface BedrockModelInfo {
  name: string;
  provider: ModelProvider;
  maxTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  contextWindow: number;
}

/**
 * Information about available Bedrock models
 */
export const BEDROCK_MODEL_INFO: Record<string, BedrockModelInfo> = {
  [BEDROCK_MODELS.CLAUDE_3_5_SONNET_V2]: {
    name: 'Claude 3.5 Sonnet v2',
    provider: 'anthropic',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 200000,
  },
  [BEDROCK_MODELS.CLAUDE_3_OPUS]: {
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 200000,
  },
  [BEDROCK_MODELS.CLAUDE_3_SONNET]: {
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 200000,
  },
  [BEDROCK_MODELS.CLAUDE_3_HAIKU]: {
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 200000,
  },
  [BEDROCK_MODELS.LLAMA_3_3_70B]: {
    name: 'Llama 3.3 70B Instruct',
    provider: 'meta',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [BEDROCK_MODELS.LLAMA_3_1_405B]: {
    name: 'Llama 3.1 405B Instruct',
    provider: 'meta',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [BEDROCK_MODELS.LLAMA_3_1_70B]: {
    name: 'Llama 3.1 70B Instruct',
    provider: 'meta',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [BEDROCK_MODELS.LLAMA_3_1_8B]: {
    name: 'Llama 3.1 8B Instruct',
    provider: 'meta',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [BEDROCK_MODELS.MISTRAL_LARGE_2]: {
    name: 'Mistral Large 2',
    provider: 'mistral',
    maxTokens: 8191,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [BEDROCK_MODELS.MISTRAL_SMALL]: {
    name: 'Mistral Small',
    provider: 'mistral',
    maxTokens: 8191,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: false,
    contextWindow: 32000,
  },
};

/**
 * Validation error class for configuration
 */
export class BedrockConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BedrockConfigError';
  }
}

/**
 * Validates Bedrock configuration
 *
 * @param config - Configuration to validate
 * @throws {BedrockConfigError} If configuration is invalid
 */
export function validateBedrockConfig(config: BedrockConfig): void {
  // Region is required
  if (!config.region) {
    throw new BedrockConfigError('AWS region is required');
  }

  if (typeof config.region !== 'string' || config.region.trim().length === 0) {
    throw new BedrockConfigError('AWS region must be a non-empty string');
  }

  // If credentials are provided, both access key and secret key must be present
  if (config.accessKeyId || config.secretAccessKey) {
    if (!config.accessKeyId) {
      throw new BedrockConfigError('AWS access key ID is required when using credentials');
    }

    if (!config.secretAccessKey) {
      throw new BedrockConfigError('AWS secret access key is required when using credentials');
    }

    if (typeof config.accessKeyId !== 'string' || config.accessKeyId.trim().length === 0) {
      throw new BedrockConfigError('AWS access key ID must be a non-empty string');
    }

    if (typeof config.secretAccessKey !== 'string' || config.secretAccessKey.trim().length === 0) {
      throw new BedrockConfigError('AWS secret access key must be a non-empty string');
    }
  }

  // Validate timeout if provided
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      throw new BedrockConfigError('Timeout must be a positive number');
    }
  }

  // Validate maxRetries if provided
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      throw new BedrockConfigError('Max retries must be a non-negative number');
    }
  }

  // Validate defaultMaxTokens if provided
  if (config.defaultMaxTokens !== undefined) {
    if (typeof config.defaultMaxTokens !== 'number' || config.defaultMaxTokens <= 0) {
      throw new BedrockConfigError('Default max tokens must be a positive number');
    }
  }
}

/**
 * Merges user config with defaults
 *
 * @param config - User-provided configuration
 * @returns Complete configuration with defaults applied
 */
export function mergeWithDefaults(config: BedrockConfig): Required<BedrockConfig> {
  return {
    accessKeyId: config.accessKeyId ?? '',
    secretAccessKey: config.secretAccessKey ?? '',
    sessionToken: config.sessionToken ?? '',
    region: config.region,
    timeout: config.timeout ?? DEFAULT_BEDROCK_CONFIG.timeout!,
    maxRetries: config.maxRetries ?? DEFAULT_BEDROCK_CONFIG.maxRetries!,
    defaultMaxTokens: config.defaultMaxTokens ?? DEFAULT_BEDROCK_CONFIG.defaultMaxTokens!,
    debug: config.debug ?? DEFAULT_BEDROCK_CONFIG.debug!,
  };
}

/**
 * Gets model information
 *
 * @param model - Model ARN to look up
 * @returns Model information or undefined if not found
 */
export function getModelInfo(model: string): BedrockModelInfo | undefined {
  return BEDROCK_MODEL_INFO[model];
}

/**
 * Extracts the provider from a model ARN
 *
 * @param model - Model ARN (e.g., "anthropic.claude-3-5-sonnet-20241022-v2:0")
 * @returns Provider name
 */
export function getModelProvider(model: string): ModelProvider | undefined {
  const info = getModelInfo(model);
  if (info) {
    return info.provider;
  }

  // Try to extract from model ARN
  const parts = model.split('.');
  if (parts.length > 0) {
    const provider = parts[0];
    if (provider && ['anthropic', 'meta', 'mistral', 'amazon', 'cohere', 'ai21'].includes(provider)) {
      return provider as ModelProvider;
    }
  }

  return undefined;
}

/**
 * Checks if a model supports vision capabilities
 *
 * @param model - Model ARN to check
 * @returns True if the model supports vision
 */
export function supportsVision(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsVision ?? false;
}

/**
 * Checks if a model supports streaming
 *
 * @param model - Model ARN to check
 * @returns True if the model supports streaming
 */
export function supportsStreaming(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsStreaming ?? true;
}

/**
 * Checks if a model supports function calling
 *
 * @param model - Model ARN to check
 * @returns True if the model supports function calling
 */
export function supportsFunctionCalling(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsFunctionCalling ?? false;
}

/**
 * Gets the maximum tokens allowed for a model
 *
 * @param model - Model ARN to check
 * @returns Maximum tokens or undefined if unknown
 */
export function getMaxTokens(model: string): number | undefined {
  const info = getModelInfo(model);
  return info?.maxTokens;
}

/**
 * Validates that a model ARN is in the correct format
 *
 * @param model - Model ARN to validate
 * @returns True if valid
 */
export function isValidModelArn(model: string): boolean {
  // Bedrock model ARNs follow the pattern: provider.model-name-version:qualifier
  // Example: anthropic.claude-3-5-sonnet-20241022-v2:0
  const arnPattern = /^[a-z0-9]+\.[a-z0-9\-\.]+:[0-9]+$/i;
  return arnPattern.test(model);
}
