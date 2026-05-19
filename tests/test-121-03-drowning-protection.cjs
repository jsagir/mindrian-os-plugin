#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-03 Task 4 -- drowning-protection fixture.
 *
 * D-09 declares: the command_invocation bucket is HIGH VOLUME (100% sampling
 * of /mos:* invocations). Consumers (SEED-002 ingestion + hooked-rescore-117
 * + future analyses) MUST be able to filter by event type to avoid drowning
 * the high-signal selector_pick / tension_engagement / breakthrough_dismissed
 * events. The type discriminator IS the protection -- no per-row sampling is
 * applied at write time.
 *
 * This fixture proves the type discriminator works:
 *   1. Emit 100 command_invocation events and 10 selector_pick events to a
 *      tmpdir-scoped HOME via writer.emit().
 *   2. The single events-YYYY-WNN.jsonl must contain exactly 110 lines.
 *   3. Filtering by event !== 'command_invocation' must return exactly 10
 *      lines (the high-signal events survive the filter).
 *   4. Filtering by event === 'command_invocation' must return exactly 100
 *      lines (the bucket is intact).
 *
 * Hermetic: tmpdir + HOME swap; cleanup in finally. Mirrors writer.test.cjs.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const WRITER_PATH = path.join(REPO, 'lib/core/telemetry/writer.cjs');

const origHome = process.env.HOME;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-121-03-drown-'));
process.env.HOME = tmp;

try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
const writer = require(WRITER_PATH);

const validSha = crypto.createHash('sha256').update('drown-fixture').digest('hex');

try {
  // 100 command_invocation events (the bucket).
  for (let i = 0; i < 100; i++) {
    writer.emit('command_invocation', {
      command: '/mos:scout',
      outcome: 'success',
      duration_ms: 100 + i,
      context_hash: 'a'.repeat(16),
    });
  }

  // 10 selector_pick events (high-signal stream).
  for (let i = 0; i < 10; i++) {
    writer.emit('selector_pick', {
      sub_shape: 'F.1',
      mode: 'A',
      ranker_confidence: 0.5,
      recommended_rendered: true,
      options_count: 4,
      room_slug_sha256: validSha,
      verb_chosen: 'Run Methodology',
    });
  }

  const v113 = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
  const files = fs.readdirSync(v113).filter(function (f) { return /^events-\d{4}-W\d{2}\.jsonl$/.test(f); });
  if (files.length !== 1) {
    console.error('FAIL: expected 1 events file, got ' + files.length);
    process.exit(1);
  }

  const lines = fs.readFileSync(path.join(v113, files[0]), 'utf8').trim().split('\n');
  if (lines.length !== 110) {
    console.error('FAIL: expected 110 lines, got ' + lines.length);
    process.exit(1);
  }

  const cmdInv = lines.filter(function (l) { return JSON.parse(l).event === 'command_invocation'; });
  const selPick = lines.filter(function (l) { return JSON.parse(l).event === 'selector_pick'; });

  if (cmdInv.length !== 100) {
    console.error('FAIL: expected 100 command_invocation, got ' + cmdInv.length);
    process.exit(1);
  }
  if (selPick.length !== 10) {
    console.error('FAIL: expected 10 selector_pick, got ' + selPick.length);
    process.exit(1);
  }

  // Symmetric filter: event !== 'command_invocation' returns exactly the
  // 10 high-signal rows. This is the SEED-002 consumer pattern.
  const highSignalSurvivors = lines.filter(function (l) { return JSON.parse(l).event !== 'command_invocation'; });
  if (highSignalSurvivors.length !== 10) {
    console.error('FAIL: high-signal survivors expected 10, got ' + highSignalSurvivors.length);
    process.exit(1);
  }

  console.log('PASS: drowning protection (100 cmd_inv + 10 selector_pick, filter-isolatable)');
  process.exit(0);
} catch (e) {
  console.error('FAIL: drowning-protection fixture threw: ' + (e && e.message ? e.message : e));
  process.exit(1);
} finally {
  process.env.HOME = origHome;
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}
