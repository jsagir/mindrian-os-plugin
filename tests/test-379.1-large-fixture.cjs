#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 Wave 0 (plan 01, Task 1): the large-room fixture builder proof.
 * Requirements: CPU379-08 (a fixture with more than 2,000 artifacts), decision D-379.1-02.
 *
 * Proves tests/fixtures/large-room/build-fixture.cjs:
 *   1. writes more than 2,000 markdown files under a tmp target
 *   2. writes GENERATED_DIR/engine-input-room
 *   3. the withManifest variant writes engine-input-manifest.json
 *   4. refuses a target under ~/MindrianRooms (threat T-379.1-08)
 *   5. is deterministic: a second build gives byte-identical gen-0001.md and gen-2100.md
 * Hermetic: scrubVendorKey + installNetGuard first, tmp dir removed in finally, attempts() === 0 last.
 * Plan 06 appends the release-leg assertions below the LEG_ASSERTIONS_BELOW marker.
 * No em-dashes. Hyphens only.
 */
const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const netGuard = installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const builder = require('./fixtures/large-room/build-fixture.cjs');

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

function countMd(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) n += countMd(abs);
    else if (e.isFile() && e.name.endsWith('.md')) n += 1;
  }
  return n;
}

function main() {
  console.log('test-379.1-large-fixture (CPU379-08 run-time builder)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-large-'));
  try {
    const first = builder.buildLargeRoom(path.join(tmp, 'a'), { slug: 'large-a' });
    const written = countMd(first.roomDir);
    console.log('  written markdown files: ' + written + ' (artifacts reported: ' + first.artifacts + ')');

    t('the builder wrote more than 2,000 markdown files', () => {
      assert.ok(written > 2000, 'written ' + written);
      assert.ok(first.artifacts > 2000, 'artifacts ' + first.artifacts);
      assert.equal(first.artifacts, builder.GENERATED_COUNT + 5);
    });
    t('GENERATED_DIR/engine-input-room exists under the room', () => {
      const inputDir = path.join(first.roomDir, builder.GENERATED_DIR, 'engine-input-room');
      assert.ok(fs.existsSync(inputDir), inputDir);
      assert.equal(first.generatedDir, path.join(first.roomDir, builder.GENERATED_DIR));
      assert.ok(!fs.existsSync(path.join(first.generatedDir, 'engine-input-manifest.json')), 'no manifest without the option');
    });
    t('every generated body is between 400 and 800 characters (above MIN_BODY_CHARS)', () => {
      for (const i of [1, 2, 777, 1500, 2100]) {
        const body = fs.readFileSync(path.join(first.generatedDir, 'engine-input-room', 'gen-' + String(i).padStart(4, '0') + '.md'), 'utf8');
        assert.ok(body.length >= 400 && body.length <= 800, 'gen-' + i + ' length ' + body.length);
      }
    });
    t('the withManifest variant writes engine-input-manifest.json', () => {
      const second = builder.buildLargeRoom(path.join(tmp, 'b'), { slug: 'large-b', withManifest: true });
      const manifestPath = path.join(second.generatedDir, 'engine-input-manifest.json');
      assert.ok(fs.existsSync(manifestPath), manifestPath);
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(typeof m.source, 'string');
      assert.equal(m.engine_input_room, 'engine-input-room');
      assert.equal(m.n_records, builder.GENERATED_COUNT);
      assert.deepEqual(m.records, []);
    });
    t('a target under ~/MindrianRooms is refused before any write', () => {
      const forbidden = path.join(os.homedir(), 'MindrianRooms', 'mos-379-must-refuse');
      assert.throws(() => builder.buildLargeRoom(forbidden, { slug: 'refused' }), /refusing a target under/);
      assert.ok(!fs.existsSync(forbidden), 'nothing was written under the real rooms home');
    });
    t('a second build with the same inputs is byte-identical (gen-0001.md, gen-2100.md)', () => {
      const again = builder.buildLargeRoom(path.join(tmp, 'c'), { slug: 'large-a' });
      for (const name of ['gen-0001.md', 'gen-2100.md']) {
        const x = fs.readFileSync(path.join(first.generatedDir, 'engine-input-room', name));
        const y = fs.readFileSync(path.join(again.generatedDir, 'engine-input-room', name));
        assert.ok(x.equals(y), name + ' differs between builds');
      }
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  t('no network attempt was made', () => {
    assert.equal(netGuard.attempts(), 0);
  });
  netGuard.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
  // LEG_ASSERTIONS_BELOW: Plan 06 adds the release-leg assertions (large_room_leg) here.
}

main();
