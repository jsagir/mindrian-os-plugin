'use strict';
/*
 * Phase 146-01 -- ACPT-02 dogfood driver: hat-scoped WebSearch (Canon Part 2 + Part 8).
 * =================================================================================
 *
 * THE PROOF this acceptance leg exists to make: a scripted dogfood turn that
 * references external facts surfaces a HAT-SCOPED WebSearch reach via the REAL
 * shipped sensorExternalFact + hatScopeFor, and the reach carries ONLY a generic
 * public topic handle (the matched external-fact category enum) -- NEVER the
 * user's turn text or artifact bytes (Canon Part 8: SIGNAL -> LOCAL yes,
 * SIGNAL -> Brain no; the web reach carries no user content).
 *
 * This driver is HERMETIC by design (per the audit + the plan's ACPT-02 fence):
 * it is a scripted assertion over the LOCAL sensor-external-fact + hatScopeFor
 * path, NOT a live web call. The hat-scoping (Part 2) + the Part-8 no-user-content
 * fence are FULLY assertable on the LOCAL sensor, so no live WebSearch leg and no
 * autonomous:false marker are needed -- this criterion runs fully autonomously.
 *
 *   Test A (REAL sensor fires, hat-scoped White): a competitor/market turn under
 *          the White hat returns a non-null reach whose tool set reflects
 *          hatScopeFor('White') (Tavily + arxiv) per Canon Part 2.
 *   Test B (hat scoping varies): Green reflects patents + arxiv + deep-research
 *          (deep_research lane); Red surfaces NO web tool (intuition only) and
 *          returns null per Canon Part 2 (Red = no external tool).
 *   Test C (Part 8 no user content): a turn carrying an obviously-fictional
 *          proprietary sentinel returns a reach whose FULL JSON.stringify does
 *          NOT contain the sentinel -- only the generic category handle rides.
 *   Test D (MCP-stack-ask gate): an un-preconfigured hat surfaces the
 *          tool_choice_gate flag (no silent WebSearch dispatch); a preconfigured
 *          hat skips the gate.
 *   Test E (no-match negative): a turn with no external-fact phrasing returns
 *          null (the sensor does not over-fire).
 *
 * Structured so the Phase 146 Plan 04 aggregator can require it as-is: a single
 * node-runnable file, clear pass/fail exit code.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { sensorExternalFact } = require(path.join(ROOT, 'lib', 'core', 'sensors', 'sensor-external-fact.cjs'));
const { hatScopeFor } = require(path.join(ROOT, 'lib', 'core', 'sensors', 'hat-scoping-table.cjs'));

// Scrub any stub env defensively (consistency with ACPT-01; the sensor path has
// no stub, but the suite must be provably stub-free).
delete process.env.MOS_NAV_TEST_FIRE_SKILL;

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// Helper: the set of generic web-tool handles a reach surfaced (from companions).
function reachTools(reach) {
  const out = [];
  if (!reach || !Array.isArray(reach.companions)) return out;
  for (const c of reach.companions) {
    if (typeof c === 'string' && c.indexOf('web_tool:') === 0) out.push(c.slice('web_tool:'.length));
  }
  return out;
}

// =====================================================================
// Test A -- REAL sensor fires, hat-scoped (White -> Tavily + arxiv)
// =====================================================================
(function testA_whiteHatScopedReach() {
  const label =
    'ACPT-02 A WHITE: an external-fact turn under White hat -> REAL sensorExternalFact fires a reach reflecting hatScopeFor(White) (Tavily + arxiv)';
  try {
    const reach = sensorExternalFact(
      { text: 'how does our COMPETITOR position against the market leader?', active_hat: 'White' },
      {},
      {}
    );
    assert.ok(reach !== null && typeof reach === 'object', label + ': the sensor must fire a non-null reach');
    assert.equal(reach.signal, 'external_fact', label + ': the reach must carry the external_fact signal');

    // The reach_id must be one of the frozen 5 (White is shallow -> context_block).
    assert.equal(reach.reach_id, 'context_block', label + ': White hat uses the shallow context_block lane');

    // The surfaced tool set must reflect hatScopeFor('White').
    const scope = hatScopeFor('White');
    const tools = reachTools(reach);
    for (const t of scope.tools) {
      assert.ok(tools.indexOf(t) !== -1, label + ': the reach must surface the White-scoped tool "' + t + '"');
    }
    assert.equal(
      reach.evidence.topic_handle,
      'competitor',
      label + ': the generic category handle must be the matched external-fact enum'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// Test B -- hat scoping varies (Green deep-research; Red = no web tool)
// =====================================================================
(function testB_hatScopingVariesByHat() {
  const greenLabel =
    'ACPT-02 B GREEN: Green hat external-fact reach reflects patents + arxiv + deep-research (the deep_research lane)';
  try {
    const reach = sensorExternalFact(
      { text: 'what is the state-of-the-art in this space?', active_hat: 'Green' },
      {},
      {}
    );
    assert.ok(reach !== null, greenLabel + ': Green must fire a reach');
    assert.equal(reach.reach_id, 'deep_research', greenLabel + ': Green uses the deep_research escalation lane');
    const scope = hatScopeFor('Green');
    const tools = reachTools(reach);
    for (const t of scope.tools) {
      assert.ok(tools.indexOf(t) !== -1, greenLabel + ': the reach must surface the Green-scoped tool "' + t + '"');
    }
    assert.equal(reach.evidence.deep_research_lane, true, greenLabel + ': the deep_research lane flag must be set for Green');
    ok(greenLabel);
  } catch (e) { fail(greenLabel, e); }

  const redLabel =
    'ACPT-02 B RED: Red hat surfaces NO web tool (intuition only) -> the sensor returns null per Canon Part 2 (Red = no external tool)';
  try {
    const reach = sensorExternalFact(
      { text: 'what are our competitors doing in the market?', active_hat: 'Red' },
      {},
      {}
    );
    assert.equal(reach, null, redLabel + ': Red (web_enabled=false) must surface NO external-web reach');
    // Cross-check the source of truth: Red scope is web-disabled with no tools.
    const scope = hatScopeFor('Red');
    assert.equal(scope.web_enabled, false, redLabel + ': hatScopeFor(Red).web_enabled must be false');
    assert.deepEqual(scope.tools, [], redLabel + ': hatScopeFor(Red).tools must be empty (no web tool)');
    ok(redLabel);
  } catch (e) { fail(redLabel, e); }
})();

// =====================================================================
// Test C -- Part 8: the reach carries the generic handle ONLY, never user content
// =====================================================================
(function testC_part8NoUserContent() {
  const label =
    'ACPT-02 C PART-8: the reach JSON carries the generic category handle only and NEVER the fictional proprietary sentinel (the web reach carries no user content)';
  try {
    const SENTINEL = 'SECRET-MARGIN-42pct-FICTIONAL';
    const reach = sensorExternalFact(
      {
        text: 'our COMPETITOR can never match our ' + SENTINEL + ' gross margin in this market',
        active_hat: 'White',
      },
      {},
      {}
    );
    assert.ok(reach !== null, label + ': precondition -- the external-fact turn must fire a reach');

    // The load-bearing assertion: stringify the WHOLE reach and prove the
    // fictional proprietary sentinel is absent anywhere (Part 8 hard fence).
    const whole = JSON.stringify(reach);
    assert.equal(
      whole.indexOf(SENTINEL),
      -1,
      label + ': the fictional proprietary sentinel must NOT appear anywhere in the reach (Part 8)'
    );
    // And the generic category handle DOES ride (proves the sensor still classifies).
    assert.equal(
      reach.evidence.topic_handle,
      'competitor',
      label + ': only the generic category handle (competitor) rides the reach'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// =====================================================================
// Test D -- MCP-stack-ask gate (no silent WebSearch dispatch)
// =====================================================================
(function testD_mcpStackAskGate() {
  const gateLabel =
    'ACPT-02 D GATE: an un-preconfigured hat surfaces the tool_choice_gate flag (no silent WebSearch dispatch) per the MCP-stack-ask rule';
  try {
    const reach = sensorExternalFact(
      { text: 'show me the market landscape', active_hat: 'White' },
      {},
      {} // no hat_tool_preconfigured map -> the gate is active
    );
    assert.ok(reach !== null, gateLabel + ': the external-fact turn must fire a reach');
    assert.equal(reach.evidence.tool_choice_gate, true, gateLabel + ': the tool_choice_gate flag must be set when the hat is not preconfigured');
    const hasChoice = reach.companions.some(function (c) { return c.indexOf('tool_choice:') === 0; });
    assert.ok(hasChoice, gateLabel + ': the reach must surface a tool_choice Decision-Gate offer (never a silent dispatch)');
    ok(gateLabel);
  } catch (e) { fail(gateLabel, e); }

  const preLabel =
    'ACPT-02 D PRECONFIGURED: a preconfigured hat skips the gate (tool_choice_gate false, tool_preconfigured handle rides)';
  try {
    const reach = sensorExternalFact(
      { text: 'show me the market landscape', active_hat: 'White' },
      {},
      { hat_tool_preconfigured: { White: 'Tavily' } }
    );
    assert.ok(reach !== null, preLabel + ': the external-fact turn must still fire a reach');
    assert.equal(reach.evidence.tool_choice_gate, false, preLabel + ': the gate must be skipped when the hat is preconfigured');
    const hasPre = reach.companions.some(function (c) { return c === 'tool_preconfigured:Tavily'; });
    assert.ok(hasPre, preLabel + ': the preconfigured tool must ride as a generic handle (no gate offer)');
    ok(preLabel);
  } catch (e) { fail(preLabel, e); }
})();

// =====================================================================
// Test E -- no-match negative (the sensor does not over-fire)
// =====================================================================
(function testE_noOverFire() {
  const label =
    'ACPT-02 E NEGATIVE: a turn with no external-fact phrasing returns null (the sensor does not over-fire)';
  try {
    const reach = sensorExternalFact(
      { text: 'I am feeling stuck about which direction to take next', active_hat: 'White' },
      {},
      {}
    );
    assert.equal(reach, null, label + ': a non-external-fact turn must not surface a web reach');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'ACPT-02 hat-scoped WebSearch (Phase 146-01 acceptance): ' +
  passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
