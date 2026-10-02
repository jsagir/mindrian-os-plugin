'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * The hermetic proof for the Eureka MCP surface.
 *
 * History: Quick-260717-2vf Task 2 wrote this file for the three intelligence
 * compute subcommands (eureka-run / eureka-status / eureka-report), which drove
 * the standalone Eureka runner in-process or as a detached child. Phase 366
 * plan 16 turned those subcommands into a pointer at research_run (pinned by
 * tests/test-366-router-redirects.cjs), and Phase 366 (D-02) retires the
 * runner. Plan 366-26 migrated this file to the research_run perspective ops
 * (perspective_recall, perspective_candidates, perspective_judge) and their
 * deprecated eureka_* aliases, keeping the tool-shape assertions. The legacy
 * branch's source-shape checks (the in-flight Map, the detached spawn) retired
 * with the branch; see 366-26-SUMMARY.md.
 *
 * Follows the tests/test-212-part8-boundary.cjs idiom: node:assert/strict,
 * ok/fail counters, named check functions awaited in a serial async main, a
 * summary line, process.exit(failed === 0 ? 0 : 1). No em-dashes, no emoji.
 *
 * WHAT IT PROVES:
 *   CHECK 1 - enum + parity: eureka-run / eureka-status / eureka-report never
 *             leak into ALL_TOOL_COMMANDS (unique membership pinned at 65), and
 *             research_run's op enum carries the three perspective ops and the
 *             three deprecated eureka_* aliases (read-only: the tool description
 *             and schema are not changed here).
 *   CHECK 2 - in-process recall: perspective_recall (eureka) answers ok and its
 *             candidates file is already on disk under
 *             <room>/.mindrian/eureka-perspective/<tag>/ when the call returns
 *             (no detached child, no status poll, zero network).
 *   CHECK 3 - candidates/judge output contract: perspective_candidates pages the
 *             candidates file verbatim (same pairs, same order, total equal to
 *             the file); perspective_judge returns a Stage A summary; an unknown
 *             run_tag refuses candidates_missing with a hint naming
 *             perspective_recall (the old {"state":"none"} analog).
 *   CHECK 4 - deprecated aliases: eureka_recall, eureka_candidates and
 *             eureka_judge answer under their legacy op name with deprecated
 *             true and use_instead naming the perspective op.
 *   CHECK 5 - unknown-room guard: a boot room that does not exist, with every
 *             resolver leg missing, refuses no_bound_room and writes nothing.
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs set before
 * any repo module loads; CLAUDE_ACTIVE_ROOM, CLAUDE_CODE_SESSION_ID and
 * MINDRIAN_MCP_FIRST are cleared; the network guard counts every attempt.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-mcp-home-'));
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-mcp-roomshome-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
if (hygiene.scrubVendorKey) hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: function () { return 0; }, restore: function () {} };

const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const recall = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));
const research = require(path.join(REPO_ROOT, 'lib/mcp/tools/research.cjs'));
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

const TAG = '20261002T000026Z';

