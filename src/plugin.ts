import { tool } from "@opencode-ai/plugin";
import { initConfig, CONFIG } from "./config.js";
import { assembleContext } from "./context-assembly.js";
import { performAutoCapture } from "./auto-capture.js";
import { addMemory, removeMemory, listMemories } from "./memory-store.js";
import { searchMemories } from "./search.js";
import { listDiaryDates, readDiary } from "./diary.js";

import type { Plugin } from "@opencode-ai/plugin";

export const FourMemPlugin: Plugin = async (ctx) => {
  const { directory } = ctx;
  initConfig(directory);

  let idleTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    // Hook: inject memory context on chat messages
    "chat.message": async (input, output) => {
      if (!CONFIG.injection.enabled) return;

      // Check if we should inject (first message only, or always)
      if (CONFIG.injection.injectOn === "first") {
        try {
          const messagesResponse = await ctx.client.session.messages({
            path: { id: input.sessionID },
          });
          const messages = messagesResponse.data || [];
          // Only inject if this is the first real user message
          const hasNonSyntheticUserMessages = messages.some(
            (m: any) =>
              m.info.role === "user" &&
              !m.parts.every((p: any) => p.type !== "text" || p.synthetic === true),
          );
          // After the very first user message, there should be exactly one
          const userMsgCount = messages.filter(
            (m: any) =>
              m.info.role === "user" &&
              !m.parts.every((p: any) => p.type !== "text" || p.synthetic === true),
          ).length;
          if (userMsgCount > 1) return;
        } catch {
          // If we can't check, inject anyway
        }
      }

      const context = assembleContext(directory);
      if (!context) return;

      const contextPart = {
        id: `prt-four-mem-${Date.now()}`,
        sessionID: input.sessionID,
        messageID: output.message.id,
        type: "text" as const,
        text: context,
        synthetic: true,
      };

      output.parts.unshift(contextPart);
    },

    // Hook: listen for session events
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
            // Silent fail — don't crash the plugin
          } finally {
            idleTimeout = null;
          }
        }, CONFIG.autoCaptureDelayMs);
      }
    },

    // Tool: memory management (callable by agents)
    tool: {
      memory: tool({
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
                const entry = addMemory(
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
                const memories = listMemories(scopeDir, args.limit || 20);
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
                const removed = removeMemory(args.memoryId, scopeDir);
                return JSON.stringify({
                  success: removed,
                  message: removed ? "Memory removed" : "Memory not found",
                });
              }

              case "diary": {
                const date = args.date;
                if (date) {
                  const content = readDiary(date);
                  return JSON.stringify({
                    success: true,
                    date,
                    content: content || "No diary entry for this date",
                  });
                }
                const dates = listDiaryDates();
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
      }),
    },
  };
};

export default { id: "four-mem", server: FourMemPlugin };
