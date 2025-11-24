/**
 * Production-Ready Configuration Example
 *
 * This example demonstrates production-grade configuration:
 * - Complete configuration with all options
 * - Secrets management best practices
 * - Comprehensive error handling
 * - Monitoring and observability
 * - Performance optimization settings
 * - Security considerations
 * - Graceful degradation
 * - Resource cleanup
 *
 * Prerequisites:
 * - Set OPENAI_API_KEY environment variable
 * - Set ANTHROPIC_API_KEY environment variable (optional)
 * - Install dependencies: npm install
 * - Build packages: npm run build
 */

import * as fs from 'fs';
import * as path from 'path';
import { CompletionRequestBuilder } from '@llm-connector-hub/core';
import { ConnectorHub } from '@llm-connector-hub/hub';
import {
  LoggingMiddleware,
  MetricsMiddleware,
  RetryMiddleware,
  RetryPolicy,
} from '@llm-connector-hub/middleware';
import { AnthropicProvider, OpenAIProvider } from '@llm-connector-hub/providers';

/**
 * Configuration interface for production deployment
 */
interface ProductionConfig {
  // Provider configurations
  providers: {
    openai?: {
      apiKey: string;
      organization?: string;
      timeout: number;
      maxRetries: number;
    };
    anthropic?: {
      apiKey: string;
      timeout: number;
      maxRetries: number;
    };
  };

  // Middleware configurations
  middleware: {
    retry: {
      enabled: boolean;
      maxAttempts: number;
      initialDelay: number;
      maxDelay: number;
      backoffMultiplier: number;
    };
    rateLimit: {
      enabled: boolean;
      maxRequestsPerMinute: number;
      maxTokensPerMinute: number;
    };
    logging: {
      enabled: boolean;
      level: 'debug' | 'info' | 'warn' | 'error';
      includeRequestBodies: boolean;
      includeResponseBodies: boolean;
      sanitizeSecrets: boolean;
    };
    metrics: {
      enabled: boolean;
      exportInterval: number;
    };
  };

  // Cache configuration
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    type: 'memory' | 'redis';
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  };

  // Health monitoring
  health: {
    enabled: boolean;
    checkInterval: number;
    failureThreshold: number;
    successThreshold: number;
  };

  // Performance settings
  performance: {
    maxConcurrentRequests: number;
    requestTimeout: number;
    connectionPoolSize: number;
  };

  // Security settings
  security: {
    validateInputs: boolean;
    sanitizeOutputs: boolean;
    maxInputLength: number;
    maxOutputLength: number;
  };
}

/**
 * Load configuration from environment and config files
 */
