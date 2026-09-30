'use strict';
/*
 * Phase 363.1-02 Task 1 (D-08, B51-02): no agent may declare `isolation: worktree`.
 *
 * Why: rooms are usually not git repos, and a subagent that declares worktree
 * isolation hard-fails ("Cannot create agent worktree: not in a git repository")
 * on every dispatch outside git. Parallel dispatches stay safe by contract:
 * each writes only its own target_section's artifacts.
 *
 * Pure filesystem test. No network, no deps. House rule: hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function leg(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok - ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('not ok - ' + name + '\n  ' + String(err && err.message).split('\n').join('\n  ') + '\n');
  }
}

function frontmatterLines(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] === undefined || lines[0].trim() !== '---') return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return out;
    out.push(lines[i]);
  }
  return out;
}

function isWorktreeDecl(line) {
  if (/^\s*#/.test(line)) return false; // YAML comment
  return /^\s*isolation\s*:\s*worktree\s*$/.test(line);
}

const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md')).sort();

leg('agents dir has agent files', () => {
  assert.ok(files.length > 0, 'no agents/*.md found');
});

leg('no agents/*.md declares isolation: worktree in frontmatter', () => {
  const offenders = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8');
    if (frontmatterLines(text).some(isWorktreeDecl)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], 'agents declaring isolation: worktree: ' + offenders.join(', '));
});

leg('comment-only mention of isolation is ignored (dominant-design-researcher stays legal)', () => {
  assert.equal(isWorktreeDecl('# omitClaudeMd, isolation: worktree, color'), false);
  assert.equal(isWorktreeDecl('isolation: worktree'), true);
  assert.equal(isWorktreeDecl('  isolation:   worktree  '), true);
});

leg('framework-runner no longer claims "You operate in isolation." and states the disjointness contract', () => {
  const text = fs.readFileSync(path.join(AGENTS_DIR, 'framework-runner.md'), 'utf8');
  assert.ok(!text.includes('You operate in isolation.'), 'old isolation sentence still present');
  assert.ok(text.includes('writes only its own'), 'write-disjointness contract prose missing');
});

leg('edited agents keep their name: field', () => {
  for (const name of ['framework-runner', 'research', 'opportunity-scanner']) {
    const text = fs.readFileSync(path.join(AGENTS_DIR, name + '.md'), 'utf8');
    assert.ok(
      frontmatterLines(text).some((l) => l.trim() === 'name: ' + name),
      name + ' lost its name: field'
    );
  }
});

leg('dash fence: this test and the three agents carry no em-dash or en-dash', () => {
  const targets = [
    path.join(__dirname, 'test-363.1-agent-isolation.cjs'),
    path.join(AGENTS_DIR, 'framework-runner.md'),
    path.join(AGENTS_DIR, 'research.md'),
    path.join(AGENTS_DIR, 'opportunity-scanner.md'),
  ];
  for (const t of targets) {
    const text = fs.readFileSync(t, 'utf8');
    assert.ok(!text.includes(EM), path.basename(t) + ' has an em-dash');
    assert.ok(!text.includes(EN), path.basename(t) + ' has an en-dash');
  }
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
