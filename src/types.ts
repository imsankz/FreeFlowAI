/**
 * Core types for the OpenAI-compatible proxy server.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: any;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }[];
}

// Function signature for executing a request on a specific tier
// Returns either a Response object (fetch response) or throws an error.
export type ExecuteTierFunction = (
  req: ChatCompletionRequest,
  signal: AbortSignal
) => Promise<Response>;

export interface TierConfig {
  name: string;
  enabled: boolean;
  execute: ExecuteTierFunction;
}

export interface TierResult {
  tierName: string;
  latencyMs: number;
  response: Response;
}

export interface TierFailure {
  tier: string;
  status?: number;
  error: string;
}

export interface ProxyError {
  error: {
    message: string;
    type: string;
    attempts: TierFailure[];
  };
}

export interface ImageGenerationRequest {
  prompt: string;
  n?: number;
  size?: string;
  response_format?: 'url' | 'b64_json';
  user?: string;
  [key: string]: any;
}

export interface ImageGenerationResponse {
  created: number;
  data: {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }[];
}

export type ExecuteImageTierFunction = (
  req: ImageGenerationRequest,
  signal: AbortSignal
) => Promise<Response>;

export interface ImageTierConfig {
  name: string;
  enabled: boolean;
  execute: ExecuteImageTierFunction;
}


