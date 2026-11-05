import type { KV } from "./chunkStorage";

// Resolve lazily: browser storage can be unavailable during rendering or in
// restricted browsers. Keep a session usable in memory when persistence fails.
export function browserSessionStorage(resolve: () => Storage | null): KV {
  const memory = new Map<string, string>();
  let unavailable = false;
  function store() {
    if (unavailable) return null;
    try {
      return resolve();
    } catch {
      unavailable = true;
      return null;
    }
  }
  return {
    async getItem(key) {
      try {
        const target = store();
        return target ? target.getItem(key) : (memory.get(key) ?? null);
      } catch {
        unavailable = true;
        return memory.get(key) ?? null;
      }
    },
    async setItem(key, value) {
      // Do not silently promise persistence when a write is rejected.
      const target = store();
      if (target) target.setItem(key, value);
      memory.set(key, value);
    },
    async removeItem(key) {
      const target = store();
      if (target) target.removeItem(key);
      memory.delete(key);
    },
  };
}
