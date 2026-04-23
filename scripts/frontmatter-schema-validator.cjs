#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-07 -- frontmatter schema validation PostToolUse hook.
 * =================================================================
 * ADVISORY, NOT BLOCKING. Fires after Write|Edit|MultiEdit on files that
 * live inside a .room-root subtree (Phase 87-01a sentinel). Parses the
 * written file's YAML frontmatter, delegates structural validation to
 * lib/core/frontmatter-schemas.cjs (pure function), and:
 *
 *   - emits a one-line systemMessage advisory on violation,
 *   - appends one JSON line per violation-event to
 *     ${CLAUDE_PLUGIN_DATA}/schema-violations.jsonl (offense log for
 *     /mos:admin to consume in a future plan),
 *   - ALWAYS exits 0 (never blocks the Write / Edit / MultiEdit call).
 *
 * Policy rationale: per CONTEXT 88.1-07 R2 (Mitigation #2), user friction
 * is the anti-pattern for a schema enforcement surface. The hook surfaces
 * drift without halting work. The offense log lets the user review and
 * fix later via /mos:admin.
 *
 * Canon:
 *   Part 5 Evidence Graded By Context -- schemas codify per-section
 *     evidence-tier properties; the hook is the runtime enforcement arm.
 *   Part 6 Product-as-Venture -- plugin dog-foods its own schema on every
 *     write inside a .room-root subtree.
 *   Part 8 Graph Boundary -- hook runs LOCAL only; violations log to
 *     ${CLAUDE_PLUGIN_DATA} on the user's machine. No HTTP, no Brain.
 *
 * Claude Code PostToolUse envelope (read on stdin):
 *   {
 *     "tool_name":  "Write" | "Edit" | "MultiEdit",
 *     "tool_input": { "file_path": "<abs path>", ... },
 *     ...
 *   }
 *
 * Stdout emission (JSON on one line, per Phase 88-07 systemMessage pattern):
 *   { "additionalContext": null,
 *     "systemMessage": "<one-line advisory>" | null,
 *     "suppressOutput": false }
 *
 * Three-surface compatibility: triggered by Claude Code's PostToolUse
 * lifecycle via hooks.json. Desktop MCP and Cowork share the same hooks.json
 * bundle. No surface-specific branches.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------- Soft-fail wrapper ----------

function emitEnvelope(systemMessage) {
  try {
    const payload = {
      additionalContext: null,
      systemMessage: systemMessage === undefined ? null : systemMessage,
      suppressOutput: false,
    };
    process.stdout.write(JSON.stringify(payload) + '\n');
  } catch (_e) { /* best-effort */ }
}

function exitSilent() {
  emitEnvelope(null);
  process.exit(0);
}

// ---------- Helpers ----------

/**
 * Read stdin synchronously. Returns empty string on any failure.
 */
function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_e) {
    return '';
  }
}

/**
 * Extract file path from the Claude Code PostToolUse envelope.
 * Claude Code passes tool_name + tool_input. Older hook envelopes use
 * input.file_path; both shapes are tolerated.
 */
