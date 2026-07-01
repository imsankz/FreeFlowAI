import { Context } from 'hono';
import { ChatCompletionRequest, ProxyError, TierConfig, ExecuteTierFunction, TierFailure } from './types.js';
import { executeRequesty } from './adapters/requesty.js';
import { executeGroq } from './adapters/groq.js';
import { executeOpenRouter } from './adapters/openrouter.js';
import { executeHuggingFace } from './adapters/huggingface.js';
import { executeGemini } from './adapters/gemini.js';
import { executeFallback } from './adapters/fallback.js';
import { metricsTracker } from './metrics-tracker.js';

/**
 * The prioritized list of all available tiers. 
 * Disabled dynamically if their required env vars are absent.
 */
export function getEnabledTiers(): TierConfig[] {
  return [
    {
      name: 'groq',
      enabled: !!process.env.GROQ_API_KEY,
      execute: executeGroq,
    },
    {
      name: 'requesty',
      enabled: !!process.env.REQUESTY_API_KEY,
      execute: executeRequesty,
    },
    {
      name: 'openrouter',
      enabled: !!process.env.OPENROUTER_API_KEY,
      execute: executeOpenRouter,
    },
    {
      name: 'huggingface',
      enabled: !!process.env.HF_API_KEY,
      execute: executeHuggingFace,
    },
    {
      name: 'gemini',
      enabled: !!process.env.GEMINI_API_KEY,
      execute: executeGemini,
    },
    {
      name: 'fallback',
      enabled: !!(process.env.FALLBACK_API_KEY && process.env.FALLBACK_BASE_URL && process.env.FALLBACK_MODEL),
      execute: executeFallback,
    },
  ].filter(t => t.enabled);
}

// Circuit Breaker State
interface TierState {
  consecutiveFailures: number;
  disabledUntil: number;
}

const tierStates: Record<string, TierState> = {
  requesty: { consecutiveFailures: 0, disabledUntil: 0 },
  groq: { consecutiveFailures: 0, disabledUntil: 0 },
  openrouter: { consecutiveFailures: 0, disabledUntil: 0 },
  huggingface: { consecutiveFailures: 0, disabledUntil: 0 },
  gemini: { consecutiveFailures: 0, disabledUntil: 0 },
  fallback: { consecutiveFailures: 0, disabledUntil: 0 },
};

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60000; // 60 seconds

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Wraps an execute function in an AbortController based timeout.
 * Rejects the promise if the timeout is hit, forcing the cascade to advance.
 */
