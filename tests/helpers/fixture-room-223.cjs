'use strict';
/*
 * Phase 223-01 Task 2 -- buildFixtureRoom223: the shared phase fixture Plans
 * 03/04 consume. It WRAPS buildFixtureRoom224 (Part 7 reuse -- it does NOT
 * duplicate the artifact-writing logic) and adds the 223-specific substrate:
 *   - .mindrian/jtbd-state.json  (a current JTBD entry shaped per
 *     lib/hmi/jtbd-state.cjs getCurrent's return contract)
 *   - MINTO.md  at the room root
 *   - opportunity-bank/  (an empty directory the bank rollup fills)
 *
 * Returns the base fixture's fields plus { jtbdPath, bankDir, mintoPath }.
 * opts pass-through: artifactCount forwards to the base fixture.
 *
 * DETERMINISTIC: fixed content, no randomness, no network, no LLM.
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). CJS only, zero new deps.
 */

const fs = require('node:fs');
const path = require('node:path');

const { buildFixtureRoom224 } = require('./fixture-room-224.cjs');

// A current JTBD entry shaped per jtbd-state.setCurrent's newCurrent contract
// (jtbd-state.cjs:132-138): jtbd / confidence / entered_at / evidence / expires_at.
function jtbdCurrentEntry() {
  return {
    jtbd: 'validate-idea',
    confidence: 0.72,
    entered_at: new Date('2026-07-15T00:00:00.000Z').toISOString(),
    evidence: ['fixture-seeded current JTBD for Phase 223 governed bono'],
    expires_at: null,
  };
}

const MINTO_BODY = [
  '# MINTO',
  '',
  'Governing thought: the meal-kit venture wins by removing the weekly-commitment',
  'rigidity that drives subscription churn, proven by menu personalization that cuts',
  'food waste and recipe fatigue.',
  '',
  '## Key claims',
  '',
  '- Time-pressed urban professionals want a healthy home dinner without the planning tax.',
  '- Pause-any-week flexibility is the dominant retention lever.',
  '- Corporate wellness partnerships lower acquisition cost and seed word-of-mouth.',
].join('\n');

/**
 * buildFixtureRoom223(tmpDir, opts) -> Promise<{
 *   roomDir, dbPath, relatedPair, unrelatedPair, allFiles,
 *   jtbdPath, bankDir, mintoPath
 * }>
 *
 * tmpDir: an existing writable directory (caller owns cleanup).
 * opts.artifactCount: forwarded to buildFixtureRoom224 (default 21).
 */
async function buildFixtureRoom223(tmpDir, opts) {
  const base = await buildFixtureRoom224(tmpDir, opts);
  const roomDir = base.roomDir;

  // .mindrian/jtbd-state.json (the getCurrent contract: { version, current, history }).
  const mindrianDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mindrianDir, { recursive: true });
  const jtbdPath = path.join(mindrianDir, 'jtbd-state.json');
  const current = jtbdCurrentEntry();
  const jtbdState = {
    version: 1,
    current,
    history: [{
      from: 'explore', to: current.jtbd, trigger: 'fixture_seed',
      at: current.entered_at, evidence: current.evidence,
    }],
  };
  fs.writeFileSync(jtbdPath, JSON.stringify(jtbdState, null, 2) + '\n', 'utf8');

  // MINTO.md at the room root.
  const mintoPath = path.join(roomDir, 'MINTO.md');
  fs.writeFileSync(mintoPath, MINTO_BODY + '\n', 'utf8');

  // opportunity-bank/ (empty; the bank rollup fills it).
  const bankDir = path.join(roomDir, 'opportunity-bank');
  fs.mkdirSync(bankDir, { recursive: true });

  return Object.assign({}, base, { jtbdPath, bankDir, mintoPath });
}

module.exports = { buildFixtureRoom223, jtbdCurrentEntry, MINTO_BODY };
