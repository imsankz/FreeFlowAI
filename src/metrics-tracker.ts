import { config } from 'dotenv';
config();

/**
 * Interface for metrics data
 */
interface MetricsData {
  // Total calls
  totalCalls: number;
  // Calls per provider
  callsPerProvider: Record<string, number>;
  // Calls per model
  callsPerModel: Record<string, number>;
  // Total tokens used
  totalTokensUsed: number;
  // Total tokens saved
  totalTokensSaved: number;
  // Tokens per provider
  tokensPerProvider: Record<string, number>;
  // Tokens per model
  tokensPerModel: Record<string, number>;
  // Start time
  startTime: Date;
  // Last updated time
  lastUpdated: Date;
}

/**
 * Metrics tracker class
 */
export class MetricsTracker {
  private metrics: MetricsData = {
    totalCalls: 0,
    callsPerProvider: {},
    callsPerModel: {},
    totalTokensUsed: 0,
    totalTokensSaved: 0,
    tokensPerProvider: {},
    tokensPerModel: {},
    startTime: new Date(),
    lastUpdated: new Date()
  };

  /**
   * Record a call to a provider and model
   */
  recordCall(provider: string, model: string, tokensUsed: number, tokensSaved: number = 0): void {
    // Increment total calls
    this.metrics.totalCalls++;

    // Increment calls per provider
    if (!this.metrics.callsPerProvider[provider]) {
      this.metrics.callsPerProvider[provider] = 0;
    }
    this.metrics.callsPerProvider[provider]++;

    // Increment calls per model
    if (!this.metrics.callsPerModel[model]) {
      this.metrics.callsPerModel[model] = 0;
    }
    this.metrics.callsPerModel[model]++;

    // Increment total tokens used
    this.metrics.totalTokensUsed += tokensUsed;

    // Increment total tokens saved
    this.metrics.totalTokensSaved += tokensSaved;

    // Increment tokens per provider
    if (!this.metrics.tokensPerProvider[provider]) {
      this.metrics.tokensPerProvider[provider] = 0;
    }
    this.metrics.tokensPerProvider[provider] += tokensUsed;

    // Increment tokens per model
    if (!this.metrics.tokensPerModel[model]) {
      this.metrics.tokensPerModel[model] = 0;
    }
    this.metrics.tokensPerModel[model] += tokensUsed;

    // Update last updated time
    this.metrics.lastUpdated = new Date();

    // Log metrics
    console.log(`[MetricsTracker] Call recorded: ${provider} - ${model}`);
    console.log(`[MetricsTracker] Total calls: ${this.metrics.totalCalls}`);
    console.log(`[MetricsTracker] Total tokens used: ${this.metrics.totalTokensUsed}`);
    console.log(`[MetricsTracker] Total tokens saved: ${this.metrics.totalTokensSaved}`);
  }

  /**
   * Get all metrics
   */
  getMetrics(): MetricsData {
    return this.metrics;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalCalls: 0,
      callsPerProvider: {},
      callsPerModel: {},
      totalTokensUsed: 0,
      totalTokensSaved: 0,
      tokensPerProvider: {},
      tokensPerModel: {},
      startTime: new Date(),
      lastUpdated: new Date()
    };

    console.log('[MetricsTracker] Metrics reset');
  }

  /**
   * Get metrics as a JSON object
   */
  toJSON(): MetricsData {
    return this.metrics;
  }
}

/**
 * Singleton instance of MetricsTracker
 */
export const metricsTracker = new MetricsTracker();

/**
 * Initialize the metrics tracker
 */
export async function initializeMetricsTracker(): Promise<void> {
  console.log('[MetricsTracker] Metrics tracker initialized');
}
