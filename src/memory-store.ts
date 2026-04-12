import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { CONFIG } from "./config.js";

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

function memoryPath(projectDir?: string): string {
  if (projectDir) {
    return join(CONFIG.storagePath, "projects", projectHash(projectDir), "MEMORY.md");
  }
  return join(CONFIG.storagePath, "MEMORY.md");
}

export function parseMemoryFile(filePath: string): MemoryEntry[] {
  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, "utf-8");
  const entries: MemoryEntry[] = [];

  const metaRe = /^<!-- id:(\S+) date:(\S+) type:(\S+) tags:(.*?) -->$/gm;
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

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function addMemory(
  entry: { title: string; content: string; type: string; tags: string[] },
  scope?: string
): MemoryEntry {
  const filePath = memoryPath(scope);
  ensureDir(filePath);

  const memory: MemoryEntry = {
    id: generateId(),
    date: new Date().toISOString().slice(0, 10),
    type: entry.type,
    tags: entry.tags,
    title: entry.title,
    content: entry.content,
  };

  const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8").trim() : "";
  const block = [
    `<!-- id:${memory.id} date:${memory.date} type:${memory.type} tags:${memory.tags.join(",")} -->`,
    `## ${memory.title}`,
    "",
    memory.content,
    "",
    "---",
  ].join("\n");

  const updated = existing ? `${existing}\n\n${block}\n` : `${block}\n`;
  writeFileSync(filePath, updated, "utf-8");

  return memory;
}

export function removeMemory(id: string, scope?: string): boolean {
  const filePath = memoryPath(scope);
  if (!existsSync(filePath)) return false;

  const entries = parseMemoryFile(filePath);
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return false;

  const content = filtered.length > 0 ? serializeEntries(filtered) + "\n" : "";
  writeFileSync(filePath, content, "utf-8");
  return true;
}

export function listMemories(scope?: string, limit?: number): MemoryEntry[] {
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
