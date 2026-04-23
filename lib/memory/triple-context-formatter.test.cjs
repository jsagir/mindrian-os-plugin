#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-07 Task 1 -- triple-context-formatter tests
 * =====================================================
 * Pure unit tests for the TRIPLE_CONTEXT formatter.
 *
 * Test map (12 cases, aligned with PLAN <behavior>):
 *
 *   Test 1:  3-section input, all healthy -> formatter emits one block per
 *            section with Identity, References, State, Reasoning, Decision
 *            log lines.
 *   Test 2:  Section with empty decision_log -> "Decision log:" header
 *            omitted (don't show empty list).
 *   Test 3:  Section with 21 decision_log entries -> render only the latest
 *            3, footer "[+18 older]".
 *   Test 4:  Section with null governing_thought -> Reasoning line reads
 *            `governing thought: (not yet generated)`.
 *   Test 5:  References rendering: 5 items -> 5 wikilinks space-separated;
 *            > 5 -> first 5 then `[+N more]`.
 *   Test 6:  Budget cap (weakest-first): 30 sections @ 1k tokens -> truncate
 *            at MAX_BUDGET_TOKENS; append "N strongest sections elided"
 *            footer. Sort ascending by reasoning_health_score.
 *   Test 6b: reasoning_health_score === null is sorted FIRST (treated as
 *            weakest / highest-priority-to-surface). A section with null
 *            score appears BEFORE a section with score=0.1.
 *   Test 7:  Token estimation uses Math.ceil((body || '').length / 4)
 *            consistently; total emitted length / 4 <= MAX_BUDGET_TOKENS.
 *   Test 8:  Stale sections: is_stale:true -> annotate in the State line
 *            `MINTO health (warn) (stale: <stale_reason>)`.
 *   Test 9:  pending-tier1-regen.json with 4 sections -> footer includes
 *            that count and the /mos:reason hint.
 *   Test 10: Zero sections -> formatter returns empty string (no block
 *            emitted; session-start falls through to existing behavior).
 *   Test 11: SESSION_START_BUDGET_TOKENS env override: env=3000 -> cap=3000;
 *            env="abc" -> default; env unset -> default.
 *   Test 12: Baseline measurement recorded in SUMMARY.md. Automated check:
 *            grep -c "baseline.*tokens\|measured.*session-start" SUMMARY >=1.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 * Pure unit tests. Zero fs mutation. No child processes.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const FORMATTER_PATH = path.join(REPO, 'lib/memory/triple-context-formatter.cjs');

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function healthySection(overrides) {
  const o = overrides || {};
  return {
    room: {
      exists: true,
      identity_text: o.identity_text || 'Bottom-up TAM analysis for the enterprise SaaS wedge',
      references: o.references || [
        { target: 'financial-model/tam-bottom-up', type: 'artifact', label: 'financial-model/tam-bottom-up' },
        { target: 'competitive-analysis/first-mover', type: 'artifact', label: 'competitive-analysis/first-mover' }
      ],
      last_updated_at: o.last_updated_at || '2026-04-18T00:00:00Z',
    },
    state: {
      exists: true,
      artifact_count: o.artifact_count !== undefined ? o.artifact_count : 7,
      gap_status: o.gap_status || 'active',
      completeness_score: o.completeness_score !== undefined ? o.completeness_score : 0.85,
      minto_health: '--',
      last_activity_at: o.last_activity_at || '2026-04-18T00:00:00Z',
    },
    reasoning: {
      exists: true,
      governing_thought: o.governing_thought !== undefined
        ? o.governing_thought
        : 'TAM of $12B is bottom-up defensible',
      arguments_count: o.arguments_count !== undefined ? o.arguments_count : 3,
      evidence_density: o.evidence_density !== undefined ? o.evidence_density : 0.9,
      mece_status: o.mece_status || 'pass',
      reasoning_health_score: o.reasoning_health_score !== undefined ? o.reasoning_health_score : 0.8,
      flagged_weaknesses: o.flagged_weaknesses || [],
      decision_log: o.decision_log || [],
      last_generated_at: o.last_generated_at || '2026-04-18T00:00:00Z',
      last_artifact_write_seen_at: o.last_artifact_write_seen_at || '2026-04-18T00:00:00Z',
      is_stale: o.is_stale !== undefined ? o.is_stale : false,
      stale_reason: o.stale_reason !== undefined ? o.stale_reason : null,
    },
  };
}

function mkDecision(i) {
  return {
    session_id: 'sess-' + String(i),
    timestamp: '2026-04-' + String((i % 28) + 1).padStart(2, '0') + 'T12:00:00Z',
    action: 'flag_tam_staleness',
    user_response: i % 2 === 0 ? 'approve' : 'defer',
    reason: 'reason ' + String(i),
    outcome: 'outcome ' + String(i),
  };
}

// ---------------------------------------------------------------------------
// Test 1: 3-section healthy input -> block has all lines per section
// ---------------------------------------------------------------------------
test('Test 1: 3-section input emits one block per section with required lines', () => {
  const fmt = require(FORMATTER_PATH);
  const sections = {
    'market-analysis': healthySection({
      identity_text: 'bottom-up TAM analysis for enterprise SaaS wedge',
      governing_thought: 'TAM of $12B is bottom-up defensible',
    }),
    'problem-definition': healthySection({
      identity_text: 'Mid-market IT buyers face integration fatigue',
      governing_thought: 'IT integration is the wedge',
    }),
    'solution-design': healthySection({
      identity_text: 'API-first middleware layer',
      governing_thought: 'API middleware unblocks integration',
    }),
  };
  const out = fmt.formatTripleContext({ sections });
  assert.ok(out.length > 0, 'output non-empty');
  assert.ok(out.indexOf('## ACTIVE ROOM MEMORY') !== -1, 'header present');
  assert.ok(out.indexOf('### market-analysis/') !== -1, 'market-analysis section header');
  assert.ok(out.indexOf('### problem-definition/') !== -1, 'problem-definition section header');
  assert.ok(out.indexOf('### solution-design/') !== -1, 'solution-design section header');
  // Each section has Identity / References / State / Reasoning lines
  assert.ok(out.indexOf('Identity:') !== -1, 'Identity line');
  assert.ok(out.indexOf('References:') !== -1, 'References line');
  assert.ok(out.indexOf('State:') !== -1, 'State line');
  assert.ok(out.indexOf('Reasoning:') !== -1, 'Reasoning line');
});

// ---------------------------------------------------------------------------
// Test 2: Empty decision_log -> "Decision log:" header omitted
// ---------------------------------------------------------------------------
test('Test 2: empty decision_log -> "Decision log:" header omitted', () => {
  const fmt = require(FORMATTER_PATH);
  const sections = {
    'market-analysis': healthySection({ decision_log: [] }),
  };
  const out = fmt.formatTripleContext({ sections });
  assert.ok(out.indexOf('Decision log:') === -1,
    'Decision log header must NOT appear when empty');
});

// ---------------------------------------------------------------------------
// Test 3: 21 entries -> render only latest 3 with "[+18 older]" footer
// ---------------------------------------------------------------------------
test('Test 3: 21 decision_log entries -> render only latest 3 with +18 older footer', () => {
  const fmt = require(FORMATTER_PATH);
  const decisions = [];
  for (let i = 0; i < 21; i++) decisions.push(mkDecision(i));
  const sections = {
    'market-analysis': healthySection({ decision_log: decisions }),
  };
  const out = fmt.formatTripleContext({ sections });
  assert.ok(out.indexOf('Decision log:') !== -1, 'Decision log header present');
  // latest 3 = indices 18, 19, 20 (end of array is latest by write order)
  assert.ok(out.indexOf('reason 18') !== -1, 'latest-3 entry 18 rendered');
  assert.ok(out.indexOf('reason 19') !== -1, 'latest-3 entry 19 rendered');
  assert.ok(out.indexOf('reason 20') !== -1, 'latest-3 entry 20 rendered');
  // earlier entries NOT rendered
  assert.ok(out.indexOf('reason 0\n') === -1 && out.indexOf('reason 0 ') === -1 && out.indexOf('reason 0,') === -1,
    'earliest entry NOT rendered');
  // overflow footer present
  assert.ok(out.indexOf('[+18 older]') !== -1, '+18 older footer present');
});

// ---------------------------------------------------------------------------
// Test 4: null governing_thought -> "(not yet generated)"
// ---------------------------------------------------------------------------
test('Test 4: null governing_thought -> Reasoning line reads (not yet generated)', () => {
  const fmt = require(FORMATTER_PATH);
  const sections = {
    'market-analysis': healthySection({ governing_thought: null }),
  };
  const out = fmt.formatTripleContext({ sections });
  assert.ok(out.indexOf('(not yet generated)') !== -1,
    '(not yet generated) placeholder present');
});

// ---------------------------------------------------------------------------
// Test 5: References rendering -- 5 items = all; > 5 = first 5 + [+N more]
// ---------------------------------------------------------------------------
test('Test 5: 5 references render fully; > 5 show first 5 + [+N more]', () => {
  const fmt = require(FORMATTER_PATH);
  // Case A: exactly 5 references render fully (no overflow marker)
  const sections5 = {
    'market-analysis': healthySection({
      references: [
        { target: 'a', type: 'section', label: 'a' },
        { target: 'b', type: 'section', label: 'b' },
        { target: 'c', type: 'section', label: 'c' },
        { target: 'd', type: 'section', label: 'd' },
        { target: 'e', type: 'section', label: 'e' },
      ],
    }),
  };
  const out5 = fmt.formatTripleContext({ sections: sections5 });
  assert.ok(out5.indexOf('[[a]]') !== -1, 'ref a rendered');
  assert.ok(out5.indexOf('[[e]]') !== -1, 'ref e rendered');
  assert.ok(out5.indexOf('[+') === -1 || out5.indexOf('[+0 more]') !== -1,
    'no overflow marker for exactly 5 refs');

  // Case B: 8 references -> first 5 + [+3 more]
  const sections8 = {
    'market-analysis': healthySection({
      references: [
        { target: 'r1', type: 'section', label: 'r1' },
        { target: 'r2', type: 'section', label: 'r2' },
        { target: 'r3', type: 'section', label: 'r3' },
        { target: 'r4', type: 'section', label: 'r4' },
        { target: 'r5', type: 'section', label: 'r5' },
        { target: 'r6', type: 'section', label: 'r6' },
        { target: 'r7', type: 'section', label: 'r7' },
        { target: 'r8', type: 'section', label: 'r8' },
      ],
    }),
  };
  const out8 = fmt.formatTripleContext({ sections: sections8 });
  assert.ok(out8.indexOf('[[r1]]') !== -1, 'r1 rendered');
  assert.ok(out8.indexOf('[[r5]]') !== -1, 'r5 rendered');
  assert.ok(out8.indexOf('[[r6]]') === -1, 'r6 NOT rendered');
  assert.ok(out8.indexOf('[+3 more]') !== -1, '+3 more footer present');
});

// ---------------------------------------------------------------------------
// Test 6: Budget cap + weakest-first elision
// ---------------------------------------------------------------------------
test('Test 6: budget cap truncates weakest-first with strongest-elided footer', () => {
  const fmt = require(FORMATTER_PATH);
  // 30 sections, varying health scores 0.01..0.30 (1/100ths apart)
  // Each has a fat payload so any 5-6 of them blow the default 5000-token cap.
  const sections = {};
  const fatIdentity = 'identity text '.repeat(200); // ~2800 chars per section
  const fatThought = 'governing thought '.repeat(50);
  for (let i = 0; i < 30; i++) {
    const score = (i + 1) / 100; // 0.01, 0.02, ... 0.30
    sections['section-' + String(i).padStart(2, '0')] = healthySection({
      identity_text: fatIdentity,
      governing_thought: fatThought,
      reasoning_health_score: score,
      references: [{ target: 't' + i, type: 'section', label: 't' + i }],
    });
  }
  // Ensure default cap
  delete process.env.SESSION_START_BUDGET_TOKENS;
  const cap = fmt.getBudgetTokens();

  const out = fmt.formatTripleContext({ sections });
  // Total emitted tokens must be <= budget cap
  const tokens = fmt.estimateTokens(out);
  assert.ok(tokens <= cap,
    'emitted ' + tokens + ' tokens <= cap ' + cap);

  // Weakest-first: section-00 (score 0.01) must appear BEFORE section-29 (0.30)
  // If both were emitted, 00 appears earlier in the string; if not both,
  // weakest (00) must be present and strongest (29) must be elided.
  const idx00 = out.indexOf('### section-00/');
  const idx29 = out.indexOf('### section-29/');
  assert.ok(idx00 !== -1, 'weakest (section-00) present');
  if (idx29 !== -1) {
    assert.ok(idx00 < idx29, 'weakest appears before strongest');
  }

  // Elision footer present
  assert.ok(/\[\+\d+ strongest sections elided/.test(out) ||
           out.indexOf('strongest sections elided for budget') !== -1,
    'elision footer present (format: "N strongest sections elided for budget")');
});

// ---------------------------------------------------------------------------
// Test 6b: null reasoning_health_score sorts FIRST (weakest)
// ---------------------------------------------------------------------------
test('Test 6b: null reasoning_health_score sorted FIRST (before score=0.1)', () => {
  const fmt = require(FORMATTER_PATH);
  const sections = {
    'score-01': healthySection({ reasoning_health_score: 0.1 }),
    'score-null': healthySection({ reasoning_health_score: null }),
    'score-09': healthySection({ reasoning_health_score: 0.9 }),
  };
  const out = fmt.formatTripleContext({ sections });
  const idxNull = out.indexOf('### score-null/');
  const idx01 = out.indexOf('### score-01/');
  const idx09 = out.indexOf('### score-09/');
  assert.ok(idxNull !== -1 && idx01 !== -1 && idx09 !== -1, 'all sections present');
  assert.ok(idxNull < idx01, 'null score appears BEFORE score=0.1');
  assert.ok(idx01 < idx09, 'score=0.1 appears BEFORE score=0.9');
});

// ---------------------------------------------------------------------------
// Test 7: Token estimation consistency
// ---------------------------------------------------------------------------
test('Test 7: estimateTokens uses Math.ceil(length/4) and total <= cap', () => {
  const fmt = require(FORMATTER_PATH);
  // Known inputs
  assert.equal(fmt.estimateTokens(''), 0, 'empty -> 0 tokens');
  assert.equal(fmt.estimateTokens('abcd'), 1, '4 chars -> 1 token');
  assert.equal(fmt.estimateTokens('abcde'), 2, '5 chars -> 2 tokens (ceil)');
  assert.equal(fmt.estimateTokens(null), 0, 'null -> 0 tokens');
  assert.equal(fmt.estimateTokens(undefined), 0, 'undefined -> 0 tokens');

  // Formatted output always within cap
  delete process.env.SESSION_START_BUDGET_TOKENS;
  const cap = fmt.getBudgetTokens();
  const sections = {};
  for (let i = 0; i < 10; i++) {
    sections['s' + i] = healthySection({ reasoning_health_score: i / 10 });
  }
  const out = fmt.formatTripleContext({ sections });
  assert.ok(fmt.estimateTokens(out) <= cap,
    'total tokens <= cap (' + fmt.estimateTokens(out) + ' <= ' + cap + ')');
});

// ---------------------------------------------------------------------------
// Test 8: Stale annotation on State line
// ---------------------------------------------------------------------------
test('Test 8: is_stale:true -> State line annotated with stale_reason', () => {
  const fmt = require(FORMATTER_PATH);
  const sections = {
    'market-analysis': healthySection({
      is_stale: true,
      stale_reason: 'artifacts_newer_than_minto',
    }),
  };
  const out = fmt.formatTripleContext({ sections });
  assert.ok(out.indexOf('stale: artifacts_newer_than_minto') !== -1,
    'stale reason annotated on State line');
});

// ---------------------------------------------------------------------------
// Test 9: pending-tier1-regen footer
// ---------------------------------------------------------------------------
test('Test 9: pendingTier1 with 4 sections -> footer with count and /mos:reason hint', () => {
  const fmt = require(FORMATTER_PATH);
  const sections = {
    'market-analysis': healthySection(),
  };
  const out = fmt.formatTripleContext({
    sections,
    pendingTier1: [
      { section: 'a' }, { section: 'b' }, { section: 'c' }, { section: 'd' },
    ],
  });
  assert.ok(out.indexOf('4 sections') !== -1, 'count of 4 in footer');
  assert.ok(out.indexOf('tier-0') !== -1 || out.indexOf('tier 0') !== -1 || out.indexOf('tier-1') !== -1,
    'tier-0 / tier-1 language in footer');
  assert.ok(out.indexOf('/mos:reason') !== -1, '/mos:reason hint present');
});

// ---------------------------------------------------------------------------
// Test 10: Zero sections -> empty string
// ---------------------------------------------------------------------------
test('Test 10: zero sections -> empty string', () => {
  const fmt = require(FORMATTER_PATH);
  assert.equal(fmt.formatTripleContext({ sections: {} }), '',
    'empty sections returns empty string');
  assert.equal(fmt.formatTripleContext({ sections: null }), '',
    'null sections returns empty string');
  assert.equal(fmt.formatTripleContext({}), '',
    'missing sections returns empty string');
});

// ---------------------------------------------------------------------------
// Test 11: SESSION_START_BUDGET_TOKENS env override
// ---------------------------------------------------------------------------
test('Test 11: SESSION_START_BUDGET_TOKENS env override behavior', () => {
  const fmt = require(FORMATTER_PATH);
  const DEFAULT = fmt.DEFAULT_BUDGET_TOKENS;

  // Set to a valid number -> cap = that number
  process.env.SESSION_START_BUDGET_TOKENS = '3000';
  assert.equal(fmt.getBudgetTokens(), 3000, 'env=3000 -> cap=3000');

  // Set to garbage -> fallback to default
  process.env.SESSION_START_BUDGET_TOKENS = 'abc';
  assert.equal(fmt.getBudgetTokens(), DEFAULT, 'env=abc -> fallback to DEFAULT');

  // Set to 0 -> fallback to default (invalid, must be > 0)
  process.env.SESSION_START_BUDGET_TOKENS = '0';
  assert.equal(fmt.getBudgetTokens(), DEFAULT, 'env=0 -> fallback to DEFAULT');

  // Set to negative -> fallback
  process.env.SESSION_START_BUDGET_TOKENS = '-100';
  assert.equal(fmt.getBudgetTokens(), DEFAULT, 'env=-100 -> fallback to DEFAULT');

  // Unset -> default
  delete process.env.SESSION_START_BUDGET_TOKENS;
  assert.equal(fmt.getBudgetTokens(), DEFAULT, 'env unset -> DEFAULT');
});

// ---------------------------------------------------------------------------
// Test 12: Baseline measurement recorded in SUMMARY.md
// ---------------------------------------------------------------------------
test('Test 12: baseline session-start emission recorded in 88-07-SUMMARY.md', () => {
  const summaryPath = path.join(
    REPO,
    '.planning',
    'phases',
    '88-feynman-minto-memory-layer',
    '88-07-SUMMARY.md'
  );
  assert.ok(fs.existsSync(summaryPath),
    'SUMMARY.md must exist at ' + summaryPath);
  const body = fs.readFileSync(summaryPath, 'utf8');
  const hit = /baseline.*tokens|measured.*session-start/i.test(body);
  assert.ok(hit,
    'SUMMARY.md must contain baseline-tokens or measured-session-start phrasing');
});

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------
(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write('  pass: ' + t.name + '\n');
    } catch (e) {
      failed += 1;
      process.stderr.write('  FAIL: ' + t.name + '\n');
      process.stderr.write('    ' + (e && e.stack ? e.stack : String(e)) + '\n');
    }
  }
  process.stdout.write(
    '\ntriple-context-formatter: ' + (tests.length - failed) + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
