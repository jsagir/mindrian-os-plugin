#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * test-127.3-first-touch-nudge.cjs
 * --------------------------------
 * Hermetic unit test for Phase 127.3 Plan 05: the first-touch JTBD nudge
 * branch inside scripts/memory-resume-nudge.cjs::contribute().
 *
 * The branch must fire ONLY when ALL three conditions are met:
 *   (1) active room exists per the Plan 00 chokepoint,
 *   (2) <roomDir>/.mindrian/jtbd-state.json is absent,
 *   (3) <roomDir>/ROOM.md exists AND mtime is less than 7 days old.
 *
 * Test seam: CLAUDE_ACTIVE_ROOM env override (honored by
 * lib/core/resolve-active-room.cjs at lines 100-105) lets us point the
 * chokepoint at a tempdir fixture without writing a real registry. Mirrors
 * the hermetic mkdtempSync idiom used by tests/test-first-touch-drift-scanner.cjs.
 *
 * Seven assertions (matches the seven <behavior> tests in 127.3-05-PLAN.md):
 *   T1: fresh room with no jtbd-state -> fragment id 'first-touch-jtbd', priority 3
 *   T2: stale room (ROOM.md mtime > 7 days) -> first-touch silent, falls through
 *   T3: jtbd-state.json present -> first-touch silent, falls through
 *   T4: no active room (CLAUDE_ACTIVE_ROOM unset, no registry) -> first-touch silent
 *   T5: ROOM.md absent (Plan 04 retro-bootstrap never ran) -> first-touch silent
 *   T6: single nudge per session -- when first-touch fires, listInFlight branch
 *       does NOT also fire (early return on fragment hit)
 *   T7: retro-bootstrapped existing room (R-3) -- ROOM.md just stamped at retro
 *       time AND jtbd-state.json absent -> first-touch fires
 *
 * Pure CJS, node built-ins only. No emoji, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'memory-resume-nudge.cjs');

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const EIGHT_DAYS = 8 * 24 * 60 * 60 * 1000;

function makeFreshRoom(opts) {
  const o = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-127.3-05-fresh-'));
  if (o.withRoomMd !== false) {
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '# Test Room\n');
    if (o.backdate) {
      const past = new Date(Date.now() - EIGHT_DAYS);
      fs.utimesSync(path.join(dir, 'ROOM.md'), past, past);
    }
  }
  if (o.withJtbdState) {
    fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.mindrian', 'jtbd-state.json'), '{}');
  }
  return dir;
}

function freshRequire(env) {
  // Reload the module under a controlled env. require() caches by absolute
  // path; delete the cache entry so each test re-evaluates contribute() with
  // the fresh process.env state at module-eval time. (The chokepoint reads
  // process.env at call time, not at require time, so cache busting is
  // strictly belt-and-braces.)
  delete require.cache[SCRIPT];
  // Also evict the chokepoint + contributor-interface so a clean read happens.
  delete require.cache[path.join(REPO_ROOT, 'lib', 'core', 'resolve-active-room.cjs')];
  for (const k in process.env) {
    if (k === 'CLAUDE_ACTIVE_ROOM' || k === 'MINDRIAN_ROOMS_HOME') {
      delete process.env[k];
    }
  }
  for (const k in env) { process.env[k] = env[k]; }
  return require(SCRIPT);
}

