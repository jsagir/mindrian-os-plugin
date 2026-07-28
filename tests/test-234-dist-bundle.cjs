#!/usr/bin/env node
'use strict';

/*
 * Phase 234-07 (D-01 / D-02) -- structural regression lock on the generated
 * foreign-host distribution bundles.
 *
 * WHAT THIS DEFENDS. scripts/build-dist-bundles.cjs writes two bundles with
 * DIFFERENT shapes on purpose: dist/generic-claude-dir/ keeps each skill's
 * subdirectories (the ~30+ hosts that read the `.claude/skills/` convention),
 * dist/zed/ must be FLAT because Zed's loader does not descend into a skill's
 * subdirectories. A refactor that accidentally collapses those two shapes into
 * one produces bundles that still LOOK fine (right file counts, right names) and
 * quietly break on one host family. So the difference itself is asserted, in
 * both directions, not just the counts.
 *
 * WHY IT MEASURES THE ARTIFACT, NOT THE GENERATOR'S SELF-REPORT. The Zed byte
 * budget is re-derived HERE, directly from dist/zed/.agents/skills/(*)/SKILL.md,
 * with its own gray-matter parse. It deliberately does NOT ask
 * build-dist-bundles.cjs what it thinks the number was. A generator that fails
 * partway through a run reports the number it INTENDED to ship while leaving a
 * different tree on disk, and re-trusting its self-report would confirm the
 * intention instead of the artifact. This is the one place in this phase where
 * duplicating the byte-counting logic is correct rather than a Canon Part 7
 * breach: the whole value of the check is that it is a second, independent
 * witness. It is then cross-checked THREE ways -- against the shipped tree,
 * against the source tree via check-skill-spec.cjs's catalogBudget(), and
 * against what dist/BUNDLE-VERSION.json claims.
 *
 * THE .mcp.json CASE IS HANDLED, NOT SKIPPED. dist/generic-claude-dir/.mcp.json
 * is generated but deliberately NOT committed (it bakes in a machine-specific
 * absolute install path; see .gitignore and dist/README.md). So on a fresh clone
 * it is legitimately absent. This test never silently passes over that: when the
 * file is present it is scanned for real, and when it is absent the test PROVES
 * the absence is by design by asking git whether the path is ignored. Either way
 * the in-memory contract is asserted against foreignMcpConfig() directly, so the
 * "no Claude-Code-only tokens" rule is enforced on every run regardless.
 *
 * SELF-TEST FIRST. The leak scanner is proved against a synthetic .mcp.json that
 * plants both forbidden tokens before it is trusted over the real file. A
 * scanner that quietly stopped matching is indistinguishable from a clean
 * artifact, which is the false-success shape this phase exists to close.
 *
 * Canon Part 8: local fs reads plus one local `git check-ignore`. Zero network
 * reach, zero fs write outside an mkdtemp scratch dir removed at the end.
 *
 * Run: node tests/test-234-dist-bundle.cjs
 * Exit: 0 when every check passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const matter = require('gray-matter');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const GENERIC_SKILLS = path.join(DIST_DIR, 'generic-claude-dir', '.claude', 'skills');
const GENERIC_MCP = path.join(DIST_DIR, 'generic-claude-dir', '.mcp.json');
const ZED_SKILLS = path.join(DIST_DIR, 'zed', '.agents', 'skills');
const ZED_OMITTED = path.join(DIST_DIR, 'zed', 'OMITTED-ASSETS.md');
const VERSION_STAMP = path.join(DIST_DIR, 'BUNDLE-VERSION.json');
const DIST_README = path.join(DIST_DIR, 'README.md');

// Source-tree measurement, from the ONE owner of that number.
const { catalogBudget, ZED_CATALOG_BUDGET_BYTES } = require('../scripts/check-skill-spec.cjs');
// The generated .mcp.json SHAPE, asserted even when the on-disk file is absent.
const { foreignMcpConfig } = require('../scripts/build-dist-bundles.cjs');

// The two tokens that must never survive into a foreign-host MCP config.
// ${CLAUDE_PLUGIN_ROOT}: no foreign host expands it, so it lands literally and
//   the server never starts.
// alwaysLoad: a Claude Code plugin manifest key, not part of any cross-host MCP
//   config convention.
const FOREIGN_FORBIDDEN = ['CLAUDE_PLUGIN_ROOT', 'alwaysLoad'];

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log('  ok   ' + label);
  } catch (e) {
    failures += 1;
    console.error('  FAIL ' + label);
    console.error('       ' + (e && e.message ? e.message : String(e)));
  }
}

function section(title) {
  console.log('');
  console.log('== ' + title + ' ==');
}

function dirNames(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// Directories found at any depth BELOW a skill's own directory.
function nestedDirsUnderSkills(root) {
  const out = [];
  for (const name of dirNames(root)) {
    const skillDir = path.join(root, name);
    for (const e of fs.readdirSync(skillDir, { withFileTypes: true })) {
      if (e.isDirectory()) out.push(name + '/' + e.name);
    }
  }
  return out.sort();
}

function scanForbidden(text) {
  return FOREIGN_FORBIDDEN.filter((tok) => String(text).includes(tok));
}

// ---------------------------------------------------------------------------
// 0. Self-test: the forbidden-token scanner actually bites.
// ---------------------------------------------------------------------------
section('Self-test: the leak scanner bites before it is trusted');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-234-07-'));
try {
  check('catches a ${CLAUDE_PLUGIN_ROOT} arg', () => {
    const probe = JSON.stringify({
      mcpServers: { 'mindrian-os': { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/bin/x.cjs'] } },
    });
    fs.writeFileSync(path.join(scratch, 'a.json'), probe);
    const hits = scanForbidden(fs.readFileSync(path.join(scratch, 'a.json'), 'utf8'));
    assert.deepEqual(hits, ['CLAUDE_PLUGIN_ROOT'], 'scanner is blind to the plugin-root token');
  });

  check('catches an alwaysLoad key', () => {
    const probe = JSON.stringify({ mcpServers: { 'mindrian-os': { command: 'node', alwaysLoad: true } } });
    fs.writeFileSync(path.join(scratch, 'b.json'), probe);
    const hits = scanForbidden(fs.readFileSync(path.join(scratch, 'b.json'), 'utf8'));
    assert.deepEqual(hits, ['alwaysLoad'], 'scanner is blind to the alwaysLoad key');
  });

  check('ignores a clean foreign config', () => {
    const probe = JSON.stringify({
      mcpServers: { 'mindrian-os': { command: 'node', args: ['/opt/mos/bin/x.cjs'], env: { MINDRIAN_OS_ROOT: '/opt/mos' } } },
    });
    fs.writeFileSync(path.join(scratch, 'c.json'), probe);
    assert.deepEqual(scanForbidden(fs.readFileSync(path.join(scratch, 'c.json'), 'utf8')), []);
  });

  // -------------------------------------------------------------------------
  // 1. Both bundles exist and carry the SAME catalog as the source tree.
  // -------------------------------------------------------------------------
  section('Bundle presence and catalog parity');

  const sourceSkills = dirNames(SKILLS_DIR).filter((n) =>
    fs.existsSync(path.join(SKILLS_DIR, n, 'SKILL.md'))
  );

  check('dist/generic-claude-dir/.claude/skills exists', () => {
    assert.ok(
      fs.existsSync(GENERIC_SKILLS),
      GENERIC_SKILLS + ' missing. Recovery: node scripts/build-dist-bundles.cjs'
    );
  });
  check('dist/zed/.agents/skills exists', () => {
    assert.ok(
      fs.existsSync(ZED_SKILLS),
      ZED_SKILLS + ' missing. Recovery: node scripts/build-dist-bundles.cjs'
    );
  });

  const genericSkills = dirNames(GENERIC_SKILLS);
  const zedSkills = dirNames(ZED_SKILLS);

  check('generic bundle carries every source skill, by NAME not just count', () => {
    assert.deepEqual(genericSkills, sourceSkills);
  });
  check('zed bundle carries every source skill, by NAME not just count', () => {
    assert.deepEqual(zedSkills, sourceSkills);
  });
  check('every bundled skill directory holds a SKILL.md', () => {
    const missing = [];
    for (const n of genericSkills) {
      if (!fs.existsSync(path.join(GENERIC_SKILLS, n, 'SKILL.md'))) missing.push('generic/' + n);
    }
    for (const n of zedSkills) {
      if (!fs.existsSync(path.join(ZED_SKILLS, n, 'SKILL.md'))) missing.push('zed/' + n);
    }
    assert.deepEqual(missing, []);
  });

  // -------------------------------------------------------------------------
  // 2. The two shapes genuinely DIFFER. Asserted both ways so a refactor that
  //    flattens (or nests) both cannot pass.
  // -------------------------------------------------------------------------
  section('Structural shape: zed is flat, generic is nested');

  check('zed bundle has ZERO directories below any skill directory', () => {
    // Stricter than the plan's `find -mindepth 3 -type d` wording, which under
    // GNU find would not catch a single nested level at all. One nested folder
    // is already a Zed loader break, so it is asserted at depth 1.
    assert.deepEqual(nestedDirsUnderSkills(ZED_SKILLS), []);
  });

  check('generic bundle DOES retain nested skill subdirectories', () => {
    const nested = nestedDirsUnderSkills(GENERIC_SKILLS);
    assert.ok(
      nested.length > 0,
      'the generic bundle lost every skill subdirectory, so both bundles are now flat and the ' +
        'progressive-disclosure content silently stopped shipping to the ~30+ .claude/skills hosts'
    );
  });

  check('every subdirectory zed dropped is recorded in OMITTED-ASSETS.md', () => {
    assert.ok(fs.existsSync(ZED_OMITTED), 'dist/zed/OMITTED-ASSETS.md missing');
    const manifest = fs.readFileSync(ZED_OMITTED, 'utf8');
    const unrecorded = [];
    for (const rel of nestedDirsUnderSkills(GENERIC_SKILLS)) {
      const [skill, subdir] = rel.split('/');
      if (!(manifest.includes('`' + skill + '`') && manifest.includes('`' + subdir + '/`'))) {
        unrecorded.push(rel);
      }
    }
    assert.deepEqual(unrecorded, [], 'content dropped from the zed bundle without being recorded');
  });

  check('bundled SKILL.md bodies are byte-identical to source (no hand-edit drift)', () => {
    const drifted = [];
    for (const n of sourceSkills) {
      const src = fs.readFileSync(path.join(SKILLS_DIR, n, 'SKILL.md'));
      if (!src.equals(fs.readFileSync(path.join(GENERIC_SKILLS, n, 'SKILL.md')))) drifted.push('generic/' + n);
      if (!src.equals(fs.readFileSync(path.join(ZED_SKILLS, n, 'SKILL.md')))) drifted.push('zed/' + n);
    }
    assert.deepEqual(drifted, [], 'dist/ is generated output and must never be hand-edited');
  });

  // -------------------------------------------------------------------------
  // 3. The foreign .mcp.json carries no Claude-Code-only token.
  // -------------------------------------------------------------------------
  section('Foreign-host .mcp.json: zero Claude-Code-only tokens');

  check('foreignMcpConfig() shape carries neither forbidden token', () => {
    const cfg = JSON.stringify(foreignMcpConfig('/opt/mindrian-os'), null, 2);
    assert.deepEqual(scanForbidden(cfg), []);
  });

  check('foreignMcpConfig() declares both servers with a literal path and MINDRIAN_OS_ROOT', () => {
    const cfg = foreignMcpConfig('/opt/mindrian-os');
    assert.deepEqual(Object.keys(cfg.mcpServers).sort(), ['mindrian-brain', 'mindrian-os']);
    for (const [name, server] of Object.entries(cfg.mcpServers)) {
      assert.equal(server.command, 'node', name + ': command must be node');
      assert.ok(server.args[0].startsWith('/opt/mindrian-os/'), name + ': args must be a literal absolute path');
      assert.equal(server.env.MINDRIAN_OS_ROOT, '/opt/mindrian-os', name + ': env.MINDRIAN_OS_ROOT must mirror the install root');
    }
  });

  check('foreignMcpConfig() carries a path and nothing key-shaped (T-234-13)', () => {
    // Canon Part 8 / threat T-234-13: the bundle multiplies config surface, so
    // the generated config must never become a place a credential lands. Any
    // key-shaped identifier appearing in it is a hard fail, not a warning.
    const cfg = JSON.stringify(foreignMcpConfig('/opt/mindrian-os'));
    const keyShaped = /(_KEY|_TOKEN|_SECRET|apiKey|api_key|password|Authorization)/i.exec(cfg);
    assert.equal(keyShaped, null, 'key-shaped identifier in the generated MCP config: ' + (keyShaped && keyShaped[0]));
  });

  check('the on-disk .mcp.json is either clean, or absent BY DESIGN (git-ignored)', () => {
    if (fs.existsSync(GENERIC_MCP)) {
      const raw = fs.readFileSync(GENERIC_MCP, 'utf8');
      assert.deepEqual(scanForbidden(raw), [], 'forbidden token leaked into ' + GENERIC_MCP);
      const parsed = JSON.parse(raw);
      assert.deepEqual(Object.keys(parsed.mcpServers).sort(), ['mindrian-brain', 'mindrian-os']);
      console.log('       (on-disk file present and scanned)');
      return;
    }
    // Absent. That is expected on a fresh clone, but only because the path is
    // deliberately git-ignored. Prove that rather than assuming it, so a
    // generator that simply failed to write the file cannot hide here.
    let ignored = false;
    try {
      execFileSync('git', ['check-ignore', '-q', path.relative(REPO_ROOT, GENERIC_MCP)], { cwd: REPO_ROOT });
      ignored = true;
    } catch (_e) {
      ignored = false;
    }
    assert.ok(
      ignored,
      GENERIC_MCP + ' is absent AND not git-ignored, so the generator did not write it. ' +
        'Recovery: node scripts/build-dist-bundles.cjs'
    );
    console.log('       (absent by design: git-ignored, machine-specific install path)');
  });

  // -------------------------------------------------------------------------
  // 4. Version stamp.
  // -------------------------------------------------------------------------
  section('dist/BUNDLE-VERSION.json staleness stamp');

  let stamp = null;
  check('exists and parses as JSON with all four required keys', () => {
    assert.ok(fs.existsSync(VERSION_STAMP), VERSION_STAMP + ' missing');
    stamp = JSON.parse(fs.readFileSync(VERSION_STAMP, 'utf8'));
    assert.deepEqual(
      Object.keys(stamp).sort(),
      ['catalog_bytes', 'generated_at', 'skill_count', 'source_version']
    );
    assert.equal(typeof stamp.source_version, 'string');
    assert.ok(stamp.source_version.length > 0, 'source_version must not be empty');
    assert.ok(!Number.isNaN(Date.parse(stamp.generated_at)), 'generated_at must be a parseable timestamp');
    assert.equal(typeof stamp.skill_count, 'number');
    assert.equal(typeof stamp.catalog_bytes, 'number');
  });

  check('skill_count matches what actually shipped in both bundles', () => {
    assert.equal(stamp.skill_count, genericSkills.length);
    assert.equal(stamp.skill_count, zedSkills.length);
  });

  // -------------------------------------------------------------------------
  // 5. Budget, re-measured from the SHIPPED artifact.
  // -------------------------------------------------------------------------
  section('Zed 50KB catalog budget, measured from dist/ not from the generator');

  let shippedBytes = 0;
  check('the shipped zed catalog is under the 50KB budget', () => {
    for (const n of zedSkills) {
      const fm = matter(fs.readFileSync(path.join(ZED_SKILLS, n, 'SKILL.md'), 'utf8')).data || {};
      shippedBytes += Buffer.byteLength(String(fm.name || '') + String(fm.description || ''), 'utf8');
    }
    assert.ok(
      shippedBytes < ZED_CATALOG_BUDGET_BYTES,
      'shipped zed catalog is ' + shippedBytes + ' bytes, over the ' + ZED_CATALOG_BUDGET_BYTES +
        ' byte budget; Zed drops the overflow with only a UI warning'
    );
    console.log('       ' + shippedBytes + ' / ' + ZED_CATALOG_BUDGET_BYTES + ' bytes');
  });

  check('the shipped measurement matches the SOURCE-tree measurement exactly', () => {
    assert.equal(
      shippedBytes,
      catalogBudget().totalBytes,
      'the shipped bundle and the source tree disagree on the catalog size, which means the ' +
        'generator wrote a tree that does not match what it measured'
    );
  });

  check('the shipped measurement matches what BUNDLE-VERSION.json claims', () => {
    assert.equal(shippedBytes, stamp.catalog_bytes);
  });

  // -------------------------------------------------------------------------
  // 6. The update story is actually shipped with the bundle.
  // -------------------------------------------------------------------------
  section('dist/README.md states the update story plainly');

  check('exists and says there is no auto-update mechanism', () => {
    assert.ok(fs.existsSync(DIST_README), 'dist/README.md missing');
    const readme = fs.readFileSync(DIST_README, 'utf8');
    assert.ok(
      /no auto-update mechanism/i.test(readme),
      'dist/README.md must state plainly that there is no auto-update mechanism (RESEARCH Open Question 3)'
    );
    assert.ok(
      readme.includes('--check-stale'),
      'dist/README.md must name the staleness check users run instead'
    );
  });

  check('no em-dash anywhere in the generated bundle docs (house rule)', () => {
    const offenders = [DIST_README, ZED_OMITTED].filter((f) => fs.readFileSync(f, 'utf8').includes('—'));
    assert.deepEqual(offenders, []);
  });
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

console.log('');
if (failures) {
  console.error('test-234-dist-bundle: FAILED (' + failures + ' check(s))');
  process.exit(1);
}
console.log('test-234-dist-bundle: OK');
