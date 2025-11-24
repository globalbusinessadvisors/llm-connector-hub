/**
 * Advanced Features Example
 *
 * This example demonstrates advanced features of LLM Connector Hub:
 * - Response caching for performance
 * - Health monitoring and status checks
 * - Custom provider selection strategies
 * - Function calling (tools)
 * - Multimodal requests (text + images)
 * - Advanced configuration options
 *
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - Install dependencies: npm install
 * - Build packages: npm run build
 */

import {
  CompletionRequestBuilder,
  ContentPart,
  FunctionDefinition,
  ToolDefinition,
} from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import { LoggingMiddleware } from '@llm-connector-hub/middleware';
import { OpenAIProvider } from '@llm-connector-hub/providers';

/**
 * Example 1: Response caching
 */
async function cachingExample(): Promise<void> {
  console.log('=== Caching Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Create provider
    const provider = new OpenAIProvider({ apiKey });

    // Create hub with caching enabled
    console.log('Creating hub with caching enabled...');
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .enableCache({
        ttl: 3600, // Cache for 1 hour
        maxSize: 100, // Max 100 entries
      })
      .addMiddleware(new LoggingMiddleware())
      .build();

    console.log('✓ Hub created with cache (TTL: 1 hour, Max: 100 entries)\n');

    // Create a request
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .userMessage('What is the capital of France?')
      .temperature(0) // Use 0 for cacheable deterministic responses
      .maxTokens(50)
      .build();

    // First request - should hit the API
    console.log('First request (will call API)...');
    const start1 = Date.now();
    const response1 = await hub.complete('openai', request);
    const duration1 = Date.now() - start1;

    console.log(`✓ Response: ${response1.message.content}`);
    console.log(`Time: ${duration1}ms\n`);

    // Second request - should use cache
    console.log('Second identical request (should use cache)...');
    const start2 = Date.now();
    const response2 = await hub.complete('openai', request);
    const duration2 = Date.now() - start2;

    console.log(`✓ Response: ${response2.message.content}`);
    console.log(`Time: ${duration2}ms`);
    console.log(`Speed improvement: ${((duration1 / duration2) * 100).toFixed(0)}% faster\n`);

    // Cache stats
    console.log('=== Cache Benefits ===');
    console.log('  ✓ Reduced API calls');
    console.log('  ✓ Lower latency');
    console.log('  ✓ Cost savings');
    console.log('  ✓ Consistent responses');

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 2: Health monitoring
 */
async function healthMonitoringExample(): Promise<void> {
  console.log('\n\n=== Health Monitoring Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Create multiple providers for demonstration
    const provider = new OpenAIProvider({ apiKey });

    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .enableHealthMonitoring({
        checkInterval: 60000, // Check every minute
        failureThreshold: 3, // Mark unhealthy after 3 failures
        successThreshold: 2, // Mark healthy after 2 successes
      })
      .build();

    console.log('Health monitoring configuration:');
    console.log('  - Check interval: 60 seconds');
    console.log('  - Failure threshold: 3');
    console.log('  - Success threshold: 2\n');

    // Perform health check
    console.log('Checking provider health...');
    const healthStatus = await hub.healthCheck();

    console.log('\n=== Provider Health Status ===');
    for (const [provider, isHealthy] of healthStatus) {
      const status = isHealthy ? '✓ HEALTHY' : '✗ UNHEALTHY';
      const color = isHealthy ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${status}\x1b[0m - ${provider}`);
    }

    // Get detailed metrics (if available)
    console.log('\n=== Health Metrics ===');
    console.log('Metrics tracked:');
    console.log('  - Request success rate');
    console.log('  - Average latency');
    console.log('  - Error rates by type');
    console.log('  - Last successful request');
    console.log('  - Consecutive failures');

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 3: Custom provider selection strategy
 */
async function customSelectionExample(): Promise<void> {
  console.log('\n\n=== Custom Provider Selection Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });

    // Custom selection strategies
    console.log('Available selection strategies:\n');

    const strategies = [
      {
        name: 'Cost Optimization',
        description: 'Select cheapest provider for the task',
        implementation: 'Prefer GPT-3.5-turbo over GPT-4',
      },
      {
        name: 'Latency Optimization',
        description: 'Select fastest responding provider',
        implementation: 'Track and prefer providers with lowest P95 latency',
      },
      {
        name: 'Quality Optimization',
        description: 'Select highest quality provider',
        implementation: 'Prefer GPT-4 or Claude for complex tasks',
      },
      {
        name: 'Load Balancing',
        description: 'Distribute requests evenly',
        implementation: 'Round-robin or weighted distribution',
      },
      {
        name: 'Capability Matching',
        description: 'Match provider to task requirements',
        implementation: 'Use vision models for image tasks, etc.',
      },
    ];

    for (const strategy of strategies) {
      console.log(`Strategy: ${strategy.name}`);
      console.log(`  Description: ${strategy.description}`);
      console.log(`  Implementation: ${strategy.implementation}\n`);
    }

    // Example: Cost-optimized selection
    console.log('=== Example: Cost-Optimized Request ===\n');

    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .build();

    // For simple tasks, use cheaper models
    const simpleRequest = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo') // Cheaper model
      .userMessage('What is 5 + 3?')
      .maxTokens(10)
      .build();

    const response = await hub.complete('openai', simpleRequest);
    console.log('Simple task (cheap model):', response.message.content);

    console.log('\nFor complex tasks, you might prefer:');
    console.log('  - GPT-4 for reasoning and analysis');
    console.log('  - Claude for long-context tasks');
    console.log('  - Specialized models for specific domains');

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 4: Function calling
 */
async function functionCallingExample(): Promise<void> {
  console.log('\n\n=== Function Calling Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .build();

    // Define functions that the model can call
    const weatherFunction: FunctionDefinition = {
      name: 'get_weather',
      description: 'Get the current weather in a given location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The temperature unit to use',
          },
        },
        required: ['location'],
      },
    };

    const stockFunction: FunctionDefinition = {
      name: 'get_stock_price',
      description: 'Get the current stock price for a given ticker symbol',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol, e.g. AAPL, GOOGL',
          },
        },
        required: ['symbol'],
      },
    };

    // Create tools from functions
    const tools: ToolDefinition[] = [
      { type: 'function', function: weatherFunction },
      { type: 'function', function: stockFunction },
    ];

    console.log('Defined functions:');
    console.log('  1. get_weather - Get weather information');
    console.log('  2. get_stock_price - Get stock prices\n');

    // Send request with function calling
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .userMessage('What is the weather like in New York and what is Apple stock price?')
      .tools(tools)
      .toolChoice('auto') // Let model decide when to call functions
      .build();

    console.log('Sending request with function calling enabled...\n');

    const response = await hub.complete('openai', request);

    // Check if model wants to call functions
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      console.log('=== Model wants to call functions ===\n');

      for (const toolCall of response.message.tool_calls) {
        console.log(`Function: ${toolCall.function.name}`);
        console.log(`Arguments: ${toolCall.function.arguments}\n`);

        // In a real application, you would:
        // 1. Execute the function with the provided arguments
        // 2. Send the result back to the model
        // 3. Get the final response
      }

      console.log('Next steps:');
      console.log('  1. Execute the requested functions');
      console.log('  2. Send results back to the model');
      console.log('  3. Receive final formatted response');

    } else {
      console.log('Response:', response.message.content);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 5: Multimodal requests (text + images)
 */
async function multimodalExample(): Promise<void> {
  console.log('\n\n=== Multimodal Request Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .build();

    console.log('Multimodal requests combine text and images\n');

    // Example 1: Image URL
    console.log('Example 1: Analyzing an image from URL\n');

    const imageUrlContent: ContentPart[] = [
      {
        type: 'text',
        text: 'What is in this image? Please describe it in detail.',
      },
      {
        type: 'image_url',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg',
        detail: 'high', // Can be 'low', 'high', or 'auto'
      },
    ];

    const imageRequest = new CompletionRequestBuilder()
      .model('gpt-4-vision-preview') // Vision-capable model
      .message({
        role: 'user',
        content: imageUrlContent,
      })
      .maxTokens(500)
      .build();

    console.log('Sending image analysis request...');
    console.log('Note: This requires a vision-capable model like GPT-4 Vision\n');

    // Uncomment to actually send the request
    // const response = await hub.complete('openai', imageRequest);
    // console.log('Analysis:', response.message.content);

    console.log('(Request not sent in demo mode)\n');

    // Example 2: Base64 encoded image
    console.log('Example 2: Using base64 encoded image\n');

    const base64Content: ContentPart[] = [
      {
        type: 'text',
        text: 'Describe this image',
      },
      {
        type: 'image_base64',
        image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    ];

    console.log('Benefits of multimodal requests:');
    console.log('  ✓ Image understanding and description');
    console.log('  ✓ Visual question answering');
    console.log('  ✓ OCR and text extraction');
    console.log('  ✓ Object detection and counting');
    console.log('  ✓ Image-based recommendations');

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 6: Advanced configuration options
 */
async function advancedConfigExample(): Promise<void> {
  console.log('\n\n=== Advanced Configuration Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    console.log('Advanced configuration options:\n');

    // Show various configuration options
    const configs = [
      {
        category: 'Response Format',
        options: [
          'JSON mode for structured output',
          'Custom response format schemas',
          'Streaming vs non-streaming',
        ],
      },
      {
        category: 'Sampling Parameters',
        options: [
          'Temperature (0-2): Controls randomness',
          'Top-p: Nucleus sampling',
          'Frequency penalty: Reduce repetition',
          'Presence penalty: Increase diversity',
        ],
      },
      {
        category: 'Token Management',
        options: [
          'Max tokens: Response length limit',
          'Stop sequences: Custom end markers',
          'Token counting and budgeting',
        ],
      },
      {
        category: 'Advanced Features',
        options: [
          'Seed for reproducibility',
          'Logprobs for confidence scores',
          'Custom logit bias',
          'User tracking for abuse monitoring',
        ],
      },
    ];

    for (const config of configs) {
      console.log(`${config.category}:`);
      for (const option of config.options) {
        console.log(`  • ${option}`);
      }
      console.log();
    }

    // Example: Using advanced parameters
    console.log('=== Example: Advanced Parameters ===\n');

    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .build();

    const advancedRequest = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .userMessage('Generate three creative product names for a smart coffee maker.')
      .temperature(0.9) // High creativity
      .topP(0.95) // Diverse sampling
      .frequencyPenalty(0.5) // Reduce repetition
      .presencePenalty(0.3) // Encourage new topics
      .maxTokens(150)
      .stopSequences(['\n\n', '---']) // Stop at these sequences
      .build();

    console.log('Request with advanced parameters:');
    console.log('  • Temperature: 0.9 (high creativity)');
    console.log('  • Top-p: 0.95 (diverse sampling)');
    console.log('  • Frequency penalty: 0.5');
    console.log('  • Presence penalty: 0.3\n');

    const response = await hub.complete('openai', advancedRequest);

    console.log('Response:');
    console.log(response.message.content);

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 7: JSON mode for structured output
 */
async function jsonModeExample(): Promise<void> {
  console.log('\n\n=== JSON Mode Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .build();

    console.log('JSON mode ensures the model always returns valid JSON\n');

    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .systemMessage('You are a helpful assistant that outputs valid JSON.')
      .userMessage('Generate a user profile with name, age, email, and interests (array).')
      .responseFormat({ type: 'json_object' }) // Enable JSON mode
      .temperature(0.7)
      .build();

    console.log('Sending request with JSON mode enabled...\n');

    const response = await hub.complete('openai', request);

    console.log('=== Structured JSON Response ===');
    console.log(response.message.content);

    // Parse and validate
    try {
      const parsed = JSON.parse(response.message.content);
      console.log('\n✓ Valid JSON structure');
      console.log('Parsed object:', parsed);
    } catch {
      console.log('\n✗ Invalid JSON (this should not happen in JSON mode)');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Entry point
if (require.main === module) {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Set it with: export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  cachingExample()
    .then(() => healthMonitoringExample())
    .then(() => customSelectionExample())
    .then(() => functionCallingExample())
    .then(() => multimodalExample())
    .then(() => advancedConfigExample())
    .then(() => jsonModeExample())
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export {
  cachingExample,
  healthMonitoringExample,
  customSelectionExample,
  functionCallingExample,
  multimodalExample,
  advancedConfigExample,
  jsonModeExample,
};
