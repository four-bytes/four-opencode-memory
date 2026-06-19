# @four-bytes/four-opencode-memory - AGENTS.md

## Project Overview
- Zero-dependency memory plugin for OpenCode
- Persistent AI memory using plain Markdown files
- TypeScript, Bun runtime, OpenCode plugin API

## Development Commands
- `bun install` — Install dependencies
- `bun run build` — Build to dist/
- `bun run typecheck` — Type check without emitting

## Architecture
- **Runtime:** Bun (TypeScript)
- **Plugin API:** @opencode-ai/plugin ^1.4.3
- **Storage:** Plain Markdown files (MEMORY.md + diary/*.md)
- **Search:** Grep-based (no database, no vector DB)
- **Dependencies:** Zero npm runtime deps (only Bun/Node built-ins)

## Key Files
| File | Purpose |
|------|---------|
| src/four-opencode-memory.ts | Entry point, OpenCode hook wiring |
| src/config.ts | JSONC config loader |
| src/diary.ts | Daily diary file management |
| src/memory-store.ts | MEMORY.md read/write/parse |
| src/search.ts | Grep-based memory search |
| src/context-assembly.ts | Build injection context |
| src/auto-capture.ts | Session activity extraction |

## Conventions
- Pure ESM (type: "module")
- Strict TypeScript
- No external runtime dependencies — only Bun/Node built-ins
- All data stored as human-readable Markdown
- LF line endings, real umlauts
- **Console logging:** Plugins MUST use `_client?.app?.log()` for all logging in plugin mode — `console.log` / `console.warn` / `console.error` is ONLY permitted for the initial startup `"init"` message. Console output in plugin mode breaks the terminal UI.
