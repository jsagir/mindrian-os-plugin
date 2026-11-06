#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 01: pin the observed installed-layout Eureka table (the before-state).
 *
 * The probe in tests/helpers/eureka-installed-layout-387.cjs packs the repo, lays it out as the Claude
 * Code plugin cache in a scratch HOME, starts the real stdio server and calls every tool whose name
 * starts with eureka under six engine states. This test compares that run with EXPECT below.
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   I1  S1 tools/list holds the 24 names in EXPECT, for both client identities (the runtime count)
 *   I2  S1 unbound: every engine tool answers engine_not_configured with engine_state absent (Plan 387-05: the
 *       engine check runs before the room projection); eureka_graph_project answers no_bound_room
 *   I3  S1 bound: engine tools answer the typed engine_not_configured refusal; job tools answer
 *       job_session_not_found; eureka_graph_project answers ok; eureka_critic answers a ruling with a
 *       verdict on the installed layout, no engine needed (the baseline file ships since quick 261106)
 *   I4  S3 answers engine_checkout_unavailable; S4, S5 and S6 answer engine_unavailable with the exact text
 *   I5  S1 and S2 give the same tool list and the same refusals
 *   I6  the perspective call answers ok on the installed layout with no engine and no network attempt
 *   I9  S7 (Plan 387-05): a saved setting and a minimal environment pass the gate, then fail at the missing uv
 *   I7  pin sensitivity: a deliberately wrong copy of EXPECT fails the same comparison
 *   I8  S6 argument and environment pin (Plan 387-11: the uv error line is captured as engine_start_line): a plain uv run on every spawning path
 *
 * Exit: 0 all arms pass; 1 any FAIL; 77 ENV GAP (named reason) when the layout cannot be built.
 * No real engine is started, no uv sync, no network, no real room data. Hyphens only.
 */

const probe = require('./helpers/eureka-installed-layout-387.cjs');

const MSG = {
  JOB_NOT_FOUND: "No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job.",
  NO_BOUND_ROOM: "Bind the intended MindrianOS room before preparing an engine projection.",
};

// EXPECT is the pinned state of Phase 387. Plans 387-05, 387-11 and 387-06 change behavior ON PURPOSE
// (typed states, one text source, offline arguments). When one of them does, it must edit EXPECT in the
// same commit; a changed cell that is not edited here is a regression.
// Plan 387-11 changed S6 on purpose: the fake uv error line is now captured from the start phase, so every
// spawning path answers cause python_missing with the cleaned first line as engine_start_line, and the
// message is the fixed python_missing sentence (not the generic engine_start_failed text). The probe's
// fixture engine folder also holds an environment folder (config file only), because the route gate refuses
// a folder with no prepared environment before the start (env_not_synced).
// Plan 387-05 changed it on purpose: the engine check now runs at the registerEurekaTool chokepoint, before
// the room projection, and answers one of 3 typed states with a fix line (engine_state absent or broken).
// Row shape: [reason, message, isError] or, for a typed engine refusal, [reason, message, isError, engine_state].
// null reason and null message mean a result with no reason.
const TYPED_TAIL = ' The default /mos:eureka run needs no engine.';
const M_ABSENT = 'The Eureka engine is not set up on this machine.' + TYPED_TAIL;
const S_PYPROJECT = 'The Eureka engine folder has no pyproject.toml, so it is not an engine checkout.';
const M_PYPROJECT = S_PYPROJECT + TYPED_TAIL;
const M_UV = 'The tool uv is not installed or is not on the PATH, so the engine cannot start.' + TYPED_TAIL;
const M_PYTHON = 'No Python that meets the engine requirement was found.' + TYPED_TAIL;
const JOB_TOOLS = ['eureka_capability_job_cancel', 'eureka_capability_job_result', 'eureka_capability_job_status'];
const RUN_TOOLS = ['eureka_capability_run', 'eureka_capability_start'];

