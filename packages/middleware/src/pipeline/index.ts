/**
 * Pipeline - Middleware execution orchestration
 *
 * Provides a composable middleware system for processing LLM requests.
 * Middleware can be added with priorities, enabled/disabled dynamically,
 * and executed in a controlled order.
 */

import type {
  IMiddleware,
  MiddlewareContext,
  NextFunction,
  CompletionRequest,
  CompletionResponse,
} from '@llm-connector-hub/core';

/**
 * Options for adding middleware to the pipeline
 */
export interface MiddlewareOptions {
  priority?: number;
  enabled?: boolean;
}

/**
 * Internal middleware entry with metadata
 */
interface MiddlewareEntry {
  middleware: IMiddleware;
  priority: number;
  enabled: boolean;
}

/**
 * Creates a middleware context for a request
 *
 * @param request - Completion request
 * @param provider - Provider name
 * @returns Middleware context
 */
export function createContext(
  request: CompletionRequest,
  provider: string
): MiddlewareContext {
  return {
    request,
    provider,
    metadata: {},
    startTime: Date.now(),
    attemptCount: 0,
  };
}

/**
 * Pipeline for middleware execution
 *
 * Manages a collection of middleware and orchestrates their execution
 * in priority order. Supports dynamic enable/disable and cleanup.
 */
export class Pipeline {
  private middleware: Map<string, MiddlewareEntry> = new Map();

  /**
   * Adds middleware to the pipeline
   *
   * @param middleware - Middleware to add
   * @param options - Options (priority, enabled)
   */
  use(middleware: IMiddleware, options: MiddlewareOptions = {}): void {
    const { priority = 50, enabled = true } = options;

    this.middleware.set(middleware.name, {
      middleware,
      priority,
      enabled,
    });

    // Initialize middleware if it has an initialize method
    if (middleware.initialize) {
      middleware.initialize().catch((error) => {
        console.error(`Failed to initialize middleware ${middleware.name}:`, error);
      });
    }
  }

  /**
   * Removes middleware from the pipeline
   *
   * @param name - Name of middleware to remove
   * @returns True if removed, false if not found
   */
  remove(name: string): boolean {
    const entry = this.middleware.get(name);
    if (!entry) {
      return false;
    }

    this.middleware.delete(name);

    // Cleanup middleware if it has a cleanup method
    if (entry.middleware.cleanup) {
      entry.middleware.cleanup().catch((error) => {
        console.error(`Failed to cleanup middleware ${name}:`, error);
      });
    }

    return true;
  }

  /**
   * Checks if middleware exists in the pipeline
   *
   * @param name - Middleware name
   * @returns True if exists
   */
  has(name: string): boolean {
    return this.middleware.has(name);
  }

  /**
   * Gets middleware by name
   *
   * @param name - Middleware name
   * @returns Middleware instance or undefined
   */
  get(name: string): IMiddleware | undefined {
    return this.middleware.get(name)?.middleware;
  }

  /**
   * Enables middleware
   *
   * @param name - Middleware name
   */
  enable(name: string): void {
    const entry = this.middleware.get(name);
    if (entry) {
      entry.enabled = true;
    }
  }

  /**
   * Disables middleware
   *
   * @param name - Middleware name
   */
  disable(name: string): void {
    const entry = this.middleware.get(name);
    if (entry) {
      entry.enabled = false;
    }
  }

  /**
   * Gets all middleware instances
   *
   * @returns Array of middleware
   */
  getMiddleware(): IMiddleware[] {
    return Array.from(this.middleware.values()).map((entry) => entry.middleware);
  }

  /**
   * Clears all middleware from the pipeline
   */
  clear(): void {
    // Cleanup all middleware
    for (const entry of this.middleware.values()) {
      if (entry.middleware.cleanup) {
        entry.middleware.cleanup().catch((error) => {
          console.error(`Failed to cleanup middleware ${entry.middleware.name}:`, error);
        });
      }
    }

    this.middleware.clear();
  }

  /**
   * Executes the pipeline with the given context and handler
   *
   * @param context - Middleware context
   * @param handler - Final handler to execute after all middleware
   * @returns Completion response
   */
  async execute(
    context: MiddlewareContext,
    handler: (context: MiddlewareContext) => Promise<CompletionResponse>
  ): Promise<CompletionResponse> {
    // Get sorted and enabled middleware
    const activeMiddleware = this.getSortedMiddleware();

    // Build the execution chain
    let index = 0;

    const next: NextFunction = async (ctx: MiddlewareContext): Promise<CompletionResponse> => {
      if (index >= activeMiddleware.length) {
        // All middleware executed, call the final handler
        return handler(ctx);
      }

      const currentMiddleware = activeMiddleware[index++];
      if (!currentMiddleware) {
        return handler(ctx);
      }
      return currentMiddleware.process(ctx, next);
    };

    return next(context);
  }

  /**
   * Gets sorted middleware (by priority, ascending)
   *
   * @returns Sorted array of enabled middleware
   */
  private getSortedMiddleware(): IMiddleware[] {
    const entries = Array.from(this.middleware.values())
      .filter((entry) => entry.enabled)
      .sort((a, b) => a.priority - b.priority);

    return entries.map((entry) => entry.middleware);
  }
}
