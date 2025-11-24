/**
 * Provider Benchmark
 * Measures provider request/response transformation performance
 */

import { runBenchmark, BenchmarkResult, createMockRequest, createMockResponse } from './setup';
import { SCENARIOS, TARGETS } from './config';

/**
 * Mock provider transformer for Anthropic
 */
class MockAnthropicTransformer {
  transformRequest(request: any): any {
    return {
      model: request.model,
      messages: request.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature,
      top_p: request.top_p,
    };
  }

  transformResponse(response: any): any {
    return {
      id: response.id,
      object: 'chat.completion',
      created: Date.now(),
      model: response.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.content?.[0]?.text || '',
          },
          finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
        },
      ],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens:
          (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
    };
  }
}

/**
 * Mock provider transformer for Google
 */
class MockGoogleTransformer {
  transformRequest(request: any): any {
    return {
      contents: request.messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        temperature: request.temperature,
        topP: request.top_p,
        topK: request.top_k,
        maxOutputTokens: request.max_tokens,
      },
    };
  }

  transformResponse(response: any): any {
    const candidate = response.candidates?.[0];
    return {
      id: 'google-' + Math.random().toString(36).substring(7),
      object: 'chat.completion',
      created: Date.now(),
      model: response.modelVersion || 'gemini-pro',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: candidate?.content?.parts?.[0]?.text || '',
          },
          finishReason: candidate?.finishReason === 'STOP' ? 'stop' : 'length',
        },
      ],
      usage: {
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
}

/**
 * Mock provider transformer for OpenAI (minimal transformation)
 */
class MockOpenAITransformer {
  transformRequest(request: any): any {
    // OpenAI uses our standard format, minimal transformation
    return { ...request };
  }

  transformResponse(response: any): any {
    // OpenAI response is already in our format
    return { ...response };
  }
}

/**
 * Create mock provider responses
 */
function createMockAnthropicResponse() {
  return {
    id: 'msg_' + Math.random().toString(36).substring(7),
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'This is a test response from Anthropic Claude.',
      },
    ],
    model: 'claude-3-sonnet-20240229',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
  };
}

function createMockGoogleResponse() {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: 'This is a test response from Google Gemini.',
            },
          ],
          role: 'model',
        },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      totalTokenCount: 30,
    },
    modelVersion: 'gemini-pro',
  };
}

/**
 * Benchmark provider transformations
 */
