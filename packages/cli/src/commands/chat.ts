/**
 * Chat command - Interactive chat session
 */

import { Command } from 'commander';
import * as readline from 'readline';
import { Anthropic, Google } from '@llm-dev-ops/connector-hub-providers';
import type { Message } from '@llm-dev-ops/connector-hub-core';
import { loadConfig, getProviderApiKey, formatError } from '../utils';

export const chatCommand = new Command('chat')
  .description('Start an interactive chat session')
  .option('-p, --provider <provider>', 'LLM provider (anthropic, google)', 'anthropic')
  .option('-m, --model <model>', 'Model to use')
  .option('-t, --temperature <number>', 'Temperature (0-2)', parseFloat, 0.7)
  .option('--max-tokens <number>', 'Maximum tokens to generate', parseInt, 1000)
  .option('--system <message>', 'System message')
  .action(async (options) => {
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

      // Initialize provider
      await providerInstance.initialize();

      console.log(`\nLLM Connector Hub - Chat Mode`);
      console.log(`Provider: ${provider}, Model: ${model}`);
      console.log(`Type 'exit' or 'quit' to end the session.\n`);

      // Conversation history
      const messages: Message[] = [];

      // Add system message if provided
      if (options.system) {
        messages.push({ role: 'system', content: options.system });
      }

      // Create readline interface
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'You: ',
      });

      rl.prompt();

      rl.on('line', async (input: string) => {
        const userInput = input.trim();

        if (userInput === 'exit' || userInput === 'quit') {
          await providerInstance.shutdown();
          rl.close();
          return;
        }

        if (!userInput) {
          rl.prompt();
          return;
        }

        // Add user message
        messages.push({ role: 'user', content: userInput });

        try {
          // Get completion
          const request = {
            model,
            messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens,
          };

          process.stdout.write('Assistant: ');

          // Stream response
          let assistantMessage = '';
          for await (const chunk of providerInstance.stream(request)) {
            if (chunk.content) {
              process.stdout.write(chunk.content);
              assistantMessage += chunk.content;
            }
          }

          console.log('\n');

          // Add assistant message to history
          messages.push({ role: 'assistant', content: assistantMessage });
        } catch (error) {
          console.error('\nError:', formatError(error), '\n');
        }

        rl.prompt();
      });

      rl.on('close', () => {
        console.log('\nGoodbye!');
        process.exit(0);
      });
    } catch (error) {
      console.error('Error:', formatError(error));
      process.exit(1);
    }
  });
