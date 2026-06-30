import { Hono } from 'hono';
import { ChatCompletionRequest, ImageGenerationRequest } from '../src/types.js';
import { routeRequest } from '../src/router.js';
import { routeImageRequest } from '../src/image_router.js';
import { initializeFreeModelsManager } from '../src/free-models-manager.js';
import { UpdateModelsSkill } from '../src/skills/update-models.js';
import { initializeMetricsTracker, metricsTracker } from '../src/metrics-tracker.js';

// Initialize free models manager (edge-compatible)
initializeFreeModelsManager().catch(error => {
  console.error('[Server] Failed to initialize free models manager:', error);
});

// Initialize metrics tracker (edge-compatible)
initializeMetricsTracker().catch(error => {
  console.error('[Server] Failed to initialize metrics tracker:', error);
});

const app = new Hono();

// Serve dashboard
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreeFlowAI Metrics</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    h1 {
      color: #111;
      margin-bottom: 1rem;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .metric-card {
      background: #f0f0f0;
      padding: 1.5rem;
      border-radius: 8px;
      text-align: center;
    }
    .metric-value {
      font-size: 2rem;
      font-weight: bold;
      color: #0070f3;
    }
    .metric-label {
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.5rem;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
    }
    .btn {
      background: #0070f3;
      color: white;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    .btn:hover {
      background: #0051cc;
    }
    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .loading {
      text-align: center;
      padding: 2rem;
      color: #666;
    }
    .error {
      color: #dc2626;
      background: #fee2e2;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FreeFlowAI Metrics</h1>

    <div id="error" class="error" style="display: none;"></div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value" id="totalCalls">0</div>
        <div class="metric-label">Total Calls</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" id="totalTokens">0</div>
        <div class="metric-label">Total Tokens</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" id="totalSaved">0</div>
        <div class="metric-label">Tokens Saved</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" id="totalCost">$0.00</div>
        <div class="metric-label">Total Cost</div>
      </div>
    </div>

    <h2>Calls per Provider</h2>
    <div class="table-container">
      <table id="callsPerProvider">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>

    <h2>Calls per Model</h2>
    <div class="table-container">
      <table id="callsPerModel">
        <thead>
          <tr>
            <th>Model</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>

    <h2>Tokens per Provider</h2>
    <div class="table-container">
      <table id="tokensPerProvider">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>

    <h2>Tokens per Model</h2>
    <div class="table-container">
      <table id="tokensPerModel">
        <thead>
          <tr>
            <th>Model</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>

    <h2>Cost per Provider</h2>
    <div class="table-container">
      <table id="costPerProvider">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Cost (USD)</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>

    <h2>Cost per Model</h2>
    <div class="table-container">
      <table id="costPerModel">
        <thead>
          <tr>
            <th>Model</th>
            <th>Cost (USD)</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>

    <div style="margin-top: 2rem;">
      <button class="btn" id="refreshBtn">Refresh Metrics</button>
      <button class="btn" id="resetBtn">Reset Metrics</button>
    </div>

    <div style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
      Last updated: <span id="lastUpdated">-</span>
    </div>
  </div>

  <script>
    const API_BASE = '/api';

    async function fetchMetrics() {
      try {
        const response = await fetch('' + API_BASE + '/metrics');
        if (!response.ok) {
          throw new Error('HTTP error! status: ' + response.status);
        }
        const data = await response.json();
        renderMetrics(data);
      } catch (error) {
        showError(error.message);
      }
    }

    function renderMetrics(data) {
      // Total metrics
      document.getElementById('totalCalls').textContent = data.totalCalls;
      document.getElementById('totalTokens').textContent = data.totalTokensUsed;
      document.getElementById('totalSaved').textContent = '$' + data.totalTokensSaved.toFixed(4);
      document.getElementById('totalCost').textContent = '$' + data.totalCost.toFixed(4);

      // Last updated
      document.getElementById('lastUpdated').textContent = new Date(data.lastUpdated).toLocaleString();

      // Calls per provider
      renderTable('callsPerProvider', data.callsPerProvider);

      // Calls per model
      renderTable('callsPerModel', data.callsPerModel);

      // Tokens per provider
      renderTable('tokensPerProvider', data.tokensPerProvider);

      // Tokens per model
      renderTable('tokensPerModel', data.tokensPerModel);

      // Cost per provider
      renderTable('costPerProvider', data.costPerProvider);

      // Cost per model
      renderTable('costPerModel', data.costPerModel);
    }

    function renderTable(tableId, data) {
      const tbody = document.querySelector('#' + tableId + ' tbody');
      tbody.innerHTML = '';

      Object.entries(data).forEach(([key, value]) => {
        const row = tbody.insertRow();
        const keyCell = row.insertCell();
        const valueCell = row.insertCell();
        keyCell.textContent = key;
        // Format cost values with $ and 4 decimal places
        valueCell.textContent = tableId.includes('cost') ? '$' + value.toFixed(4) : value;
      });
    }

    function showError(message) {
      const errorDiv = document.getElementById('error');
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }

    function hideError() {
      const errorDiv = document.getElementById('error');
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
    }

    async function resetMetrics() {
      if (!confirm('Are you sure you want to reset all metrics?')) {
        return;
      }

      try {
        const response = await fetch('' + API_BASE + '/metrics/reset', {
          method: 'POST'
        });

        if (!response.ok) {
          throw new Error('HTTP error! status: ' + response.status);
        }

        fetchMetrics();
      } catch (error) {
        showError(error.message);
      }
    }

    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', fetchMetrics);
    document.getElementById('resetBtn').addEventListener('click', resetMetrics);

    // Initial fetch
    fetchMetrics();

    // Refresh every 10 seconds
    setInterval(fetchMetrics, 10000);
  </script>
</body>
</html>
  `);
});

// Register skills
UpdateModelsSkill.register(app);

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

export const config = {
  runtime: 'edge',
};

export default app;
