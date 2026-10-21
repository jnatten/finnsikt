const PREFIX = "cache:";

interface Entry<T> {
  value: T;
  expires: number;
}

export async function cacheGetMany<T>(keys: string[]): Promise<Map<string, T>> {
  const stored = await browser.storage.local.get(keys.map((key) => PREFIX + key));
  const now = Date.now();
  const found = new Map<string, T>();
  for (const key of keys) {
    const entry = stored[PREFIX + key] as Entry<T> | undefined;
    if (entry && entry.expires > now) found.set(key, entry.value);
  }
  return found;
}

export async function cacheSetMany<T>(values: Record<string, T>, ttlMs: number): Promise<void> {
  const expires = Date.now() + ttlMs;
  const entries = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [PREFIX + key, { value, expires } satisfies Entry<T>]),
  );
  await browser.storage.local.set(entries);
}

export async function cachePrune(): Promise<void> {
  const stored = await browser.storage.local.get(null);
  const now = Date.now();
  const expired = Object.entries(stored)
    .filter(([key, entry]) => key.startsWith(PREFIX) && (entry as Entry<unknown>).expires <= now)
    .map(([key]) => key);
  if (expired.length) await browser.storage.local.remove(expired);
}