// spec: { gated: [reason, message, state] for every gated tool (unbound and bound), or
//         start: [reason, message, state] for the engine start on a spawning tool,
//         job: [message, state or null] for the three job tools }
function scenarioRows(names, spec) {
  const rows = {};
  for (const n of names) {
    if (n === 'eureka_critic') rows[n] = { u: [null, null, true], b: [null, null, true] };
    else if (n === 'eureka_graph_project') rows[n] = { u: ['no_bound_room', MSG.NO_BOUND_ROOM, true], b: [null, null, false] };
    else if (JOB_TOOLS.indexOf(n) !== -1) {
      const row = ['job_session_not_found', spec.job[0], true].concat(spec.job[1] ? [spec.job[1]] : []);
      rows[n] = { u: row, b: row };
    } else if (spec.gated) {
      const row = [spec.gated[0], spec.gated[1], true, spec.gated[2]];
      rows[n] = { u: row, b: row };
    } else {
      const start = [spec.start[0], spec.start[1], true, spec.start[2]];
      rows[n] = RUN_TOOLS.indexOf(n) !== -1 ? { u: start, b: start } : { u: ['no_bound_room', MSG.NO_BOUND_ROOM, true], b: start };
    }
  }
  return rows;
}

function buildRows(names) {
  const jobNotFound = MSG.JOB_NOT_FOUND;
  const absent = { gated: ['engine_not_configured', M_ABSENT, 'absent'], job: [jobNotFound + ' The Eureka engine is not set up, so no job can start.', 'absent'] };
  const uvMissing = { start: ['engine_unavailable', M_UV, 'broken'], job: [jobNotFound, null] };
  return {
    S1: scenarioRows(names, absent),
    S2: scenarioRows(names, absent),
    S3: scenarioRows(names, { gated: ['engine_checkout_unavailable', M_PYPROJECT, 'broken'], job: [jobNotFound + ' ' + S_PYPROJECT, 'broken'] }),
    S4: scenarioRows(names, uvMissing),
    S5: scenarioRows(names, uvMissing),
    S6: scenarioRows(names, { start: ['engine_unavailable', M_PYTHON, 'broken'], job: [jobNotFound, null] }),
    // S7: a saved setting and a minimal Desktop-shaped environment: the gate passes, then uv is missing.
    S7: scenarioRows(names, uvMissing),
  };
}

const EXPECT = {
  eureka_tools: [
    "eureka_capability_job_cancel",
    "eureka_capability_job_result",
    "eureka_capability_job_status",
    "eureka_capability_run",
    "eureka_capability_start",
    "eureka_critic",
    "eureka_graph_analyze",
    "eureka_graph_assess_category_edge_patterns",
    "eureka_graph_backtest",
    "eureka_graph_compare_topics",
    "eureka_graph_find_community_bridge_pairs",
    "eureka_graph_find_network_holes",
    "eureka_graph_find_shared_neighbor_gaps",
    "eureka_graph_find_similar_unlinked_items",
    "eureka_graph_genesis_plan",
    "eureka_graph_map_neighbourhoods",
    "eureka_graph_opportunity_scout",
    "eureka_graph_package_relationships",
    "eureka_graph_prepare_artifacts",
    "eureka_graph_project",
    "eureka_graph_propose_relationships",
    "eureka_graph_rank_paths",
    "eureka_graph_score_surprise",
    "eureka_hsi_interpret_whitespace"
  ],
  distinct_total: 75,
  eureka_count: 24,
  other_serving: ['research_run', 'rs_experts_find', 'rs_thesis_read'],
  // eureka_critic: answers a ruling on the installed layout since quick 261106 (the baseline file ships).
  perspective: { ok: true, recalled_pairs: 2, network_attempts_total: 0, network_attempts_non_loopback: 0 },
  // S6 spawn pin: the exact uv argument list for each path, and UV_OFFLINE in the child.
  uv_args_generic: ['run', '--project', '<TMP>/fixture-engine-folder-387', '--extra', 'mcp-server', 'eureka-mcp'],
  uv_args_scout: ['run', '--project', '<TMP>/fixture-engine-folder-387', '--extra', 'mcp-server', '--extra', 'modern-encoder', 'eureka-mcp'],
  s6_cause: 'python_missing',
  s6_start_line: probe.UV_ERROR_LINE,
  forbidden_uv_flags: ['--no-sync', '--offline', '--frozen', '--locked', '--no-python-downloads'],
};
EXPECT.rows = buildRows(EXPECT.eureka_tools);

