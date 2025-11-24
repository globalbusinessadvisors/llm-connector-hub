/**
 * Basic Completion Example
 *
 * This example demonstrates the simplest way to use LLM Connector Hub:
 * - Initialize ConnectorHub with a single provider (OpenAI)
 * - Send a basic completion request
 * - Display the response
 * - Handle errors gracefully
 *
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - Install dependencies: npm install
 * - Build packages: npm run build
 */

import { CompletionRequestBuilder, Message } from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';

/**
 * Main function demonstrating basic completion
 */
async function main(): Promise<void> {
  console.log('=== Basic Completion Example ===\n');

  // Step 1: Check for required API key
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Set it with: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  try {
    // Step 2: Initialize the OpenAI provider
    console.log('Step 1: Initializing OpenAI provider...');
    const openaiProvider = new OpenAIProvider({
      apiKey,
      timeout: 30000, // 30 second timeout
      organization: process.env['OPENAI_ORG_ID'], // Optional
    });
    console.log('✓ Provider initialized\n');

    // Step 3: Create the ConnectorHub with the provider
    console.log('Step 2: Building ConnectorHub...');
    const hub = ConnectorHub.builder()
      .addProvider(openaiProvider)
      .build();
    console.log('✓ Hub created\n');

    // Step 4: Build a completion request using the builder pattern
    console.log('Step 3: Building completion request...');
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo') // Model to use
      .systemMessage('You are a helpful assistant that explains technical concepts clearly and concisely.')
      .userMessage('Explain what an API is in 2-3 sentences.')
      .temperature(0.7) // Controls randomness (0.0 - 2.0)
      .maxTokens(150) // Maximum tokens in response
      .build();
    console.log('✓ Request built\n');

    // Step 5: Send the completion request
    console.log('Step 4: Sending request to OpenAI...');
    const startTime = Date.now();

    const response = await hub.complete('openai', request);

    const duration = Date.now() - startTime;
    console.log(`✓ Response received in ${duration}ms\n`);

    // Step 6: Display the response
    console.log('=== Response ===');
    console.log(response.message.content);
    console.log();

    // Step 7: Display usage information
    console.log('=== Usage Information ===');
    console.log(`Model: ${response.metadata.model}`);
    console.log(`Provider: ${response.metadata.provider}`);
    console.log(`Prompt tokens: ${response.usage.prompt_tokens}`);
    console.log(`Completion tokens: ${response.usage.completion_tokens}`);
    console.log(`Total tokens: ${response.usage.total_tokens}`);
    console.log(`Finish reason: ${response.finish_reason}`);

  } catch (error) {
    // Step 8: Handle errors gracefully
    console.error('\n=== Error ===');

    if (error instanceof Error) {
      console.error(`Error type: ${error.name}`);
      console.error(`Message: ${error.message}`);

      // Handle specific error types
      if (error.message.includes('401') || error.message.includes('authentication')) {
        console.error('\nTip: Check that your OPENAI_API_KEY is valid');
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.error('\nTip: You have hit the rate limit. Wait a moment and try again');
      } else if (error.message.includes('timeout')) {
        console.error('\nTip: Request timed out. Check your internet connection');
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        console.error('\nTip: Network error. Check your internet connection');
      }
    } else {
      console.error('Unknown error:', error);
    }

    process.exit(1);
  }
}

/**
 * Additional example: Using multiple messages for context
 */
async function conversationExample(): Promise<void> {
  console.log('\n\n=== Conversation Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder().addProvider(provider).build();

    // Build a multi-turn conversation
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a helpful math tutor.',
      },
      {
        role: 'user',
        content: 'What is 15 multiplied by 8?',
      },
      {
        role: 'assistant',
        content: '15 multiplied by 8 equals 120.',
      },
      {
        role: 'user',
        content: 'Now divide that by 3.',
      },
    ];

    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .messages(messages)
      .temperature(0) // Use 0 for deterministic responses
      .build();

    console.log('Sending conversation with context...');
    const response = await hub.complete('openai', request);

    console.log('\nAssistant:', response.message.content);

  } catch (error) {
    console.error('Error in conversation example:', error);
  }
}

// Entry point
if (require.main === module) {
  main()
    .then(() => conversationExample())
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { main, conversationExample };
