'use strict';
/*
 * Phase 143.4-03 Task 1 -- the Canon Part 8 boundary scan over the /mos:discover surface.
 *
 * Mirrors tests/test-connector-part8-boundary.cjs (the connector-spine sweep: the
 * FROZEN_WEB_SCOPES set, the ALLOWED_CONNECTOR_FIELDS set, the FORBIDDEN_BODY_FIELDS
 * list, the ok/fail harness) and tests/test-sensors-part8-sweep.cjs (the
 * forbidden-substring idiom over a dispatch path), narrowed to the SINGLE discover
 * connector authored in Plan 01.
 *
 * Discovery content -- brand soul, product essence, persona names, JTBD content,
 * client specifics -- is the MOST sensitive LOCAL content in the product. This scan
 * proves by instrumentation, not by promise, that the threat-model paths from the
 * 143.4 CONTEXT threat_model are CLOSED:
 *
 *   CHECK A (T-143.4-09 + T-143.4-12) -- EXACTLY ONE discover connector, schema
 *       fields only, NO plain-language-bridge connector. FIX 1: DISC-10 declares no
 *       connector; it dispatches via the existing Feynman surface (CHECK E), not a
 *       second registry entry. A stray duplicate /mos:discover surface fails.
 *
 *   CHECK B (T-143.4-10) -- web_scope strictly null + frozen reach/posture banks on
 *       the single discover connector. A mutation to "green" or any value fails.
 *
 *   CHECK C (T-143.4-11) -- the only Brain-bound framework handles named in
 *       commands/discover.md are the generic published framework names; the command
 *       states the Part-8 rule (Brain queries carry generic handles only, all
 *       discovery content files LOCAL via navigation.cjs); a forbidden-substring
 *       sweep finds no instruction to send turn text / artifact bodies / persona
 *       names / product essence into a Brain query or a web call.
 *
 *   CHECK D -- the discover connector framework value is a generic published name
 *       present in data/framework-names.json (never a client string).
 *
 *   CHECK E (FIX 1) -- DISC-10 dispatch-by-resolver is real: commandsForFramework
 *       ("The Pyramid Principle") returns a non-empty array (the resolver door, NOT
 *       a second connector). The discover framework also resolves /mos:discover and
 *       /mos:jtbd (the FIX-3 route).
 *
 * Prints per-check PASS/FAIL. Exits non-zero on any breach. House rule: hyphens
 * only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'connector-registry.json');
const FRAMEWORK_NAMES_PATH = path.join(REPO_ROOT, 'data', 'framework-names.json');
const COMMAND_PATH = path.join(REPO_ROOT, 'commands', 'discover.md');
const RESOLVER_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs');

// The frozen web_scope enum (copied verbatim from test-connector-part8-boundary.cjs):
// null (no web) or one of the de Bono hat colors hatScopeFor keys on.
const FROZEN_WEB_SCOPES = new Set([null, 'white', 'red', 'black', 'yellow', 'green', 'blue']);

// Schema fields a connector entry is ALLOWED to carry (copied verbatim). A free-text
// body channel outside this set is a Part-8 smuggling surface.
const ALLOWED_CONNECTOR_FIELDS = new Set([
  'surface', 'source', 'connects_to_spine', 'sensor_triggers', 'reach_id',
  'sub_mode', 'framework', 'posture', 'hierarchy_rank', 'filing', 'plan_gated',
  'web_scope', 'decision_surface',
]);

// Free-text-shaped field names that must NEVER appear on a connector entry (copied
// verbatim). Any of these on the discover entry could smuggle client content.
const FORBIDDEN_BODY_FIELDS = ['summary', 'content', 'body', 'text', 'note', 'description', 'evidence', 'turn'];

// The frozen reach + posture banks the single discover connector must sit inside
// (the 5 reach_ids + 3 postures the spine froze; the discover connector picks
// brain_consult + push_forward per the Plan 01 enum decision).
const FROZEN_REACH_IDS = new Set(['brain_consult', 'cross_domain_connect', 'six_hats', 'whitespace_scan', 'opportunity_bank']);
const FROZEN_POSTURES = new Set(['push_forward', 'hold_steady', 'pull_back']);

// The generic published framework handles that are the ONLY Brain-bound values the
// discover command may name. These are generic methodology names, never client
// strings.
const GENERIC_FRAMEWORK_HANDLES = [
  'Jobs to Be Done (JTBD)',
  'The Pyramid Principle',
  'Beautiful Question Framework',
  'Six Thinking Hats',
  'Lean Canvas',
];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function loadDiscoverConnectors() {
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const connectors = Array.isArray(reg.connectors) ? reg.connectors : [];
  return {
    all: connectors,
    discover: connectors.filter(function (c) { return c && c.surface === '/mos:discover'; }),
    bridge: connectors.filter(function (c) { return c && c.sub_mode === 'plain-language-bridge'; }),
  };
}

// ---------------------------------------------------------------------------
// CHECK A -- EXACTLY ONE discover connector, schema fields only, NO bridge (FIX 1)
// ---------------------------------------------------------------------------
(function checkA_singleDiscoverConnector() {
  const label = 'CHECK A - exactly ONE /mos:discover connector, schema-fields-only, ZERO plain-language-bridge (FIX 1)';
  try {
    const { discover, bridge } = loadDiscoverConnectors();

    // (1) EXACTLY ONE discover connector. A second connector block would have been
    //     silently dropped by the one-connector-per-file generator, but a stray
    //     duplicate /mos:discover surface in the registry must also fail.
    assert.equal(discover.length, 1,
      label + ': expected EXACTLY ONE /mos:discover connector, found ' + discover.length);

    // (2) ZERO plain-language-bridge connector anywhere (FIX 1 / T-143.4-12). DISC-10
    //     declares no connector here -- it dispatches via the existing Feynman surface.
    assert.equal(bridge.length, 0,
      label + ': expected ZERO plain-language-bridge connectors (DISC-10 dispatches via the resolver, not a second registry entry), found ' + bridge.length);

    const c = discover[0];

    // (3) Only ALLOWED_CONNECTOR_FIELDS, none of the FORBIDDEN_BODY_FIELDS.
    for (const key of Object.keys(c)) {
      assert.ok(ALLOWED_CONNECTOR_FIELDS.has(key),
        label + ': discover connector carries off-schema field "' + key + '" - a Part-8 smuggling surface');
      assert.equal(FORBIDDEN_BODY_FIELDS.includes(key), false,
        label + ': discover connector carries forbidden free-text body field "' + key + '"');
    }

    // (4) sub_mode is the unique discovery render label.
    assert.equal(c.sub_mode, 'client-product-discovery',
      label + ': discover connector sub_mode must be "client-product-discovery", found "' + String(c.sub_mode) + '"');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK B -- web_scope strictly null + frozen reach/posture banks
// ---------------------------------------------------------------------------
(function checkB_webScopeAndFrozenBanks() {
  const label = 'CHECK B - discover connector web_scope === null (frozen banks); reach_id brain_consult; posture push_forward';
  try {
    const { discover } = loadDiscoverConnectors();
    assert.equal(discover.length, 1, label + ': prerequisite single discover connector missing');
    const c = discover[0];

    // web_scope is in the frozen set AND is specifically null (T-143.4-10:
    // strict-null comparison fails any drift to "green" or any other value).
    assert.ok(FROZEN_WEB_SCOPES.has(c.web_scope),
      label + ': web_scope "' + String(c.web_scope) + '" is not in the frozen web_scope bank');
    assert.strictEqual(c.web_scope, null,
      label + ': web_scope must be strictly null (discovery never reaches the web), found "' + String(c.web_scope) + '"');

    // reach_id is brain_consult (in the frozen 5).
    assert.ok(FROZEN_REACH_IDS.has(c.reach_id),
      label + ': reach_id "' + String(c.reach_id) + '" is not in the frozen reach bank');
    assert.equal(c.reach_id, 'brain_consult',
      label + ': discover connector reach_id must be "brain_consult", found "' + String(c.reach_id) + '"');

    // posture is push_forward (in the frozen 3).
    assert.ok(FROZEN_POSTURES.has(c.posture),
      label + ': posture "' + String(c.posture) + '" is not in the frozen posture bank');
    assert.equal(c.posture, 'push_forward',
      label + ': discover connector posture must be "push_forward", found "' + String(c.posture) + '"');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK C -- no client strings in the Brain-bound path (command body sweep)
// ---------------------------------------------------------------------------
(function checkC_noClientStringsToBrain() {
  const label = 'CHECK C - commands/discover.md: only generic framework handles reach Brain; content files LOCAL; no client-content-to-Brain anti-pattern';
  try {
    const src = fs.readFileSync(COMMAND_PATH, 'utf8');
    const lc = src.toLowerCase();

    // (1) Every Brain-bound handle named in the command is one of the generic
    //     published framework names (never a client string).
    for (const handle of GENERIC_FRAMEWORK_HANDLES) {
      assert.ok(src.includes(handle),
        label + ': command must name the generic framework handle "' + handle + '" as a Brain-bound value');
    }

    // (2) The command states the Part-8 rule: Brain queries carry generic handles
    //     only, and all discovery content files LOCAL via navigation.cjs.
    assert.ok(lc.includes('part 8') || lc.includes('part-8'),
      label + ': command must state the Part-8 boundary');
    assert.ok(lc.includes('generic') && lc.includes('handle'),
      label + ': command must state Brain-bound values are generic framework handles');
    assert.ok(lc.includes('navigation.cjs'),
      label + ': command must state discovery content files LOCAL via navigation.cjs');
    assert.ok(lc.includes('local'),
      label + ': command must state discovery content is LOCAL');

    // (3) Forbidden-substring sweep (mirrors test-sensors-part8-sweep idiom):
    //     no instruction that sends conversation content / artifact bodies / persona
    //     names / product essence / brand soul into a Brain query or a web call.
    //     Each regex pairs a content noun with a Brain/web egress verb in one phrase.
    const FORBIDDEN_EGRESS_PATTERNS = [
      /(send|pass|post|write|submit|upload)[^.\n]{0,40}(turn[- ]text|conversation content|artifact bod|persona name|product essence|brand soul|client specific)[^.\n]{0,40}(to|into)[^.\n]{0,20}brain/i,
      /brain[^.\n]{0,40}(query|call|packet|consult)[^.\n]{0,40}(turn[- ]text|conversation content|artifact bod|persona name|product essence|brand soul|client specific)/i,
      /(send|pass|post|write|submit|upload)[^.\n]{0,40}(turn[- ]text|conversation content|artifact bod|persona name|product essence|brand soul|client specific)[^.\n]{0,40}(to|into)[^.\n]{0,20}(web|websearch|web call)/i,
    ];
    for (const rx of FORBIDDEN_EGRESS_PATTERNS) {
      assert.equal(rx.test(src), false,
        label + ': command contains a client-content-to-Brain/web anti-pattern matching ' + rx);
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK D -- the framework handle is generic (present in framework-names.json)
// ---------------------------------------------------------------------------
(function checkD_frameworkIsGeneric() {
  const label = 'CHECK D - discover connector framework is a generic published name in framework-names.json';
  try {
    const { discover } = loadDiscoverConnectors();
    assert.equal(discover.length, 1, label + ': prerequisite single discover connector missing');
    const c = discover[0];

    const fwSnapshot = JSON.parse(fs.readFileSync(FRAMEWORK_NAMES_PATH, 'utf8'));
    const allowedFrameworks = new Set([
      ...(Array.isArray(fwSnapshot.framework_names) ? fwSnapshot.framework_names : []),
      ...(Array.isArray(fwSnapshot.curated_extras) ? fwSnapshot.curated_extras : []),
    ]);
    assert.ok(allowedFrameworks.size > 0,
      label + ': framework-names snapshot must expose a non-empty allowlist');

    assert.ok(allowedFrameworks.has(c.framework),
      label + ': discover framework "' + String(c.framework) +
        '" is not a generic name in framework-names.json (slug or smuggled content?)');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK E -- DISC-10 dispatch-by-resolver is real (FIX 1), not a second connector
// ---------------------------------------------------------------------------
(function checkE_disc10DispatchByResolver() {
  const label = 'CHECK E - DISC-10 dispatch-by-resolver: commandsForFramework("The Pyramid Principle") non-empty (NOT a second connector)';
  try {
    const resolver = require(RESOLVER_PATH);

    // The Pyramid Principle resolves to a non-empty command list -- this is HOW
    // DISC-10 dispatches the reasoning pyramid / Feynman surface, via the resolver
    // door, NOT a second registry entry (FIX 1).
    const pyramid = resolver.commandsForFramework('The Pyramid Principle');
    assert.ok(Array.isArray(pyramid) && pyramid.length > 0,
      label + ': commandsForFramework("The Pyramid Principle") must return a non-empty array (the DISC-10 dispatch door)');

    // The discover connector framework (JTBD) resolves the discover command itself
    // AND the FIX-3 route /mos:jtbd.
    const jtbd = resolver.commandsForFramework('Jobs to Be Done (JTBD)');
    assert.ok(Array.isArray(jtbd) && jtbd.includes('/mos:discover'),
      label + ': commandsForFramework("Jobs to Be Done (JTBD)") must include /mos:discover');
    assert.ok(jtbd.includes('/mos:jtbd'),
      label + ': commandsForFramework("Jobs to Be Done (JTBD)") must include /mos:jtbd (the FIX-3 route)');

    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('discover Part-8 boundary scan: ' + passed + ' passed, ' + failed + ' failed (5 checks over the single discover connector)\n');
process.exit(failed === 0 ? 0 : 1);
