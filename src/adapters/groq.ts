import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';
import { freeModelsManager } from '../free-models-manager.js';

/**
 * Groq Cloud Tier Adapter
 *
 * Groq supports the OpenAI API spec, so we proxy requests directly.
 * Free tier includes models like Llama 3.3 70B and Mixtral.
 */

// Round-robin counter for model selection
let modelIndex = 0;

// Get next model using round-robin
const getNextGroqModel = (): string => {
  const models = freeModelsManager.getModelsByProvider('groq')
    .filter(model => model.available)
    .map(model => model.modelId);

  if (models.length === 0) {
    throw new Error('No available Groq models');
  }

  const model = models[modelIndex % models.length];
  modelIndex++;
  return model;
};

export const executeGroq: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  // Select next model using round-robin load balancing
  const targetModel = getNextGroqModel();

  const groqReq: ChatCompletionRequest = {
    ...req,
    model: targetModel,
  };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqReq),
      signal,
    });

    if (!response.ok) {
      // If model not found or unavailable, try to list available models
      if (response.status === 404 || response.status === 400) {
        console.warn(`Model ${targetModel} not available, attempting to find another model...`);
        freeModelsManager.updateModelAvailability('groq', targetModel, false);
        throw new Error(`Model ${targetModel} not available on Groq`);
      }
      throw new Error(`Groq HTTP error: ${response.status} - ${response.statusText}`);
    }

    return response;

  } catch (error) {
    console.error(`Groq request failed: ${error}`);
    throw error;
  }
};
