/**
 * Google AI (Gemini) Provider Configuration
 *
 * Defines configuration options for the Google AI provider,
 * including API authentication, model settings, and request defaults.
 */

/**
 * Configuration interface for Google AI provider
 */
export interface GoogleConfig {
  /**
   * Google AI API key (required)
   * Get your key from https://makersuite.google.com/app/apikey
   */
  apiKey: string;

  /**
   * Base URL for Google AI API
   * @default "https://generativelanguage.googleapis.com/v1beta"
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
   * @default 2048
   */
  defaultMaxTokens?: number;

  /**
   * Default safety settings
   * Controls content filtering for various harm categories
   */
  defaultSafetySettings?: GoogleSafetySetting[];

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
 * Google AI safety setting
 */
export interface GoogleSafetySetting {
  category:
    | 'HARM_CATEGORY_HARASSMENT'
    | 'HARM_CATEGORY_HATE_SPEECH'
    | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
    | 'HARM_CATEGORY_DANGEROUS_CONTENT';
  threshold:
    | 'BLOCK_NONE'
    | 'BLOCK_ONLY_HIGH'
    | 'BLOCK_MEDIUM_AND_ABOVE'
    | 'BLOCK_LOW_AND_ABOVE';
}

/**
 * Default configuration values
 */
export const DEFAULT_GOOGLE_CONFIG: Partial<GoogleConfig> = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  timeout: 60000,
  maxRetries: 3,
  defaultMaxTokens: 2048,
  debug: false,
};

/**
 * Default safety settings (permissive)
 */
export const DEFAULT_SAFETY_SETTINGS: GoogleSafetySetting[] = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

/**
 * Supported Google AI models
 */
export const GOOGLE_MODELS = {
  // Gemini 1.5 Pro (latest, most capable)
  GEMINI_1_5_PRO_LATEST: 'gemini-1.5-pro-latest',
  GEMINI_1_5_PRO: 'gemini-1.5-pro',
  GEMINI_1_5_PRO_001: 'gemini-1.5-pro-001',
  GEMINI_1_5_PRO_002: 'gemini-1.5-pro-002',

  // Gemini 1.5 Flash (faster, cost-effective)
  GEMINI_1_5_FLASH_LATEST: 'gemini-1.5-flash-latest',
  GEMINI_1_5_FLASH: 'gemini-1.5-flash',
  GEMINI_1_5_FLASH_001: 'gemini-1.5-flash-001',
  GEMINI_1_5_FLASH_002: 'gemini-1.5-flash-002',

  // Gemini 1.0 Pro (legacy)
  GEMINI_PRO: 'gemini-pro',
  GEMINI_PRO_VISION: 'gemini-pro-vision',

  // Gemini Ultra (experimental)
  GEMINI_ULTRA: 'gemini-ultra',
} as const;

/**
 * Type for valid Google AI model names
 */
export type GoogleModel = (typeof GOOGLE_MODELS)[keyof typeof GOOGLE_MODELS] | string;

/**
 * Model capabilities and limits
 */
export interface GoogleModelInfo {
  name: string;
  maxTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
  supportsTools: boolean;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
}

/**
 * Information about available Google AI models
 */
export const GOOGLE_MODEL_INFO: Record<string, GoogleModelInfo> = {
  [GOOGLE_MODELS.GEMINI_1_5_PRO_LATEST]: {
    name: 'Gemini 1.5 Pro (Latest)',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 2097152, // 2M tokens
    supportsTools: true,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
  },
  [GOOGLE_MODELS.GEMINI_1_5_PRO]: {
    name: 'Gemini 1.5 Pro',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 2097152,
    supportsTools: true,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
  },
  [GOOGLE_MODELS.GEMINI_1_5_FLASH_LATEST]: {
    name: 'Gemini 1.5 Flash (Latest)',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 1048576, // 1M tokens
    supportsTools: true,
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
  },
  [GOOGLE_MODELS.GEMINI_1_5_FLASH]: {
    name: 'Gemini 1.5 Flash',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    supportsTools: true,
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
  },
  [GOOGLE_MODELS.GEMINI_PRO]: {
    name: 'Gemini Pro',
    maxTokens: 8192,
    supportsVision: false,
    supportsStreaming: true,
    contextWindow: 32760,
    supportsTools: true,
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
  },
  [GOOGLE_MODELS.GEMINI_PRO_VISION]: {
    name: 'Gemini Pro Vision',
    maxTokens: 4096,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 16384,
    supportsTools: false,
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
  },
  [GOOGLE_MODELS.GEMINI_ULTRA]: {
    name: 'Gemini Ultra',
    maxTokens: 8192,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 32760,
    supportsTools: true,
  },
};

