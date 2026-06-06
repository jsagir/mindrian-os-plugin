'use strict';
/*
 * Phase 143-03 Task 1 -- SENS-04 external-fact loop-fires test.
 *
 * SENS-04 is the gate-relevant net-new web sensor. When the navigator references
 * an external fact (competitor / market / state-of-the-art), the sensor surfaces
 * a HAT-SCOPED WebSearch candidate reach per Canon Part 2 (White=data/arxiv,
 * Green=patents+arxiv+deep-research, Black=failure-cases, Yellow=success-cases,
 * Red=no external tool, Blue=synthesis). It honors the MCP-stack-ask rule: the
 * reach carries a Decision-Gate tool-choice flag (Tavily/Firecrawl/Exa) unless
 * the hat is pre-configured -- NEVER a silent WebSearch dispatch. Its web query
 * payload carries ONLY the public topic handle (SIGNAL), never user artifact
 * bytes (Part 8: SIGNAL -> LOCAL yes, SIGNAL -> Brain no).
 *
 * Loop-fires assertions:
 *   1. hatScopeFor scopes per hat: White=data/arxiv, Green=patents+arxiv+
 *      deep-research, Black=failure-cases, Red=intuition-only (no web tool).
 *   2. An external-fact turn with active hat Green returns a reach scoped to the
 *      Green tool set, reach_id in {context_block, deep_research}.
 *   3. The reach honors the MCP-stack-ask rule: when the hat is not pre-configured
 *      it carries a Decision-Gate tool-choice flag (Tavily/Firecrawl/Exa) and does
 *      NOT mark a silent WebSearch dispatch.
 *   4. Part-8 no-leak: a fixture turn carrying user artifact TEXT yields a reach
 *      whose web-query payload contains ONLY the public topic handle, never the
 *      artifact bytes.
 *   5. Red Hat returns null for a web reach (intuition only).
 *   6. dispatchSensors INCLUDES the SENS-04 reach when the external-fact pattern
 *      fires.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const detector = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-external-fact.cjs'));
const { hatScopeFor } = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'hat-scoping-table.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const SECRET = 'ACME proprietary CAR-T financial model: $4.2M burn, 18mo runway';

(function test_hatScopeTable() {
  const label = 'hatScopeFor scopes the web tool set per Canon Part 2 (White/Green/Black/Red)';
  try {
    const white = hatScopeFor('White');
    assert.ok(white && Array.isArray(white.tools), label + ': White returns a tools array');
    assert.match(white.tools.join('|'), /arxiv/i, label + ': White scope includes arxiv');

    const green = hatScopeFor('Green');
    assert.match(green.tools.join('|'), /patent/i, label + ': Green scope includes patents');
    assert.match(green.tools.join('|'), /deep.?research/i, label + ': Green scope includes deep-research');

    const black = hatScopeFor('Black');
    assert.match(black.tools.join('|') + '|' + (black.focus || ''), /failure|risk/i, label + ': Black scope is failure/risk cases');

    const red = hatScopeFor('Red');
    assert.equal(red.web_enabled, false, label + ': Red Hat has NO external web tool (intuition only)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_firesOnExternalFactGreen() {
  const label = 'SENS-04 fires on an external-fact reference with hat Green -> Green-scoped web reach';
  try {
    const turn = { text: 'What is the state-of-the-art for our competitor in this market?', active_hat: 'Green' };
    const reach = detector.sensorExternalFact(turn, { problem_type: 'wicked' }, {});

    assert.ok(reach && typeof reach === 'object', label + ': must return a reach');
    assert.ok(['context_block', 'deep_research'].indexOf(reach.reach_id) !== -1, label + ": reach_id in {context_block, deep_research}");
    const joined = reach.companions.join('|');
    assert.match(joined, /patent/i, label + ': Green tool scope (patents) rides the reach');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_mcpStackAskGate() {
  const label = 'SENS-04 honors the MCP-stack-ask rule -- Decision-Gate tool choice, no silent WebSearch';
  try {
    // Hat not pre-configured: the reach must surface a tool-choice Decision Gate.
    const turn = { text: 'How does our competitor position against the market leader?', active_hat: 'White' };
    const reach = detector.sensorExternalFact(turn, {}, {});
    assert.ok(reach, label + ': fires');
    assert.equal(reach.evidence.tool_choice_gate, true, label + ': tool_choice_gate flag is set when the hat is not pre-configured');
    const joined = reach.companions.join('|');
    assert.match(joined, /Tavily/i, label + ': Tavily is offered in the tool choice');
    assert.match(joined, /Firecrawl/i, label + ': Firecrawl is offered in the tool choice');
    assert.match(joined, /Exa/i, label + ': Exa is offered in the tool choice');
    // No silent WebSearch dispatch anywhere in the reach.
    assert.equal(/silent/i.test(JSON.stringify(reach)), false, label + ': no silent dispatch marker anywhere in the reach');

    // Pre-configured hat: no tool-choice gate (the ask is skipped).
    const preReach = detector.sensorExternalFact(
      { text: 'state-of-the-art competitor benchmark', active_hat: 'White' },
      {},
      { hat_tool_preconfigured: { White: 'Tavily' } }
    );
    assert.ok(preReach, label + ': pre-configured fires too');
    assert.equal(preReach.evidence.tool_choice_gate, false, label + ': pre-configured hat skips the tool-choice gate');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_part8PublicSignalOnly() {
  const label = 'SENS-04 Part-8: the web-query payload carries ONLY the public topic handle, never artifact bytes';
  try {
    const turn = {
      text: 'competitor market analysis ' + SECRET,
      active_hat: 'White',
      artifact_body: SECRET,
    };
    const reach = detector.sensorExternalFact(turn, { artifact_body: SECRET }, { artifact: SECRET });
    assert.ok(reach, label + ': fires');
    const serialized = JSON.stringify(reach);
    assert.equal(serialized.indexOf(SECRET), -1, label + ': the full secret artifact text must NOT appear in the reach');
    assert.equal(serialized.indexOf('ACME'), -1, label + ': no fragment of user content leaks');
    assert.equal(serialized.indexOf('4.2M'), -1, label + ': no proprietary number leaks');
    // The public topic handle (a generic enum, not the turn text) is what rides.
    assert.equal(typeof reach.evidence.topic_handle, 'string', label + ': a generic public topic handle is carried');
    assert.equal(reach.evidence.topic_handle.indexOf(SECRET), -1, label + ': the topic handle is generic, not the artifact text');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_redHatNull() {
  const label = 'SENS-04 Red Hat returns null for a web reach (intuition only)';
  try {
    const reach = detector.sensorExternalFact(
      { text: 'what is the state-of-the-art competitor benchmark?', active_hat: 'Red' },
      {},
      {}
    );
    assert.equal(reach, null, label + ': Red Hat -> null (no external tool)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_noExternalFactNull() {
  const label = 'SENS-04 returns null when no external-fact reference is present';
  try {
    const reach = detector.sensorExternalFact({ text: 'let me reflect on my own assumptions', active_hat: 'White' }, {}, {});
    assert.equal(reach, null, label + ': no external-fact pattern -> null');
    assert.equal(detector.sensorExternalFact(null, null, null), null, label + ': null turn -> null (never throws)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchIncludesSens04() {
  const label = 'dispatchSensors includes the SENS-04 reach when the external-fact pattern fires';
  try {
    const out = sensors.dispatchSensors(
      { text: 'our competitor just shipped a state-of-the-art model', active_hat: 'Green' },
      { problem_type: 'wicked' },
      {}
    );
    assert.ok(Array.isArray(out), label + ': array');
    const sens04 = out.find(function (r) { return r.signal === 'external_fact'; });
    assert.ok(sens04, label + ': a SENS-04 external_fact reach is in the dispatch output');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('SENS-04 external-fact loop-fires: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
