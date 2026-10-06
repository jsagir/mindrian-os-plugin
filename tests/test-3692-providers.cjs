#!/usr/bin/env node
'use strict';

// Phase 369.2 Plan 25 - the patent lens searches patents or refuses before dispatch (CODE-02, SW-04, R08).
//
// PV1  no PATENTSVIEW_API_KEY: the patent lens is refused with provider_unavailable:patent,
//      zero fetch calls, no PubMed request
// PV2  key set, recorded PatentSearch body (no network): rows carry source 'patents' and the id
//      US4902126; the request carried the X-Api-Key header; the key value appears nowhere
// PV3  no patent key, TAVILY_API_KEY set, allowFallback {patent:'tavily'}: one Tavily request with
//      include_domains ['patents.google.com'] and the four invariant-6 fields on the lens operation;
//      without allowFallback the PV1 refusal stands
// PV4  the --broad lens set with neither key: patent and industry listed unavailable by name, never
//      reported as searched
// PV5  LENS_TO_SOURCE.patent is not pubmed and SOURCE_TO_TIER has an entry for 'patents'
//
// Phase 369.2 Plan 26 - provider preflight before dispatch and the doctor reachability matrix (HARNESS-03, SW-11, CFG-01; R15).
//
// PF1  no keys, lens set scholarly + industry + patent: result.preflight.unavailable names industry (tavily, no_key)
//      and the patent lane; zero Tavily and zero PatentsView requests; result.lens_set drops both; each has a
//      refused_before_fetch operation; scholarly still searches
// PF2  the three Tavily lenses requested with no key: the answer line is the one sentence naming what was not
//      searched; with a Tavily key set there is no such line
// PF3  the doctor module matrix(): one row per lens with provider and state, industry 'no key' then 'ready', brain
//      on theo, judge_jev on typesafe 'line off'; zero network; no key value in the rows or in check()
// PF4  scripts/doctor.cjs --json in a temp HOME carries the research-providers module result
// PF5  the doctor contract-parity and doc-parity tests pass with the new registry entry
//
// Never touches the network: globalThis.fetch is a thrower except inside a leg that installs its own
// recording stub. HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs set before any repo module loads.
//
// exit 0 -> PASSED, exit 1 -> FAILED
// House rule: hyphens only, no em or en dashes.

const real = require('./helpers/real-corpus-3692.cjs');
const hermetic = real.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic[k];
});
real.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3692-providers');

const fs = require('node:fs');
const os = require('node:os');
const cp = require('node:child_process');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const driver = require(path.join(ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');

const BODY = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '3692-patents', 'patentsearch-body.json'), 'utf8'));
const PV_KEY = 'pvtest-3692-25-not-a-real-key';
const TV_KEY = 'tvtest-3692-25-not-a-real-key';
const TOPIC = 'fiber optic sensing of thin wires';
const PREFLIGHT = { evidence_gaps: [], prior_research: [], section: 'market-analysis' };
const rooms = [];

function clearKeys() {
  delete process.env.PATENTSVIEW_API_KEY;
  delete process.env.TAVILY_API_KEY;
}

function jsonResponse(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
}

// One recording fetch stub: every call is logged (url, header NAMES, body), routed by host.
function makeStub() {
  const calls = [];
  async function stub(url, init) {
    const u = String(url);
    const headers = {};
    const h = (init && init.headers) || {};
    Object.keys(h).forEach(function (k) { headers[k.toLowerCase()] = String(h[k]); });
    calls.push({ url: u, headerNames: Object.keys(headers), headers: headers, body: init && init.body ? String(init.body) : '' });
    if (u.indexOf('search.patentsview.org') !== -1) return jsonResponse(BODY);
    if (u.indexOf('api.tavily.com') !== -1) {
      return jsonResponse({ results: [{ url: 'https://patents.google.com/patent/US4902126A/en', title: 'tavily patent hit', content: 'snippet about thin wire sensing' }] });
    }
    if (u.indexOf('eutils.ncbi.nlm.nih.gov') !== -1 || u.indexOf('ncbi') !== -1) {
      return jsonResponse({ esearchresult: { count: '0', idlist: [] } });
    }
    return jsonResponse({ results: [], meta: { count: 0 } });
  }
  stub.calls = calls;
  return stub;
}

