import { Context } from 'hono';
import { ImageGenerationRequest, ProxyError, ImageTierConfig, ExecuteImageTierFunction, TierFailure } from './types.js';
import { executeImageHuggingFace } from './adapters/image_huggingface.js';
import { executeImagePollinations } from './adapters/image_pollinations.js';
import { executeImageFallback } from './adapters/image_fallback.js';

/**
 * Image Generation Tiers configuration.
 */
export const imageTiers: ImageTierConfig[] = [
  {
    name: 'huggingface',
    enabled: !!process.env.HF_API_KEY,
    execute: executeImageHuggingFace,
  },
  {
    name: 'pollinations',
    enabled: true, // Completely free, no API key required
    execute: executeImagePollinations,
  },
  {
    name: 'fallback',
    enabled: !!(process.env.FALLBACK_IMAGE_API_KEY && process.env.FALLBACK_IMAGE_BASE_URL && process.env.FALLBACK_IMAGE_MODEL),
    execute: executeImageFallback,
  },
];

// Circuit Breaker State for Image Tiers
interface ImageTierState {
  consecutiveFailures: number;
  disabledUntil: number;
}

const tierStates: Record<string, ImageTierState> = {
  huggingface: { consecutiveFailures: 0, disabledUntil: 0 },
  pollinations: { consecutiveFailures: 0, disabledUntil: 0 },
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

async function executeWithTimeout(
  fetchFn: ExecuteImageTierFunction,
  req: ImageGenerationRequest,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Image tier timeout exceeded')), timeoutMs);

  try {
    const response = await fetchFn(req, controller.signal);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Core Cascade Engine for Image Generation
 */
export async function routeImageRequest(req: ImageGenerationRequest, c: Context): Promise<Response> {
  const enabledTiers = imageTiers.filter((t) => t.enabled);

  if (enabledTiers.length === 0) {
    const errObj: ProxyError = {
      error: {
        message: "No image generation tiers enabled.",
        type: "proxy_error",
        attempts: []
      }
    };
    return c.json(errObj, 500);
  }

  const timeoutMs = process.env.TIER_TIMEOUT_MS ? parseInt(process.env.TIER_TIMEOUT_MS, 10) : 30000; // Image generation can take longer, default 30s
  const attemptedFailures: TierFailure[] = [];

  // Load Balancing: Shuffle non-fallback tiers
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
      console.log(`[${new Date().toISOString()}] skipping image tier ${tier.name} (circuit breaker active, disabled until ${new Date(state.disabledUntil).toISOString()})`);
      return false;
    }
    return true;
  });

  if (tiersToTry.length === 0) {
    tiersToTry = prioritizedTiers;
  }

  for (const tier of tiersToTry) {
    const startTime = Date.now();

    try {
      const response = await executeWithTimeout(tier.execute, req, timeoutMs);

      const latency = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] image_requested prompt="${req.prompt}" tier_used=${tier.name} latency_ms=${latency} status=success`);

      // Reset circuit breaker state on success
      if (tierStates[tier.name]) {
        tierStates[tier.name].consecutiveFailures = 0;
        tierStates[tier.name].disabledUntil = 0;
      }

      return response;

    } catch (err: any) {
      const latency = Date.now() - startTime;
      const errMsg = err.message || err.name || 'Unknown Error';
      console.warn(`[${new Date().toISOString()}] image_requested prompt="${req.prompt}" tier_used=${tier.name} latency_ms=${latency} status=error reason="${errMsg}"`);

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
          console.warn(`[${new Date().toISOString()}] Image circuit breaker tripped for tier ${tier.name}. Disabling for ${COOLDOWN_MS / 1000}s.`);
        }
      }

      continue; // Trigger next tier
    }
  }

  console.log(`[${new Date().toISOString()}] image_requested prompt="${req.prompt}" tier_used=all_failed latency_ms=0 status=error reason="all image tiers exhausted"`);

  const errObj: ProxyError = {
    error: {
      message: "All image generation tiers exhausted. See attempts for details.",
      type: "proxy_error",
      attempts: attemptedFailures
    }
  };
  return c.json(errObj, 500);
}
