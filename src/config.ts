import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface FourMemConfig {
  storagePath: string;
  opencodeProvider?: string;
  opencodeModel?: string;
  autoCaptureEnabled: boolean;
  autoCaptureDelayMs: number;
  injection: {
    enabled: boolean;
    maxMemories: number;
    diaryLookbackDays: number;
    injectOn: "first" | "always";
  };
  compaction: {
    enabled: boolean;
    maxDiaryAgeDays: number;
  };
  showToasts: boolean;
}

const DEFAULTS: FourMemConfig = {
  storagePath: join(homedir(), ".four-mem"),
  autoCaptureEnabled: true,
  autoCaptureDelayMs: 10000,
  injection: {
    enabled: true,
    maxMemories: 10,
    diaryLookbackDays: 3,
    injectOn: "first",
  },
  compaction: {
    enabled: true,
    maxDiaryAgeDays: 30,
  },
  showToasts: true,
};

const SEED_MEMORY = `\
<!-- id:seed0001 date:${new Date().toISOString().slice(0, 10)} type:preference tags:identity,setup -->
## AI Assistant Identity

You are a coding assistant with persistent memory. You remember decisions, patterns, and
preferences across sessions. When you learn something important, store it using the memory tool.

---

<!-- id:seed0002 date:${new Date().toISOString().slice(0, 10)} type:preference tags:workflow,setup -->
## How to Use Memory

- Use \`memory({ mode: "add" })\` to store important decisions, patterns, and facts
- Memories persist across sessions and are automatically injected into new conversations
- Daily activity is captured to diary files in ~/.four-mem/diary/
- Edit MEMORY.md directly to customize your AI's long-term knowledge

---

<!-- id:seed0003 date:${new Date().toISOString().slice(0, 10)} type:preference tags:coding-style,setup -->
## Default Coding Preferences

Edit these to match your style:
- Write clean, well-tested code
- Prefer explicit types over inference
- Use descriptive variable names
- Document public APIs

---
`;

export let CONFIG: FourMemConfig = { ...DEFAULTS };

function stripJsonComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

function readJsoncFile(filePath: string): Partial<FourMemConfig> | null {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(stripJsonComments(raw));
}

export function initConfig(directory: string): void {
  const candidates = [
    join(homedir(), ".config/opencode/four-mem.jsonc"),
    join(homedir(), ".config/opencode/four-mem.json"),
    join(directory, ".opencode/four-mem.jsonc"),
    join(directory, ".opencode/four-mem.json"),
  ];

  let merged: Partial<FourMemConfig> = {};
  for (const path of candidates) {
    const parsed = readJsoncFile(path);
    if (parsed) merged = { ...merged, ...parsed };
  }

  CONFIG = { ...DEFAULTS, ...merged } as FourMemConfig;
  CONFIG.storagePath = expandHome(CONFIG.storagePath);

  if (CONFIG.injection) {
    CONFIG.injection = { ...DEFAULTS.injection, ...merged.injection };
  }
  if (CONFIG.compaction) {
    CONFIG.compaction = { ...DEFAULTS.compaction, ...merged.compaction };
  }

  const diaryDir = join(CONFIG.storagePath, "diary");
  if (!existsSync(CONFIG.storagePath)) mkdirSync(CONFIG.storagePath, { recursive: true });
  if (!existsSync(diaryDir)) mkdirSync(diaryDir, { recursive: true });

  // Auto-seed MEMORY.md on first run
  const globalMemory = join(CONFIG.storagePath, "MEMORY.md");
  if (!existsSync(globalMemory)) {
    writeFileSync(globalMemory, SEED_MEMORY, "utf-8");
  }
}

export function isConfigured(): boolean {
  return Boolean(CONFIG.opencodeProvider && CONFIG.opencodeModel);
}
