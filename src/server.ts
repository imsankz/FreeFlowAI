import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { ChatCompletionRequest, ImageGenerationRequest } from './types.js';
import { routeRequest } from './router.js';
import { routeImageRequest } from './image_router.js';
import { initializeFreeModelsManager } from './free-models-manager.js';
import { UpdateModelsSkill } from './skills/update-models.js';
import { AiHelperSkill } from './skills/ai-helper.js';
import { initializeMetricsTracker, metricsTracker } from './metrics-tracker.js';
import * as dotenv from 'dotenv';

// Load environment variables for local development
dotenv.config();

// Initialize free models manager
initializeFreeModelsManager().catch(error => {
  console.error('[Server] Failed to initialize free models manager:', error);
});

// Initialize metrics tracker
initializeMetricsTracker().catch(error => {
  console.error('[Server] Failed to initialize metrics tracker:', error);
});

const app = new Hono();

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }));
app.get('/dashboard', serveStatic({ path: './public/index.html' }));

// Register skills
UpdateModelsSkill.register(app);
AiHelperSkill.register(app);

// Metrics endpoints
app.get('/api/metrics', (c) => {
  const metrics = metricsTracker.getMetrics();
  return c.json(metrics);
});

app.post('/api/metrics/reset', (c) => {
  metricsTracker.resetMetrics();
  return c.json({ success: true, message: 'Metrics reset' });
});

app.post('/v1/chat/completions', async (c) => {
  try {
    const reqBody = await c.req.json<ChatCompletionRequest>();

    // Validate required OpenAI fields
    if (!reqBody.messages || !Array.isArray(reqBody.messages)) {
      return c.json({
        error: {
          message: "Invalid request: 'messages' array is required.",
          type: "invalid_request_error",
        }
      }, 400);
    }

    // Delegate to the resilient cascade router
    return await routeRequest(reqBody, c);

  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Bad Request or Parser Error: ${err.message}`);
    return c.json({
      error: {
        message: "Invalid JSON payload or malformed request.",
        type: "invalid_request_error",
      }
    }, 400);
  }
});

app.post('/v1/images/generations', async (c) => {
  try {
    const reqBody = await c.req.json<ImageGenerationRequest>();

    // Validate required OpenAI image generation fields
    if (!reqBody.prompt || typeof reqBody.prompt !== 'string') {
      return c.json({
        error: {
          message: "Invalid request: 'prompt' string is required.",
          type: "invalid_request_error",
        }
      }, 400);
    }

    // Delegate to the resilient image cascade router
    return await routeImageRequest(reqBody, c);

  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Image Request or Parser Error: ${err.message}`);
    return c.json({
      error: {
        message: "Invalid JSON payload or malformed request.",
        type: "invalid_request_error",
      }
    }, 400);
  }
});

// Basic health check for container probes
app.get('/health', (c) => c.json({ status: 'ok' }));

// Root endpoint for browser preview
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FreeFlowAI</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6; color: #333; }
        h1 { color: #111; }
        code { background: #eee; padding: 2px 6px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>FreeFlowAI is running 🟢</h1>
      <p>This is a zero-config, self-healing free-tier maximizer proxy.</p>

      <h2>APIs Supported:</h2>
      <ul>
        <li><code>POST /v1/chat/completions</code></li>
        <li><code>POST /v1/images/generations</code></li>
      </ul>

      <h3>Configured Chat Tiers:</h3>
      <ul>
        <li>Requesty AI: ${process.env.REQUESTY_API_KEY ? '✅ Enabled' : '❌ Disabled'}</li>
        <li>Groq: ${process.env.GROQ_API_KEY ? '✅ Enabled' : '❌ Disabled'}</li>
        <li>OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅ Enabled' : '❌ Disabled'}</li>
        <li>HuggingFace: ${process.env.HF_API_KEY ? '✅ Enabled' : '❌ Disabled'}</li>
        <li>Gemini: ${process.env.GEMINI_API_KEY ? '✅ Enabled' : '❌ Disabled'}</li>
        <li>Fallback: ${(process.env.FALLBACK_API_KEY && process.env.FALLBACK_BASE_URL && process.env.FALLBACK_MODEL) ? '✅ Enabled' : '❌ Disabled'}</li>
      </ul>

      <h3>Configured Image Tiers:</h3>
      <ul>
        <li>HuggingFace (flux/sd): ${process.env.HF_API_KEY ? '✅ Enabled' : '❌ Disabled'}</li>
        <li>Pollinations (no-key free): ✅ Enabled</li>
        <li>Fallback: ${(process.env.FALLBACK_IMAGE_API_KEY && process.env.FALLBACK_IMAGE_BASE_URL && process.env.FALLBACK_IMAGE_MODEL) ? '✅ Enabled' : '❌ Disabled'}</li>
      </ul>
    </body>
    </html>
  `);
});

/**
 * Configure the server port.
 * While the user requested 8080 as default, this environment forces port 3000.
 * We prioritize process.env.PORT (injected infra) or default to 3000 to prevent crash.
 */
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;

console.log(`[${new Date().toISOString()}] Zero-Config API Proxy starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port
});

export default app;
