import { CONFIG } from "./config.js";
import { listMemories, type MemoryEntry } from "./memory-store.js";
import { readRecentDiary } from "./diary.js";

const DIARY_CHAR_LIMIT = 2000;

function truncateContent(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content;
  const cut = content.lastIndexOf("\n", maxLen);
  const idx = cut > maxLen / 2 ? cut : maxLen;
  return content.slice(0, idx).trimEnd() + "...";
}

function formatMemory(entry: MemoryEntry): string {
  const firstLine = entry.content.split("\n")[0].slice(0, 100);
  return `- **[${entry.type}]** ${entry.title} — ${firstLine}`;
}

function trimDiary(raw: string): string {
  if (!raw.trim()) return "";
  return truncateContent(raw.trim(), DIARY_CHAR_LIMIT);
}

export function assembleContext(projectDir?: string): string {
  const memories = listMemories(projectDir, CONFIG.injection.maxMemories);
  const diaryRaw = readRecentDiary(CONFIG.injection.diaryLookbackDays);
  const diary = trimDiary(diaryRaw);

  if (memories.length === 0 && !diary) return "";

  const parts: string[] = [
    "The following is context from your persistent memory system. Use it to maintain continuity across sessions.\n",
    "## Persistent Memory (from previous sessions)",
  ];

  if (memories.length > 0) {
    parts.push("\n### Memories");
    parts.push(memories.map(formatMemory).join("\n"));
  }

  if (diary) {
    parts.push("\n### Recent Activity");
    parts.push(diary);
  }

  return parts.join("\n");
}
