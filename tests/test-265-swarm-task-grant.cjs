#!/usr/bin/env node
// Phase 265-12 (RADAR-12) -- registry-driven, two-token tripwire for the
// subagent-dispatch grant (Task or Agent) in commands/*.md frontmatter.
//
// WHY THIS TEST CHANGED FROM 265-03: 265-03 (RADAR-07/09) pinned a hardcoded
// three-name set equality (act.md, persona.md, grade.md) for the `Task`
// token only. That was the right control for a phase whose only fan-out
// work was those three commands, but reading the actual frontmatter (not
// the research summary) found two problems: (1) Phase 265's second pass
// settled five MORE fan-outs (mos-reason, scout, file-meeting, vault,
// find-analogies), each of which needs a reviewed row BEFORE it ships a
// dispatch instruction, and a frozen literal cannot distinguish a reviewed
// addition from a silent one; (2) commands/deep-grade.md ALREADY carried
// the dispatch grant spelled `Agent`, not `Task`, so the Task-only grep
// reported three privileged commands when the repo actually had four -- a
// false-coverage signal inside the exact control meant to prevent one.
// The registry (data/subagent-dispatch-grants.json) makes review the gate
// instead of a frozen list, and this test enforces both spellings so the
// same class of miss cannot happen again.
//
// RATIFICATION IS A SEPARATE, LATER PLAN (not per fan-out): five fan-out
// plans run in the same wave, and all five writing this one JSON file to
// flip their own row to `granted` would be a git-index race. Each fan-out
// plan ships its command edit only; a single later ratification plan
// (265-23) flips every built row to `granted` in one write. Until then, a
// `pending` row whose command already declares the token reports as
// `unratified` -- expected mid-phase, not a failure, unless the phase gate
// sets TEST_265_GRANTS_STRICT=1.
//
// Frontmatter is sliced with the same plain fence-delimited read used by
// the 265-03 predecessor and lib/core/mva-rule-linter.cjs (no YAML dep).
//
// Plain Node script, no node:test. Hyphens only (no em-dashes).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands');
const REGISTRY_PATH = path.join(ROOT, 'data', 'subagent-dispatch-grants.json');

const STRICT = process.env.TEST_265_GRANTS_STRICT === '1';
const NON_AGENT_REVIEWER_DENYLIST = new Set(['larry', 'brain', 'system', 'assistant', 'claude']);

// ---------------------------------------------------------------------------
// sliceFrontmatter(content) -> raw frontmatter text between the --- fences,
// or null if the file has no fenced frontmatter block.
// ---------------------------------------------------------------------------
function sliceFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// allowedToolsList(frontmatterText) -> array of tool-list entries under the
// `allowed-tools:` key, or [] if the key is absent. Handles a `- Item` dash
// list indented under `allowed-tools:`, stopping at the next top-level key.
// Comment lines interleaved with the list are skipped.
// ---------------------------------------------------------------------------
function allowedToolsList(fmText) {
  const lines = fmText.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (/^\s*#/.test(line)) continue; // comment line, anywhere
    if (/^allowed-tools:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (/^\s*-\s+/.test(line)) {
        out.push(line.replace(/^\s*-\s+/, '').trim());
        continue;
      }
      if (line.trim() === '') continue; // tolerate stray blank lines
      inBlock = false; // any other non-list, non-comment line ends the block
    }
  }
  return out;
}

function fail(message) {
  console.error('FAIL: ' + message);
}

let failed = false;
let failCount = 0;
let passCount = 0;

function recordFail(message) {
  failed = true;
  failCount += 1;
  fail(message);
}

function recordPass() {
  passCount += 1;
}

// ---------------------------------------------------------------------------
// Load the registry.
// ---------------------------------------------------------------------------
let registry;
try {
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
} catch (e) {
  console.error('FAIL: could not read/parse ' + REGISTRY_PATH + ': ' + e.message);
  process.exit(1);
}

