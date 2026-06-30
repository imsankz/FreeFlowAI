import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';

/**
 * Groq Cloud Tier Adapter
 *
 * Groq supports the OpenAI API spec, so we proxy requests directly.
 * Free tier includes models like Llama 3.3 70B and Mixtral.
 */

// List of free Groq models (default if GROQ_MODELS not configured)
const DEFAULT_GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3.6-27b'
];

// Load configured models from environment variable
const getGroqModels = (): string[] => {
  const configured = process.env.GROQ_MODELS;
  if (configured) {
    return configured.split(',').map(model => model.trim()).filter(model => model.length > 0);
  }
  return DEFAULT_GROQ_MODELS;
};

// Round-robin counter for model selection
let modelIndex = 0;

// Get next model using round-robin
const getNextGroqModel = (): string => {
  const models = getGroqModels();
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
