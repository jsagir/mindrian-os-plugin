#!/usr/bin/env node
'use strict';

/*
 * Phase 234-01 (D-10) -- the adoption engine is never gated behind a paid check.
 *
 * WHAT THIS DEFENDS. The 125 skills and 112 commands ARE the adoption engine:
 * they are what makes someone install MindrianOS on a foreign host in the first
 * place. The Brain is the paid layer. The failure mode this locks out is the
 * quiet drift where a methodology surface starts consulting a key resolver or a
 * plan field before it will do its work, so a user on the free path hits a wall
 * inside the very thing that was supposed to earn their trust.
 *
 * The predicate: no file under commands/*.md or skills/(*)/SKILL.md may mention
 * `resolve-brain-key` or `brainPlan`, except an EXPLICIT allowlist of
 * setup/connector surfaces whose whole job is wiring the optional Brain up.
 *
 * ADDING TO THE ALLOWLIST IS A DELIBERATE ACT. If a future skill legitimately
 * needs Brain-key resolution (a second connector-setup surface, say), it goes in
 * ALLOWLIST below WITH a written reason. An unexplained new match fails this
 * test loudly. That is the point: the gate must never silently pass.
 *
 * SELF-TEST FIRST. A grep gate that quietly stopped matching is indistinguishable
 * from a clean codebase, which is the same false-success shape this phase exists
 * to close. So the scanner is proved against synthetic files that plant each
 * forbidden token before it is trusted over the real tree.
 *
 * Canon Part 8: local fs reads only. Zero network reach, zero fs write outside
 * an mkdtemp scratch dir that is removed at the end.
 *
 * Run: node tests/test-234-adoption-engine-gate.cjs
 * Exit: 0 when every check passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The paid-path tokens a methodology surface must never reach for.
const PAID_GATE_TOKENS = ['resolve-brain-key', 'brainPlan'];

// EXPLICIT allowlist. Each entry carries its written reason.
const ALLOWLIST = [
  {
    file: 'commands/setup.md',
    reason: 'The setup command IS the Brain wiring flow; naming the key resolver is its job, not a gate on methodology.',
  },
  {
    file: 'skills/setup/SKILL.md',
    reason: 'Setup skill: same flow as commands/setup.md, walks the user through the optional Brain key.',
  },
  {
    file: 'skills/brain-connector/SKILL.md',
    reason: 'The Brain connector surface itself. Its entire subject is the optional paid layer, and it degrades to Tier 0 rather than blocking.',
  },
];

const ALLOWED_PATHS = new Set(ALLOWLIST.map((a) => a.file));

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    process.stdout.write('    ' + (e.message || String(e)) + '\n');
    if (detail) process.stdout.write('    ' + detail + '\n');
  }
}

// ---------------------------------------------------------------------------
// Surface discovery: commands/*.md and skills/<dir>/SKILL.md, relative paths.
// ---------------------------------------------------------------------------
function listMethodologySurfaces(root) {
  const out = [];

  const commandsDir = path.join(root, 'commands');
  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir)) {
      if (f.endsWith('.md')) out.push(path.join('commands', f));
    }
  }

  const skillsDir = path.join(root, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const rel = path.join('skills', e.name, 'SKILL.md');
      if (fs.existsSync(path.join(root, rel))) out.push(rel);
    }
  }

  return out.sort();
}

// Returns [{ file, token, line, text }] for every non-allowlisted hit.
function scanForPaidGateTokens(root, allowed) {
  const hits = [];
  for (const rel of listMethodologySurfaces(root)) {
    if (allowed.has(rel)) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch (_e) {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      for (const token of PAID_GATE_TOKENS) {
        if (lines[i].includes(token)) {
          hits.push({ file: rel, token, line: i + 1, text: lines[i].trim().slice(0, 160) });
        }
      }
    }
  }
  return hits;
}

process.stdout.write('Phase 234-01 (D-10): the adoption engine is not gated on a paid check\n');

// ---------------------------------------------------------------------------
// Self-test: the scanner actually bites, on a synthetic tree.
// ---------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-234-d10-'));
try {
  fs.mkdirSync(path.join(tmp, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'skills', 'planted'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'skills', 'clean'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'skills', 'excused'), { recursive: true });

  fs.writeFileSync(
    path.join(tmp, 'commands', 'planted.md'),
    'Run node lib/core/resolve-brain-key.cjs before doing anything.\n'
  );
  fs.writeFileSync(
    path.join(tmp, 'skills', 'planted', 'SKILL.md'),
    'Only proceed when req.brainPlan is "pro".\n'
  );
  fs.writeFileSync(
    path.join(tmp, 'skills', 'clean', 'SKILL.md'),
    'A perfectly ordinary methodology skill that mentions the Brain in prose.\n'
  );
  fs.writeFileSync(
    path.join(tmp, 'skills', 'excused', 'SKILL.md'),
    'Setup surface that names resolve-brain-key on purpose.\n'
  );

  const selfAllowed = new Set(['skills/excused/SKILL.md']);
  const selfHits = scanForPaidGateTokens(tmp, selfAllowed);
  const selfFiles = selfHits.map((h) => h.file);

  check(
    'self-test: catches `resolve-brain-key` planted in a command',
    selfFiles.includes(path.join('commands', 'planted.md'))
  );
  check(
    'self-test: catches `brainPlan` planted in a skill',
    selfFiles.includes(path.join('skills', 'planted', 'SKILL.md'))
  );
  check(
    'self-test: does NOT flag an ordinary skill that only says "Brain" in prose',
    !selfFiles.includes(path.join('skills', 'clean', 'SKILL.md'))
  );
  check(
    'self-test: honors the allowlist (excused surface not flagged)',
    !selfFiles.includes(path.join('skills', 'excused', 'SKILL.md'))
  );
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Allowlist hygiene: a stale entry silently widens the gate.
// ---------------------------------------------------------------------------
for (const entry of ALLOWLIST) {
  check(
    'allowlist entry still exists on disk: ' + entry.file,
    fs.existsSync(path.join(REPO_ROOT, entry.file))
  );
  check(
    'allowlist entry carries a written reason: ' + entry.file,
    typeof entry.reason === 'string' && entry.reason.trim().length > 20
  );
}

// ---------------------------------------------------------------------------
// The gate itself, over the real tree.
// ---------------------------------------------------------------------------
const surfaces = listMethodologySurfaces(REPO_ROOT);
check('discovered a real methodology surface set (not an empty sweep)', surfaces.length > 100);

const hits = scanForPaidGateTokens(REPO_ROOT, ALLOWED_PATHS);
check(
  'no non-allowlisted methodology surface references a paid-gate token',
  hits.length === 0,
  hits.map((h) => '      ' + h.file + ':' + h.line + ' [' + h.token + '] ' + h.text).join('\n')
);

if (hits.length) {
  process.stdout.write(
    '\n  Recovery: a methodology surface must not gate on the Brain. Either remove the\n' +
      '  reference, or -- if this surface is genuinely a setup/connector flow -- add it to\n' +
      '  ALLOWLIST in this file WITH a written reason.\n'
  );
}

process.stdout.write(
  '\n  scanned ' + surfaces.length + ' surface(s), ' + ALLOWLIST.length + ' allowlisted\n'
);
process.stdout.write('  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
