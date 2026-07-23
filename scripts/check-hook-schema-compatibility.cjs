#!/usr/bin/env node
/**
 * check-hook-schema-compatibility.cjs
 *
 * RELEASE GATE: enumerates every script Claude Code registers as a Stop hook
 * (read straight off hooks/hooks.json's Stop array -- never hand-guessed),
 * follows each one level of subprocess invocation (a Stop hook script that
 * shells out to another repo script), and greps the resulting file set for
 * the literal pattern `hookEventName: 'Stop'`. Exits non-zero if found,
 * blocking the release.
 *
 * CORRECTED 2026-07-23 (RCA: stop-hook-invalid-hookspecificoutput-schema).
 * This file's ORIGINAL version (shipped as the "v1.10.19" hotfix, 2026-04-26)
 * encoded the OPPOSITE, BACKWARDS rule: it banned top-level `systemMessage`
 * and told authors to wrap output in a `hookSpecificOutput` envelope. That
 * premise was never true for the Stop event and was live-disproven on
 * 2026-07-23 when a real user hit "Hook JSON output validation failed:
 * - : Invalid input" on every single turn, traced to exactly the
 * hookSpecificOutput wrapping this file used to recommend. Claude Code's own
 * "Expected schema" error text lists `systemMessage` as a valid TOP-LEVEL
 * Stop-hook field and defines `hookSpecificOutput` only for THREE events --
 * PreToolUse, UserPromptSubmit, PostToolUse -- never Stop. Including
 * hookSpecificOutput on a Stop envelope trips `additionalProperties: false`
 * and rejects the WHOLE envelope, not just that key.
 *
 * This is the FOURTH live occurrence of the same defect class (see the RCA
 * for the full history: scripts/on-stop v1.10.9->v1.10.10 fix 2026-04-15 was
 * the first and, until now, only fix; scripts/feynman-minto-guardian.cjs
 * reintroduced it under this very script's wrong premise; scripts/on-stop's
 * own Phase 198-09 MCP-first branch reintroduced it a third time in the SAME
 * file that had already been fixed once; scripts/check-card-fire.cjs plus a
 * live user report was the fourth). Three point-fixes with no structural
 * gate is exactly why it recurred three times -- this script is that gate,
 * now finally checking the CORRECT rule instead of the wrong one.
 *
 * Reference: https://docs.anthropic.com/en/docs/claude-code/hooks
 * Full RCA: .planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md
 *
 * Exit codes:
 *   0 -- no Stop-hook-reachable script emits a Stop-shaped hookSpecificOutput
 *   1 -- forbidden pattern found (release MUST be blocked)
 *   2 -- scanner failure (could not read hooks.json or resolve script files)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_JSON_PATH = path.join(ROOT, 'hooks', 'hooks.json');

// The forbidden shape itself is self-identifying: there is no valid Claude
// Code JSON output anywhere that legitimately contains hookEventName: 'Stop'
// inside a hookSpecificOutput block, because Stop has no hookSpecificOutput
// variant in the schema at all. One literal pattern, checked only against
// the files a Stop hook can actually reach (see resolveStopHookFiles below)
// so a test fixture elsewhere in the repo that intentionally documents the
// old broken shape (e.g. a regression test for THIS scanner) cannot trip a
// false positive.
const FORBIDDEN_STOP_HOOKSPECIFICOUTPUT_RE = /hookEventName\s*:\s*['"]Stop['"]/;

// Files explicitly allowed to contain the literal forbidden pattern (this
// scanner's own source describes the pattern; excluding it from its own scan
// avoids a self-referential false positive).
const ALLOWLIST = new Set([
  'scripts/check-hook-schema-compatibility.cjs', // self (documents the pattern above)
]);

function readHooksJson() {
  try {
    const raw = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('check-hook-schema-compatibility: could not read/parse hooks/hooks.json: ' + (e && e.message || e));
    process.exit(2);
  }
}

// Extract the actual script FILE path a hooks.json "command" string invokes.
// Two shapes appear in this repo's hooks.json:
//   1. "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" <name>" -- the polyglot
//      wrapper execs "scripts/<name>" verbatim (see hooks/run-hook.cmd:64:
//      `exec bash "${PLUGIN_ROOT}/scripts/${SCRIPT_NAME}" "$@"`).
//   2. "node \"${CLAUDE_PLUGIN_ROOT}/scripts/<name>.cjs\" [args]" -- direct.
// Returns a repo-relative path (e.g. "scripts/on-stop") or null if the
// command shape is not recognized (never silently drops -- caller treats
// null as a scanner-failure condition).
function resolveCommandToScriptPath(command) {
  const runHookMatch = command.match(/run-hook\.cmd["']?\s+([\w-]+)/);
  if (runHookMatch) return path.join('scripts', runHookMatch[1]);
  const nodeScriptMatch = command.match(/scripts\/([\w.-]+\.cjs)/);
  if (nodeScriptMatch) return path.join('scripts', nodeScriptMatch[1]);
  return null;
}

// One level of transitive follow: a Stop hook script (esp. the bash
// scripts/on-stop dispatcher) can itself shell out to another repo script
// whose stdout feeds into -- or is discarded from -- the same Stop hook
// invocation. Scan the resolved script's own source for references to other
// scripts/ files so a case like on-stop invoking
// scripts/feynman-minto-guardian.cjs is caught even though hooks.json never
// registers that file directly. Extra files found this way are strictly
// additive to the scan set -- they cannot cause a false positive because the
// only thing checked is the one specific forbidden literal.
function findReferencedScripts(fileContent) {
  const found = new Set();
  const cjsShRe = /scripts\/([\w.-]+\.(?:cjs|sh))/g;
  let m;
  while ((m = cjsShRe.exec(fileContent))) {
    found.add(path.join('scripts', m[1]));
  }
  const siblingRe = /\$\{?SCRIPT_DIR\}?\/([\w-]+)"/g;
  while ((m = siblingRe.exec(fileContent))) {
    found.add(path.join('scripts', m[1]));
  }
  return found;
}

function resolveStopHookFiles() {
  const hooksJson = readHooksJson();
  const stopArray = hooksJson && hooksJson.hooks && Array.isArray(hooksJson.hooks.Stop)
    ? hooksJson.hooks.Stop
    : null;
  if (!stopArray) {
    console.error('check-hook-schema-compatibility: hooks.json has no hooks.Stop array to enumerate');
    process.exit(2);
  }

  const files = new Set();
  const unresolved = [];
  for (const group of stopArray) {
    const entries = Array.isArray(group.hooks) ? group.hooks : [];
    for (const entry of entries) {
      const command = typeof entry.command === 'string' ? entry.command : '';
      const resolved = resolveCommandToScriptPath(command);
      if (resolved) {
        files.add(resolved);
      } else {
        unresolved.push(command);
      }
    }
  }

  if (unresolved.length > 0) {
    console.error('check-hook-schema-compatibility: could not resolve script path for Stop hook command(s):');
    for (const c of unresolved) console.error('  ' + c);
    process.exit(2);
  }

  // One level of transitive follow for every directly-registered file.
  const directFiles = Array.from(files);
  for (const rel of directFiles) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let content;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch (_e) {
      continue;
    }
    for (const ref of findReferencedScripts(content)) {
      files.add(ref);
    }
  }

  return Array.from(files);
}

function scanFile(rel) {
  if (ALLOWLIST.has(rel)) return [];
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch (_e) {
    return [];
  }
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (FORBIDDEN_STOP_HOOKSPECIFICOUTPUT_RE.test(lines[i])) {
      findings.push({
        file: rel,
        line: i + 1,
        snippet: lines[i].trim().slice(0, 160),
      });
    }
  }
  return findings;
}

function main() {
  const files = resolveStopHookFiles();

  if (files.length === 0) {
    console.error('check-hook-schema-compatibility: resolved zero Stop-hook-reachable script files (scanner bug or empty hooks.Stop array)');
    process.exit(2);
  }

  const allFindings = [];
  for (const f of files) {
    allFindings.push(...scanFile(f));
  }

  if (allFindings.length === 0) {
    console.log('check-hook-schema-compatibility: PASS');
    console.log(`Scanned ${files.length} Stop-hook-reachable file(s) (${files.join(', ')}). No Stop-shaped hookSpecificOutput found.`);
    process.exit(0);
  }

  console.error('check-hook-schema-compatibility: FAIL');
  console.error('');
  console.error(`Found ${allFindings.length} Stop-shaped hookSpecificOutput occurrence(s) -- Claude Code's schema defines`);
  console.error('hookSpecificOutput only for PreToolUse, UserPromptSubmit, and PostToolUse. Including it on a Stop');
  console.error('envelope rejects the WHOLE envelope (additionalProperties: false), replacing your calm');
  console.error('systemMessage/reason text with a raw "Hook JSON output validation failed" dump for the user.');
  console.error('');
  for (const f of allFindings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    ${f.snippet}`);
  }
  console.error('');
  console.error('Release BLOCKED. Remove hookSpecificOutput from these Stop-hook envelopes; use only');
  console.error('{ continue, suppressOutput, stopReason, decision, reason, systemMessage, permissionDecision }.');
  console.error('See .planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md');
  process.exit(1);
}

main();
