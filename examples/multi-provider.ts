/**
 * Multi-Provider Example
 *
 * This example demonstrates working with multiple LLM providers:
 * - Configure multiple providers (OpenAI, Anthropic, Google)
 * - Demonstrate provider selection strategies
 * - Show automatic failover between providers
 * - Compare responses from different providers
 * - Monitor provider health
 *
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - Set ANTHROPIC_API_KEY environment variable (optional)
 * - Set GOOGLE_API_KEY environment variable (optional)
 * - Install dependencies: npm install
 * - Build packages: npm run build
 */

import { CompletionRequestBuilder } from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import { LoggingMiddleware } from '@llm-connector-hub/middleware';
import { AnthropicProvider, OpenAIProvider } from '@llm-connector-hub/providers';

/**
 * Configure multiple providers
 */
function setupProviders() {
  const providers = [];

  // OpenAI provider
  const openaiKey = process.env['OPENAI_API_KEY'];
  if (openaiKey) {
    const openai = new OpenAIProvider({
      apiKey: openaiKey,
      timeout: 30000,
    });
    providers.push({ name: 'openai', provider: openai });
    console.log('✓ OpenAI provider configured');
  } else {
    console.log('⚠ OpenAI provider skipped (no API key)');
  }

  // Anthropic provider
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  if (anthropicKey) {
    const anthropic = new AnthropicProvider({
      apiKey: anthropicKey,
      timeout: 30000,
    });
    providers.push({ name: 'anthropic', provider: anthropic });
    console.log('✓ Anthropic provider configured');
  } else {
    console.log('⚠ Anthropic provider skipped (no API key)');
  }

  // Note: Google provider would be added here when available
  // const googleKey = process.env['GOOGLE_API_KEY'];
  // if (googleKey) {
  //   const google = new GoogleProvider({ apiKey: googleKey });
  //   providers.push({ name: 'google', provider: google });
  //   console.log('✓ Google provider configured');
  // }

  return providers;
}

/**
 * Main example: Compare responses from multiple providers
 */
