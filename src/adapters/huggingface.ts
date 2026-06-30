import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';

/**
 * HuggingFace Tier Adapter
 * 
 * Proxies OpenAI payloads to the HuggingFace Serverless Inference API.
 * Uses HuggingFace's OpenAI-compatible completions endpoint to avoid manual prompt templating and streaming parser logic.
 */
export const executeHuggingFace: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new Error('HF_API_KEY is not set');
  }

  const modelId = process.env.HF_MODEL_ID || 'mistralai/Mistral-7B-Instruct-v0.2';

  const hfReq: ChatCompletionRequest = {
    ...req,
    model: modelId,
  };

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(hfReq),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HuggingFace HTTP error: ${response.status} - ${response.statusText}${errorText ? ` (${errorText})` : ''}`);
  }

  return response;
};
