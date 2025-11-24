/**
 * Streaming Completion Example
 *
 * This example demonstrates how to use streaming completions:
 * - Setup streaming with OpenAI
 * - Display chunks as they arrive in real-time
 * - Handle stream errors gracefully
 * - Combine chunks into final text
 * - Show progress and timing information
 *
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - Install dependencies: npm install
 * - Build packages: npm run build
 */

import { CompletionRequestBuilder, StreamChunk } from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import { OpenAIProvider } from '@llm-connector-hub/providers';

/**
 * Main streaming example
 */
async function main(): Promise<void> {
  console.log('=== Streaming Completion Example ===\n');

  // Check for API key
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Set it with: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  try {
    // Initialize provider and hub
    console.log('Initializing ConnectorHub...');
    const provider = new OpenAIProvider({
      apiKey,
      timeout: 60000, // Longer timeout for streaming
    });

    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .build();
    console.log('✓ Hub initialized\n');

    // Build a streaming request
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .systemMessage('You are a creative writer who writes engaging short stories.')
      .userMessage('Write a short story (3-4 paragraphs) about a time traveler who accidentally changes history.')
      .temperature(0.8) // Higher temperature for more creative output
      .maxTokens(500)
      .stream(true) // Enable streaming
      .build();

    console.log('Starting stream...\n');
    console.log('=== Story ===\n');

    // Variables to track streaming progress
    let fullText = '';
    let chunkCount = 0;
    const startTime = Date.now();
    let firstChunkTime: number | null = null;

    // Stream the response
    try {
      for await (const chunk of hub.streamComplete('openai', request)) {
        chunkCount++;

        // Record time to first chunk
        if (firstChunkTime === null) {
          firstChunkTime = Date.now();
        }

        // Display content as it arrives
        if (chunk.content) {
          process.stdout.write(chunk.content);
          fullText += chunk.content;
        }

        // Handle finish reason
        if (chunk.finish_reason) {
          const totalTime = Date.now() - startTime;
          const timeToFirstChunk = firstChunkTime - startTime;

          console.log('\n\n=== Stream Complete ===');
          console.log(`Finish reason: ${chunk.finish_reason}`);
          console.log(`Total chunks: ${chunkCount}`);
          console.log(`Time to first chunk: ${timeToFirstChunk}ms`);
          console.log(`Total time: ${totalTime}ms`);
          console.log(`Total characters: ${fullText.length}`);
        }
      }
    } catch (streamError) {
      // Handle errors during streaming
      console.error('\n\n=== Stream Error ===');
      if (streamError instanceof Error) {
        console.error(`Error: ${streamError.message}`);

        if (streamError.message.includes('aborted')) {
          console.error('Tip: Stream was aborted. This might be due to network issues.');
        } else if (streamError.message.includes('timeout')) {
          console.error('Tip: Stream timed out. Try increasing the timeout value.');
        }
      } else {
        console.error('Unknown stream error:', streamError);
      }

      // Show partial content if available
      if (fullText.length > 0) {
        console.log('\n=== Partial Content Received ===');
        console.log(fullText);
      }

      throw streamError;
    }

    // Save the full text for later use
    console.log('\n=== Full Text ===');
    console.log(`Length: ${fullText.length} characters`);
    console.log(`Word count: ~${fullText.split(/\s+/).length} words`);

  } catch (error) {
    console.error('\n=== Error ===');
    if (error instanceof Error) {
      console.error(`${error.name}: ${error.message}`);
    } else {
      console.error('Unknown error:', error);
    }
    process.exit(1);
  }
}

/**
 * Example: Stream with progress indicator
 */
async function streamWithProgress(): Promise<void> {
  console.log('\n\n=== Streaming with Progress Indicator ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder().addProvider(provider).build();

    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .userMessage('List 10 interesting facts about space exploration.')
      .temperature(0.7)
      .maxTokens(400)
      .stream(true)
      .build();

    console.log('Generating response');

    let fullText = '';
    let dotCount = 0;

    for await (const chunk of hub.streamComplete('openai', request)) {
      if (chunk.content) {
        fullText += chunk.content;

        // Show progress dots every 10 characters
        if (fullText.length % 10 === 0 && dotCount < 50) {
          process.stdout.write('.');
          dotCount++;
        }
      }

      if (chunk.finish_reason) {
        console.log(' Done!\n');
        console.log('=== Response ===');
        console.log(fullText);
      }
    }
  } catch (error) {
    console.error('\nError in progress example:', error);
  }
}

/**
 * Example: Streaming multiple requests in sequence
 */
async function sequentialStreaming(): Promise<void> {
  console.log('\n\n=== Sequential Streaming Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder().addProvider(provider).build();

    const questions = [
      'What is TypeScript?',
      'What are the benefits of using TypeScript?',
      'How does TypeScript differ from JavaScript?',
    ];

    for (let i = 0; i < questions.length; i++) {
      console.log(`\nQuestion ${i + 1}: ${questions[i]}`);
      console.log('Answer: ');

      const request = new CompletionRequestBuilder()
        .model('gpt-3.5-turbo')
        .userMessage(questions[i])
        .temperature(0.3)
        .maxTokens(150)
        .stream(true)
        .build();

      let answer = '';
      for await (const chunk of hub.streamComplete('openai', request)) {
        if (chunk.content) {
          process.stdout.write(chunk.content);
          answer += chunk.content;
        }
      }

      console.log('\n' + '-'.repeat(80));
    }
  } catch (error) {
    console.error('\nError in sequential streaming:', error);
  }
}

/**
 * Example: Collecting chunks with metadata
 */
async function streamWithMetadata(): Promise<void> {
  console.log('\n\n=== Streaming with Metadata Collection ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder().addProvider(provider).build();

    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .userMessage('Explain quantum entanglement in simple terms.')
      .temperature(0.7)
      .maxTokens(200)
      .stream(true)
      .build();

    const chunks: StreamChunk[] = [];
    let fullText = '';

    console.log('Streaming and collecting metadata...\n');

    for await (const chunk of hub.streamComplete('openai', request)) {
      chunks.push(chunk);

      if (chunk.content) {
        process.stdout.write(chunk.content);
        fullText += chunk.content;
      }
    }

    console.log('\n\n=== Metadata ===');
    console.log(`Total chunks received: ${chunks.length}`);
    console.log(`Chunks with content: ${chunks.filter((c) => c.content).length}`);
    console.log(`Final chunk finish reason: ${chunks[chunks.length - 1]?.finish_reason || 'none'}`);
    console.log(`Average chunk size: ${(fullText.length / chunks.filter((c) => c.content).length).toFixed(2)} chars`);

  } catch (error) {
    console.error('\nError in metadata example:', error);
  }
}

// Entry point
if (require.main === module) {
  main()
    .then(() => streamWithProgress())
    .then(() => sequentialStreaming())
    .then(() => streamWithMetadata())
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { main, streamWithProgress, sequentialStreaming, streamWithMetadata };