async function main(): Promise<void> {
  console.log('=== Multi-Provider Example ===\n');

  // Setup all available providers
  const availableProviders = setupProviders();

  if (availableProviders.length === 0) {
    console.error('\nError: No providers configured. Set at least OPENAI_API_KEY');
    console.error('export OPENAI_API_KEY="sk-..."');
    console.error('export ANTHROPIC_API_KEY="sk-ant-..." (optional)');
    process.exit(1);
  }

  console.log();

  try {
    // Build the hub with all providers
    console.log('Building ConnectorHub with multiple providers...');
    let builder = ConnectorHub.builder();

    for (const { provider } of availableProviders) {
      builder = builder.addProvider(provider);
    }

    const hub = builder
      .addMiddleware(new LoggingMiddleware())
      .build();

    console.log('✓ Hub created with', availableProviders.length, 'provider(s)\n');

    // Create a test question
    const question = 'What are the three laws of robotics proposed by Isaac Asimov?';
    console.log('Question:', question);
    console.log('\n' + '='.repeat(80) + '\n');

    // Ask each provider the same question
    const responses: Array<{ provider: string; model: string; response: string; tokens: number; duration: number }> = [];

    for (const { name } of availableProviders) {
      console.log(`Requesting from ${name}...`);

      // Determine appropriate model for each provider
      let model: string;
      if (name === 'openai') {
        model = 'gpt-3.5-turbo';
      } else if (name === 'anthropic') {
        model = 'claude-3-haiku-20240307';
      } else {
        model = 'default';
      }

      const request = new CompletionRequestBuilder()
        .model(model)
        .userMessage(question)
        .temperature(0) // Use 0 for consistent responses
        .maxTokens(300)
        .build();

      const startTime = Date.now();

      try {
        const response = await hub.complete(name, request);
        const duration = Date.now() - startTime;

        console.log(`✓ Response received in ${duration}ms\n`);

        responses.push({
          provider: name,
          model: response.metadata.model,
          response: response.message.content,
          tokens: response.usage.total_tokens,
          duration,
        });

      } catch (error) {
        console.error(`✗ Error from ${name}:`, error instanceof Error ? error.message : error);
        console.log();
      }
    }

    // Display comparison
    console.log('='.repeat(80));
    console.log('=== Response Comparison ===\n');

    for (const result of responses) {
      console.log(`Provider: ${result.provider.toUpperCase()}`);
      console.log(`Model: ${result.model}`);
      console.log(`Duration: ${result.duration}ms`);
      console.log(`Tokens: ${result.tokens}`);
      console.log('\nResponse:');
      console.log(result.response);
      console.log('\n' + '-'.repeat(80) + '\n');
    }

    // Display statistics
    if (responses.length > 1) {
      console.log('=== Statistics ===');
      console.log(`Fastest response: ${responses.sort((a, b) => a.duration - b.duration)[0].provider} (${responses[0].duration}ms)`);
      console.log(`Most verbose: ${responses.sort((a, b) => b.response.length - a.response.length)[0].provider} (${responses[0].response.length} chars)`);
      console.log(`Most tokens: ${responses.sort((a, b) => b.tokens - a.tokens)[0].provider} (${responses[0].tokens} tokens)`);
    }

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
 * Example: Provider failover
 */
async function failoverExample(): Promise<void> {
  console.log('\n\n=== Provider Failover Example ===\n');

  const availableProviders = setupProviders();

  if (availableProviders.length < 2) {
    console.log('⚠ Skipping failover example (requires at least 2 providers)');
    return;
  }

  console.log();

  try {
    let builder = ConnectorHub.builder();
    for (const { provider } of availableProviders) {
      builder = builder.addProvider(provider);
    }
    const hub = builder.build();

    const request = new CompletionRequestBuilder()
      .userMessage('What is the speed of light?')
      .temperature(0)
      .maxTokens(100)
      .build();

    // Try providers in order until one succeeds
    const providerOrder = availableProviders.map((p) => p.name);
    console.log(`Attempting providers in order: ${providerOrder.join(' -> ')}\n`);

    for (const providerName of providerOrder) {
      console.log(`Trying ${providerName}...`);

      try {
        // Set appropriate model for provider
        let model: string;
        if (providerName === 'openai') {
          model = 'gpt-3.5-turbo';
        } else if (providerName === 'anthropic') {
          model = 'claude-3-haiku-20240307';
        } else {
          model = 'default';
        }

        const providerRequest = { ...request, model };
        const response = await hub.complete(providerName, providerRequest);

        console.log(`✓ Success with ${providerName}!`);
        console.log(`\nResponse: ${response.message.content}\n`);
        break; // Success, exit loop

      } catch (error) {
        console.log(`✗ Failed with ${providerName}: ${error instanceof Error ? error.message : error}`);
        console.log('Trying next provider...\n');
      }
    }

  } catch (error) {
    console.error('Error in failover example:', error);
  }
}

/**
 * Example: Health monitoring
 */
async function healthMonitoring(): Promise<void> {
  console.log('\n\n=== Health Monitoring Example ===\n');

  const availableProviders = setupProviders();

  if (availableProviders.length === 0) {
    console.log('⚠ No providers available for health check');
    return;
  }

  console.log();

  try {
    let builder = ConnectorHub.builder();
    for (const { provider } of availableProviders) {
      builder = builder.addProvider(provider);
    }
    const hub = builder.build();

    console.log('Checking health of all providers...\n');

    // Perform health check
    const health = await hub.healthCheck();

    console.log('=== Health Status ===');
    for (const [provider, status] of health) {
      const icon = status ? '✓' : '✗';
      const statusText = status ? 'HEALTHY' : 'UNHEALTHY';
      console.log(`${icon} ${provider.toUpperCase()}: ${statusText}`);
    }

    // Summary
    const healthyCount = Array.from(health.values()).filter((h) => h).length;
    const totalCount = health.size;

    console.log('\n=== Summary ===');
    console.log(`Healthy providers: ${healthyCount}/${totalCount}`);

    if (healthyCount < totalCount) {
      console.log('⚠ Warning: Some providers are unhealthy');
    } else {
      console.log('✓ All providers are healthy');
    }

  } catch (error) {
    console.error('Error in health monitoring:', error);
  }
}

/**
 * Example: Provider selection strategy
 */
async function selectionStrategy(): Promise<void> {
  console.log('\n\n=== Provider Selection Strategy Example ===\n');

  const availableProviders = setupProviders();

  if (availableProviders.length < 2) {
    console.log('⚠ Skipping selection strategy example (requires at least 2 providers)');
    return;
  }

  console.log();

  try {
    let builder = ConnectorHub.builder();
    for (const { provider } of availableProviders) {
      builder = builder.addProvider(provider);
    }
    const hub = builder.build();

    // Simulate choosing provider based on different strategies
    const strategies = [
      { name: 'Cost Optimization', preferred: 'openai', reason: 'GPT-3.5-turbo is cost-effective' },
      { name: 'Quality Optimization', preferred: 'anthropic', reason: 'Claude models excel at reasoning' },
      { name: 'Speed Optimization', preferred: 'openai', reason: 'Lower latency endpoints' },
    ];

    for (const strategy of strategies) {
      console.log(`Strategy: ${strategy.name}`);
      console.log(`Preferred: ${strategy.preferred}`);
      console.log(`Reason: ${strategy.reason}\n`);

      // Check if preferred provider is available
      const hasProvider = availableProviders.some((p) => p.name === strategy.preferred);

      if (hasProvider) {
        console.log(`✓ Using ${strategy.preferred}\n`);
      } else {
        const fallback = availableProviders[0].name;
        console.log(`⚠ ${strategy.preferred} not available, falling back to ${fallback}\n`);
      }

      console.log('-'.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('Error in selection strategy example:', error);
  }
}

// Entry point
if (require.main === module) {
  main()
    .then(() => failoverExample())
    .then(() => healthMonitoring())
    .then(() => selectionStrategy())
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { main, failoverExample, healthMonitoring, selectionStrategy };
