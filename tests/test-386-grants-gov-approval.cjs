#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 23 (E-GG): the funding search path (lib/core/opportunity-ops.cjs
 * scanOpportunities) sits behind the shared web path gate.
 * Debug session: grants-gov-scan-sends-room-words-without-approval.
 *
 * Owner decision 2026-11-06 (card answer "Extend the ruling"): approval first
 * (the exact strings), then a credential check, plus an audit record. No
 * content scan runs on this line. The unattended scheduled scan stops until an
 * approval exists.
 *
 * Arms:
 *   GG1 no approval: 0 requests, approval_required with strings and a token
 *   GG2 the matching token sends exactly 2 requests, keyword equals a listed string
 *   GG3 a wrong token: 0 requests, approval_required
 *   GG4 a credential-shaped keyword is refused before any request, even with a matching token
 *   GG5 a keyword with a person name, a city and a company name is sent after approval
 *   GG6 the scheduled scan sends nothing, records a typed skip approval_required, does not throw
 *   GG7 an approved scan leaves 2 audit records, provider grants_gov, q equal to each request string
 *   GG8 the approval step in agents/opportunity-scanner.md exists and has no word grant
 *
 * The network is a counter. Synthetic words only. Fake credentials are built
 * at run time. No em dash or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-gg-'));
process.env.HOME = path.join(TMP, 'home');
process.env.USERPROFILE = process.env.HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms-home');
fs.mkdirSync(process.env.HOME, { recursive: true });
delete process.env.OPENALEX_API_KEY;
delete process.env.TAVILY_API_KEY;
delete process.env.PATENTSVIEW_API_KEY;

let calls = [];
globalThis.fetch = async function counted(url, init) {
  let body = {};
  try { body = JSON.parse(init && init.body ? init.body : '{}'); } catch (_e) { body = {}; }
  calls.push({ url: String(url), q: typeof body.keyword === 'string' ? body.keyword : (typeof body.query === 'string' ? body.query : null) });
  return { ok: false, status: 500, json: async function () { return {}; } };
};

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }

