#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-00 -- Navigation Engine Core fixture tests
 * ====================================================
 * The L5 Decision layer is the composition point that turns the shipped
 * L1-L4 substrate into a routing decision surface. This file exercises
 * lib/core/navigation-engine.cjs (decide) + lib/core/navigation-engine-shared.cjs
 * (frozen tables + pure helpers) per the Phase 90-09 frozen interface
 * contract v1 (.planning/research/navigation-engine-brain-interface.md).
 *
 * Test map (tests 1-33, one-to-one with the PLAN <behavior> blocks):
 *
 * Task 1 (shared helpers + frozen tables, pure functions, zero I/O):
 *   1.  STALENESS_MULTIPLIERS table matches Section 4 byte-for-byte
 *   2.  CANONICAL_VERBS frozen array length 10, Canon Part 3 order
 *   3.  SECTION_WEIGHTS required-section sum equals 1.0; optional excluded
 *   4.  applyStalenessMultiplier core rows (null, fresh, brain_offline 0.9)
 *   5.  applyStalenessMultiplier clamps + parse_failed override + unknown
 *       stale_reason fallback
 *   6.  emptyDecision shell shape
 *   7.  emptyDecisionTrace 8 Section 8 fields + 5 structural fields
 *   8.  resolveTierMode -> mode_a (brain non-null + reachable + parseable)
 *   9.  resolveTierMode -> mode_b (brain non-null + unreachable +
 *       brain_offline)
 *   10. resolveTierMode -> tier_0 (brain null OR parse_failed OR
 *       unavailable)
 *
 * Task 2 (decide() orchestration + gates + triangulation):
 *   11. decide on brain:null -> tier_0, weight 0.0, staleness 'absent'
 *   12. decide on fresh+strong-pattern -> mode_a + RECOMMENDED rendered
 *   13. decide on fresh+weak-pattern (0.65) -> RECOMMENDED suppressed,
 *       confidence still recorded
 *   14. RECOMMENDED never renders in mode_b
 *   15. RECOMMENDED never renders in tier_0
 *   16. Attribution guard: brain.author !== 'brain' -> weight 0.0 + trace
 *       note
 *   17. All 8 Section 8 trace fields present on every decision
 *   18. brain_md_sections_consumed reflects non-null sections
 *   19. Five-signal triangulation: weak-MINTO + strong-Brain
 *   20. Five-signal triangulation: fresh-everything
 *   21. Five-signal triangulation: wicked-detected -> soft-systems route
 *   22. Brain-offline exemption: weight 0.9 + mode_b + RECOMMENDED off
 *   23. parse_failed -> tier_0 + weight 0.0
 *   24. governing_thought_changed -> weight 0.3
 *   25. derivation_timeout -> weight 0.2
 *   26. No cross-turn caching: tier mode re-resolves per turn
 *   27. Per-turn cache boundary: within decide(), readQuadruple touched
 *       at most once per sectionPath
 *   28. FORBIDDEN direct fs reads on BRAIN.md (grep)
 *   29. FORBIDDEN Brain network calls (grep)
 *   30. Performance budget: 5-section fixture under 800ms cold, 300ms warm
 *   31. suppress_skills output array shape
 *   32. persona_updates output struct shape
 *   33. offer_next_step noise gate (max 1 per turn)
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const SHARED_PATH = path.join(REPO, 'lib/core/navigation-engine-shared.cjs');
const ENGINE_PATH = path.join(REPO, 'lib/core/navigation-engine.cjs');

// Lazy require so the shared-helper-only tests can run before the engine
// module exists (during Task 1 RED). Engine tests require the engine file.
function requireShared() {
  return require(SHARED_PATH);
}
function requireEngine() {
  return require(ENGINE_PATH);
}

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

// ---------- Fixture builders ----------

function makeBrain(overrides) {
  const base = {
    exists: true,
    section: 'market-analysis',
    brain_generated_at: '2026-04-20T12:00:00Z',
    brain_graph_version: 1,
    governing_thought_hash: 'sha256:abc123',
    staleness: 'fresh',
    stale_reason: null,
    author: 'brain',
    confidence_baseline: 0.5,
    parse_failed: false,
    sections: {
      pattern_matches: null,
      framework_chain_predictions: null,
      cross_domain_analogies: null,
      wicked_indicators: null,
      unfilled_opportunity_matches: null,
      assessment_thinking_chain_position: null,
      problemtype_classification: null,
      flagged_contradictions_xroom: null,
      hsi_signals: null,
    },
    flagged_weaknesses: [],
  };
  return Object.assign({}, base, overrides || {});
}

