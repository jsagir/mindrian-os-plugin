#!/usr/bin/env node
'use strict';
// Phase 399-05 (I-04, I-11, D-03): the ONE send path for a decision request.
// Dev-time only. No file under lib/ or hooks/ may name or require this script (test-399-advisor-fence FN2).
// Order is fixed and every step refuses, never strips:
//   1 validate the request (labels only)   2 check the decision_advisor egress line
//   3 resolve the endpoint                 4 read the key from the environment only
//   5 per chunk: render, re-validate the body, POST   6 parse and merge
// The key is read from the environment through opts.env (default process.env), is never printed,
// never put in an error, and never put in a body. This file reads no secrets file.
// Gemini REST path: lib/core/decision-advisor/providers/gemini.cjs PATH is null until the vendor
// documentation confirms it. With PATH null a send is refused off loopback (endpoint_unconfirmed);
// on loopback the base URL is used as given, so no path is ever invented.
// Jev: the hosted base is read from opts.base (CLI --base) only; there is no default host constant.
// A self-hosted Kev on loopback needs no key.
//
// CLI: node scripts/decision-advisor-transport.cjs --provider gemini|jev --request <file>
//        [--base <url>] [--model <jev model id>] [--dry-run] [--room <dir>]
// Exit codes: 0 ok, 2 bad usage or labels_only_refused, 4 egress_line_off,
//             5 no_key or endpoint_unconfirmed, 6 http_error or bad_response.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const labels = require(path.join(ROOT, 'lib/core/decision-advisor/labels-only.cjs'));
const adapter = require(path.join(ROOT, 'lib/core/decision-advisor/adapter.cjs'));
const egress = require(path.join(ROOT, 'lib/core/research-planner/egress-policy.cjs'));
const jevClient = require('./jev-devtime-client.cjs');

const LINE = 'decision_advisor';
const PROVIDER_IDS = Object.freeze({ gemini: 'gemini_decision', jev: 'jev_decision' });
const KEY_ENV = Object.freeze({ gemini: 'GEMINI_API_KEY', jev: 'TYPESAFE_API_KEY' });
const KEY_HEADER = 'x-goog-api-key'; // ASSUMED Google AI REST convention; unconfirmed from vendor documentation.
const REFUSALS = Object.freeze(['labels_only_refused', 'egress_line_off', 'no_key', 'endpoint_unconfirmed', 'http_error', 'bad_response']);
const TIMEOUT_MS = 120000;

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function refuse(reason, detail) {
  const out = { ok: false, reason };
  if (detail !== undefined) out.detail = detail;
  return out;
}

function parseBase(base) {
  if (typeof base !== 'string' || base.length === 0) return null;
  let u;
  try { u = new URL(base); } catch (_e) { return null; }
  const loopback = u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]' || u.hostname === '::1';
  if (loopback) {
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  } else if (u.protocol !== 'https:') {
    return null;
  }
  return { href: u.href.replace(/\/+$/, ''), loopback };
}

// One POST with the same 429/529 backoff as jev(). Used for Gemini and for keyless loopback Jev.
// Returns { status, json }. The key goes in a header only.
async function postWithBackoff(url, headers, body, o) {
  const sleepImpl = o.sleepImpl || _sleep;
  let attempt = 0;
  for (;;) {
    const doFetch = o.fetchImpl || globalThis.fetch;
    let r;
    try {
      r = await doFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(typeof o.timeoutMs === 'number' && o.timeoutMs > 0 ? o.timeoutMs : TIMEOUT_MS),
      });
    } catch (_e) {
      if (attempt++ < 3) { await sleepImpl(500 * 2 ** attempt); continue; }
      return { status: 0, json: null };
    }
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_e) { /* leave null */ }
    if ((r.status === 429 || r.status === 529) && attempt++ < 4) { await sleepImpl(400 * 2 ** attempt); continue; }
    return { status: r.status, json };
  }
}

// Returns the chunk bodies for a request, each re-validated as the exact render of its chunk.
// Refuses with labels_only_refused when anything fails. Never throws.
function buildChunks(req, providerKey, model) {
  const provider = adapter.PROVIDERS[providerKey];
  const cat = labels.buildLabelCatalog();
  const first = labels.validateNeutralRequest(req, cat);
  if (!first.ok) return refuse('labels_only_refused', first.reason + ' at ' + first.path);
  const chunks = adapter.chunkRequest(req, provider.MAX_QUESTIONS);
  const out = [];
  for (const chunk of chunks) {
    let rendered;
    let body;
    try {
      rendered = adapter.renderRequest(chunk, cat);
      body = provider.buildBody(rendered, { model });
    } catch (e) {
      return refuse('labels_only_refused', 'render failed');
    }
    const checked = labels.validateProviderBody(providerKey, body, chunk, cat);
    if (!checked.ok) return refuse('labels_only_refused', checked.reason + ' at ' + checked.path);
    out.push({ chunk, rendered, body });
  }
  return { ok: true, chunks: out };
}

