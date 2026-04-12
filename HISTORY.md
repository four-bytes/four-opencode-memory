# four-opencode-memory-plugin — Change History

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
