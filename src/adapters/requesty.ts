import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';

/**
 * Requesty AI Router Adapter
 *
 * Proxy to Requesty AI's router endpoint (https://router.requesty.ai/v1/chat/completions)
 * Supports various free tier models.
 */

// List of free Requesty AI models (default if REQUESTY_MODELS not configured)
// Note: nemotron-3-ultra-550b-a55b may not be available
const DEFAULT_REQUESTY_MODELS = [
  'nemotron-3-super-120b-a12b',
  'gemma-4-31b-it',
  'nemotron-3-nano-omni-30b-a3b-reasoning',
  'nemotron-3-nano-30b-a3b',
  'nemotron-3.5-content-safety',
  'laguna-m.1',
  'laguna-xs.2'
];

// Load configured models from environment variable
const getRequestyModels = (): string[] => {
  const configured = process.env.REQUESTY_MODELS;
  if (configured) {
    return configured.split(',').map(model => model.trim()).filter(model => model.length > 0);
  }
  return DEFAULT_REQUESTY_MODELS;
};

// Round-robin counter for model selection
let modelIndex = 0;

// Get next model using round-robin
const getNextRequestyModel = (): string => {
  const models = getRequestyModels();
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
