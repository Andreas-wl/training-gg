import type { StorageAdapter } from './StorageAdapter';

export class LocalStorageAdapter implements StorageAdapter {
  async getItem<T>(key: string): Promise<T | null> {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }
}
