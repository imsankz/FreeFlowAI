import { ChatCompletionRequest, ExecuteTierFunction, ChatMessage } from '../types.js';

/**
 * Resolves an image URL (data URI or HTTP/HTTPS link) to a base64 string and mimeType.
 */
async function resolveImageUrl(url: string): Promise<{ mimeType: string; base64Data: string } | null> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        mimeType: match[1],
        base64Data: match[2],
      };
    }
    return null;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  return {
    mimeType: contentType,
    base64Data,
  };
}

/**
 * Translates OpenAI messages (including multimodal) into the Gemini Content representation.
 */
async function translateContentToParts(content: any): Promise<any[]> {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  if (Array.isArray(content)) {
    const parts: any[] = [];
    for (const item of content) {
      if (item.type === 'text') {
        parts.push({ text: item.text });
      } else if (item.type === 'image_url') {
        const url = item.image_url?.url;
        if (url) {
          try {
            const resolved = await resolveImageUrl(url);
            if (resolved) {
              parts.push({
                inlineData: {
                  mimeType: resolved.mimeType,
                  data: resolved.base64Data,
                }
              });
            }
          } catch (err) {
            console.error(`Failed to resolve image URL: ${url}`, err);
          }
        }
      }
    }
    return parts;
  }

  return [];
}

async function translateToGeminiContents(messages: ChatMessage[]) {
  const contents: any[] = [];
  let systemInstruction: any = undefined;

  for (const msg of messages) {
    const parts = await translateContentToParts(msg.content);
    if (msg.role === 'system') {
      systemInstruction = {
        role: 'user', // Gemini system instructions use 'user' role parts
        parts
      };
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts
      });
    }
  }
  return { contents, systemInstruction };
}

/**
 * Creates a TransformStream to parse Gemini SSE tokens and map them to OpenAI chunks.
 */
function createGeminiTransformStream(modelId: string) {
  let buffer = '';
  const decoder = new TextDecoder();

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep the incomplete line in the buffer

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data:')) continue;
        const dataStr = line.replace(/^data:\s*/, '').trim();
        
        if (dataStr === '[DONE]') {
           controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
           continue;
        }

        try {
          const geminiChunk = JSON.parse(dataStr);
          const textPart = geminiChunk?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const finishReason = geminiChunk?.candidates?.[0]?.finishReason || null;

          if (textPart || finishReason) {
            const openAIChunk = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: modelId,
              choices: [
                {
                  index: 0,
                  delta: { content: textPart },
                  // Standardize finish reasons
                  finish_reason: finishReason ? (finishReason === 'STOP' ? 'stop' : finishReason) : null,
                }
              ]
            };
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
          }
        } catch (err) {
          // Incomplete chunk or parse error - ignore and continue reading
        }
      }
    },
    flush(controller) {
      // Optional final cleanup
    }
  });
}

/**
 * Gemini Tier Adapter
 * 
 * Proxies OpenAI payloads to the Google Gemini API (gemini-1.5-flash).
 */
export const executeGemini: ExecuteTierFunction = async (req, signal) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const modelId = 'gemini-2.5-flash';
  const { contents, systemInstruction } = await translateToGeminiContents(req.messages);

  const payload: any = {
    contents,
    generationConfig: {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.max_tokens,
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }

  const baseUrl = `https://generativelanguage.googleapis.com/v1/models/${modelId}`;
  
  if (req.stream) {
    const url = `${baseUrl}:streamGenerateContent?alt=sse&key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini HTTP error: ${response.status} - ${response.statusText}`);
    }

    const transformStream = createGeminiTransformStream(modelId);
    const stream = response.body?.pipeThrough(transformStream);
    
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } else {
    // Non-streaming Gemini API call
    const url = `${baseUrl}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini HTTP error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const openAIResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textPart,
          },
          finish_reason: data?.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : (data?.candidates?.[0]?.finishReason || 'stop'),
        },
      ],
      usage: {
        prompt_tokens: data?.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data?.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data?.usageMetadata?.totalTokenCount || 0,
      }
    };

    return new Response(JSON.stringify(openAIResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
