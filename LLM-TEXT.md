# What is FreeFlowAI?

FreeFlowAI is a **zero-config, self-healing free-tier maximizer proxy** for AI models. It aggregates multiple free/cheap AI providers into a single OpenAI-compatible API endpoint, automatically handling failovers and rate limits silently.

## Core Concept

FreeFlowAI routes your AI requests through a cascade of free-tier providers (Requesty AI, Groq, OpenRouter, HuggingFace, Gemini, Pollinations) with built-in load balancing and failover logic. If one provider fails (rate limit, timeout, 503), it immediately tries the next tier without breaking your application.

## How LLMs Can Use FreeFlowAI

### 1. Cost-Effective Development

- **Eliminate API Costs**: Use 100% free-tier models for development, testing, and prototyping
- **Reduce Production Costs**: Fallback to free tiers during peak usage to lower expenses
- **Metrics Dashboard**: Track token usage, cost, and savings in real-time

### 2. Simplified Integration

- **OpenAI Compatible API**: Works with any OpenAI SDK or HTTP client
- **No Code Changes**: Just update `baseURL` in your existing OpenAI configuration
- **Zero Config Option**: Run locally with minimal setup

### 3. Reliable Performance

- **Self-Healing Architecture**: Auto-recovers from provider failures
- **Load Balancing**: Distributes requests across multiple models/providers
- **Edge Runtime**: Deploy to Cloudflare Workers or Vercel Edge for low latency

### 4. Flexible Deployment

- **Hosted Proxy**: Deploy once, share across all your projects
- **Embedded Mode**: Copy source code into your repository
- **Multiple Platforms**: Cloudflare Workers, Vercel Edge, Docker, Local Host

## Example Usage with OpenAI SDK

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://your-freeflow-proxy/v1", // Your proxy URL
  apiKey: process.env.FREEFLOW_PROXY_TOKEN || "none", // Proxy auth
});

async function main() {
  const stream = await openai.chat.completions.create({
    model: "gpt-4", // Proxy ignores this - uses free tiers!
    messages: [{ role: "user", content: "Hello, who are you?" }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();
```

## APIs Supported

### Chat Completions
```
POST /v1/chat/completions
```
Supports streaming and non-streaming requests with OpenAI-compatible format.

### Image Generation
```
POST /v1/images/generations
```
Generates images using HuggingFace (Flux/Stable Diffusion) or Pollinations (no-key free tier).

### Metrics Dashboard
```
GET /dashboard
```
Real-time metrics: total calls, tokens used, cost, savings, calls per provider/model.

### Health Check
```
GET /health
```
Basic health check for container probes.

## Key Features

- **Zero Config**: Minimal setup required
- **Self-Healing**: Automatic failover between providers
- **Free Tier Aggregation**: Combines multiple free APIs into one
- **Cost Tracking**: Detailed metrics and savings reports
- **Edge Optimized**: Runs on Cloudflare Workers or Vercel Edge
- **OpenAI Compatible**: Works with existing OpenAI SDKs and tools

## Supported Providers

### Chat Tiers
- Requesty AI (free: Grok-4, open-source models)
- Groq (free: Llama 3.3 70B, Mixtral 8x7B - fast!)
- OpenRouter (free/cheap: Llama 3, Mistral, Claude Haiku)
- HuggingFace (free/paid: Mistral 7B, custom models)
- Gemini (free: Gemini 1.5 Flash)
- Custom Fallback: Your own OpenAI-compatible endpoint

### Image Tiers
- HuggingFace (Flux/Stable Diffusion)
- Pollinations (no-key free tier)
- Custom Fallback: Your own image generation endpoint

---

FreeFlowAI is designed for indie hackers, content creators, and developers who want to maximize free AI resources without managing complex provider configurations.
