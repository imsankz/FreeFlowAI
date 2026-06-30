import { ExecuteImageTierFunction, ImageGenerationResponse } from '../types.js';

/**
 * Pollinations Image Adapter
 * 
 * Generates an image using Pollinations AI (completely free, zero-auth).
 * If URL format is requested, returns the Pollinations URL directly (extremely fast).
 * If b64_json is requested, fetches the generated image and converts it.
 */
export const executeImagePollinations: ExecuteImageTierFunction = async (req, signal) => {
  const seed = Math.floor(Math.random() * 1000000);
  const promptEncoded = encodeURIComponent(req.prompt);
  
  // Custom configurations based on size requested if any
  let width = 1024;
  let height = 1024;
  if (req.size) {
    const sizeParts = req.size.split('x');
    if (sizeParts.length === 2) {
      width = parseInt(sizeParts[0], 10) || 1024;
      height = parseInt(sizeParts[1], 10) || 1024;
    }
  }

  const imageUrl = `https://image.pollinations.ai/prompt/${promptEncoded}?nologo=true&private=true&width=${width}&height=${height}&seed=${seed}`;

  const format = req.response_format || 'url';
  const responseData: ImageGenerationResponse = {
    created: Math.floor(Date.now() / 1000),
    data: []
  };

  if (format === 'b64_json') {
    // We must fetch the image bytes to convert to base64
    const response = await fetch(imageUrl, { signal });
    if (!response.ok) {
      throw new Error(`Pollinations HTTP error: ${response.status} - ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    responseData.data.push({
      b64_json: base64Data
    });
  } else {
    // Fast path: return the URL directly
    responseData.data.push({
      url: imageUrl
    });
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
