#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-05 Task 3 -- Test harness for Mode A/B/Tier 0 graceful degradation
 * across F.6, G, H + the selector dispatcher.
 *
 * Implementing plan: .planning/phases/101-selector-library-jtbd-aware/101-05-PLAN.md
 *
 * 7 assertions per plan:
 *   1. mode_b_no_recommend       -- F.6 with tier:1 + recommendedVerb -> zero ▶ markers
 *   2. zone1_prefix              -- F.6 with tier:1 -> Zone 1 contains "Brain unreachable; ..."
 *   3. mode_a_recommend_preserved -- F.6 with tier:2 + recommendedVerb -> exactly 1 ▶ on Run Methodology
 *   4. mode_a_no_prefix          -- F.6 with tier:2 -> Zone 1 has NO Brain-unreachable prefix
 *   5. g_mode_b                  -- Shape G with tier:1 -> Zone 4 footer has zero ▶ markers
 *   6. h_mode_b                  -- Shape H with tier:1 -> Zone 4 footer has zero ▶ markers
 *   7. tier_0_refuse             -- dispatcher with tier:0 -> { shape: 'error', rendered: { error: 'tier-0-refused' } }
 *
 * Exit 0 on full pass.
 */

'use strict';

(function main() {
  const fs = require('node:fs');
  const path = require('node:path');

  const ROOT = path.resolve(__dirname, '..');
  const DISPATCHER_PATH = path.join(ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs');
  const JTBD_STATE_PATH = path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs');

  const dispatcher = require(DISPATCHER_PATH);
  const jtbdState = require(JTBD_STATE_PATH);

  const failures = [];
  function pass(name) { process.stdout.write('  ok  ' + name + '\n'); }
  function fail(name, msg) {
    failures.push(name + ': ' + msg);
    process.stdout.write('  FAIL ' + name + ': ' + msg + '\n');
  }

  // Build a temp room with a known JTBD set (find-bottleneck) so the F-shape
  // dispatch lands on F.6 with a non-degenerate verb set.
  function makeRoomWithJtbd(jtbdId) {
    const tmp = fs.mkdtempSync('/tmp/test-101-05-');
    fs.writeFileSync(path.join(tmp, '.room-root'), '');
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    jtbdState.setCurrent(tmp, {
      jtbd: jtbdId,
      confidence: 0.8,
      evidence: ['test-101-05-fixture'],
      trigger: 'manual',
      manual: true,
    });
    return tmp;
  }

  function rmRoom(tmp) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }

  /**
   * Collect every string that appears in a rendered structure (zones.* + any
   * verb-bearing fields), so we can scan for the ▶ marker. We intentionally
   * exclude `contract` numeric/scalar fields to avoid false positives if a
   * future schema embeds the glyph as an enum string.
   */
  function gatherText(rendered) {
    if (!rendered || typeof rendered !== 'object') return '';
    const parts = [];
    if (rendered.zones && typeof rendered.zones === 'object') {
      for (const k of Object.keys(rendered.zones)) {
        const v = rendered.zones[k];
        if (typeof v === 'string') parts.push(v);
      }
    }
    return parts.join('\n');
  }

  process.stdout.write('test-shape-f6-mode-b.cjs (Phase 101-05 Task 3)\n');

  // ---- Assertion 1: mode_b_no_recommend ----
  // F.6 with tier:1 + recommendedVerb -> zero ▶ markers in rendered output.
  {
    const tmp = makeRoomWithJtbd('find-bottleneck');
    try {
      const r = dispatcher.pickShape({
        requestedShape: 'F',
        roomDir: tmp,
        tier: 1,
        payload: { recommendedVerb: 'Run Methodology' },
      });
      const txt = JSON.stringify(r);
      if (r.shape !== 'F.6') {
        fail('mode_b_no_recommend', 'expected shape F.6, got ' + r.shape);
      } else if (txt.indexOf('▶') !== -1) {
        fail('mode_b_no_recommend', 'Mode B leaked ▶: ' + txt.slice(0, 200));
      } else {
        pass('mode_b_no_recommend');
      }
    } finally {
      rmRoom(tmp);
    }
  }

  // ---- Assertion 2: zone1_prefix ----
  // F.6 with tier:1 -> Zone 1 contains the Brain-unreachable prefix.
  {
    const tmp = makeRoomWithJtbd('find-bottleneck');
    try {
      const r = dispatcher.pickShape({
        requestedShape: 'F',
        roomDir: tmp,
        tier: 1,
        payload: { recommendedVerb: null },
      });
      const header = (r && r.rendered && r.rendered.zones && r.rendered.zones.header) || '';
      if (header.indexOf('Brain unreachable; running on local graph only.') === -1) {
        fail('zone1_prefix', 'header missing prefix: ' + JSON.stringify(header));
      } else {
        pass('zone1_prefix');
      }
    } finally {
      rmRoom(tmp);
    }
  }

  // ---- Assertion 3: mode_a_recommend_preserved ----
  // F.6 with tier:2 + recommendedVerb -> exactly 1 ▶ marker on Run Methodology.
  {
    const tmp = makeRoomWithJtbd('find-bottleneck');
    try {
      const r = dispatcher.pickShape({
        requestedShape: 'F',
        roomDir: tmp,
        tier: 2,
        payload: { recommendedVerb: 'Run Methodology' },
      });
      const text = gatherText(r.rendered);
      const matches = text.match(/▶/g) || [];
      const lines = text.split('\n');
      const recLine = lines.find(l => l.indexOf('Run Methodology') !== -1);
      if (r.shape !== 'F.6') {
        fail('mode_a_recommend_preserved', 'expected shape F.6, got ' + r.shape);
      } else if (matches.length !== 1) {
        fail('mode_a_recommend_preserved', 'expected exactly 1 ▶, got ' + matches.length);
      } else if (!recLine || recLine.indexOf('▶') === -1) {
        fail('mode_a_recommend_preserved', '▶ not on Run Methodology line: ' + JSON.stringify(recLine));
      } else {
        pass('mode_a_recommend_preserved');
      }
    } finally {
      rmRoom(tmp);
    }
  }

  // ---- Assertion 4: mode_a_no_prefix ----
  // F.6 with tier:2 -> Zone 1 has NO Brain-unreachable prefix.
  {
    const tmp = makeRoomWithJtbd('find-bottleneck');
    try {
      const r = dispatcher.pickShape({
        requestedShape: 'F',
        roomDir: tmp,
        tier: 2,
        payload: { recommendedVerb: null },
      });
      const header = (r && r.rendered && r.rendered.zones && r.rendered.zones.header) || '';
      if (header.indexOf('Brain unreachable') !== -1) {
        fail('mode_a_no_prefix', 'Mode A header carries Brain-unreachable prefix: ' + JSON.stringify(header));
      } else {
        pass('mode_a_no_prefix');
      }
    } finally {
      rmRoom(tmp);
    }
  }

  // ---- Assertion 5: g_mode_b ----
  // Shape G with tier:1 -> Zone 4 footer has zero ▶ markers (all verbs use ▷).
  {
    const r = dispatcher.pickShape({
      requestedShape: 'G',
      tier: 1,
      payload: {
        options: ['Sprites wrapper', 'Native CLI', 'Hosted SaaS'],
        criteria: ['Cost', 'Speed', 'Risk', 'Coverage'],
        cells: {
          'Sprites wrapper': { Cost: 'High', Speed: 'Low', Risk: 'Med', Coverage: 'Wide' },
          'Native CLI': { Cost: 'Low', Speed: 'High', Risk: 'High', Coverage: 'Narrow' },
          'Hosted SaaS': { Cost: 'Med', Speed: 'Med', Risk: 'Med', Coverage: 'Wide' },
        },
      },
    });
    const footer = (r && r.rendered && r.rendered.zones && r.rendered.zones.footer) || '';
    if (r.shape !== 'G') {
      fail('g_mode_b', 'expected shape G, got ' + r.shape);
    } else if (footer.indexOf('▶') !== -1) {
      fail('g_mode_b', 'G Mode B footer leaked ▶: ' + footer);
    } else if (footer.indexOf('▷') === -1) {
      fail('g_mode_b', 'G footer missing ▷: ' + footer);
    } else {
      pass('g_mode_b');
    }
  }

  // ---- Assertion 6: h_mode_b ----
  // Shape H with tier:1 -> Zone 4 footer has zero ▶ markers.
  {
    const r = dispatcher.pickShape({
      requestedShape: 'H',
      tier: 1,
      payload: {
        start: '2026-05-01',
        end: '2026-07-30',
        milestones: [
          { at: '2026-05-15', label: '95.1' },
          { at: '2026-06-15', label: '100' },
          { at: '2026-07-15', label: '104' },
        ],
        title: 'Test timeline',
      },
    });
    const footer = (r && r.rendered && r.rendered.zones && r.rendered.zones.footer) || '';
    if (r.shape !== 'H') {
      fail('h_mode_b', 'expected shape H, got ' + r.shape);
    } else if (footer.indexOf('▶') !== -1) {
      fail('h_mode_b', 'H Mode B footer leaked ▶: ' + footer);
    } else if (footer.indexOf('▷') === -1) {
      fail('h_mode_b', 'H footer missing ▷: ' + footer);
    } else {
      pass('h_mode_b');
    }
  }

  // ---- Assertion 7: tier_0_refuse ----
  // dispatcher with tier:0 -> { shape: 'error', rendered: { error: 'tier-0-refused' } }.
  {
    const tmp = makeRoomWithJtbd('find-bottleneck');
    try {
      const r = dispatcher.pickShape({
        requestedShape: 'F',
        roomDir: tmp,
        tier: 0,
        payload: { recommendedVerb: 'Run Methodology' },
      });
      if (r.shape !== 'error') {
        fail('tier_0_refuse', 'expected shape error, got ' + r.shape);
      } else if (!r.rendered || r.rendered.error !== 'tier-0-refused') {
        fail('tier_0_refuse', 'expected error tier-0-refused, got ' + JSON.stringify(r.rendered));
      } else {
        pass('tier_0_refuse');
      }
    } finally {
      rmRoom(tmp);
    }
  }

  // ---- Summary ----
  if (failures.length > 0) {
    process.stdout.write('\n' + failures.length + ' failure(s):\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('\n7/7 assertions passed.\n');
  process.exit(0);
})();
