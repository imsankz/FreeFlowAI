import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';

/**
 * Fallback Tier Adapter
 * 
 * Proxies the request directly to an OpenAI-compatible endpoint.
 * Requires FALLBACK_API_KEY, FALLBACK_BASE_URL, and FALLBACK_MODEL.
 */
export const executeFallback: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.FALLBACK_API_KEY;
  const baseUrl = process.env.FALLBACK_BASE_URL;
  const fallbackModel = process.env.FALLBACK_MODEL;

  if (!apiKey || !baseUrl || !fallbackModel) {
    throw new Error('Fallback tier is missing required environment variables (FALLBACK_API_KEY, FALLBACK_BASE_URL, FALLBACK_MODEL)');
  }

  // Override model to the target fallback
  const fallbackReq: ChatCompletionRequest = {
    ...req,
    model: fallbackModel,
  };

  // Strip trailing slash from baseUrl if it exists to normalize route pathing
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const response = await fetch(`${normalizedBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(fallbackReq),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Fallback HTTP error: ${response.status} - ${response.statusText}`);
  }

  // Response format is assumed natively compatible
  return response;
};
