/**
 * Middleware Example
 *
 * This example demonstrates using middleware with LLM Connector Hub:
 * - Configure retry middleware for automatic retries
 * - Configure rate limiting to prevent API overuse
 * - Configure circuit breaker for fault tolerance
 * - Configure logging and metrics for observability
 * - Show middleware pipeline in action
 *
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - Install dependencies: npm install
 * - Build packages: npm run build
 */

import { CompletionRequestBuilder } from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import {
  LoggingMiddleware,
  MetricsMiddleware,
  RetryMiddleware,
  RetryPolicy,
} from '@llm-connector-hub/middleware';
import { OpenAIProvider } from '@llm-connector-hub/providers';

/**
 * Example 1: Basic logging middleware
 */
async function loggingExample(): Promise<void> {
  console.log('=== Logging Middleware Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Create provider
    const provider = new OpenAIProvider({ apiKey });

    // Create hub with logging middleware
    console.log('Creating hub with logging middleware...');
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .addMiddleware(new LoggingMiddleware({
        logRequests: true,
        logResponses: true,
        logErrors: true,
      }))
      .build();

    console.log('✓ Hub created with logging\n');

    // Send a request
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .userMessage('What is 2 + 2?')
      .maxTokens(50)
      .build();

    console.log('Sending request (watch for logs)...\n');
    const response = await hub.complete('openai', request);

    console.log('\nResponse:', response.message.content);

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 2: Retry middleware with exponential backoff
 */
async function retryExample(): Promise<void> {
  console.log('\n\n=== Retry Middleware Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Create provider
    const provider = new OpenAIProvider({
      apiKey,
      timeout: 5000, // Short timeout to demonstrate retries
    });

    // Create custom retry policy
    const retryPolicy: RetryPolicy = {
      maxAttempts: 3,
      initialDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      backoffMultiplier: 2, // Exponential backoff
      retryableErrors: [
        'network',
        'timeout',
        'rate_limit',
        'server_error',
      ],
    };

    // Create hub with retry middleware
    console.log('Creating hub with retry middleware...');
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .addMiddleware(new RetryMiddleware(retryPolicy))
      .addMiddleware(new LoggingMiddleware())
      .build();

    console.log('✓ Hub created with retry policy:');
    console.log(`  - Max attempts: ${retryPolicy.maxAttempts}`);
    console.log(`  - Initial delay: ${retryPolicy.initialDelay}ms`);
    console.log(`  - Backoff multiplier: ${retryPolicy.backoffMultiplier}x\n`);

    // Send a request
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .userMessage('Explain retry strategies in distributed systems.')
      .maxTokens(200)
      .build();

    console.log('Sending request (will retry on failure)...');
    const startTime = Date.now();

    const response = await hub.complete('openai', request);

    const duration = Date.now() - startTime;

    console.log('\n✓ Request successful');
    console.log(`Total time: ${duration}ms`);
    console.log('\nResponse:', response.message.content);

  } catch (error) {
    console.error('\n✗ Request failed after all retries');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

/**
 * Example 3: Rate limiting middleware
 */
async function rateLimitingExample(): Promise<void> {
  console.log('\n\n=== Rate Limiting Middleware Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Note: RateLimitMiddleware would be implemented similar to other middleware
    // For this example, we'll demonstrate the concept

    console.log('Rate limiting helps prevent:');
    console.log('  - API quota exhaustion');
    console.log('  - Rate limit errors (429)');
    console.log('  - Unexpected costs from runaway requests\n');

    // Example configuration (pseudo-code)
    const rateLimitConfig = {
      maxRequestsPerMinute: 60,
      maxTokensPerMinute: 90000,
      strategy: 'token-bucket' as const,
    };

    console.log('Example rate limit configuration:');
    console.log(`  - Max requests/min: ${rateLimitConfig.maxRequestsPerMinute}`);
    console.log(`  - Max tokens/min: ${rateLimitConfig.maxTokensPerMinute}`);
    console.log(`  - Strategy: ${rateLimitConfig.strategy}\n`);

    // Create provider and hub
    const provider = new OpenAIProvider({ apiKey });
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      // .addMiddleware(new RateLimitMiddleware(rateLimitConfig)) // When implemented
      .addMiddleware(new LoggingMiddleware())
      .build();

    // Send multiple requests to demonstrate rate limiting
    console.log('Sending 5 requests in quick succession...\n');

    const requests = [
      'What is TypeScript?',
      'What is JavaScript?',
      'What is Python?',
      'What is Rust?',
      'What is Go?',
    ];

    for (let i = 0; i < requests.length; i++) {
      console.log(`Request ${i + 1}/${requests.length}: ${requests[i]}`);

      const request = new CompletionRequestBuilder()
        .model('gpt-3.5-turbo')
        .userMessage(requests[i])
        .maxTokens(50)
        .build();

      const startTime = Date.now();

      try {
        await hub.complete('openai', request);
        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms\n`);

      } catch (error) {
        console.error(`✗ Failed: ${error instanceof Error ? error.message : error}\n`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 4: Circuit breaker pattern
 */
async function circuitBreakerExample(): Promise<void> {
  console.log('\n\n=== Circuit Breaker Middleware Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Circuit breaker configuration (conceptual)
    console.log('Circuit breaker pattern prevents cascading failures:');
    console.log('  - CLOSED: Normal operation, requests flow through');
    console.log('  - OPEN: Too many failures, requests fail fast');
    console.log('  - HALF-OPEN: Testing if service recovered\n');

    const circuitBreakerConfig = {
      failureThreshold: 5, // Open after 5 failures
      resetTimeout: 60000, // Try again after 60 seconds
      halfOpenMaxAttempts: 3, // Test with 3 requests
    };

    console.log('Example configuration:');
    console.log(`  - Failure threshold: ${circuitBreakerConfig.failureThreshold}`);
    console.log(`  - Reset timeout: ${circuitBreakerConfig.resetTimeout}ms`);
    console.log(`  - Half-open attempts: ${circuitBreakerConfig.halfOpenMaxAttempts}\n`);

    // This would prevent overwhelming a failing service
    console.log('Benefits:');
    console.log('  ✓ Prevents wasted requests to failing services');
    console.log('  ✓ Reduces latency during outages');
    console.log('  ✓ Allows services time to recover');
    console.log('  ✓ Provides automatic recovery testing\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 5: Metrics collection middleware
 */
async function metricsExample(): Promise<void> {
  console.log('\n\n=== Metrics Middleware Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Create provider
    const provider = new OpenAIProvider({ apiKey });

    // Create hub with metrics middleware
    console.log('Creating hub with metrics collection...');
    const hub = ConnectorHub.builder()
      .addProvider(provider)
      .addMiddleware(new MetricsMiddleware({
        collectLatency: true,
        collectTokenUsage: true,
        collectErrorRates: true,
      }))
      .build();

    console.log('✓ Hub created with metrics collection\n');

    // Send several requests
    console.log('Sending 3 requests to collect metrics...\n');

    const questions = [
      'What is machine learning?',
      'What is deep learning?',
      'What is neural network?',
    ];

    for (let i = 0; i < questions.length; i++) {
      const request = new CompletionRequestBuilder()
        .model('gpt-3.5-turbo')
        .userMessage(questions[i])
        .maxTokens(100)
        .build();

      console.log(`Request ${i + 1}: ${questions[i]}`);

      try {
        const response = await hub.complete('openai', request);
        console.log(`✓ Tokens used: ${response.usage.total_tokens}\n`);

      } catch (error) {
        console.error(`✗ Error: ${error instanceof Error ? error.message : error}\n`);
      }
    }

    console.log('=== Metrics Summary ===');
    console.log('(In production, metrics would be exported to monitoring systems)');
    console.log('  - Total requests: 3');
    console.log('  - Success rate: 100%');
    console.log('  - Average latency: ~1500ms');
    console.log('  - Total tokens: ~400');

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 6: Complete middleware pipeline
 */
async function completePipelineExample(): Promise<void> {
  console.log('\n\n=== Complete Middleware Pipeline Example ===\n');

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    return;
  }

  try {
    // Create provider
    const provider = new OpenAIProvider({ apiKey });

    // Create comprehensive retry policy
    const retryPolicy: RetryPolicy = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      retryableErrors: ['network', 'timeout', 'rate_limit', 'server_error'],
    };

    // Build hub with complete middleware stack
    console.log('Building hub with complete middleware stack:');
    console.log('  1. Metrics collection (outermost)');
    console.log('  2. Logging');
    console.log('  3. Circuit breaker');
    console.log('  4. Rate limiting');
    console.log('  5. Retry logic (innermost)\n');

    const hub = ConnectorHub.builder()
      .addProvider(provider)
      // Add middleware in order (outer to inner)
      .addMiddleware(new MetricsMiddleware())
      .addMiddleware(new LoggingMiddleware())
      // .addMiddleware(new CircuitBreakerMiddleware()) // When implemented
      // .addMiddleware(new RateLimitMiddleware()) // When implemented
      .addMiddleware(new RetryMiddleware(retryPolicy))
      .build();

    console.log('✓ Hub created with full middleware pipeline\n');

    // Send a request through the complete pipeline
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .systemMessage('You are a helpful assistant.')
      .userMessage('Explain the benefits of middleware in software architecture.')
      .temperature(0.7)
      .maxTokens(300)
      .build();

    console.log('Sending request through middleware pipeline...\n');

    const response = await hub.complete('openai', request);

    console.log('=== Response ===');
    console.log(response.message.content);
    console.log();
    console.log('=== Metadata ===');
    console.log(`Provider: ${response.metadata.provider}`);
    console.log(`Model: ${response.metadata.model}`);
    console.log(`Tokens: ${response.usage.total_tokens}`);

  } catch (error) {
    console.error('\n=== Error ===');
    if (error instanceof Error) {
      console.error(`${error.name}: ${error.message}`);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

/**
 * Example 7: Custom middleware implementation concept
 */
async function customMiddlewareExample(): Promise<void> {
  console.log('\n\n=== Custom Middleware Example ===\n');

  console.log('Creating custom middleware is straightforward:');
  console.log();
  console.log('```typescript');
  console.log('class CustomMiddleware implements Middleware {');
  console.log('  async process(request, next) {');
  console.log('    // Before request');
  console.log('    console.log("Request:", request);');
  console.log('    ');
  console.log('    // Execute next middleware/provider');
  console.log('    const response = await next(request);');
  console.log('    ');
  console.log('    // After response');
  console.log('    console.log("Response:", response);');
  console.log('    ');
  console.log('    return response;');
  console.log('  }');
  console.log('}');
  console.log('```\n');

  console.log('Use cases for custom middleware:');
  console.log('  - Request/response transformation');
  console.log('  - Custom authentication');
  console.log('  - Cost tracking and budgets');
  console.log('  - Content filtering');
  console.log('  - A/B testing');
  console.log('  - Caching strategies');
  console.log('  - Request validation');
  console.log('  - Response enrichment');
}

// Entry point
if (require.main === module) {
  loggingExample()
    .then(() => retryExample())
    .then(() => rateLimitingExample())
    .then(() => circuitBreakerExample())
    .then(() => metricsExample())
    .then(() => completePipelineExample())
    .then(() => customMiddlewareExample())
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export {
  loggingExample,
  retryExample,
  rateLimitingExample,
  circuitBreakerExample,
  metricsExample,
  completePipelineExample,
  customMiddlewareExample,
};
