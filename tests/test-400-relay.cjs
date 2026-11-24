#!/usr/bin/env node
'use strict';
// Phase 400 plan 12 (RL-01, RL-02, RL-03): the decision relay pipeline, proven without a socket and without the network.
//   C1 config defaults, invalid numbers, dropped operator hashes, no key value in the config
//   C2 install callers (no caller, bad id, user traffic off, hashed bucket)
//   C3 operator token by sha256 and timingSafeEqual, no fallback after a bad token
//   C4 cap order, refused calls never counted, operator meets only its own cap
//   C5 bounded bucket tables   C6 UTC day reset and Retry-After to the next UTC midnight
// Only 127.0.0.1 is used. No GEMINI_API_KEY is read from this machine; tests inject a fake value. Hyphens only.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const REL = path.join(REPO, 'services/decision-relay');
const realFetch = globalThis.fetch;
// Any path that skips the injected fetch lands on this thrower and is counted.
let strayFetch = 0;
globalThis.fetch = function stray() { strayFetch += 1; throw new Error('stray fetch in test-400-relay'); };

let pass = 0;
let fail = 0;
async function leg(name, fn) {
  let ok;
  try { ok = await fn(); } catch (e) { ok = 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 400); }
  if (ok === true) { pass += 1; console.log('PASS: ' + name); } else { fail += 1; console.log('FAIL: ' + name + ' (' + String(ok) + ')'); }
}

