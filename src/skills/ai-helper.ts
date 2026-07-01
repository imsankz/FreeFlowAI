/**
 * AI Helper Skill - Provides instructions for integrating FreeFlowAI into projects with minimal changes
 */
export class AiHelperSkill {
  /**
   * Get integration instructions for different frameworks
   */
  static getIntegrationInstructions() {
    return {
      summary: "FreeFlowAI is a zero-config, self-healing free-tier maximizer proxy. It provides an OpenAI-compatible API that automatically routes requests to free or low-cost models.",
      quickStart: {
        title: "Quick Start",
        steps: [
          "Deploy FreeFlowAI (see deployment options below)",
          "Update your OpenAI client to point to FreeFlowAI's API endpoint",
          "Optional: Configure API keys for additional providers (see environment variables)",
          "Start making requests - FreeFlowAI handles the rest!"
        ]
      },
      deployment: {
        vercel: {
          title: "Vercel Deployment",
          steps: [
            "Fork the FreeFlowAI repository",
            "Import the forked repo to Vercel",
            "Add required environment variables (see .env.example)",
            "Deploy - your API endpoint will be https://<your-vercel-app>.vercel.app"
          ]
        },
        docker: {
          title: "Docker Deployment",
          steps: [
            "Build the Docker image: docker build -t freeflowai .",
            "Run the container: docker run -p 3000:3000 --env-file .env freeflowai",
            "Access at http://localhost:3000"
          ]
        },
        local: {
          title: "Local Development",
          steps: [
            "Clone the repository",
            "Install dependencies: npm install",
            "Create a .env file from .env.example",
            "Start the server: npm run dev",
            "Access at http://localhost:3000"
          ]
        }
      },
      integration: {
        openaiSdk: {
          title: "OpenAI SDK Integration",
          code: `import OpenAI from 'openai';

// Replace with your FreeFlowAI endpoint
const openai = new OpenAI({
  apiKey: 'dummy-key', // FreeFlowAI ignores this for free providers
  baseURL: 'https://your-freeflowai-endpoint.com/v1'
});

// Example chat completion
const response = await openai.chat.completions.create({
  model: 'gpt-4', // FreeFlowAI will route to appropriate free model
  messages: [
    { role: 'user', content: 'Hello, world!' }
  ]
});

console.log(response.choices[0].message.content);`
        },
        langchain: {
          title: "LangChain Integration",
          code: `import { OpenAI } from '@langchain/openai';

const llm = new OpenAI({
  openAIApiKey: 'dummy-key',
  configuration: {
    baseURL: 'https://your-freeflowai-endpoint.com/v1'
  }
});

const result = await llm.invoke('Hello, world!');
console.log(result);`
        },
        python: {
          title: "Python Integration",
          code: `from openai import OpenAI

client = OpenAI(
    api_key='dummy-key',
    base_url='https://your-freeflowai-endpoint.com/v1'
)

response = client.chat.completions.create(
    model='gpt-4',
    messages=[{'role': 'user', 'content': 'Hello, world!'}]
)

print(response.choices[0].message.content)`
        }
      },
      environmentVariables: {
        title: "Environment Variables",
        variables: [
          { name: "PORT", description: "Server port (default: 3000)" },
          { name: "REQUESTY_API_KEY", description: "Requesty AI API key" },
          { name: "GROQ_API_KEY", description: "Groq API key" },
          { name: "OPENROUTER_API_KEY", description: "OpenRouter API key" },
          { name: "HF_API_KEY", description: "HuggingFace API key" },
          { name: "GEMINI_API_KEY", description: "Google Gemini API key" },
          { name: "FALLBACK_API_KEY", description: "Fallback API key" },
          { name: "FALLBACK_BASE_URL", description: "Fallback API base URL" },
          { name: "FALLBACK_MODEL", description: "Fallback model name" },
          { name: "FALLBACK_IMAGE_API_KEY", description: "Fallback image API key" },
          { name: "FALLBACK_IMAGE_BASE_URL", description: "Fallback image API base URL" },
          { name: "FALLBACK_IMAGE_MODEL", description: "Fallback image model name" }
        ]
      },
      supportedApis: {
        title: "Supported APIs",
        endpoints: [
          { method: "POST", path: "/v1/chat/completions", description: "Chat completions (OpenAI compatible)" },
          { method: "POST", path: "/v1/images/generations", description: "Image generation (OpenAI compatible)" },
          { method: "GET", path: "/api/metrics", description: "Get metrics" },
          { method: "POST", path: "/api/metrics/reset", description: "Reset metrics" },
          { method: "GET", path: "/health", description: "Health check" }
        ]
      }
    };
  }

  /**
   * Create an HTTP endpoint handler for the skill
   */
  static createHandler() {
    return async (c: any) => {
      try {
        const instructions = this.getIntegrationInstructions();
        return c.json({
          success: true,
          data: instructions
        });
      } catch (error) {
        console.error('[AiHelperSkill] Handler error:', error);
        return c.json({
          success: false,
          message: 'Failed to get integration instructions',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    };
  }

  /**
   * Register the skill with the server
   */
  static register(app: any) {
    // HTTP endpoint for getting integration instructions
    app.get('/api/skills/ai-helper', this.createHandler());

    console.log('[AiHelperSkill] Skill registered');
  }
}