let roomSeq = 0;
function mkRoom(keywords) {
  roomSeq += 1;
  const dir = path.join(TMP, 'room-' + roomSeq);
  fs.mkdirSync(path.join(dir, 'problem-definition'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.md'), '---\ndomain_keywords:\n' + keywords.map(function (k) { return '  - ' + k; }).join('\n') + '\ngeography: Israel\nventure_stage: seed\n---\n');
  fs.writeFileSync(path.join(dir, 'problem-definition', 'p.md'), 'Warehouses lose picking accuracy during overnight shifts. More synthetic text follows here for length.\n');
  return dir;
}

let ops = null;
let loadError = null;
try { ops = require(path.join(ROOT, 'lib', 'core', 'opportunity-ops.cjs')); } catch (e) { loadError = e.message; }

async function arm(label, fn) {
  if (loadError) { fail(label, 'module did not load: ' + loadError); return; }
  try {
    const problems = await fn();
    if (problems.length === 0) ok(label); else fail(label, problems.join('; '));
  } catch (e) {
    fail(label, 'threw ' + (e && e.message ? e.message : String(e)));
  }
}

async function scan(room, approval) {
  calls = [];
  const res = await ops.scanOpportunities(room, approval === undefined ? undefined : { approval: approval });
  return { res: res, calls: calls.slice() };
}

(async function main() {
  const ORDINARY = ['robotics', 'logistics'];

  await arm('GG1', async function () {
    const room = mkRoom(ORDINARY);
    const r = await scan(room);
    const p = [];
    if (r.calls.length !== 0) p.push(r.calls.length + ' requests without approval');
    const a = r.res.approval_required;
    if (!a || !Array.isArray(a.strings) || a.strings.length === 0) p.push('no strings in approval_required');
    if (!a || typeof a.token !== 'string' || a.token.length < 16) p.push('no token in approval_required');
    return p;
  });

  await arm('GG2', async function () {
    const room = mkRoom(ORDINARY);
    const first = await scan(room);
    const a = first.res.approval_required;
    if (!a) return ['no token to approve with'];
    const r = await scan(room, a.token);
    const p = [];
    if (r.calls.length !== 2) p.push(r.calls.length + ' requests after approval, expected 2');
    r.calls.forEach(function (c) { if (a.strings.indexOf(c.q) === -1) p.push('a request string is not in the list'); });
    const hosts = r.calls.map(function (c) { return new URL(c.url).hostname; }).sort().join(',');
    if (hosts !== 'api.grants.gov,api.simpler.grants.gov') p.push('hosts: ' + hosts);
    return p;
  });

  await arm('GG3', async function () {
    const room = mkRoom(ORDINARY);
    const r = await scan(room, 'not-the-token');
    const p = [];
    if (r.calls.length !== 0) p.push(r.calls.length + ' requests with a wrong token');
    if (!r.res.approval_required) p.push('no approval_required for a wrong token');
    return p;
  });

  await arm('GG4', async function () {
    const fakeKey = ['api_', 'key=', 'abcd1234efgh5678'].join('');
    const room = mkRoom(['robotics', fakeKey]);
    const gate = require(path.join(ROOT, 'lib', 'core', 'web-path-gate.cjs'));
    const first = await scan(room);
    const tokens = [];
    if (first.res.approval_required) tokens.push(first.res.approval_required.token);
    const q = ops.buildGrantQuery(room).keyword;
    tokens.push(gate.approvalToken([q, q.slice(0, 100)]));
    const p = [];
    for (const t of tokens) {
      const r = await scan(room, t);
      if (r.calls.length !== 0) p.push(r.calls.length + ' requests with a credential-shaped keyword');
      if (JSON.stringify(r.res).indexOf('abcd1234efgh5678') !== -1) p.push('the result echoes the credential bytes');
    }
    if (first.calls.length !== 0) p.push('the listing step sent a request');
    return p;
  });

  await arm('GG5', async function () {
    const room = mkRoom(['Ilvane Trosk', 'Lisbon', 'Quorvex Robotics']);
    const first = await scan(room);
    const a = first.res.approval_required;
    if (!a) return ['no token to approve with'];
    const r = await scan(room, a.token);
    const p = [];
    if (r.calls.length !== 2) p.push(r.calls.length + ' requests after approval');
    const joined = r.calls.map(function (c) { return c.q; }).join(' ');
    if (joined.indexOf('Ilvane') === -1 || joined.indexOf('Lisbon') === -1 || joined.indexOf('Quorvex') === -1) p.push('a name, a city or a company word was held back');
    return p;
  });

  await arm('GG6', async function () {
    const room = mkRoom(ORDINARY);
    const scheduled = require(path.join(ROOT, 'lib', 'core', 'scheduled-scanner.cjs'));
    calls = [];
    const res = await scheduled.scanAndFileGrants(room);
    const p = [];
    if (calls.length !== 0) p.push(calls.length + ' requests from the scheduled scan');
    if (!res || res.skipped !== true) p.push('no skip recorded');
    if (!res || res.reason !== 'approval_required') p.push('reason is ' + (res && res.reason));
    return p;
  });

  await arm('GG7', async function () {
    const room = mkRoom(ORDINARY);
    const first = await scan(room);
    const a = first.res.approval_required;
    if (!a) return ['no token to approve with'];
    const r = await scan(room, a.token);
    const recs = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs')).readAudit(room);
    const gg = recs.filter(function (x) { return x.provider === 'grants_gov'; });
    const p = [];
    if (gg.length !== 2) p.push(gg.length + ' records, expected 2');
    const sent = r.calls.map(function (c) { return c.q; }).sort().join('|');
    const logged = gg.map(function (x) { return x.q; }).sort().join('|');
    if (sent !== logged) p.push('the logged strings differ from the sent strings');
    return p;
  });

  await arm('GG8', async function () {
    const md = fs.readFileSync(path.join(ROOT, 'agents', 'opportunity-scanner.md'), 'utf8');
    const a = md.indexOf('<!-- approval-step-begin -->');
    const b = md.indexOf('<!-- approval-step-end -->');
    const p = [];
    if (a === -1 || b === -1 || b < a) return ['markers are absent'];
    const block = md.slice(a, b);
    if (block.length < 80) p.push('the approval step is empty');
    if (/grants?\b/i.test(block)) p.push('the word grant appears between the markers');
    if (!/approval/i.test(block)) p.push('the step does not name approval');
    return p;
  });

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(failures === 0 ? 0 : 1);
})();
