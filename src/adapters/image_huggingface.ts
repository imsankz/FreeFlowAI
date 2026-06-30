import { ExecuteImageTierFunction, ImageGenerationResponse } from '../types.js';

/**
 * HuggingFace Image Adapter
 * 
 * Generates an image using HuggingFace Serverless Inference.
 * Automatically handles raw binary responses and formats them to the OpenAI Image Generation spec.
 */
export const executeImageHuggingFace: ExecuteImageTierFunction = async (req, signal) => {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new Error('HF_API_KEY is not set');
  }

  const modelId = process.env.HF_IMAGE_MODEL_ID || 'black-forest-labs/FLUX.1-schnell';
  const url = `https://api-inference.huggingface.co/models/${modelId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs: req.prompt }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HuggingFace Image HTTP error: ${response.status} - ${response.statusText}${errorText ? ` (${errorText})` : ''}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');

  const format = req.response_format || 'url';
  const responseData: ImageGenerationResponse = {
    created: Math.floor(Date.now() / 1000),
    data: []
  };

  if (format === 'b64_json') {
    responseData.data.push({
      b64_json: base64Data
    });
  } else {
    // Return base64 encoded data URI as the URL
    responseData.data.push({
      url: `data:${contentType};base64,${base64Data}`
    });
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
