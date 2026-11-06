#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 22 (E-GATE): the one shared gate for the 3 older web paths
 * (Semantic Scholar, grants.gov, research-speaker).
 * Debug session: web-paths-no-approval-or-audit-record.
 *
 * Owner decision 2026-11-06 (card answer "Extend the ruling"): the 2026-10-05
 * ruling (web research lines send the room's words as written; credential
 * check only; an approval card as the gate; the audit ledger as the record)
 * extends to the 3 older paths. Each path shows its exact strings on a card,
 * checks the approval, runs the credential check, sends, then records one line
 * per string. No content scan runs on these lines. This is not a Brain line.
 *
 * Part 7 reuse: this module extends the audit ledger (appendAudit), the one web
 * credential check (auditWebCredential) and qHash. It adds no store. The
 * approval token is a hash of the exact strings, so a changed string needs a
 * new approval. It works the same on the CLI, Desktop and Cowork, and from bash
 * through the CLI below (see the RCA, section Part 7 reuse decision, option c).
 *
 * Pure of network: no fetch, no http. No em dash or en dash in this file.
 *
 *   approvalToken(strings)          -> sha256 hex over the sorted, unique q hashes
 *   checkApproval(strings, token)   -> true only for the exact token
 *   credentialCheck(strings, surf)  -> { ok: true } | { ok:false, reason, index }
 *   recordSent(room, provider, strings, opts) -> { ok, written, reason? }
 *
 * CLI (strings one per line on stdin):
 *   token                                     prints the token, exit 0
 *   credential [--surface name]               exit 3 on a credential-shaped line
 *   record --room dir --provider p [--outcome o]   one audit record per line
 * Exit codes: 0 ok, 2 bad usage, 3 credential refused, 1 other failure.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');

const WEB_PATH_PROVIDERS = Object.freeze(['semantic_scholar', 'grants_gov', 'google_search']);
const TEMPLATE_ID = 'older-web-path';

function cleanStrings(strings) {
  return (Array.isArray(strings) ? strings : []).filter(function (s) { return typeof s === 'string'; });
}

function approvalToken(strings) {
  const { qHash } = require('./research-planner/families.cjs');
  const hashes = [];
  cleanStrings(strings).forEach(function (s) {
    const h = qHash(s);
    if (hashes.indexOf(h) === -1) hashes.push(h);
  });
  hashes.sort();
  return crypto.createHash('sha256').update(hashes.join('\n'), 'utf8').digest('hex');
}

function checkApproval(strings, token) {
  if (typeof token !== 'string' || token.length === 0) return false;
  const want = approvalToken(strings);
  const a = Buffer.from(want, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// credentialCheck: the one web credential audit on every string, nothing else.
// The result carries an index and a reason, never string bytes.
function credentialCheck(strings, surface) {
  const { auditWebCredential } = require('./rs-egress-prompts.cjs');
  const list = Array.isArray(strings) ? strings : [];
  for (let i = 0; i < list.length; i += 1) {
    if (typeof list[i] !== 'string') return { ok: false, reason: 'not_a_string', index: i };
    try {
      auditWebCredential(list[i], surface);
    } catch (_e) {
      return { ok: false, reason: 'credential_shaped', index: i };
    }
  }
  return { ok: true };
}

function makeRecord(provider, q, token, runId, outcome) {
  const { qHash } = require('./research-planner/families.cjs');
  return {
    ts: new Date().toISOString(),
    run_id: runId,
    grant_id: 'approval:' + String(token).slice(0, 12),
    grant_version: 1,
    q: q,
    q_hash: qHash(q),
    template_id: TEMPLATE_ID,
    family: TEMPLATE_ID,
    part8_verdict: 'not_applicable',
    provider: provider,
    filters: {},
    pagination: { per_page: null, page: 1 },
    fallback_used: false,
    origin_ref: null,
    result_ids: [],
    content_hashes: [],
    outcome: outcome,
    failure_class: null,
    count: null,
    cost_usd: null,
    remaining_usd: null,
    x_query: null,
    latency_ms: null,
  };
}

// recordSent: one audit record per string (the caller passes the exact string of
// each request). A key-shaped string is refused by the ledger and nothing is written.
function recordSent(roomDir, provider, strings, opts) {
  if (WEB_PATH_PROVIDERS.indexOf(provider) === -1) return { ok: false, written: 0, reason: 'unknown_provider' };
  if (typeof roomDir !== 'string' || roomDir.length === 0) return { ok: false, written: 0, reason: 'no_room' };
  const o = opts || {};
  const list = cleanStrings(strings);
  const token = typeof o.token === 'string' && o.token ? o.token : approvalToken(list);
  const runId = typeof o.runId === 'string' && o.runId ? o.runId : 'older-web-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  const outcome = typeof o.outcome === 'string' ? o.outcome : 'ok';
  const { appendAudit } = require('./research-planner/audit-ledger.cjs');
  let written = 0;
  for (let i = 0; i < list.length; i += 1) {
    const r = appendAudit(roomDir, makeRecord(provider, list[i], token, runId, outcome));
    if (!r.ok) return { ok: false, written: written, reason: r.reason };
    written += 1;
  }
  return { ok: true, written: written };
}

// ---- CLI -------------------------------------------------------------------
function readLines() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch (_e) { raw = ''; }
  return raw.split('\n').map(function (l) { return l.replace(/\r$/, ''); }).filter(function (l) { return l.length > 0; });
}

function flag(argv, name) {
  const i = argv.indexOf(name);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
}

function main(argv) {
  const cmd = argv[0];
  if (cmd === 'token') {
    process.stdout.write(approvalToken(readLines()) + '\n');
    return 0;
  }
  if (cmd === 'credential') {
    const r = credentialCheck(readLines(), flag(argv, '--surface') || 'web_path');
    if (r.ok) return 0;
    process.stderr.write('refused: ' + r.reason + ' at line ' + (r.index + 1) + '\n');
    return 3;
  }
  if (cmd === 'record') {
    const room = flag(argv, '--room');
    const provider = flag(argv, '--provider');
    if (!room || !provider) { process.stderr.write('usage: record --room dir --provider p [--outcome o]\n'); return 2; }
    const r = recordSent(room, provider, readLines(), { outcome: flag(argv, '--outcome') || 'ok' });
    if (r.ok) return 0;
    process.stderr.write('not recorded: ' + r.reason + ' (written ' + r.written + ')\n');
    return r.reason === 'key_shaped_value' ? 3 : (r.reason === 'unknown_provider' ? 2 : 1);
  }
  process.stderr.write('usage: web-path-gate.cjs token | credential [--surface name] | record --room dir --provider p [--outcome o]\n');
  return 2;
}

module.exports = {
  WEB_PATH_PROVIDERS,
  approvalToken,
  checkApproval,
  credentialCheck,
  recordSent,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
