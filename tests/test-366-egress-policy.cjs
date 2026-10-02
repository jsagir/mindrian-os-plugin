#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 17 (EPV366-22, ADR-E16): one declared egress policy, read by the audit ledger.
 *
 *   E1   loadEgressPolicy(roomDir) returns the seven lines with the planning defaults
 *   E2   a room override can turn research off; one that sets judge_jev true is ignored and reported
 *   E3   loadEgressPolicy(roomDir, {offline:true}) returns every line off
 *   E4   lineForProvider maps openalex, theo, typesafe, anthropic, huggingface; unknown is null
 *   E4b  provider sweep: every provider string the planner can write maps to a line
 *   E5   appendAudit for openalex with research off returns egress_line_off and writes nothing
 *   E6   a malformed override file is ignored, named in policy.ignored, never throws
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is
 * cleared BEFORE any repo module loads. No live network. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-egress-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-egress-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-egress-policy');

const RP = path.join(REPO_ROOT, 'lib/core/research-planner');
const auditLedger = require(path.join(RP, 'audit-ledger.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
let egress = null;
let egressLoadError = null;
try { egress = require(path.join(RP, 'egress-policy.cjs')); } catch (e) { egressLoadError = e; }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-egress-'));
let seq = 0;

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function mkRoom() {
  seq += 1;
  const dir = path.join(root, 'room' + seq);
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}
function writeOverride(roomDir, body) {
  fs.writeFileSync(path.join(roomDir, '.mindrian', 'egress-policy.json'), typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
}
function auditRecord(provider) {
  return {
    ts: '2026-10-02T12:00:00.000Z', run_id: 'run-x', grant_id: 'grant-x', grant_version: 1,
    q: 'adaptive routing', q_hash: 'sha256:abc', template_id: 'eureka', family: 'concept-evidence/v1',
    part8_verdict: 'pass', provider: provider, filters: {}, pagination: { per_page: 5, page: 1 },
    fallback_used: false, origin_ref: 'run-x/l1', result_ids: [], content_hashes: [], outcome: 'ok',
    failure_class: null, count: 0, cost_usd: null, remaining_usd: null, x_query: null, latency_ms: 1,
  };
}
const LINES = ['vector_model_download', 'judge_jev', 'research', 'citation_check', 'prose', 'theo', 'entity_extraction'];
const DEFAULTS = { vector_model_download: false, judge_jev: false, research: true, citation_check: false, prose: true, theo: true, entity_extraction: false };

(async function main() {
  await leg('E0 the reader module loads', function () {
    if (egressLoadError) return 'load: ' + String(egressLoadError.message).slice(0, 160);
    return (typeof egress.loadEgressPolicy === 'function' && typeof egress.lineAllowed === 'function' && typeof egress.lineForProvider === 'function') || 'exports missing';
  });
  if (!egress) {
    C.check('zero network attempts', net.attempts() === 0, String(net.attempts()));
    process.exit(C.summary());
  }

  // ----- E1 -----
  await leg('E1 loadEgressPolicy returns the seven lines with the planning defaults', function () {
    const room = mkRoom();
    const p = egress.loadEgressPolicy(room);
    const names = Object.keys(p.lines).sort().join(',');
    const defaultsOk = LINES.every(function (l) { return egress.lineAllowed(p, l) === DEFAULTS[l]; });
    const fileCount = Object.keys(require(path.join(REPO_ROOT, 'data/egress-policy.json')).lines).length;
    return (names === LINES.slice().sort().join(',') && defaultsOk && fileCount === 7 && p.offline === false && Array.isArray(p.ignored) && p.ignored.length === 0) ||
      JSON.stringify({ names: names, defaultsOk: defaultsOk, fileCount: fileCount, ignored: p.ignored });
  });
  await leg('E1b a line with no entry (or a null line) is never allowed', function () {
    const p = egress.loadEgressPolicy(mkRoom());
    return (egress.lineAllowed(p, 'no_such_line') === false && egress.lineAllowed(p, null) === false && egress.lineAllowed(null, 'research') === false) || 'unknown line allowed';
  });

  // ----- E2 -----
  await leg('E2 a room override can turn research off; judge_jev true cannot widen and is reported', function () {
    const room = mkRoom();
    writeOverride(room, { schema: 'mos.egress-policy/1', lines: { research: { default: false }, judge_jev: { default: true } } });
    const p = egress.loadEgressPolicy(room);
    const named = p.ignored.some(function (x) { return /judge_jev/.test(String(x)); });
    return (egress.lineAllowed(p, 'research') === false && egress.lineAllowed(p, 'judge_jev') === false && egress.lineAllowed(p, 'theo') === true && named) ||
      JSON.stringify({ research: egress.lineAllowed(p, 'research'), jev: egress.lineAllowed(p, 'judge_jev'), ignored: p.ignored });
  });
  await leg('E2b a bare boolean override works the same; an unknown line is ignored and named', function () {
    const room = mkRoom();
    writeOverride(room, { lines: { theo: false, mystery: true } });
    const p = egress.loadEgressPolicy(room);
    return (egress.lineAllowed(p, 'theo') === false && p.ignored.some(function (x) { return /mystery/.test(String(x)); })) || JSON.stringify(p.ignored);
  });

  // ----- E3 -----
  await leg('E3 offline returns every line off', function () {
    const p = egress.loadEgressPolicy(mkRoom(), { offline: true });
    return (p.offline === true && LINES.every(function (l) { return egress.lineAllowed(p, l) === false; })) || JSON.stringify(Object.keys(p.lines).map(function (l) { return l + ':' + egress.lineAllowed(p, l); }));
  });

  // ----- E4 -----
  await leg('E4 lineForProvider maps the vendors and is null for an unknown one', function () {
    const got = ['openalex', 'theo', 'typesafe', 'anthropic', 'huggingface'].map(egress.lineForProvider).join(',');
    return (got === 'research,theo,judge_jev,prose,vector_model_download' && egress.lineForProvider('bogus-vendor') === null && egress.lineForProvider(undefined) === null) || got;
  });
  await leg('E4b every provider string the planner can write maps to a non-null line', function () {
    const found = {};
    (function walk(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
        const f = path.join(dir, d.name);
        if (d.isDirectory()) { walk(f); return; }
        if (!/\.cjs$/.test(d.name) || d.name === 'egress-policy.cjs') return;
        const src = fs.readFileSync(f, 'utf8');
        let m;
        const a = /PROVIDER\s*=\s*'([^']+)'/g;
        while ((m = a.exec(src))) found[m[1]] = path.relative(RP, f);
        const b = /\bprovider:\s*'([^']+)'/g;
        while ((m = b.exec(src))) found[m[1]] = path.relative(RP, f);
      });
    })(RP);
    grants.STANDING_SCOPE.providers.forEach(function (p) { found[p] = 'grants.STANDING_SCOPE'; });
    found[grants.THEO_PROVIDER] = 'grants.THEO_PROVIDER';
    const missing = Object.keys(found).filter(function (p) { return egress.lineForProvider(p) === null; });
    return (Object.keys(found).length >= 2 && missing.length === 0) || 'no policy entry for provider(s): ' + missing.map(function (p) { return p + ' (' + found[p] + ')'; }).join(', ');
  });

  // ----- E5 -----
  await leg('E5 appendAudit refuses an off line with egress_line_off and writes nothing', function () {
    const room = mkRoom();
    writeOverride(room, { lines: { research: { default: false } } });
    const res = auditLedger.appendAudit(room, auditRecord('openalex'));
    const wrote = fs.existsSync(path.join(room, '.mindrian', 'research-audit.jsonl'));
    return (res.ok === false && res.reason === 'egress_line_off' && !wrote) || JSON.stringify({ res: res, wrote: wrote });
  });
  await leg('E5b an allowed line writes; an injected policy is honored; an unknown provider is refused', function () {
    const room = mkRoom();
    const ok = auditLedger.appendAudit(room, auditRecord('openalex'));
    const theo = auditLedger.appendAudit(room, auditRecord('theo'));
    const off = auditLedger.appendAudit(room, auditRecord('openalex'), { policy: egress.loadEgressPolicy(room, { offline: true }) });
    const unknown = auditLedger.appendAudit(room, auditRecord('bogus-vendor'));
    const rows = auditLedger.readAudit(room, {});
    return (ok.ok === true && theo.ok === true && off.ok === false && off.reason === 'egress_line_off' && unknown.ok === false && unknown.reason === 'egress_line_off' && rows.length === 2) ||
      JSON.stringify({ ok: ok, theo: theo, off: off, unknown: unknown, rows: rows.length });
  });
  await leg('E5c the closed key set is unchanged and a bad record still reports its own reason first', function () {
    const bad = auditRecord('openalex');
    delete bad.latency_ms;
    const res = auditLedger.appendAudit(mkRoom(), bad);
    return (auditLedger.AUDIT_KEYS.length === 23 && res.ok === false && res.reason === 'missing_key') || JSON.stringify(res);
  });

  // ----- E6 -----
  await leg('E6 a malformed override is ignored, named, and never throws', function () {
    const room = mkRoom();
    writeOverride(room, '{ not json');
    const p = egress.loadEgressPolicy(room);
    return (egress.lineAllowed(p, 'research') === true && p.ignored.some(function (x) { return /egress-policy\.json/.test(String(x)); })) || JSON.stringify(p.ignored);
  });
  await leg('E6b an override that is a symlink out of the room is ignored', function () {
    const room = mkRoom();
    const outside = path.join(root, 'outside-policy.json');
    fs.writeFileSync(outside, JSON.stringify({ lines: { research: { default: false } } }), 'utf8');
    fs.symlinkSync(outside, path.join(room, '.mindrian', 'egress-policy.json'));
    const p = egress.loadEgressPolicy(room);
    return (egress.lineAllowed(p, 'research') === true && p.ignored.length >= 1) || JSON.stringify({ research: egress.lineAllowed(p, 'research'), ignored: p.ignored });
  });
  await leg('E6c a room that does not exist or a non-string room still returns the plugin default', function () {
    const a = egress.loadEgressPolicy(path.join(root, 'no-such-room'));
    const b = egress.loadEgressPolicy(undefined);
    return (egress.lineAllowed(a, 'research') === true && egress.lineAllowed(b, 'research') === true) || 'default not returned';
  });

  C.check('zero network attempts', net.attempts() === 0, String(net.attempts()));
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})();
