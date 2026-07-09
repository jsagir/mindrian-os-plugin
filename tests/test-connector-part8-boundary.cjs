'use strict';
/*
 * Phase 143.3-04 Task 1 -- the Canon Part 8 boundary scan over the connector spine.
 *
 * Mirrors tests/test-sensors-part8-sweep.cjs (the forbidden-substring sweep) and
 * tests/test-decide-part8-invariant.cjs (the per-invariant Part-8 assertion idiom),
 * generalized to the connector spine artifacts shipped in Plans 01/02/03.
 *
 * The scan asserts the FOUR threat-model paths from the 143.3 CONTEXT threat_model
 * are CLOSED. Any breach is HIGH severity (a user-content-to-Brain path) and the
 * test exits non-zero:
 *
 *   (1) GENERATOR BRAIN LOCALITY -- scripts/build-connector-registry.cjs has NO
 *       top-level require of brain-client; brain-client may appear ONLY inside the
 *       --refresh-names branch (the require sits below the refreshNames guard,
 *       mirroring build-command-registry.cjs). The generator and --check never load
 *       it.
 *
 *   (2) REGISTRY + MAP GENERIC-HANDLES-ONLY -- data/connector-registry.json and
 *       data/dispatch-framework-map.json carry ONLY the schema fields + enums; no
 *       entry carries a free-text body/summary/content field that could smuggle
 *       user content; every framework value is a generic name present in
 *       data/framework-names.json and every web_scope is null or a frozen hat enum.
 *
 *   (3) ORCHESTRATOR NO-USER-CONTENT DOCTRINE -- skills/intelligence-orchestrator/
 *       SKILL.md forbids turn text / artifact bodies into commandsForFramework or a
 *       Brain packet (generic handles only / never user content / never turn text);
 *       FAIL if the forbidding statement is absent.
 *
 *   (4) HAT-SCOPED WEB -- the orchestrator never specifies an unscoped WebSearch;
 *       the doctrine ties web to hatScopeFor (Part 2), Red hat = no web.
 *
 * Prints per-check PASS/FAIL. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const GENERATOR_PATH = path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'connector-registry.json');
const DISPATCH_MAP_PATH = path.join(REPO_ROOT, 'data', 'dispatch-framework-map.json');
const FRAMEWORK_NAMES_PATH = path.join(REPO_ROOT, 'data', 'framework-names.json');
const ORCH_SKILL_PATH = path.join(REPO_ROOT, 'skills', 'intelligence-orchestrator', 'SKILL.md');

// The frozen web_scope enum: null (no web) or one of the de Bono hat colors that
// hatScopeFor keys on. The connector spine must never carry an off-enum web_scope.
const FROZEN_WEB_SCOPES = new Set([null, 'white', 'red', 'black', 'yellow', 'green', 'blue']);

// Schema fields a connector entry is ALLOWED to carry (the generated registry
// shape). A free-text body channel (summary/content/body/text/note/...) outside
// this set is a Part-8 smuggling surface.
//
// Phase 198-04 (SPEC-2, Task 1) additive extension: hitl_shape (a member of
// the CLOSED F.0-F.9/none vocabulary, data/hitl-shape-declaration-schema.json)
// and hitl_why (a short, DEVELOPER-authored rationale sentence baked into the
// static lib/mcp/tools/*.cjs source at commit time -- never populated from
// live user/room data, exactly like the pre-existing developer-authored
// `filing` / `decision_surface` fields already in this allowlist) are the two
// additive keys source:'mcp_tool' connector entries carry. Neither can smuggle
// user content: hitl_shape is closed-enum, and hitl_why is generated ONLY by
// scripts/build-connector-registry.cjs's static require() of the tool
// module's own connectors export -- there is no code path from a live room.db
// read to either field.
const ALLOWED_CONNECTOR_FIELDS = new Set([
  'surface', 'source', 'connects_to_spine', 'sensor_triggers', 'reach_id',
  'sub_mode', 'framework', 'posture', 'hierarchy_rank', 'filing', 'plan_gated',
  'web_scope', 'decision_surface', 'hitl_shape', 'hitl_why',
]);

// Free-text-shaped field names that must NEVER appear on a connector entry.
const FORBIDDEN_BODY_FIELDS = ['summary', 'content', 'body', 'text', 'note', 'description', 'evidence', 'turn'];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// CHECK 1 -- generator Brain locality (brain-client only inside refresh-names)
// ---------------------------------------------------------------------------
(function check1_generatorBrainLocality() {
  const label = 'CHECK 1 - generator brain-client locality (refresh-names branch only)';
  try {
    const src = fs.readFileSync(GENERATOR_PATH, 'utf8');

    // Find every brain-client require call site by line.
    const lines = src.split('\n');
    const requireRx = /require\s*\(\s*[^)]*brain-client[^)]*\)/;
    const requireLines = [];
    lines.forEach((ln, i) => { if (requireRx.test(ln)) requireLines.push(i); });

    assert.ok(requireLines.length >= 1,
      label + ': expected at least one brain-client require inside the refresh-names branch');

    // The refreshNames function is the only sanctioned Brain touch. Locate its
    // declaration; every brain-client require MUST sit at or below it.
    const refreshDeclRx = /(?:async\s+)?function\s+refreshNames\b/;
    let refreshDeclLine = -1;
    lines.forEach((ln, i) => { if (refreshDeclLine === -1 && refreshDeclRx.test(ln)) refreshDeclLine = i; });
    assert.ok(refreshDeclLine !== -1,
      label + ': could not locate the refreshNames() declaration that guards the Brain touch');

    for (const reqLine of requireLines) {
      assert.ok(reqLine > refreshDeclLine,
        label + ': a brain-client require at line ' + (reqLine + 1) +
          ' sits ABOVE refreshNames() (line ' + (refreshDeclLine + 1) +
          ') - the Brain touch must be local to the refresh-names branch');
    }

    // Belt-and-suspenders: no top-level require block (the first ~80 lines, before
    // any function bodies) may pull brain-client.
    const headerEnd = Math.min(refreshDeclLine, lines.length);
    const header = lines.slice(0, headerEnd).join('\n');
    assert.equal(requireRx.test(header), false,
      label + ': brain-client must NOT be required in the top-level header (before refreshNames)');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 2 -- registry + dispatch map carry ONLY generic handles + enums
// ---------------------------------------------------------------------------
(function check2_genericHandlesOnly() {
  const label = 'CHECK 2 - registry + dispatch-map generic-handles-only (no free-text body, framework + web_scope enums)';
  try {
    const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const dispatchMap = JSON.parse(fs.readFileSync(DISPATCH_MAP_PATH, 'utf8'));
    const fwSnapshot = JSON.parse(fs.readFileSync(FRAMEWORK_NAMES_PATH, 'utf8'));

    // The generic-framework allowlist: read the EXPLICIT keys (framework_names +
    // curated_extras), NOT Object.values().flat() (the catch-all hole the drift
    // test closes).
    const allowedFrameworks = new Set([
      ...(Array.isArray(fwSnapshot.framework_names) ? fwSnapshot.framework_names : []),
      ...(Array.isArray(fwSnapshot.curated_extras) ? fwSnapshot.curated_extras : []),
    ]);
    assert.ok(allowedFrameworks.size > 0,
      label + ': framework-names snapshot must expose a non-empty framework_names + curated_extras allowlist');

    const connectors = Array.isArray(reg.connectors) ? reg.connectors : [];
    assert.ok(connectors.length >= 1,
      label + ': the registry must carry at least one connector to scan (Plan 02 populated 7)');

    for (const c of connectors) {
      const surfaceId = c.surface || JSON.stringify(c);

      // (a) NO field outside the allowed schema set, and NO free-text body field.
      for (const key of Object.keys(c)) {
        assert.ok(ALLOWED_CONNECTOR_FIELDS.has(key),
          label + ': connector ' + surfaceId + ' carries off-schema field "' + key +
            '" - a Part-8 smuggling surface');
        assert.equal(FORBIDDEN_BODY_FIELDS.includes(key), false,
          label + ': connector ' + surfaceId + ' carries forbidden free-text body field "' + key + '"');
      }

      // (b) framework is a GENERIC name present in the allowlist (never a slug,
      //     never user content). EXEMPTION: framework === null is the legal
      //     WFL-01 no-framework config -- a connector that fires no command on
      //     APPROVE (filing: none, no decision surface) carries framework: null
      //     and the validateConnectors WFL-01 guard already exempts it (it never
      //     calls commandsForFramework on a non-firing connector). A null
      //     framework is the ABSENCE of a framework handle, not a smuggled body;
      //     it cannot carry user content. Only a NON-NULL framework must be a
      //     generic name in the allowlist. (DI-144.1-A: this exemption lets the
      //     legitimately-null connectors -- /mos:funding, agent:brain-query,
      //     agent:investor, agent:opportunity-scanner -- pass while still failing
      //     a non-null framework that is a slug or smuggled string.)
      if (c.framework !== null) {
        assert.ok(allowedFrameworks.has(c.framework),
          label + ': connector ' + surfaceId + ' framework "' + c.framework +
            '" is not a generic name in framework-names.json (slug or smuggled content?)');
      }

      // (c) web_scope is null or a frozen hat enum.
      assert.ok(FROZEN_WEB_SCOPES.has(c.web_scope),
        label + ': connector ' + surfaceId + ' web_scope "' + String(c.web_scope) +
          '" is not null and not a frozen hat enum');
    }

    // (d) every dispatch-map VALUE (the translation target) is a generic framework
    //     name in the allowlist; no value is a slug (mos:* / contains a slash).
    for (const [handle, fwName] of Object.entries(dispatchMap)) {
      if (handle.startsWith('_')) continue; // _note metadata
      assert.ok(allowedFrameworks.has(fwName),
        label + ': dispatch-map handle "' + handle + '" maps to "' + fwName +
          '" which is not a generic framework name in framework-names.json');
      assert.equal(/^mos:|\//.test(fwName), false,
        label + ': dispatch-map value "' + fwName + '" looks like a slug, not a framework name');
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 3 -- orchestrator doctrine forbids user content / turn text to resolver+Brain
// ---------------------------------------------------------------------------
(function check3_orchestratorNoUserContent() {
  const label = 'CHECK 3 - intelligence-orchestrator doctrine forbids turn text / artifact bodies to commandsForFramework + Brain';
  try {
    const src = fs.readFileSync(ORCH_SKILL_PATH, 'utf8');
    const lc = src.toLowerCase();

    // The doctrine MUST state the no-user-content rule for the resolver/Brain path.
    // Accept any of the canonical forbidding phrasings (generic handles only /
    // never user content / never turn text), but require the negative for both
    // turn text and artifact bodies.
    assert.ok(lc.includes('generic') && lc.includes('handle'),
      label + ': doctrine must state Brain queries carry only generic handles');
    assert.ok(lc.includes('never user content') || lc.includes('never turn text'),
      label + ': doctrine must explicitly forbid user content / turn text crossing the boundary');
    assert.ok(lc.includes('turn text') && lc.includes('artifact bod'),
      label + ': doctrine must name both turn text and artifact bodies as forbidden across the boundary');
    assert.ok(lc.includes('commandsforframework'),
      label + ': doctrine must name commandsForFramework as a generic-handle-only channel');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 4 -- hat-scoped web (no unscoped WebSearch; web tied to hatScopeFor)
// ---------------------------------------------------------------------------
(function check4_hatScopedWeb() {
  const label = 'CHECK 4 - hat-scoped web (orchestrator ties web to hatScopeFor; Red hat = no web; no unscoped WebSearch)';
  try {
    const src = fs.readFileSync(ORCH_SKILL_PATH, 'utf8');
    const lc = src.toLowerCase();

    assert.ok(lc.includes('hatscopefor'),
      label + ': doctrine must tie web to hatScopeFor (Part 2)');
    assert.ok(lc.includes('hat-scoped'),
      label + ': doctrine must state web is hat-scoped');
    assert.ok(lc.includes('red hat') && (lc.includes('no web') || lc.includes('web_enabled: false')),
      label + ': doctrine must state the Red hat returns no web (web_enabled: false)');

    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('connector Part-8 boundary scan: ' + passed + ' passed, ' + failed + ' failed (4 threat paths)\n');
process.exit(failed === 0 ? 0 : 1);
