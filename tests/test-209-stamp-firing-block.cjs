#!/usr/bin/env node
'use strict';

/*
 * Phase 209-02 (B1) - tests for scripts/stamp-firing-block.cjs.
 *
 * Proves the five behaviors the plan mandates, all against in-memory fixtures
 * (behaviors 1-4) and a cwd-scoped temp dir (behavior 5) - never the live
 * commands/ tree:
 *   1. idempotency        - stamping an already-stamped body is byte-identical
 *   2. skip list          - a body already mentioning AskUserQuestion is NOT
 *                           body-stamped, but its restrictive allowed-tools list
 *                           still gains the grant
 *   3. grant semantics    - existing list lacking the tool gains exactly one
 *                           item; absent key stays absent; already-granted list
 *                           is untouched; flow-array and scalar dialects handled
 *   4. frontmatter safety - frontmatter byte-preserved except the grant line; no
 *                           frontmatter / no hitl_shape / hitl_shape none skipped
 *   5. --check            - dry-run writes nothing and reports pending deltas,
 *                           then zero after apply
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const stamp = require('../scripts/stamp-firing-block.cjs');
const { stampBody, grantTool, runStamp, STAMP_MARKER } = stamp;

let passed = 0;
function ok(name) {
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------------------------------------------------------------------------
// Fixtures (in-memory)
// ---------------------------------------------------------------------------
const FM_LIST = [
  '---',
  'name: demo',
  'hitl_shape: "F.1"',
  'hitl_why: "A demo gate."',
  'allowed-tools:',
  '  - Read',
  '  - Write',
  '---',
].join('\n');

function bodyFor(fm, body) {
  return fm + '\n\n' + body;
}

const DECLARING = bodyFor(FM_LIST, '# /mos:demo\n\nDo the thing.\n');

// ---------------------------------------------------------------------------
// Behavior 1 - idempotency
// ---------------------------------------------------------------------------
console.log('Behavior 1: idempotency');
{
  const once = stampBody(DECLARING);
  assert.ok(once.includes(STAMP_MARKER), 'first stamp inserts the marker');
  assert.notStrictEqual(once, DECLARING, 'first stamp changes the body');
  const twice = stampBody(once);
  assert.strictEqual(twice, once, 'stamping an already-stamped body is byte-identical');
  ok('stampBody is idempotent (byte-identical re-run)');
}

// ---------------------------------------------------------------------------
// Behavior 2 - skip list (pre-wired body)
// ---------------------------------------------------------------------------
console.log('Behavior 2: skip list');
{
  const prewired = bodyFor(
    FM_LIST,
    '# /mos:demo\n\nClose with an AskUserQuestion card (existing mention).\n'
  );
  const afterBody = stampBody(prewired);
  assert.strictEqual(afterBody, prewired, 'pre-wired body is NOT body-stamped');
  assert.ok(!afterBody.includes(STAMP_MARKER), 'no marker inserted into pre-wired body');
  const afterGrant = grantTool(prewired);
  assert.ok(
    /- AskUserQuestion/.test(afterGrant),
    'pre-wired body still gains the allowed-tools grant'
  );
  ok('pre-wired body skips stamp but still gets the grant');
}

// ---------------------------------------------------------------------------
// Behavior 3 - grant semantics
// ---------------------------------------------------------------------------
console.log('Behavior 3: grant semantics');
{
  // multi-line list lacking the tool gains exactly one item
  const granted = grantTool(DECLARING);
  const count = (granted.match(/- AskUserQuestion/g) || []).length;
  assert.strictEqual(count, 1, 'exactly one AskUserQuestion list item added');
  assert.ok(/- Read/.test(granted) && /- Write/.test(granted), 'existing items preserved');
  ok('multi-line list gains exactly one grant item');

  // idempotent grant
  assert.strictEqual(grantTool(granted), granted, 'grant is idempotent on a granted list');
  ok('grant is idempotent');

  // absent key stays absent
  const noKey = bodyFor(
    ['---', 'name: nokey', 'hitl_shape: "F.1"', 'hitl_why: "x"', '---'].join('\n'),
    '# /mos:nokey\n'
  );
  assert.strictEqual(grantTool(noKey), noKey, 'no allowed-tools key stays absent (never created)');
  ok('absent allowed-tools key is never created');

  // flow array dialect
  const flow = bodyFor(
    ['---', 'name: flow', 'hitl_shape: "F.1"', 'hitl_why: "x"', 'allowed-tools: [Bash, Read]', '---'].join('\n'),
    '# /mos:flow\n'
  );
  const flowGranted = grantTool(flow);
  assert.ok(/allowed-tools: \[Bash, Read, AskUserQuestion\]/.test(flowGranted), 'flow array gains the tool');
  assert.strictEqual(grantTool(flowGranted), flowGranted, 'flow array grant idempotent');
  ok('inline flow-array dialect handled');

  // empty flow array
  const empty = bodyFor(
    ['---', 'name: empty', 'hitl_shape: "F.1"', 'hitl_why: "x"', 'allowed-tools: []', '---'].join('\n'),
    '# /mos:empty\n'
  );
  const emptyGranted = grantTool(empty);
  assert.ok(/allowed-tools: \[AskUserQuestion\]/.test(emptyGranted), 'empty flow array gains the tool');
  ok('empty flow-array dialect handled');

  // scalar dialect
  const scalar = bodyFor(
    ['---', 'name: scalar', 'hitl_shape: "F.1"', 'hitl_why: "x"', 'allowed-tools: Bash(node *)', '---'].join('\n'),
    '# /mos:scalar\n'
  );
  const scalarGranted = grantTool(scalar);
  assert.ok(/allowed-tools: Bash\(node \*\), AskUserQuestion/.test(scalarGranted), 'scalar gains the tool');
  assert.strictEqual(grantTool(scalarGranted), scalarGranted, 'scalar grant idempotent');
  ok('inline scalar dialect handled');
}

// ---------------------------------------------------------------------------
// Behavior 4 - frontmatter safety
// ---------------------------------------------------------------------------
console.log('Behavior 4: frontmatter safety');
{
  // frontmatter byte-preserved by stampBody (only the body is touched)
  const stamped = stampBody(DECLARING);
  const fmOf = (s) => /^---\r?\n[\s\S]*?\r?\n---/.exec(s)[0];
  assert.strictEqual(fmOf(stamped), fmOf(DECLARING), 'stampBody preserves frontmatter byte-for-byte');
  ok('stampBody leaves frontmatter untouched');

  // no frontmatter -> skipped
  const noFm = '# just a body\n\nno frontmatter here\n';
  assert.strictEqual(stampBody(noFm), noFm, 'no frontmatter skipped');
  assert.strictEqual(grantTool(noFm), noFm, 'grantTool no frontmatter skipped');
  ok('no-frontmatter file skipped');

  // no hitl_shape -> skipped
  const noShape = bodyFor(['---', 'name: x', 'allowed-tools:', '  - Read', '---'].join('\n'), '# body\n');
  assert.strictEqual(stampBody(noShape), noShape, 'no hitl_shape skipped');
  ok('no-hitl_shape file skipped by stampBody');

  // hitl_shape none -> skipped
  const shapeNone = bodyFor(
    ['---', 'name: x', 'hitl_shape: "none"', '---'].join('\n'),
    '# body\n'
  );
  assert.strictEqual(stampBody(shapeNone), shapeNone, 'hitl_shape none skipped');
  ok('hitl_shape none skipped by stampBody');
}

// ---------------------------------------------------------------------------
// Behavior 5 - --check dry-run
// ---------------------------------------------------------------------------
console.log('Behavior 5: --check');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-209-'));
  const cmdDir = path.join(tmp, 'commands');
  fs.mkdirSync(cmdDir);
  const f1 = path.join(cmdDir, 'needs-stamp.md');
  const f2 = path.join(cmdDir, 'prewired.md');
  fs.writeFileSync(f1, DECLARING);
  fs.writeFileSync(
    f2,
    bodyFor(FM_LIST, '# /mos:prewired\n\nAlready fires an AskUserQuestion card.\n')
  );

  const before1 = fs.readFileSync(f1, 'utf8');
  const before2 = fs.readFileSync(f2, 'utf8');

  const dry = runStamp({ check: true, commandsDir: cmdDir });
  assert.ok(dry.pendingCount > 0, 'dry-run reports pending deltas');
  assert.strictEqual(fs.readFileSync(f1, 'utf8'), before1, 'dry-run writes nothing (f1)');
  assert.strictEqual(fs.readFileSync(f2, 'utf8'), before2, 'dry-run writes nothing (f2)');
  ok('--check reports pending and writes nothing');

  const applied = runStamp({ check: false, commandsDir: cmdDir });
  assert.ok(applied.changedCount > 0, 'apply changes files');
  assert.ok(fs.readFileSync(f1, 'utf8').includes(STAMP_MARKER), 'f1 stamped after apply');
  assert.ok(!fs.readFileSync(f2, 'utf8').includes(STAMP_MARKER), 'f2 (pre-wired) body not stamped');
  ok('apply stamps the tree');

  const dry2 = runStamp({ check: true, commandsDir: cmdDir });
  assert.strictEqual(dry2.pendingCount, 0, 're-check reports zero pending (idempotent on tree)');
  ok('--check after apply is a no-op (zero pending)');

  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\nAll ' + passed + ' assertions passed.');