async function runWith(lensNames, opts, setup) {
  clearKeys();
  if (setup) setup();
  const room = buildRoom363({ role: 'researcher' });
  rooms.push(room);
  const stub = makeStub();
  const logs = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  console.log = function () { logs.push(Array.prototype.join.call(arguments, ' ')); };
  console.warn = console.log;
  console.error = console.log;
  const prior = globalThis.fetch;
  globalThis.fetch = stub;
  let result = null;
  let thrown = null;
  try {
    result = await driver.runSourceLens(Object.assign({
      roomDir: room.roomDir,
      topic: TOPIC,
      lensSet: lensNames.map(function (l) { return { lens: l, weight: 1 }; }),
      preflight: PREFLIGHT,
      stage: 'explore',
      db: null,
    }, opts || {}));
  } catch (e) {
    thrown = e;
  } finally {
    globalThis.fetch = prior;
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
    clearKeys();
  }
  return { result: result, thrown: thrown, calls: stub.calls, logs: logs };
}

function lensResult(result, lens) {
  const list = (result && Array.isArray(result.providers)) ? result.providers : [];
  return list.find(function (p) { return p && p.lens === lens; }) || null;
}

async function main() {
  // ---- PV1
  {
    const out = await runWith(['patent'], {});
    const lr = lensResult(out.result, 'patent');
    const asked = out.calls.map(function (c) { return c.url; });
    const pubmed = asked.some(function (u) { return u.indexOf('ncbi') !== -1; });
    check('PV1 patent lens refused before dispatch',
      !!lr && lr.status === 'refused' && lr.reason === 'provider_unavailable:patent',
      'status=' + (lr && lr.status) + ' reason=' + (lr && lr.reason) + ' provider=' + (lr && lr.provider) + ' asked=' + JSON.stringify(asked.map(function (u) { return u.slice(0, 60); })) + (pubmed ? ' (pubmed asked)' : ''));
    check('PV1 zero fetch calls and no PubMed request', out.calls.length === 0 && !pubmed, 'calls=' + out.calls.length + (pubmed ? ' pubmed asked' : ''));
    check('PV1 the lens operation is refused_before_fetch with the same reason',
      !!lr && !!lr.operation && lr.operation.state === 'refused_before_fetch' && lr.operation.reason === 'provider_unavailable:patent',
      'operation=' + JSON.stringify(lr && lr.operation && { state: lr.operation.state, reason: lr.operation.reason }));
  }

  // ---- PV2
  {
    const out = await runWith(['patent'], {}, function () { process.env.PATENTSVIEW_API_KEY = PV_KEY; });
    const r = out.result;
    const pvCalls = out.calls.filter(function (c) { return c.url.indexOf('search.patentsview.org') !== -1; });
    const findings = (r && r.findings) || [];
    const hit = findings.find(function (f) { return /4902126/.test(String(f.url) + String(f.title)); });
    check('PV2 findings carry source patents and the id 4902126',
      findings.length > 0 && findings.every(function (f) { return f.source === 'patents'; }) && !!hit,
      'findings=' + JSON.stringify(findings.map(function (f) { return { source: f.source, url: f.url }; })) + ' thrown=' + (out.thrown && out.thrown.message));
    check('PV2 the request carried the X-Api-Key header', pvCalls.length === 1 && pvCalls[0].headerNames.indexOf('x-api-key') !== -1,
      'pv calls=' + pvCalls.length + ' header names=' + JSON.stringify(pvCalls[0] && pvCalls[0].headerNames));
    check('PV2 the key is in no url', pvCalls.every(function (c) { return c.url.indexOf(PV_KEY) === -1; }), 'url leaked');
    const lr = lensResult(r, 'patent');
    const blob = JSON.stringify(r) + '\n' + out.logs.join('\n') + '\n' + JSON.stringify(lr && lr.operation);
    check('PV2 the key value appears in no result, log or ledger field', blob.indexOf(PV_KEY) === -1, 'key found in output');
    // the real corpus entry returns the same rows with an id and a number
    clearKeys();
    process.env.PATENTSVIEW_API_KEY = PV_KEY;
    const stub = makeStub();
    const prior = globalThis.fetch;
    globalThis.fetch = stub;
    let env = null;
    let err = null;
    try { env = await corpus.fetchCorpusEnvelope({ source: 'patents', query: TOPIC, limit: 10 }); } catch (e) { err = e; }
    globalThis.fetch = prior;
    clearKeys();
    const rows = (env && env.payload && env.payload.results) || [];
    check('PV2 the corpus envelope rows carry source patents and US4902126',
      rows.length === 2 && rows.every(function (x) { return x.source === 'patents'; }) && rows.some(function (x) { return x.id === 'US4902126'; }),
      'rows=' + JSON.stringify(rows.map(function (x) { return { id: x.id, source: x.source }; })) + ' err=' + (err && err.message));
  }

  // ---- PV3
  {
    const out = await runWith(['patent'], { allowFallback: { patent: 'tavily' } }, function () { process.env.TAVILY_API_KEY = TV_KEY; });
    const tv = out.calls.filter(function (c) { return c.url.indexOf('api.tavily.com') !== -1; });
    let body = {};
    try { body = JSON.parse(tv[0].body); } catch (_e) { /* leave empty */ }
    check('PV3 one Tavily request with include_domains patents.google.com',
      out.calls.length === 1 && tv.length === 1 && Array.isArray(body.include_domains) && body.include_domains.length === 1 && body.include_domains[0] === 'patents.google.com',
      'calls=' + out.calls.length + ' include_domains=' + JSON.stringify(body.include_domains));
    const lr = lensResult(out.result, 'patent');
    const fb = lr && lr.operation && lr.operation.fallback;
    check('PV3 the lens operation records the four invariant-6 fields',
      !!fb && fb.original_provider === 'patents' && fb.fallback_provider === 'tavily' && fb.reason === 'no_patent_key' && fb.authorized_by === 'navigator',
      'fallback=' + JSON.stringify(fb));
    check('PV3 the fallback is visible on the lens result, not silent', !!lr && !!lr.fallback && lr.fallback.fallback_provider === 'tavily', 'lens fallback=' + JSON.stringify(lr && lr.fallback));
    const blob = JSON.stringify(out.result) + out.logs.join('\n');
    check('PV3 the Tavily key value appears in no result or log', blob.indexOf(TV_KEY) === -1, 'key found in output');

    const out2 = await runWith(['patent'], {}, function () { process.env.TAVILY_API_KEY = TV_KEY; });
    const lr2 = lensResult(out2.result, 'patent');
    check('PV3 without allowFallback the PV1 refusal stands, zero calls',
      !!lr2 && lr2.status === 'refused' && lr2.reason === 'provider_unavailable:patent' && out2.calls.length === 0,
      'status=' + (lr2 && lr2.status) + ' calls=' + out2.calls.length);

    const out3 = await runWith(['patent'], { allowFallback: { patent: 'tavily' } });
    const lr3 = lensResult(out3.result, 'patent');
    check('PV3 a fallback grant with no Tavily key still refuses, zero calls',
      !!lr3 && lr3.status === 'refused' && out3.calls.length === 0 && !lr3.fallback,
      'status=' + (lr3 && lr3.status) + ' calls=' + out3.calls.length);
  }

  // ---- PV4
  {
    const out = await runWith(['scholarly', 'industry', 'patent'], {});
    const r = out.result || {};
    const unavailable = Array.isArray(r.unavailable_lenses) ? r.unavailable_lenses : [];
    const names = unavailable.map(function (u) { return u.lens; });
    const searched = Array.isArray(r.searched_lenses) ? r.searched_lenses : [];
    check('PV4 patent and industry listed unavailable by name',
      names.indexOf('patent') !== -1 && names.indexOf('industry') !== -1 && unavailable.every(function (u) { return typeof u.reason === 'string' && u.reason.indexOf('provider_unavailable:') === 0; }),
      'unavailable=' + JSON.stringify(unavailable));
    check('PV4 the searched lens list excludes both and keeps scholarly',
      searched.indexOf('patent') === -1 && searched.indexOf('industry') === -1 && searched.indexOf('scholarly') !== -1,
      'searched=' + JSON.stringify(searched));
    const patentOrTavily = out.calls.filter(function (c) { return c.url.indexOf('tavily') !== -1 || c.url.indexOf('patentsview') !== -1 || c.url.indexOf('ncbi') !== -1; });
    check('PV4 no patent, Tavily or PubMed request was made', patentOrTavily.length === 0, 'calls=' + JSON.stringify(patentOrTavily.map(function (c) { return c.url.slice(0, 50); })));
  }

  // ---- PV5
  {
    const I = driver._internal;
    check('PV5 LENS_TO_SOURCE.patent is not pubmed', I.LENS_TO_SOURCE.patent !== 'pubmed', 'patent=' + I.LENS_TO_SOURCE.patent);
    check('PV5 SOURCE_TO_TIER has an entry for patents', typeof I.SOURCE_TO_TIER.patents === 'string' && I.SOURCE_TO_TIER.patents.length > 0, 'tier=' + I.SOURCE_TO_TIER.patents);
  }

  // ---- PF1
  {
    const out = await runWith(['scholarly', 'industry', 'patent'], {});
    const r = out.result || {};
    const pre = r.preflight || {};
    const un = Array.isArray(pre.unavailable) ? pre.unavailable : [];
    const ind = un.find(function (u) { return u && u.lens === 'industry'; });
    const pat = un.find(function (u) { return u && u.lens === 'patent'; });
    check('PF1 preflight names industry as tavily with reason no_key',
      !!ind && ind.provider === 'tavily' && ind.reason === 'no_key', 'unavailable=' + JSON.stringify(un));
    check('PF1 preflight names the patent lane', !!pat && typeof pat.provider === 'string' && pat.provider.length > 0 && pat.reason === 'no_key', 'patent=' + JSON.stringify(pat));
    check('PF1 preflight lists scholarly as available', Array.isArray(pre.available) && pre.available.indexOf('scholarly') !== -1 && pre.available.indexOf('industry') === -1, 'available=' + JSON.stringify(pre.available));
    const tv = out.calls.filter(function (c) { return c.url.indexOf('api.tavily.com') !== -1; });
    const pv = out.calls.filter(function (c) { return c.url.indexOf('patentsview') !== -1; });
    check('PF1 zero Tavily and zero PatentsView requests', tv.length === 0 && pv.length === 0, 'tavily=' + tv.length + ' patentsview=' + pv.length);
    const names = (Array.isArray(r.lens_set) ? r.lens_set : []).map(function (e) { return e.lens; });
    check('PF1 result.lens_set drops both and keeps scholarly', names.indexOf('industry') === -1 && names.indexOf('patent') === -1 && names.indexOf('scholarly') !== -1, 'lens_set=' + JSON.stringify(names));
    const li = lensResult(r, 'industry');
    const lp = lensResult(r, 'patent');
    check('PF1 each unavailable lens has a refused_before_fetch operation',
      !!li && !!li.operation && li.operation.state === 'refused_before_fetch' && li.operation.reason === 'provider_unavailable:tavily'
      && !!lp && !!lp.operation && lp.operation.state === 'refused_before_fetch' && lp.operation.reason === 'provider_unavailable:patent',
      'industry=' + JSON.stringify(li && li.operation && { s: li.operation.state, r: li.operation.reason }) + ' patent=' + JSON.stringify(lp && lp.operation && { s: lp.operation.state, r: lp.operation.reason }));
    const ls = lensResult(r, 'scholarly');
    check('PF1 scholarly still searched', !!ls && !!ls.operation && (ls.operation.state === 'executed_with_results' || ls.operation.state === 'executed_empty') && out.calls.some(function (c) { return c.url.indexOf('openalex') !== -1; }),
      'scholarly=' + JSON.stringify(ls && ls.operation && ls.operation.state) + ' thrown=' + (out.thrown && out.thrown.message));
    // a healthy run keeps its shape: no preflight or answer_line key when nothing is unavailable
    const healthy = await runWith(['scholarly'], {});
    check('PF1 a run with every lens available carries no preflight or answer_line key',
      !!healthy.result && healthy.result.preflight === undefined && healthy.result.answer_line === undefined,
      'keys=' + JSON.stringify(Object.keys(healthy.result || {})));
  }

  // ---- PF2
  {
    const SENTENCE = 'Industry search needs a Tavily key, and none is set, so industry, competitive intelligence and grants were not searched.';
    const out = await runWith(['scholarly', 'industry', 'competitive-intelligence', 'grants'], {});
    const line = out.result && out.result.answer_line;
    check('PF2 the answer line is the one sentence naming the three Tavily lenses', typeof line === 'string' && line.indexOf(SENTENCE) !== -1, 'answer_line=' + JSON.stringify(line));
    check('PF2 the answer line has no dash characters', typeof line === 'string' && !/[–—]/.test(line), 'line=' + line);
    const one = await runWith(['scholarly', 'industry'], {});
    check('PF2 one unavailable Tavily lens reads in the singular',
      !!one.result && one.result.answer_line === 'Industry search needs a Tavily key, and none is set, so industry was not searched.',
      'answer_line=' + JSON.stringify(one.result && one.result.answer_line));
    const keyed = await runWith(['scholarly', 'industry', 'competitive-intelligence', 'grants'], {}, function () { process.env.TAVILY_API_KEY = TV_KEY; });
    check('PF2 with a Tavily key set there is no answer line and no unavailable lens',
      !!keyed.result && keyed.result.answer_line === undefined && keyed.result.unavailable_lenses === undefined && keyed.calls.some(function (c) { return c.url.indexOf('api.tavily.com') !== -1; }),
      'answer_line=' + JSON.stringify(keyed.result && keyed.result.answer_line));
  }

  // ---- PF3
  {
    let mod = null;
    let loadErr = null;
    try { mod = require(path.join(ROOT, 'lib', 'core', 'doctor', 'research-providers-module.cjs')); } catch (e) { loadErr = e; }
    check('PF3 the module loads and exports check and matrix', !!mod && typeof mod.check === 'function' && typeof mod.matrix === 'function', 'load error=' + (loadErr && loadErr.message));
    if (mod && typeof mod.matrix === 'function') {
      const before = NET.attempts();
      clearKeys();
      const rows = mod.matrix({});
      const row = function (lens) { return rows.find(function (x) { return x.lens === lens; }) || null; };
      const lenses = Object.keys(driver._internal.LENS_TO_SOURCE);
      check('PF3 one row per lens with a provider and a state',
        lenses.every(function (l) { const x = row(l); return !!x && typeof x.provider === 'string' && typeof x.state === 'string' && x.state.length > 0; }),
        'rows=' + JSON.stringify(rows.map(function (x) { return x.lens; })));
      check('PF3 industry on tavily is no key with the key unset', !!row('industry') && row('industry').provider === 'tavily' && row('industry').state === 'no key', JSON.stringify(row('industry')));
      check('PF3 patent has a patent provider and no key', !!row('patent') && row('patent').state === 'no key', JSON.stringify(row('patent')));
      check('PF3 brain is on theo', !!row('brain') && row('brain').provider === 'theo', JSON.stringify(row('brain')));
      check('PF3 the judge row is judge_jev on typesafe and line off by default', !!row('judge_jev') && row('judge_jev').provider === 'typesafe' && row('judge_jev').state === 'line off', JSON.stringify(row('judge_jev')));
      check('PF3 a theo row and a planner row are present', !!row('theo') && row('theo').provider === 'theo' && !!row('planner') && row('planner').provider === 'openalex' && /^ready/.test(row('planner').state), JSON.stringify([row('theo'), row('planner')]));
      process.env.TAVILY_API_KEY = TV_KEY;
      process.env.PATENTSVIEW_API_KEY = PV_KEY;
      const rows2 = mod.matrix({});
      const ind2 = rows2.find(function (x) { return x.lens === 'industry'; });
      check('PF3 industry is ready with a test key set', !!ind2 && ind2.state === 'ready', JSON.stringify(ind2));
      const res = mod.check({});
      const blob = JSON.stringify(rows2) + JSON.stringify(res);
      clearKeys();
      check('PF3 no key value in the rows or in check()', blob.indexOf(TV_KEY) === -1 && blob.indexOf(PV_KEY) === -1, 'key found in output');
      check('PF3 check() returns a status, a detail, and one line per row',
        !!res && ['ok', 'warn', 'error', 'skip'].indexOf(res.status) !== -1 && typeof res.detail === 'string' && res.detail.indexOf('industry -> tavily: ready') !== -1 && res.detail.indexOf('judge_jev -> typesafe: line off') !== -1,
        'result=' + JSON.stringify(res).slice(0, 300));
      check('PF3 matrix and check made zero network calls', NET.attempts() === before, 'attempts delta=' + (NET.attempts() - before));
    }
  }

  // ---- PF4
  {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pf4-home-'));
    const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, DOCTOR_TEST_MODE: '1', MINDRIAN_ACCEPTANCE_PROGRESS: '0' });
    delete env.TAVILY_API_KEY;
    delete env.PATENTSVIEW_API_KEY;
    const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.cjs'), '--json'], { env: env, cwd: ROOT, encoding: 'utf8', timeout: 180000 });
    const text = String(r.stdout || '');
    let json = null;
    try { json = JSON.parse(text.slice(text.indexOf('{'))); } catch (_e) { json = null; }
    const mres = json && json.checks && json.checks['research-providers'];
    check('PF4 doctor --json carries the research-providers module result',
      !!mres && typeof mres.status === 'string' && typeof mres.detail === 'string' && mres.detail.indexOf('industry -> tavily: no key') !== -1,
      'exit=' + r.status + ' result=' + JSON.stringify(mres) + ' stderr=' + String(r.stderr || '').slice(-200));
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  // ---- PF5
  {
    const run = function (file) {
      return cp.spawnSync(process.execPath, [path.join(ROOT, 'tests', file)], { cwd: ROOT, encoding: 'utf8', timeout: 240000, env: Object.assign({}, process.env) });
    };
    const c = run('test-doctor-module-contract-parity.cjs');
    check('PF5 the doctor module contract-parity test passes with the new entry', c.status === 0, 'exit=' + c.status + ' tail=' + String((c.stdout || '') + (c.stderr || '')).slice(-300));
    const d = run('test-doctor-doc-parity.cjs');
    const lines = String((d.stdout || '') + (d.stderr || '')).split('\n').filter(function (l) { return /^\s*FAIL - /.test(l); });
    // The one violation allowed is the --none flag in doctor.md front matter (commit fa2f1414e, plan 267.3), a
    // defect that predates this plan; any other violation, and any that names this module, fails the leg.
    const mine = lines.filter(function (l) { return !/flag --none is documented/.test(l); });
    check('PF5 the doctor doc-parity test reports no violation caused by the new entry', (d.status === 0 || mine.length === 0) && lines.every(function (l) { return l.indexOf('research-providers') === -1; }),
      'exit=' + d.status + ' violations=' + JSON.stringify(lines));
  }

  check('net guard: no fetch escaped the stubs', NET.attempts() === 0, 'attempts=' + NET.attempts());
  rooms.forEach(function (rm) { try { rm.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(summary());
}

main().catch(function (e) {
  console.log('FAIL: test crashed: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
