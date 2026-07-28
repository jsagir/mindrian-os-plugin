'use strict';
/*
 * Phase 235-02 Task 3 -- the CIRS-02 mutation-proof test.
 *
 * What was broken: MCP tool files sat entirely outside CIRS's wired-XOR-excluded
 * invariant. coverageReport() (the R9 gap hard-fail's source of truth, consumed
 * by --check AND the pre-commit hook) walked only commands/skills/agents. The
 * separate listMcpToolConnectorDescriptors() path swallowed a require() failure
 * with `catch { continue }` and returned an empty array for a file missing its
 * `connectors` export. A tool file that threw at load, or forgot the export, was
 * born INVISIBLE to the born-wired gate and the gate stayed green.
 *
 * Three assertion groups, each closing a different way the fix could rot:
 *
 *   (1) The probe classifies the three real file shapes correctly, driven
 *       against a temp fixture dir via listMcpToolFileHealth()'s optional
 *       claimed-sources override. No real-repo pollution: lib/mcp/tools/ is
 *       never written to.
 *   (2) BEHAVIORAL: the real coverageReport() MCP surface count equals the real
 *       listMcpToolClaimedSources() count exactly. This is a SELF-UPDATING
 *       census, not a frozen literal -- add a tool file tomorrow and both sides
 *       move together. If a future edit reverts coverageReport() to skip the
 *       MCP walk, this count drops to 0 while the claimed count stays put, and
 *       the mismatch is caught.
 *   (3) TEXTUAL: the shipped source of build-connector-registry.cjs actually
 *       contains the checkClaimedModuleLiveness invocation (the wiring-proof
 *       idiom from tests/test-skill-mirrors-tripwire.cjs). Paired with (2) so
 *       the test fails whether the call is DELETED or merely present-but-bypassed
 *       (its result ignored).
 *
 * Mutation-verified live during Task 3: commenting out the
 * checkClaimedModuleLiveness call inside coverageReport() turns groups (2) and
 * (3) red. See 235-02-SUMMARY.md for the recorded red output.
 *
 * House rule: hyphens only, no em-dashes. Pure-local, zero Brain/network.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs');
const gen = require(GENERATOR);

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

// ---------------------------------------------------------------------------
// (1) Seeded fixtures: healthy / dead / throws, via the optional override.
// ---------------------------------------------------------------------------
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-mcp-235-'));
  const healthyPath = path.join(dir, 'healthy.cjs');
  const deadPath = path.join(dir, 'dead.cjs');
  const throwsPath = path.join(dir, 'throws.cjs');

  fs.writeFileSync(
    healthyPath,
    "'use strict';\nmodule.exports = { connectors: [{ tool: 'x', hitl_shape: 'none', hitl_why: 'test' }] };\n"
  );
  // No `connectors` key at all: the "forgot to export connectors" shape.
  fs.writeFileSync(deadPath, "'use strict';\nmodule.exports = {};\n");
  // Throws at the top level, before any module.exports: the require()-failure shape.
  fs.writeFileSync(throwsPath, "'use strict';\nthrow new Error('boom');\n");

  const health = gen.listMcpToolFileHealth([
    { id: 'healthy.cjs', path: healthyPath, exportKey: 'connectors' },
    { id: 'dead.cjs', path: deadPath, exportKey: 'connectors' },
    { id: 'throws.cjs', path: throwsPath, exportKey: 'connectors' },
  ]);
  const byId = new Map(health.map((h) => [h.id, h]));

  assert(health.length === 3, '(1) the override is honored: 3 synthetic sources probed, not the real tree');
  assert(
    byId.get('healthy.cjs') && byId.get('healthy.cjs').live === true,
    '(1) healthy.cjs (exports a non-empty connectors array) -> live:true'
  );
  assert(
    byId.get('dead.cjs') && byId.get('dead.cjs').live === false,
    '(1) dead.cjs (no connectors export at all) -> live:false, no longer swallowed'
  );
  const t = byId.get('throws.cjs');
  assert(
    t && t.live === false && typeof t.loadError === 'string' && t.loadError.indexOf('boom') !== -1,
    '(1) throws.cjs (require() failure) -> live:false with the real load error reported'
  );

  // The shared helper agrees: exactly the two bad ones are dead.
  const seam = require(path.join(REPO_ROOT, 'lib', 'core', 'seam-liveness.cjs'));
  const verdict = seam.checkClaimedModuleLiveness(
    health.map((h) => ({ id: h.id, live: h.live, reason: h.loadError || 'export missing or empty' }))
  );
  assert(
    verdict.ok === false &&
      verdict.dead.length === 2 &&
      verdict.dead.indexOf('dead.cjs') !== -1 &&
      verdict.dead.indexOf('throws.cjs') !== -1,
    '(1) checkClaimedModuleLiveness names exactly dead.cjs + throws.cjs as the dead seam'
  );

  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_e) {
    /* best effort cleanup */
  }
}

