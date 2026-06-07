'use strict';
/*
 * Phase 144.1-04 Task 2 -- the agents-walk discovery test.
 *
 * Mirrors the tests/test-connector-part8-boundary.cjs idiom (ok/fail counters,
 * per-check PASS/FAIL print, exit non-zero on any failure). It locks the two
 * contracts Plan 04 adds to scripts/build-connector-registry.cjs:
 *
 *   (1) the generator walks agents/*.md -- the same parseConnectorFrontmatter
 *       that parses a command parses an agent file, so an agent that declares a
 *       valid connector: block IS discoverable;
 *   (2) any connector whose source === 'agent' carries an "agent:" surface
 *       prefix (mirroring "/mos:" for command and "skill:" for skill).
 *
 * The test is pure: it touches no Brain and no network. It reads agents/ on
 * disk and exercises parseConnectorFrontmatter + buildRegistry directly.
 *
 * NOTE on vacuous truth: at Plan 04 time NO agent declares a connector yet
 * (Plan 05 adds them), so the source==='agent' surface-prefix assertion (CHECK
 * 3) is vacuously true -- there are zero agent connectors to violate it. That is
 * acceptable and intentional: this test proves the WALK and the PARSER handle an
 * agent, and locks the prefix contract for when Plan 05 lands the first agent
 * connector. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents');

const generator = require(
  path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs')
);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// CHECK 1 -- the generator module loads and exposes buildRegistry +
// parseConnectorFrontmatter, and agents/ holds at least one .md to walk.
// ---------------------------------------------------------------------------
(function check1_moduleAndAgentsDir() {
  const label = 'CHECK 1 - generator exposes buildRegistry + parseConnectorFrontmatter; agents/ has >=1 .md';
  try {
    assert.equal(typeof generator.buildRegistry, 'function',
      label + ': buildRegistry must be exported');
    assert.equal(typeof generator.parseConnectorFrontmatter, 'function',
      label + ': parseConnectorFrontmatter must be exported');

    const agentMd = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
    assert.ok(agentMd.length >= 1,
      label + ': agents/ must contain at least one .md file for the walk to discover');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 2 -- the SAME parser handles an agent-shaped connector block. A crafted
// agent .md string with a nested connector: block parses to out.connector with
// connects_to_spine: true (proving an agent file would register identically to
// a command).
// ---------------------------------------------------------------------------
(function check2_parserHandlesAgentConnector() {
  const label = 'CHECK 2 - parseConnectorFrontmatter parses an agent-shaped connector: block (connects_to_spine: true)';
  try {
    const agentMd = [
      '---',
      'name: fixture-agent',
      'description: a crafted agent fixture for the walk test (not written to disk)',
      'connector:',
      '  connects_to_spine: true',
      '  sensor_triggers: [SENS-02, SENS-07]',
      '  reach_id: REACH-DIAGNOSE',
      '  framework: SWOT',
      '  posture: GUIDED',
      '  hierarchy_rank: 5',
      '  filing: none',
      '  plan_gated: false',
      '---',
      '',
      '# Fixture agent body',
      'Prose that the parser must ignore.',
    ].join('\n');

    const fm = generator.parseConnectorFrontmatter(agentMd);
    assert.ok(fm && typeof fm.connector === 'object' && !Array.isArray(fm.connector),
      label + ': parser must return an out.connector object for an agent-shaped block');
    assert.equal(fm.connector.connects_to_spine, true,
      label + ': the nested connects_to_spine must coerce to boolean true');
    assert.deepEqual(fm.connector.sensor_triggers, ['SENS-02', 'SENS-07'],
      label + ': the nested sensor_triggers must parse to a trimmed token array');
    assert.equal(fm.connector.framework, 'SWOT',
      label + ': the nested framework handle must parse');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 3 -- every connector whose source === 'agent' carries an "agent:"
// surface prefix. Vacuously true until Plan 05 lands the first agent connector;
// the assertion locks the contract for that moment.
// ---------------------------------------------------------------------------
(function check3_agentSurfacePrefix() {
  const label = 'CHECK 3 - buildRegistry does not throw; every source===agent connector carries an "agent:" surface prefix';
  try {
    const reg = generator.buildRegistry();
    assert.ok(reg && Array.isArray(reg.connectors),
      label + ': buildRegistry must return a connectors array');

    const agentConnectors = reg.connectors.filter((c) => c && c.source === 'agent');
    for (const c of agentConnectors) {
      assert.ok(typeof c.surface === 'string' && c.surface.indexOf('agent:') === 0,
        label + ': agent connector surface "' + String(c && c.surface) +
          '" must start with "agent:"');
    }
    // Documented vacuous-true note: agentConnectors.length may be 0 at Plan 04.
    process.stdout.write(
      '    (info) agent connectors discovered: ' + agentConnectors.length + '\n'
    );

    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('connector agents-walk: ' + passed + ' passed, ' + failed + ' failed (3 checks)\n');
process.exit(failed === 0 ? 0 : 1);