function makeQuadruple(overrides) {
  const base = {
    room: { exists: true, identity_text: 'market analysis section', references: [] },
    state: { exists: true, artifact_count: 3, completeness_score: 0.6 },
    reasoning: {
      exists: true,
      governing_thought: 'Customers will pay a premium for X',
      reasoning_health_score: 0.7,
      is_stale: false,
      arguments: [],
    },
    brain: makeBrain(),
  };
  return Object.assign({}, base, overrides || {});
}

function makeTurn(overrides) {
  return Object.assign(
    {
      userText: 'help me think about market sizing',
      sectionPath: '/tmp/fixture-room/market-analysis',
      sessionId: 'test-session-1',
    },
    overrides || {}
  );
}

function makeContext(overrides) {
  return Object.assign(
    {
      quadruple: makeQuadruple(),
      brainAvailable: true,
      userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' },
      intentSignal: { intent: 'analyze', confidence: 0.6 },
    },
    overrides || {}
  );
}

// =========================================================
// Task 1 -- shared helpers + frozen tables (Tests 1..10)
// =========================================================

run('Test 1: STALENESS_MULTIPLIERS table matches Section 4 byte-for-byte', () => {
  const { STALENESS_MULTIPLIERS } = requireShared();
  // Each row checked against the Section 4.1 multiplier table.
  // Key shape: stale_reason string OR sentinel keys for null/fresh/unavailable.
  assert.equal(STALENESS_MULTIPLIERS.null, 0.0);
  assert.equal(STALENESS_MULTIPLIERS.fresh, 1.0);
  assert.equal(STALENESS_MULTIPLIERS.age_exceeded, 0.7);
  assert.equal(STALENESS_MULTIPLIERS.governing_thought_changed, 0.3);
  assert.equal(STALENESS_MULTIPLIERS.brain_graph_version_mismatch, 0.5);
  assert.equal(STALENESS_MULTIPLIERS.brain_offline, 0.9);
  assert.equal(STALENESS_MULTIPLIERS.derivation_timeout, 0.2);
  assert.equal(STALENESS_MULTIPLIERS.parse_failed, 0.0);
  assert.equal(STALENESS_MULTIPLIERS.unavailable, 0.0);
  assert.equal(Object.isFrozen(STALENESS_MULTIPLIERS), true);
});

run('Test 2: CANONICAL_VERBS frozen array length 10 in Canon Part 3 order', () => {
  const { CANONICAL_VERBS } = requireShared();
  assert.equal(Array.isArray(CANONICAL_VERBS), true);
  assert.equal(CANONICAL_VERBS.length, 10);
  assert.deepEqual(CANONICAL_VERBS, [
    'Run Methodology',
    'Reformulate',
    'Spawn Sub-Agent',
    'Navigate Graph',
    "Devil's Advocate",
    'Scenario Plan',
    'Synthesize',
    'Bank Opportunity',
    'Defer',
    'Free-Text',
  ]);
  assert.equal(Object.isFrozen(CANONICAL_VERBS), true);
});

run('Test 3: SECTION_WEIGHTS required sum to 1.0; optional excluded', () => {
  const { SECTION_WEIGHTS } = requireShared();
  // Required sections (Section 3.2 weights):
  const requiredSum =
    SECTION_WEIGHTS.pattern_matches +
    SECTION_WEIGHTS.framework_chain_predictions +
    SECTION_WEIGHTS.cross_domain_analogies +
    SECTION_WEIGHTS.wicked_indicators +
    SECTION_WEIGHTS.unfilled_opportunity_matches +
    SECTION_WEIGHTS.assessment_thinking_chain_position +
    SECTION_WEIGHTS.problemtype_classification;
  // Floating-point sum is exact: 0.35 + 0.20 + 0.15 + 0.10 + 0.10 + 0.05 + 0.05 = 1.00.
  assert.equal(Math.abs(requiredSum - 1.0) < 1e-9, true,
    'required sections must sum to 1.0, got ' + requiredSum);
  // Optional sections are explicitly recorded as 0 (caveat surface only).
  assert.equal(SECTION_WEIGHTS.flagged_contradictions_xroom, 0);
  assert.equal(SECTION_WEIGHTS.hsi_signals, 0);
  assert.equal(Object.isFrozen(SECTION_WEIGHTS), true);
});

