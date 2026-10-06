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

  check('net guard: no fetch escaped the stubs', NET.attempts() === 0, 'attempts=' + NET.attempts());
  rooms.forEach(function (rm) { try { rm.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(summary());
}

main().catch(function (e) {
  console.log('FAIL: test crashed: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
