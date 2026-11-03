// Generation-based manifests keep the previous session intact if a write fails.
export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export function chunkStorage(store: KV): KV {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation);
    queue = next.catch(() => {});
    return next;
  }
  async function manifest(
    key: string,
  ): Promise<{ generation: string; count: number } | null> {
    const raw = await store.getItem(key);
    if (!raw) return null;
    const m = JSON.parse(raw);
    if (
      typeof m.generation !== "string" ||
      !Number.isInteger(m.count) ||
      m.count < 1 ||
      m.count > 100
    )
      throw Error("Invalid session storage");
    return m;
  }
  async function clear(
    key: string,
    m: { generation: string; count: number } | null,
  ) {
    if (m)
      for (let i = 0; i < m.count; i++)
        await store.removeItem(`${key}.${m.generation}.${i}`);
  }
  return {
    getItem: (key) =>
      serial(async () => {
        const m = await manifest(key);
        if (!m) return null;
        const chunks = await Promise.all(
          Array.from({ length: m.count }, (_, i) =>
            store.getItem(`${key}.${m.generation}.${i}`),
          ),
        );
        return chunks.some((c) => c === null) ? null : chunks.join("");
      }),
    setItem: (key, value) =>
      serial(async () => {
        // ASCII encoding bounds bytes even if user metadata contains Hebrew.
        const safe = JSON.stringify(value).replace(
          /[\u007f-\uffff]/g,
          (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
        );
        const chunks = safe.match(/.{1,1500}/g) ?? [""];
        if (chunks.length > 100) throw Error("Session too large");
        const old = await manifest(key);
        const generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        for (let i = 0; i < chunks.length; i++)
          await store.setItem(`${key}.${generation}.${i}`, chunks[i]);
        await store.setItem(
          key,
          JSON.stringify({ generation, count: chunks.length }),
        );
        await clear(key, old);
      }),
    removeItem: (key) =>
      serial(async () => {
        const m = await manifest(key);
        await store.removeItem(key);
        await clear(key, m);
      }),
  };
}
// The serialized payload is decoded separately to keep the adapter generic.
export function sessionStorage(store: KV): KV {
  const chunks = chunkStorage(store);
  return {
    ...chunks,
    getItem: async (key) => {
      const v = await chunks.getItem(key);
      return v === null ? null : JSON.parse(v);
    },
  };
}