// ---------------------------------------------------------------------------
// (2) The integration is genuinely wired: the self-updating census.
// ---------------------------------------------------------------------------
{
  const report = gen.coverageReport();
  const mcpSurfaces = report.surfaces.filter((s) => s.source === 'mcp_tool');
  const claimed = gen.listMcpToolClaimedSources();

  assert(
    mcpSurfaces.length > 0,
    '(2) coverageReport() reports at least one mcp_tool surface (' + mcpSurfaces.length + ')'
  );
  assert(
    mcpSurfaces.length === claimed.length,
    '(2) coverageReport() mcp_tool surface count === listMcpToolClaimedSources() count (' +
      mcpSurfaces.length + ' === ' + claimed.length + ')'
  );

  const claimedIds = new Set(claimed.map((c) => c.id));
  assert(
    mcpSurfaces.every((s) => claimedIds.has(s.surface.replace(/^mcp_tool_file:/, ''))),
    '(2) every mcp_tool surface name maps back to a real claimed source id'
  );
  assert(
    mcpSurfaces.every((s) => s.class === gen.CLASS_MCP_TOOL) &&
      gen.SURFACE_CLASS_ENUM.indexOf(gen.CLASS_MCP_TOOL) !== -1,
    '(2) every mcp_tool surface carries the additive mcp_tool class, a member of SURFACE_CLASS_ENUM'
  );
  assert(
    mcpSurfaces.every((s) => s.state === 'wired' || s.state === 'gap'),
    '(2) every mcp_tool surface lands in exactly one of wired / gap (the XOR partition)'
  );
  assert(
    report.surfaces.length ===
      gen.listSourceFiles().length + claimed.length,
    '(2) the full census === command+skill+agent files + claimed MCP tool files'
  );
}

// ---------------------------------------------------------------------------
// (3) The seam-liveness call specifically is the load-bearing one.
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync(GENERATOR, 'utf8');
  assert(
    src.indexOf('checkClaimedModuleLiveness') !== -1,
    '(3) build-connector-registry.cjs source invokes checkClaimedModuleLiveness (wiring proof)'
  );
  assert(
    src.indexOf("require(path.join(REPO_ROOT, 'lib', 'core', 'seam-liveness.cjs'))") !== -1,
    '(3) build-connector-registry.cjs requires the SHARED lib/core/seam-liveness.cjs helper'
  );
  // The call must live inside coverageReport(), not merely somewhere in the file.
  const covStart = src.indexOf('function coverageReport()');
  const covEnd = src.indexOf('function serializeLedger(');
  assert(
    covStart !== -1 &&
      covEnd > covStart &&
      src.slice(covStart, covEnd).indexOf('checkClaimedModuleLiveness') !== -1,
    '(3) the checkClaimedModuleLiveness call sits INSIDE coverageReport(), the R9 gate source of truth'
  );
}

console.log('');
if (failures > 0) {
  console.error('test-235-seam-liveness-mcp-coverage: ' + failures + ' FAILURE(S)');
} else {
  console.log('test-235-seam-liveness-mcp-coverage: PASS (3 groups: fixtures, census, wiring)');
}
process.exit(failures > 0 ? 1 : 0);
