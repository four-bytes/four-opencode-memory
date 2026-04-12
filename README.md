# four-opencode-memory-plugin

Zero-dependency memory plugin for [OpenCode](https://opencode.ai) — persistent AI memory using plain Markdown files.

## Why

AI coding sessions start from zero every time. This plugin gives your agents persistent memory across sessions using human-readable Markdown files. No vector database, no embeddings, no native dependencies.

## Features

- **Persistent Memory** — Store decisions, patterns, facts, and preferences in `MEMORY.md` files
- **Daily Diary** — Auto-capture session activity to daily Markdown logs
- **Context Injection** — Automatically inject relevant memories into new chat sessions
- **Grep-based Search** — Fast keyword search across all memory files
- **Project + Global Scope** — Per-project and global memory stores
- **Zero Dependencies** — Only uses Node/Bun built-ins (`fs`, `path`, `crypto`)
- **Human-readable** — All data stored as plain Markdown, editable in any text editor

## Installation

Add to your OpenCode configuration at `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["four-opencode-memory-plugin"]
}
```

The plugin installs automatically on next OpenCode startup.

## Storage Layout

```
~/.four-mem/
├── MEMORY.md                    # Global memories (decisions, patterns, facts)
├── diary/
│   ├── 2026-04-12.md           # Today's session log
│   ├── 2026-04-11.md           # Yesterday's session log
│   └── ...
└── projects/
    └── <project-hash>/
        └── MEMORY.md            # Project-specific memories
```

## Memory Format

Each memory entry in `MEMORY.md` is a self-contained Markdown section:

```markdown
<!-- id:a1b2c3d4 date:2026-04-12 type:decision tags:architecture,api -->
## Chose REST over GraphQL for internal APIs

REST is simpler for CRUD-heavy internal services. GraphQL reserved for
public-facing APIs with complex query needs.

---
```

## Configuration

Create `~/.config/opencode/four-mem.jsonc`:

```jsonc
{
  // Storage location for memory files
  "storagePath": "~/.four-mem",

  // OpenCode provider for AI-powered auto-capture (optional)
  // Uses your existing OpenCode authentication
  "opencodeProvider": "anthropic",
  "opencodeModel": "claude-haiku-4-5-20251001",

  // Auto-capture session activity to diary
  "autoCaptureEnabled": true,
  "autoCaptureDelayMs": 10000,

  // Context injection into new sessions
  "injection": {
    "enabled": true,
    "maxMemories": 10,
    "diaryLookbackDays": 3,
    "injectOn": "first"
  },

  // Compact old diary entries
  "compaction": {
    "enabled": true,
    "maxDiaryAgeDays": 30
  },

  // Toast notifications
  "showToasts": true
}
```

## Usage

The plugin provides a `memory` tool that agents can call:

```typescript
// Store a new memory
memory({ mode: "add", title: "Use DTOs for APIs", content: "Never expose entities directly", type: "pattern", tags: "api,dto" })

// Search memories
memory({ mode: "search", query: "api architecture" })

// List all memories
memory({ mode: "list", limit: 10 })

// Remove a memory
memory({ mode: "forget", memoryId: "a1b2c3d4" })

// View diary
memory({ mode: "diary", date: "2026-04-12" })
```

### Memory Types

| Type | Use For |
|------|---------|
| `decision` | Architectural decisions, technology choices |
| `pattern` | Recurring coding patterns, best practices |
| `fact` | Project facts, configurations, endpoints |
| `preference` | Developer preferences, coding style |
| `error` | Known errors and their solutions |

## How It Works

1. **Session Start** — Plugin injects stored memories + recent diary into the first chat message
2. **During Session** — Agents can read/write memories via the `memory` tool
3. **Session Idle** — Plugin auto-captures session activity to today's diary
4. **Cross-Session** — Memories persist in Markdown files, available to all future sessions

## Architecture

```
Plugin Hooks:
├── chat.message  → Inject memories into first message
├── event         → Auto-capture on session.idle
└── tool.memory   → Agent-callable memory management

Modules:
├── config.ts           → JSONC config loader
├── diary.ts            → Daily diary file management
├── memory-store.ts     → MEMORY.md read/write/parse
├── search.ts           → Grep-based memory search
├── context-assembly.ts → Build injection context
├── auto-capture.ts     → Session activity extraction
└── plugin.ts           → Entry point, hook wiring
```

## Development

```bash
bun install
bun run build
bun run typecheck
```

## Inspiration

Inspired by [OpenClaw's memory architecture](https://docs.openclaw.ai/concepts/memory) — file-first, human-readable, local-only. Built for the [OpenCode](https://opencode.ai) plugin ecosystem.

## License

MIT