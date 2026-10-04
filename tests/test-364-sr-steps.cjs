#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 03 Tasks 2-3 -- the Theo step reader (THEO-C, NV-2, NR-1) and
 * the membership-only coverage read (SEED-106 items 1 and 3). layer: harness
 *
 * Legs S1-S21 run OFFLINE against injected fake brain clients and the 364-theo
 * fixtures. Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME set before
 * any repo module loads; the network guard is installed first.
 *
 * The fixtures follow Theo Phase 25 write 1 f05ac2c and write 2 43205a2, written from
 * the Theo session's reported facts rather than a live capture.
 * The thinkingMode per-step assignment in the fixtures is a fixture convention;
 * only the distribution (4/1/1/1) is canon.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-srsteps-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-srsteps-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-sr-steps');

const FIX = path.join(REPO_ROOT, 'tests/fixtures/364-theo');
function fx(name) { return JSON.parse(fs.readFileSync(path.join(FIX, name + '.json'), 'utf8')); }

const MOD_PATH = path.join(REPO_ROOT, 'lib/core/research-planner/sr-steps.cjs');
const { installFakeBrain } = require(path.join(REPO_ROOT, 'tests/helpers/fake-brain-364.cjs'));
const REFUSAL = 'Theo has not authored this step yet';
const SR_ID = (n) => 'sciroad::scientific-roadmapping::p' + String(n).padStart(2, '0');
const THEO25_IDS = [1, 2, 3, 4, 5, 6, 7].map(SR_ID);
const THEO25_LABELS = ['Tension Qualification', 'Goal Quantification', 'Rung Placement and Type Selection', 'Forum Construction', 'Path Enumeration', 'Constraint Interrogation', 'Catalytic Ranking'];
const RETIRED_ALIASES = ['Technology Roadmapping', 'Roadmapping', 'Field Roadmapping'];
const TECH_TREE = 'Tech Tree Mapping';
const RETIRED_ID_RE = /^sr-v1-/;

/** A fake brainClient: callTool and recommendChain record calls and serve scripted values. */
function makeFake(map) {
  const calls = [];
  function serve(tool) {
    const v = map[tool];
    if (v === 'throw') throw new Error('fake throw for ' + tool);
    return typeof v === 'function' ? v() : v;
  }
  return {
    calls,
    callTool: async function (tool, args) { calls.push({ tool, args }); return serve(tool); },
    recommendChain: async function (problemType, maxSteps) {
      calls.push({ tool: 'recommend_chain', args: { problem_type: problemType, max_steps: maxSteps } });
      return serve('recommend_chain');
    },
  };
}

const NO_DASH = /[\u2014\u2013]/;

