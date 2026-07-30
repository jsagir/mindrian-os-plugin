#!/usr/bin/env node
// Phase 196 -- part8-egress-guard-hook stdin -> exit-code test (PB8-04/05/07/08).
//
// WAVE 0 CONTRACT: authored before the hook lands (Nyquist). It checks for
// scripts/part8-egress-guard-hook.cjs; while absent it prints SKIP and exits 0.
// The F.1-gate and Brain-less-degrade legs are FURTHER guarded behind the gate
// module (lib/hmi/part8-egress-gate.cjs, lands 196-05) so they stay SKIP-safe
// until their surface exists.
//
// Hook contract (RESEARCH / write-scope-check clone):
//   - non-Brain tool_name           -> exit 0 (passthrough, isBrainTool recheck)
//   - foreign Brain-like server name -> exit 0 (passthrough, threat T3, Phase 239)
//   - verdict block (CONTENT-SET)    -> exit 2 + Part 8 stderr message (PB8-04)
//   - clean MOVE-SET                 -> exit 0 (PB8-04)
//   - malformed/garbage stdin        -> exit 0 fail-OPEN (A3 accepted risk)
//   - ambiguous + Brain available    -> exit 2 after rendering the F.1 gate (PB8-07)
//   - ambiguous + Brain-less         -> exit 0, LOCAL-log only, no gate (PB8-08, D-08a)
//
// Test seam for the isAvailable branch: the hook honors PART8_FORCE_BRAIN_AVAILABLE
// ('1' -> available, '0' -> Brain-less) so the ambiguous branch is deterministically
// exercisable without a live Brain wire. This env override is test-only.
//
// Phase 239 (BRAIN-01) bare-vs-scoped decision rule: this file drives the HOOK
// SCRIPT over stdin, which calls sanitizer.isBrainTool(toolName) BEFORE ever
// calling classify() (see scripts/part8-egress-guard-hook.cjs:151), so every
// tool_name fixture below that is meant to be RECOGNIZED as the Brain door
// must be a live SCOPED name -- the bare form fails isBrainTool and the hook
// allow()s before classify() ever runs. Every live scoped name is DERIVED at
// run time from scripts/check-brain-tool-liveness.cjs's
// enumerateLiveBrainTools() + composeScopedNames(), never hand-typed
// (RESEARCH.md Pitfall 5). The only hand-typed literal is the DELIBERATE
// negative fixture for threat T3 (a foreign server name that must never
// resolve as live).
//
// Zero-dep: child_process spawnSync with a JSON stdin envelope. CJS only. No em-dashes.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const GATE = path.join(ROOT, 'lib', 'hmi', 'part8-egress-gate.cjs');

if (!fs.existsSync(HOOK)) {
  console.log('SKIP: scripts/part8-egress-guard-hook.cjs not present (Wave 0) -- inert until 196-04 lands the hook');
  process.exit(0);
}

// Run the hook with a stdin string and optional extra env; return { status, stderr }.
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

function envelope(obj) { return JSON.stringify(obj); }

