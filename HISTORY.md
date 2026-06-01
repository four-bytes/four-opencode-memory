# four-opencode-memory-plugin — Change History

## v0.5.0 — 2026-06-01

### Added
- Summary Cache (P7): chunk/file/module summaries with content_hash versioning
- `src/summary-cache.ts`: getCachedSummary, setCachedSummary, auto-invalidation, cache stats
- Integration with existing memory-store (MemoryEntry type="summary")
- Tests: 9 summary cache tests (hash, roundtrip, invalidation, stats)

## v0.4.0 — 2026-05-31

### Changed
- **BREAKING:** Proaktive Memory-Context-Injection in erste User-Message entfernt
- Memory wird nun ausschließlich on-demand via `memory({ mode: "search" })` Tool abgerufen
- CONFIG.injection.enabled / injectOn / Felder sind effektiv no-op (Cleanup in späterem PR)

### Migration
- Nutzer die auf Auto-Inject angewiesen sind: explizit `memory({mode:"search",query:"..."})` vor relevanten Tasks aufrufen



## v0.3.0 — 2026-05-31

### Changed
- **BREAKING:** npm-Paket umbenannt: `four-opencode-memory-plugin` → `@four-bytes/four-opencode-memory` (Sprint 0 der opencode-plugins Strategy)
- **BREAKING:** License gewechselt: MIT → Apache-2.0 (Copyright 2025 Four Bytes bleibt)
- GitHub-Repo umbenannt: `four-bytes/four-opencode-memory-plugin` → `four-bytes/four-opencode-memory`

### Migration
- Nutzer mit `four-opencode-memory-plugin` müssen auf `@four-bytes/four-opencode-memory` umstellen
- Altes Paket wird auf npm deprecated (separater Schritt)


## [0.2.2] - 2026-04-12

### Added
- Recall intent detection: "do you remember", "weißt du noch", "was hatten wir besprochen" etc. triggers automatic memory search
- System prompt now covers both STORE and RECALL intents in any language

## [0.2.1] - 2026-04-12

### Changed
- Memory storage is now AI-driven: the model detects "remember" intent in ANY language via system prompt
- Removed hardcoded trigger word list — AI handles language detection naturally
- Plugin-level auto-store simplified to minimal fallback for "remember this:" / "merk dir:" patterns only
- System prompt emphasizes intent detection over keyword matching

## [0.2.0] - 2026-04-12

### Added
- Multi-language remember triggers: English + German (remember, merk dir, speicher, vergiss nicht, etc.)
- Loose trigger matching: just "remember" anywhere in message triggers auto-store
- Specific triggers extract content after the phrase, loose triggers use full message
- Updated system prompt injection to mention both languages

## [0.1.9] - 2026-04-12

### Changed
- Improved MEMORY.md seed template with OpenClaw-style soul/identity sections
- New installations now get structured identity, tech stack, coding preferences, and workflow sections

## [0.1.8] - 2026-04-12

### Fixed
- "Remember this" auto-store now saves to global scope (cross-project) instead of project-scoped
- Title truncation now breaks at word boundaries

## [0.1.7] - 2026-04-12

### Added
- Auto-store: plugin now detects "remember this/that", "store this", "save this", "don't forget" in user messages and automatically stores to MEMORY.md
- Injects confirmation as synthetic message part so the AI acknowledges the storage
- No longer relies on the model choosing to call the memory tool for explicit remember requests

## [0.1.6] - 2026-04-12

### Added
- System prompt injection via experimental.chat.system.transform hook
- All agents now automatically receive memory tool instructions
- Mandatory "remember this" trigger behavior injected at system level

## [0.1.5] - 2026-04-12

### Fixed
- Removed duplicate mcp_memory tool registration (claude plugin already adds mcp_ prefix)

## [0.1.4] - 2026-04-12

### Fixed
- Registered memory tool under both `memory` and `mcp_memory` names for compatibility
- Added startup debug log to verify plugin loading

## [0.1.3] - 2026-04-12

### Fixed
- Plugin now shows as "four-mem" in OpenCode instead of generic "plugin"
- Restricted file path detection in auto-capture to prevent scanning unrelated directories
- Tightened regex to only match source-code-like paths

## [0.1.2] - 2026-04-12

### Added
- Auto-seed MEMORY.md with starter template on first run
- Bootstrap identity and preferences for new installations

## [0.1.1] - 2026-04-12

### Fixed
- Version bump for proper release management

## [0.1.0] - 2026-04-12

### Added
- Initial release
- Memory store with MEMORY.md files (global + per-project scope)
- Daily diary with auto-capture on session idle
- Context injection via chat.message hook
- Grep-based search across all memory files
- Memory tool with modes: add, search, list, forget, diary, help
- JSONC configuration support
- Toast notifications for auto-capture events
- Zero external runtime dependencies
