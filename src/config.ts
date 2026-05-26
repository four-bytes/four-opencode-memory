import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface FourMemConfig {
  storagePath: string;
  fallbackPaths?: string[];
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
  fallbackPaths: undefined,
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
<!-- id:soul0001 date:${new Date().toISOString().slice(0, 10)} type:preference tags:identity,soul -->
## Developer Identity

Edit this section with your details:
- Developer: [Your name]
- Timezone: [Your timezone]
- Style: [Communication style preferences]

---

<!-- id:soul0002 date:${new Date().toISOString().slice(0, 10)} type:preference tags:languages,soul -->
## Technology Stack

Edit with your preferred technologies:
- Languages: [e.g., PHP, TypeScript, Rust, Python]
- Frameworks: [e.g., Symfony, NestJS, React]
- Database: [e.g., PostgreSQL, MySQL]
- Hosting: [e.g., AWS, Vercel, self-hosted]

---

<!-- id:soul0003 date:${new Date().toISOString().slice(0, 10)} type:preference tags:coding-style,soul -->
## Coding Preferences

Edit with your coding style:
- Write clean, well-tested code
- Prefer explicit types over inference
- Use descriptive variable names
- Document public APIs
- [Add your own conventions here]

---

<!-- id:soul0004 date:${new Date().toISOString().slice(0, 10)} type:preference tags:workflow,soul -->
## Workflow

- Plan before implementing
- Every project needs documentation (README, CHANGELOG)
- Use semantic versioning
- Test before merging
- [Add your workflow preferences here]

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

  if (CONFIG.fallbackPaths) {
    CONFIG.fallbackPaths = CONFIG.fallbackPaths.map(expandHome);
  }

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
