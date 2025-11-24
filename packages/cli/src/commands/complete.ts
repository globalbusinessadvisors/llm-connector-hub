/**
 * Complete command - Single completion request
 */

import { Command } from 'commander';
import { Anthropic, Google } from '@llm-dev-ops/connector-hub-providers';
import { loadConfig, getProviderApiKey, formatError } from '../utils';

export const completeCommand = new Command('complete')
  .description('Get a single completion from an LLM provider')
  .argument('<prompt>', 'The prompt to send to the LLM')
  .option('-p, --provider <provider>', 'LLM provider (anthropic, google)', 'anthropic')
  .option('-m, --model <model>', 'Model to use')
  .option('-t, --temperature <number>', 'Temperature (0-2)', parseFloat)
  .option('--max-tokens <number>', 'Maximum tokens to generate', parseInt)
  .option('--stream', 'Stream the response')
  .option('--json', 'Output as JSON')
  .action(async (prompt: string, options) => {
    try {
      const config = loadConfig();
      const provider = options.provider;
      const apiKey = getProviderApiKey(provider, config);

      if (!apiKey) {
        console.error(`Error: No API key found for ${provider}. Set it in config or environment variable.`);
        process.exit(1);
      }

      // Create provider
      let providerInstance;
      let defaultModel = '';

      switch (provider) {
        case 'anthropic':
          providerInstance = Anthropic.createAnthropicProvider({ apiKey });
          defaultModel = 'claude-3-opus-20240229';
          break;
        case 'google':
          providerInstance = Google.createGoogleProvider({ apiKey });
          defaultModel = 'gemini-pro';
          break;
        default:
          console.error(`Unknown provider: ${provider}. Only 'anthropic' and 'google' are currently supported.`);
          process.exit(1);
      }

      const model = options.model || defaultModel;
      const temperature = options.temperature ?? config.defaults?.temperature ?? 0.7;
      const maxTokens = options.maxTokens ?? config.defaults?.maxTokens ?? 1000;

      // Initialize provider
      await providerInstance.initialize();

      // Build request
      const request = {
        model,
        messages: [{ role: 'user' as const, content: prompt }],
        temperature,
        max_tokens: maxTokens,
      };

      if (options.stream) {
        // Streaming response
        process.stdout.write('');
        for await (const chunk of providerInstance.stream(request)) {
          if (chunk.content) {
            process.stdout.write(chunk.content);
          }
        }
        process.stdout.write('\n');
      } else {
        // Non-streaming response
        const response = await providerInstance.complete(request);

        if (options.json) {
          console.log(JSON.stringify(response, null, 2));
        } else {
          console.log(response.message.content);
          console.log(`\n[Tokens: ${response.usage.total_tokens}, Model: ${response.metadata.model}]`);
        }
      }

      await providerInstance.shutdown();
    } catch (error) {
      console.error('Error:', formatError(error));
      process.exit(1);
    }
  });