// send(req, opts) -> { ok: true, answers, usage, provider, model, requests } | { ok: false, reason, detail? }
// opts: { provider: 'gemini' | 'jev', base, model, roomDir, offline, env, fetchImpl, sleepImpl, timeoutMs,
//         policy (test seam: an object shaped like loadEgressPolicy output; no CLI flag or env sets it) }
async function send(req, opts) {
  const o = opts || {};
  const providerKey = o.provider;
  if (providerKey !== 'gemini' && providerKey !== 'jev') return refuse('labels_only_refused', 'unknown provider');
  const provider = adapter.PROVIDERS[providerKey];

  // 1 validate, before the policy check
  const built = buildChunks(req, providerKey, o.model);
  if (!built.ok) return built;

  // 2 policy
  const policy = o.policy || egress.loadEgressPolicy(o.roomDir || '', { offline: o.offline === true });
  if (!egress.lineAllowed(policy, LINE)) return refuse('egress_line_off');

  // 3 endpoint
  const base = parseBase(o.base);
  let url;
  if (providerKey === 'gemini') {
    if (provider.PATH === null) {
      if (!base || !base.loopback) return refuse('endpoint_unconfirmed');
      url = base.href;
    } else {
      if (!base) return refuse('endpoint_unconfirmed');
      url = base.href + provider.PATH;
    }
  } else {
    if (!base) return refuse('endpoint_unconfirmed');
    url = base.href + provider.PATH;
  }

  // 4 key, environment only
  const env = o.env || process.env;
  const keyValue = env[KEY_ENV[providerKey]];
  const key = typeof keyValue === 'string' && keyValue.length > 0 ? keyValue : null;
  const keyless = providerKey === 'jev' && base.loopback;
  if (!key && !keyless) return refuse('no_key');

  // 5 send each chunk
  const answers = {};
  const usage = { input_tokens: 0, output_tokens: 0 };
  let requests = 0;
  let model = null;
  for (const item of built.chunks) {
    // Re-validate right before the POST: the body must still be the render of its chunk.
    const guard = (body) => {
      const again = labels.validateProviderBody(providerKey, body, item.chunk);
      if (!again.ok) {
        const err = new Error('decision-advisor-transport: body refused: ' + again.reason);
        err.code = 'EGRESS_REFUSED';
        throw err;
      }
      return true;
    };
    try { guard(item.body); } catch (_e) { return refuse('labels_only_refused', 'body_not_render_of_validated_request'); }
    let res;
    requests += 1;
    if (providerKey === 'jev' && key) {
      res = await jevClient.jev(item.body, {
        guard,
        endpoint: url,
        key,
        fetchImpl: o.fetchImpl,
        sleepImpl: o.sleepImpl,
        timeoutMs: typeof o.timeoutMs === 'number' ? o.timeoutMs : TIMEOUT_MS,
      });
    } else {
      const headers = { 'Content-Type': 'application/json' };
      if (providerKey === 'gemini') headers[KEY_HEADER] = key;
      res = await postWithBackoff(url, headers, item.body, o);
    }
    if (!res || res.status !== 200) return refuse('http_error', 'status ' + (res ? res.status : 0));
    if (!res.json || typeof res.json !== 'object') return refuse('bad_response');
    // 6 parse and merge
    const parsed = provider.parseResponse(res.json, item.rendered.questions);
    Object.assign(answers, parsed.answers);
    usage.input_tokens += parsed.usage.input_tokens;
    usage.output_tokens += parsed.usage.output_tokens;
    model = item.body.model;
  }
  return { ok: true, answers, usage, provider: providerKey, model, requests };
}

// dryRun(req, opts) -> { ok: true, bodies } | { ok: false, reason, detail }. No policy check, no network, no key read.
function dryRun(req, opts) {
  const o = opts || {};
  if (o.provider !== 'gemini' && o.provider !== 'jev') return refuse('labels_only_refused', 'unknown provider');
  const built = buildChunks(req, o.provider, o.model);
  if (!built.ok) return built;
  return { ok: true, bodies: built.chunks.map((c) => c.body) };
}

const EXIT = { labels_only_refused: 2, egress_line_off: 4, no_key: 5, endpoint_unconfirmed: 5, http_error: 6, bad_response: 6 };

function parseArgs(argv) {
  const a = { provider: null, request: null, base: null, model: null, dryRun: false, room: null, error: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    switch (flag) {
      case '--provider': a.provider = argv[++i] || null; break;
      case '--request': a.request = argv[++i] || null; break;
      case '--base': a.base = argv[++i] || null; break;
      case '--model': a.model = argv[++i] || null; break;
      case '--room': a.room = argv[++i] || null; break;
      case '--dry-run': a.dryRun = true; break;
      default: a.error = 'unknown flag ' + flag;
    }
  }
  if (!a.error && a.provider !== 'gemini' && a.provider !== 'jev') a.error = 'provider must be gemini or jev';
  if (!a.error && !a.request) a.error = 'missing --request';
  return a;
}

async function main(argv) {
  const a = parseArgs(argv);
  if (a.error) {
    process.stderr.write('usage error: ' + a.error + '\n');
    return 2;
  }
  let req;
  try { req = JSON.parse(fs.readFileSync(a.request, 'utf8')); } catch (_e) {
    process.stderr.write('usage error: request file is not readable JSON\n');
    return 2;
  }
  if (a.dryRun) {
    const d = dryRun(req, { provider: a.provider, model: a.model });
    if (!d.ok) {
      process.stderr.write(d.reason + ': ' + d.detail + '\n');
      return EXIT[d.reason] || 2;
    }
    process.stdout.write(JSON.stringify(d.bodies.length === 1 ? d.bodies[0] : d.bodies, null, 2) + '\n');
    return 0;
  }
  const r = await send(req, { provider: a.provider, base: a.base, model: a.model, roomDir: a.room || '' });
  if (!r.ok) {
    process.stderr.write(r.reason + (r.detail ? ': ' + r.detail : '') + '\n');
    return EXIT[r.reason] || 6;
  }
  process.stdout.write(JSON.stringify({ provider: r.provider, model: r.model, requests: r.requests, usage: r.usage, answers: r.answers }, null, 2) + '\n');
  return 0;
}

module.exports = { send, dryRun, LINE, PROVIDER_IDS, REFUSALS };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, () => {
    process.stderr.write('transport failed\n');
    process.exitCode = 6;
  });
}
