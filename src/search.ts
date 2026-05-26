import { existsSync } from "node:fs";
import { parseMemoryFile, projectHash, memoryPath, type MemoryEntry } from "./memory-store.js";

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
    scan(memoryPath(projectDir), `project:${hash}`, 0.1);
  }

  scan(memoryPath(), "global", 0);

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