async function main() {
  let mod = null;
  try { mod = require(MOD_PATH); } catch (e) { C.check('sr-steps.cjs loads', false, e.message); }
  if (!mod) { C.check('zero network attempts', net.attempts() === 0); process.exit(C.summary() || 1); }
  const { readSrSteps, readCoverage, renderStatus } = mod;

  // S1 all-null measured payload refuses at step 1
  {
    const fake = makeFake({ framework_step: fx('framework-step-all-null') });
    const r = await readSrSteps({ brainClient: fake });
    C.check('S1 all-null payload -> step_unauthored with the exact message at step 1',
      r.ok === false && r.reason === 'step_unauthored' && r.message === REFUSAL && r.step_id === 'sciroad::scientific-roadmapping::p01' && mod.REFUSAL_TEXT === REFUSAL,
      JSON.stringify(r));
  }

  // S2 authored: list order kept, DEFINITION and ASIDE skipped
  const authored = fx('framework-step-authored');
  const authoredRows = authored.rows[0].steps;
  const runnableIds = authoredRows.filter((s) => s.stepKind !== 'DEFINITION' && s.stepKind !== 'ASIDE').map((s) => s.stepId);
  {
    const r = await readSrSteps({ brainClient: makeFake({ framework_step: authored }) });
    const ids = r.ok ? r.steps.map((s) => s.stepId) : [];
    const sortedIds = authoredRows.slice().sort((a, b) => a.sourceOrder - b.sourceOrder)
      .filter((s) => s.stepKind !== 'DEFINITION' && s.stepKind !== 'ASIDE').map((s) => s.stepId);
    C.check('S2 authored -> seven steps in list order, never sourceOrder order, DEFINITION and ASIDE skipped',
      r.ok === true && ids.length === 7 && JSON.stringify(ids) === JSON.stringify(runnableIds)
      && JSON.stringify(ids) !== JSON.stringify(sortedIds)
      && !ids.some((i) => /def|aside/.test(i)) && r.framework_status === 'draft',
      JSON.stringify(ids));
    // S4 null stepKind is runnable
    const nk = fx('framework-step-authored');
    nk.rows[0].steps.find((s) => s.stepId === 'sciroad::scientific-roadmapping::p03').stepKind = null;
    const rk = await readSrSteps({ brainClient: makeFake({ framework_step: nk }) });
    C.check('S4 a runnable row with stepKind null is included',
      rk.ok === true && rk.steps.some((s) => s.stepId === 'sciroad::scientific-roadmapping::p03' && s.stepKind === null));
  }

  // S3 one-null
  {
    const r = await readSrSteps({ brainClient: makeFake({ framework_step: fx('framework-step-one-null') }) });
    C.check('S3 one null runIt -> refused at that step with the exact text',
      r.ok === false && r.reason === 'step_unauthored' && r.step_id === 'sciroad::scientific-roadmapping::p04' && r.message === REFUSAL, JSON.stringify(r));
  }

  // S5 only DEFINITION and ASIDE rows
  {
    const rows = authoredRows.filter((s) => s.stepKind === 'DEFINITION' || s.stepKind === 'ASIDE');
    const p = fx('framework-step-authored');
    p.rows[0].steps = rows;
    const r = await readSrSteps({ brainClient: makeFake({ framework_step: p }) });
    C.check('S5 only DEFINITION and ASIDE rows -> no_runnable_steps', r.ok === false && r.reason === 'no_runnable_steps', JSON.stringify(r));
  }

  // S6 exact args, nothing from opts
  {
    const fake = makeFake({ framework_step: fx('framework-step-all-null'), recommend_chain: fx('recommend-chain-thin') });
    await readSrSteps({ brainClient: fake, room: 'MARKER-364', question: 'MARKER-364' });
    await readCoverage({ brainClient: fake, room: 'MARKER-364', question: 'MARKER-364' });
    const stepCalls = fake.calls.filter((c) => c.tool === 'framework_step');
    C.check('S6 every framework_step call is exactly {framework:"Scientific Roadmapping"}, one key',
      stepCalls.length === 1 && stepCalls.every((c) => JSON.stringify(c.args) === JSON.stringify({ framework: 'Scientific Roadmapping' }) && Object.keys(c.args).length === 1));
    C.check('S6 the MARKER-364 string never appears in any recorded call', JSON.stringify(fake.calls).indexOf('MARKER-364') === -1);
    C.check('S6 HANDLE constant is Scientific Roadmapping', mod.HANDLE === 'Scientific Roadmapping');
  }

  // S7 classification
  {
    async function reason(script) { const r = await readSrSteps({ brainClient: makeFake({ framework_step: script }) }); return r; }
    C.check('S7 null -> brain_unavailable', (await reason(null)).reason === 'brain_unavailable');
    C.check('S7 egress_blocked', (await reason({ error: 'egress_blocked' })).reason === 'egress_blocked');
    C.check('S7 not served', (await reason({ content: [{ type: 'text', text: 'tool framework_step not found' }] })).reason === 'not_served');
    C.check('S7 shape refused', (await reason({ content: [{ type: 'text', text: 'MCP error -32602: bad' }] })).reason === 'shape_refused');
    C.check('S7 empty rows -> no_steps_in_canon', (await reason({ rows: [] })).reason === 'no_steps_in_canon');
    C.check('S7 callTool throws -> call_threw', (await reason('throw')).reason === 'call_threw');
    const t = await reason({ refusal: { code: 'not_scored', layer: 'tool' } });
    C.check('S7 refusal.code not_scored -> theo_refusal, theo_code, kind not_ready',
      t.ok === false && t.reason === 'theo_refusal' && t.theo_code === 'not_scored' && t.kind === 'not_ready', JSON.stringify(t));
  }

  // S8 whitelist and caps
  {
    const p = fx('framework-step-authored');
    p.rows[0].steps = p.rows[0].steps.filter((s) => s.stepKind !== 'DEFINITION' && s.stepKind !== 'ASIDE');
    p.rows[0].steps[0].secret = 'LEAK';
    p.rows[0].steps[0].runIt = 'x'.repeat(10000);
    p.rows[0].steps[0].label = 'L'.repeat(500);
    const r = await readSrSteps({ brainClient: makeFake({ framework_step: p }) });
    const s0 = r.ok ? r.steps[0] : {};
    C.check('S8 extra keys dropped, runIt capped at 4000, label capped at 200',
      r.ok === true && !('secret' in s0) && s0.runIt.length <= 4000 && s0.label.length <= 200
      && JSON.stringify(r).indexOf('LEAK') === -1, JSON.stringify(Object.keys(s0)));
    const big = fx('framework-step-authored');
    const one = big.rows[0].steps.find((s) => s.stepKind === 'STEP');
    big.rows[0].steps = Array.from({ length: 60 }, (_, i) => Object.assign({}, one, { stepId: 'sciroad::scientific-roadmapping::p' + String(i + 1).padStart(2, '0') }));
    const r2 = await readSrSteps({ brainClient: makeFake({ framework_step: big }) });
    C.check('S8 more than 50 rows are cut to the first 50', r2.ok === true && r2.steps.length === 50 && r2.steps[49].stepId === 'sciroad::scientific-roadmapping::p50');
  }

  // S9 coverage
  {
    const thinFix = fx('recommend-chain-thin');
    const fake = makeFake({ recommend_chain: thinFix });
    const r = await readCoverage({ brainClient: fake });
    const names = thinFix.chain.map((c) => c.framework);
    C.check('S9 thin chain -> uncovered, and the result carries none of the chain framework names',
      r.ok === true && r.status === 'uncovered' && r.problem_type === 'WellDefined'
      && names.every((n) => JSON.stringify(r).indexOf(n) === -1), JSON.stringify(r));
    C.check('S9 recommendChain called exactly with (WellDefined, 6)',
      fake.calls.length === 1 && fake.calls[0].args.problem_type === 'WellDefined' && fake.calls[0].args.max_steps === 6);
    const c = await readCoverage({ brainClient: makeFake({ recommend_chain: fx('recommend-chain-covered') }) });
    C.check('S9 covered chain -> covered, still no chain in the result',
      c.status === 'covered' && JSON.stringify(c).indexOf('Business Model Canvas') === -1, JSON.stringify(c));
    const e1 = await readCoverage({ brainClient: makeFake({ recommend_chain: { error: 'invalid_problem_type', tool: 'recommend_chain' } }) });
    const e2 = await readCoverage({ brainClient: makeFake({ recommend_chain: 'throw' }) });
    C.check('S9 error object or throw -> unavailable', e1.status === 'unavailable' && e2.status === 'unavailable' && mod.COVERAGE_PROBLEM_TYPE === 'WellDefined');
  }

  // S10 renderStatus
  {
    const refused = await readSrSteps({ brainClient: makeFake({ framework_step: fx('framework-step-all-null') }) });
    const unc = { ok: true, status: 'uncovered', problem_type: 'WellDefined' };
    const out1 = renderStatus({ steps: refused, coverage: unc });
    C.check('S10 refusal render has the exact text and /mos:research', out1.indexOf(REFUSAL) !== -1 && out1.indexOf('/mos:research') !== -1);
    C.check('S10 uncovered render says uncovered', /uncovered/.test(out1));
    const served = await readSrSteps({ brainClient: makeFake({ framework_step: fx('framework-step-one-null') }) });
    const good = await readSrSteps({ brainClient: makeFake({ framework_step: authored }) });
    const out2 = renderStatus({ steps: good, coverage: { ok: true, status: 'covered', problem_type: 'WellDefined' } });
    const ops = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspective.cjs')).SR_OPERATIONS;
    let last = -1; let inOrder = true;
    ops.forEach((o) => { const i = out2.indexOf(o); if (i === -1 || i < last) inOrder = false; last = i; });
    C.check('S10 authored render lists the seven labels in list order', inOrder);
    C.check('S10 no U+2014 or U+2013 in any render', !NO_DASH.test(out1) && !NO_DASH.test(out2) && !NO_DASH.test(renderStatus({ steps: served, coverage: { status: 'unavailable' } })));
  }

  // S11 no fallback to the local template
  {
    const perspective = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspective.cjs'));
    const kq = perspective.srStepGuide(null).steps.map((s) => s.key_question);
    const refused = await readSrSteps({ brainClient: makeFake({ framework_step: fx('framework-step-all-null') }) });
    const blob = JSON.stringify(refused) + renderStatus({ steps: refused, coverage: { ok: true, status: 'uncovered', problem_type: 'WellDefined' } });
    C.check('S11 no local-template key question appears anywhere', kq.length === 7 && kq.every((q) => blob.indexOf(q) === -1));
  }

  // S12 static
  {
    const src = fs.readFileSync(MOD_PATH, 'utf8');
    const lines = src.split(/\r?\n/);
    C.check('S12 no top-level require of brain-client', !lines.some((l) => /^(const|let|var)\s.*require\(['"]\.\.\/brain-client\.cjs['"]\)/.test(l)));
    C.check('S12 the lazy require exists inside a function body', lines.some((l) => /^\s+.*require\(['"]\.\.\/brain-client\.cjs['"]\)/.test(l)));
    C.check('S12 no fetch(, mcp__theo, srStepGuide, LOCAL_STEP_TEMPLATE', !/fetch\(|mcp__theo|srStepGuide|LOCAL_STEP_TEMPLATE/.test(src));
    C.check('S12 no require of structure.cjs or the shape ledger', !/require\([^)]*\/structure\.cjs/.test(src) && !/research-shape-ledger/.test(src));
    C.check('S12 reuses classifyCallResult from theo-structure', /classifyCallResult/.test(src) && /theo-structure\.cjs/.test(src));
    C.check('S12 no em-dash or en-dash in source', !NO_DASH.test(src));
  }

  // S13 the fake helper
  {
    const clientPath = require.resolve(path.join(REPO_ROOT, 'lib/core/brain-client.cjs'));
    const before = require.cache[clientPath].exports;
    const h = installFakeBrain({ framework_step: fx('framework-step-all-null'), recommend_chain: fx('recommend-chain-thin') });
    const swapped = require(clientPath);
    C.check('S13 installFakeBrain swaps the cached client exports', swapped !== before && swapped.callTool !== before.callTool);
    const lazy = await readSrSteps();
    C.check('S13 lazy-required default client is the fake and serves the all-null payload',
      lazy.ok === false && lazy.reason === 'step_unauthored'
      && h.calls.length === 1 && JSON.stringify(h.calls[0]) === JSON.stringify({ tool: 'framework_step', args: { framework: 'Scientific Roadmapping' } }));
    h.restore();
    C.check('S13 restore puts the real exports back', require(clientPath) === before);

    // preload mode (CLI child)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-preload-'));
    const cfg = path.join(dir, 'cfg.json');
    const log = path.join(dir, 'log.json');
    fs.writeFileSync(cfg, JSON.stringify({ framework_step: path.join(FIX, 'framework-step-all-null.json'), recommend_chain: path.join(FIX, 'recommend-chain-thin.json') }));
    const child = spawnSync(process.execPath, ['--require', path.join(REPO_ROOT, 'tests/helpers/fake-brain-364.cjs'), '-e',
      "require('" + MOD_PATH.replace(/\\/g, '/') + "').readSrSteps().then(function(r){process.stdout.write(r.reason)})"], {
      env: Object.assign({}, process.env, { MOS_364_FAKE_BRAIN: cfg, MOS_364_FAKE_BRAIN_LOG: log }), encoding: 'utf8',
    });
    let logged = null;
    try { logged = JSON.parse(fs.readFileSync(log, 'utf8')); } catch (_e) { logged = null; }
    C.check('S13 preload mode serves the fixture to a child and logs calls with zero net attempts',
      child.status === 0 && child.stdout === 'step_unauthored' && logged && logged.net_attempts === 0
      && logged.calls.length === 1 && logged.calls[0].tool === 'framework_step', child.stderr);
  }

  // ---- Theo Phase 25 legs (S14-S21): the fixtures follow the rebuilt Scientific Roadmapping ----
  const theoStructure = require(path.join(REPO_ROOT, 'lib/core/dominant-design/theo-structure.cjs'));
  const perspective25 = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspective.cjs'));
  const FAMILIES = fs.readdirSync(FIX).filter((f) => /^framework-step-.*\.json$/.test(f)).map((f) => f.replace(/\.json$/, ''));
  const authoredRead = await readSrSteps({ brainClient: makeFake({ framework_step: fx('framework-step-authored') }) });
  const aSteps = authoredRead.ok ? authoredRead.steps : [];
  const byId = {};
  aSteps.forEach((s) => { byId[s.stepId] = s; });

  // S14 ids, labels, STEP and draft
  C.check('S14a authored read is ok and the stepIds are p01 to p07 in order',
    authoredRead.ok === true && JSON.stringify(aSteps.map((s) => s.stepId)) === JSON.stringify(THEO25_IDS), JSON.stringify(aSteps.map((s) => s.stepId)));
  C.check('S14b the labels are the seven Theo 25 labels and match SR_OPERATIONS',
    JSON.stringify(aSteps.map((s) => s.label)) === JSON.stringify(THEO25_LABELS)
    && JSON.stringify(THEO25_LABELS) === JSON.stringify(perspective25.SR_OPERATIONS.slice()));
  {
    const fams = ['framework-step-authored', 'framework-step-one-null', 'framework-step-unlabelled-seven', 'framework-step-eight-unlabelled'];
    const allStepDraft = fams.every((n) => fx(n).rows[0].steps
      .filter((s) => s.stepKind !== 'DEFINITION' && s.stepKind !== 'ASIDE')
      .every((s) => s.stepKind === 'STEP' && s.orchestrationStatus === 'draft'));
    C.check('S14c every runnable row in the live-shaped families is STEP and draft; the authored read framework_status is draft',
      allStepDraft && authoredRead.framework_status === 'draft');
  }

  // S15 the deliberate researchDirective nulls
  C.check('S15a researchDirective is set on p01 and p06 only',
    JSON.stringify(aSteps.filter((s) => s.researchDirective !== null).map((s) => s.stepId)) === JSON.stringify([SR_ID(1), SR_ID(6)]));
  C.check('S15b researchDirective is strictly null on p02, p03, p04, p05 and p07, and a null is never a refusal',
    authoredRead.ok === true && [2, 3, 4, 5, 7].every((n) => byId[SR_ID(n)] && byId[SR_ID(n)].researchDirective === null));
  C.check('S15c thinkingMode and artifactRubric are non-empty strings on all seven steps',
    aSteps.length === 7 && aSteps.every((s) => typeof s.thinkingMode === 'string' && s.thinkingMode.length > 0 && typeof s.artifactRubric === 'string' && s.artifactRubric.length > 0));

  // S16 thinkingMode distribution (the per-step mapping is a fixture convention, not canon)
  {
    const counts = {};
    aSteps.forEach((s) => { counts[s.thinkingMode] = (counts[s.thinkingMode] || 0) + 1; });
    C.check('S16 thinkingMode distribution is SEQUENTIAL 4, PARALLEL 1, ITERATIVE 1, DECOMPOSE 1',
      JSON.stringify(Object.keys(counts).sort()) === JSON.stringify(['DECOMPOSE', 'ITERATIVE', 'PARALLEL', 'SEQUENTIAL'])
      && counts.SEQUENTIAL === 4 && counts.PARALLEL === 1 && counts.ITERATIVE === 1 && counts.DECOMPOSE === 1, JSON.stringify(counts));
  }

  // S17 retired step ids are gone from every family
  {
    const bad = [];
    FAMILIES.forEach((n) => fx(n).rows.forEach((r) => r.steps.forEach((s) => { if (RETIRED_ID_RE.test(s.stepId)) bad.push(n + ':' + s.stepId); })));
    C.check('S17 six framework-step fixtures and no retired step id in any of them', FAMILIES.length === 6 && bad.length === 0, JSON.stringify({ n: FAMILIES.length, bad }));
  }

  // S18 aliases
  C.check('S18a every framework-step fixture resolves only to Tech Tree Mapping and none of the retired aliases',
    FAMILIES.every((n) => { const res = fx(n).frameworkIdentities.resolved; return JSON.stringify(res) === JSON.stringify([TECH_TREE]) && !RETIRED_ALIASES.some((a) => res.indexOf(a) !== -1); }));
  const aliasCalls = [];
  const aliasFake = {
    callTool: async function (tool, args) {
      aliasCalls.push({ tool, args });
      if (args && args.framework === 'Scientific Roadmapping') return fx('framework-step-authored');
      if (args && args.framework === TECH_TREE) return fx('framework-step-honest-empty');
      return { rows: [] };
    },
  };
  {
    const r = await readSrSteps({ brainClient: aliasFake });
    C.check('S18b the reader sends only the canonical name; the handle is neither Tech Tree Mapping nor a retired alias',
      r.ok === true && r.steps.length === 7 && aliasCalls.length === 1
      && JSON.stringify(aliasCalls[0].args) === JSON.stringify({ framework: 'Scientific Roadmapping' })
      && mod.HANDLE !== TECH_TREE && RETIRED_ALIASES.indexOf(mod.HANDLE) === -1, JSON.stringify(aliasCalls));
    const ans = await aliasFake.callTool('framework_step', { framework: TECH_TREE });
    C.check('S18c the Tech Tree Mapping alias resolves but serves no steps -> no_steps_in_canon',
      theoStructure.classifyCallResult('framework_step', ans) === 'no_steps_in_canon');
  }

  // S19 honest empty
  {
    const r = await readSrSteps({ brainClient: makeFake({ framework_step: fx('framework-step-honest-empty') }) });
    const notErr = ['step_unauthored', 'call_threw', 'brain_unavailable', 'refused', 'egress_blocked'].indexOf(r.reason) === -1;
    C.check('S19a a Scientific Roadmapping row with zero steps -> no_steps_in_canon, no message, never an error reason',
      r.ok === false && r.reason === 'no_steps_in_canon' && !('message' in r) && notErr, JSON.stringify(r));
    const out = renderStatus({ steps: r, coverage: { ok: true, status: 'covered', problem_type: 'WellDefined' } });
    C.check('S19b the honest-empty render says Theo steps unavailable: no_steps_in_canon, with no refusal text and no dash',
      out.indexOf('Theo steps unavailable: no_steps_in_canon.') !== -1 && out.indexOf(REFUSAL) === -1 && !NO_DASH.test(out), out);
  }

  // S20 agreement with the live smoke predicates (tests/test-364-live-smoke.cjs)
  {
    const seven = authoredRead.ok === true && Array.isArray(authoredRead.steps) && authoredRead.steps.length === 7
      && authoredRead.steps.every(function (s) { return typeof s.label === 'string' && s.label.trim().length > 0 && typeof s.runIt === 'string' && s.runIt.trim().length > 0; });
    C.check('S20a the live smoke seven-steps predicate holds on the authored fixture', seven === true);
    const oneNull = await readSrSteps({ brainClient: makeFake({ framework_step: fx('framework-step-one-null') }) });
    const refused = oneNull.ok !== true && oneNull.reason === 'step_unauthored' && oneNull.message === mod.REFUSAL_TEXT;
    C.check('S20b the live smoke refusal predicate holds on the one-null fixture, at p04', refused === true && oneNull.step_id === SR_ID(4), JSON.stringify(oneNull));
  }

  // S21 step 5 coverage: Theo 25 lists the framework at step 5 of the WellDefined chain
  {
    const chainFix = fx('recommend-chain-thin');
    const names = chainFix.chain.map((c) => c.framework);
    chainFix.chain = chainFix.chain.slice(0, 4).concat([
      { step: 5, framework: 'Scientific Roadmapping', pagerank: 0.3, edge_confidence: 0.7, commands: [] },
      { step: 6, framework: 'Pricing Review', pagerank: 0.2, edge_confidence: 0.7, commands: [] },
    ]);
    const fake = makeFake({ recommend_chain: chainFix });
    const r = await readCoverage({ brainClient: fake });
    const other = chainFix.chain.map((c) => c.framework).filter((n) => n !== 'Scientific Roadmapping');
    C.check('S21 a chain with Scientific Roadmapping at step 5 reads covered, called with (WellDefined, 6), and the result carries no other chain name',
      r.ok === true && r.status === 'covered' && fake.calls.length === 1
      && fake.calls[0].args.problem_type === 'WellDefined' && fake.calls[0].args.max_steps === 6
      && other.length === 5 && other.every((n) => JSON.stringify(r).indexOf(n) === -1) && names.length >= 4, JSON.stringify(r));
  }

  C.check('zero network attempts', net.attempts() === 0);
  process.exit(C.summary());
}

main().catch((e) => { console.log('FAIL: unhandled ' + (e && e.stack || e)); process.exit(1); });
