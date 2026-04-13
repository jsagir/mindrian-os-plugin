#!/usr/bin/env node
'use strict';

/**
 * Phase 81-02: Integration test for vault-section-minto-generator.cjs
 * exercising the full --plan + --write pipeline against three fixture
 * rooms (fixture-small, fixture-medium, fixture-large) using pre-recorded
 * narrative JSONs committed to test-fixtures/feynman/narratives/.
 *
 * No live Claude calls. The narratives ARE the Claude-produced output,
 * frozen in git so the assembly half of the pipeline can be tested
 * deterministically.
 *
 * Assertions per fixture:
 *   1. --plan output parses as JSON and has required keys
 *   2. --write with frozen narrative produces a MINTO.md
 *   3. MINTO.md contains every required Feynman-MINTO block
 *   4. Total char length under 15000 (conservative proxy for 1500 tokens)
 *   5. Zero em-dash / en-dash code points in output
 *   6. No literal {section_name} or {artifacts} placeholder leakage
 *   7. Determinism: two consecutive --write runs produce byte-identical
 *      output under MINTO_FROZEN_DATE=2026-04-14
 *
 * Extra assertion (global): the four Feynman prompt constants inlined
 * in commands/mos-reason.md equal the exports from lib/memory/feynman-
 * prompts.cjs byte-for-byte. This is a second layer of drift guarding
 * alongside lib/memory/feynman-prompts-drift.test.cjs.
 *
 * Run via:
 *   MINTO_FROZEN_DATE=2026-04-14 node scripts/vault-section-minto-generator.integration.test.cjs
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(
  REPO_ROOT,
  'scripts',
  'vault-section-minto-generator.cjs'
);
const MOS_REASON = path.join(REPO_ROOT, 'commands', 'mos-reason.md');
const prompts = require(path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts.cjs'));

const FIXTURES = [
  {
    name: 'fixture-small',
    roomDir: path.join(
      REPO_ROOT,
      'test-fixtures',
      'feynman',
      'sections',
      'fixture-small'
    ),
    section: 'problem-definition',
    narrative: path.join(
      REPO_ROOT,
      'test-fixtures',
      'feynman',
      'narratives',
      'fixture-small.json'
    ),
    expectedArtifactCount: 3,
  },
  {
    name: 'fixture-medium',
    roomDir: path.join(
      REPO_ROOT,
      'test-fixtures',
      'feynman',
      'sections',
      'fixture-medium'
    ),
    section: 'market-analysis',
    narrative: path.join(
      REPO_ROOT,
      'test-fixtures',
      'feynman',
      'narratives',
      'fixture-medium.json'
    ),
    expectedArtifactCount: 6,
  },
  {
    name: 'fixture-large',
    roomDir: path.join(
      REPO_ROOT,
      'test-fixtures',
      'feynman',
      'sections',
      'fixture-large'
    ),
    section: 'solution-design',
    narrative: path.join(
      REPO_ROOT,
      'test-fixtures',
      'feynman',
      'narratives',
      'fixture-large.json'
    ),
    expectedArtifactCount: 12,
  },
];

const REQUIRED_BLOCK_REGEXES = [
  { name: 'frontmatter', re: /^---\n[\s\S]*?methodology: feynman-minto[\s\S]*?\n---/m },
  { name: 'title', re: /^# .* Feynman-MINTO Reasoning$/m },
  { name: 'governing-thought', re: /> \[!abstract\] Governing Thought/ },
  { name: 'essence', re: /^## Essence$/m },
  { name: 'plain-language', re: /^## Plain Language$/m },
  { name: 'mental-model', re: /^## Mental Model$/m },
  { name: 'mental-model-mapping', re: /\*\*Mapping:\*\*/ },
  { name: 'mental-model-limits', re: /\*\*Where it breaks:\*\*/ },
  { name: 'sweet-spot', re: /^## Sweet Spot$/m },
  { name: 'key-claims', re: /^## Key Claims$/m },
  { name: 'mece-tree', re: /^## MECE Issue Tree$/m },
  { name: 'evidence-gaps', re: /^## Evidence Gaps$/m },
  { name: 'cross-refs', re: /^## Cross-References$/m },
  { name: 'source-artifacts', re: /^## Source Artifacts$/m },
  { name: 'navigation', re: /^## Navigation$/m },
];

function runCmd(args, opts) {
  const options = Object.assign(
    {
      env: Object.assign({}, process.env, {
        MINTO_FROZEN_DATE: '2026-04-14',
      }),
      encoding: 'utf-8',
    },
    opts || {}
  );
  const res = spawnSync(process.execPath, [GENERATOR].concat(args), options);
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function scanForbiddenDashes(s, label) {
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i);
    assert.ok(
      cp !== 8212 && cp !== 8211,
      label + ': forbidden dash (cp=' + cp + ') at char ' + i
    );
  }
}

function testPlanPhase(fx) {
  const res = runCmd([fx.roomDir, '--plan', '--section', fx.section]);
  assert.strictEqual(
    res.status,
    0,
    fx.name + ' --plan failed: ' + res.stderr
  );
  let payload;
  try {
    payload = JSON.parse(res.stdout);
  } catch (e) {
    throw new Error(
      fx.name + ' --plan stdout not JSON: ' + e.message + '\n' + res.stdout
    );
  }
  assert.ok(payload.section_name === fx.section, fx.name + ' wrong section_name');
  assert.ok(Array.isArray(payload.artifacts), fx.name + ' artifacts not array');
  assert.strictEqual(
    payload.artifacts.length,
    fx.expectedArtifactCount,
    fx.name + ' expected ' + fx.expectedArtifactCount + ' artifacts, got ' + payload.artifacts.length
  );
  assert.ok(payload.target_minto_path, fx.name + ' missing target_minto_path');
  assert.ok(payload.structural, fx.name + ' missing structural');
  assert.ok(
    payload.structural.frontmatter,
    fx.name + ' missing structural.frontmatter'
  );
  assert.strictEqual(
    payload.structural.frontmatter.section,
    fx.section,
    fx.name + ' frontmatter.section mismatch'
  );
  assert.ok(
    typeof payload.structural.mece_tree === 'string',
    fx.name + ' mece_tree not string'
  );
  assert.ok(
    Array.isArray(payload.structural.sources),
    fx.name + ' sources not array'
  );
  return payload;
}

function testWritePhase(fx) {
  // First run.
  const res1 = runCmd([
    fx.roomDir,
    '--write',
    '--section',
    fx.section,
    '--narrative',
    fx.narrative,
  ]);
  assert.strictEqual(
    res1.status,
    0,
    fx.name + ' --write failed: ' + res1.stderr
  );
  const mintoPath = path.join(fx.roomDir, fx.section, 'MINTO.md');
  assert.ok(fs.existsSync(mintoPath), fx.name + ' MINTO.md not created');
  const content1 = fs.readFileSync(mintoPath, 'utf-8');

  // Structural block checks.
  for (const block of REQUIRED_BLOCK_REGEXES) {
    assert.ok(
      block.re.test(content1),
      fx.name + ' missing block: ' + block.name
    );
  }

  // Length bound: conservative proxy for 1500-token ceiling.
  assert.ok(
    content1.length < 15000,
    fx.name + ' MINTO.md too long: ' + content1.length + ' chars (max 15000)'
  );

  // Em-dash / en-dash scan.
  scanForbiddenDashes(content1, fx.name + ' MINTO.md');

  // Placeholder leak check.
  assert.ok(
    !content1.includes('{section_name}'),
    fx.name + ' MINTO.md leaks {section_name}'
  );
  assert.ok(
    !content1.includes('{artifacts}'),
    fx.name + ' MINTO.md leaks {artifacts}'
  );

  // Narrative-derived content sanity: essence and governing thought
  // strings must appear verbatim in the output.
  const narrative = JSON.parse(fs.readFileSync(fx.narrative, 'utf-8'));
  assert.ok(
    content1.includes(narrative.essence),
    fx.name + ' MINTO.md missing essence string'
  );
  assert.ok(
    content1.includes(narrative.governing_thought),
    fx.name + ' MINTO.md missing governing_thought string'
  );
  assert.ok(
    content1.includes(narrative.sweet_spot),
    fx.name + ' MINTO.md missing sweet_spot string'
  );
  for (const claim of narrative.key_claims) {
    assert.ok(
      content1.includes(claim),
      fx.name + ' MINTO.md missing key claim: ' + claim.slice(0, 40)
    );
  }

  // Determinism: second run must produce byte-identical output under
  // the frozen date env var.
  const res2 = runCmd([
    fx.roomDir,
    '--write',
    '--section',
    fx.section,
    '--narrative',
    fx.narrative,
  ]);
  assert.strictEqual(
    res2.status,
    0,
    fx.name + ' --write rerun failed: ' + res2.stderr
  );
  const content2 = fs.readFileSync(mintoPath, 'utf-8');
  assert.strictEqual(
    content1,
    content2,
    fx.name + ' --write not deterministic across two runs'
  );

  // Clean up so git status stays clean.
  fs.unlinkSync(mintoPath);
}

function testPromptDriftGlobal() {
  const body = fs.readFileSync(MOS_REASON, 'utf-8');
  const pairs = [
    { name: 'STAGE_1_ESSENCE', library: prompts.STAGE_1_ESSENCE },
    { name: 'STAGE_2_PLAIN_LANGUAGE', library: prompts.STAGE_2_PLAIN_LANGUAGE },
    { name: 'STAGE_4_MENTAL_MODEL', library: prompts.STAGE_4_MENTAL_MODEL },
    { name: 'STAGE_5_SWEET_SPOT', library: prompts.STAGE_5_SWEET_SPOT },
  ];
  for (const p of pairs) {
    assert.ok(
      body.includes(p.library),
      'commands/mos-reason.md does not inline library constant ' + p.name
    );
  }
}

function run() {
  let passed = 0;
  const total = FIXTURES.length * 2 + 1; // plan + write per fixture + global drift
  for (const fx of FIXTURES) {
    testPlanPhase(fx);
    passed += 1;
    process.stdout.write('  PASS ' + fx.name + ' --plan\n');

    testWritePhase(fx);
    passed += 1;
    process.stdout.write('  PASS ' + fx.name + ' --write (structural + determinism)\n');
  }
  testPromptDriftGlobal();
  passed += 1;
  process.stdout.write('  PASS global prompt drift (library-inlined parity)\n');

  process.stdout.write(
    '\nvault-section-minto-generator.integration.test.cjs: ' +
      passed +
      '/' +
      total +
      ' checks passed\n'
  );
}

try {
  run();
  process.exit(0);
} catch (e) {
  process.stderr.write('FAIL integration: ' + e.message + '\n');
  if (e.stack) process.stderr.write(e.stack + '\n');
  process.exit(1);
}