function run() {
  const results = [];

  // ------------------------------------------------------------------
  // T1: fresh room with no jtbd-state -> first-touch fires, priority 3
  // ------------------------------------------------------------------
  {
    const roomDir = makeFreshRoom();
    const mod = freshRequire({ CLAUDE_ACTIVE_ROOM: roomDir });
    assert.strictEqual(typeof mod.contribute, 'function', 'contribute is exported');
    const frag = mod.contribute();
    assert.strictEqual(frag.id, 'first-touch-jtbd', 'T1: fragment id is first-touch-jtbd');
    assert.strictEqual(frag.priority, 3, 'T1: priority is 3 (above memory-resume priority 4)');
    assert.strictEqual(frag.has_payload, true, 'T1: has_payload true');
    assert.ok(/What are you trying to do here/.test(frag.full_payload),
      'T1: canonical beautiful-question body present');
    assert.ok(/\/mos:jtbd/.test(frag.full_payload),
      'T1: body references /mos:jtbd CLI verb');
    results.push('T1 pass: fresh room nudges with priority 3');
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // T2: stale room (ROOM.md mtime > 7 days) -> first-touch silent
  // ------------------------------------------------------------------
  {
    const roomDir = makeFreshRoom({ backdate: true });
    const mod = freshRequire({ CLAUDE_ACTIVE_ROOM: roomDir });
    const frag = mod.contribute();
    assert.notStrictEqual(frag.id, 'first-touch-jtbd',
      'T2: stale-room ROOM.md mtime > 7d -> no first-touch nudge');
    results.push('T2 pass: stale room (mtime > 7d) skips first-touch');
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // T3: jtbd-state.json present -> first-touch silent
  // ------------------------------------------------------------------
  {
    const roomDir = makeFreshRoom({ withJtbdState: true });
    const mod = freshRequire({ CLAUDE_ACTIVE_ROOM: roomDir });
    const frag = mod.contribute();
    assert.notStrictEqual(frag.id, 'first-touch-jtbd',
      'T3: jtbd-state.json present -> no first-touch nudge');
    results.push('T3 pass: jtbd-state.json present skips first-touch');
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // T4: no active room -> first-touch silent, no crash
  // ------------------------------------------------------------------
  {
    // Point MINDRIAN_ROOMS_HOME at an empty tempdir so registry.json is absent
    // AND leave CLAUDE_ACTIVE_ROOM unset so the chokepoint returns null.
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-127.3-05-nohome-'));
    const mod = freshRequire({ MINDRIAN_ROOMS_HOME: fakeHome });
    const frag = mod.contribute();
    assert.notStrictEqual(frag.id, 'first-touch-jtbd',
      'T4: no active room -> no first-touch nudge');
    // Must not throw -- contribute is wrapped in try/catch.
    assert.ok(frag && typeof frag === 'object', 'T4: contribute returns an object, no crash');
    results.push('T4 pass: no active room -> graceful no-op');
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // T5: ROOM.md absent -> first-touch silent (defensive degradation)
  // ------------------------------------------------------------------
  {
    const roomDir = makeFreshRoom({ withRoomMd: false });
    const mod = freshRequire({ CLAUDE_ACTIVE_ROOM: roomDir });
    const frag = mod.contribute();
    assert.notStrictEqual(frag.id, 'first-touch-jtbd',
      'T5: ROOM.md absent -> no first-touch nudge (defensive degradation)');
    results.push('T5 pass: ROOM.md absent -> graceful fall-through');
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // T6: single nudge per session -- when first-touch fires, the
  //     listInFlight cascade does NOT also fire (the early return inside
  //     the first-touch branch is the discipline).
  // ------------------------------------------------------------------
  {
    const roomDir = makeFreshRoom();
    const mod = freshRequire({ CLAUDE_ACTIVE_ROOM: roomDir });
    const frag = mod.contribute();
    // If first-touch fired, fragment id is first-touch-jtbd and the
    // listInFlight cascade was skipped (its id would have been
    // 'memory-resume'). Single-fragment discipline = id never both.
    assert.strictEqual(frag.id, 'first-touch-jtbd',
      'T6: first-touch fragment returned (not memory-resume)');
    assert.notStrictEqual(frag.id, 'memory-resume',
      'T6: memory-resume did NOT also fire (single nudge per session)');
    results.push('T6 pass: early return prevents double-fragment per session');
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // T7: retro-bootstrapped existing room (R-3 carry-forward).
  //     Simulate: room dir existed BEFORE Plan 04, but ROOM.md was
  //     just stamped by `bootstrap-missing` (mtime = now). With no
  //     jtbd-state.json, the nudge MUST fire -- this is the canonical
  //     fresh-room signal from the system's perspective.
  // ------------------------------------------------------------------
  {
    // Build a room dir that pre-existed (multiple files inside) and stamp
    // ROOM.md just now -- the retro-bootstrap signature.
    const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-127.3-05-retro-'));
    fs.writeFileSync(path.join(roomDir, 'some-existing-artifact.md'), '# old\n');
    fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Retro Bootstrap Room\n');
    // mtime = now (retro-bootstrap signature)
    const mod = freshRequire({ CLAUDE_ACTIVE_ROOM: roomDir });
    const frag = mod.contribute();
    assert.strictEqual(frag.id, 'first-touch-jtbd',
      'T7: retro-bootstrapped existing room fires first-touch nudge');
    assert.strictEqual(frag.priority, 3, 'T7: priority 3');
    results.push('T7 pass: retro-bootstrapped existing room nudges (R-3 invariant)');
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  return results;
}

try {
  const results = run();
  for (const line of results) { process.stdout.write(line + '\n'); }
  process.stdout.write('ALL 7 ASSERTIONS PASSED\n');
  process.exit(0);
} catch (err) {
  process.stderr.write('FAIL: ' + (err && err.message ? err.message : String(err)) + '\n');
  if (err && err.stack) { process.stderr.write(err.stack + '\n'); }
  process.exit(1);
}
