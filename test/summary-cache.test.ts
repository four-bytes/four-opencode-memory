import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { initConfig } from "../src/config.js";
import {
  contentHash,
  hashFile,
  getCachedSummary,
  setCachedSummary,
  getCacheStats,
  resetCacheStats,
} from "../src/summary-cache.js";

const TEST_DIR = resolve(tmpdir(), "four-mem-test-" + Date.now());
const TEST_FILE = resolve(TEST_DIR, "test-file.md");

describe("Summary Cache", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, "# Test Content\n\nHello World");
    initConfig(TEST_DIR);
    resetCacheStats();
  });

  afterAll(() => {
    try { unlinkSync(TEST_FILE); } catch {}
  });

  it("contentHash produces consistent hashes", () => {
    const h1 = contentHash("hello");
    const h2 = contentHash("hello");
    expect(h1).toBe(h2);
    expect(h1.length).toBe(16);
  });

  it("contentHash produces different hashes for different content", () => {
    const h1 = contentHash("hello");
    const h2 = contentHash("world");
    expect(h1).not.toBe(h2);
  });

  it("hashFile returns hash for existing file", async () => {
    const hash = await hashFile(TEST_FILE);
    expect(hash).toBeTruthy();
    expect(hash?.length).toBe(16);
  });

  it("hashFile returns null for missing file", async () => {
    const hash = await hashFile("/nonexistent/file.txt");
    expect(hash).toBeNull();
  });

  it("setCachedSummary + getCachedSummary roundtrip", async () => {
    const summary = "This file contains test content with hello world.";
    await setCachedSummary(TEST_FILE, "file", summary, TEST_DIR);

    const cached = await getCachedSummary(TEST_FILE, "file", TEST_DIR);
    expect(cached).toBe(summary);
  });

  it("cache miss on unknown file", async () => {
    const cached = await getCachedSummary("/unknown/file.md", "file", TEST_DIR);
    expect(cached).toBeNull();
  });

  it("auto-invalidates on content hash mismatch", async () => {
    // First, cache with current content
    await setCachedSummary(TEST_FILE, "file", "original summary", TEST_DIR);

    // Change file content
    writeFileSync(TEST_FILE, "# Modified Content\n\nGoodbye World");

    // Cache should auto-invalidate (hash mismatch)
    const cached = await getCachedSummary(TEST_FILE, "file", TEST_DIR);
    expect(cached).toBeNull(); // Invalidated
  });

  it("getCacheStats tracks hits and misses", () => {
    resetCacheStats();
    expect(getCacheStats().hits).toBe(0);
    expect(getCacheStats().misses).toBe(0);
    expect(getCacheStats().hitRate).toBe(0);
  });

  it("cache stats reflect activity", async () => {
    resetCacheStats();

    // Cache miss
    await getCachedSummary("/unknown.md", "file", TEST_DIR);
    expect(getCacheStats().misses).toBeGreaterThanOrEqual(1);

    // Cache hit: restore original content, set new cache
    writeFileSync(TEST_FILE, "# Test Content\n\nHello World");
    const summary = "test summary for stats";
    await setCachedSummary(TEST_FILE, "file", summary, TEST_DIR);
    const cached = await getCachedSummary(TEST_FILE, "file", TEST_DIR);
    expect(cached).toBe(summary);
    expect(getCacheStats().hits).toBeGreaterThanOrEqual(1);
  });
});
