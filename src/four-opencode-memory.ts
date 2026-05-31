import { tool } from "@opencode-ai/plugin";
import { initConfig, CONFIG } from "./config.js";
import { assembleContext } from "./context-assembly.js";
import { performAutoCapture } from "./auto-capture.js";
import { addMemory, removeMemory, listMemories } from "./memory-store.js";
import { searchMemories } from "./search.js";
import { listDiaryDates, readDiary } from "./diary.js";
import pkg from "../package.json";

import type { Plugin } from "@opencode-ai/plugin";

const DEBUG = !!process.env.FOUR_MEM_DEBUG;
export function debug(...args: unknown[]): void {
  if (DEBUG) console.error("[four-mem]", ...args);
}

export const FourMemPlugin: Plugin = async (ctx) => {
  const { directory } = ctx;
  initConfig(directory);

  console.error(`[four-mem] v${pkg.version} loaded`);

  let idleTimeout: ReturnType<typeof setTimeout> | null = null;

  const memoryTool = tool({
    description:
      "Manage persistent project memory. Use 'add' to store knowledge, 'search' to find memories, 'list' to browse, 'forget' to remove, 'diary' to view daily logs.",
    args: {
      mode: tool.schema
        .enum(["add", "search", "list", "forget", "diary", "help"])
        .optional(),
      content: tool.schema.string().optional(),
      title: tool.schema.string().optional(),
      query: tool.schema.string().optional(),
      type: tool.schema.string().optional(),
      tags: tool.schema.string().optional(),
      memoryId: tool.schema.string().optional(),
      scope: tool.schema.enum(["global", "project"]).optional(),
      limit: tool.schema.number().optional(),
      date: tool.schema.string().optional(),
    },
    async execute(args, toolCtx) {
      const mode = args.mode || "help";
      const scopeDir = args.scope === "global" ? undefined : toolCtx.directory;

      try {
        switch (mode) {
          case "help":
            return JSON.stringify({
              success: true,
              commands: [
                { command: "add", args: ["title", "content", "type?", "tags?", "scope?"], description: "Store a new memory" },
                { command: "search", args: ["query", "limit?"], description: "Search memories by keywords" },
                { command: "list", args: ["limit?", "scope?"], description: "List recent memories" },
                { command: "forget", args: ["memoryId", "scope?"], description: "Remove a memory by ID" },
                { command: "diary", args: ["date?"], description: "View diary for a date (YYYY-MM-DD, default: today)" },
              ],
              types: ["decision", "pattern", "fact", "preference", "error"],
            });

          case "add": {
            if (!args.title || !args.content)
              return JSON.stringify({ success: false, error: "title and content required" });
            const parsedTags = args.tags
              ? args.tags.split(",").map((t: string) => t.trim().toLowerCase())
              : [];
            const entry = await addMemory(
              {
                title: args.title,
                content: args.content,
                type: args.type || "fact",
                tags: parsedTags,
              },
              scopeDir,
            );
            return JSON.stringify({ success: true, id: entry.id, message: "Memory stored" });
          }

          case "search": {
            if (!args.query)
              return JSON.stringify({ success: false, error: "query required" });
            const results = searchMemories(args.query, toolCtx.directory, args.limit || 10);
            return JSON.stringify({
              success: true,
              query: args.query,
              count: results.length,
              results: results.map((r) => ({
                id: r.entry.id,
                title: r.entry.title,
                type: r.entry.type,
                score: Math.round(r.score * 100),
                source: r.source,
              })),
            });
          }

          case "list": {
            const memories = await listMemories(scopeDir, args.limit || 20);
            return JSON.stringify({
              success: true,
              count: memories.length,
              memories: memories.map((m) => ({
                id: m.id,
                title: m.title,
                type: m.type,
                date: m.date,
                tags: m.tags,
              })),
            });
          }

          case "forget": {
            if (!args.memoryId)
              return JSON.stringify({ success: false, error: "memoryId required" });
            const removed = await removeMemory(args.memoryId, scopeDir);
            return JSON.stringify({
              success: removed,
              message: removed ? "Memory removed" : "Memory not found",
            });
          }

          case "diary": {
            const date = args.date;
            if (date) {
              const content = await readDiary(date);
              return JSON.stringify({
                success: true,
                date,
                content: content || "No diary entry for this date",
              });
            }
            const dates = await listDiaryDates();
            return JSON.stringify({
              success: true,
              dates: dates.slice(0, 30),
            });
          }

          default:
            return JSON.stringify({ success: false, error: `Unknown mode: ${mode}` });
        }
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) });
      }
    },
  });

  return {
    "chat.message": async (input, output) => {
      // Fallback auto-store: catch the most obvious "remember" patterns
      // Primary mechanism is the AI calling memory({ mode: "add" }) via system prompt
      const userText = output.parts
        .filter((p: any) => p.type === "text" && !p.synthetic)
        .map((p: any) => p.text || "")
        .join(" ");

      const lowerText = userText.toLowerCase();
      const hasExplicitTrigger =
        lowerText.includes("remember this:") ||
        lowerText.includes("remember that:") ||
        lowerText.includes("merk dir:") ||
        lowerText.includes("merke dir:");

      if (hasExplicitTrigger && userText.length > 15) {
        const colonIdx = userText.indexOf(":");
        const memoryContent = colonIdx !== -1
          ? userText.slice(colonIdx + 1).replace(/[."']+$/, "").trim()
          : userText.trim();

        if (memoryContent.length > 10) {
          const firstSentence = memoryContent.split(/[.!?\n]/)[0] || "User note";
          const title = firstSentence.length > 80
            ? firstSentence.slice(0, 77).replace(/\s+\S*$/, "") + "..."
            : firstSentence;

          try {
            const entry = await addMemory(
              { title, content: memoryContent, type: "fact", tags: ["user-note"] },
              undefined,
            );
            debug(`Auto-stored memory: ${entry.id} — ${title}`);

            output.parts.push({
              id: `prt-four-mem-stored-${Date.now()}`,
              sessionID: input.sessionID,
              messageID: output.message.id,
              type: "text" as const,
              text: `[System: Memory auto-stored — id:${entry.id}, title:"${title}". The user asked to remember something. Acknowledge this.]`,
              synthetic: true,
            });
          } catch (err) {
            debug(`Auto-store failed:`, err);
          }
        }
      }

      // Context injection removed — memories are now on-demand via memory({mode:"search"}).
      // (Previously pushed assembleContext() into every first user message.)
    },

    event: async (input) => {
      const event = input.event;

      if (event.type === "session.idle") {
        if (!CONFIG.autoCaptureEnabled) return;

        const sessionID = (event as any).properties?.sessionID;
        if (!sessionID) return;

        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(async () => {
          try {
            await performAutoCapture(ctx, sessionID, directory);
          } catch {
            // Silent fail
          } finally {
            idleTimeout = null;
          }
        }, CONFIG.autoCaptureDelayMs);
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(`
PERSISTENT MEMORY — You have a "memory" tool for cross-session knowledge.

STORE — Only when the user EXPLICITLY asks to remember/save/store something (e.g., "remember that...", "merk dir...", "save this decision"). Do NOT store normal instructions, questions, or task descriptions as memories.

RECALL — When the user asks about past decisions or context (e.g., "do you remember...?", "what did we decide about...?"), call memory({ mode: "search", query: "..." }) BEFORE answering.

PROACTIVE — Before complex tasks, search memory for relevant context. After completing significant work, store a brief summary.

Other modes: list (browse all), diary (session logs), forget (remove by memoryId). Use scope:"global" for cross-project.
`);
    },

    tool: {
      memory: memoryTool,
    },
  };
};

export default { id: "four-mem", server: FourMemPlugin };
