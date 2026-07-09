import { openDB, IDBPDatabase } from 'idb';
import { World, StoryInstance, ProviderConfig, ProviderId } from './types';

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
    await db.delete(STORE_WORLDS, id);
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

  saveProvider(config: ProviderConfig): void {
    const raw = localStorage.getItem('botstory_providers');
    const all: Record<string, ProviderConfig> = raw ? JSON.parse(raw) : {};
    all[config.id] = config;
    localStorage.setItem('botstory_providers', JSON.stringify(all));
  }

  getProvider(id: ProviderId): ProviderConfig | null {
    const raw = localStorage.getItem('botstory_providers');
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, ProviderConfig>;
    return all[id] || null;
  }

  getAllProviders(): ProviderConfig[] {
    const raw = localStorage.getItem('botstory_providers');
    if (!raw) return [];
    return Object.values(JSON.parse(raw)) as ProviderConfig[];
  }

  getActiveProviderId(): ProviderId {
    return (localStorage.getItem('botstory_active_provider') as ProviderId) || 'gemini';
  }

  setActiveProvider(id: ProviderId): void {
    localStorage.setItem('botstory_active_provider', id);
  }

  clearAllProviders(): void {
    localStorage.removeItem('botstory_providers');
    localStorage.removeItem('botstory_active_provider');
  }

  saveProviderKey(id: ProviderId, key: string): void {
    const config = this.getProvider(id) || {
      id,
      label: id,
      apiKey: '',
      model: '',
    };
    config.apiKey = key;
    this.saveProvider(config);
  }
}

export const storage = new StorageService();