function extractFilePath(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const ti = payload.tool_input || payload.input || null;
  if (!ti || typeof ti !== 'object') return null;
  const candidates = ['file_path', 'filePath', 'path'];
  for (const k of candidates) {
    const v = ti[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * Extract the tool name. Accepts 'tool_name' (current) and 'tool' (legacy).
 */
function extractToolName(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.tool_name === 'string') return payload.tool_name;
  if (typeof payload.tool === 'string') return payload.tool;
  return null;
}

/**
 * Walk upward from filePath looking for a .room-root sentinel file
 * (Phase 87-01a). Returns { roomRoot, section } where section is the first
 * path segment under the room root, or null if no .room-root found within
 * MAX_DEPTH hops, or if the file is directly in the room root with no
 * section underneath.
 */
const MAX_DEPTH = 10;
function resolveRoomScope(filePath) {
  let dir = path.dirname(filePath);
  for (let hops = 0; hops < MAX_DEPTH; hops += 1) {
    if (dir === path.dirname(dir)) break; // reached filesystem root
    try {
      const sentinel = path.join(dir, '.room-root');
      if (fs.existsSync(sentinel)) {
        const rel = path.relative(dir, filePath);
        if (!rel || rel.startsWith('..')) return null;
        const parts = rel.split(path.sep).filter(Boolean);
        if (parts.length < 2) {
          // file is directly in room root, not inside a section. Skip.
          return null;
        }
        return { roomRoot: dir, section: parts[0] };
      }
    } catch (_e) { /* ignore; keep walking */ }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Parse YAML frontmatter block from a .md file buffer.
 * Uses gray-matter (already a repo dep per package.json). On any parse
 * error, returns null so the schema validator records a malformed
 * violation. Non-frontmatter files return an empty object (no YAML to
 * validate; schemas module treats {} as "all required missing" and the
 * caller short-circuits on lack of delimiters).
 */
function parseFrontmatter(buf) {
  // If the file does not START with a frontmatter delimiter, treat it as
  // "no frontmatter present": nothing to validate (return sentinel to
  // short-circuit in main()). This prevents spamming advisories for every
  // non-frontmatter markdown artifact.
  if (typeof buf !== 'string' || !/^---\r?\n/.test(buf)) {
    return { noFrontmatter: true };
  }
  let matter;
  try {
    matter = require('gray-matter');
  } catch (_e) {
    // gray-matter missing -> we cannot validate. Advisory hook must never
    // block, so treat the case as no-op.
    return { noFrontmatter: true };
  }
  try {
    const parsed = matter(buf);
    // gray-matter returns .data:{} when the frontmatter block is present
    // but empty. We return {} so the schema validator records missing-
    // required violations for that case.
    const data = (parsed && parsed.data && typeof parsed.data === 'object')
      ? parsed.data : {};
    return { frontmatter: data };
  } catch (_e) {
    // Malformed YAML inside the delimiters.
    return { frontmatter: null };
  }
}

/**
 * Resolve the violations JSONL path. Prefers ${CLAUDE_PLUGIN_DATA}, falls
 * back to ${HOME}/.mindrian/schema-violations.jsonl.
 */
function resolveLogPath() {
  const envDir = process.env.CLAUDE_PLUGIN_DATA;
  if (envDir && typeof envDir === 'string' && envDir.length > 0) {
    return path.join(envDir, 'schema-violations.jsonl');
  }
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  return path.join(home, '.mindrian', 'schema-violations.jsonl');
}

/**
 * Append one JSON line to the violations log. Creates the parent
 * directory if missing. Soft-fails silently on any I/O error.
 */
function appendViolationLog(entry) {
  const logPath = resolveLogPath();
  if (!logPath) return;
  try {
    const dir = path.dirname(logPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
  } catch (_e) { /* soft-fail */ }
}

/**
 * Summarize violations into a tight one-line advisory. Keeps the message
 * short enough for the statusline. LOCAL-only: no file content echoed,
 * only basename + field names.
 */
function summarizeViolations(violations, basename, severity) {
  const MAX_FIELDS = 3;
  const fields = [];
  for (const v of violations) {
    if (!v || !v.field || v.field.startsWith('__')) continue;
    if (fields.indexOf(v.field) === -1) fields.push(v.field);
    if (fields.length >= MAX_FIELDS) break;
  }
  const fieldStr = fields.length > 0 ? fields.join(', ') : '(structure)';
  const label = severity === 'warning' ? 'schema drift' : 'schema violation';
  return label + ': ' + fieldStr + ' in ' + basename;
}

// ---------- Main ----------

function main() {
  // Soft-fail: any exception in this hook becomes a silent advisory. The
  // PostToolUse surface must NEVER break a user's Write / Edit / MultiEdit
  // tool call.
  let raw;
  try {
    raw = readStdinSync();
    if (!raw || !raw.trim()) return exitSilent();
  } catch (_e) { return exitSilent(); }

  let payload;
  try { payload = JSON.parse(raw); }
  catch (_e) { return exitSilent(); }
  if (!payload || typeof payload !== 'object') return exitSilent();

  const tool = extractToolName(payload);
  if (tool && !/^(Write|Edit|MultiEdit)$/.test(tool)) return exitSilent();

  const filePath = extractFilePath(payload);
  if (!filePath) return exitSilent();

  // Only .md files carry frontmatter schemas we care about.
  if (!/\.md$/i.test(filePath)) return exitSilent();

  const scope = resolveRoomScope(filePath);
  if (!scope) return exitSilent(); // not in a room: nothing to validate

  // Read the file body. Absent or unreadable -> silent no-op.
  let body;
  try {
    if (!fs.existsSync(filePath)) return exitSilent();
    body = fs.readFileSync(filePath, 'utf8');
  } catch (_e) { return exitSilent(); }

  const parsed = parseFrontmatter(body);
  if (parsed.noFrontmatter) return exitSilent(); // no YAML block to check

  // Load the pure schema validator. If the require fails, silent no-op.
  let schemas;
  try {
    schemas = require(path.resolve(__dirname, '..', 'lib', 'core', 'frontmatter-schemas.cjs'));
  } catch (_e) { return exitSilent(); }

  let result;
  try {
    result = schemas.validate(filePath, parsed.frontmatter);
  } catch (_e) { return exitSilent(); }

  if (!result || result.severity === 'info' || result.valid === true) {
    return exitSilent();
  }

  const basename = path.basename(filePath);
  const violations = Array.isArray(result.violations) ? result.violations : [];

  // Append one log entry per advisory event. Keeps one-file-one-event
  // semantics for /mos:admin review.
  appendViolationLog({
    ts: new Date().toISOString(),
    file_path: filePath,
    room_root: scope.roomRoot,
    section: scope.section,
    schema_used: schemas.selectSchemaKey
      ? schemas.selectSchemaKey(filePath)
      : 'artifact-default',
    violations: violations,
    severity: result.severity,
  });

  // Severity routing:
  //   critical / error   -> systemMessage advisory
  //   warning            -> systemMessage drift notice (still advisory)
  //   info               -> silent (handled above)
  if (result.severity === 'critical' || result.severity === 'error' ||
      result.severity === 'warning') {
    const msg = summarizeViolations(violations, basename, result.severity);
    emitEnvelope(msg);
    process.exit(0);
  }

  return exitSilent();
}

// Outer try/catch is the soft-fail guarantee. An advisory hook must never
// crash the PostToolUse lifecycle.
try { main(); }
catch (_e) { try { exitSilent(); } catch (_f) { process.exit(0); } }
