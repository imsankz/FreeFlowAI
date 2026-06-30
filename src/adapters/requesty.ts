import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';
import { freeModelsManager } from '../free-models-manager.js';

/**
 * Requesty AI Router Adapter
 *
 * Proxy to Requesty AI's router endpoint (https://router.requesty.ai/v1/chat/completions)
 * Supports various free tier models.
 */

// Round-robin counter for model selection
let modelIndex = 0;

// Get next model using round-robin
const getNextRequestyModel = (): string => {
  const models = freeModelsManager.getModelsByProvider('requesty')
    .filter(model => model.available)
    .map(model => model.modelId);

  if (models.length === 0) {
    throw new Error('No available Requesty AI models');
  }

  const model = models[modelIndex % models.length];
  modelIndex++;
  return model;
};

export const executeRequesty: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.REQUESTY_API_KEY;
  if (!apiKey) {
    throw new Error('REQUESTY_API_KEY is not set');
  }

  // Select next model using round-robin load balancing
  const targetModel = getNextRequestyModel();

  const requestyReq: ChatCompletionRequest = {
    ...req,
    model: targetModel,
  };

  try {
    const response = await fetch('https://router.requesty.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestyReq),
      signal,
    });

    if (!response.ok) {
      // If model not found or unavailable, try to list available models
      if (response.status === 404 || response.status === 400) {
        console.warn(`Model ${targetModel} not available, attempting to find another model...`);
        throw new Error(`Model ${targetModel} not available on Requesty AI`);
      }
      throw new Error(`Requesty AI HTTP error: ${response.status} - ${response.statusText}`);
    }

    return response;

  } catch (error) {
    console.error(`Requesty AI request failed: ${error}`);
    throw error;
  }
};
