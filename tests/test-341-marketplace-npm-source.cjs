#!/usr/bin/env node
'use strict';

/*
 * Phase 341 Plan 05 -- sandboxed, zero-network proof that release.sh Step 4
 * writes the D-01 npm-source shape and deletes any residual ref/url keys.
 *
 * Approach (stated per the plan's own instruction): driving the FULL
 * release.sh up through Step 4 for real requires passing Step 2
 * (verify-release) and Step 2.5 (doctor --acceptance --pre-flight) first,
 * both of which read and assert against the REAL repo's own clean-tree
 * state -- too heavy and too fragile for a single-arm sandboxed unit test,
 * and it would not even point Step 2/2.5 at the sandbox (release.sh's
 * PLUGIN_DIR is derived from $0's dirname, not an env override).
 *
 * Instead this file extracts the ACTUAL Step 4 `node -e "..."` body
 * VERBATIM out of the real scripts/release.sh at test time (a structural
 * regex between the "# --- Step 4:" and "# --- Step 5:" header markers),
 * substitutes $NEW_VERSION, and runs that exact script with `cwd` pointed
 * at a scaffolded temp marketplace repo (RELEASE_TEST_MODE-style sandbox,
 * MARKETPLACE_DIR never touches the real one). This proves the REAL
 * production code path, not a hand-duplicated copy that could silently
 * drift from it -- if a future edit changes Step 4's shape, this test
 * either catches the drift or fails loudly on extraction (the regex not
 * matching), never silently passing against stale logic.
 *
 * Zero network. Registered in tests/run-all-341.sh.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');
const HOME = process.env.HOME || os.homedir();
const LIVE_MARKETPLACE = path.join(HOME, 'mindrian-marketplace');

let failures = 0;
let total = 0;

function pass(name) {
  process.stdout.write('PASS: ' + name + '\n');
}
function fail(name, err) {
  failures++;
  process.stdout.write('FAIL: ' + name + '\n');
  if (err) process.stdout.write('  ' + String(err && err.stack ? err.stack : err) + '\n');
}
function run(name, fn) {
  total++;
  try {
    fn();
    pass(name);
  } catch (e) {
    fail(name, e);
  }
}

function sh(cmd, opts) {
  return execSync(cmd, Object.assign({ encoding: 'utf8', stdio: 'pipe' }, opts || {}));
}

// Extracts the Step 4 node -e "..." body verbatim from the real release.sh.
function extractStep4NodeScript() {
  const releaseSh = fs.readFileSync(RELEASE_SH, 'utf8');
  const step4Idx = releaseSh.indexOf('# --- Step 4:');
  if (step4Idx === -1) throw new Error('could not find "# --- Step 4:" header in scripts/release.sh');
  const step5Idx = releaseSh.indexOf('# --- Step 5:', step4Idx);
  if (step5Idx === -1) throw new Error('could not find "# --- Step 5:" header after Step 4 in scripts/release.sh');
  const block = releaseSh.slice(step4Idx, step5Idx);
  const m = block.match(/node -e "\n([\s\S]*?)\n"/);
  if (!m) throw new Error('could not extract the node -e "..." body from the Step 4 block -- has its shape changed?');
  return m[1];
}

function makeSandboxMarketplace(oldShapeVersion) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos341-mp-source-'));
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude-plugin', 'marketplace.json'),
    JSON.stringify(
      {
        name: 'mindrian-marketplace',
        owner: { name: 'Jonathan Sagir' },
        plugins: [
          {
            name: 'mos',
            description: 'test fixture',
            version: oldShapeVersion,
            source: {
              source: 'url',
              url: 'git' + '-url-placeholder.invalid/mindrian-os-plugin.git',
              ref: 'v' + oldShapeVersion,
            },
          },
        ],
      },
      null,
      2
    ) + '\n'
  );
  return root;
}

// --------------------- Arm 1: Step 4 rewrites the source object cleanly ----

run('Arm 1 (Step 4 writes {source, package, version}, deletes ref/url, no v prefix, no registry key)', function () {
  const nodeScript = extractStep4NodeScript();
  const sandboxDir = makeSandboxMarketplace('2.0.0-beta.29');
  try {
    const NEW_VERSION = '2.0.0-beta.31';
    const substituted = nodeScript.replace(/\$NEW_VERSION/g, NEW_VERSION);
    const r = spawnSync('node', ['-e', substituted], { cwd: sandboxDir, encoding: 'utf8', timeout: 15000 });
    if (r.status !== 0) {
      throw new Error('extracted Step 4 script exited ' + r.status + ':\n' + (r.stdout || '') + (r.stderr || ''));
    }
    const written = JSON.parse(fs.readFileSync(path.join(sandboxDir, '.claude-plugin', 'marketplace.json'), 'utf8'));
    const source = written.plugins[0].source;

    if (written.plugins[0].version !== NEW_VERSION) {
      throw new Error('expected plugins[0].version === ' + NEW_VERSION + ', got ' + written.plugins[0].version);
    }
    const keys = Object.keys(source).sort();
    const expectedKeys = ['package', 'source', 'version'].sort();
    if (keys.join(',') !== expectedKeys.join(',')) {
      throw new Error('expected exactly {source, package, version} keys, got: ' + JSON.stringify(keys));
    }
    if (source.source !== 'npm') throw new Error('expected source.source === "npm", got ' + source.source);
    if (source.package !== '@mindrian_os/cli') throw new Error('expected source.package === "@mindrian_os/cli", got ' + source.package);
    if (source.version !== NEW_VERSION) throw new Error('expected source.version === ' + NEW_VERSION + ', got ' + source.version);
    if (/^v/.test(source.version)) throw new Error('source.version carries a v prefix: ' + source.version);
    if (Object.prototype.hasOwnProperty.call(source, 'ref')) throw new Error('residual "ref" key present: ' + JSON.stringify(source));
    if (Object.prototype.hasOwnProperty.call(source, 'url')) throw new Error('residual "url" key present: ' + JSON.stringify(source));
    if (Object.prototype.hasOwnProperty.call(source, 'registry')) throw new Error('unexpected "registry" key present: ' + JSON.stringify(source));
  } finally {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
});

// --------------------- Arm 2: idempotent on a second run -------------------

run('Arm 2 (running Step 4 twice for two different versions leaves a clean final shape, not an accumulating one)', function () {
  const nodeScript = extractStep4NodeScript();
  const sandboxDir = makeSandboxMarketplace('2.0.0-beta.29');
  try {
    for (const v of ['2.0.0-beta.30', '2.0.0-beta.31']) {
      const substituted = nodeScript.replace(/\$NEW_VERSION/g, v);
      const r = spawnSync('node', ['-e', substituted], { cwd: sandboxDir, encoding: 'utf8', timeout: 15000 });
      if (r.status !== 0) throw new Error('extracted Step 4 script exited ' + r.status + ' on v=' + v + ':\n' + (r.stdout || '') + (r.stderr || ''));
    }
    const written = JSON.parse(fs.readFileSync(path.join(sandboxDir, '.claude-plugin', 'marketplace.json'), 'utf8'));
    const source = written.plugins[0].source;
    const keys = Object.keys(source).sort();
    if (keys.join(',') !== ['package', 'source', 'version'].sort().join(',')) {
      throw new Error('expected exactly {source, package, version} keys after a second run, got: ' + JSON.stringify(keys));
    }
    if (source.version !== '2.0.0-beta.31') throw new Error('expected final source.version === 2.0.0-beta.31, got ' + source.version);
  } finally {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
});

// --------------------- Arm 3: the live marketplace was never touched -------

run('Arm 3 (the LIVE ~/mindrian-marketplace/.claude-plugin/marketplace.json is unmodified after this suite)', function () {
  if (!fs.existsSync(LIVE_MARKETPLACE)) {
    // Nothing to assert if the live checkout is not present in this environment.
    return;
  }
  const status = sh('git status --porcelain', { cwd: LIVE_MARKETPLACE }).trim();
  if (status !== '') {
    throw new Error('LIVE marketplace checkout has uncommitted changes after this test suite ran:\n' + status);
  }
});

// ------------------------ Summary ----------------------------------------

process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
