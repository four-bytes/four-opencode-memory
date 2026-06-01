import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { addMemory, listMemories, removeMemory } from "./memory-store.js";
import { debug } from "./four-opencode-memory.js";

export type SummaryLevel = "chunk" | "file" | "module";

let hits = 0;
let misses = 0;

/** SHA256 hash, first 16 hex chars */
export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/** Hash the current content of a file */
export async function hashFile(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return contentHash(content);
  } catch {
    return null;
  }
}

/** Look up cached summary. Returns null on cache miss or hash mismatch (auto-invalidates). */
export async function getCachedSummary(
  filePath: string,
  level: SummaryLevel,
  scope?: string,
): Promise<string | null> {
  const currentHash = await hashFile(filePath);
  if (!currentHash) {
    misses++;
    return null;
  }

  const memories = await listMemories(scope, 100);
  const cached = memories.find(
    (m) =>
      m.type === "summary" &&
      m.tags.includes(`level:${level}`) &&
      m.tags.includes(`path:${filePath}`),
  );

  if (!cached) {
    misses++;
    return null;
  }

  const storedHash = cached.tags.find((t) => t.startsWith("hash:"))?.slice(5);
  if (storedHash !== currentHash) {
    // Hash mismatch → auto-invalidate
    misses++;
    await removeMemory(cached.id, scope).catch(() => {});
    debug(`summary cache invalidated: ${filePath} (hash changed)`);
    return null;
  }

  hits++;
  debug(`summary cache hit: ${filePath} (${level})`);
  return cached.content;
}

/** Store a cached summary (replaces old cached version for same path). */
export async function setCachedSummary(
  filePath: string,
  level: SummaryLevel,
  summary: string,
  scope?: string,
): Promise<void> {
  const hash = await hashFile(filePath);
  if (!hash) return;

  const title = `${level}-summary: ${filePath.split("/").pop() || filePath}`;
  const tags = [`level:${level}`, `path:${filePath}`, `hash:${hash}`];

  // Remove old cached version for same path
  const memories = await listMemories(scope, 100);
  const old = memories.find(
    (m) => m.type === "summary" && m.tags.includes(`path:${filePath}`),
  );
  if (old) await removeMemory(old.id, scope).catch(() => {});

  await addMemory({ title, content: summary, type: "summary", tags }, scope);
  debug(`summary cache stored: ${filePath} (${level}, hash=${hash})`);
}

/** Get cache statistics */
export function getCacheStats(): { hits: number; misses: number; hitRate: number } {
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRate: total > 0 ? Math.round((hits / total) * 100) : 0,
  };
}

/** Reset cache stats (for testing) */
export function resetCacheStats(): void {
  hits = 0;
  misses = 0;
}
