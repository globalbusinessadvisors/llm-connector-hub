#!/usr/bin/env node

/**
 * Main CLI entry point
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import { completeCommand } from './commands/complete';
import { chatCommand } from './commands/chat';
import { configCommand } from './commands/config';
import { providersCommand } from './commands/providers';

// Load environment variables
config();

const program = new Command();

program
  .name('llm-hub')
  .description('LLM Connector Hub - Unified CLI for multiple LLM providers')
  .version('0.1.0');

// Register commands
program.addCommand(completeCommand);
program.addCommand(chatCommand);
program.addCommand(configCommand);
program.addCommand(providersCommand);

// Parse arguments
program.parse(process.argv);
