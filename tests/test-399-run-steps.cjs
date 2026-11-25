#!/usr/bin/env node
'use strict';
// Phase 399-06 Task 1: run-step capability snapshot (D-05). Legs R1 to R4.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'run-step-capabilities.json');
const SCRIPT = path.join(ROOT, 'scripts', 'refresh-run-step-capabilities.cjs');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8'));
const names = new Set(registry.commands.map((c) => c.command));

check('R1 schema and keys', () => {
  assert.equal(d.schema, 'mos.run-step-capabilities/1');
  assert.deepEqual(
    Object.keys(d).sort(),
    ['_note', 'commands', 'counts', 'not_in_registry', 'schema', 'snapshot_date', 'source', 'source_sha256'].sort()
  );
  assert.match(d.source_sha256, /^[0-9a-f]{64}$/);
  assert.match(d.snapshot_date, /^\d{4}-\d{2}-\d{2}$/);
});

check('R2 commands sorted, unique, registry members, counts', () => {
  const sorted = [...d.commands].sort();
  assert.deepEqual(d.commands, sorted);
  assert.equal(new Set(d.commands).size, d.commands.length);
  for (const c of d.commands) assert.ok(names.has(c), 'not in registry: ' + c);
  assert.equal(d.counts.items_with_steps, 116);
  assert.equal(d.counts.with_command, 74);
  assert.equal(d.counts.in_registry, 73);
  assert.equal(d.commands.length, 73);
  assert.deepEqual(d.not_in_registry, ['/mos:mva-option']);
});

check('R3 no long strings outside _note, no text keys', () => {
  const banned = /^(step|steps|text|prompt|rubric|description|body|content)$/i;
  (function walk(v, key) {
    if (typeof v === 'string') {
      if (key !== '_note') assert.ok(v.length <= 200, 'long string at ' + key);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        assert.ok(!banned.test(k), 'banned key ' + k);
        walk(v[k], k);
      }
    }
  })(d, '');
  assert.ok(!/\/home\//.test(JSON.stringify(d)), 'home path in file');
});

check('R4 refresh script: refuses without --source, writes names and counts only', () => {
  const noSrc = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(noSrc.status, 2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsc-'));
  const src = path.join(dir, 'inv.json');
  const out = path.join(dir, 'out.json');
  fs.writeFileSync(
    src,
    JSON.stringify({
      items: [
        { steps: ['SECRET STEP TEXT ONE'], command: { routine_id: 'mos::act' }, description: 'SECRET DESCRIPTION' },
        { steps: ['SECRET STEP TEXT TWO'], command: { routine_id: 'mos::not-a-real-command' } },
        { steps: [], command: { routine_id: 'mos::admin' } },
      ],
    })
  );
  const r = spawnSync(process.execPath, [SCRIPT, '--source', src, '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const raw = fs.readFileSync(out, 'utf8');
  assert.ok(!/SECRET/.test(raw));
  const o = JSON.parse(raw);
  assert.deepEqual(o.commands, ['/mos:act']);
  assert.deepEqual(o.not_in_registry, ['/mos:not-a-real-command']);
  assert.deepEqual(o.counts, { items_with_steps: 2, with_command: 2, in_registry: 1 });
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