const registryTokens = new Set(registry.tokens || []);
const grants = registry.grants || [];

// registry keyed by "command|token" for exact-pair lookup, and by command
// for the status-truth arm.
const registryByPair = new Map();
const registryByCommand = new Map();
for (const row of grants) {
  registryByPair.set(row.command + '|' + row.token, row);
  registryByCommand.set(row.command, row);
}

// ---------------------------------------------------------------------------
// Scan commands/*.md, building `declared`: every {path, token} pair where
// the command's allowed-tools list carries Task or Agent, plus the
// pre-approval-comment check (generalized from 265-03's single-file check).
// ---------------------------------------------------------------------------
const files = fs
  .readdirSync(COMMANDS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

if (files.length === 0) {
  console.error('FAIL: no commands/*.md files discovered -- directory read is broken');
  process.exit(1);
}

const declared = []; // [{ path: 'commands/x.md', token: 'Task'|'Agent' }]
const missingReason = [];

for (const name of files) {
  const relPath = 'commands/' + name;
  const full = path.join(COMMANDS_DIR, name);
  const content = fs.readFileSync(full, 'utf8');
  const fm = sliceFrontmatter(content);
  if (fm === null) continue; // no frontmatter at all -- cannot carry the grant
  const tools = allowedToolsList(fm);
  for (const token of ['Task', 'Agent']) {
    if (tools.includes(token)) {
      declared.push({ path: relPath, token });
      // The adjacent "pre-approval" comment convention was introduced by 265-03
      // for the Task grant it added, and every plan that adds a NEW Task grant
      // from here on is required to carry it (arm 4 below). It is scoped to
      // Task only, not Agent, because the pre-existing Agent grants
      // (deep-grade, opportunities, research) predate that convention and this
      // plan's files_modified list forbids editing any commands/*.md file to
      // retrofit one. Their review lives in the registry row itself (reason +
      // evidence), which this plan CAN write. A follow-on plan may add the
      // inline comment to the Agent-token files and, at that point, arm 4
      // would need widening back to both tokens.
      if (token === 'Task' && !/pre-approval/i.test(fm)) {
        missingReason.push(relPath + ' (' + token + ')');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ARM 1: NO SILENT WIDENING. Every declared {path, token} pair MUST have a
// registry row with the SAME command AND the SAME token. This is the direct
// successor to 265-03's set-equality property, now covering both tokens.
// ---------------------------------------------------------------------------
const arm1Offenders = [];
for (const d of declared) {
  const exactRow = registryByPair.get(d.path + '|' + d.token);
  if (!exactRow) {
    const anyRow = registryByCommand.get(d.path);
    arm1Offenders.push({
      path: d.path,
      declaredToken: d.token,
      registryToken: anyRow ? anyRow.token : null,
    });
  }
}

if (arm1Offenders.length > 0) {
  recordFail(
    'ARM 1 (no silent widening): command(s) declare a dispatch token with no matching registry ' +
      'row: ' +
      JSON.stringify(arm1Offenders)
  );
} else {
  recordPass();
  console.log('PASS: ARM 1 -- every declared Task/Agent grant has a matching reviewed registry row');
}

// ---------------------------------------------------------------------------
// ARM 2: STATUS TRUTH.
// ---------------------------------------------------------------------------
const declaredByCommand = new Map();
for (const d of declared) {
  if (!declaredByCommand.has(d.path)) declaredByCommand.set(d.path, new Set());
  declaredByCommand.get(d.path).add(d.token);
}

let unratifiedCount = 0;
for (const row of grants) {
  const commandDeclaresToken = (declaredByCommand.get(row.command) || new Set()).has(row.token);

  if (row.status === 'granted' && commandDeclaresToken) {
    console.log('granted: ' + row.command);
    recordPass();
  } else if (row.status === 'granted' && !commandDeclaresToken) {
    recordFail(
      'ARM 2 (status truth): ' +
        row.command +
        ' registry row claims status "granted" for token ' +
        row.token +
        ' but the command file does not declare it -- stale registry claiming an unbuilt privilege'
    );
  } else if (row.status === 'pending' && !commandDeclaresToken) {
    console.log('pending: ' + row.command);
    recordPass();
  } else if (row.status === 'pending' && commandDeclaresToken) {
    unratifiedCount += 1;
    console.log('unratified: ' + row.command);
    if (STRICT) {
      recordFail(
        'ARM 2 (status truth, TEST_265_GRANTS_STRICT=1): ' +
          row.command +
          ' declares token ' +
          row.token +
          ' but its registry row is still "pending" -- run the ratification plan before the gate'
      );
    } else {
      recordPass();
    }
  } else {
    recordFail('ARM 2 (status truth): ' + row.command + ' has unrecognized status "' + row.status + '"');
  }
}
console.log('unratified count: ' + unratifiedCount);

// ---------------------------------------------------------------------------
// ARM 3: ROW COMPLETENESS.
// ---------------------------------------------------------------------------
const REQUIRED_KEYS = [
  'command',
  'token',
  'status',
  'dispatch_shape',
  'fan_bound',
  'reason',
  'reviewed_by',
  'reviewed_date',
  'evidence',
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let arm3Ok = true;
for (const row of grants) {
  for (const key of REQUIRED_KEYS) {
    if (!row[key]) {
      recordFail('ARM 3 (row completeness): ' + row.command + ' missing/empty key "' + key + '"');
      arm3Ok = false;
    }
  }
  if (row.reviewed_by && NON_AGENT_REVIEWER_DENYLIST.has(String(row.reviewed_by).toLowerCase())) {
    recordFail(
      'ARM 3 (row completeness): ' +
        row.command +
        ' reviewed_by "' +
        row.reviewed_by +
        '" is an agent identity, not a human reviewer'
    );
    arm3Ok = false;
  }
  if (row.reviewed_date && !DATE_RE.test(row.reviewed_date)) {
    recordFail(
      'ARM 3 (row completeness): ' + row.command + ' reviewed_date "' + row.reviewed_date + '" is not YYYY-MM-DD'
    );
    arm3Ok = false;
  }
  if (row.token && !registryTokens.has(row.token)) {
    recordFail(
      'ARM 3 (row completeness): ' + row.command + ' token "' + row.token + '" is not in the registry tokens array'
    );
    arm3Ok = false;
  }
}
if (arm3Ok) {
  recordPass();
  console.log('PASS: ARM 3 -- every registry row is complete, reviewed by a human, dated, and token-valid');
}

// ---------------------------------------------------------------------------
// ARM 4 (generalized from 265-03's per-file property): every declared Task
// grant carries an adjacent "pre-approval" comment near its allowed-tools
// block. Scoped to Task only -- see the comment at the declared-token scan
// above for why Agent is exempt (pre-existing grants, no command file may be
// touched by this plan).
// ---------------------------------------------------------------------------
if (missingReason.length > 0) {
  recordFail(
    'ARM 4 (written reason): Task grant present without an adjacent "pre-approval" reason ' +
      'comment in: ' +
      missingReason.join(', ')
  );
} else {
  recordPass();
  console.log('PASS: ARM 4 -- every declared Task grant carries an adjacent pre-approval reason comment');
}

// ---------------------------------------------------------------------------
// Summary and exit.
// ---------------------------------------------------------------------------
console.log('subagent-dispatch-grants: ' + passCount + ' passed, ' + failCount + ' failed');

if (failed) {
  console.error(
    'Offending state: ' +
      JSON.stringify({ declared, arm1Offenders, missingReason, unratifiedCount, strict: STRICT }, null, 2)
  );
  process.exit(1);
}

console.log('PASS: test-265-swarm-task-grant (' + files.length + ' commands/*.md file(s) scanned, ' + grants.length + ' registry row(s))');
process.exit(0);
