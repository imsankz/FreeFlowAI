import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';
import { freeModelsManager } from '../free-models-manager.js';

/**
 * OpenRouter Tier Adapter
 *
 * OpenRouter natively supports the OpenAI API spec, so we just proxy the request
 * through, swapping out the model to the free tier target.
 */

// Round-robin counter for model selection
let modelIndex = 0;

// Get next model using round-robin
const getNextOpenRouterModel = (): string => {
  const models = freeModelsManager.getModelsByProvider('openrouter')
    .filter(model => model.available)
    .map(model => model.modelId);

  if (models.length === 0) {
    throw new Error('No available OpenRouter models');
  }

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
        freeModelsManager.updateModelAvailability('openrouter', targetModel, false);
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
