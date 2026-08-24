// Vet HUR data sparas. Domänkoden känner bara till det här interfacet, aldrig
// den konkreta backenden - se PLAN.md #3 för resonemanget.
export interface StorageAdapter {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}
