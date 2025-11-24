/**
 * Azure OpenAI Provider Configuration
 *
 * Defines configuration options for the Azure OpenAI provider,
 * including authentication, deployment settings, and request defaults.
 */

/**
 * Configuration interface for Azure OpenAI provider
 */
export interface AzureConfig {
  /**
   * Azure OpenAI API key (required)
   * Get your key from Azure Portal
   */
  apiKey: string;

  /**
   * Azure OpenAI resource name (required)
   * Example: 'my-resource' for https://my-resource.openai.azure.com
   */
  resourceName?: string;

  /**
   * Full Azure OpenAI endpoint URL (alternative to resourceName)
   * Example: 'https://my-resource.openai.azure.com'
   * If provided, this takes precedence over resourceName
   */
  endpoint?: string;

  /**
   * Azure OpenAI deployment name (required)
   * This is the deployment ID you created in Azure Portal
   */
  deploymentName: string;

  /**
   * Azure OpenAI API version
   * @default "2024-02-15-preview"
   */
  apiVersion?: string;

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
export const DEFAULT_AZURE_CONFIG: Partial<AzureConfig> = {
  apiVersion: '2024-02-15-preview',
  timeout: 60000,
  maxRetries: 3,
  defaultMaxTokens: 1024,
  debug: false,
};

/**
 * Supported Azure OpenAI models
 * Note: Actual model availability depends on your Azure deployment
 */
export const AZURE_MODELS = {
  // GPT-5 series (future support)
  GPT_5: 'gpt-5',
  GPT_5_1: 'gpt-5.1',

  // GPT-4o series
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',
  GPT_4O_2024_11_20: 'gpt-4o-2024-11-20',
  GPT_4O_2024_08_06: 'gpt-4o-2024-08-06',
  GPT_4O_2024_05_13: 'gpt-4o-2024-05-13',
  GPT_4O_MINI_2024_07_18: 'gpt-4o-mini-2024-07-18',

  // GPT-4 Turbo
  GPT_4_TURBO: 'gpt-4-turbo',
  GPT_4_TURBO_2024_04_09: 'gpt-4-turbo-2024-04-09',
  GPT_4_TURBO_PREVIEW: 'gpt-4-turbo-preview',
  GPT_4_0125_PREVIEW: 'gpt-4-0125-preview',
  GPT_4_1106_PREVIEW: 'gpt-4-1106-preview',

  // GPT-4
  GPT_4: 'gpt-4',
  GPT_4_0613: 'gpt-4-0613',
  GPT_4_32K: 'gpt-4-32k',
  GPT_4_32K_0613: 'gpt-4-32k-0613',

  // GPT-3.5 Turbo
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_3_5_TURBO_0125: 'gpt-3.5-turbo-0125',
  GPT_3_5_TURBO_1106: 'gpt-3.5-turbo-1106',
  GPT_3_5_TURBO_16K: 'gpt-3.5-turbo-16k',
  GPT_3_5_TURBO_16K_0613: 'gpt-3.5-turbo-16k-0613',
} as const;

/**
 * Type for valid Azure OpenAI model names
 */
export type AzureModel = (typeof AZURE_MODELS)[keyof typeof AZURE_MODELS] | string;

/**
 * Model capabilities and limits
 */
export interface AzureModelInfo {
  name: string;
  maxTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  contextWindow: number;
}

/**
 * Information about available Azure OpenAI models
 */
export const AZURE_MODEL_INFO: Record<string, AzureModelInfo> = {
  [AZURE_MODELS.GPT_5]: {
    name: 'GPT-5',
    maxTokens: 16384,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 1048576,
  },
  [AZURE_MODELS.GPT_5_1]: {
    name: 'GPT-5.1',
    maxTokens: 16384,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 1048576,
  },
  [AZURE_MODELS.GPT_4O]: {
    name: 'GPT-4o',
    maxTokens: 16384,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [AZURE_MODELS.GPT_4O_MINI]: {
    name: 'GPT-4o Mini',
    maxTokens: 16384,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [AZURE_MODELS.GPT_4_TURBO]: {
    name: 'GPT-4 Turbo',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 128000,
  },
  [AZURE_MODELS.GPT_4]: {
    name: 'GPT-4',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 8192,
  },
  [AZURE_MODELS.GPT_4_32K]: {
    name: 'GPT-4 32K',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 32768,
  },
  [AZURE_MODELS.GPT_3_5_TURBO]: {
    name: 'GPT-3.5 Turbo',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 16385,
  },
  [AZURE_MODELS.GPT_3_5_TURBO_16K]: {
    name: 'GPT-3.5 Turbo 16K',
    maxTokens: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsFunctionCalling: true,
    contextWindow: 16385,
  },
};

/**
 * Validation error class for configuration
 */
export class AzureConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AzureConfigError';
  }
}

/**
 * Validates Azure OpenAI configuration
 *
 * @param config - Configuration to validate
 * @throws {AzureConfigError} If configuration is invalid
 */
export function validateAzureConfig(config: AzureConfig): void {
  // API key is required
  if (!config.apiKey) {
    throw new AzureConfigError('API key is required');
  }

  if (typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
    throw new AzureConfigError('API key must be a non-empty string');
  }

  // Either resourceName or endpoint is required
  if (!config.resourceName && !config.endpoint) {
    throw new AzureConfigError('Either resourceName or endpoint is required');
  }

  // Validate endpoint if provided
  if (config.endpoint !== undefined) {
    if (typeof config.endpoint !== 'string' || !config.endpoint.startsWith('http')) {
      throw new AzureConfigError('Endpoint must be a valid HTTP(S) URL');
    }
  }

  // Validate resourceName if provided
  if (config.resourceName !== undefined) {
    if (typeof config.resourceName !== 'string' || config.resourceName.trim().length === 0) {
      throw new AzureConfigError('Resource name must be a non-empty string');
    }
  }

  // Deployment name is required
  if (!config.deploymentName) {
    throw new AzureConfigError('Deployment name is required');
  }

  if (typeof config.deploymentName !== 'string' || config.deploymentName.trim().length === 0) {
    throw new AzureConfigError('Deployment name must be a non-empty string');
  }

  // Validate timeout if provided
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      throw new AzureConfigError('Timeout must be a positive number');
    }
  }

  // Validate maxRetries if provided
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      throw new AzureConfigError('Max retries must be a non-negative number');
    }
  }

  // Validate defaultMaxTokens if provided
  if (config.defaultMaxTokens !== undefined) {
    if (typeof config.defaultMaxTokens !== 'number' || config.defaultMaxTokens <= 0) {
      throw new AzureConfigError('Default max tokens must be a positive number');
    }
  }

  // Validate apiVersion if provided
  if (config.apiVersion !== undefined) {
    if (typeof config.apiVersion !== 'string' || config.apiVersion.trim().length === 0) {
      throw new AzureConfigError('API version must be a non-empty string');
    }
  }
}

