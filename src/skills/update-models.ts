import { freeModelsManager } from '../free-models-manager.js';

/**
 * Skill to update the free models list from an external source
 */
export class UpdateModelsSkill {
  /**
   * Execute the update operation
   */
  static async execute(): Promise<void> {
    try {
      console.log('[UpdateModelsSkill] Starting models update...');

      await freeModelsManager.loadModelsFromExternalSource();

      console.log('[UpdateModelsSkill] Models update successful');

      // Log updated models
      const allModels = freeModelsManager.getAllModels();
      Object.keys(allModels).forEach(provider => {
        const models = allModels[provider];
        console.log(`[UpdateModelsSkill] ${provider}: ${models.length} models available`);
        models.forEach(model => {
          console.log(`  - ${model.modelId} (${model.name})`);
        });
      });
    } catch (error) {
      console.error('[UpdateModelsSkill] Failed to update models:', error);
    }
  }

  /**
   * Create an HTTP endpoint handler for the skill
   */
  static createHandler() {
    return async (c: any) => {
      try {
        await this.execute();
        return c.json({
          success: true,
          message: 'Models updated successfully',
          lastUpdated: freeModelsManager.getLastUpdated(),
          models: freeModelsManager.getAllModels()
        });
      } catch (error) {
        console.error('[UpdateModelsSkill] Handler error:', error);
        return c.json({
          success: false,
          message: 'Failed to update models',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    };
  }

  /**
   * Register the skill with the server
   */
  static register(app: any) {
    // HTTP endpoint for manual updates
    app.post('/api/skills/update-models', this.createHandler());

    // HTTP endpoint for getting current models
    app.get('/api/skills/get-models', async (c: any) => {
      try {
        const allModels = freeModelsManager.getAllModels();
        return c.json({
          success: true,
          lastUpdated: freeModelsManager.getLastUpdated(),
          models: allModels
        });
      } catch (error) {
        console.error('[UpdateModelsSkill] Get models error:', error);
        return c.json({
          success: false,
          message: 'Failed to get models',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
      }
    });

    console.log('[UpdateModelsSkill] Skill registered');
  }
}
