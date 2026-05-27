import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { CONFIG } from "./config.js";
import { withFileLock, lockKey } from "./file-lock.js";
import { debug } from "./four-opencode-memory.js";

function diaryDir(): string {
  return join(CONFIG.storagePath, "diary");
}

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function diaryPath(date: string): string {
  return join(diaryDir(), `${date}.md`);
}

function ensureDiaryDirSync(): void {
  const dir = diaryDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function ensureDiaryDirAsync(): Promise<void> {
  const dir = diaryDir();
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // May already exist
  }
}

function timeStamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function readFileSafe(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (error: any) {
    if (error.code === "ENOENT") return "";
    if (error.code === "EIO") {
      debug(`EIO-Fehler beim Lesen von ${path}: ${error.message}`);
      return "";
    }
    throw error;
  }
}

export async function appendDiary(title: string, content: string): Promise<void> {
  await ensureDiaryDirAsync();
  const path = diaryPath(today());
  const key = lockKey(path);

  return withFileLock(key, async () => {
    let existing = "";
    try {
      existing = await readFile(path, "utf-8");
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }

    if (!existing) {
      await writeFile(path, `# ${today()} — Diary\n\n`, "utf-8");
    }

    await appendFile(path, `## ${timeStamp()} — ${title}\n\n${content}\n\n---\n\n`, "utf-8");
  });
}

export async function readDiary(date: string): Promise<string> {
  const path = diaryPath(date);
  return readFileSafe(path);
}

export async function readRecentDiary(daysBack: number): Promise<string> {
  await ensureDiaryDirAsync();
  const parts: string[] = [];
  for (let i = 0; i <= daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${mm}-${dd}`;
    const content = await readDiary(dateStr);
    if (content) parts.push(content);
  }
  return parts.length ? "\n" + parts.join("\n") : "";
}

export async function listDiaryDates(): Promise<string[]> {
  ensureDiaryDirSync();
  return readdirSync(diaryDir())
    .filter((f) => f.endsWith(".md"))
    .map((f) => basename(f, ".md"))
    .sort()
    .reverse();
}