/**
 * Merges user config with defaults
 *
 * @param config - User-provided configuration
 * @returns Complete configuration with defaults applied
 */
export function mergeWithDefaults(
  config: AzureConfig
): Required<Omit<AzureConfig, 'additionalHeaders' | 'resourceName' | 'endpoint'>> & {
  additionalHeaders?: Record<string, string>;
  resourceName?: string;
  endpoint?: string;
} {
  // Build endpoint from resourceName if endpoint not provided
  let finalEndpoint: string | undefined = config.endpoint;
  if (!finalEndpoint && config.resourceName) {
    finalEndpoint = `https://${config.resourceName}.openai.azure.com`;
  }

  return {
    apiKey: config.apiKey,
    deploymentName: config.deploymentName,
    endpoint: finalEndpoint,
    resourceName: config.resourceName,
    apiVersion: config.apiVersion ?? DEFAULT_AZURE_CONFIG.apiVersion!,
    timeout: config.timeout ?? DEFAULT_AZURE_CONFIG.timeout!,
    maxRetries: config.maxRetries ?? DEFAULT_AZURE_CONFIG.maxRetries!,
    defaultMaxTokens: config.defaultMaxTokens ?? DEFAULT_AZURE_CONFIG.defaultMaxTokens!,
    debug: config.debug ?? DEFAULT_AZURE_CONFIG.debug!,
    additionalHeaders: config.additionalHeaders,
  };
}

/**
 * Gets model information
 *
 * @param model - Model name to look up
 * @returns Model information or undefined if not found
 */
export function getModelInfo(model: string): AzureModelInfo | undefined {
  return AZURE_MODEL_INFO[model];
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
  return info?.supportsStreaming ?? true;
}

/**
 * Checks if a model supports function calling
 *
 * @param model - Model name to check
 * @returns True if the model supports function calling
 */
export function supportsFunctionCalling(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsFunctionCalling ?? true;
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
