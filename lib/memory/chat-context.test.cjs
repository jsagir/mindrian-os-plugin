#!/usr/bin/env node
'use strict';

/**
 * chat-context.test.cjs -- Phase 87-09 context-injection fence.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Proves:
 *   - classifyIntent covers all 5 buckets: contradicts, converges,
 *     stakeholders, gaps, briefing, plus the default-fallback path
 *   - buildContext returns a numeric tokenEstimate on EVERY code path
 *   - Every pattern stays under the 5K token budget on the cascade-e2e
 *     seed-room fixture
 *   - Pattern 3 (stakeholders) gracefully early-returns when the
 *     stakeholders table is empty -- it does NOT fabricate attribution
 *     (R6 / Phase 84-05 Pattern 3 contract)
 *
 * Exit codes:
 *   0  -> PASS
 *   1  -> FAIL (budget blown, or early-return missing, or class drift)
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildContext, classifyIntent } = require('../core/chat-context-builder.cjs');
const { runCascade } = require('../core/intelligence-cascade.cjs');

const FIXTURE = path.resolve(__dirname, '../../test/fixtures/cascade-e2e/seed-room');
const MAX_TOKENS = 5000;

async function run() {
  /* Intent classification: all 5 named buckets + default fallback. */
  assert.strictEqual(classifyIntent('what contradicts x?'), 'contradicts');
  assert.strictEqual(classifyIntent('what is converging?'), 'converges');
  assert.strictEqual(classifyIntent('who said what?'), 'stakeholders');
  assert.strictEqual(classifyIntent('what gaps to fill?'), 'gaps');
  assert.strictEqual(classifyIntent('briefing please'), 'briefing');
  assert.strictEqual(classifyIntent('random unrelated text'), 'briefing');

  /* Seed a hermetic room under /rooms/ so intelligence-cascade's
   * isRoomFile() guard passes, then run the cascade against the three
   * seeded artifacts so room.db + schema exist. */
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'chatctx-'));
  const roomsDir = path.join(tmpParent, 'rooms');
  const roomDir = path.join(roomsDir, 'fixture');
  fs.mkdirSync(roomsDir, { recursive: true });

  try {
    fs.cpSync(FIXTURE, roomDir, { recursive: true });
    await runCascade(roomDir, {
      trigger: 'test',
      filePath: path.join(roomDir, 'problem-definition', 'jtbd-underservice.md'),
      section: 'problem-definition',
    });

    /* Pattern 1: contradicts */
    const c1 = await buildContext(roomDir, 'what contradicts market-analysis?');
    assert.strictEqual(c1.intent, 'contradicts');
    assert.strictEqual(c1.earlyReturn, false);
    assert.ok(typeof c1.tokenEstimate === 'number', 'tokenEstimate must be a number');
    assert.ok(c1.tokenEstimate < MAX_TOKENS,
      'contradicts tokenEstimate must be <' + MAX_TOKENS + ' (got ' + c1.tokenEstimate + ')');

    /* Pattern 2: converges */
    const c2 = await buildContext(roomDir, 'what patterns are converging across sections?');
    assert.strictEqual(c2.intent, 'converges');
    assert.strictEqual(c2.earlyReturn, false);
    assert.ok(typeof c2.tokenEstimate === 'number', 'tokenEstimate must be a number');
    assert.ok(c2.tokenEstimate < MAX_TOKENS,
      'converges tokenEstimate must be <' + MAX_TOKENS + ' (got ' + c2.tokenEstimate + ')');

    /* Pattern 3: stakeholders -- empty table, earlyReturn=true must be asserted */
    const c3 = await buildContext(roomDir, 'who said what?');
    assert.strictEqual(c3.intent, 'stakeholders');
    assert.strictEqual(c3.earlyReturn, true,
      'empty stakeholders table must trigger earlyReturn=true (no fabrication)');
    assert.ok(/stakeholder/i.test(c3.userPrompt),
      'early-return message must mention stakeholders');
    assert.ok(typeof c3.tokenEstimate === 'number',
      'tokenEstimate must be present even on earlyReturn');
    assert.ok(c3.tokenEstimate < MAX_TOKENS,
      'stakeholders tokenEstimate must be <' + MAX_TOKENS + ' (got ' + c3.tokenEstimate + ')');

    /* Pattern 4: gaps */
    const c4 = await buildContext(roomDir, 'what gaps should I fill?');
    assert.strictEqual(c4.intent, 'gaps');
    assert.strictEqual(c4.earlyReturn, false);
    assert.ok(typeof c4.tokenEstimate === 'number', 'tokenEstimate must be a number');
    assert.ok(c4.tokenEstimate < MAX_TOKENS,
      'gaps tokenEstimate must be <' + MAX_TOKENS + ' (got ' + c4.tokenEstimate + ')');

    /* Pattern 5: briefing */
    const c5 = await buildContext(roomDir, 'give me an intelligence briefing');
    assert.strictEqual(c5.intent, 'briefing');
    assert.strictEqual(c5.earlyReturn, false);
    assert.ok(typeof c5.tokenEstimate === 'number', 'tokenEstimate must be a number');
    assert.ok(c5.tokenEstimate < MAX_TOKENS,
      'briefing tokenEstimate must be <' + MAX_TOKENS + ' (got ' + c5.tokenEstimate + ')');

    /* Default-fallback path: unclassified input routes to briefing */
    const c6 = await buildContext(roomDir, 'random unrelated question');
    assert.strictEqual(c6.intent, 'briefing', 'default fallback must be briefing');
    assert.ok(c6.tokenEstimate < MAX_TOKENS,
      'fallback tokenEstimate must be <' + MAX_TOKENS + ' (got ' + c6.tokenEstimate + ')');

    process.stdout.write(
      'chat-context: all 5 intent patterns tested, all token budgets <' + MAX_TOKENS +
      ' (contradicts=' + c1.tokenEstimate +
      ' converges=' + c2.tokenEstimate +
      ' stakeholders=' + c3.tokenEstimate + '[earlyReturn]' +
      ' gaps=' + c4.tokenEstimate +
      ' briefing=' + c5.tokenEstimate +
      ' fallback=' + c6.tokenEstimate + ')\n'
    );
    process.exit(0);
  } catch (e) {
    process.stderr.write((e && e.stack) ? e.stack + '\n' : String(e) + '\n');
    process.exit(1);
  } finally {
    try { fs.rmSync(tmpParent, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}

run();
