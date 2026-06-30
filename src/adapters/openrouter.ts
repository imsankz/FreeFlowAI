import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';

/**
 * OpenRouter Tier Adapter
 * 
 * OpenRouter natively supports the OpenAI API spec, so we just proxy the request 
 * through, swapping out the model to the free tier target.
 */
export const executeOpenRouter: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  // Enforce the requested free-tier model
  const targetModel = 'meta-llama/llama-3-8b-instruct:free';

  const openRouterReq: ChatCompletionRequest = {
    ...req,
    model: targetModel,
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(openRouterReq),
    signal,
  });

  if (!response.ok) {
    throw new Error(`OpenRouter HTTP error: ${response.status} - ${response.statusText}`);
  }

  // OpenRouter response is already exactly matching the OpenAI format (streaming and non-streaming)
  return response;
};
