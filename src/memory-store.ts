import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { CONFIG } from "./config.js";
import { withFileLock, lockKey } from "./file-lock.js";
import { debug } from "./four-opencode-memory.js";

export interface MemoryEntry {
  id: string;
  date: string;
  type: string;
  tags: string[];
  title: string;
  content: string;
}

function generateId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

export function projectHash(directory: string): string {
  return createHash("sha256").update(directory).digest("hex").slice(0, 12);
}

export function memoryPath(projectDir?: string): string {
  const primaryPath = projectDir
    ? join(CONFIG.storagePath, "projects", projectHash(projectDir), "MEMORY.md")
    : join(CONFIG.storagePath, "MEMORY.md");

  debug(`Lese Memory-Datei: ${primaryPath}`);

  if (CONFIG.fallbackPaths) {
    for (const fallback of CONFIG.fallbackPaths) {
      if (existsSync(fallback)) {
        debug(`Verwende Fallback-Pfad: ${fallback}`);
        return fallback;
      }
    }
  }

  return primaryPath;
}

export function parseMemoryFile(filePath: string): MemoryEntry[] {
  debug(`Parse Memory-Datei: ${filePath}`);

  if (!existsSync(filePath)) {
    debug(`Datei nicht gefunden: ${filePath}`);
    return [];
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (error: any) {
    debug(`Fehler beim Lesen von ${filePath}: ${(error as Error).message}`);
    if (error.code === "EIO") {
      debug(`EIO-Fehler beim Lesen von ${filePath}: ${error.message}`);
      return [];
    }
    throw error;
  }
  const entries: MemoryEntry[] = [];

  const sections = raw.split(/^---$/m).map((s) => s.trim()).filter(Boolean);

  for (const section of sections) {
    const metaMatch = section.match(/^<!-- id:(\S+) date:(\S+) type:(\S+) tags:(.*?) -->/);
    if (!metaMatch) continue;

    const [, id, date, type, tagsRaw] = metaMatch;
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const titleMatch = section.match(/^## (.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const afterTitle = titleMatch
      ? section.slice(section.indexOf(titleMatch[0]) + titleMatch[0].length).trim()
      : "";
    const content = afterTitle.replace(/^---$/m, "").trim();

    entries.push({ id, date, type, tags, title, content });
  }

  return entries;
}

function serializeEntries(entries: MemoryEntry[]): string {
  return entries
    .map((e) => {
      const tags = e.tags.join(",");
      const header = `<!-- id:${e.id} date:${e.date} type:${e.type} tags:${tags} -->`;
      return [header, `## ${e.title}`, "", e.content, "", "---"].join("\n");
    })
    .join("\n\n");
}

/**
 * Atomic write: write to a temp file first, then rename.
 * Prevents partial/corrupt files if the process crashes mid-write.
 * Rename is atomic on POSIX (same filesystem).
 */
async function atomicWriteFile(filePath: string, content: string, encoding: BufferEncoding): Promise<void> {
  const tmpPath = filePath + ".tmp." + randomUUID().slice(0, 8);
  try {
    await writeFile(tmpPath, content, encoding);
    await rename(tmpPath, filePath);
  } catch (error) {
    try { await unlink(tmpPath); } catch { /* ignore cleanup errors */ }
    throw error;
  }
}

/**
 * Async readFile with retry logic for transient EBUSY/EAGAIN/EIO errors.
 * Returns "" after exhausting retries on EIO.
 */
async function readFileSafe(filePath: string, encoding: BufferEncoding): Promise<string> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await readFile(filePath, encoding);
    } catch (error: any) {
      if (error.code === "EBUSY" || error.code === "EAGAIN") {
        if (attempt < MAX_RETRIES) {
          debug(`Datei busy, Versuch ${attempt}/${MAX_RETRIES}: ${filePath}`);
          await sleep(10 * attempt);
          continue;
        }
        debug(`Busy nach ${MAX_RETRIES} Versuchen: ${filePath}`);
        return "";
      }
      if (error.code === "EIO") {
        debug(`EIO-Fehler beim Lesen von ${filePath}: ${error.message}`);
        return "";
      }
      if (error.code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }
  return "";
}

async function ensureDirAsync(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // Directory may already exist — that's fine
  }
}

export async function addMemory(
  entry: { title: string; content: string; type: string; tags: string[] },
  scope?: string
): Promise<MemoryEntry> {
  const filePath = memoryPath(scope);
  const key = lockKey(filePath);

  return withFileLock(key, async () => {
    await ensureDirAsync(filePath);

    const memory: MemoryEntry = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      type: entry.type,
      tags: entry.tags,
      title: entry.title,
      content: entry.content,
    };

    let existing = await readFileSafe(filePath, "utf-8");

    const block = [
      `<!-- id:${memory.id} date:${memory.date} type:${memory.type} tags:${memory.tags.join(",")} -->`,
      `## ${memory.title}`,
      "",
      memory.content,
      "",
      "---",
    ].join("\n");

    const trimmed = existing.trim();
    const updated = trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
    await atomicWriteFile(filePath, updated, "utf-8");

    return memory;
  });
}

export async function removeMemory(id: string, scope?: string): Promise<boolean> {
  const filePath = memoryPath(scope);
  const key = lockKey(filePath);

  return withFileLock(key, async () => {
    if (!existsSync(filePath)) return false;

    const entries = parseMemoryFile(filePath);
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === entries.length) return false;

    const content = filtered.length > 0 ? serializeEntries(filtered) + "\n" : "";
    await atomicWriteFile(filePath, content, "utf-8");
    return true;
  });
}

export async function listMemories(scope?: string, limit?: number): Promise<MemoryEntry[]> {
  const globalEntries = parseMemoryFile(memoryPath());
  const projectEntries = scope ? parseMemoryFile(memoryPath(scope)) : [];

  const seen = new Set<string>();
  const merged: MemoryEntry[] = [];

  for (const entry of [...projectEntries, ...globalEntries]) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      merged.push(entry);
    }
  }

  return limit != null ? merged.slice(0, limit) : merged;
}
