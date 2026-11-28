#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a): the release order. The 2 rule scripts
// run in the acceptance point coverage-gate of scripts/doctor.cjs (R1), which
// scripts/release.sh runs before the tag (R2, read only). R3 couples the
// comment fix to the grant state on the real tree; R4 is its mutation arm.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const grants = require('../scripts/check-tool-grants.cjs');

let passed = 0;
let failed = 0;
function leg(id, text, fn) {
  let msg = null;
  try {
    msg = fn();
  } catch (e) {
    msg = 'threw: ' + (e && e.message ? e.message : String(e));
  }
  if (msg) {
    failed += 1;
    process.stdout.write('FAIL: ' + id + ' ' + text + ' -- ' + msg + '\n');
  } else {
    passed += 1;
    process.stdout.write('ok: ' + id + ' ' + text + '\n');
  }
}

function coverageGateText() {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'doctor.cjs'), 'utf8');
  const at = src.indexOf("id: 'coverage-gate'");
  if (at === -1) return null;
  const end = src.indexOf('const results = []', at);
  return src.slice(at, end === -1 ? at + 20000 : end);
}

leg('R1', 'the coverage-gate point runs both rule scripts and stays a pre-tag blocker', () => {
  const t = coverageGateText();
  if (!t) return 'coverage-gate point not found';
  const errs = [];
  if (!/script:\s*'check-frontmatter-split\.cjs'/.test(t)) errs.push('no check-frontmatter-split.cjs gate');
  if (!/script:\s*'check-tool-grants\.cjs'/.test(t)) errs.push('no check-tool-grants.cjs gate');
  if (!/severity:\s*'blocker'/.test(t)) errs.push('severity is not blocker');
  if (!/applies_to:\s*\[[^\]]*'pre-tag'/.test(t)) errs.push('applies_to lacks pre-tag');
  return errs.length ? errs.join('; ') : null;
});

leg('R2', 'scripts/release.sh runs the pre-tag acceptance before the first git tag command', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'scripts', 'release.sh'), 'utf8').split('\n');
  const acc = lines.findIndex((l) => l.indexOf('scripts/doctor.cjs" --acceptance --pre-tag') !== -1 && !/^\s*#/.test(l));
  const tag = lines.findIndex((l) => /^\s*git tag\b/.test(l));
  if (acc === -1) return 'no pre-tag acceptance call';
  if (tag === -1) return 'no git tag command';
  return acc < tag ? null : 'acceptance line ' + (acc + 1) + ' is after tag line ' + (tag + 1);
});

leg('R3', 'coupling on the real tree: the comment fix never ships without the grant state', () => {
  const fx = grants.readFixture(ROOT);
  if (!fx) return 'fixture missing';
  const v = grants.couplingViolations(ROOT, fx);
  return v.length ? v.length + ' violations; first: ' + v.slice(0, 5).map((x) => x.kind + ' ' + x.rel).join('; ') : null;
});

leg('R4', 'mutation arm of R3: a clean-split file with an unpinned host-read list is a violation', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't401-r4-'));
  try {
    fs.mkdirSync(path.join(d, 'commands'), { recursive: true });
    fs.writeFileSync(path.join(d, 'commands', 'x.md'), '---\nname: x\ndescription: d\n# == Phase 122 ==\nallowed-tools:\n  - Bash\n---\nbody\n');
    const fx = { schema: 1, generated_from: 'test', pending_key: 'pending_tool_grants', owner_records: [], sets: {}, host: {}, pending: {} };
    const v = grants.couplingViolations(d, fx);
    return v.length ? null : 'no violation';
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

process.stdout.write('test-401-release-order: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
