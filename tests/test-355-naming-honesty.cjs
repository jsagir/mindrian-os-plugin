#!/usr/bin/env node
'use strict';

/*
 * tests/test-355-naming-honesty.cjs -- Phase 355 Plan 05, Task 1 (D-25, D-26).
 *
 * SPEC Req 3 (HIPS-03): every intelligence surface says what it does.
 * scout-hsi is reference text under a compute-shaped name; MCP whitespace_scan
 * is open questions plus unsupported claims under a whitespace-engine-shaped
 * description. Neither surface is renamed (D-23, D-24, D-26); this file pins
 * BOTH names unchanged AND both descriptions honest. This is the real gate:
 * scripts/check-tool-honesty.cjs only checks WRITE claims
 * (see its own :1099-1110 area), so its --report output naming neither
 * surface as a finding is necessary but not sufficient on its own.
 *
 * WRITTEN FIRST (TDD RED): lib/mcp/tool-router.cjs and
 * lib/mcp/tools/sensors.cjs have not been touched by this plan yet. Run
 * against the pre-fix files, the description-wording checks below FAIL; the
 * no-rename and no-write checks already PASS (both surfaces already carry
 * their real names and scout-hsi already gets a NOT EXECUTED banner from an
 * earlier phase).
 *
 * METHOD. scout-hsi: register the real router tools against the
 * tests/helpers/fixture-room-354.cjs idiom (a fake server object storing
 * description + handler, the same shape captureToolServer already uses,
 * extended locally to also keep the description string) and invoke the
 * REAL orchestration handler with a genuine tmp room -- ground truth over
 * the wire's in-process equivalent, not a source grep, for the banner text.
 * whitespace_scan: same registration idiom against lib/mcp/tools/sensors.cjs.
 * Description strings are read from the registered tool definition (the
 * second argument server.tool(name, description, ...) received), never
 * parsed out of source text. UNIMPLEMENTED_MUTATING_ORCHESTRATION is a
 * module-private Set with no exported test hook (module.exports._test does
 * not carry it); its membership is a source-text pin here (D-26 idiom: "a
 * Set literal's own membership is not observable over the wire", the same
 * Group C rationale tests/test-276-room-content-honesty.cjs already uses).
 * check-tool-honesty is driven exactly as a human/doctor.cjs would run it:
 * spawnSync(process.execPath, ['scripts/check-tool-honesty.cjs', '--report']).
 *
 * Canon Part 8: zero network. Zero Brain/network tokens; installNetGuard()
 * proves it. Hermetic: every room is a fresh mkdtemp, removed on exit.
 *
 * Run: node tests/test-355-naming-honesty.cjs
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { scrubVendorKey, installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');

// Hygiene FIRST, before any repo require (Pitfall 16).
scrubVendorKey();
const netGuard = installNetGuard();

const { makeScratchRoom } = require('./helpers/fixture-room-354.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const SENSORS_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs');

const registerRouterTools = require(TOOL_ROUTER_PATH).registerRouterTools;
const sensorsModule = require(SENSORS_PATH);

const c = makeChecker('355-naming-honesty');

// ---------------------------------------------------------------------------
// A capture-server that keeps BOTH the description string and the handler,
// same shape as fixture-room-354.cjs's captureToolServer() but extended
// locally (that shared helper discards the description on purpose -- Phase
// 354 never needed it; this plan does).
// ---------------------------------------------------------------------------
function captureToolServerWithDescriptions() {
  const tools = new Map(); // name -> { description, handler }
  const server = {
    tool: function tool(name, description, _schema, handler) {
      tools.set(name, { description: description, handler: handler });
    },
    registerTool: function registerTool(name, config, handler) {
      const description = (config && typeof config.description === 'string') ? config.description : '';
      tools.set(name, { description: description, handler: handler });
    },
  };
  return { server, tools };
}

// ---------------------------------------------------------------------------
// Register the real orchestration tool (tool-router.cjs) against a genuine
// tmp room.
// ---------------------------------------------------------------------------
const room1 = makeScratchRoom('355-naming-honesty-router');
const { server: routerServer, tools: routerTools } = captureToolServerWithDescriptions();
registerRouterTools(routerServer, room1.room, REPO_ROOT, { full: '' }, 'cli');

const orchestration = routerTools.get('orchestration');
c.check('orchestration tool registered', !!orchestration, 'registerRouterTools must register orchestration');

// ---------------------------------------------------------------------------
// Register the real sensors tools (sensors.cjs) against a second tmp room.
// ---------------------------------------------------------------------------
const room2 = makeScratchRoom('355-naming-honesty-sensors');
const { server: sensorsServer, tools: sensorsTools } = captureToolServerWithDescriptions();
sensorsModule.register(sensorsServer, { fallbackRoomDir: room2.room, pluginRoot: REPO_ROOT, surface: 'cli' });

const whitespaceScan = sensorsTools.get('whitespace_scan');
c.check('whitespace_scan tool registered under its exact name (D-26)', !!whitespaceScan);

// ---------------------------------------------------------------------------
// D-23: scout-hsi -- calling the real orchestration handler must return the
// NOT EXECUTED banner, the honest "reference only, no compute" wording, and
// the exact CLI pointer, and must write nothing.
// ---------------------------------------------------------------------------
(async () => {
  let scoutHsiText = '';
  if (orchestration) {
    const result = await orchestration.handler(
      { command: 'scout-hsi', context: undefined, room: undefined, confirmArchived: undefined },
      {}
    );
    scoutHsiText = (result && result.content && result.content[0] && result.content[0].text) || '';
  }

  c.check('scout-hsi handler response contains NOT EXECUTED', scoutHsiText.indexOf('NOT EXECUTED') !== -1);
  c.check('scout-hsi handler response contains "reference only, no compute"', scoutHsiText.indexOf('reference only, no compute') !== -1);
  c.check('scout-hsi handler response contains "/mos:scout hsi"', scoutHsiText.indexOf('/mos:scout hsi') !== -1);

  // No .hsi-results.json anywhere under the tmp room afterwards.
  const hsiResultsFiles = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name === '.hsi-results.json') hsiResultsFiles.push(abs);
    }
  })(room1.root);
  c.check('scout-hsi wrote no .hsi-results.json under the tmp room', hsiResultsFiles.length === 0, JSON.stringify(hsiResultsFiles));

  // ---------------------------------------------------------------------------
  // D-23 (no rename): 'scout-hsi' is still a member of
  // UNIMPLEMENTED_MUTATING_ORCHESTRATION. Source-text pin (D-26 idiom): the
  // Set is module-private with no _test export, so its membership is not
  // observable over the wire (same rationale as test-276-room-content-
  // honesty.cjs's Group C).
  // ---------------------------------------------------------------------------
  const routerSource = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
  const setMatch = routerSource.match(/const UNIMPLEMENTED_MUTATING_ORCHESTRATION = new Set\(\[([\s\S]*?)\]\);/);
  c.check('UNIMPLEMENTED_MUTATING_ORCHESTRATION Set literal found in source', !!setMatch);
  const setBody = setMatch ? setMatch[1] : '';
  c.check("'scout-hsi' is still a member of UNIMPLEMENTED_MUTATING_ORCHESTRATION (D-23: no rename, no wiring)", /'scout-hsi'/.test(setBody));

  // ---------------------------------------------------------------------------
  // D-23: the orchestration tool's own description sentence naming scout-hsi
  // must say "reference only, no compute".
  // ---------------------------------------------------------------------------
  const orchestrationDescription = orchestration ? orchestration.description : '';
  c.check('orchestration description names scout-hsi', orchestrationDescription.indexOf('scout-hsi') !== -1);
  const scoutHsiSentenceMatch = orchestrationDescription.match(/[^.]*\bscout-hsi\b[^.]*\./g) || [];
  const scoutHsiSentenceHasHonestWording = scoutHsiSentenceMatch.some((s) => s.indexOf('reference only, no compute') !== -1);
  c.check(
    "orchestration description's scout-hsi sentence contains 'reference only, no compute'",
    scoutHsiSentenceHasHonestWording,
    JSON.stringify(scoutHsiSentenceMatch)
  );

  // ---------------------------------------------------------------------------
  // D-24: whitespace_scan's description must lead with the honest sentence
  // and disclaim the HSI engine explicitly.
  // ---------------------------------------------------------------------------
  const whitespaceDescription = whitespaceScan ? whitespaceScan.description : '';
  c.check(
    "whitespace_scan description starts with 'Returns open questions and unsupported claims.'",
    whitespaceDescription.indexOf('Returns open questions and unsupported claims.') === 0,
    whitespaceDescription.slice(0, 80)
  );
  c.check(
    "whitespace_scan description contains \"NOT the `/mos:whitespace` HSI engine\"",
    whitespaceDescription.indexOf('NOT the `/mos:whitespace` HSI engine') !== -1
  );

  // ---------------------------------------------------------------------------
  // Neither description may claim compute/run/scan-shaped HSI/whitespace
  // "engine" behavior OUTSIDE the honest NOT sentence itself (the NOT
  // sentence legitimately contains "HSI engine" / "whitespace engine" as the
  // thing being DISCLAIMED, not claimed).
  // ---------------------------------------------------------------------------
  const engineClaimRe = /\b(computes?|runs?|scans?)\b[^.]{0,40}\b(HSI|whitespace)\b[^.]{0,20}\bengine\b/i;
  function stripNotSentences(description) {
    // Remove the one sentence that legitimately names the disclaimed engine
    // (the sentence containing "NOT the" and "engine"), leaving the rest of
    // the description for the false-claim scan.
    return description
      .split(/(?<=\.)\s+/)
      .filter((sentence) => !(/\bNOT\b/.test(sentence) && /\bengine\b/i.test(sentence)))
      .join(' ');
  }
  const orchestrationOutsideNot = stripNotSentences(orchestrationDescription);
  const whitespaceOutsideNot = stripNotSentences(whitespaceDescription);
  c.check(
    'orchestration description makes no compute/run/scan HSI-or-whitespace-engine claim outside its NOT sentence',
    !engineClaimRe.test(orchestrationOutsideNot),
    orchestrationOutsideNot
  );
  c.check(
    'whitespace_scan description makes no compute/run/scan HSI-or-whitespace-engine claim outside its NOT sentence',
    !engineClaimRe.test(whitespaceOutsideNot),
    whitespaceOutsideNot
  );

  // ---------------------------------------------------------------------------
  // D-25: the real gate. check-tool-honesty.cjs --report must carry no
  // FINDING (a non-[OK]-prefixed line) naming either surface. Driven exactly
  // as doctor.cjs / a human would run it.
  // ---------------------------------------------------------------------------
  const reportResult = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs'), '--report'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const reportStdout = (reportResult && reportResult.stdout) || '';
  c.check('check-tool-honesty --report produced output', reportStdout.length > 0);
  const namedLines = reportStdout.split(/\r?\n/).filter((line) => line.indexOf('scout-hsi') !== -1 || line.indexOf('whitespace_scan') !== -1);
  c.check('check-tool-honesty --report names at least one line for scout-hsi or whitespace_scan', namedLines.length > 0, JSON.stringify(namedLines));
  const nonOkNamedLines = namedLines.filter((line) => line.indexOf('[OK]') !== 0);
  c.check(
    'check-tool-honesty --report has no finding (non-[OK]) line naming scout-hsi or whitespace_scan',
    nonOkNamedLines.length === 0,
    JSON.stringify(nonOkNamedLines)
  );

  // ---------------------------------------------------------------------------
  // Hygiene close-out: zero network reach anywhere in this run.
  // ---------------------------------------------------------------------------
  c.check('installNetGuard: zero fetch attempts across this whole test', netGuard.attempts() === 0);

  room1.cleanup();
  room2.cleanup();
  netGuard.restore();

  process.exit(c.summary());
})().catch((err) => {
  console.error('FATAL: ' + (err && err.stack ? err.stack : err));
  try { room1.cleanup(); } catch (_e) { /* best-effort */ }
  try { room2.cleanup(); } catch (_e) { /* best-effort */ }
  process.exit(1);
});
