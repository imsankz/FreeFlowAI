import { config } from 'dotenv';
config();

/**
 * Interface for free model configuration
 */
interface FreeModel {
  name: string;
  provider: string;
  modelId: string;
  available: boolean;
  description?: string;
}

/**
 * Interface for models configuration by provider
 */
interface ProviderModels {
  [provider: string]: FreeModel[];
}

/**
 * Default free models configuration (fallback if external source fails)
 */
const DEFAULT_PROVIDER_MODELS: ProviderModels = {
  requesty: [
    { name: 'nemotron-3-super-120b-a12b', provider: 'requesty', modelId: 'nemotron-3-super-120b-a12b', available: true, description: 'NVIDIA Nemotron 3 Super 120B' },
    { name: 'gemma-4-31b-it', provider: 'requesty', modelId: 'gemma-4-31b-it', available: true, description: 'Google Gemma 4 31B' },
    { name: 'nemotron-3-nano-omni-30b-a3b-reasoning', provider: 'requesty', modelId: 'nemotron-3-nano-omni-30b-a3b-reasoning', available: true, description: 'NVIDIA Nemotron 3 Nano 30B Reasoning' },
    { name: 'nemotron-3-nano-30b-a3b', provider: 'requesty', modelId: 'nemotron-3-nano-30b-a3b', available: true, description: 'NVIDIA Nemotron 3 Nano 30B' },
    { name: 'nemotron-3.5-content-safety', provider: 'requesty', modelId: 'nemotron-3.5-content-safety', available: true, description: 'NVIDIA Nemotron 3.5 Content Safety' },
    { name: 'laguna-m.1', provider: 'requesty', modelId: 'laguna-m.1', available: true, description: 'Poolside Laguna M.1' },
    { name: 'laguna-xs.2', provider: 'requesty', modelId: 'laguna-xs.2', available: true, description: 'Poolside Laguna XS.2' }
  ],
  groq: [
    { name: 'llama-3.3-70b-versatile', provider: 'groq', modelId: 'llama-3.3-70b-versatile', available: true, description: 'Llama 3.3 70B Versatile' },
    { name: 'llama-3.1-8b-instant', provider: 'groq', modelId: 'llama-3.1-8b-instant', available: true, description: 'Llama 3.1 8B Instant' },
    { name: 'qwen/qwen3.6-27b', provider: 'groq', modelId: 'qwen/qwen3.6-27b', available: true, description: 'Qwen 3.6 27B' }
  ],
  openrouter: [
    { name: 'meta-llama/llama-3-8b-instruct', provider: 'openrouter', modelId: 'meta-llama/llama-3-8b-instruct', available: true, description: 'Llama 3 8B Instruct' }
  ]
};

/**
 * Free models manager class
 */
export class FreeModelsManager {
  private models: ProviderModels = DEFAULT_PROVIDER_MODELS;
  private lastUpdated: Date = new Date();
  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * Load models from external source (e.g., API, JSON file, etc.)
   */
  async loadModelsFromExternalSource(): Promise<void> {
    try {
      // In a real implementation, this would fetch from an external API or file
      // For now, we'll use the default configuration
      console.log('[FreeModelsManager] Loading models from external source...');

      // Simulate fetching from API
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For now, use default models
      this.models = DEFAULT_PROVIDER_MODELS;
      this.lastUpdated = new Date();

      console.log('[FreeModelsManager] Models loaded successfully');
    } catch (error) {
      console.error('[FreeModelsManager] Failed to load models from external source:', error);
      // Fallback to default models
      this.models = DEFAULT_PROVIDER_MODELS;
    }
  }

  /**
   * Get available models for a specific provider
   */
  getModelsByProvider(provider: string): FreeModel[] {
    return this.models[provider] || [];
  }

  /**
   * Get all available models
   */
  getAllModels(): ProviderModels {
    return this.models;
  }

  /**
   * Get last updated time
   */
  getLastUpdated(): Date {
    return this.lastUpdated;
  }

  /**
   * Start periodic model updates
   */
  startPeriodicUpdates(intervalMinutes: number = 60): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        await this.loadModelsFromExternalSource();
        console.log('[FreeModelsManager] Models updated');
      } catch (error) {
        console.error('[FreeModelsManager] Failed to update models:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`[FreeModelsManager] Periodic updates started (every ${intervalMinutes} minutes)`);
  }

  /**
   * Stop periodic model updates
   */
  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('[FreeModelsManager] Periodic updates stopped');
    }
  }

  /**
   * Update a specific model's availability status
   */
  updateModelAvailability(provider: string, modelId: string, available: boolean): void {
    if (this.models[provider]) {
      const model = this.models[provider].find(m => m.modelId === modelId);
      if (model) {
        model.available = available;
        console.log(`[FreeModelsManager] Model ${modelId} (${provider}) availability updated to ${available}`);
      }
    }
  }

  /**
   * Add a new model to the configuration
   */
  addModel(model: FreeModel): void {
    if (!this.models[model.provider]) {
      this.models[model.provider] = [];
    }

    // Check if model already exists
    const existingModel = this.models[model.provider].find(m => m.modelId === model.modelId);
    if (!existingModel) {
      this.models[model.provider].push(model);
      console.log(`[FreeModelsManager] Model ${model.modelId} (${model.provider}) added`);
    }
  }

  /**
   * Remove a model from the configuration
   */
  removeModel(provider: string, modelId: string): void {
    if (this.models[provider]) {
      const modelIndex = this.models[provider].findIndex(m => m.modelId === modelId);
      if (modelIndex !== -1) {
        this.models[provider].splice(modelIndex, 1);
        console.log(`[FreeModelsManager] Model ${modelId} (${provider}) removed`);
      }
    }
  }
}

/**
 * Singleton instance of FreeModelsManager
 */
export const freeModelsManager = new FreeModelsManager();

/**
 * Initialize the free models manager
 */
export async function initializeFreeModelsManager(): Promise<void> {
  await freeModelsManager.loadModelsFromExternalSource();

  // Start periodic updates
  const updateInterval = process.env.FREE_MODELS_UPDATE_INTERVAL_MINUTES;
  if (updateInterval) {
    freeModelsManager.startPeriodicUpdates(parseInt(updateInterval));
  }
}