async function main() {
  // ---------------------------------------------------------------------
  // Derive live scoped Brain tool names from the same authority Phase 239's
  // acceptance criteria demand (scripts/check-brain-tool-liveness.cjs's real
  // stdio tools/list handshake), never hand-typed.
  // ---------------------------------------------------------------------
  const liveness = require('../scripts/check-brain-tool-liveness.cjs');
  const enumeration = await liveness.enumerateLiveBrainTools();
  assert.ok(
    enumeration.names && enumeration.names.length > 0,
    'setup: enumerateLiveBrainTools must return at least one live bare tool name'
  );
  const pluginName = liveness.resolvePluginName();
  const serverName = liveness.resolveServerName();
  const allScoped = liveness.composeScopedNames(enumeration.names, pluginName, serverName);

  function findScopedContaining(bareSubstr) {
    const hit = allScoped.find(function (n) {
      return n.indexOf('mcp__plugin_') === 0 && n.indexOf(bareSubstr) !== -1;
    });
    assert.ok(hit, 'setup: no live plugin-scoped name found containing "' + bareSubstr + '"');
    return hit;
  }

  // brain_query / brain_ask are the two bare names classify()'s
  // _isFreeFormTool substring check keys on (lib/core/part8-egress-guard.cjs).
  const QUERY_TOOL_NAME = findScopedContaining('brain_query');
  const ASK_TOOL_NAME = findScopedContaining('brain_ask');

  // Envelope shape (brain-response-sanitize-hook / part8-egress-guard-hook):
  // { tool_name, tool_input, session_id }.
  const CONTENT_SET = envelope({
    tool_name: QUERY_TOOL_NAME,
    tool_input: { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    session_id: 's1',
  });
  const CLEAN_MOVE_SET = envelope({
    tool_name: QUERY_TOOL_NAME,
    tool_input: {
      packet_version: '1.0',
      job: 'select_methodology',
      privacy_mode: 'strict',
      local_graph_summary: { nodes: [{ summary: 'sha256:' + 'a'.repeat(64) }] },
    },
    session_id: 's2',
  });
  const NON_BRAIN = envelope({ tool_name: 'Write', tool_input: { path: 'x.md' }, session_id: 's3' });
  const GARBAGE = 'this is not json at all }{';
  const AMBIGUOUS = envelope({
    tool_name: ASK_TOOL_NAME,
    tool_input: { question: 'opaque blob with no clear content and no proven move-set shape' },
    session_id: 's4',
  });
  // Threat T3 (Phase 239): DELIBERATE hand-typed literal. A foreign MCP
  // server whose name merely resembles the Brain must never be recognized as
  // the Brain door; naming it literally here is the point of this negative
  // fixture (grep-exempt per this plan's acceptance criteria).
  const FOREIGN_SERVER = envelope({
    tool_name: 'mcp__plugin_evil_evil-brain__brain_query',
    tool_input: { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    session_id: 's5',
  });

  // -------------------------------------------------------------------------
  // PB8-04: CONTENT-SET on a Brain tool -> exit 2 with a Part 8 stderr message.
  // -------------------------------------------------------------------------
  (function pb8_04_block() {
    const r = runHook(CONTENT_SET);
    assert.strictEqual(r.status, 2, 'PB8-04: CONTENT-SET on a Brain tool must exit 2 (block)');
    assert.ok(/part 8/i.test(r.stderr), 'PB8-04: block must emit a Part 8 stderr message');
  })();

  // -------------------------------------------------------------------------
  // PB8-04: clean MOVE-SET -> exit 0 (allow).
  // -------------------------------------------------------------------------
  (function pb8_04_allow() {
    const r = runHook(CLEAN_MOVE_SET);
    assert.strictEqual(r.status, 0, 'PB8-04: clean MOVE-SET must exit 0 (allow)');
  })();

  // -------------------------------------------------------------------------
  // Passthrough: non-Brain tool_name -> exit 0 (isBrainTool recheck, defense-in-depth).
  // -------------------------------------------------------------------------
  (function passthrough() {
    const r = runHook(NON_BRAIN);
    assert.strictEqual(r.status, 0, 'non-Brain tool_name must exit 0 (passthrough)');
  })();

  // -------------------------------------------------------------------------
  // Threat T3 (Phase 239): a foreign MCP server whose name merely resembles
  // the Brain must ALSO exit 0 (passthrough via isBrainTool, BEFORE classify()
  // ever runs), even when its tool_input carries the exact CONTENT-SET
  // payload that would BLOCK if it were recognized as the real Brain door.
  // This is the scoping proof: the guard is Brain-specific, not a general
  // egress firewall for every MCP tool.
  // -------------------------------------------------------------------------
  (function foreign_server_t3() {
    const r = runHook(FOREIGN_SERVER);
    assert.strictEqual(r.status, 0, 'T3: a foreign server name must exit 0 (passthrough), never recognized as the Brain door');
  })();

  // -------------------------------------------------------------------------
  // A3: malformed/garbage stdin (infra error) -> exit 0 fail-OPEN.
  // -------------------------------------------------------------------------
  (function fail_open() {
    const r = runHook(GARBAGE);
    assert.strictEqual(r.status, 0, 'A3: garbage stdin must fail-OPEN (exit 0), never brick a Brain call');
  })();

  // -------------------------------------------------------------------------
  // PB8-07 / PB8-08: the ambiguous branch. Guarded behind the F.1 gate module so it
  // stays SKIP-safe until 196-05. When present, exercise both availability legs via
  // the PART8_FORCE_BRAIN_AVAILABLE test seam.
  // -------------------------------------------------------------------------
  if (fs.existsSync(GATE)) {
    // PB8-07: ambiguous + Brain available -> exit 2 after rendering the F.1 gate.
    (function pb8_07_gate() {
      const r = runHook(AMBIGUOUS, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
      assert.strictEqual(r.status, 2, 'PB8-07: ambiguous + Brain available must exit 2 (gate rendered)');
    })();

    // PB8-08: ambiguous + Brain-less -> exit 0, LOCAL-log only, no gate (D-08a).
    (function pb8_08_degrade() {
      const r = runHook(AMBIGUOUS, { PART8_FORCE_BRAIN_AVAILABLE: '0' });
      assert.strictEqual(r.status, 0, 'PB8-08: ambiguous + Brain-less must exit 0 (LOCAL-log, no gate)');
    })();

    // PB8-07 contract: the F.1 gate offers {Reformulate, Cancel} and NO send-anyway
    // verb. Assert directly against the gate renderer (in-process, surface-agnostic).
    (function pb8_07_verbs() {
      const gate = require(GATE);
      const render = gate.renderGate || gate.render || gate.default;
      assert.strictEqual(typeof render, 'function', 'part8-egress-gate must export a render function');
      const out = render({ tier: 'A', class: 'personal_identifier' });
      const contract = out && out.contract ? out.contract : out;
      const verbs = (contract && contract.verbs) || [];
      assert.ok(verbs.indexOf('Reformulate') !== -1, 'PB8-07: F.1 gate must offer Reformulate');
      assert.ok(verbs.indexOf('Cancel') !== -1, 'PB8-07: F.1 gate must offer Cancel');
      const forbidden = ['Send', 'SendAnyway', 'Send-Anyway', 'Approve', 'Override', 'Proceed'];
      forbidden.forEach(function (v) {
        assert.ok(verbs.indexOf(v) === -1,
          'PB8-07: F.1 gate must NOT offer a send-anyway verb (found "' + v + '") -- honors D-01');
      });
    })();

    console.log('PASS: part8-egress-guard-hook (PB8-04/05/07/08 + T3) -- exit codes + F.1 gate contract green');
  } else {
    console.log('PARTIAL PASS: hook exit-code legs (PB8-04/05, T3) green; F.1 gate + degrade SKIPPED (part8-egress-gate.cjs absent, lands 196-05)');
  }

  process.exit(0);
}

main().catch(function (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
