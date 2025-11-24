/**
 * Simple usage example for LLM Connector Hub
 */

import { CompletionRequestBuilder } from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import { LoggingMiddleware, MetricsMiddleware } from '@llm-connector-hub/middleware';
import { OpenAIProvider } from '@llm-connector-hub/providers';

async function main(): Promise<void> {
  // Create OpenAI provider
  const openaiProvider = new OpenAIProvider({
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
    timeout: 30000,
  });

  // Create hub with middleware
  const hub = ConnectorHub.builder()
    .addProvider(openaiProvider)
    .addMiddleware(new LoggingMiddleware())
    .addMiddleware(new MetricsMiddleware())
    .build();

  // Build a completion request
  const request = new CompletionRequestBuilder()
    .model('gpt-3.5-turbo')
    .systemMessage('You are a helpful assistant.')
    .userMessage('Explain quantum computing in simple terms.')
    .temperature(0.7)
    .maxTokens(500)
    .build();

  try {
    // Send request
    const response = await hub.complete('openai', request);

    console.log('Response:', response.message.content);
    console.log('Tokens used:', response.usage.total_tokens);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}
