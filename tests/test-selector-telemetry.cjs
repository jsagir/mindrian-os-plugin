#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-03 Task 2 -- Test harness for lib/hmi/selector-telemetry.cjs.
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-03-PLAN.md
 *
 * 12 assertions per plan <behavior>:
 *   1.  api_exports               -- module exports recordPresentation, recordResponse, TELEMETRY_PATH, MAX_LINES
 *   2.  presentation_writes_jsonl -- one line written
 *   3.  record_shape_presentation -- parsed JSON has expected fields
 *   4.  record_shape_response     -- parsed JSON has expected fields
 *   5.  room_slug_sha256_format   -- exactly 16 hex chars
 *   6.  no_user_content           -- 'leak-test-room' literal does NOT appear in JSONL
 *   7.  fifo_truncation           -- write MAX_LINES + 5; final has exactly MAX_LINES
 *   8.  atomic_write              -- no .selector.jsonl.{rand} files left behind
 *   9.  graceful_failure          -- unwritable path does NOT throw
 *  10.  operator_field_passthrough -- optional operator scalar persists
 *  11.  no_brain_egress           -- source has zero fetch/https/Brain refs
 *  12.  telemetry_path_under_home -- TELEMETRY_PATH starts with HOME + /.mindrian/telemetry/
 *
 * Strategy: each test re-requires the module after setting
 * MINDRIAN_SELECTOR_TELEMETRY_PATH to a fresh tmp file, then drops the
 * require cache so the module re-reads the env var. tmp files are cleaned
 * up in the outer try/finally guarantee.
 *
 * Exit 0 on full pass, non-zero on any failure.
 */

'use strict';

