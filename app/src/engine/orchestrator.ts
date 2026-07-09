import { StorageService } from './storage';
import { PromptComposer } from './composer';
import { StateManager } from './stateManager';
import { TriggerProcessor, TriggerResult } from './triggerProcessor';
import { LLMClient } from './llmClient';
import { StoryInstance, UserAction, TurnResult, ProviderConfig } from './types';

export class TurnOrchestrator {
  constructor(
    private storage: StorageService,
    private composer: PromptComposer,
    private stateManager: StateManager,
    private triggerProcessor: TriggerProcessor,
    private llmClient: LLMClient
  ) {}

  async executeTurn(
    worldId: string,
    instanceId: string,
    action: UserAction,
    provider: ProviderConfig,
    opts: { generateImage?: boolean; signal?: AbortSignal } = {}
  ): Promise<TurnResult> {
    const world = await this.storage.getWorld(worldId);
    const instance = await this.storage.getInstance(instanceId);
    if (!world || !instance) {
      throw new Error('World or Story Instance not found.');
    }
    if (instance.ended) {
      throw new Error('This story has already ended. Please start a new instance.');
    }

    // 1. Snapshot for regenerate (captured for potential use)
    this.stateManager.snapshot(instance);

    // 2. Build prompts
    const systemPrompt = this.composer.buildSystemPrompt(world);
    const userPrompt = this.composer.buildUserPrompt(world, instance, action);

    // 3. Call LLM
    const outcome = await this.llmClient.call(provider, systemPrompt, userPrompt, { signal: opts.signal });

    // 4. Apply state
    let updated = this.stateManager.applyStateUpdates(instance, outcome, world);

    // 5. Process triggers
    const trig: TriggerResult = this.triggerProcessor.processTriggers(world, updated, outcome);
    updated = trig.updatedInstance;

    // 6. Build image prompt and (optionally) generate
    let imageDataUrl: string | undefined;
    let visualPrompt = outcome.visualPrompt;
    if (!visualPrompt) {
      visualPrompt = this.composer.buildImagePrompt(
        world,
        updated,
        outcome.visualVariables || {},
        action.imageInstructions
      );
    }
    outcome.visualPrompt = visualPrompt;

    if (opts.generateImage) {
      const img = await this.llmClient.generateImage(provider, visualPrompt);
      if (img) imageDataUrl = img;
    }

    // 7. Append to history
    const now = Date.now();
    updated.history = [
      ...updated.history,
      {
        role: 'user',
        content: action.text,
        timestamp: now,
        imageInstructions: action.imageInstructions,
      },
      {
        role: 'assistant',
        content: outcome.narrative,
        timestamp: now,
        reasoning: outcome.reasoning,
        suggestedActions: outcome.suggestedActions,
        visualPrompt,
        imageDataUrl,
      },
    ];
    updated.turnNumber += 1;
    if (trig.ended) {
      updated.ended = true;
      updated.endMessage = trig.endMessage;
    }
    updated.lastOutcome = outcome;

    // 8. Persist
    await this.storage.saveInstance(updated);

    return {
      outcome,
      updatedInstance: updated,
      triggerMessages: trig.messages,
      imageDataUrl,
    };
  }

  async regenerateLastTurn(
    worldId: string,
    instanceId: string,
    provider: ProviderConfig,
    newAction?: UserAction,
    opts: { generateImage?: boolean; signal?: AbortSignal } = {}
  ): Promise<TurnResult> {
    const instance = await this.storage.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found.');
    if (instance.history.length < 2) throw new Error('No turn to regenerate.');

    // Find the last user action
    const lastUser = [...instance.history].reverse().find((h) => h.role === 'user');
    if (!lastUser) throw new Error('No previous user action found.');

    // Drop the last assistant + user message
    const trimmed = instance.history.slice(0, instance.history.length - 2);
    const restored: StoryInstance = {
      ...instance,
      history: trimmed,
      turnNumber: Math.max(0, instance.turnNumber - 1),
    };

    // Re-apply final state from history if any
    await this.storage.saveInstance(restored);

    const action: UserAction = newAction || {
      text: lastUser.content,
      imageInstructions: lastUser.imageInstructions,
    };
    return this.executeTurn(worldId, instanceId, action, provider, opts);
  }
}

export const orchestrator = new TurnOrchestrator(
  new StorageService(),
  new PromptComposer(),
  new StateManager(),
  new TriggerProcessor(),
  new LLMClient()
);
