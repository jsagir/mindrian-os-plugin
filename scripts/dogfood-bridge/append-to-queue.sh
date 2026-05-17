#!/usr/bin/env bash
# Phase 260517-dcw Task 1: PostToolUse hook handler -- queue-append for dog-food bridge.
#
# Triggered by ~/.claude/settings.json PostToolUse hook on Edit|Write|MultiEdit.
# Appends a single JSONL row to ~/.mindrian/dogfood-queue.jsonl when the edited
# path matches the dog-food filter list. NEVER blocks the parent tool call.
# Soft-fail by design (exit 0 on every code path).
#
# Canon Part 6 (Product-as-Venture): the dog-food bridge captures every Edit/
#   Write/MultiEdit on the plugin repo so the plugin's own venture room reflects
#   its own development activity in near-real time.
# Canon Part 8 (Graph Boundary): LOCAL-only. Zero network surface (no curl, no
#   fetch, no Brain). The queue lives under $HOME/.mindrian, never leaves the box.
#
# Performance budget: <5ms wall-clock (test threshold 50ms for CI noise). NO
#   node, NO jq, NO subshell expansion beyond a single grep+sed and a single
#   append. The CJS path-filter.cjs is the unit-test source of truth; the
#   inline bash case-statement below mirrors its closed allowlist byte-equivalent.

set +e
QUEUE_DIR="${HOME}/.mindrian"
QUEUE_FILE="${QUEUE_DIR}/dogfood-queue.jsonl"
PLUGIN_ROOT="/home/jsagi/MindrianOS-Plugin"

# Read stdin (Claude Code passes tool input as JSON on stdin). If stdin is a tty,
# there is no input -- exit silently. We do NOT block the parent.
if [ -t 0 ]; then exit 0; fi
INPUT="$(cat 2>/dev/null)"
[ -z "$INPUT" ] && exit 0

# Extract file_path from the JSON without invoking jq or node.
# Pattern: "file_path":"...". First match wins (MultiEdit edits[] uses the same key).
FILE_PATH="$(printf '%s' "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
[ -z "$FILE_PATH" ] && exit 0

# Inline filter (mirrors scripts/dogfood-bridge/path-filter.cjs byte-equivalent).
# Ignore wins (closed ignorelist). Allow subtree prefixes + exact files.
case "$FILE_PATH" in
  "$PLUGIN_ROOT"/.planning/quick/*|"$PLUGIN_ROOT"/node_modules/*|"$PLUGIN_ROOT"/.git/*|"$PLUGIN_ROOT"/tmp/*|"$PLUGIN_ROOT"/.backups/*)
    exit 0 ;;
  "$PLUGIN_ROOT"/commands/*|"$PLUGIN_ROOT"/skills/*|"$PLUGIN_ROOT"/agents/*|"$PLUGIN_ROOT"/scripts/*|"$PLUGIN_ROOT"/lib/*|"$PLUGIN_ROOT"/docs/*)
    ;;
  "$PLUGIN_ROOT"/.planning/phases/*)
    ;;
  "$PLUGIN_ROOT"/CHANGELOG.md|"$PLUGIN_ROOT"/.claude-plugin/plugin.json|"$PLUGIN_ROOT"/.planning/v1.13.1-EXECUTION-PLAN.md)
    ;;
  *)
    exit 0 ;;
esac

mkdir -p "$QUEUE_DIR" 2>/dev/null
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# tool_name is best-effort; default to 'unknown' if not present.
TOOL="$(printf '%s' "$INPUT" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"tool_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
[ -z "$TOOL" ] && TOOL="unknown"
# Escape the path for JSON (only backslash + double quote matter in absolute paths).
ESC_PATH="$(printf '%s' "$FILE_PATH" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
printf '{"ts":"%s","tool":"%s","path":"%s"}\n' "$TS" "$TOOL" "$ESC_PATH" >> "$QUEUE_FILE" 2>/dev/null
exit 0
