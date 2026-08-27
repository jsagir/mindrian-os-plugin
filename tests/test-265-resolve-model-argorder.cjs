#!/usr/bin/env node
// Phase 265-03 (RADAR-09) -- lint against the reversed resolveModel argument bug.
//
// lib/core/model-profiles.cjs:119 -- function resolveModel(roomDir, agentType).
// commands/persona.md and commands/grade.md called it as resolveModel('<agentType>',
// roomPath) -- arguments reversed, so the room config load fails, the agent-type
// lookup misses, and the function falls through to its Step 5 default, always
// returning 'sonnet' and silently bypassing venture-stage hints and per-agent
// overrides. This lint reads the REAL MODEL_PROFILES key set from
// lib/core/model-profiles.cjs (never a hardcoded array) so a new agent type is
// caught automatically, and asserts every resolveModel( call site in commands/*.md
// has its agentType argument in the SECOND position, not the first.
//
// Plain Node script, no node:test. Hyphens only (no em-dashes).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands');

const { MODEL_PROFILES } = require('../lib/core/model-profiles.cjs');
const AGENT_TYPE_KEYS = new Set(Object.keys(MODEL_PROFILES));

if (AGENT_TYPE_KEYS.size === 0) {
  console.error('FAIL: MODEL_PROFILES exported an empty key set -- cannot lint against it');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// extractCalls(content) -> [{ line, text, args: [rawArg, ...] }, ...]
//
// Finds every `resolveModel(` occurrence and captures the argument list up to
// its matching close paren. The call sites in commands/*.md are simple
// (identifier or quoted-string arguments, no nested parens), so a balanced-
// paren scan from the opening `(` is sufficient and safer than a single regex.
// ---------------------------------------------------------------------------
function extractCalls(content) {
  const calls = [];
  const callRe = /resolveModel\(/g;
  let m;
  while ((m = callRe.exec(content)) !== null) {
    const openIdx = m.index + m[0].length - 1; // index of the '('
    let depth = 0;
    let endIdx = -1;
    for (let i = openIdx; i < content.length; i++) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) continue; // unbalanced, skip rather than crash
    const argsText = content.slice(openIdx + 1, endIdx);
    const args = splitTopLevelArgs(argsText);
    const lineNumber = content.slice(0, m.index).split('\n').length;
    calls.push({ line: lineNumber, text: content.slice(m.index, endIdx + 1), args });
  }
  return calls;
}

function splitTopLevelArgs(argsText) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of argsText) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

function quotedStringLiteral(arg) {
  const m = /^['"]([^'"]*)['"]$/.exec(arg.trim());
  return m ? m[1] : null;
}

let failed = false;
const files = fs
  .readdirSync(COMMANDS_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => path.join(COMMANDS_DIR, f));

const filesWithValidSecondArg = new Set();

for (const full of files) {
  const rel = path.relative(ROOT, full);
  const content = fs.readFileSync(full, 'utf8');
  const calls = extractCalls(content);
  for (const call of calls) {
    if (call.args.length < 1) continue;
    const firstLiteral = quotedStringLiteral(call.args[0]);
    if (firstLiteral !== null && AGENT_TYPE_KEYS.has(firstLiteral)) {
      failed = true;
      console.error(
        'FAIL: ' + rel + ':' + call.line + ' -- resolveModel called with agentType ' +
        'literal "' + firstLiteral + '" as the FIRST argument (must be roomDir, agentType): ' +
        call.text
      );
    }
    if (call.args.length >= 2) {
      const secondLiteral = quotedStringLiteral(call.args[1]);
      if (secondLiteral !== null && AGENT_TYPE_KEYS.has(secondLiteral)) {
        filesWithValidSecondArg.add(rel);
      }
    }
  }
}

// Positive assertion: both commands/persona.md and commands/grade.md must
// contain a resolveModel( call whose SECOND positional argument is a quoted
// agentType literal from the real MODEL_PROFILES key set.
const REQUIRED_CORRECT = ['commands/persona.md', 'commands/grade.md'];
for (const rel of REQUIRED_CORRECT) {
  if (!filesWithValidSecondArg.has(rel)) {
    failed = true;
    console.error(
      'FAIL: ' + rel + ' has no resolveModel( call with a valid agentType literal ' +
      'in the SECOND argument position'
    );
  } else {
    console.log('PASS: ' + rel + ' calls resolveModel(roomDir, agentType) correctly');
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  'PASS: test-265-resolve-model-argorder (agent-type key set from lib/core/model-profiles.cjs: ' +
  [...AGENT_TYPE_KEYS].sort().join(', ') + ')'
);
process.exit(0);
