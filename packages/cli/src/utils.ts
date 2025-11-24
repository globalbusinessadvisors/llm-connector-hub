/**
 * CLI utility functions
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Configuration file path
 */
const CONFIG_DIR = join(homedir(), '.llm-hub');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Default configuration
 */
export interface CLIConfig {
  defaultProvider?: string;
  providers: {
    openai?: {
      apiKey?: string;
      baseUrl?: string;
    };
    anthropic?: {
      apiKey?: string;
      baseUrl?: string;
    };
    google?: {
      apiKey?: string;
      baseUrl?: string;
    };
  };
  defaults?: {
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Load CLI configuration
 */
export function loadConfig(): CLIConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {
      providers: {},
    };
  }

  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load config:', error);
    return {
      providers: {},
    };
  }
}

/**
 * Save CLI configuration
 */
export function saveConfig(config: CLIConfig): void {
  try {
    const { mkdirSync } = require('fs');
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

/**
 * Get provider API key from config or environment
 */
export function getProviderApiKey(provider: string, config: CLIConfig): string | undefined {
  // Check config first
  const providerConfig = config.providers[provider as keyof typeof config.providers];
  if (providerConfig && 'apiKey' in providerConfig && providerConfig.apiKey) {
    return providerConfig.apiKey;
  }

  // Check environment variables
  const envVars: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
  };

  const envVar = envVars[provider];
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }

  return undefined;
}

/**
 * Format error message
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Parse JSON from stdin or file
 */
export async function readInput(source?: string): Promise<string> {
  if (source) {
    // Read from file
    return readFileSync(source, 'utf-8');
  }

  // Read from stdin
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
