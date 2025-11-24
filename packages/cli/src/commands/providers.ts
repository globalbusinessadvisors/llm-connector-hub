/**
 * Providers command - List and test providers
 */

import { Command } from 'commander';
import { Anthropic, Google } from '@llm-dev-ops/connector-hub-providers';
import { loadConfig, getProviderApiKey, formatError } from '../utils';

export const providersCommand = new Command('providers')
  .description('Manage LLM providers');

providersCommand
  .command('list')
  .description('List available providers')
  .action(() => {
    console.log('Available providers:');
    console.log('  - anthropic (Anthropic Claude models)');
    console.log('  - google (Google AI / Gemini models)');
    console.log('\nNote: OpenAI provider is not yet implemented.');
  });

providersCommand
  .command('test')
  .description('Test provider connectivity')
  .argument('<provider>', 'Provider to test (anthropic, google)')
  .action(async (provider: string) => {
    try {
      const config = loadConfig();
      const apiKey = getProviderApiKey(provider, config);

      if (!apiKey) {
        console.error(`Error: No API key found for ${provider}`);
        process.exit(1);
      }

      console.log(`Testing ${provider}...`);

      let providerInstance;

      switch (provider) {
        case 'anthropic':
          providerInstance = Anthropic.createAnthropicProvider({ apiKey });
          break;
        case 'google':
          providerInstance = Google.createGoogleProvider({ apiKey });
          break;
        default:
          console.error(`Unknown provider: ${provider}. Only 'anthropic' and 'google' are currently supported.`);
          process.exit(1);
      }

      const health = await providerInstance.healthCheck();

      if (health.healthy) {
        console.log(`✓ ${provider} is healthy (latency: ${health.latency}ms)`);
      } else {
        console.log(`✗ ${provider} is unhealthy: ${health.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', formatError(error));
      process.exit(1);
    }
  });

providersCommand
  .command('models')
  .description('List available models for a provider')
  .argument('<provider>', 'Provider name (anthropic, google)')
  .action((provider: string) => {
    const models: Record<string, string[]> = {
      anthropic: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ],
      google: [
        'gemini-pro',
        'gemini-pro-vision',
      ],
    };

    if (!(provider in models)) {
      console.error(`Unknown provider: ${provider}. Only 'anthropic' and 'google' are currently supported.`);
      process.exit(1);
    }

    console.log(`Available models for ${provider}:`);
    const providerModels = models[provider];
    if (providerModels) {
      providerModels.forEach(model => console.log(`  - ${model}`));
    }
  });
