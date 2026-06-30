import { ChatCompletionRequest, ExecuteTierFunction } from '../types.js';

/**
 * Requesty AI Router Adapter
 *
 * Proxy to Requesty AI's router endpoint (https://router.requesty.ai/v1/chat/completions)
 * Supports various free tier models.
 */

export const executeRequesty: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.REQUESTY_API_KEY;
  if (!apiKey) {
    throw new Error('REQUESTY_API_KEY is not set');
  }

  // Optionally allow configuring model via environment variable
  const targetModel = process.env.REQUESTY_MODEL || 'xai/grok-4';

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
      throw new Error(`Requesty AI HTTP error: ${response.status} - ${response.statusText}`);
    }

    return response;

  } catch (error) {
    console.error(`Requesty AI request failed: ${error}`);
    throw error;
  }
};
