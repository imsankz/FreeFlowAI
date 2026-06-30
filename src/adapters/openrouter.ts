import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';

/**
 * OpenRouter Tier Adapter
 *
 * OpenRouter natively supports the OpenAI API spec, so we just proxy the request
 * through, swapping out the model to the free tier target.
 */

// List of OpenRouter models that are typically available for free
// Note: Free tier availability may change over time
const DEFAULT_OPENROUTER_MODELS = [
  'meta-llama/llama-3-8b-instruct',
  'nousresearch/hermes-2-pro-mistral-7b',
  'mistralai/mistral-7b-instruct-v0.2',
  'google/gemini-1.5-flash-001',
  'anthropic/claude-3-haiku-20240307'
];

// Load configured models from environment variable
const getOpenRouterModels = (): string[] => {
  const configured = process.env.OPENROUTER_MODELS;
  if (configured) {
    return configured.split(',').map(model => model.trim()).filter(model => model.length > 0);
  }
  return DEFAULT_OPENROUTER_MODELS;
};

// Round-robin counter for model selection
let modelIndex = 0;

// Get next model using round-robin
const getNextOpenRouterModel = (): string => {
  const models = getOpenRouterModels();
  const model = models[modelIndex % models.length];
  modelIndex++;
  return model;
};

export const executeOpenRouter: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  // Select next model using round-robin load balancing
  const targetModel = getNextOpenRouterModel();

  const openRouterReq: ChatCompletionRequest = {
    ...req,
    model: targetModel,
  };

  try {
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
      // If model not found or unavailable, try to list available models
      if (response.status === 404 || response.status === 400) {
        console.warn(`Model ${targetModel} not available, attempting to find another model...`);
        // We could dynamically fetch available models here and try again
        throw new Error(`Model ${targetModel} not available on OpenRouter`);
      }
      throw new Error(`OpenRouter HTTP error: ${response.status} - ${response.statusText}`);
    }

    return response;

  } catch (error) {
    console.error(`OpenRouter request failed: ${error}`);
    throw error;
  }
};
