#!/usr/bin/env node
'use strict';

/*
 * Phase 270-03 Task 3 -- RED pin for live discovery with no registration
 * step: a sub-room created AFTER registerResources ran must appear on the
 * next mos://tree read.
 *
 * The vendored SDK already supports this (RESEARCH.md 3.4a): resource()
 * calls sendResourceListChanged() on registration, and a ResourceTemplate's
 * list callback already re-evaluates per resources/list (3.4b,
 * resources.cjs:69-81's sectionTemplate). RESEARCH_19_MCP_PERSISTENT_AGENTS.md
 * :198 recommends watching directories not files, one watcher per room
 * root, with awaitWriteFinish debouncing -- chokidar@^4.0.3 is already a
 * dependency; this test adds no package.
 *
 * RED until plan 270-08 (mos://tree is not registered yet and
 * lib/mcp/tree-watcher.cjs does not exist yet).
 *
 * No em-dashes. CJS only. chokidar is already a dependency; do not add one.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RESOURCES_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'resources.cjs');
const TREE_WATCHER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tree-watcher.cjs');

// makeStubServer() -- LOCAL COPY of the shape from
// tests/test-270-resource-session-room.cjs (plan 270-02 Task 2). Copied
// rather than required across test files so each stays independently
// runnable.
function makeStubServer() {
  return {
    resources: new Map(),
    templates: new Map(),
    tools: new Map(),
    listChangedCount: 0,
    resource(name, uriOrTemplate, meta, cb) {
      if (typeof uriOrTemplate === 'string') {
        this.resources.set(name, { uri: uriOrTemplate, meta, cb });
      } else {
        this.templates.set(name, { template: uriOrTemplate, meta, cb });
      }
    },
    tool(name, description, schema, cb) {
      this.tools.set(name, { description, schema, cb });
    },
    sendResourceListChanged() {
      this.listChangedCount += 1;
    },
  };
}

// makeFixtureForest() -- LOCAL COPY of the fixture shape from
// tests/test-270-tree-classification.cjs (plan 270-03 Task 2), trimmed to
// what THIS test needs: two room slugs under a hermetic
// MINDRIAN_ROOMS_HOME, so a third (gamma-lab, created after registration)
// can be added mid-test.
function makeFixtureForest() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '270-forest-'));
  for (const slug of ['alpha', 'beta']) {
    const dir = path.join(home, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.room-root'), JSON.stringify({ slug }));
    fs.writeFileSync(path.join(dir, 'STATE.md'), '# State\n');
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + slug + '\n');
  }
  return { home, betaDir: path.join(home, 'beta') };
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

function findTreeResource(stub) {
  for (const [, reg] of stub.resources) if (reg.uri === 'mos://tree') return reg;
  for (const [, reg] of stub.templates) {
    const tpl = reg.template;
    const uriStr = tpl && tpl.uriTemplate ? String(tpl.uriTemplate) : '';
    if (uriStr === 'mos://tree') return reg;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let n = 0;
async function ok(desc, fn) { await fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-270-dynamic-tree');

(async function main() {
  const fixture = makeFixtureForest();
  const savedHome = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = fixture.home;

  let watcherHandle = null;

  try {
    const { registerResources } = require(RESOURCES_PATH);
    const stub = makeStubServer();
    const ctx = { fallbackRoomDir: fixture.home, pluginRoot: REPO_ROOT, surface: 'cli' };
    registerResources(stub, ctx);

    await ok('mos://tree is registered as a Resource, not as a Tool', async function () {
      const treeReg = findTreeResource(stub);
      assert.ok(
        treeReg,
        'mos://tree is not registered as a Resource (plan 270-08) -- ' +
          'RESEARCH.md 4.1 item 1 / 3.4: pure read, browsable, no fork, URI-expressible, ' +
          'therefore a Resource, never a Tool (Resources cost nothing per turn against the ' +
          'always-loaded tool schema budget)'
      );
      for (const badName of ['tree_read', 'mos_tree', 'context_tree']) {
        assert.ok(!stub.tools.has(badName), 'mos://tree must not also be registered as a Tool named "' + badName + '"');
      }
    });

    let firstText = null;
    let treeReg = null;

    await ok('the first mos://tree read reflects the fixture as built', async function () {
      treeReg = findTreeResource(stub);
      assert.ok(treeReg, 'mos://tree is not registered yet (plan 270-08)');
      const result = await treeReg.cb({ href: 'mos://tree' }, { sessionId: 'sess-270-tree' });
      firstText = result.contents[0].text;
      let parsed;
      try { parsed = JSON.parse(firstText); } catch (_e) { parsed = null; }
      const bodyStr = parsed ? JSON.stringify(parsed) : firstText;
      const roomCount = ['alpha', 'beta'].filter((slug) => bodyStr.indexOf(slug) !== -1).length;
      if (roomCount < 2) throw new Error('harness never reached real data: fewer than 2 fixture room slugs came back');
    });

    await ok('a sub-room created after registration appears on the NEXT read, with no re-registration', async function () {
      assert.ok(firstText !== null, 'setup leg did not run first');
      assert.ok(firstText.indexOf('gamma-lab') === -1, 'gamma-lab must be ABSENT from the first read');

      const gammaDir = path.join(fixture.betaDir, 'gamma-lab');
      fs.mkdirSync(gammaDir, { recursive: true });
      fs.writeFileSync(path.join(gammaDir, 'ROOM.md'), '# gamma lab\n');
      fs.writeFileSync(path.join(gammaDir, 'STATE.md'), '# State\n');

      // Do NOT call registerResources again and do NOT touch the stub.
      const result2 = await treeReg.cb({ href: 'mos://tree' }, { sessionId: 'sess-270-tree' });
      const secondText = result2.contents[0].text;
      assert.ok(secondText.indexOf('gamma-lab') !== -1, 'gamma-lab must be present on the SECOND read with no re-registration');
    });

    await ok('creating a room root fires sendResourceListChanged at most once per debounce window', async function () {
      let treeWatcher;
      try {
        treeWatcher = require(TREE_WATCHER_PATH);
      } catch (e) {
        throw new Error('lib/mcp/tree-watcher.cjs does not exist yet (plan 270-08) - RED by design. Underlying: ' + e.message);
      }
      assert.equal(typeof treeWatcher.startTreeWatcher, 'function', 'startTreeWatcher must be an exported function');
      assert.equal(typeof treeWatcher.stopTreeWatcher, 'function', 'stopTreeWatcher must be an exported function');

      const beforeCount = stub.listChangedCount;
      watcherHandle = treeWatcher.startTreeWatcher(stub, { home: fixture.home, debounceMs: 50 });

      for (const name of ['delta-one', 'delta-two', 'delta-three']) {
        fs.mkdirSync(path.join(fixture.home, name), { recursive: true });
        fs.writeFileSync(path.join(fixture.home, name, 'ROOM.md'), '# ' + name + '\n');
      }

      await sleep(200); // roughly 4x the 50ms debounce window

      const delta = stub.listChangedCount - beforeCount;
      assert.ok(delta >= 1, 'sendResourceListChanged should have fired at least once for the three new directories');
      assert.ok(delta <= 2, 'sendResourceListChanged fired ' + delta + ' times -- debouncing is not collapsing rapid creates');

      const stopped = treeWatcher.stopTreeWatcher();
      assert.ok(stopped, 'stopTreeWatcher() should return a truthy result confirming the watcher closed');
      watcherHandle = null;
    });
  } finally {
    if (watcherHandle) {
      try {
        const treeWatcher = require(TREE_WATCHER_PATH);
        if (typeof treeWatcher.stopTreeWatcher === 'function') treeWatcher.stopTreeWatcher();
      } catch (_e) { /* module may not exist yet -- nothing to stop */ }
    }
    if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedHome;
    cleanupDir(fixture.home);
  }

  console.log('\nPASS test-270-dynamic-tree (' + n + ' assertions)');
})().catch(function (err) {
  console.error('FAIL test-270-dynamic-tree: ' + (err && err.message ? err.message : String(err)));
  process.exitCode = 1;
});
