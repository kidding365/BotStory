import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { StorageService } from '../storage';
import { World, StoryInstance, ProviderConfig } from '../types';

const mockLocalStorage = (() => {
  const store: Record<string, string> = {};
  const proxy = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'getItem') return (key: string) => store[key] || null;
        if (prop === 'setItem') return (key: string, value: string) => {
          store[key] = value;
        };
        if (prop === 'removeItem') return (key: string) => {
          delete store[key];
        };
        if (prop === 'clear') return () => {
          for (const k in store) delete store[k];
        };
        if (prop === 'length') return Object.keys(store).length;
        return (store as Record<string, string>)[prop as string];
      },
      ownKeys() {
        return Object.keys(store);
      },
      getOwnPropertyDescriptor(_t, prop) {
        return { enumerable: true, configurable: true, value: (store as Record<string, string>)[prop as string] };
      },
    }
  );
  return proxy;
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
    localStorage.clear();
  });

  it('should save and retrieve a world', async () => {
    const world: World = {
      id: 'world-1',
      title: 'Test',
      name: 'Test',
      description: '',
      background: '',
      instructions: 'Welcome',
      authorStyle: '',
      objective: '',
      mature: false,
      nsfw: false,
      skills: [],
      possibleCharacters: [],
      triggerEvents: [],
      victoryCondition: { condition: '', text: '', alreadyFired: false },
      defeatCondition: { condition: '', text: '', alreadyFired: false },
      instructionBlocks: [],
      loreBookEntries: [],
      trackedItems: [],
    };
    await storage.saveWorld(world);
    const got = await storage.getWorld('world-1');
    expect(got?.title).toBe('Test');
  });

  it('should save and retrieve a story instance', async () => {
    const instance: StoryInstance = {
      id: 'inst-1',
      worldId: 'world-1',
      characterId: null,
      currentValues: {},
      modifiedBlocks: {},
      firedTriggers: [],
      turnNumber: 0,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await storage.saveInstance(instance);
    const got = await storage.getInstance('inst-1');
    expect(got?.worldId).toBe('world-1');
  });

  it('should save and read a provider config', () => {
    const p: ProviderConfig = { id: 'gemini', label: 'Gemini', apiKey: 'abc-123', model: 'gemini-1.5-flash' };
    storage.saveProvider(p);
    const got = storage.getProvider('gemini');
    expect(got?.apiKey).toBe('abc-123');
  });

  it('should track active provider', () => {
    storage.setActiveProvider('nvidia');
    expect(storage.getActiveProviderId()).toBe('nvidia');
  });

  it('should list and clear all providers', () => {
    storage.saveProvider({ id: 'gemini', label: 'Gemini', apiKey: 'a', model: 'm' });
    storage.saveProvider({ id: 'openrouter', label: 'OpenRouter', apiKey: 'b', model: 'm' });
    const before = storage.getAllProviders().length;
    expect(before).toBeGreaterThanOrEqual(2);
    storage.clearAllProviders();
    expect(storage.getAllProviders()).toHaveLength(0);
  });
});
