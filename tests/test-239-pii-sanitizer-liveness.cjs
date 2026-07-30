#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 239 (BRAIN-01, threat T-239-T1) -- the PostToolUse half of the Brain
 * seam fix. tests/test-brain-response-sanitize.cjs proves isBrainTool() as a
 * pure function; this file proves the real hook SCRIPT
 * (scripts/brain-response-sanitize-hook.cjs) fires the sanitizer on a live
 * name by driving it as a real child process over stdin, exactly the way
 * Claude Code's PostToolUse hook actually invokes it. Modeled on
 * tests/part8-egress-guard-hook.test.cjs's envelope()/spawnSync idiom.
 *
 * RESEARCH.md Pitfall 5 (fixtures must be derived from the live enumeration,
 * never hand-typed): every live tool name fixture below is DERIVED at run
 * time from scripts/check-brain-tool-liveness.cjs's enumerateLiveBrainTools()
 * + composeScopedNames(), never hand-typed. The only two hand-typed literals
 * in this file are DELIBERATE NEGATIVE fixtures: the foreign-server name for
 * threat T3 (LEG 4) and the superseded dead name (LEG 5), both of which must
 * never resolve as live -- naming them literally is the point of the test.
 *
 * Six legs:
 *   LEG 1 -- plugin-scoped live name fires the sanitizer (PII rewritten).
 *   LEG 2 -- project-scoped live name fires the sanitizer (PII rewritten).
 *   LEG 3 -- non-Brain tool_name (Write) passes through unmodified.
 *   LEG 4 -- threat T3: a foreign MCP server response passes through
 *            unrewritten (a sanitizer tuned to the Brain contract must not
 *            touch a third party's bytes).
 *   LEG 5 -- the superseded dead name (mcp__brain_query, bare prefix form)
 *            is now inert (passthrough); it never existed as a live
 *            registered tool name in production, so treating it as inert is
 *            the Phase 239 correction, not a regression.
 *   LEG 6 -- MUTATION: revert isBrainTool to the pre-239 bare-prefix body,
 *            prove the live name from LEG 1 now falls through unrewritten
 *            (the gate reopening), restore the file byte-identical in a
 *            finally, and re-prove LEG 1 green again.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, zero npm deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const HOOK_PATH = path.join(ROOT, 'scripts', 'brain-response-sanitize-hook.cjs');
const SANITIZE_MODULE_PATH = path.join(ROOT, 'lib', 'core', 'brain-response-sanitize.cjs');
const SANITIZE_MODULE_RELPATH = 'lib/core/brain-response-sanitize.cjs';

const liveness = require('../scripts/check-brain-tool-liveness.cjs');

let okCount = 0;
function ok(label) {
  okCount += 1;
  console.log('  ok  ' + label);
}

function runHook(stdinObj) {
  const res = spawnSync(process.execPath, [HOOK_PATH], {
    input: JSON.stringify(stdinObj),
    env: process.env,
    encoding: 'utf8',
    timeout: 5000,
  });
  return res;
}

async function main() {
  // ---------------------------------------------------------------------
  // Setup: derive live tool names from the same authority Task 1's
  // acceptance criteria demand -- scripts/check-brain-tool-liveness.cjs's
  // real stdio tools/list handshake, never a hand-typed list.
  // ---------------------------------------------------------------------
  const enumeration = await liveness.enumerateLiveBrainTools();
  assert.ok(
    enumeration.names && enumeration.names.length > 0,
    'setup: enumerateLiveBrainTools must return at least one live bare tool name'
  );
  const pluginName = liveness.resolvePluginName();
  const serverName = liveness.resolveServerName();
  const allScoped = liveness.composeScopedNames(enumeration.names, pluginName, serverName);

  const pluginScopedName = allScoped.find(function (n) { return n.indexOf('mcp__plugin_') === 0; });
  const projectScopedName = allScoped.find(function (n) { return n.indexOf('mcp__plugin_') !== 0; });
  assert.ok(pluginScopedName, 'setup: no live plugin-scoped Brain tool name was composed');
  assert.ok(projectScopedName, 'setup: no live project-scoped Brain tool name was composed');
  ok(
    'setup: derived a live plugin-scoped name (' + pluginScopedName + ') and a live ' +
    'project-scoped name (' + projectScopedName + ') from the real tools/list handshake, ' +
    'neither hand-typed'
  );

  // ---------------------------------------------------------------------
  // LEG 1: plugin-scoped live name fires the sanitizer.
  // ---------------------------------------------------------------------
  const LEG1_PII = 'jane@startup.com';
  const leg1Stdin = {
    tool_name: pluginScopedName,
    tool_input: { cypher: 'MATCH (n) RETURN n' },
    tool_response: { text: 'JTBD note: reach founder ' + LEG1_PII + ' about the pivot' },
    session_id: 'leg1-plugin-scoped',
  };
  (function leg1() {
    const r = runHook(leg1Stdin);
    assert.strictEqual(r.status, 0, 'LEG 1: hook must exit 0; stderr=' + (r.stderr || ''));
    const envelope = JSON.parse(r.stdout);
    assert.ok(envelope.hookSpecificOutput, 'LEG 1: plugin-scoped live name must fire the sanitizer (hookSpecificOutput present)');
    const text = envelope.hookSpecificOutput.updatedToolOutput.text;
    assert.match(text, /\[REDACTED:[0-9a-f]{8}\]/, 'LEG 1: expected a REDACTED placeholder in the sanitized text');
    assert.ok(!text.includes(LEG1_PII), 'LEG 1: PII value must be REWRITTEN, not echoed, in the sanitized text');
    assert.ok(!r.stdout.includes(LEG1_PII), 'LEG 1: the raw PII value must not appear anywhere in stdout');
    ok(
      'LEG 1: plugin-scoped live name (' + pluginScopedName + ') fires the sanitizer -- ' +
      'seeded PII "' + LEG1_PII + '" rewritten to "' + text.match(/\[REDACTED:[0-9a-f]{8}\]/)[0] + '"'
    );
  })();

  // ---------------------------------------------------------------------
  // LEG 2: project-scoped live name fires the sanitizer (Pitfall 6: both
  // scopes really occur across the three Tri-Polar surfaces).
  // ---------------------------------------------------------------------
  const LEG2_PII = '123-45-6789';
  const leg2Stdin = {
    tool_name: projectScopedName,
    tool_input: { cypher: 'MATCH (n) RETURN n' },
    tool_response: { text: 'MECE note: contact SSN ' + LEG2_PII + ' on file' },
    session_id: 'leg2-project-scoped',
  };
  (function leg2() {
    const r = runHook(leg2Stdin);
    assert.strictEqual(r.status, 0, 'LEG 2: hook must exit 0; stderr=' + (r.stderr || ''));
    const envelope = JSON.parse(r.stdout);
    assert.ok(envelope.hookSpecificOutput, 'LEG 2: project-scoped live name must fire the sanitizer (hookSpecificOutput present)');
    const text = envelope.hookSpecificOutput.updatedToolOutput.text;
    assert.match(text, /\[REDACTED:[0-9a-f]{8}\]/, 'LEG 2: expected a REDACTED placeholder in the sanitized text');
    assert.ok(!text.includes(LEG2_PII), 'LEG 2: PII value must be REWRITTEN, not echoed, in the sanitized text');
    assert.ok(!r.stdout.includes(LEG2_PII), 'LEG 2: the raw PII value must not appear anywhere in stdout');
    ok(
      'LEG 2: project-scoped live name (' + projectScopedName + ') fires the sanitizer -- ' +
      'seeded PII "' + LEG2_PII + '" rewritten to "' + text.match(/\[REDACTED:[0-9a-f]{8}\]/)[0] + '"'
    );
  })();

  // ---------------------------------------------------------------------
  // LEG 3: non-Brain tool passes through unmodified (existing defense-in-
  // depth behavior; must not regress).
  // ---------------------------------------------------------------------
  (function leg3() {
    const r = runHook({
      tool_name: 'Write',
      tool_input: { path: 'x.md' },
      tool_response: { text: 'contains ' + LEG1_PII },
      session_id: 'leg3-non-brain',
    });
    assert.strictEqual(r.status, 0, 'LEG 3: hook must exit 0; stderr=' + (r.stderr || ''));
    const envelope = JSON.parse(r.stdout);
    assert.strictEqual(envelope.continue, true, 'LEG 3: continue must be true');
    assert.strictEqual(envelope.hookSpecificOutput, undefined, 'LEG 3: non-Brain tool must pass through with no hookSpecificOutput');
    ok('LEG 3: non-Brain tool_name (Write) passes through, no hookSpecificOutput emitted, payload untouched');
  })();

  // ---------------------------------------------------------------------
  // LEG 4 (threat T3): a foreign MCP server whose name merely resembles the
  // Brain must NOT have its response rewritten by a sanitizer tuned to the
  // Brain contract. DELIBERATE hand-typed literal -- this name must never
  // resolve as live; naming it literally is the point of this negative
  // fixture (grep-exempt per this plan's acceptance criteria).
  // ---------------------------------------------------------------------
  const FOREIGN_SERVER_NAME = 'mcp__plugin_evil_evil-brain__brain_ask';
  (function leg4() {
    const r = runHook({
      tool_name: FOREIGN_SERVER_NAME,
      tool_input: { question: 'x' },
      tool_response: { text: 'contact ' + LEG1_PII + ' now' },
      session_id: 'leg4-foreign-server-t3',
    });
    assert.strictEqual(r.status, 0, 'LEG 4: hook must exit 0; stderr=' + (r.stderr || ''));
    const envelope = JSON.parse(r.stdout);
    assert.strictEqual(
      envelope.hookSpecificOutput,
      undefined,
      'LEG 4 (T3): a foreign server response must PASS THROUGH unrewritten, never sanitized by the Brain-tuned redactor'
    );
    ok('LEG 4 (threat T3): foreign server name ' + FOREIGN_SERVER_NAME + ' passes through unrewritten (anti-impersonation holds)');
  })();

  // ---------------------------------------------------------------------
  // LEG 5: the superseded dead name is now inert. Phase 239: this literal
  // (bare mcp__brain_ prefix) never existed as a live registered tool name
  // once the Brain server shipped inside the "mos" plugin -- treating it as
  // inert here is the correction this phase makes, not a regression.
  // DELIBERATE hand-typed literal (grep-exempt per this plan's acceptance
  // criteria).
  // ---------------------------------------------------------------------
  const SUPERSEDED_DEAD_NAME = 'mcp__brain_query';
  (function leg5() {
    const r = runHook({
      tool_name: SUPERSEDED_DEAD_NAME,
      tool_input: { cypher: 'x' },
      tool_response: { text: 'contact ' + LEG1_PII + ' now' },
      session_id: 'leg5-superseded-dead-name',
    });
    assert.strictEqual(r.status, 0, 'LEG 5: hook must exit 0; stderr=' + (r.stderr || ''));
    const envelope = JSON.parse(r.stdout);
    assert.strictEqual(
      envelope.hookSpecificOutput,
      undefined,
      'LEG 5: the superseded dead name must be inert (passthrough), never resolving to the sanitize branch'
    );
    ok('LEG 5: superseded dead name ' + SUPERSEDED_DEAD_NAME + ' is inert (passthrough) -- it never existed as a live production tool name');
  })();

  // ---------------------------------------------------------------------
  // LEG 6: MUTATION PROOF. Revert isBrainTool to the pre-239 bare-prefix
  // body, prove LEG 1's live name now falls through unrewritten (the gate
  // reopening), restore unconditionally in a finally, then re-prove LEG 1
  // green again. Mutation window is held to the single spawn below only.
  // ---------------------------------------------------------------------
  await (async function leg6MutationProof() {
    const preMutationStatus = spawnSync('git', ['status', '--porcelain', '--', SANITIZE_MODULE_RELPATH], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.strictEqual(
      (preMutationStatus.stdout || '').trim(),
      '',
      'LEG 6 setup: ' + SANITIZE_MODULE_RELPATH + ' must be clean before mutating (no mutation already in flight)'
    );

    const original = fs.readFileSync(SANITIZE_MODULE_PATH, 'utf8');
    const liveBody =
      "function isBrainTool(toolName) {\n" +
      "  return typeof toolName === 'string' && _BRAIN_TOOL_RE.test(toolName);\n" +
      "}";
    const revertedBody =
      "function isBrainTool(toolName) {\n" +
      "  return typeof toolName === 'string' && toolName.indexOf('mcp__brain_') === 0;\n" +
      "}";
    assert.ok(
      original.includes(liveBody),
      'LEG 6 setup: could not find the exact anchored isBrainTool body to mutate -- a refactor may have moved it'
    );

    try {
      fs.writeFileSync(SANITIZE_MODULE_PATH, original.replace(liveBody, revertedBody));

      const r = runHook(leg1Stdin);
      assert.strictEqual(r.status, 0, 'LEG 6a: hook must still exit 0 under the reverted authority; stderr=' + (r.stderr || ''));
      const envelope = JSON.parse(r.stdout);
      assert.strictEqual(
        envelope.hookSpecificOutput,
        undefined,
        'LEG 6a: reverting isBrainTool to the pre-239 bare-prefix body must make the live plugin-scoped name FALL THROUGH unrewritten (the dead-seam gate reopening)'
      );
      ok('LEG 6a: reverted isBrainTool reopens the dead seam -- the live plugin-scoped name from LEG 1 now falls through unrewritten');
    } finally {
      fs.writeFileSync(SANITIZE_MODULE_PATH, original);
    }

    const restored = fs.readFileSync(SANITIZE_MODULE_PATH, 'utf8');
    assert.strictEqual(restored, original, 'LEG 6b: file must be restored byte-identical after the mutation');

    const postDiff = spawnSync('git', ['diff', '--stat', '--', SANITIZE_MODULE_RELPATH], { cwd: ROOT, encoding: 'utf8' });
    assert.strictEqual(
      (postDiff.stdout || '').trim(),
      '',
      'LEG 6b: git diff --stat -- ' + SANITIZE_MODULE_RELPATH + ' must be EMPTY after restore'
    );

    const r2 = runHook(leg1Stdin);
    assert.strictEqual(r2.status, 0, 'LEG 6b: post-restore re-run of LEG 1 must exit 0; stderr=' + (r2.stderr || ''));
    const envelope2 = JSON.parse(r2.stdout);
    assert.ok(envelope2.hookSpecificOutput, 'LEG 6b: post-restore re-run of LEG 1 must be green again (sanitize branch fires)');
    ok('LEG 6b: restore verified byte-identical, git diff --stat empty, LEG 1 green again');
  })();

  console.log('');
  console.log('test-239-pii-sanitizer-liveness: all 6 legs PASSED (' + okCount + ' assertions ok)');
  process.exit(0);
}

main().catch(function (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  // Best-effort restore in case a mutation is left in flight by an
  // unexpected throw outside LEG 6's own try/finally.
  try {
    const cur = fs.readFileSync(SANITIZE_MODULE_PATH, 'utf8');
    if (cur.indexOf("toolName.indexOf('mcp__brain_') === 0") !== -1 && cur.indexOf('_BRAIN_TOOL_RE') === -1) {
      const restore = spawnSync('git', ['checkout', '--', SANITIZE_MODULE_RELPATH], { cwd: ROOT });
      if (restore.status === 0) console.error('recovered: restored ' + SANITIZE_MODULE_RELPATH + ' via git checkout');
    }
  } catch (_e) { /* best-effort only */ }
  process.exit(1);
});