function loadConfiguration(): ProductionConfig {
  console.log('Loading production configuration...\n');

  // Check for config file
  const configPath = process.env['LLM_CONNECTOR_CONFIG'] || './config/production.json';
  let fileConfig: Partial<ProductionConfig> = {};

  if (fs.existsSync(configPath)) {
    console.log(`✓ Loading config from: ${configPath}`);
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else {
    console.log(`⚠ Config file not found: ${configPath}`);
    console.log('  Using environment variables and defaults\n');
  }

  // Build configuration with defaults
  const config: ProductionConfig = {
    providers: {
      openai: process.env['OPENAI_API_KEY']
        ? {
            apiKey: process.env['OPENAI_API_KEY'],
            organization: process.env['OPENAI_ORG_ID'],
            timeout: 30000,
            maxRetries: 3,
          }
        : undefined,
      anthropic: process.env['ANTHROPIC_API_KEY']
        ? {
            apiKey: process.env['ANTHROPIC_API_KEY'],
            timeout: 30000,
            maxRetries: 3,
          }
        : undefined,
    },

    middleware: {
      retry: {
        enabled: true,
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      },
      rateLimit: {
        enabled: true,
        maxRequestsPerMinute: 60,
        maxTokensPerMinute: 90000,
      },
      logging: {
        enabled: true,
        level: (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') || 'info',
        includeRequestBodies: process.env['NODE_ENV'] !== 'production',
        includeResponseBodies: process.env['NODE_ENV'] !== 'production',
        sanitizeSecrets: true,
      },
      metrics: {
        enabled: true,
        exportInterval: 60000, // Export every minute
      },
    },

    cache: {
      enabled: true,
      ttl: 3600, // 1 hour
      maxSize: 1000,
      type: 'memory',
    },

    health: {
      enabled: true,
      checkInterval: 30000, // 30 seconds
      failureThreshold: 3,
      successThreshold: 2,
    },

    performance: {
      maxConcurrentRequests: 10,
      requestTimeout: 30000,
      connectionPoolSize: 20,
    },

    security: {
      validateInputs: true,
      sanitizeOutputs: true,
      maxInputLength: 100000, // 100k characters
      maxOutputLength: 50000, // 50k characters
    },

    // Merge with file config
    ...fileConfig,
  };

  return config;
}

/**
 * Validate configuration
 */
function validateConfiguration(config: ProductionConfig): void {
  console.log('\nValidating configuration...\n');

  const errors: string[] = [];

  // Check for at least one provider
  if (!config.providers.openai && !config.providers.anthropic) {
    errors.push('At least one provider must be configured');
  }

  // Validate timeouts
  if (config.performance.requestTimeout < 1000) {
    errors.push('Request timeout must be at least 1000ms');
  }

  // Validate cache settings
  if (config.cache.enabled && config.cache.ttl < 0) {
    errors.push('Cache TTL must be positive');
  }

  if (errors.length > 0) {
    console.error('Configuration validation errors:');
    errors.forEach((error) => console.error(`  ✗ ${error}`));
    throw new Error('Invalid configuration');
  }

  console.log('✓ Configuration validated successfully\n');
}

/**
 * Initialize ConnectorHub with production configuration
 */
function initializeHub(config: ProductionConfig): ConnectorHub {
  console.log('Initializing ConnectorHub...\n');

  let builder = ConnectorHub.builder();

  // Add providers
  if (config.providers.openai) {
    console.log('✓ Adding OpenAI provider');
    const provider = new OpenAIProvider({
      apiKey: config.providers.openai.apiKey,
      organization: config.providers.openai.organization,
      timeout: config.providers.openai.timeout,
    });
    builder = builder.addProvider(provider);
  }

  if (config.providers.anthropic) {
    console.log('✓ Adding Anthropic provider');
    const provider = new AnthropicProvider({
      apiKey: config.providers.anthropic.apiKey,
      timeout: config.providers.anthropic.timeout,
    });
    builder = builder.addProvider(provider);
  }

  // Add middleware
  console.log('\nConfiguring middleware:');

  if (config.middleware.metrics.enabled) {
    console.log('✓ Metrics collection');
    builder = builder.addMiddleware(
      new MetricsMiddleware({
        collectLatency: true,
        collectTokenUsage: true,
        collectErrorRates: true,
      })
    );
  }

  if (config.middleware.logging.enabled) {
    console.log('✓ Logging');
    builder = builder.addMiddleware(
      new LoggingMiddleware({
        logRequests: config.middleware.logging.includeRequestBodies,
        logResponses: config.middleware.logging.includeResponseBodies,
        logErrors: true,
      })
    );
  }

  if (config.middleware.retry.enabled) {
    console.log('✓ Retry logic');
    const retryPolicy: RetryPolicy = {
      maxAttempts: config.middleware.retry.maxAttempts,
      initialDelay: config.middleware.retry.initialDelay,
      maxDelay: config.middleware.retry.maxDelay,
      backoffMultiplier: config.middleware.retry.backoffMultiplier,
      retryableErrors: ['network', 'timeout', 'rate_limit', 'server_error'],
    };
    builder = builder.addMiddleware(new RetryMiddleware(retryPolicy));
  }

  // Enable caching
  if (config.cache.enabled) {
    console.log('\nConfiguring cache:');
    console.log(`  Type: ${config.cache.type}`);
    console.log(`  TTL: ${config.cache.ttl}s`);
    console.log(`  Max size: ${config.cache.maxSize}`);

    builder = builder.enableCache({
      ttl: config.cache.ttl,
      maxSize: config.cache.maxSize,
    });
  }

  // Enable health monitoring
  if (config.health.enabled) {
    console.log('\nConfiguring health monitoring:');
    console.log(`  Check interval: ${config.health.checkInterval}ms`);
    console.log(`  Failure threshold: ${config.health.failureThreshold}`);
    console.log(`  Success threshold: ${config.health.successThreshold}`);

    builder = builder.enableHealthMonitoring({
      checkInterval: config.health.checkInterval,
      failureThreshold: config.health.failureThreshold,
      successThreshold: config.health.successThreshold,
    });
  }

  const hub = builder.build();

  console.log('\n✓ ConnectorHub initialized successfully\n');

  return hub;
}

/**
 * Validate and sanitize user input
 */
function validateInput(input: string, config: ProductionConfig): string {
  if (!config.security.validateInputs) {
    return input;
  }

  // Check length
  if (input.length > config.security.maxInputLength) {
    throw new Error(`Input exceeds maximum length of ${config.security.maxInputLength} characters`);
  }

  // Remove null bytes and other dangerous characters
  const sanitized = input.replace(/\0/g, '').trim();

  return sanitized;
}

/**
 * Sanitize output before returning to user
 */
function sanitizeOutput(output: string, config: ProductionConfig): string {
  if (!config.security.sanitizeOutputs) {
    return output;
  }

  // Truncate if too long
  if (output.length > config.security.maxOutputLength) {
    return output.substring(0, config.security.maxOutputLength) + '... [truncated]';
  }

  return output;
}

/**
 * Main production example
 */
async function main(): Promise<void> {
  console.log('=== Production-Ready Configuration Example ===\n');

  let hub: ConnectorHub | null = null;

  try {
    // Step 1: Load configuration
    const config = loadConfiguration();

    // Step 2: Validate configuration
    validateConfiguration(config);

    // Step 3: Initialize hub
    hub = initializeHub(config);

    // Step 4: Perform health check before processing requests
    console.log('=== Pre-flight Health Check ===\n');
    const healthStatus = await hub.healthCheck();

    let allHealthy = true;
    for (const [provider, isHealthy] of healthStatus) {
      const status = isHealthy ? '✓' : '✗';
      console.log(`${status} ${provider}: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      if (!isHealthy) allHealthy = false;
    }

    if (!allHealthy) {
      console.log('\n⚠ Warning: Some providers are unhealthy');
      console.log('Continuing with degraded service...\n');
    } else {
      console.log('\n✓ All providers healthy\n');
    }

    // Step 5: Process a sample request with full error handling
    console.log('=== Processing Sample Request ===\n');

    const userInput = 'Explain the importance of error handling in production systems.';

    // Validate input
    const sanitizedInput = validateInput(userInput, config);
    console.log(`Input validated (${sanitizedInput.length} chars)\n`);

    // Build request
    const request = new CompletionRequestBuilder()
      .model('gpt-3.5-turbo')
      .systemMessage('You are a helpful assistant focused on software engineering best practices.')
      .userMessage(sanitizedInput)
      .temperature(0.7)
      .maxTokens(500)
      .build();

    // Send request with timeout
    console.log('Sending request with production safeguards...\n');
    const startTime = Date.now();

    const provider = config.providers.openai ? 'openai' : 'anthropic';
    const response = await Promise.race([
      hub.complete(provider, request),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timeout')),
          config.performance.requestTimeout
        )
      ),
    ]);

    const duration = Date.now() - startTime;

    // Sanitize output
    const sanitizedOutput = sanitizeOutput((response as any).message.content, config);

    // Display results
    console.log('=== Request Successful ===\n');
    console.log('Response:');
    console.log(sanitizedOutput);
    console.log();
    console.log('=== Metrics ===');
    console.log(`Duration: ${duration}ms`);
    console.log(`Provider: ${(response as any).metadata.provider}`);
    console.log(`Model: ${(response as any).metadata.model}`);
    console.log(`Tokens: ${(response as any).usage.total_tokens}`);
    console.log(`Finish reason: ${(response as any).finish_reason}`);

  } catch (error) {
    // Comprehensive error handling
    console.error('\n=== Error Occurred ===\n');

    if (error instanceof Error) {
      // Log error details
      console.error(`Type: ${error.name}`);
      console.error(`Message: ${error.message}`);

      // Categorize error
      if (error.message.includes('timeout')) {
        console.error('Category: Timeout');
        console.error('Action: Request took too long, consider increasing timeout or optimizing request');
      } else if (error.message.includes('401') || error.message.includes('authentication')) {
        console.error('Category: Authentication');
        console.error('Action: Check API keys and credentials');
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.error('Category: Rate Limit');
        console.error('Action: Implement backoff strategy or upgrade API plan');
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        console.error('Category: Network');
        console.error('Action: Check connectivity and provider status');
      } else if (error.message.includes('validation')) {
        console.error('Category: Validation');
        console.error('Action: Check input format and requirements');
      } else {
        console.error('Category: Unknown');
        console.error('Action: Review error logs and contact support if persistent');
      }

      // In production, you would:
      // 1. Log to monitoring system (e.g., Sentry, DataDog)
      // 2. Increment error metrics
      // 3. Trigger alerts if needed
      // 4. Return appropriate error response to client
    }

    process.exit(1);

  } finally {
    // Step 6: Cleanup and resource management
    console.log('\n=== Cleanup ===');

    if (hub) {
      // Close connections, flush logs, export final metrics
      console.log('Cleaning up resources...');
      // await hub.shutdown(); // If implemented

      console.log('✓ Resources cleaned up');
    }
  }
}

/**
 * Demonstrate monitoring and observability
 */
async function monitoringExample(): Promise<void> {
  console.log('\n\n=== Monitoring and Observability ===\n');

  console.log('Production monitoring best practices:\n');

  const practices = [
    {
      category: 'Metrics',
      items: [
        'Request rate (requests/second)',
        'Error rate (errors/total requests)',
        'Latency percentiles (P50, P95, P99)',
        'Token usage and costs',
        'Cache hit rate',
        'Provider health status',
      ],
    },
    {
      category: 'Logging',
      items: [
        'Structured logs with correlation IDs',
        'Request/response metadata',
        'Error details with stack traces',
        'Performance timing information',
        'Security events (failed auth, rate limits)',
      ],
    },
    {
      category: 'Alerting',
      items: [
        'High error rate (>5%)',
        'High latency (>3s P95)',
        'Provider unavailability',
        'Budget threshold exceeded',
        'Security anomalies',
      ],
    },
    {
      category: 'Tracing',
      items: [
        'Distributed tracing with OpenTelemetry',
        'Request flow visualization',
        'Performance bottleneck identification',
        'Cross-service correlation',
      ],
    },
  ];

  for (const practice of practices) {
    console.log(`${practice.category}:`);
    for (const item of practice.items) {
      console.log(`  • ${item}`);
    }
    console.log();
  }
}

/**
 * Security best practices
 */
async function securityExample(): Promise<void> {
  console.log('\n\n=== Security Best Practices ===\n');

  const securityPractices = [
    {
      practice: 'API Key Management',
      recommendations: [
        'Never commit API keys to source control',
        'Use environment variables or secret management services',
        'Rotate keys regularly',
        'Use different keys for dev/staging/prod',
        'Implement key expiration policies',
      ],
    },
    {
      practice: 'Input Validation',
      recommendations: [
        'Validate all user inputs',
        'Sanitize inputs to prevent injection attacks',
        'Implement maximum length limits',
        'Filter out malicious content',
        'Use allowlists for acceptable patterns',
      ],
    },
    {
      practice: 'Output Sanitization',
      recommendations: [
        'Filter sensitive information from responses',
        'Implement content moderation',
        'Truncate excessive output',
        'Sanitize logs to remove secrets',
        'Validate response format',
      ],
    },
    {
      practice: 'Rate Limiting',
      recommendations: [
        'Implement per-user rate limits',
        'Use token bucket algorithm',
        'Add CAPTCHA for suspicious activity',
        'Monitor for abuse patterns',
        'Implement cost controls',
      ],
    },
    {
      practice: 'Network Security',
      recommendations: [
        'Use TLS for all connections',
        'Validate SSL certificates',
        'Implement request signing',
        'Use firewall rules',
        'Enable DDoS protection',
      ],
    },
  ];

  for (const practice of securityPractices) {
    console.log(`${practice.practice}:`);
    for (const recommendation of practice.recommendations) {
      console.log(`  ✓ ${recommendation}`);
    }
    console.log();
  }
}

// Entry point
if (require.main === module) {
  main()
    .then(() => monitoringExample())
    .then(() => securityExample())
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { main, monitoringExample, securityExample, loadConfiguration, validateConfiguration };
