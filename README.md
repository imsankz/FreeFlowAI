# FreeFlowAI

A **Zero-Config, Self-Healing Free-Tier Maximizer** designed for content creators and indie hackers. It runs locally or on edge functions, aggregates free-tier AI endpoints, and automatically handles failovers silently.

---

## Architecture & Integration Modes

You can run FreeFlowAI in two ways:

### Mode A: Hosted/Centralized Proxy (Recommended)
Deploy FreeFlowAI once (e.g., to Cloudflare Workers or Vercel Edge). All your projects, tools, and pipelines point their client SDKs to this single, shared proxy URL.
* **Why it's better:** Manage all your API keys in one dashboard. If rate-limits occur, all connected applications immediately share the routing/fallback cache, reducing redundant timeouts.

### Mode B: Embedded
Copy the source code directly into your repository to package it along with your application or API routes.

---

## 🗝️ API Key Setup

To use FreeFlowAI, you need to obtain API keys for the AI providers you want to use. Here's how to get them:

### OpenRouter API Key
1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up or log in
3. Go to [API Keys](https://openrouter.ai/keys)
4. Create a new API key
5. Add to `.env` as `OPENROUTER_API_KEY`

#### Multiple Models (Load Balancing)
FreeFlowAI supports load balancing across multiple OpenRouter models using round-robin. By default, it uses a list of popular models. You can customize this list:

```bash
# .env file (comma-separated model IDs)
OPENROUTER_MODELS="meta-llama/llama-3-8b-instruct,nousresearch/hermes-2-pro-mistral-7b,mistralai/mistral-7b-instruct-v0.2,google/gemini-1.5-flash-001,anthropic/claude-3-haiku-20240307"
```

#### Single Model
If you only want to use one specific OpenRouter model:

```bash
# .env file
OPENROUTER_MODELS="meta-llama/llama-3-8b-instruct"
```

#### Note on Free Tier
OpenRouter's free tier availability may vary over time. If you encounter model not found errors, check the [OpenRouter Models](https://openrouter.ai/models) page for the latest available models and update your configuration accordingly.

### Hugging Face API Key
1. Visit [Hugging Face](https://huggingface.co/)
2. Sign up or log in
3. Go to [Access Tokens](https://huggingface.co/settings/tokens)
4. Create a new token with "write" permissions
5. Add to `.env` as `HF_API_KEY`
6. Optional: Set `HF_MODEL_ID` to specify a custom model (default: `mistralai/Mistral-7B-Instruct-v0.2`)

### Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Sign up or log in with your Google account
3. Go to [API Keys](https://aistudio.google.com/apikey)
4. Create a new API key
5. Add to `.env` as `GEMINI_API_KEY`

### Fallback API (Custom Proxy)
If you want to add a custom fallback endpoint that supports the OpenAI API spec:
1. Set `FALLBACK_BASE_URL` to your proxy URL
2. Set `FALLBACK_API_KEY` to your proxy's API key
3. Set `FALLBACK_MODEL` to the default model name

## 🚀 Deploying the Proxy Server (Option A)

You can host FreeFlowAI easily across multiple platforms:

### 1. Cloudflare Workers (Edge runtime)
This project is optimized to run on the Edge with Cloudflare Workers.
* **Deploy**:
   ```bash
   npm install -g wrangler # Install wrangler globally
   wrangler login          # Log into your Cloudflare account
   
   # Set your API keys as secure environment variables
   wrangler secret put OPENROUTER_API_KEY
   wrangler secret put HF_API_KEY
   wrangler secret put GEMINI_API_KEY
   wrangler secret put PROXY_SECRET_TOKEN # Optional custom client auth token
   
   wrangler deploy         # Deploy to Cloudflare Edge
   ```

### 2. Vercel (Edge runtime)
Deploy seamlessly using the pre-configured [vercel.json](file:///Users/sankz/antigravity/FreeFlowAI/vercel.json) rewrite rules:
1. Connect this repository to your **Vercel** dashboard.
2. Set your environment variables in Vercel Project Settings:
   - `OPENROUTER_API_KEY`, `HF_API_KEY`, `GEMINI_API_KEY`, `PROXY_SECRET_TOKEN`
3. Hit Deploy. Vercel will automatically compile it under the Edge runtime.

### 3. Docker (Self-hosted or Render/Railway/GCP)
Build and run the container locally or push it to any cloud container service:
* **Build**:
  ```bash
  docker build -t freeflow-ai-proxy .
  ```
* **Run**:
  ```bash
  docker run -p 3000:3000 \
    -e GEMINI_API_KEY="your-key" \
    -e OPENROUTER_API_KEY="your-key" \
    -e HF_API_KEY="your-key" \
    freeflow-ai-proxy
  ```

### 4. Local Host / Local Daemon
To run it on your own machine in the background:
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environmental keys inside `.env` (copied from `.env.example`).
3. Run or build:
   ```bash
   npm run dev       # Development mode (hot reload)
   npm run build && npm start # Production mode
   ```

---


## 🛠️ Automated Plugging & Unplugging (via Antigravity Skill)

If you are pair programming with an **Antigravity AI Agent**, you can use the built-in skill to automatically integrate or completely remove FreeFlowAI from your codebase.

### To Install / Plug-In:
Ask your agent to trigger the `freeflow-integration` skill:
> "Install FreeFlowAI into my project pointing to my proxy URL at https://freeflow-ai.my-subdomain.workers.dev/v1"

The agent will:
1. Configure `.env` or `.env.local` automatically.
2. Scan the codebase for `new OpenAI(...)` client initializations.
3. Automatically wrap them to point to your new proxy.

### To Uninstall / Revert:
If you decide to remove it, simply tell the agent:
> "Uninstall FreeFlowAI from my codebase"

The agent will run the uninstallation script, restoring all modified files back to their exact original states and cleaning up environment configurations.

---

## How to Use It manually

Once your server is running (either locally at `http://localhost:3000` or hosted on Cloudflare Workers), point any standard OpenAI SDK or HTTP client to it. The proxy ignores the requested model and cascades through the enabled free-tier models.

### Example using the official OpenAI SDK:

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:3000/v1",             // Point to your proxy URL
  apiKey: process.env.FREEFLOW_PROXY_TOKEN || "none", // Proxy authentication
});

async function main() {
  const stream = await openai.chat.completions.create({
    model: "gpt-4", // The proxy ignores this and uses the free tiers!
    messages: [{ role: "user", content: "Hello, who are you?" }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();
```

---

## Architecture & Self-Healing
If a tier fails (e.g., rate limit, timeout, 503), the proxy intercepts the error and immediately attempts the next tier in the cascade. For streaming requests, if the stream disconnects mid-flight, the proxy injects an inline error message and closes the stream gracefully to prevent client crashes.