async function executeWithTimeout(
  fetchFn: ExecuteTierFunction,
  req: ChatCompletionRequest,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Tier timeout exceeded')), timeoutMs);

  try {
    const response = await fetchFn(req, controller.signal);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Core Cascade Engine
 * 
 * Iterates through configured tiers in priority order.
 * Triggers self-healing cascade on HTTP errors, network failures, or timeouts.
 * Applies streaming-specific fallback behavior per architectural requirements.
 */
export async function routeRequest(req: ChatCompletionRequest, c: Context): Promise<Response> {
  const enabledTiers = getEnabledTiers();
  
  if (enabledTiers.length === 0) {
    const errObj: ProxyError = {
      error: {
        message: "No backend tiers enabled. Configure environment variables first.",
        type: "proxy_error",
        attempts: []
      }
    };
    return c.json(errObj, 500);
  }

  const timeoutMs = process.env.TIER_TIMEOUT_MS ? parseInt(process.env.TIER_TIMEOUT_MS, 10) : 15000;
  const originalModel = req.model;
  const attemptedFailures: TierFailure[] = [];

  // Load Balancing: Shuffle primary tiers (excluding fallback) to distribute traffic
  const isLoadBalancing = process.env.LOAD_BALANCING !== 'false';
  let primaryTiers = enabledTiers.filter(t => t.name !== 'fallback');
  const fallbackTier = enabledTiers.find(t => t.name === 'fallback');

  if (isLoadBalancing) {
    primaryTiers = shuffleArray(primaryTiers);
  }

  const prioritizedTiers = fallbackTier ? [...primaryTiers, fallbackTier] : primaryTiers;

  // Circuit Breaker: Filter out disabled/cooling-down tiers
  const now = Date.now();
  let tiersToTry = prioritizedTiers.filter(tier => {
    const state = tierStates[tier.name];
    if (state && state.disabledUntil > now) {
      console.log(`[${new Date().toISOString()}] skipping tier ${tier.name} (circuit breaker active, disabled until ${new Date(state.disabledUntil).toISOString()})`);
      return false;
    }
    return true;
  });

  // If all tiers are blocked, try all of them as a safety fallback
  if (tiersToTry.length === 0) {
    tiersToTry = prioritizedTiers;
  }
  
  for (const tier of tiersToTry) {
    const startTime = Date.now();
    
    try {
      const response = await executeWithTimeout(tier.execute, req, timeoutMs);
      
      // Handle streaming resiliency rules
      if (req.stream && response.body) {
        let firstByteSent = false;
        
        // This transform stream lets us monitor when the first byte of data actually 
        // enters the pipeline bound for the client.
        const transformStream = new TransformStream({
          start() {},
          transform(chunk, controller) {
            firstByteSent = true;
            controller.enqueue(chunk);
          },
          flush() {}
        });
        
        // We wrap the reading in our own ReadableStream so we can catch interruptions 
        // during stream piping. 
        const resilientStream = new ReadableStream({
          async start(controller) {
            const reader = response.body!.pipeThrough(transformStream).getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
              controller.close();
              const latency = Date.now() - startTime;
              console.log(`[${new Date().toISOString()}] model_requested=${originalModel} tier_used=${tier.name} latency_ms=${latency} status=success`);

                      // Record metrics for streaming response (token count unavailable in stream)
              metricsTracker.recordCall(tier.name, originalModel, 0, 0);
            } catch (err) {
              const latency = Date.now() - startTime;
              console.error(`[${new Date().toISOString()}] Stream interrupted on tier ${tier.name}: ${err}`);
              
              if (firstByteSent) {
                // Requirement 4: Stream failed AFTER starting. Do NOT cascade. 
                // Instead, flush an inline error chunk and terminate gracefully.
                const errorChunk = `data: {"id":"chatcmpl-error","object":"chat.completion.chunk","choices":[{"delta":{"content":"\\n\\n[proxy: upstream disconnected, response may be incomplete]"},"finish_reason":"stop","index":0}]}\n\ndata: [DONE]\n\n`;
                controller.enqueue(new TextEncoder().encode(errorChunk));
                controller.close();
                console.log(`[${new Date().toISOString()}] model_requested=${originalModel} tier_used=${tier.name} latency_ms=${latency} status=error reason="stream failed mid-flight"`);
              } else {
                // Requirement 4: Stream failed BEFORE starting. Throw to advance cascade.
                throw err;
              }
            }
          }
        });

        // Reset circuit breaker state on success
        if (tierStates[tier.name]) {
          tierStates[tier.name].consecutiveFailures = 0;
          tierStates[tier.name].disabledUntil = 0;
        }
        
        // Return response immediately, stream processing happens asynchronously
        return new Response(resilientStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          }
        });
      }

      // Handle standard non-streaming successful response
      const latency = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] model_requested=${originalModel} tier_used=${tier.name} latency_ms=${latency} status=success`);

      // Parse response to get token usage
      let tokensUsed = 0;
      let responseBody = null;
      try {
        const responseText = await response.text();
        responseBody = JSON.parse(responseText);
        if (responseBody.usage && responseBody.usage.total_tokens) {
          tokensUsed = responseBody.usage.total_tokens;
        }
      } catch (parseError) {
        console.warn(`[${new Date().toISOString()}] Failed to parse response for metrics: ${parseError}`);
      }

      // Calculate tokens saved (difference between paid model cost and free model cost)
      const COST_PER_1K_TOKENS: Record<string, number> = {
        'gpt-4': 0.03,
        'gpt-4-turbo': 0.01,
        'gpt-3.5-turbo': 0.0015,
        'groq': 0,
        'requesty': 0,
        'openrouter': 0,
        'huggingface': 0,
        'gemini': 0,
        'fallback': 0
      };

      const paidCostPerToken = (COST_PER_1K_TOKENS[originalModel] || 0.03) / 1000;
      const freeCostPerToken = (COST_PER_1K_TOKENS[tier.name] || 0) / 1000;
      const tokensSaved = tokensUsed * (paidCostPerToken - freeCostPerToken);

      // Record metrics
      metricsTracker.recordCall(tier.name, originalModel, tokensUsed, tokensSaved);

      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', 'application/json');

      // Reset circuit breaker state on success
      if (tierStates[tier.name]) {
        tierStates[tier.name].consecutiveFailures = 0;
        tierStates[tier.name].disabledUntil = 0;
      }

      return new Response(responseBody ? JSON.stringify(responseBody) : '{}', {
        status: response.status,
        headers: responseHeaders,
      });

    } catch (err: any) {
      // Self-healing cascade: log the error and allow loop to advance to next tier
      const latency = Date.now() - startTime;
      const errMsg = err.message || err.name || 'Unknown Error';
      console.warn(`[${new Date().toISOString()}] model_requested=${originalModel} tier_used=${tier.name} latency_ms=${latency} status=error reason="${errMsg}"`);
      
      // Parse status if present in error message
      let status: number | undefined = undefined;
      const statusMatch = errMsg.match(/status: (\d{3})/i) || errMsg.match(/HTTP error: (\d{3})/i);
      if (statusMatch) {
        status = parseInt(statusMatch[1], 10);
      }

      attemptedFailures.push({
        tier: tier.name,
        error: errMsg,
        status
      });

      // Increment failures for circuit breaker
      const state = tierStates[tier.name];
      if (state) {
        state.consecutiveFailures += 1;
        if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
          state.disabledUntil = Date.now() + COOLDOWN_MS;
          console.warn(`[${new Date().toISOString()}] Circuit breaker tripped for tier ${tier.name}. Disabling for ${COOLDOWN_MS / 1000}s.`);
        }
      }

      continue; // Trigger next tier
    }
  }

  // If all tiers fail
  console.log(`[${new Date().toISOString()}] model_requested=${originalModel} tier_used=all_failed latency_ms=0 status=error reason="all tiers exhausted"`);
  
  const errObj: ProxyError = {
    error: {
      message: "All tiers exhausted. See attempts for details.",
      type: "proxy_error",
      attempts: attemptedFailures
    }
  };
  return c.json(errObj, 500);
}