/**
 * Validation error class for configuration
 */
export class GoogleConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleConfigError';
  }
}

/**
 * Validates Google AI configuration
 *
 * @param config - Configuration to validate
 * @throws {GoogleConfigError} If configuration is invalid
 */
export function validateGoogleConfig(config: GoogleConfig): void {
  // API key is required
  if (!config.apiKey) {
    throw new GoogleConfigError('API key is required');
  }

  if (typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
    throw new GoogleConfigError('API key must be a non-empty string');
  }

  // Validate timeout if provided
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      throw new GoogleConfigError('Timeout must be a positive number');
    }
  }

  // Validate maxRetries if provided
  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      throw new GoogleConfigError('Max retries must be a non-negative number');
    }
  }

  // Validate defaultMaxTokens if provided
  if (config.defaultMaxTokens !== undefined) {
    if (typeof config.defaultMaxTokens !== 'number' || config.defaultMaxTokens <= 0) {
      throw new GoogleConfigError('Default max tokens must be a positive number');
    }
  }

  // Validate baseUrl if provided
  if (config.baseUrl !== undefined) {
    if (typeof config.baseUrl !== 'string' || !config.baseUrl.startsWith('http')) {
      throw new GoogleConfigError('Base URL must be a valid HTTP(S) URL');
    }
  }

  // Validate safety settings if provided
  if (config.defaultSafetySettings !== undefined) {
    if (!Array.isArray(config.defaultSafetySettings)) {
      throw new GoogleConfigError('Safety settings must be an array');
    }

    for (const setting of config.defaultSafetySettings) {
      if (!setting.category || !setting.threshold) {
        throw new GoogleConfigError('Each safety setting must have category and threshold');
      }
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
  config: GoogleConfig
): Required<Omit<GoogleConfig, 'additionalHeaders' | 'defaultSafetySettings'>> & {
  additionalHeaders?: Record<string, string>;
  defaultSafetySettings: GoogleSafetySetting[];
} {
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? DEFAULT_GOOGLE_CONFIG.baseUrl!,
    timeout: config.timeout ?? DEFAULT_GOOGLE_CONFIG.timeout!,
    maxRetries: config.maxRetries ?? DEFAULT_GOOGLE_CONFIG.maxRetries!,
    defaultMaxTokens: config.defaultMaxTokens ?? DEFAULT_GOOGLE_CONFIG.defaultMaxTokens!,
    debug: config.debug ?? DEFAULT_GOOGLE_CONFIG.debug!,
    defaultSafetySettings: config.defaultSafetySettings ?? DEFAULT_SAFETY_SETTINGS,
    additionalHeaders: config.additionalHeaders,
  };
}

/**
 * Gets model information
 *
 * @param model - Model name to look up
 * @returns Model information or undefined if not found
 */
export function getModelInfo(model: string): GoogleModelInfo | undefined {
  return GOOGLE_MODEL_INFO[model];
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
 * Checks if a model supports function/tool calling
 *
 * @param model - Model name to check
 * @returns True if the model supports tools
 */
export function supportsTools(model: string): boolean {
  const info = getModelInfo(model);
  return info?.supportsTools ?? false;
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

/**
 * Gets the context window size for a model
 *
 * @param model - Model name to check
 * @returns Context window size or undefined if unknown
 */
export function getContextWindow(model: string): number | undefined {
  const info = getModelInfo(model);
  return info?.contextWindow;
}
