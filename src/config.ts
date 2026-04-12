import { existsSync, readFileSync, mkdirSync } from "node:fs";
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
}

export function isConfigured(): boolean {
  return Boolean(CONFIG.opencodeProvider && CONFIG.opencodeModel);
}
