#!/usr/bin/env node
/**
 * check-hook-schema-compatibility.cjs
 *
 * RELEASE GATE: scans every hook script in the plugin for output patterns
 * that Claude Code's hook output schema rejects. Exits non-zero if any are
 * found, blocking the release.
 *
 * Background: Claude Code 2.x added `additionalProperties: false` to the
 * hook output schema. Top-level `systemMessage` and top-level `additionalContext`
 * are no longer accepted -- they must be wrapped in a `hookSpecificOutput`
 * envelope with a valid `hookEventName`. v1.10.18 hotfix (2026-04-26) landed after
 * Aryeh Holtzberg (PWS IRIS 2025) hit "Hook JSON output validation failed"
 * on every Read/Grep/Glob in v1.10.18.
 *
 * This script is the prevention. Run before every release. Wire into
 * scripts/release.sh and the pre-push hook.
 *
 * Reference: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * Exit codes:
 *   0 -- all hook scripts emit schema-compliant JSON (or exit silently)
 *   1 -- forbidden patterns found (release MUST be blocked)
 *   2 -- scanner failure (could not read scripts/hooks dirs)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['scripts', 'hooks', 'lib/core', 'lib/memory', 'lib/mcp'];

// Patterns that produce JSON Claude Code 2.x will REJECT.
// Each pattern is { regex, why, fix }
const FORBIDDEN_PATTERNS = [
  {
    name: 'top-level-systemMessage',
    regex: /JSON\.stringify\(\s*\{\s*systemMessage\s*:/,
    why: 'Top-level `systemMessage` is not in the documented hook output schema. additionalProperties: false rejects it.',
    fix: 'Wrap in hookSpecificOutput: { hookSpecificOutput: { hookEventName: "<EVENT>", additionalContext: <msg> } }',
  },
  {
    name: 'top-level-additionalContext-with-null',
    regex: /JSON\.stringify\(\s*\{\s*additionalContext\s*:\s*null\b/,
    why: 'Emitting `additionalContext: null` at top level fails schema validation. Either omit or wrap in hookSpecificOutput.',
    fix: 'For silent exits, do not emit JSON at all -- just process.exit(0). For real messages, use hookSpecificOutput envelope.',
  },
  {
    name: 'naked-systemMessage-write',
    regex: /process\.stdout\.write\(\s*JSON\.stringify\(\s*\{[^}]*systemMessage[^}]*\}\s*\)/,
    why: 'Direct stdout.write of a top-level systemMessage envelope. Same root cause as top-level-systemMessage.',
    fix: 'Wrap the message in hookSpecificOutput.additionalContext.',
  },
];

// Files explicitly allowed to contain forbidden patterns (e.g., this scanner
// itself defines them as strings). Add with care.
const ALLOWLIST = new Set([
  'scripts/check-hook-schema-compatibility.cjs', // self
]);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(cjs|js|mjs)$/.test(entry.name)) out.push(full);
  }
}

function scanFile(absPath) {
  const rel = path.relative(ROOT, absPath);
  if (ALLOWLIST.has(rel)) return [];
  const findings = [];
  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch (_e) {
    return [];
  }
  // Skip test files: tests legitimately fixture the broken pattern
  if (/\.test\.cjs$|\/test[s]?\//.test(rel)) return [];

  const lines = content.split('\n');
  for (const pattern of FORBIDDEN_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.regex.test(lines[i])) {
        findings.push({
          file: rel,
          line: i + 1,
          pattern: pattern.name,
          snippet: lines[i].trim().slice(0, 120),
          why: pattern.why,
          fix: pattern.fix,
        });
      }
    }
  }
  return findings;
}

function main() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);

  if (files.length === 0) {
    console.error('check-hook-schema-compatibility: no hook script files found to scan');
    process.exit(2);
  }

  const allFindings = [];
  for (const f of files) {
    allFindings.push(...scanFile(f));
  }

  if (allFindings.length === 0) {
    console.log('check-hook-schema-compatibility: PASS');
    console.log(`Scanned ${files.length} files. No forbidden hook output patterns found.`);
    process.exit(0);
  }

  console.error('check-hook-schema-compatibility: FAIL');
  console.error('');
  console.error(`Found ${allFindings.length} forbidden hook output pattern(s):`);
  console.error('');
  for (const f of allFindings) {
    console.error(`  ${f.file}:${f.line}  [${f.pattern}]`);
    console.error(`    snippet: ${f.snippet}`);
    console.error(`    why:     ${f.why}`);
    console.error(`    fix:     ${f.fix}`);
    console.error('');
  }
  console.error('Release BLOCKED. Fix the patterns above before bumping version.');
  console.error('Reference: https://docs.anthropic.com/en/docs/claude-code/hooks');
  process.exit(1);
}

main();
