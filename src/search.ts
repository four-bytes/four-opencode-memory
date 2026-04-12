import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "./config.js";
import { parseMemoryFile, projectHash, type MemoryEntry } from "./memory-store.js";

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  source: string;
}

function scoreEntry(entry: MemoryEntry, terms: string[]): number {
  const haystack = `${entry.title} ${entry.content} ${(entry.tags || []).join(" ")}`.toLowerCase();
  const matched = terms.filter((t) => haystack.includes(t)).length;
  return matched / terms.length;
}

export function searchMemories(
  query: string,
  projectDir?: string,
  limit: number = 10,
): SearchResult[] {
  if (!query.trim()) return [];

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  function scan(filePath: string, source: string, boost: number): void {
    if (!existsSync(filePath)) return;
    const entries = parseMemoryFile(filePath);
    for (const entry of entries) {
      const score = scoreEntry(entry, terms) + boost;
      if (score > 0) results.push({ entry, score: Math.min(score, 1), source });
    }
  }

  if (projectDir) {
    const hash = projectHash(projectDir);
    scan(join(CONFIG.storagePath, "projects", hash, "MEMORY.md"), `project:${hash}`, 0.1);
  }

  scan(join(CONFIG.storagePath, "MEMORY.md"), "global", 0);

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
