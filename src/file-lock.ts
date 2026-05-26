/**
 * In-process file locking mechanism.
 *
 * Provides a lightweight, zero-dependency mutex keyed by file path.
 * Prevents concurrent write access to the same file from different
 * async contexts within the same process (memory-plugin ↔ RAG-plugin
 * or multiple memory tool invocations).
 *
 * Locking is in-process only (no cross-process). For the single-process
 * OpenCode plugin architecture this is sufficient — all plugin hooks
 * share the same event loop.
 */

const locks = new Map<string, Promise<unknown>>();

/**
 * Acquire an exclusive lock for `key`, execute `fn`, then release.
 *
 * If another async operation holds the lock for the same `key`, this
 * call will wait until it is released.
 *
 * @param key  – Unique resource identifier (typically the absolute file path)
 * @param fn   – Async operation to run while holding the lock
 */
export async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();

  const next = prev.then(fn).finally(() => {
    // Only clean up if we are still the head of the chain
    if (locks.get(key) === next) {
      locks.delete(key);
    }
  });

  locks.set(key, next);
  return next;
}

/**
 * Readable name for lock debug logs.
 */
export function lockKey(filePath: string): string {
  return `file:${filePath}`;
}