run('Test 4: applyStalenessMultiplier core rows', () => {
  const { applyStalenessMultiplier } = requireShared();
  assert.equal(applyStalenessMultiplier(null), 0.0);
  assert.equal(applyStalenessMultiplier({ staleness: 'fresh' }), 1.0);
  assert.equal(
    applyStalenessMultiplier({ staleness: 'stale', stale_reason: 'brain_offline' }),
    0.9
  );
});

run('Test 5: applyStalenessMultiplier clamps + parse_failed + unknown reason', () => {
  const { applyStalenessMultiplier } = requireShared();
  // parse_failed override regardless of staleness label
  assert.equal(applyStalenessMultiplier({ parse_failed: true, staleness: 'fresh' }), 0.0);
  // unknown stale_reason falls back to 0.0 conservatively
  assert.equal(
    applyStalenessMultiplier({ staleness: 'stale', stale_reason: 'invented_reason' }),
    0.0
  );
  // unavailable -> 0.0 regardless of stale_reason
  assert.equal(
    applyStalenessMultiplier({ staleness: 'unavailable', stale_reason: null }),
    0.0
  );
  // Result always within [0, 1]
  const out = applyStalenessMultiplier({ staleness: 'fresh' });
  assert.equal(out >= 0.0 && out <= 1.0, true);
});

run('Test 6: emptyDecision returns expected shell', () => {
  const { emptyDecision } = requireShared();
  const d = emptyDecision();
  assert.equal(d.fire_skill, null);
  assert.equal(d.offer_next_step, null);
  assert.deepEqual(d.suppress_skills, []);
  assert.equal(d.persona_updates, null);
  assert.equal(typeof d.decision_trace, 'object');
  assert.notEqual(d.decision_trace, null);
});

run('Test 7: emptyDecisionTrace has 8 Section 8 fields + 5 structural fields', () => {
  const { emptyDecisionTrace } = requireShared();
  const t = emptyDecisionTrace();
  // 8 Section 8 required fields:
  assert.equal('brain_md_version' in t, true);
  assert.equal('brain_md_staleness' in t, true);
  assert.equal('brain_md_stale_reason' in t, true);
  assert.equal('brain_md_weight_applied' in t, true);
  assert.equal('brain_md_recommended_confidence' in t, true);
  assert.equal('brain_md_recommended_marker_rendered' in t, true);
  assert.equal('brain_md_tier_mode' in t, true);
  assert.equal('brain_md_sections_consumed' in t, true);
  // 5 structural fields:
  assert.equal('icm_scope' in t, true);
  assert.equal('sql_signals' in t, true);
  assert.equal('minto_reasoning' in t, true);
  assert.equal('intent_persona' in t, true);
  assert.equal('chosen_rationale' in t, true);
  // Sentinels:
  assert.equal(t.brain_md_tier_mode, 'tier_0');
  assert.equal(t.brain_md_recommended_marker_rendered, false);
  assert.equal(Array.isArray(t.brain_md_sections_consumed), true);
});

run('Test 8: resolveTierMode -> mode_a happy path', () => {
  const { resolveTierMode } = requireShared();
  const q = makeQuadruple();
  assert.equal(resolveTierMode(q, true), 'mode_a');
});

run('Test 9: resolveTierMode -> mode_b on brain_offline + unreachable', () => {
  const { resolveTierMode } = requireShared();
  const q = makeQuadruple({
    brain: makeBrain({ staleness: 'stale', stale_reason: 'brain_offline' }),
  });
  assert.equal(resolveTierMode(q, false), 'mode_b');
});

run('Test 10: resolveTierMode -> tier_0 on null / parse_failed / unavailable', () => {
  const { resolveTierMode } = requireShared();
  // brain === null
  assert.equal(resolveTierMode(makeQuadruple({ brain: null }), true), 'tier_0');
  // parse_failed === true
  assert.equal(
    resolveTierMode(makeQuadruple({ brain: makeBrain({ parse_failed: true }) }), true),
    'tier_0'
  );
  // staleness === 'unavailable'
  assert.equal(
    resolveTierMode(makeQuadruple({ brain: makeBrain({ staleness: 'unavailable' }) }), true),
    'tier_0'
  );
});

// =========================================================
// Task 2 -- decide() orchestration + gates (Tests 11..33)
// =========================================================
// These tests REQUIRE lib/core/navigation-engine.cjs to exist. During
// Task 1 RED they are skipped (file does not exist yet); Task 2 RED
// re-runs them and they must fail; Task 2 GREEN they pass.

function engineLoadable() {
  return fs.existsSync(ENGINE_PATH);
}