// A stub server that captures both registration shapes (server.tool and
// server.registerTool), then a caller that parses the JSON text body.
function harness(roomDir) {
  const captured = new Map();
  const stub = {
    tool: function (name) { const rest = Array.prototype.slice.call(arguments, 1); captured.set(name, rest[rest.length - 1]); },
    registerTool: function (name, cfg, fn) { captured.set(name, fn); captured.set(name + ':cfg', cfg); },
  };
  registerCoreTools(stub, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
  return {
    captured: captured,
    call: async function (input) {
      const fn = captured.get('research_run');
      assert.equal(typeof fn, 'function', 'research_run is registered');
      const raw = await fn(input, { sessionId: 'sess-eureka-mcp' });
      return JSON.parse(raw.content[0].text);
    },
  };
}

function pairOf(c) { return c.a + '|' + c.b; }

// ---------------------------------------------------------------------------
// CHECK 1 - enum + parity (module + schema, read-only).
// ---------------------------------------------------------------------------
function check1_enumAndParity(ctx) {
  const label = 'CHECK 1 - enum + parity (eureka compute names not in ALL_TOOL_COMMANDS; research_run carries the perspective ops and aliases)';
  try {
    const cmds = require(TOOL_ROUTER_PATH).ALL_TOOL_COMMANDS;
    for (const c of ['eureka-run', 'eureka-status', 'eureka-report']) {
      assert.ok(cmds.indexOf(c) === -1, label + ': ' + c + ' leaked into ALL_TOOL_COMMANDS');
    }
    const uniq = new Set(cmds.map(function (c) { return String(c).toLowerCase(); }));
    assert.equal(uniq.size, 65, label + ': ALL_TOOL_COMMANDS unique membership is ' + uniq.size + ', expected 65');

    const OPS = research._internal.OPS;
    const schema = research._internal.inputSchema;
    for (const op of ['perspective_recall', 'perspective_candidates', 'perspective_judge', 'eureka_recall', 'eureka_candidates', 'eureka_judge']) {
      assert.ok(OPS.indexOf(op) !== -1, label + ': research_run OPS is missing ' + op);
      assert.equal(schema.safeParse({ op: op }).success, true, label + ': the research_run schema rejects op ' + op);
    }
    for (const legacy of ['eureka-run', 'eureka-status', 'eureka-report']) {
      assert.equal(schema.safeParse({ op: legacy }).success, false, label + ': research_run accepts the legacy subcommand ' + legacy);
    }
    assert.equal(schema.safeParse({ op: 'perspective_recall', perspective: 'eureka' }).success, true, label + ': perspective eureka is not in the schema enum');
    const cfg = ctx.h.captured.get('research_run:cfg') || {};
    assert.equal(cfg.inputSchema, schema, label + ': the registered research_run inputSchema is not the module schema');
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 2 - in-process recall, run files on disk at return.
// ---------------------------------------------------------------------------
async function check2_inProcessRecall(ctx) {
  const label = 'CHECK 2 - in-process recall (perspective_recall answers ok; candidates on disk at return; zero network)';
  try {
    const before = net.attempts();
    const r = await ctx.h.call({ op: 'perspective_recall', perspective: 'eureka', run_tag: TAG });
    assert.equal(r.ok, true, label + ': recall not ok: ' + JSON.stringify(r).slice(0, 300));
    assert.equal(r.op, 'perspective_recall');
    assert.equal(r.perspective, 'eureka');
    assert.equal(r.run_tag, TAG);
    assert.ok(r.deprecated === undefined, label + ': the perspective op must not be marked deprecated');
    assert.ok(Array.isArray(r.top) && r.top.length > 0, label + ': the fixture room must recall at least one pair');
    const runDir = recall.runDirFor(ctx.roomDir, TAG);
    assert.ok(runDir.indexOf(path.join(ctx.roomDir, '.mindrian', 'eureka-perspective')) === 0,
      label + ': run dir ' + runDir + ' is not under .mindrian/eureka-perspective');
    const onDisk = recall.readCandidates(ctx.roomDir, TAG);
    assert.ok(onDisk && Array.isArray(onDisk.candidates) && onDisk.candidates.length > 0,
      label + ': no candidates file on disk when the call returned');
    assert.deepEqual(r.top.map(pairOf), onDisk.candidates.slice(0, r.top.length).map(pairOf),
      label + ': the recall top list is not the head of the candidates file');
    assert.equal(net.attempts() - before, 0, label + ': recall attempted the network');
    ctx.total = onDisk.candidates.length;
    ctx.disk = onDisk.candidates;
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 3 - candidates / judge output contract, and the none analog.
// ---------------------------------------------------------------------------
async function check3_candidatesJudgeContract(ctx) {
  const label = 'CHECK 3 - candidates/judge contract (verbatim page, Stage A summary, candidates_missing for an unknown run_tag)';
  try {
    assert.ok(Array.isArray(ctx.disk), label + ': CHECK 2 did not leave a candidates file');
    const page = await ctx.h.call({ op: 'perspective_candidates', perspective: 'eureka', run_tag: TAG, limit: 50, offset: 0 });
    assert.equal(page.ok, true, label + ': candidates not ok: ' + JSON.stringify(page).slice(0, 300));
    assert.equal(page.total, ctx.total, label + ': total ' + page.total + ' is not the file length ' + ctx.total);
    assert.deepEqual(page.items.map(pairOf), ctx.disk.slice(0, page.items.length).map(pairOf),
      label + ': the page is not the candidates file in order');
    assert.equal(page.offset, 0);
    assert.equal(page.has_more, page.items.length < ctx.total);

    const judged = await ctx.h.call({ op: 'perspective_judge', perspective: 'eureka', run_tag: TAG });
    assert.equal(judged.ok, true, label + ': judge not ok: ' + JSON.stringify(judged).slice(0, 300));
    assert.equal(judged.op, 'perspective_judge');
    assert.ok(judged.summary && typeof judged.summary === 'object', label + ': judge carries no Stage A summary');
    const after = await ctx.h.call({ op: 'perspective_candidates', perspective: 'eureka', run_tag: TAG, limit: 5 });
    assert.equal(after.judged, true, label + ': the verdicts do not show up in the next page');

    const none = await ctx.h.call({ op: 'perspective_candidates', perspective: 'eureka', run_tag: '19990101T000000Z' });
    assert.equal(none.ok, false, label + ': an unknown run_tag answered ok');
    assert.equal(none.reason, 'candidates_missing', label + ': reason is ' + none.reason);
    assert.ok(/perspective_recall/.test(String(none.hint || '')), label + ': the hint does not name perspective_recall');
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 4 - the deprecated eureka_* aliases.
// ---------------------------------------------------------------------------
async function check4_deprecatedAliases(ctx) {
  const label = 'CHECK 4 - deprecated aliases (eureka_recall / eureka_candidates / eureka_judge: legacy op, deprecated true, use_instead)';
  try {
    const tag2 = '20261002T000027Z';
    const rec = await ctx.h.call({ op: 'eureka_recall', run_tag: tag2 });
    assert.equal(rec.ok, true, label + ': eureka_recall not ok: ' + JSON.stringify(rec).slice(0, 300));
    assert.equal(rec.op, 'eureka_recall');
    assert.equal(rec.perspective, 'eureka');
    assert.equal(rec.deprecated, true);
    assert.equal(rec.use_instead, 'perspective_recall');
    const cand = await ctx.h.call({ op: 'eureka_candidates', run_tag: tag2 });
    assert.equal(cand.ok, true, label + ': eureka_candidates not ok');
    assert.equal(cand.op, 'eureka_candidates');
    assert.equal(cand.deprecated, true);
    assert.equal(cand.use_instead, 'perspective_candidates');
    const jud = await ctx.h.call({ op: 'eureka_judge', run_tag: tag2 });
    assert.equal(jud.ok, true, label + ': eureka_judge not ok');
    assert.equal(jud.op, 'eureka_judge');
    assert.equal(jud.deprecated, true);
    assert.equal(jud.use_instead, 'perspective_judge');
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 5 - unknown-room guard via the total-miss fallback leg.
// ---------------------------------------------------------------------------
async function check5_unknownRoomGuard() {
  const label = 'CHECK 5 - unknown-room guard (nonexistent boot room refuses no_bound_room and writes nothing)';
  try {
    const missingDir = path.join(os.tmpdir(), 'mos-eureka-missing-' + process.pid + '-' + Date.now());
    const h2 = harness(missingDir);
    const resp = await h2.call({ op: 'perspective_recall', perspective: 'eureka', run_tag: TAG });
    assert.equal(resp.ok, false, label + ': a nonexistent room answered ok');
    assert.equal(resp.reason, 'no_bound_room', label + ': reason is ' + resp.reason);
    assert.equal(fs.existsSync(missingDir), false, label + ': the guard created the missing room dir');
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// Serial async main.
// ---------------------------------------------------------------------------
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-mcp-'));
  const built = fixture.buildPerspectiveRoom(root, { name: 'room' });
  const ctx = { roomDir: built.roomDir, h: harness(built.roomDir) };
  try {
    check1_enumAndParity(ctx);
    await check2_inProcessRecall(ctx);
    await check3_candidatesJudgeContract(ctx);
    await check4_deprecatedAliases(ctx);
    await check5_unknownRoomGuard();
    const attempts = net.attempts();
    if (attempts === 0) ok('zero network attempts over the whole run');
    else fail('zero network attempts over the whole run', new Error(attempts + ' attempt(s)'));
  } finally {
    try { net.restore(); } catch (_e) { /* best effort */ }
    for (const d of [root, TMP_HOME, ROOMS_HOME]) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  process.stdout.write('\n');
  process.stdout.write('eureka mcp tools: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().then(null, function (err) {
  process.stderr.write('test-eureka-mcp-tools: FATAL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
