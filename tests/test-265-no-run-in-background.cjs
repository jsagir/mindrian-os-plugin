#!/usr/bin/env node
// Phase 265-03 (RADAR-05) -- tripwire against the run_in_background regression.
//
// Three shipped commands (act.md, persona.md, grade.md) instructed Claude to pass
// `run_in_background: true` to the Agent tool, a Bash-tool parameter mistakenly
// attached to Agent-tool dispatch prose. Claude Code removes that parameter from
// the Agent tool whenever fork mode is on (the interactive default since 2.1.232),
// so the literal must never reappear in dispatch instructions -- prose IS the
// instruction here, so the check is a plain substring scan, not a code-only lint.
//
// TEST_265_RIB_SCOPE controls the walked file set:
//   'commands' -> commands/**/*.md only (used during Wave 1/2, before the
//                 mirror generators have re-run so skills/dist would false-fail)
//   anything else, including unset -> commands/**/*.md, skills/**/SKILL.md,
//                 dist/**/*.md (the full-scope run plan 265-06 owns)
//
// An absence tripwire alone would pass on a file that deleted its dispatch block
// entirely, so this also positively asserts that each of the three reviewed
// commands still contains `subagent_type` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.
//
// Plain Node script, no node:test. Hyphens only (no em-dashes).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function walk(dir, matchFn, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out; // missing dir (e.g. dist/ not yet built) is not a failure here
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, matchFn, out);
    } else if (entry.isFile() && matchFn(entry.name, full)) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles(scope) {
  const files = [];
  // commands/**/*.md
  walk(path.join(ROOT, 'commands'), (name) => name.endsWith('.md'), files);
  if (scope === 'commands') {
    return files;
  }
  // skills/**/SKILL.md
  walk(path.join(ROOT, 'skills'), (name) => name === 'SKILL.md', files);
  // dist/**/*.md
  walk(path.join(ROOT, 'dist'), (name) => name.endsWith('.md'), files);
  return files;
}

const scope = process.env.TEST_265_RIB_SCOPE === 'commands' ? 'commands' : 'all';
const files = collectFiles(scope);

if (files.length === 0) {
  console.error('FAIL: no files discovered under scope=' + scope + ' -- walker is broken');
  process.exit(1);
}

let failed = false;
const hits = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('run_in_background')) {
      hits.push({ file: path.relative(ROOT, file), line: i + 1, text: lines[i].trim() });
    }
  }
}

if (hits.length > 0) {
  failed = true;
  console.error('FAIL: run_in_background literal found (scope=' + scope + '):');
  for (const hit of hits) {
    console.error('  ' + hit.file + ':' + hit.line + '  ' + hit.text);
  }
} else {
  console.log('PASS: run_in_background absent from ' + files.length + ' file(s) (scope=' + scope + ')');
}

// Positive assertions: the absence tripwire alone would pass on a gutted dispatch
// block, so require the corrected replacement content to actually be present.
const REVIEWED = ['commands/act.md', 'commands/persona.md', 'commands/grade.md'];
const REQUIRED_STRINGS = ['subagent_type', 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'];

for (const rel of REVIEWED) {
  const full = path.join(ROOT, rel);
  let content;
  try {
    content = fs.readFileSync(full, 'utf8');
  } catch (e) {
    failed = true;
    console.error('FAIL: could not read ' + rel + ' -- ' + e.message);
    continue;
  }
  for (const required of REQUIRED_STRINGS) {
    if (!content.includes(required)) {
      failed = true;
      console.error('FAIL: ' + rel + ' is missing required string "' + required + '"');
    } else {
      console.log('PASS: ' + rel + ' contains "' + required + '"');
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('PASS: test-265-no-run-in-background (scope=' + scope + ')');
process.exit(0);