(function main() {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const crypto = require('node:crypto');

  const MODULE_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'selector-telemetry.cjs');

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }

  // Each scenario uses its own tmp jsonl path so tests don't interfere.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'selector-telemetry-test-'));
  const cleanup = [tmpDir];

  function freshModule(overridePath, overrideMax) {
    const beforePath = process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH;
    const beforeMax = process.env.MINDRIAN_SELECTOR_TELEMETRY_MAX_LINES;
    process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH = overridePath;
    if (typeof overrideMax === 'number') {
      process.env.MINDRIAN_SELECTOR_TELEMETRY_MAX_LINES = String(overrideMax);
    } else {
      delete process.env.MINDRIAN_SELECTOR_TELEMETRY_MAX_LINES;
    }
    delete require.cache[MODULE_PATH];
    const mod = require(MODULE_PATH);
    return { mod: mod, restore: () => {
      if (typeof beforePath === 'undefined') delete process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH;
      else process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH = beforePath;
      if (typeof beforeMax === 'undefined') delete process.env.MINDRIAN_SELECTOR_TELEMETRY_MAX_LINES;
      else process.env.MINDRIAN_SELECTOR_TELEMETRY_MAX_LINES = beforeMax;
    }};
  }

  process.stdout.write('test-selector-telemetry.cjs (Phase 88.2-03 Task 2)\n');

  try {
    // ---- Assertion 1: api_exports ----
    {
      const tmp = path.join(tmpDir, 'a01.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        const ok = typeof mod.recordPresentation === 'function'
          && typeof mod.recordResponse === 'function'
          && typeof mod.TELEMETRY_PATH === 'string'
          && typeof mod.MAX_LINES === 'number';
        if (ok) pass('api_exports');
        else fail('api_exports', 'missing exports: ' + Object.keys(mod).join(','));
      } finally { restore(); }
    }

    // ---- Assertion 2: presentation_writes_jsonl ----
    {
      const tmp = path.join(tmpDir, 'a02.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        mod.recordPresentation('/tmp/room-a02', {
          sub_shape: 'F.1', mode: 'A', options_count: 6, recommended_present: true
        });
        if (!fs.existsSync(tmp)) {
          fail('presentation_writes_jsonl', 'file not created');
        } else {
          const lines = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean);
          if (lines.length === 1) pass('presentation_writes_jsonl');
          else fail('presentation_writes_jsonl', 'expected 1 line, got ' + lines.length);
        }
      } finally { restore(); }
    }

    // ---- Assertion 3: record_shape_presentation ----
    {
      const tmp = path.join(tmpDir, 'a03.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        mod.recordPresentation('/tmp/some-room', {
          sub_shape: 'F.1', mode: 'A', options_count: 6, recommended_present: true
        });
        const line = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean)[0];
        const obj = JSON.parse(line);
        const ok = typeof obj.ts === 'string'
          && obj.event === 'presentation'
          && typeof obj.room_slug_sha256 === 'string'
          && obj.sub_shape === 'F.1'
          && obj.mode === 'A'
          && obj.options_count === 6
          && obj.recommended_present === true;
        if (ok) pass('record_shape_presentation');
        else fail('record_shape_presentation', 'unexpected shape: ' + line);
      } finally { restore(); }
    }

    // ---- Assertion 4: record_shape_response ----
    {
      const tmp = path.join(tmpDir, 'a04.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        mod.recordResponse('/tmp/some-room', {
          sub_shape: 'F.1', mode: 'A', response_index: 0,
          response_was_free_text: false, latency_ms: 42,
        });
        const line = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean)[0];
        const obj = JSON.parse(line);
        const ok = typeof obj.ts === 'string'
          && obj.event === 'response'
          && typeof obj.room_slug_sha256 === 'string'
          && obj.sub_shape === 'F.1'
          && obj.mode === 'A'
          && obj.response_index === 0
          && obj.response_was_free_text === false
          && obj.latency_ms === 42;
        if (ok) pass('record_shape_response');
        else fail('record_shape_response', 'unexpected shape: ' + line);
      } finally { restore(); }
    }

    // ---- Assertion 5: room_slug_sha256_format ----
    {
      const tmp = path.join(tmpDir, 'a05.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        const roomDir = '/tmp/specific-room-name';
        mod.recordPresentation(roomDir, { sub_shape: 'F.1', mode: 'B', options_count: 3, recommended_present: false });
        const line = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean)[0];
        const obj = JSON.parse(line);
        const expected = crypto.createHash('sha256').update('specific-room-name').digest('hex').slice(0, 16);
        if (obj.room_slug_sha256 === expected && /^[0-9a-f]{16}$/.test(obj.room_slug_sha256)) {
          pass('room_slug_sha256_format');
        } else {
          fail('room_slug_sha256_format', 'got ' + obj.room_slug_sha256 + ' expected ' + expected);
        }
      } finally { restore(); }
    }

    // ---- Assertion 6: no_user_content ----
    {
      const tmp = path.join(tmpDir, 'a06.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        const leakRoom = '/tmp/parent/leak-test-room';
        mod.recordPresentation(leakRoom, {
          sub_shape: 'F.5', mode: 'A', options_count: 5, recommended_present: true
        });
        const raw = fs.readFileSync(tmp, 'utf8');
        if (raw.indexOf('leak-test-room') !== -1) {
          fail('no_user_content', 'literal room slug leaked into JSONL');
        } else if (raw.indexOf('/tmp/parent') !== -1) {
          fail('no_user_content', 'parent path leaked into JSONL');
        } else {
          pass('no_user_content');
        }
      } finally { restore(); }
    }

    // ---- Assertion 7: fifo_truncation ----
    // We use a TINY MAX_LINES surrogate (50) so the test stays fast. The
    // FIFO logic is bound-agnostic; verifying it at 50 lines is identical
    // to verifying at 10000 (same code path, just less I/O). Production
    // bound stays at 10000 -- this override is only honored when the env
    // var is set (which only the test harness sets).
    {
      const tmp = path.join(tmpDir, 'a07.jsonl');
      const TEST_BOUND = 50;
      const { mod, restore } = freshModule(tmp, TEST_BOUND);
      try {
        if (mod.MAX_LINES !== TEST_BOUND) {
          fail('fifo_truncation', 'env override did not apply: MAX_LINES=' + mod.MAX_LINES);
        } else {
          const target = mod.MAX_LINES + 5;
          for (let i = 0; i < target; i++) {
            mod.recordPresentation('/tmp/r', {
              sub_shape: 'F.1', mode: 'B', options_count: 3, recommended_present: false
            });
          }
          const lines = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean);
          if (lines.length === mod.MAX_LINES) pass('fifo_truncation');
          else fail('fifo_truncation', 'expected ' + mod.MAX_LINES + ', got ' + lines.length);
        }
      } finally { restore(); }
    }

    // ---- Assertion 8: atomic_write ----
    {
      const tmp = path.join(tmpDir, 'a08.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        for (let i = 0; i < 3; i++) {
          mod.recordPresentation('/tmp/r', {
            sub_shape: 'F.2', mode: 'A', options_count: 4, recommended_present: true
          });
        }
        const dir = path.dirname(tmp);
        const leftovers = fs.readdirSync(dir).filter(f => f.startsWith('.selector.jsonl.'));
        if (leftovers.length === 0) pass('atomic_write');
        else fail('atomic_write', 'leftover tmp files: ' + leftovers.join(','));
      } finally { restore(); }
    }

    // ---- Assertion 9: graceful_failure ----
    {
      // Point telemetry at an unwritable location. We create a regular
      // FILE at the expected parent directory location, so mkdirSync with
      // recursive:true will fail with ENOTDIR (or EEXIST) when it tries to
      // create a directory at that path. Failure surfaces synchronously
      // and the module's outer try/catch must swallow it without throwing.
      const blocker = path.join(tmpDir, 'a09-blocker');
      fs.writeFileSync(blocker, 'this is a regular file, not a directory');
      const unwritable = path.join(blocker, 'selector.jsonl'); // parent is a file
      const { mod, restore } = freshModule(unwritable);
      try {
        let threw = false;
        try {
          mod.recordPresentation('/tmp/r', {
            sub_shape: 'F.1', mode: 'B', options_count: 3, recommended_present: false
          });
          mod.recordResponse('/tmp/r', {
            sub_shape: 'F.1', mode: 'B', response_index: 0,
            response_was_free_text: true, latency_ms: 10,
          });
        } catch (_e) {
          threw = true;
        }
        if (threw) fail('graceful_failure', 'recordPresentation/Response threw on unwritable path');
        else pass('graceful_failure');
      } finally { restore(); }
    }

    // ---- Assertion 10: operator_field_passthrough ----
    {
      const tmp = path.join(tmpDir, 'a10.jsonl');
      const { mod, restore } = freshModule(tmp);
      try {
        mod.recordPresentation('/tmp/r', {
          sub_shape: 'F.4', mode: 'A', options_count: 5, recommended_present: false,
          operator: 'DECISION_GATE',
        });
        const line = fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean)[0];
        const obj = JSON.parse(line);
        if (obj.operator === 'DECISION_GATE') pass('operator_field_passthrough');
        else fail('operator_field_passthrough', 'operator field = ' + JSON.stringify(obj.operator));
      } finally { restore(); }
    }

    // ---- Assertion 11: no_brain_egress ----
    {
      const src = fs.readFileSync(MODULE_PATH, 'utf8');
      // Strip block comments + line comments so docstring mentions of
      // "Brain" or "https" in prose don't cause a false positive. We're
      // checking that the *executable* code has zero network surface.
      let code = src;
      // Remove /* ... */ blocks (non-greedy).
      code = code.replace(/\/\*[\s\S]*?\*\//g, '');
      // Remove // line comments.
      code = code.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const forbidden = [
        /fetch\s*\(/,
        /\bhttps:\/\//,
        /\bhttp:\/\//,
        /brain[-_]client/i,
        /brain\.mindrian\.ai/i,
        /\baxios\b/,
        /require\(\s*['"]request['"]\s*\)/,
      ];
      let bad = null;
      for (const re of forbidden) {
        if (re.test(code)) { bad = re.toString(); break; }
      }
      if (bad) fail('no_brain_egress', 'pattern matched in executable code: ' + bad);
      else pass('no_brain_egress');
    }

    // ---- Assertion 12: telemetry_path_under_home ----
    {
      // Restore a default-path module load (no env override) and check
      // that TELEMETRY_PATH is rooted at $HOME/.mindrian/telemetry/.
      const before = process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH;
      delete process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH;
      delete require.cache[MODULE_PATH];
      const mod = require(MODULE_PATH);
      try {
        const expectedPrefix = path.join(os.homedir(), '.mindrian', 'telemetry') + path.sep;
        if (mod.TELEMETRY_PATH.startsWith(expectedPrefix)
            && mod.TELEMETRY_PATH.endsWith('selector.jsonl')) {
          pass('telemetry_path_under_home');
        } else {
          fail('telemetry_path_under_home', 'got ' + mod.TELEMETRY_PATH);
        }
      } finally {
        if (typeof before !== 'undefined') process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH = before;
        delete require.cache[MODULE_PATH];
      }
    }

  } finally {
    // Clean up tmp tree.
    try {
      for (const dir of cleanup) {
        if (fs.existsSync(dir)) {
          // rm -rf
          const walk = (p) => {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
              for (const child of fs.readdirSync(p)) walk(path.join(p, child));
              fs.rmdirSync(p);
            } else {
              fs.unlinkSync(p);
            }
          };
          walk(dir);
        }
      }
    } catch (_e) { /* best-effort */ }
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\nTelemetry OK 12/12\n');
  process.exit(0);
})();
