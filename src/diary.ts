import { existsSync, readFileSync, appendFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { CONFIG } from "./config.js";

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

function ensureDiaryDir(): void {
  const dir = diaryDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function timeStamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function appendDiary(title: string, content: string): void {
  ensureDiaryDir();
  const path = diaryPath(today());
  if (!existsSync(path)) {
    appendFileSync(path, `# ${today()} — Diary\n\n`);
  }
  appendFileSync(path, `## ${timeStamp()} — ${title}\n\n${content}\n\n---\n\n`);
}

export function readDiary(date: string): string {
  const path = diaryPath(date);
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

export function readRecentDiary(daysBack: number): string {
  ensureDiaryDir();
  const parts: string[] = [];
  for (let i = 0; i <= daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${mm}-${dd}`;
    const content = readDiary(dateStr);
    if (content) parts.push(content);
  }
  return parts.length ? "\n" + parts.join("\n") : "";
}

export function listDiaryDates(): string[] {
  ensureDiaryDir();
  return readdirSync(diaryDir())
    .filter((f) => f.endsWith(".md"))
    .map((f) => basename(f, ".md"))
    .sort()
    .reverse();
}
