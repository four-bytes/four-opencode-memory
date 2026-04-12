import { CONFIG, isConfigured } from "./config.js";
import { appendDiary } from "./diary.js";

// Track which sessions we've already captured
const capturedSessions = new Set<string>();

// Extract a structured summary from raw messages (mechanical, no AI)
// TODO: Replace with AI summarization via opencodeProvider when available
function extractSessionSummary(
  messages: any[],
): { title: string; content: string } | null {
  const userMessages: string[] = [];
  const toolsUsed = new Set<string>();
  const filesMentioned = new Set<string>();

  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      if (part.type === "text" && msg.info?.role === "user" && !part.synthetic) {
        userMessages.push(part.text?.substring(0, 200) || "");
      }
      if (part.type === "tool") {
        toolsUsed.add(part.tool || "unknown");
      }
      if (part.type === "text" && part.text) {
        const paths = part.text.match(/(?:\.\/|src\/|lib\/|crates\/|app\/|config\/)[\w./-]+\.\w{1,8}/g);
        if (paths) paths.forEach((p: string) => filesMentioned.add(p));
      }
    }
  }

  if (userMessages.length === 0) return null;

  const lines: string[] = [];

  if (userMessages.length > 0) {
    lines.push("### Topics");
    userMessages.slice(0, 5).forEach((m) => {
      const summary = m.split("\n")[0]?.substring(0, 150) || "";
      if (summary.trim()) lines.push(`- ${summary}`);
    });
  }

  if (toolsUsed.size > 0) {
    lines.push("\n### Tools Used");
    lines.push([...toolsUsed].join(", "));
  }

  if (filesMentioned.size > 0) {
    lines.push("\n### Files Referenced");
    const relevant = [...filesMentioned]
      .filter((f) => f.length > 5 && f.includes("/") && !f.includes("node_modules") && !f.startsWith("http"))
      .slice(0, 10);
    if (relevant.length > 0) lines.push(relevant.join(", "));
  }

  return { title: "Session Activity", content: lines.join("\n") };
}

// Perform auto-capture for a session
export async function performAutoCapture(
  ctx: any,
  sessionID: string,
  _directory: string,
): Promise<void> {
  if (capturedSessions.has(sessionID)) return;
  if (!isConfigured()) return;

  capturedSessions.add(sessionID);

  let messages: any[];
  try {
    const response = await ctx.client.session.messages({
      path: { id: sessionID },
    });
    messages = response?.data ?? response ?? [];
  } catch {
    return;
  }

  const summary = extractSessionSummary(messages);
  if (!summary) return;

  appendDiary(summary.title, summary.content);

  if (CONFIG.showToasts && ctx.client?.tui) {
    await ctx.client.tui
      .showToast({
        body: {
          title: "Memory",
          message: "Session captured to diary",
          variant: "success",
          duration: 3000,
        },
      })
      .catch(() => {});
  }
}

// Reset captured sessions (for testing)
export function resetCapturedSessions(): void {
  capturedSessions.clear();
}
