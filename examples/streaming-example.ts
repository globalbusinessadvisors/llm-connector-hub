/**
 * Streaming example for LLM Connector Hub
 */

import { CompletionRequestBuilder } from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';

async function main(): Promise<void> {
  // Create provider and hub
  const provider = new OpenAIProvider({
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
  });

  const hub = ConnectorHub.builder().addProvider(provider).build();

  // Build streaming request
  const request = new CompletionRequestBuilder()
    .model('gpt-3.5-turbo')
    .userMessage('Write a short poem about TypeScript.')
    .temperature(0.8)
    .stream(true)
    .build();

  try {
    console.log('Streaming response:');

    // Stream the response
    for await (const chunk of hub.streamComplete('openai', request)) {
      if (chunk.content) {
        process.stdout.write(chunk.content);
      }

      if (chunk.finish_reason) {
        console.log('\n\nFinish reason:', chunk.finish_reason);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
