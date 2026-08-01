import { openDB, IDBPDatabase } from 'idb';
import { World, StoryInstance, TextProviderConfig, ImageProviderConfig, WorkerConfig, TextProviderId, ProviderId } from './types';

const DB_NAME = 'BotStoryDB';
const DB_VERSION = 2;
const STORE_WORLDS = 'worlds';
const STORE_INSTANCES = 'instances';
const STORE_SETTINGS = 'settings';

export class StorageService {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  async getDB() {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (!db.objectStoreNames.contains(STORE_WORLDS)) {
            db.createObjectStore(STORE_WORLDS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_INSTANCES)) {
            db.createObjectStore(STORE_INSTANCES, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
          }
          if (oldVersion < 2) {
            // Reserved for future migrations.
          }
        },
      });
    }
    return this.dbPromise;
  }

  async saveWorld(world: World): Promise<void> {
    const db = await this.getDB();
    await db.put(STORE_WORLDS, world);
  }

  async getWorld(id: string): Promise<World | undefined> {
    const db = await this.getDB();
    return db.get(STORE_WORLDS, id);
  }

  async deleteWorld(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction([STORE_WORLDS, STORE_INSTANCES], 'readwrite');
    try {
      const insts = (await tx.objectStore(STORE_INSTANCES).getAll()) as StoryInstance[];
      for (const i of insts) {
        if (i.worldId === id) await tx.objectStore(STORE_INSTANCES).delete(i.id);
      }
      await tx.objectStore(STORE_WORLDS).delete(id);
      await tx.done;
    } catch {
      await db.delete(STORE_WORLDS, id);
    }
  }

  async getAllWorlds(): Promise<World[]> {
    const db = await this.getDB();
    const all = (await db.getAll(STORE_WORLDS)) as World[];
    return all.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
  }

  async saveInstance(instance: StoryInstance): Promise<void> {
    const db = await this.getDB();
    instance.updatedAt = Date.now();
    await db.put(STORE_INSTANCES, instance);
  }

  async getInstance(id: string): Promise<StoryInstance | undefined> {
    const db = await this.getDB();
    return db.get(STORE_INSTANCES, id);
  }

  async getAllInstances(): Promise<StoryInstance[]> {
    const db = await this.getDB();
    const all = (await db.getAll(STORE_INSTANCES)) as StoryInstance[];
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getInstancesByWorld(worldId: string): Promise<StoryInstance[]> {
    const all = await this.getAllInstances();
    return all.filter((i) => i.worldId === worldId);
  }

  async deleteInstance(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(STORE_INSTANCES, id);
  }

  // ── Text / Image / Worker provider configs (localStorage) ────────

  /** Safe JSON parse wrapper to guard against corrupt localStorage blobs. */
  private safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  // ── Text (story) provider ────────────────────────────────────────

  saveTextProvider(config: TextProviderConfig): void {
    localStorage.setItem('botstory_text_provider', JSON.stringify(config));
  }

  getTextProvider(): TextProviderConfig | null {
    const raw = localStorage.getItem('botstory_text_provider');
    return this.safeParse<TextProviderConfig | null>(raw, null);
  }

  /** Migrate old single-provider slot into the new text-provider slot. Returns the active id so the caller knows what to load. */
  migrateTextProvider(): TextProviderConfig | null {
    const oldRaw = localStorage.getItem('botstory_providers');
    if (!oldRaw) return null;
    const old = this.safeParse<Record<string, { id: string; label: string; apiKey: string; endpoint?: string; model: string }>>(oldRaw, {});
    const activeId = localStorage.getItem('botstory_active_provider') as TextProviderId || 'gemini';
    const active = (old[activeId] || Object.values(old)[0]) as { id: TextProviderId; label: string; apiKey: string; endpoint?: string; model: string } | undefined;
    if (active && active.apiKey) {
      const tc: TextProviderConfig = {
        id: active.id as TextProviderId,
        label: active.label || active.id,
        apiKey: active.apiKey,
        model: active.model || 'gemini-2.5-flash',
        endpoint: active.endpoint,
      };
      this.saveTextProvider(tc);
      return tc;
    }
    return null;
  }

  /**
   * Try to auto-configure the text provider from on-disk key files
   * (in dev / test workflows only — never shipped).
   */
  configureTextFromFiles(): void {
    if (typeof window !== 'undefined' && (window as { DEV?: boolean }).DEV) return;
    // stub — caller (test-runner or dev setup script) should invoke the
    // explicit configure-files helper instead.
  }

  // ── Image provider ────────────────────────────────────────────────

  saveImageProvider(config: ImageProviderConfig): void {
    localStorage.setItem('botstory_image_provider', JSON.stringify(config));
  }

  getImageProvider(): ImageProviderConfig | null {
    const raw = localStorage.getItem('botstory_image_provider');
    const parsed = this.safeParse<ImageProviderConfig | null>(raw, null);
    if (!parsed) return null;
    // Default aspectRatio for configs saved before the field existed. Stays null-safe for 'none' providers too.
    if (!parsed.aspectRatio) parsed.aspectRatio = '3:4';
    return parsed;
  }

  /** Simple migration: if old botstory_providers holds a gemini config with imageModel, set gemini-imagen as image provider. */
  migrateImageProvider(): ImageProviderConfig | null {
    const oldRaw = localStorage.getItem('botstory_providers');
    if (!oldRaw) return null;
    const old = this.safeParse<Record<string, { id: string; label: string; apiKey: string; endpoint?: string; model: string; imageModel?: string }>>(oldRaw, {});
    const gemini = old.gemini || old.nvidia || old.openrouter || Object.values(old)[0];
    if (gemini && gemini.imageModel && gemini.apiKey) {
      const ic: ImageProviderConfig = {
        id: 'gemini-imagen',
        label: 'Gemini Imagen',
        apiKey: gemini.apiKey,
        model: gemini.imageModel,
      };
      this.saveImageProvider(ic);
      return ic;
    }
    return null;
  }

  /** Try to pre-fill CF image from the two on-disk files. Caller: test/dev setup script. */
  configureImageFromFiles(apiKey: string, accountId: string): ImageProviderConfig {
    const ic: ImageProviderConfig = {
      id: 'cloudflare',
      label: 'Cloudflare Workers AI',
      apiKey,
      accountId,
      model: '@cf/black-forest-labs/flux-1-schnell',
    };
    this.saveImageProvider(ic);
    return ic;
  }

  // ── Worker config ─────────────────────────────────────────────────

  saveWorkerConfig(config: WorkerConfig): void {
    localStorage.setItem('botstory_worker', JSON.stringify(config));
  }

  getWorkerConfig(): WorkerConfig | null {
    const raw = localStorage.getItem('botstory_worker');
    return this.safeParse<WorkerConfig | null>(raw, null);
  }

  // ── Backward compat (keep old APIs alive) ──────────────────────────

  /** @deprecated use saveTextProvider / saveImageProvider */
  saveProvider(config: { id: string; label: string; apiKey: string; endpoint?: string; model: string; imageModel?: string }): void {
    const raw = localStorage.getItem('botstory_providers');
    const all = this.safeParse<Record<string, typeof config>>(raw, {});
    all[config.id] = config;
    localStorage.setItem('botstory_providers', JSON.stringify(all));
  }

  /** @deprecated use getTextProvider / getImageProvider */
  getProvider(id: ProviderId): { id: string; label: string; apiKey: string; endpoint?: string; model: string; imageModel?: string } | null {
    const raw = localStorage.getItem('botstory_providers');
    const all = this.safeParse<Record<string, { id: string; label: string; apiKey: string; endpoint?: string; model: string; imageModel?: string }>>(raw, {});
    return all[id] || null;
  }

  /** @deprecated use getImageProvider for image-model list */
  getAllProviders(): { id: string; label: string; apiKey: string; endpoint?: string; model: string; imageModel?: string }[] {
    const raw = localStorage.getItem('botstory_providers');
    const all = this.safeParse<Record<string, { id: string; label: string; apiKey: string; endpoint?: string; model: string; imageModel?: string }>>(raw, {});
    return Object.values(all);
  }

  getActiveProviderId(): ProviderId {
    return (localStorage.getItem('botstory_active_provider') as ProviderId) || 'gemini';
  }

  setActiveProvider(id: ProviderId): void {
    localStorage.setItem('botstory_active_provider', id);
  }

  clearAllProviders(): void {
    localStorage.removeItem('botstory_providers');
    localStorage.removeItem('botstory_text_provider');
    localStorage.removeItem('botstory_image_provider');
    localStorage.removeItem('botstory_active_provider');
    localStorage.removeItem('botstory_worker');
  }

  saveProviderKey(id: ProviderId, key: string): void {
    const config = this.getProvider(id) || { id, label: id, apiKey: '', model: '' };
    config.apiKey = key;
    this.saveProvider(config);
  }
}

export const storage = new StorageService();