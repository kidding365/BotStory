import { StorageService } from './storage';
import { PromptComposer } from './composer';
import { StateManager } from './stateManager';
import { TriggerProcessor, TriggerResult } from './triggerProcessor';
import { VictoryDefeatProcessor, VictoryDefeatResult } from './victoryDefeatProcessor';
import { Summarizer } from './summarizer';
import { TextClient } from './textClient';
import { ImageClient } from './imageClient';
import {
  StoryInstance,
  UserAction,
  TurnResult,
  TextProviderConfig,
  ImageProviderConfig,
} from './types';

export class TurnOrchestrator {
  constructor(
    private storage: StorageService,
    private composer: PromptComposer,
    private stateManager: StateManager,
    private triggerProcessor: TriggerProcessor,
    private victoryDefeatProcessor: VictoryDefeatProcessor,
    private summarizer: Summarizer,
    private textClient: TextClient,
    private imageClient: ImageClient
  ) {}

  async executeTurn(
    worldId: string,
    instanceId: string,
    action: UserAction,
    textProvider: TextProviderConfig,
    imageProvider: ImageProviderConfig,
    opts: { signal?: AbortSignal } = {}
  ): Promise<TurnResult> {
    const world = await this.storage.getWorld(worldId);
    const instance = await this.storage.getInstance(instanceId);
    if (!world || !instance) {
      throw new Error('World or Story Instance not found.');
    }
    if (instance.ended) {
      throw new Error('This story has already ended. Please start a new instance.');
    }

    // 1. Snapshot before the turn for regenerate-restore (see §A3)
    instance.lastSnapshot = this.stateManager.snapshot(instance);

    // 2. Build prompts
    const systemPrompt = this.composer.buildSystemPrompt(world);
    const userPrompt = this.composer.buildUserPrompt(world, instance, action);

    // 3. Text generation (story)
    const outcome = await this.textClient.call(
      textProvider,
      systemPrompt,
      userPrompt,
      { signal: opts.signal }
    );

    // 4. Apply AI state updates
    let updated = this.stateManager.applyStateUpdates(instance, outcome, world);

    // 5. Process triggers
    const trig: TriggerResult = this.triggerProcessor.processTriggers(world, updated, outcome);
    updated = trig.updatedInstance;

    // 5b. Evaluate victory/defeat conditions (P1 fix)
    const vd: VictoryDefeatResult = this.victoryDefeatProcessor.process(world, updated, outcome);
    updated = vd.updatedInstance;

    // 6. Build visual prompt
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

    // 7. Generate image (if provider is not 'none' and has a key)
    let imageDataUrl: string | undefined;
    if (imageProvider.id !== 'none' && imageProvider.apiKey) {
      const img = await this.imageClient.generate(
        imageProvider,
        visualPrompt,
        { signal: opts.signal }
      );
      if (img) imageDataUrl = img;
    }

    // 8. Append to history
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
        whereWhen: outcome.whereWhen,
      },
    ];
    updated.turnNumber += 1;
    if (trig.ended) {
      updated.ended = true;
      updated.endMessage = trig.endMessage;
    }
    if (vd.ended) {
      updated.ended = true;
      updated.endMessage = vd.endMessage;
    }
    updated.lastOutcome = outcome;

    // Best-effort long-term summariser — runs every N turns from turn 8.
    // Failures (no key, network error) leave the instance untouched; we log and move on.
    if (this.summarizer.shouldSummarise(world, updated)) {
      try {
        updated = await this.summarizer.run(world, updated, textProvider, {
          signal: opts.signal,
          client: this.textClient,
        });
      } catch {
        // summarisation is non-fatal — pretend it didn't happen.
      }
    }

    // Persist (keep lastSnapshot so the next regenerate can restore to this turn's pre-state)
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
    textProvider: TextProviderConfig,
    imageProvider: ImageProviderConfig,
    newAction?: UserAction,
    opts: { signal?: AbortSignal } = {}
  ): Promise<TurnResult> {
    const instance = await this.storage.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found.');
    if (instance.history.length < 2) throw new Error('No turn to regenerate.');

    // Use the stored snapshot if available; otherwise fall back to the old manual-slice (zero state).
    if (instance.lastSnapshot) {
      await this.storage.saveInstance(
        this.stateManager.restore(instance, instance.lastSnapshot)
      );
    } else {
      const trimmed = instance.history.slice(0, instance.history.length - 2);
      const fallback: StoryInstance = {
        ...instance,
        history: trimmed,
        turnNumber: Math.max(0, instance.turnNumber - 1),
      };
      await this.storage.saveInstance(fallback);
    }

    const lastUser = [...instance.history].reverse().find((h) => h.role === 'user');
    const action: UserAction = newAction || {
      text: lastUser?.content ?? '',
      imageInstructions: lastUser?.imageInstructions,
    };
    return this.executeTurn(worldId, instanceId, action, textProvider, imageProvider, opts);
  }

  /**
   * Re-run image generation for an existing assistant history entry, in place.
   * Used by the in-UI "🔄 Swap image" affordance — no LLM text call, no state change.
   * Returns the updated instance with the new image URL on the targeted message.
   */
  async swapImage(
    instanceId: string,
    imageProvider: ImageProviderConfig,
    historyIndex: number,
    opts: { signal?: AbortSignal } = {}
  ): Promise<StoryInstance> {
    if (imageProvider.id === 'none' || !imageProvider.apiKey) {
      throw new Error('No image AI configured. Open Settings to add one.');
    }
    const instance = await this.storage.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found.');
    const target = instance.history[historyIndex];
    if (!target || target.role !== 'assistant' || !target.visualPrompt) {
      throw new Error('No image to swap on this turn.');
    }
    const img = await this.imageClient.generate(imageProvider, target.visualPrompt, {
      signal: opts.signal,
    });
    const updated: StoryInstance = {
      ...instance,
      history: instance.history.map((m, i) =>
        i === historyIndex ? { ...m, imageDataUrl: img ?? undefined } : m
      ),
    };
    await this.storage.saveInstance(updated);
    return updated;
  }
}

export const orchestrator = new TurnOrchestrator(
  new StorageService(),
  new PromptComposer(),
  new StateManager(),
  new TriggerProcessor(),
  new VictoryDefeatProcessor(),
  new Summarizer(),
  new TextClient(),
  new ImageClient()
);