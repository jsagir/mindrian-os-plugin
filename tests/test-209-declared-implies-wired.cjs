'use strict';
// Phase 209-03 (B2 + B3) -- declared-implies-wired gate proof.
//
// B2: three new predicates in scripts/check-shape-declaration.cjs (wired-body,
// tool-grant, declared-matches-body), scoped to the 'command' surface class
// (matching the B1 stamp's exact wiring domain). B3: the render-coverage
// build+check pair extended to a commands/*.md keyspace, fail-closed.
//
// Behaviors 1-5 (B2, in-memory fixtures, never touching live commands/).
// Behaviors 6-9 (B3, fixture-dir based + one live-tree shell-out).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const shapeGate = require(path.join(REPO, 'scripts', 'check-shape-declaration.cjs'));
const { STAMP_MARKER } = require(path.join(REPO, 'scripts', 'stamp-firing-block.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-209-declared-implies-wired');

// ---------------------------------------------------------------------------
// B2 behaviors (1-5)
// ---------------------------------------------------------------------------

ok('Behavior 1: a fixture with neither the firing block nor AskUserQuestion violates', function () {
  const fixture = {
    surface: 'commands/unwired.md',
    hitl_shape: 'F.1',
    hitl_why: 'test',
    body_has_firing_block: false,
    body_mentions_tool: false,
  };
  const r = shapeGate.check(fixture, { vocab: shapeGate.loadSchema() });
  assert.equal(r.valid, false);
  assert.equal(r.violations.some((v) => v.indexOf('neither carries the canonical firing block') !== -1), true);
});

ok('Behavior 2: a restrictive allowed-tools list lacking the grant violates; an absent key passes', function () {
  const vocab = shapeGate.loadSchema();
  const restrictive = {
    surface: 'commands/restrictive.md',
    hitl_shape: 'F.1',
    hitl_why: 'test',
    body_has_firing_block: true,
    body_mentions_tool: true,
    allowed_tools: ['Read', 'Bash'],
  };
  const rRestrictive = shapeGate.check(restrictive, { vocab });
  assert.equal(rRestrictive.valid, false);
  assert.equal(rRestrictive.violations.some((v) => v.indexOf('does not grant AskUserQuestion') !== -1), true);

  const absent = {
    surface: 'commands/absent.md',
    hitl_shape: 'F.1',
    hitl_why: 'test',
    body_has_firing_block: true,
    body_mentions_tool: true,
    allowed_tools: null,
  };
  const rAbsent = shapeGate.check(absent, { vocab });
  assert.equal(rAbsent.valid, true, 'absent allowed-tools key must PASS (unrestricted)');
});

ok('Behavior 3: a declared shape contradicting the Part-3-cited body shape violates; matching passes; no mention passes', function () {
  const vocab = shapeGate.loadSchema();
  const contradiction = {
    surface: 'commands/contradiction.md',
    hitl_shape: 'F.2',
    hitl_why: 'test',
    body_has_firing_block: true,
    body_mentions_tool: true,
    body_shape_mentions: ['F.1'],
  };
  const rContradiction = shapeGate.check(contradiction, { vocab });
  assert.equal(rContradiction.valid, false);
  assert.equal(rContradiction.violations.some((v) => v.indexOf('shape contradiction') !== -1), true);

  const matching = { ...contradiction, hitl_shape: 'F.1', body_shape_mentions: ['F.1'] };
  const rMatching = shapeGate.check(matching, { vocab });
  assert.equal(rMatching.valid, true);

  const noMention = { ...contradiction, body_shape_mentions: [] };
  const rNoMention = shapeGate.check(noMention, { vocab });
  assert.equal(rNoMention.valid, true);
});

ok('Behavior 4: the exclusion escape hatch exempts all three predicates; an empty reason still fails', function () {
  const vocab = shapeGate.loadSchema();
  const exempt = {
    surface: 'commands/exempt.md',
    hitl_shape: 'F.2',
    hitl_why: 'test',
    body_has_firing_block: false,
    body_mentions_tool: false,
    allowed_tools: ['Read'],
    body_shape_mentions: ['F.1'],
    connector_excluded: true,
    connector_reason: 'A deliberate exemption for this test.',
  };
  const rExempt = shapeGate.check(exempt, { vocab });
  assert.equal(rExempt.valid, true, 'excluded:true + a reason must exempt all three new predicates');

  const emptyReason = { ...exempt, connector_reason: '' };
  const rEmptyReason = shapeGate.check(emptyReason, { vocab });
  assert.equal(rEmptyReason.valid, false, 'excluded:true with an EMPTY reason must still fail');
});

ok('Behavior 5: the live commands/ tree passes the extended checker post-futures.md reconcile', function () {
  const result = shapeGate.checkTree();
  assert.equal(result.ok, true, 'live tree violations: ' + JSON.stringify(result.violations));
});

// ---------------------------------------------------------------------------
// B2 side: STAMP_MARKER single-definition-site proof (T-209-10)
// ---------------------------------------------------------------------------

ok('STAMP_MARKER is imported from stamp-firing-block.cjs, not a second literal', function () {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'check-shape-declaration.cjs'), 'utf8');
  assert.equal(src.indexOf("require('./stamp-firing-block.cjs')") !== -1, true);
  // The literal marker text itself should appear only inside a violation
  // message template (interpolating the imported constant), never as a
  // second hard-coded '<!-- mos:firing-block' definition.
  const literalDefRe = /const\s+STAMP_MARKER\s*=\s*['"]/;
  assert.equal(literalDefRe.test(src), false, 'check-shape-declaration.cjs must not redefine STAMP_MARKER');
  assert.equal(typeof STAMP_MARKER, 'string');
  assert.equal(STAMP_MARKER.length > 0, true);
});

