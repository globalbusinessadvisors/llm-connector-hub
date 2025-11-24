/**
 * Config command - Manage CLI configuration
 */

import { Command } from 'commander';
import { loadConfig, saveConfig } from '../utils';

export const configCommand = new Command('config')
  .description('Manage CLI configuration');

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    console.log(JSON.stringify(config, null, 2));
  });

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key (e.g., providers.anthropic.apiKey)')
  .argument('<value>', 'Configuration value')
  .action((key: string, value: string) => {
    const config = loadConfig();

    // Parse nested key
    const keys = key.split('.');
    let current: any = config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (k && !(k in current)) {
        current[k] = {};
      }
      if (k) {
        current = current[k];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }

    saveConfig(config);
    console.log(`Set ${key} = ${value}`);
  });

configCommand
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key (e.g., providers.anthropic.apiKey)')
  .action((key: string) => {
    const config = loadConfig();

    // Parse nested key
    const keys = key.split('.');
    let current: any = config;

    for (const k of keys) {
      if (!k || !(k in current)) {
        console.log('undefined');
        return;
      }
      current = current[k];
    }

    console.log(current);
  });

configCommand
  .command('init')
  .description('Initialize configuration interactively')
  .action(async () => {
    const inquirer = (await import('inquirer')).default;

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'anthropic_key',
        message: 'Anthropic API Key (optional):',
      },
      {
        type: 'input',
        name: 'google_key',
        message: 'Google AI API Key (optional):',
      },
      {
        type: 'list',
        name: 'default_provider',
        message: 'Default provider:',
        choices: ['anthropic', 'google'],
        default: 'anthropic',
      },
      {
        type: 'number',
        name: 'temperature',
        message: 'Default temperature (0-2):',
        default: 0.7,
      },
      {
        type: 'number',
        name: 'max_tokens',
        message: 'Default max tokens:',
        default: 1000,
      },
    ]);

    const config = {
      defaultProvider: answers.default_provider,
      providers: {
        anthropic: answers.anthropic_key ? { apiKey: answers.anthropic_key } : undefined,
        google: answers.google_key ? { apiKey: answers.google_key } : undefined,
      },
      defaults: {
        temperature: answers.temperature,
        maxTokens: answers.max_tokens,
      },
    };

    saveConfig(config);
    console.log('\nConfiguration saved successfully!');
  });