export async function benchmarkProviders(): Promise<BenchmarkResult[]> {
  console.log('\n🔬 Running Provider Benchmarks...\n');

  const results: BenchmarkResult[] = [];
  const anthropicTransformer = new MockAnthropicTransformer();
  const googleTransformer = new MockGoogleTransformer();
  const openaiTransformer = new MockOpenAITransformer();

  // Benchmark Anthropic Request Transformation
  for (const [key, scenario] of Object.entries(SCENARIOS.provider)) {
    const request = createMockRequest(scenario.messageCount);

    const result = await runBenchmark(
      `Anthropic Request Transform (${scenario.name})`,
      () => {
        anthropicTransformer.transformRequest(request);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );

    results.push(result);
    console.log(
      `  ✓ ${result.name}: ${result.averageTime.toFixed(2)}μs (${result.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark Anthropic Response Transformation
  for (const [key, scenario] of Object.entries(SCENARIOS.provider)) {
    const response = createMockAnthropicResponse();

    const result = await runBenchmark(
      `Anthropic Response Transform (${scenario.name})`,
      () => {
        anthropicTransformer.transformResponse(response);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );

    results.push(result);
    console.log(
      `  ✓ ${result.name}: ${result.averageTime.toFixed(2)}μs (${result.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark Google Request Transformation
  for (const [key, scenario] of Object.entries(SCENARIOS.provider)) {
    const request = createMockRequest(scenario.messageCount);

    const result = await runBenchmark(
      `Google Request Transform (${scenario.name})`,
      () => {
        googleTransformer.transformRequest(request);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );

    results.push(result);
    console.log(
      `  ✓ ${result.name}: ${result.averageTime.toFixed(2)}μs (${result.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark Google Response Transformation
  for (const [key, scenario] of Object.entries(SCENARIOS.provider)) {
    const response = createMockGoogleResponse();

    const result = await runBenchmark(
      `Google Response Transform (${scenario.name})`,
      () => {
        googleTransformer.transformResponse(response);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );

    results.push(result);
    console.log(
      `  ✓ ${result.name}: ${result.averageTime.toFixed(2)}μs (${result.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark OpenAI Transformation (should be fastest)
  for (const [key, scenario] of Object.entries(SCENARIOS.provider)) {
    const request = createMockRequest(scenario.messageCount);

    const result = await runBenchmark(
      `OpenAI Request Transform (${scenario.name})`,
      () => {
        openaiTransformer.transformRequest(request);
      },
      { iterations: 10000, warmupIterations: 100, collectMemory: true }
    );

    results.push(result);
    console.log(
      `  ✓ ${result.name}: ${result.averageTime.toFixed(2)}μs (${result.opsPerSecond.toFixed(0)} ops/s)`
    );
  }

  // Benchmark JSON Serialization/Deserialization
  const largeRequest = createMockRequest(20);
  const largeResponse = createMockResponse('Long response text '.repeat(100));

  const serializeResult = await runBenchmark(
    'JSON Serialize (Large Request)',
    () => {
      JSON.stringify(largeRequest);
    },
    { iterations: 10000, warmupIterations: 100, collectMemory: true }
  );
  results.push(serializeResult);
  console.log(
    `  ✓ ${serializeResult.name}: ${serializeResult.averageTime.toFixed(2)}μs (${serializeResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  const deserializeResult = await runBenchmark(
    'JSON Deserialize (Large Response)',
    () => {
      const json = JSON.stringify(largeResponse);
      JSON.parse(json);
    },
    { iterations: 10000, warmupIterations: 100, collectMemory: true }
  );
  results.push(deserializeResult);
  console.log(
    `  ✓ ${deserializeResult.name}: ${deserializeResult.averageTime.toFixed(2)}μs (${deserializeResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  // Benchmark deep cloning (used in some transformations)
  const deepCloneResult = await runBenchmark(
    'Deep Clone (Large Request)',
    () => {
      JSON.parse(JSON.stringify(largeRequest));
    },
    { iterations: 10000, warmupIterations: 100, collectMemory: true }
  );
  results.push(deepCloneResult);
  console.log(
    `  ✓ ${deepCloneResult.name}: ${deepCloneResult.averageTime.toFixed(2)}μs (${deepCloneResult.opsPerSecond.toFixed(0)} ops/s)`
  );

  console.log('\n✅ Provider benchmarks completed\n');

  return results;
}

/**
 * Compare provider performance
 */
export function compareProviders(results: BenchmarkResult[]): void {
  console.log('\n📊 Provider Performance Comparison\n');

  const providers = ['Anthropic', 'Google', 'OpenAI'];
  const operations = ['Request Transform', 'Response Transform'];

  for (const operation of operations) {
    console.log(`${operation}:`);

    const providerResults = providers.map((provider) => {
      const result = results.find(
        (r) => r.name.includes(provider) && r.name.includes(operation) && r.name.includes('Small')
      );
      return {
        provider,
        avgTime: result?.averageTime || 0,
        opsPerSecond: result?.opsPerSecond || 0,
      };
    });

    // Sort by fastest
    providerResults.sort((a, b) => a.avgTime - b.avgTime);

    for (let i = 0; i < providerResults.length; i++) {
      const pr = providerResults[i];
      const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      const baseline = providerResults[0].avgTime;
      const slowdown = baseline > 0 ? (pr.avgTime / baseline - 1) * 100 : 0;

      console.log(
        `  ${rank} ${pr.provider.padEnd(15)} ${pr.avgTime.toFixed(2)}μs` +
          (slowdown > 0 ? ` (+${slowdown.toFixed(1)}% slower)` : '')
      );
    }
    console.log('');
  }
}

/**
 * Run provider benchmarks if executed directly
 */
if (require.main === module) {
  benchmarkProviders()
    .then((results) => {
      compareProviders(results);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
