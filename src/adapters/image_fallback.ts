import { ExecuteImageTierFunction, ImageGenerationRequest } from '../types.js';

/**
 * Fallback Image Adapter
 * 
 * Proxies image generation requests directly to an OpenAI-compatible endpoint.
 * Requires FALLBACK_IMAGE_API_KEY, FALLBACK_IMAGE_BASE_URL, and FALLBACK_IMAGE_MODEL.
 */
export const executeImageFallback: ExecuteImageTierFunction = async (req, signal) => {
  const apiKey = process.env.FALLBACK_IMAGE_API_KEY;
  const baseUrl = process.env.FALLBACK_IMAGE_BASE_URL;
  const fallbackModel = process.env.FALLBACK_IMAGE_MODEL;

  if (!apiKey || !baseUrl || !fallbackModel) {
    throw new Error('Fallback image tier is missing required environment variables (FALLBACK_IMAGE_API_KEY, FALLBACK_IMAGE_BASE_URL, FALLBACK_IMAGE_MODEL)');
  }

  const fallbackReq: ImageGenerationRequest = {
    ...req,
    model: fallbackModel,
  };

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const response = await fetch(`${normalizedBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(fallbackReq),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Fallback Image HTTP error: ${response.status} - ${response.statusText}${errorText ? ` (${errorText})` : ''}`);
  }

  return response;
};