let passed = 0;
let failed = 0;
function ok(label, extra) { passed += 1; process.stdout.write('ok - ' + label + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL - ' + label + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }

// A pinned row has 3 cells, or 4 when it is a typed engine refusal (the 4th is engine_state). A 3-cell row
// also fails when the call carries an engine_state, so a tool cannot start refusing without the pin changing.
function cell(call, exp) {
  const base = [call.reason, call.message, call.isError];
  if ((exp && exp.length === 4) || call.engine_state !== undefined) base.push(call.engine_state);
  return base;
}
function sameCell(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Compare the table of one scenario with an expected table. Returns mismatch lines.
function compareScenario(scenario, expectedRows, only) {
  const problems = [];
  for (const call of scenario.calls) {
    if (only && !only(call)) continue;
    const exp = expectedRows[call.tool] && expectedRows[call.tool][call.bound ? 'b' : 'u'];
    if (!exp) { problems.push(scenario.id + ' ' + call.tool + ': no expected row'); continue; }
    if (call.tool === 'eureka_critic') continue; // checked by its own text rule
    if (!sameCell(cell(call, exp), exp)) {
      problems.push(scenario.id + ' ' + (call.bound ? 'bound' : 'unbound') + ' ' + call.tool + ': got ' + JSON.stringify(cell(call, exp)) + ' expected ' + JSON.stringify(exp));
    }
  }
  return problems;
}

// eureka_critic answers a ruling JSON with a verdict on the installed layout. Quick 261106 (eureka
// critic baseline ships) added evals/eureka/212-critic-baseline.json to the package.json "files"
// list, so the pack carries the baseline and the tool no longer fails with ENOENT. The pin is
// narrowed to the answering state: the old ENOENT error is now a failure.
function criticProblems(scenario, _expect) {
  const problems = [];
  for (const call of scenario.calls.filter((c) => c.tool === 'eureka_critic')) {
    const text = String(call.text || '');
    let answers = false;
    if (call.isError === false) { try { answers = typeof JSON.parse(text).verdict === 'string'; } catch (_e) { answers = false; } }
    if (!answers) {
      problems.push(scenario.id + ' eureka_critic: expected a ruling with a verdict (quick 261106), got ' + JSON.stringify([call.isError, text.slice(0, 120)]));
    }
  }
  return problems;
}

const GRAPH_TOOLS = (rows) => Object.keys(rows.S1).filter((t) => t.startsWith('eureka_graph_') || t === 'eureka_hsi_interpret_whitespace');

function armI1(report, expect) {
  const problems = [];
  for (const identity of ['claude-code', 'claude-ai']) {
    const tl = report.scenarios[0].tools_list[identity];
    if (!tl) { problems.push('no tools_list for ' + identity); continue; }
    if (JSON.stringify(tl.eureka_names) !== JSON.stringify(expect.eureka_tools)) problems.push(identity + ': eureka names differ: ' + JSON.stringify(tl.eureka_names));
    if (tl.eureka_count !== expect.eureka_count) problems.push(identity + ': eureka count ' + tl.eureka_count + ' expected ' + expect.eureka_count);
    if (tl.distinct_total !== expect.distinct_total) problems.push(identity + ': distinct total ' + tl.distinct_total + ' expected ' + expect.distinct_total);
    if (JSON.stringify(tl.other_serving) !== JSON.stringify(expect.other_serving)) problems.push(identity + ': other serving tools differ: ' + JSON.stringify(tl.other_serving));
  }
  return problems;
}

function armI2(report, expect) {
  const s1 = report.scenarios[0];
  const graph = GRAPH_TOOLS(expect.rows);
  const problems = [];
  // Plan 387-05: the engine check runs before the room projection, so an unbound graph tool answers the
  // engine state, not no_bound_room. Only eureka_graph_project (no engine needed) still answers no_bound_room.
  for (const t of graph) {
    const call = s1.calls.find((c) => c.tool === t && !c.bound);
    const want = t === 'eureka_graph_project' ? 'no_bound_room' : 'engine_not_configured';
    if (!call || call.reason !== want) problems.push(t + ' unbound: expected ' + want + ', got ' + (call && call.reason));
    if (t !== 'eureka_graph_project' && call && call.engine_state !== 'absent') problems.push(t + ' unbound: engine_state ' + (call && call.engine_state) + ' expected absent');
  }
  if (graph.length !== 18) problems.push('expected 18 graph tools, found ' + graph.length);
  return problems.concat(compareScenario(s1, expect.rows.S1, (c) => !c.bound));
}

function armI3(report, expect) {
  const s1 = report.scenarios[0];
  const problems = compareScenario(s1, expect.rows.S1, (c) => c.bound).concat(criticProblems(s1, expect));
  const bound = s1.calls.filter((c) => c.bound);
  const engine = bound.filter((c) => c.reason === 'engine_not_configured');
  const jobs = bound.filter((c) => c.reason === 'job_session_not_found');
  const okCalls = bound.filter((c) => c.isError === false && c.tool !== 'eureka_critic');
  if (engine.length !== 19) problems.push('engine_not_configured count ' + engine.length + ' expected 19');
  if (jobs.length !== 3) problems.push('job_session_not_found count ' + jobs.length + ' expected 3');
  if (okCalls.length !== 1 || okCalls[0].tool !== 'eureka_graph_project') problems.push('expected exactly eureka_graph_project to answer ok (eureka_critic aside), got ' + okCalls.map((c) => c.tool).join(','));
  return problems;
}

function armI4(report, expect) {
  const byId = Object.fromEntries(report.scenarios.map((s) => [s.id, s]));
  let problems = [];
  for (const id of ['S3', 'S4', 'S5', 'S6']) {
    problems = problems.concat(compareScenario(byId[id], expect.rows[id]));
    problems = problems.concat(criticProblems(byId[id], expect));
  }
  const want = { S3: 'engine_checkout_unavailable', S4: 'engine_unavailable', S5: 'engine_unavailable', S6: 'engine_unavailable' };
  for (const id of Object.keys(want)) {
    const engineCalls = byId[id].calls.filter((c) => c.bound && c.reason && !['job_session_not_found'].includes(c.reason));
    if (engineCalls.length !== 19) problems.push(id + ': expected 19 engine refusals when bound, got ' + engineCalls.length);
    for (const c of engineCalls) if (c.reason !== want[id]) problems.push(id + ' ' + c.tool + ': reason ' + c.reason + ' expected ' + want[id]);
  }
  // N10 (Plan 387-11): every spawning path of S6 answers the typed cause and the cleaned first start line.
  const spawning = byId.S6.calls.filter((c) => c.bound && c.reason === 'engine_unavailable');
  for (const c of spawning) {
    if (c.cause !== expect.s6_cause) problems.push('S6 ' + c.tool + ': cause ' + c.cause + ' expected ' + expect.s6_cause);
    if (c.engine_start_line !== expect.s6_start_line) problems.push('S6 ' + c.tool + ': engine_start_line ' + JSON.stringify(c.engine_start_line));
    if (String(c.message).includes('Could not call the configured local Eureka MCP server')) problems.push('S6 ' + c.tool + ': the old generic message is back');
  }
  for (const id of ['S4', 'S5']) {
    for (const c of byId[id].calls.filter((x) => x.bound && x.reason === 'engine_unavailable')) {
      if (c.cause !== 'uv_missing') problems.push(id + ' ' + c.tool + ': cause ' + c.cause + ' expected uv_missing');
    }
  }
  return problems;
}

// S7 (Plan 387-05): a saved setting names the fixture engine folder, MINDRIAN_EUREKA_ROOT and
// MINDRIAN_EUREKA_UV are unset, and the environment is the minimal Desktop-shaped one (no uv on PATH). The
// gate passes (the saved setting works with no variable), then the start fails at the missing uv.
// This is a simulation of a Desktop launch, not a real one.
function armI9(report, expect) {
  const s7 = report.scenarios.find((s) => s.id === 'S7');
  if (!s7) return ['no S7 scenario in the report'];
  const problems = compareScenario(s7, expect.rows.S7).concat(criticProblems(s7, expect));
  const unbound = s7.calls.filter((c) => !c.bound && c.reason === 'no_bound_room' && c.tool !== 'eureka_graph_project');
  if (unbound.length !== 17) problems.push('S7 unbound: expected 17 graph tools to answer no_bound_room (gate passed), got ' + unbound.length);
  const uv = s7.calls.filter((c) => c.bound && c.reason === 'engine_unavailable' && c.engine_state === 'broken' && c.cause === 'uv_missing');
  if (uv.length !== 19) problems.push('S7 bound: expected 19 engine_unavailable refusals with engine_state broken and cause uv_missing, got ' + uv.length);
  return problems;
}

function armI5(report) {
  const s1 = report.scenarios[0];
  const s2 = report.scenarios[1];
  const problems = [];
  if (JSON.stringify(s1.tools_list) !== JSON.stringify(s2.tools_list)) problems.push('S1 and S2 tool lists differ');
  const a = JSON.stringify(s1.calls.map((c) => [c.tool, c.bound].concat(cell(c))));
  const b = JSON.stringify(s2.calls.map((c) => [c.tool, c.bound].concat(cell(c))));
  if (a !== b) problems.push('S1 and S2 refusals differ');
  return problems;
}

function armI6(report, expect) {
  const p = report.scenarios[0].perspective || {};
  const problems = [];
  if (p.ok !== expect.perspective.ok) problems.push('perspective ok is ' + p.ok);
  if (p.recalled_pairs !== expect.perspective.recalled_pairs) problems.push('recalled pairs ' + p.recalled_pairs + ' expected ' + expect.perspective.recalled_pairs);
  if (p.network_counter_positive_control !== true) problems.push('the network counter positive control did not log a connect attempt');
  if (p.network_attempts_total !== expect.perspective.network_attempts_total) problems.push('network attempts ' + p.network_attempts_total);
  if (p.network_attempts_non_loopback !== expect.perspective.network_attempts_non_loopback) problems.push('non-loopback network attempts ' + p.network_attempts_non_loopback);
  return problems;
}

function armI8(report, expect) {
  const s6 = report.scenarios[5];
  const problems = [];
  const spawnCalls = s6.calls.filter((c) => c.bound && Array.isArray(c.uv_spawns) && c.uv_spawns.length);
  const generic = spawnCalls.filter((c) => c.tool === 'eureka_capability_run' || c.tool === 'eureka_capability_start');
  const graph = spawnCalls.filter((c) => !['eureka_capability_run', 'eureka_capability_start'].includes(c.tool));
  if (generic.length !== 2) problems.push('expected 2 generic spawning calls, got ' + generic.length);
  if (graph.length !== 17) problems.push('expected 17 graph workflow spawning calls, got ' + graph.length);
  for (const c of spawnCalls) {
    if (c.uv_spawns.length !== 1) { problems.push(c.tool + ': ' + c.uv_spawns.length + ' spawns, expected 1'); continue; }
    const sp = c.uv_spawns[0];
    for (const f of expect.forbidden_uv_flags) if (sp.argv.includes(f)) problems.push(c.tool + ': argv holds ' + f);
    if (JSON.stringify(sp.argv) !== JSON.stringify(expect.uv_args_generic)) problems.push(c.tool + ': argv ' + JSON.stringify(sp.argv));
    const isGraph = graph.includes(c);
    if (isGraph && sp.UV_OFFLINE !== '1') problems.push(c.tool + ': UV_OFFLINE should be 1 on the graph path, got ' + sp.UV_OFFLINE);
    if (!isGraph && sp.UV_OFFLINE !== null) problems.push(c.tool + ': UV_OFFLINE should be unset on the generic path, got ' + sp.UV_OFFLINE);
    if (sp.env_keys.some((k) => k.startsWith('UV_') && k !== 'UV_OFFLINE')) problems.push(c.tool + ': a UV_ key other than UV_OFFLINE reached the child');
    if (sp.env_keys.includes('MINDRIAN_EUREKA_ROOT')) problems.push(c.tool + ': MINDRIAN_EUREKA_ROOT reached the child');
    // Plan 387-11: the line is captured from the start phase (stderr is piped), so it reaches the caller as
    // engine_start_line and no longer reaches the server stderr. The message stays the fixed sentence.
    if (c.message_has_uv_line) problems.push(c.tool + ': the message holds the uv error line (expected the fixed sentence)');
    if (c.engine_start_line !== expect.s6_start_line) problems.push(c.tool + ': engine_start_line ' + JSON.stringify(c.engine_start_line));
    if (c.server_stderr_has_uv_line !== false) problems.push(c.tool + ': the uv error line still reached the server stderr');
  }
  const scout = s6.scout_direct;
  if (!scout || !Array.isArray(scout.uv_spawns) || scout.uv_spawns.length !== 1) problems.push('scout path: expected 1 spawn');
  else {
    const sp = scout.uv_spawns[0];
    if (JSON.stringify(sp.argv) !== JSON.stringify(expect.uv_args_scout)) problems.push('scout argv ' + JSON.stringify(sp.argv));
    for (const f of expect.forbidden_uv_flags) if (sp.argv.includes(f)) problems.push('scout argv holds ' + f);
    if (sp.UV_OFFLINE !== null) problems.push('scout UV_OFFLINE should be unset, got ' + sp.UV_OFFLINE);
    if (scout.message_has_uv_line) problems.push('scout message holds the uv error line');
    if (scout.reason !== 'engine_unavailable') problems.push('scout reason ' + scout.reason);
    if (scout.cause !== expect.s6_cause) problems.push('scout cause ' + scout.cause + ' expected ' + expect.s6_cause);
    if (scout.engine_start_line !== expect.s6_start_line) problems.push('scout engine_start_line ' + JSON.stringify(scout.engine_start_line));
  }
  return problems;
}

function mutateExpect(expect) {
  const copy = JSON.parse(JSON.stringify(expect));
  copy.rows.S1.eureka_capability_run.b[1] = 'a deliberately wrong refusal text';
  copy.rows.S1.eureka_graph_project.b[2] = true;
  return copy;
}

async function main() {
  let report;
  try {
    report = await probe.buildReport({});
  } catch (e) {
    if (e instanceof probe.EnvGap) { process.stdout.write('SKIPPED (ENV GAP): ' + e.message + '\n'); process.exit(77); }
    throw e;
  }
  if (report.env_gaps) { process.stdout.write('SKIPPED (ENV GAP): ' + report.env_gaps.join('; ') + '\n'); process.exit(77); }
  process.stdout.write('layout_mode ' + report.layout_mode + ', version ' + report.version + ', node ' + report.node_version + '\n');

  const arms = [
    ['I1 tools/list holds the 24 runtime names for both client identities', () => armI1(report, EXPECT)],
    ['I2 S1 unbound: engine tools answer the engine state before the room check', () => armI2(report, EXPECT)],
    ['I3 S1 bound: typed engine_not_configured x19, job_session_not_found x3, one ok, critic pinned', () => armI3(report, EXPECT)],
    ['I4 S3 checkout unavailable; S4 S5 S6 engine_unavailable with typed text', () => armI4(report, EXPECT)],
    ['I9 S7 saved setting with no variable passes the gate, then fails at the missing uv', () => armI9(report, EXPECT)],
    ['I5 S1 and S2 are identical (no environment difference without the variable)', () => armI5(report)],
    ['I6 perspective answers ok on the installed layout with no engine and no network attempt', () => armI6(report, EXPECT)],
    ['I8 S6 plain uv run on every spawning path, UV_OFFLINE on the graph path only, uv error line captured as engine_start_line (N10)', () => armI8(report, EXPECT)],
  ];
  for (const [label, fn] of arms) {
    const problems = fn();
    if (problems.length) bad(label, problems.slice(0, 8).join('\n')); else ok(label);
  }

  // I7: the pin must not be vacuous. A wrong copy of EXPECT has to fail the same comparison.
  const wrong = mutateExpect(EXPECT);
  const wrongI3 = armI3(report, wrong);
  if (wrongI3.length >= 1) ok('I7 pin sensitivity: a wrong copy of EXPECT fails the same comparison', wrongI3.length + ' mismatches found');
  else bad('I7 pin sensitivity: a wrong copy of EXPECT still passed');

  process.stdout.write('\ntest-387-eureka-installed-layout: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
