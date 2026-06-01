import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { initConfig, CONFIG } from "../src/config.js";
import { buildSnippet, getMemoryById } from "../src/four-opencode-memory.js";
import { projectHash } from "../src/memory-store.js";

const TEST_DIR = resolve(tmpdir(), "four-mem-search-get-test-" + Date.now());
const TEST_MEM_DIR = resolve(TEST_DIR, "mem");

const SHORT = "This content is well under the 300 character limit.";
const LONG = "hello world this is a test " + "a".repeat(300);

// ── Test setup ──

function setupTestDir(): void {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(resolve(TEST_DIR, ".opencode"), { recursive: true });
  writeFileSync(
    resolve(TEST_DIR, ".opencode/four-mem.jsonc"),
    JSON.stringify({ storagePath: TEST_MEM_DIR }),
  );
  initConfig(TEST_DIR);
}

function writeGlobalMemory(): void {
  writeFileSync(
    resolve(TEST_MEM_DIR, "MEMORY.md"),
    [
      '<!-- id:global-001 date:2024-05-01 type:preference tags:global -->',
      '## Global Setting',
      '',
      'This is a global memory entry.',
      '',
      '---',
    ].join("\n"),
  );
}

function writeProjectMemory(): void {
  const hash = projectHash(TEST_DIR);
  const memDir = resolve(TEST_MEM_DIR, "projects", hash);
  mkdirSync(memDir, { recursive: true });
  writeFileSync(
    resolve(memDir, "MEMORY.md"),
    [
      '<!-- id:id-0001 date:2024-06-01 type:pattern tags:test -->',
      '## First Memory',
      '',
      'This is the first test memory content for verification.',
      '',
      '---',
      '',
      '<!-- id:id-0002 date:2024-06-02 type:fact tags:example,test -->',
      '## Second Memory',
      '',
      'This is the second test memory content with more details.',
      '',
      '---',
    ].join("\n"),
  );
}

const ORIG_STORAGE_PATH = CONFIG.storagePath;

describe("buildSnippet", () => {
  it("returns full content when ≤ 300 chars", () => {
    expect(buildSnippet(SHORT)).toBe(SHORT);
  });

  it("returns content as-is when exactly 300 chars", () => {
    const exact = "x".repeat(300);
    expect(buildSnippet(exact)).toBe(exact);
  });

  it("truncates long content with ellipsis", () => {
    const snippet = buildSnippet(LONG, 300);
    expect(snippet.length).toBeLessThanOrEqual(300);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("truncates at word boundary", () => {
    const midWord = "hello world this is a test " + "a".repeat(300);
    const snippet = buildSnippet(midWord, 300);
    expect(snippet.length).toBeLessThanOrEqual(300);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toBe("hello world this is a test…");
  });

  it("returns empty string for empty content", () => {
    expect(buildSnippet("")).toBe("");
  });

  it("handles content without whitespace >max", () => {
    const r = buildSnippet("a".repeat(400));
    expect(r.length).toBe(300);
    expect(r.endsWith("…")).toBe(true);
    expect(r.startsWith("aaa")).toBe(true);
  });
});

describe("getMemoryById", () => {
  beforeAll(() => {
    setupTestDir();
    writeGlobalMemory();
    writeProjectMemory();
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    CONFIG.storagePath = ORIG_STORAGE_PATH;
  });

  it("finds memory by ID in project scope", () => {
    const found = getMemoryById("id-0001", TEST_DIR);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("id-0001");
    expect(found!.title).toBe("First Memory");
    expect(found!.type).toBe("pattern");
    expect(found!.tags).toEqual(["test"]);
    expect(found!.date).toBe("2024-06-01");
    expect(found!.content).toBe("This is the first test memory content for verification.");
  });

  it("finds second memory entry in same file", () => {
    const found = getMemoryById("id-0002", TEST_DIR);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("id-0002");
    expect(found!.title).toBe("Second Memory");
    expect(found!.type).toBe("fact");
    expect(found!.tags).toEqual(["example", "test"]);
    expect(found!.date).toBe("2024-06-02");
  });

  it("returns null for unknown ID", () => {
    expect(getMemoryById("nonexistent-id", TEST_DIR)).toBeNull();
  });

  it("falls back to global scope when not in project", () => {
    const found = getMemoryById("global-001", TEST_DIR);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("global-001");
    expect(found!.title).toBe("Global Setting");
    expect(found!.type).toBe("preference");
  });

  it("finds global memory when no project dir given", () => {
    const found = getMemoryById("global-001");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("global-001");
  });

  it("returns null for unknown ID in global scope", () => {
    expect(getMemoryById("nonexistent-id")).toBeNull();
  });
});