// ---------------------------------------------------------------------------
// B3 behaviors (6-9) -- fixture-dir based, never mutating live commands/
// ---------------------------------------------------------------------------

function writeFixtureTree(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-render-coverage-md-'));
  fs.mkdirSync(path.join(tmpDir, 'commands'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmpDir, 'commands', name), content);
  }
  return tmpDir;
}

const buildCoverage = require(path.join(REPO, 'scripts', 'build-render-coverage.cjs'));
const checkCoverage = require(path.join(REPO, 'scripts', 'check-render-coverage.cjs'));

ok('Behavior 6: build enumerates every declaring command as { surface, declared_shape, wired }; .cjs entries unchanged', function () {
  const registryBefore = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'render-coverage-registry.json'), 'utf8'));
  const cjsEntriesBefore = registryBefore.entries.filter((e) => String(e.surface || '').endsWith('.cjs'));

  const tmpDir = writeFixtureTree({
    'wired.md': '---\nname: wired\nhitl_shape: "F.1"\n---\n\n' + STAMP_MARKER + '\nBody.\n',
    'unwired.md': '---\nname: unwired\nhitl_shape: "F.1"\n---\n\nBody.\n',
  });
  const mdEntries = buildCoverage.buildMdKeyspace({ rootDir: tmpDir });
  assert.equal(mdEntries.length, 2);
  const wired = mdEntries.find((e) => e.surface.indexOf('wired.md') !== -1 && e.surface.indexOf('unwired') === -1);
  const unwired = mdEntries.find((e) => e.surface.indexOf('unwired.md') !== -1);
  assert.equal(wired.wired, true);
  assert.equal(unwired.wired, false);
  assert.equal(wired.declared_shape, 'F.1');

  // Regenerating on the live tree must leave .cjs entries byte-stable.
  const liveEntries = buildCoverage.buildRegistry();
  const cjsEntriesAfter = liveEntries.entries.filter((e) => String(e.surface || '').endsWith('.cjs'));
  assert.deepStrictEqual(cjsEntriesAfter, cjsEntriesBefore);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

ok('Behavior 7: check fails closed on a wired:false entry; excluded+reason passes; excluded without a reason fails', function () {
  const failing = checkCoverage.checkMdEntries([
    { surface: 'commands/unwired.md', declared_shape: 'F.1', wired: false },
  ]);
  assert.equal(failing.ok, false);
  assert.equal(failing.violations.some((v) => v.indexOf('commands/unwired.md') !== -1), true);

  const exempted = checkCoverage.checkMdEntries([
    { surface: 'commands/exempt.md', declared_shape: 'F.1', wired: false, excluded: true, reason: 'Deliberate exemption.' },
  ]);
  assert.equal(exempted.ok, true);

  const badExempt = checkCoverage.checkMdEntries([
    { surface: 'commands/bad-exempt.md', declared_shape: 'F.1', wired: false, excluded: true, reason: '' },
  ]);
  assert.equal(badExempt.ok, false);
});

ok('Behavior 8 (adversarial, fail-closed proof): a synthesized unwired command with a restrictive tool list fails the check', function () {
  const tmpDir = writeFixtureTree({
    'adversarial.md':
      '---\nname: adversarial\nhitl_shape: "F.1"\nallowed-tools:\n  - Read\n---\n\nNo firing block, no AskUserQuestion mention.\n',
  });
  const mdEntries = buildCoverage.buildMdKeyspace({ rootDir: tmpDir });
  assert.equal(mdEntries.length, 1);
  assert.equal(mdEntries[0].wired, false);
  const result = checkCoverage.checkMdEntries(mdEntries);
  assert.equal(result.ok, false);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

ok('Behavior 9 (green on live): build + check exit 0 on the real B1-stamped tree', function () {
  execFileSync('node', ['scripts/build-render-coverage.cjs'], { cwd: REPO, stdio: 'pipe' });
  execFileSync('node', ['scripts/check-render-coverage.cjs'], { cwd: REPO, stdio: 'pipe' });
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'render-coverage-registry.json'), 'utf8'));
  const mdEntries = registry.entries.filter((e) => String(e.surface || '').endsWith('.md'));
  assert.equal(mdEntries.length >= 90, true, 'expected >= 90 declaring .md entries, got ' + mdEntries.length);
  const unwired = mdEntries.filter((e) => e.declared_shape && !e.wired && !e.excluded);
  assert.deepStrictEqual(unwired, [], '0 unwired declared .md entries expected on the live tree');
});

console.log('\nPASS test-209-declared-implies-wired (' + n + ' assertions)');