function load(name) { return require(path.join(REL, name)); }
function sha(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

const OP_TOKEN = 'operator-token-400-test-cccc3333';
const OP_HASH = sha(OP_TOKEN);
const INSTALL_ID = '0123456789abcdef0123456789abcdef';
const DAY0 = Date.UTC(2026, 10, 24, 10, 0, 0);

function clock(start) {
  const c = { t: start };
  c.now = () => c.t;
  return c;
}

function cfgWith(over) {
  const config = load('config.cjs');
  return Object.assign({}, config.loadConfig({}), over || {});
}

function install(bucketSeed) {
  return { ok: true, kind: 'install', bucket: sha('seed:' + bucketSeed).slice(0, 32) };
}
const OPERATOR = { ok: true, kind: 'operator', bucket: 'operator' };

async function main() {
  // ---------- C1 ----------
  await leg('C1 loadConfig({}) equals DEFAULTS; user traffic off; no operator hashes', () => {
    const { loadConfig, DEFAULTS } = load('config.cjs');
    const c = loadConfig({});
    if (JSON.stringify(c) !== JSON.stringify(DEFAULTS)) return 'not equal to DEFAULTS';
    if (c.userTraffic !== false) return 'userTraffic not false';
    if (!Array.isArray(c.operatorHashes) || c.operatorHashes.length !== 0) return 'operator hashes not empty';
    if (c.hasKey !== false) return 'hasKey not false';
    const want = { proxyHops: 0, maxBodyBytes: 524288, maxQuestions: 1000, installPerMinute: 10, installDailyQuestions: 2000,
      addressDailyQuestions: 20000, globalDailyRequests: 5000, globalDailyQuestions: 100000, globalDailyInputTokens: 20000000,
      operatorDailyQuestions: 200000, maxBuckets: 10000, upstreamTimeoutMs: 120000 };
    for (const k of Object.keys(want)) if (c[k] !== want[k]) return k + ' is ' + c[k];
    return Object.isFrozen(DEFAULTS) ? true : 'DEFAULTS not frozen';
  });
  await leg('C1 invalid numbers fall back; valid values apply; RELAY_USER_TRAFFIC=on only', () => {
    const { loadConfig, DEFAULTS } = load('config.cjs');
    const c = loadConfig({ RELAY_MAX_BODY_BYTES: 'abc', RELAY_MAX_QUESTIONS: '-5', RELAY_INSTALL_PER_MINUTE: '3.5', RELAY_MAX_BUCKETS: '0',
      RELAY_GLOBAL_DAILY_REQUESTS: '12', RELAY_PROXY_HOPS: '1', RELAY_UPSTREAM_TIMEOUT_MS: '1e3', RELAY_USER_TRAFFIC: 'on' });
    if (c.maxBodyBytes !== DEFAULTS.maxBodyBytes || c.maxQuestions !== DEFAULTS.maxQuestions) return 'invalid size or questions applied';
    if (c.installPerMinute !== DEFAULTS.installPerMinute || c.maxBuckets !== DEFAULTS.maxBuckets) return 'invalid rate or buckets applied';
    if (c.upstreamTimeoutMs !== DEFAULTS.upstreamTimeoutMs) return 'exponent form applied';
    if (c.globalDailyRequests !== 12 || c.proxyHops !== 1 || c.userTraffic !== true) return 'valid values not applied';
    for (const v of ['ON', 'true', '1', 'yes', ' on']) if (loadConfig({ RELAY_USER_TRAFFIC: v }).userTraffic !== false) return 'traffic on for ' + v;
    return true;
  });
  await leg('C1 operator hashes: 64 hex kept (lowercased), others dropped and counted; key value never copied', () => {
    const { loadConfig } = load('config.cjs');
    const key = 'fake-gemini-key-400-dddd4444';
    const c = loadConfig({ RELAY_OPERATOR_TOKEN_SHA256: OP_HASH.toUpperCase() + ', nothex,' + 'a'.repeat(63) + ',,' + sha('two'), GEMINI_API_KEY: key });
    if (c.operatorHashes.length !== 2 || c.operatorHashes[0] !== OP_HASH || c.operatorHashes[1] !== sha('two')) return 'hashes ' + JSON.stringify(c.operatorHashes);
    if (c.droppedHashes !== 2) return 'droppedHashes ' + c.droppedHashes;
    if (c.hasKey !== true) return 'hasKey not true';
    if (JSON.stringify(c).indexOf(key) !== -1) return 'key value in config';
    return true;
  });

  // ---------- C2 ----------
  await leg('C2 no caller, bad install id, user traffic off, install bucket', () => {
    const { verifyCaller } = load('verify-caller.cjs');
    const off = cfgWith({ userTraffic: false });
    const on = cfgWith({ userTraffic: true });
    const a = verifyCaller({}, off);
    if (a.ok !== false || a.status !== 401 || a.reason !== 'no_caller') return 'no caller ' + JSON.stringify(a);
    for (const bad of ['ABCDEF0123456789abcdef0123456789', 'abc', INSTALL_ID + '0', ' ' + INSTALL_ID, '']) {
      const b = verifyCaller({ 'x-theo-install-id': bad }, on);
      if (b.status !== 401 || b.reason !== 'bad_install_id') return 'bad id ' + JSON.stringify(bad) + ' ' + JSON.stringify(b);
    }
    const arr = verifyCaller({ 'x-theo-install-id': [INSTALL_ID, INSTALL_ID] }, on);
    if (arr.reason !== 'bad_install_id') return 'array header accepted';
    const c = verifyCaller({ 'X-Theo-Install-Id': INSTALL_ID }, off);
    if (c.ok !== false || c.status !== 403 || c.reason !== 'user_traffic_off') return 'traffic off ' + JSON.stringify(c);
    const d = verifyCaller({ 'X-THEO-INSTALL-ID': INSTALL_ID }, on);
    if (d.ok !== true || d.kind !== 'install' || !/^[a-f0-9]{32}$/.test(d.bucket)) return 'install ' + JSON.stringify(d);
    if (d.bucket === INSTALL_ID || d.bucket.indexOf(INSTALL_ID.slice(0, 12)) !== -1) return 'bucket carries the id';
    const e = verifyCaller({ 'x-theo-install-id': INSTALL_ID }, on);
    if (e.bucket !== d.bucket) return 'bucket not stable';
    const f = verifyCaller({ 'x-theo-install-id': 'fedcba9876543210fedcba9876543210' }, on);
    if (f.bucket === d.bucket) return 'two ids share a bucket';
    const src = fs.readFileSync(path.join(REL, 'verify-caller.cjs'), 'utf8');
    if (src.indexOf('installIdHeaderName') === -1) return 'header name not taken from install-id.cjs';
    return true;
  });

  // ---------- C3 ----------
  await leg('C3 operator token by sha256; wrong token is bad_token even with a valid install id; timingSafeEqual', () => {
    const { verifyCaller } = load('verify-caller.cjs');
    const cfg = cfgWith({ userTraffic: true, operatorHashes: [sha('other'), OP_HASH] });
    const a = verifyCaller({ authorization: 'Bearer ' + OP_TOKEN }, cfg);
    if (a.ok !== true || a.kind !== 'operator' || a.bucket !== 'operator') return 'operator ' + JSON.stringify(a);
    const a2 = verifyCaller({ Authorization: 'bearer ' + OP_TOKEN, 'x-theo-install-id': INSTALL_ID }, cfg);
    if (a2.kind !== 'operator') return 'scheme case or header case';
    const b = verifyCaller({ authorization: 'Bearer wrong-token', 'x-theo-install-id': INSTALL_ID }, cfg);
    if (b.ok !== false || b.status !== 401 || b.reason !== 'bad_token') return 'wrong token ' + JSON.stringify(b);
    for (const h of ['Basic ' + OP_TOKEN, 'Bearer', 'Bearer ', '', OP_TOKEN]) {
      const c = verifyCaller({ authorization: h, 'x-theo-install-id': INSTALL_ID }, cfg);
      if (c.reason !== 'bad_token') return 'header ' + JSON.stringify(h) + ' gave ' + JSON.stringify(c);
    }
    const none = verifyCaller({ authorization: 'Bearer ' + OP_TOKEN }, cfgWith({ operatorHashes: [] }));
    if (none.reason !== 'bad_token') return 'empty hash list accepted a token';
    const src = fs.readFileSync(path.join(REL, 'verify-caller.cjs'), 'utf8');
    if (src.indexOf('timingSafeEqual') === -1) return 'no timingSafeEqual';
    if (/[Hh]ashes\.(indexOf|includes|some|find)\(/.test(src)) return 'plain compare on hashes';
    return true;
  });

  // ---------- C4 ----------
  await leg('C4 install per-minute window: install_rate with retryAfterS to the window end', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    const L = createLimits(cfgWith({ installPerMinute: 2 }), ck.now);
    const me = install('a');
    if (!L.take(me, 1, '10.0.0.1').ok || !L.take(me, 1, '10.0.0.1').ok) return 'first two refused';
    ck.t += 20000;
    const r = L.take(me, 1, '10.0.0.1');
    if (r.ok !== false || r.status !== 429 || r.reason !== 'install_rate' || r.retryAfterS !== 40) return JSON.stringify(r);
    if (!L.take(install('b'), 1, '10.0.0.1').ok) return 'other install blocked';
    ck.t += 40000;
    return L.take(me, 1, '10.0.0.1').ok === true ? true : 'window did not reset';
  });
  await leg('C4 refusal order and refused calls never counted', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    // install daily questions
    let L = createLimits(cfgWith({ installDailyQuestions: 5 }), ck.now);
    if (!L.take(install('a'), 5, '1.1.1.1').ok) return 'install 5 refused';
    let r = L.take(install('a'), 1, '1.1.1.1');
    if (r.reason !== 'install_daily_cap') return 'want install_daily_cap got ' + JSON.stringify(r);
    if (L.snapshot().globalQuestions !== 5 || L.snapshot().globalRequests !== 1) return 'refused call counted ' + JSON.stringify(L.snapshot());
    // address daily questions
    L = createLimits(cfgWith({ addressDailyQuestions: 6 }), ck.now);
    if (!L.take(install('a'), 4, '1.1.1.1').ok) return 'addr first refused';
    r = L.take(install('b'), 3, '1.1.1.1');
    if (r.reason !== 'address_daily_cap') return 'want address_daily_cap got ' + JSON.stringify(r);
    if (!L.take(install('b'), 3, '2.2.2.2').ok) return 'other address blocked or refused call counted on install b';
    // global daily requests
    L = createLimits(cfgWith({ globalDailyRequests: 2 }), ck.now);
    L.take(install('a'), 1, 'x'); L.take(install('b'), 1, 'y');
    r = L.take(install('c'), 1, 'z');
    if (r.reason !== 'global_daily_requests') return 'want global_daily_requests got ' + JSON.stringify(r);
    // global daily questions
    L = createLimits(cfgWith({ globalDailyQuestions: 10 }), ck.now);
    L.take(install('a'), 6, 'x');
    r = L.take(install('b'), 5, 'y');
    if (r.reason !== 'global_daily_questions') return 'want global_daily_questions got ' + JSON.stringify(r);
    if (!L.take(install('b'), 4, 'y').ok) return 'exact fill refused';
    // global input tokens, recorded after a call
    L = createLimits(cfgWith({ globalDailyInputTokens: 100 }), ck.now);
    if (!L.take(install('a'), 1, 'x').ok) return 'token first refused';
    L.recordUsage(install('a'), 100);
    r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'global_token_cap') return 'want global_token_cap got ' + JSON.stringify(r);
    // order: install_rate before the daily caps
    L = createLimits(cfgWith({ installPerMinute: 1, installDailyQuestions: 1, globalDailyRequests: 1 }), ck.now);
    L.take(install('a'), 1, 'x');
    r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'install_rate') return 'order: want install_rate got ' + r.reason;
    // order: install daily before address daily before global
    L = createLimits(cfgWith({ installDailyQuestions: 1, addressDailyQuestions: 1, globalDailyQuestions: 1 }), ck.now);
    L.take(install('a'), 1, 'x');
    r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'install_daily_cap') return 'order: want install_daily_cap got ' + r.reason;
    r = L.take(install('b'), 1, 'x');
    if (r.reason !== 'address_daily_cap') return 'order: want address_daily_cap got ' + r.reason;
    r = L.take(install('c'), 1, 'y');
    if (r.reason !== 'global_daily_questions') return 'order: want global_daily_questions got ' + r.reason;
    return true;
  });
  await leg('C4 the operator skips every user cap and meets only operator_daily_cap', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    const L = createLimits(cfgWith({ installPerMinute: 1, installDailyQuestions: 1, addressDailyQuestions: 1, globalDailyRequests: 1,
      globalDailyQuestions: 1, globalDailyInputTokens: 1, operatorDailyQuestions: 2500 }), ck.now);
    L.take(install('a'), 1, 'x');
    L.recordUsage(install('a'), 5);
    for (let i = 0; i < 2; i += 1) {
      const r = L.take(OPERATOR, 1000, 'x');
      if (!r.ok) return 'operator refused ' + JSON.stringify(r);
      L.recordUsage(OPERATOR, 99999);
    }
    const r = L.take(OPERATOR, 501, 'x');
    if (r.ok !== false || r.status !== 429 || r.reason !== 'operator_daily_cap') return JSON.stringify(r);
    if (!L.take(OPERATOR, 500, 'x').ok) return 'refused operator call counted';
    const s = L.snapshot();
    if (s.operatorQuestions !== 2500 || s.globalQuestions !== 1 || s.globalRequests !== 1) return 'snapshot ' + JSON.stringify(s);
    return true;
  });

  // ---------- C5 ----------
  await leg('C5 a new bucket on a full table refuses bucket_table_full; existing buckets still work; snapshot is counts only', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    const L = createLimits(cfgWith({ maxBuckets: 3 }), ck.now);
    for (const s of ['a', 'b', 'c']) if (!L.take(install(s), 1, '9.9.9.9').ok) return 'fill refused ' + s;
    const r = L.take(install('d'), 1, '9.9.9.9');
    if (r.ok !== false || r.status !== 429 || r.reason !== 'bucket_table_full') return JSON.stringify(r);
    if (!L.take(install('a'), 1, '9.9.9.9').ok) return 'existing bucket refused';
    // address table is bounded too
    const M = createLimits(cfgWith({ maxBuckets: 2 }), ck.now);
    M.take(install('a'), 1, '1.0.0.1'); M.take(install('b'), 1, '1.0.0.2');
    const r2 = M.take(install('a'), 1, '1.0.0.3');
    if (r2.reason !== 'bucket_table_full') return 'address table not bounded ' + JSON.stringify(r2);
    const s = L.snapshot();
    for (const k of Object.keys(s)) if (typeof s[k] !== 'number' && k !== 'day') return 'snapshot key ' + k + ' not a count';
    const text = JSON.stringify(s);
    if (text.indexOf('9.9.9.9') !== -1 || text.indexOf(install('a').bucket) !== -1) return 'snapshot holds an address or a bucket';
    if (s.installBuckets !== 3 || s.addressBuckets !== 1) return 'snapshot counts ' + text;
    const src = fs.readFileSync(path.join(REL, 'limits.cjs'), 'utf8');
    if (!/createHmac|createHash/.test(src)) return 'addresses are not hashed';
    return true;
  });

  // ---------- C6 ----------
  await leg('C6 the UTC day change resets every daily counter; daily Retry-After is the seconds to the next UTC midnight', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(Date.UTC(2026, 10, 24, 23, 59, 0));
    const L = createLimits(cfgWith({ installDailyQuestions: 2, globalDailyRequests: 100, operatorDailyQuestions: 1, maxBuckets: 1 }), ck.now);
    if (!L.take(install('a'), 2, 'x').ok) return 'first refused';
    if (!L.take(OPERATOR, 1, 'x').ok) return 'operator first refused';
    ck.t += 30000; // 23:59:30
    const r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'install_daily_cap' || r.retryAfterS !== 30) return 'daily ' + JSON.stringify(r);
    const o = L.take(OPERATOR, 1, 'x');
    if (o.reason !== 'operator_daily_cap' || o.retryAfterS !== 30) return 'operator ' + JSON.stringify(o);
    const f = L.take(install('z'), 1, 'x');
    if (f.reason !== 'bucket_table_full' || f.retryAfterS !== 30) return 'table full ' + JSON.stringify(f);
    ck.t = Date.UTC(2026, 10, 25, 0, 0, 1);
    const s0 = L.snapshot();
    if (s0.globalRequests !== 0 || s0.globalQuestions !== 0 || s0.operatorQuestions !== 0 || s0.installBuckets !== 0) return 'snapshot not reset ' + JSON.stringify(s0);
    if (!L.take(install('a'), 2, 'x').ok) return 'install not reset';
    if (!L.take(OPERATOR, 1, 'x').ok) return 'operator not reset';
    return true;
  });
  await leg('C1-C6 no npm require in the relay modules', () => {
    for (const f of fs.readdirSync(REL).filter((n) => n.endsWith('.cjs'))) {
      const src = fs.readFileSync(path.join(REL, f), 'utf8');
      const reqs = src.match(/require\((['"])([^'"]+)\1\)/g) || [];
      for (const r of reqs) {
        const m = /require\((['"])([^'"]+)\1\)/.exec(r)[2];
        if (!m.startsWith('node:') && !m.startsWith('.') && !m.startsWith('/')) return f + ' requires ' + m;
      }
    }
    return true;
  });

  // RELAY_LEGS_START
  // RELAY_LEGS_END

  if (strayFetch !== 0) { fail += 1; console.log('FAIL: stray fetch calls: ' + strayFetch); }
  globalThis.fetch = realFetch;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL: main threw ' + String(e && e.stack ? e.stack : e)); process.exit(1); });