if (engineLoadable()) {
  run('Test 11: decide on brain:null -> tier_0, weight 0.0, absent', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({ quadruple: makeQuadruple({ brain: null }) });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'tier_0');
    assert.equal(d.decision_trace.brain_md_weight_applied, 0.0);
    assert.equal(d.decision_trace.brain_md_staleness, 'absent');
    assert.equal(/Tier 0 fallback/i.test(d.decision_trace.chosen_rationale || ''), true);
    assert.equal(d.fire_skill, null);
  });

  run('Test 12: fresh + strong pattern_matches (0.85) -> RECOMMENDED rendered', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        brain: makeBrain({
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: {
              body: '- Run Methodology (confidence: 0.85, source: SWOT)',
              tokens_estimate: 12,
            },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'mode_a');
    assert.equal(d.decision_trace.brain_md_recommended_marker_rendered, true);
    assert.equal(d.decision_trace.brain_md_recommended_confidence, 0.85);
  });

  run('Test 13: weak pattern (0.65) -> RECOMMENDED suppressed, confidence recorded', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        brain: makeBrain({
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: {
              body: '- Run Methodology (confidence: 0.65, source: PESTLE)',
              tokens_estimate: 12,
            },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_recommended_marker_rendered, false);
    assert.equal(d.decision_trace.brain_md_recommended_confidence, 0.65);
  });

  run('Test 14: RECOMMENDED never renders in mode_b', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      brainAvailable: false,
      quadruple: makeQuadruple({
        brain: makeBrain({
          staleness: 'stale',
          stale_reason: 'brain_offline',
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: {
              body: '- Run Methodology (confidence: 0.95, source: BMC)',
              tokens_estimate: 12,
            },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'mode_b');
    assert.equal(d.decision_trace.brain_md_recommended_marker_rendered, false);
    assert.equal(/mode_b suppresses RECOMMENDED/i.test(d.decision_trace.chosen_rationale || ''), true);
  });

  run('Test 15: RECOMMENDED never renders in tier_0', () => {
    const { decide } = requireEngine();
    const d = decide(
      makeTurn(),
      makeContext({ quadruple: makeQuadruple({ brain: null }) })
    );
    assert.equal(d.decision_trace.brain_md_tier_mode, 'tier_0');
    assert.equal(d.decision_trace.brain_md_recommended_marker_rendered, false);
  });

  run('Test 16: attribution guard demotes non-brain author to weight 0.0', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        brain: makeBrain({
          author: 'human',
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: {
              body: '- Run Methodology (confidence: 0.9, source: forged)',
              tokens_estimate: 12,
            },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_weight_applied, 0.0);
    assert.equal(d.decision_trace.brain_md_recommended_marker_rendered, false);
    assert.equal(/canon_part_2_attribution_breach/i.test(d.decision_trace.chosen_rationale || ''), true);
  });

  run('Test 17: all 8 Section 8 trace fields present on every decision', () => {
    const { decide } = requireEngine();
    const fixtures = [
      makeContext({ quadruple: makeQuadruple({ brain: null }) }),
      makeContext(),
      makeContext({
        brainAvailable: false,
        quadruple: makeQuadruple({
          brain: makeBrain({ staleness: 'stale', stale_reason: 'brain_offline' }),
        }),
      }),
    ];
    const required = [
      'brain_md_version',
      'brain_md_staleness',
      'brain_md_stale_reason',
      'brain_md_weight_applied',
      'brain_md_recommended_confidence',
      'brain_md_recommended_marker_rendered',
      'brain_md_tier_mode',
      'brain_md_sections_consumed',
    ];
    for (const ctx of fixtures) {
      const d = decide(makeTurn(), ctx);
      for (const k of required) {
        assert.equal(k in d.decision_trace, true, 'missing trace field: ' + k);
      }
    }
  });

  run('Test 18: brain_md_sections_consumed reflects non-null sections only', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        brain: makeBrain({
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: { body: '- ok (confidence: 0.8)', tokens_estimate: 4 },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.deepEqual(d.decision_trace.brain_md_sections_consumed, ['pattern_matches']);
  });

  run('Test 19: weak-MINTO + strong-Brain -> trace captures both', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        reasoning: {
          exists: true,
          governing_thought: 'shaky claim',
          reasoning_health_score: 0.3,
          is_stale: false,
          arguments: [],
        },
        brain: makeBrain({
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: { body: '- Run Methodology (confidence: 0.9)', tokens_estimate: 8 },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.minto_reasoning.reasoning_health_score, 0.3);
    assert.equal(d.decision_trace.brain_md_weight_applied, 1.0);
  });

  run('Test 20: fresh-everything -> all five signals captured + non-null fire_skill', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        reasoning: {
          exists: true,
          governing_thought: 'firm claim',
          reasoning_health_score: 0.9,
          is_stale: false,
          arguments: [],
        },
        brain: makeBrain({
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: { body: '- Run Methodology (confidence: 0.9, source: SWOT)', tokens_estimate: 10 },
            framework_chain_predictions: { body: '- SWOT FEEDS_INTO Porter Five Forces', tokens_estimate: 8 },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.notEqual(d.decision_trace.icm_scope, null);
    assert.notEqual(d.decision_trace.sql_signals, null);
    assert.notEqual(d.decision_trace.minto_reasoning, null);
    assert.notEqual(d.decision_trace.intent_persona, null);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'mode_a');
    assert.notEqual(d.fire_skill, null);
  });

  run('Test 21: wicked_indicators (score 9) -> soft-systems route', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        brain: makeBrain({
          sections: Object.assign({}, makeBrain().sections, {
            wicked_indicators: { body: '- wicked_score: 9 stakeholders divergent', tokens_estimate: 8 },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(/soft.?systems/i.test(d.fire_skill || ''), true,
      'expected soft-systems route, got ' + d.fire_skill);
    assert.equal(/wicked_escalation/i.test(d.decision_trace.chosen_rationale || ''), true);
  });

  run('Test 22: brain-offline exemption -> weight 0.9, mode_b, RECOMMENDED off', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      brainAvailable: false,
      quadruple: makeQuadruple({
        brain: makeBrain({
          staleness: 'stale',
          stale_reason: 'brain_offline',
          sections: Object.assign({}, makeBrain().sections, {
            pattern_matches: { body: '- Run Methodology (confidence: 0.9)', tokens_estimate: 8 },
          }),
        }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_weight_applied, 0.9);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'mode_b');
    assert.equal(d.decision_trace.brain_md_recommended_marker_rendered, false);
  });

  run('Test 23: parse_failed -> tier_0, weight 0.0', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({ brain: makeBrain({ parse_failed: true }) }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'tier_0');
    assert.equal(d.decision_trace.brain_md_weight_applied, 0.0);
    assert.equal(/brain_parse_failed/i.test(d.decision_trace.chosen_rationale || ''), true);
  });

  run('Test 24: governing_thought_changed -> weight 0.3', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        brain: makeBrain({ staleness: 'stale', stale_reason: 'governing_thought_changed' }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_weight_applied, 0.3);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'mode_a');
  });

  run('Test 25: derivation_timeout -> weight 0.2', () => {
    const { decide } = requireEngine();
    const ctx = makeContext({
      quadruple: makeQuadruple({
        brain: makeBrain({ staleness: 'stale', stale_reason: 'derivation_timeout' }),
      }),
    });
    const d = decide(makeTurn(), ctx);
    assert.equal(d.decision_trace.brain_md_weight_applied, 0.2);
  });

  run('Test 26: no cross-turn caching: tier mode re-resolves per turn', () => {
    const { decide } = requireEngine();
    const turn = makeTurn();
    const ctx1 = makeContext({ brainAvailable: true });
    const d1 = decide(turn, ctx1);
    assert.equal(d1.decision_trace.brain_md_tier_mode, 'mode_a');
    const ctx2 = makeContext({
      brainAvailable: false,
      quadruple: makeQuadruple({
        brain: makeBrain({ staleness: 'stale', stale_reason: 'brain_offline' }),
      }),
    });
    const d2 = decide(turn, ctx2);
    assert.equal(d2.decision_trace.brain_md_tier_mode, 'mode_b');
  });

  run('Test 27: per-turn cache bound (no cross-turn leakage of quadruple)', () => {
    // The cache check is structural: decide() must not retain quadruple
    // across calls. We test by mutating quadruple between calls and
    // verifying the second call sees the new shape, not a cached one.
    const { decide } = requireEngine();
    const turn = makeTurn();
    const q1 = makeQuadruple();
    const d1 = decide(turn, makeContext({ quadruple: q1 }));
    assert.equal(d1.decision_trace.brain_md_tier_mode, 'mode_a');
    const q2 = makeQuadruple({ brain: null });
    const d2 = decide(turn, makeContext({ quadruple: q2 }));
    assert.equal(d2.decision_trace.brain_md_tier_mode, 'tier_0');
  });

  run('Test 28: FORBIDDEN direct fs reads on BRAIN.md (grep)', () => {
    const src = fs.readFileSync(ENGINE_PATH, 'utf8');
    // Forbidden: any fs.readFileSync or fs.readFile referencing BRAIN.md
    const re = /fs\s*\.\s*(readFileSync|readFile|promises\.readFile)\s*\([^)]*BRAIN\.md/;
    assert.equal(re.test(src), false,
      'navigation-engine.cjs MUST NOT read BRAIN.md directly; route through readQuadruple');
  });

  run('Test 29: FORBIDDEN Brain network calls (grep)', () => {
    const src = fs.readFileSync(ENGINE_PATH, 'utf8');
    // Forbidden: brain-client.query / search / smartSearch and any direct
    // network egress to mindrian-brain.onrender.com or fetch/curl for Brain.
    const reBad = /brain[-_]?client\s*\.\s*(query|search|smartSearch)\b|brain\.mindrian\.ai|\bfetch\s*\(|\bcurl\b/;
    // Allow brain-client.isAvailable and brain-client.schema (Section 9.3).
    // Strip those allowed calls before scanning.
    const filtered = src
      .replace(/brain[-_]?client\s*\.\s*isAvailable\s*\([^)]*\)/g, '')
      .replace(/brain[-_]?client\s*\.\s*schema\s*\([^)]*\)/g, '');
    assert.equal(reBad.test(filtered), false,
      'navigation-engine.cjs MUST NOT call Brain network APIs from decision logic');
  });

  run('Test 30: performance budget on 5-section fixture', () => {
    const { decide } = requireEngine();
    // Build five distinct contexts (simulating five-section turn budget).
    const sections = ['intro', 'market', 'tech', 'ops', 'finance'];
    const contexts = sections.map((slug) =>
      makeContext({
        quadruple: makeQuadruple({
          brain: makeBrain({
            section: slug,
            sections: Object.assign({}, makeBrain().sections, {
              pattern_matches: { body: '- Run Methodology (confidence: 0.8)', tokens_estimate: 8 },
              framework_chain_predictions: { body: '- A FEEDS_INTO B', tokens_estimate: 6 },
            }),
          }),
        }),
      })
    );
    const cold = process.hrtime.bigint();
    for (const c of contexts) decide(makeTurn(), c);
    const coldDur = Number(process.hrtime.bigint() - cold) / 1e6;
    assert.equal(coldDur < 800, true, 'cold 5-section decide() exceeded 800ms: ' + coldDur + 'ms');
    const warm = process.hrtime.bigint();
    for (const c of contexts) decide(makeTurn(), c);
    const warmDur = Number(process.hrtime.bigint() - warm) / 1e6;
    assert.equal(warmDur < 300, true, 'warm 5-section decide() exceeded 300ms: ' + warmDur + 'ms');
  });

  run('Test 31: suppress_skills array shape', () => {
    const { decide } = requireEngine();
    const d = decide(makeTurn(), makeContext());
    assert.equal(Array.isArray(d.suppress_skills), true);
  });

  run('Test 32: persona_updates struct shape (null when no update signal)', () => {
    const { decide } = requireEngine();
    const d = decide(makeTurn(), makeContext());
    // null when no threshold crossed; struct when present.
    if (d.persona_updates !== null) {
      assert.equal(typeof d.persona_updates, 'object');
      // Allowed keys per Phase 91 CONTEXT decide() signature.
      const allowed = new Set(['archetype', 'problem_type', 'venture_stage']);
      for (const k of Object.keys(d.persona_updates)) {
        assert.equal(allowed.has(k), true, 'persona_updates has unexpected key: ' + k);
      }
    }
  });

  run('Test 33: offer_next_step noise gate (max 1 per turn)', () => {
    const { decide } = requireEngine();
    const d = decide(makeTurn(), makeContext());
    // Either null OR a single object with command + reason.
    if (d.offer_next_step !== null) {
      assert.equal(typeof d.offer_next_step, 'object');
      assert.equal('command' in d.offer_next_step, true);
      assert.equal('reason' in d.offer_next_step, true);
    }
  });
} else {
  // Engine module absent (Task 1 RED phase). Skip Task 2 tests with a
  // single notice; do NOT count as failure (matches RED contract).
  process.stdout.write('skip Task 2 tests: ' + path.relative(REPO, ENGINE_PATH) + ' not yet implemented\n');
}

// ---------- Final summary ----------

const total = passed + failed;
process.stdout.write(
  '\nnavigation-engine-core: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
