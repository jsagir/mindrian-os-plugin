'use strict';
// Phase 400 plan 12 (RL-01, RL-03; O-07, O-09): the decision relay request pipeline, pure and testable
// without a socket. Plan 400-13 adds the socket layer; this file opens no listener.
//
// handleDecide runs one fixed order. Every step refuses; no step strips a field to make a request pass.
//   1 caller check (verify-caller.cjs), before the body is read
//   2 upstream key present (environment only)
//   3 size cap   4 JSON parse   5 catalog fingerprint match (Pitfall 12)
//   6 the shared labels-only validator   7 question cap   8 in-flight bound, then caps (limits.cjs)
//   9 server-side render and body re-check   10 one upstream POST (no retry, no redirect, a timeout)
//
// The shared modules are required by relative path from the repo root, never copied (one source of truth).
// The key goes in one header and is never logged or returned. Logs hold counts, durations and reasons only.
// CJS, node built-ins only. Hyphens only.

const labels = require('../../lib/core/decision-advisor/labels-only.cjs');
const adapter = require('../../lib/core/decision-advisor/adapter.cjs');
const { loadConfig, KEY_ENV } = require('./config.cjs');
const { verifyCaller, headerValue } = require('./verify-caller.cjs');
const { createLimits } = require('./limits.cjs');

// The Google AI host. Pinned here; no environment name sets it. deps.upstreamOrigin is the test seam.
const UPSTREAM_ORIGIN = 'https://generativelanguage.googleapis.com';
const UPSTREAM_KEY_HEADER = 'x-goog-api-key';
const CATALOG_HEADER = 'x-mindrian-catalog';
const ROUTE = '/v1/decide';
// Review IN-03: the most upstream reply bytes the relay reads. A larger reply is upstream_error, not buffered.
const UPSTREAM_MAX_REPLY_BYTES = 4194304;

const REASONS = Object.freeze([
  'no_caller', 'bad_install_id', 'bad_token', 'user_traffic_off', 'no_upstream_key', 'too_large', 'not_json', 'catalog_skew',
  'labels_only_refused', 'too_many_questions', 'install_rate', 'install_daily_cap', 'address_daily_cap', 'global_daily_requests',
  'global_daily_questions', 'global_token_cap', 'operator_daily_cap', 'bucket_table_full', 'body_check_failed', 'upstream_error',
  'upstream_unreachable', 'upstream_timeout', 'operator_rate', 'operator_token_cap', 'relay_busy',
  'address_rate', 'address_daily_requests',
]);

function defaultLog(record) {
  try { process.stdout.write(JSON.stringify(record) + '\n'); } catch (_e) { /* a log line must never break a reply */ }
}

// Review IN-03: read a fetch Response body with a byte cap. Resolves the text, or null when the body is larger
// than maxBytes (the rest is not read). A body with no stream reader falls back to text() and a length check.
async function readCapped(r, maxBytes) {
  const declared = r && r.headers && typeof r.headers.get === 'function' ? r.headers.get('content-length') : null;
  if (typeof declared === 'string' && /^[0-9]{1,15}$/.test(declared) && Number(declared) > maxBytes) {
    try { if (r.body && typeof r.body.cancel === 'function') await r.body.cancel(); } catch (_e) { /* nothing to free */ }
    return null;
  }
  if (!r.body || typeof r.body.getReader !== 'function') {
    const t = await r.text();
    return Buffer.byteLength(t, 'utf8') > maxBytes ? null : t;
  }
  const reader = r.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch (_e) { /* nothing to free */ }
      return null;
    }
    parts.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
  }
  return Buffer.concat(parts).toString('utf8');
}

function isTimeout(e) {
  const name = e && e.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

function createRelay(deps) {
  const d = deps || {};
  const env = d.env || process.env;
  const cfg = d.cfg || loadConfig(env);
  const now = typeof d.now === 'function' ? d.now : Date.now;
  const limits = d.limits || createLimits(cfg, now);
  const fetchImpl = typeof d.fetchImpl === 'function' ? d.fetchImpl : (url, init) => globalThis.fetch(url, init);
  const log = typeof d.log === 'function' ? d.log : defaultLog;
  const origin = typeof d.upstreamOrigin === 'string' && d.upstreamOrigin.length > 0 ? d.upstreamOrigin : UPSTREAM_ORIGIN;
  const gemini = adapter.PROVIDERS.gemini;
  const upstreamUrl = origin + gemini.PATH;
  // One request is one POST: the provider limit binds even when the config allows more.
  const maxQuestions = Math.min(cfg.maxQuestions, gemini.MAX_QUESTIONS);
  // WR-02: the most upstream calls open at one time, for every caller kind. A call over the bound is
  // refused before the caps count it, so a refused call costs no budget.
  const maxInFlight = Number.isSafeInteger(cfg.maxInFlight) && cfg.maxInFlight > 0 ? cfg.maxInFlight : 4;
  let inFlight = 0;

  function finish(t0, rec, status, body, extraHeaders) {
    // Review IN-01: the catalog hash goes only to a caller that passed step 1 (rec.kind is set), never to an
    // unauthenticated refusal, the same posture as /health.
    const base = { 'content-type': 'application/json', 'cache-control': 'no-store' };
    if (rec.kind !== null) base[CATALOG_HEADER] = labels.catalogFingerprint();
    const headers = Object.assign(base, extraHeaders || {});
    const t1 = now();
    log({
      t: new Date(t1).toISOString(),
      route: ROUTE,
      status,
      reason: body.ok === true ? null : body.reason,
      kind: rec.kind,
      questions: rec.questions,
      ms: Math.max(0, t1 - t0),
      upstream_ms: rec.upstream_ms,
      input_tokens: rec.input_tokens,
    });
    return { status, headers, body };
  }

  function refuse(t0, rec, status, reason, extra, extraHeaders) {
    return finish(t0, rec, status, Object.assign({ ok: false, reason }, extra || {}), extraHeaders);
  }

  async function handleDecide(input) {
    const t0 = now();
    const rec = { kind: null, questions: null, upstream_ms: null, input_tokens: null };
    const inp = input || {};
    try {
      // 1 caller, before the body is read
      const caller = verifyCaller(inp.headers, cfg);
      if (!caller.ok) return refuse(t0, rec, caller.status, caller.reason);
      rec.kind = caller.kind;

      // 2 key, environment only
      const keyValue = env[KEY_ENV];
      if (typeof keyValue !== 'string' || keyValue.length === 0) return refuse(t0, rec, 503, 'no_upstream_key');

      // 3 size cap: the larger of the caller-sent count and the measured text
      let text = inp.bodyText;
      if (Buffer.isBuffer(text)) text = text.toString('utf8');
      const measured = typeof text === 'string' ? Buffer.byteLength(text, 'utf8') : 0;
      const declared = Number.isFinite(inp.bytes) ? inp.bytes : 0;
      if (Math.max(measured, declared) > cfg.maxBodyBytes) return refuse(t0, rec, 413, 'too_large');

      // 4 JSON parse
      if (typeof text !== 'string') return refuse(t0, rec, 400, 'not_json');
      let req;
      try { req = JSON.parse(text); } catch (_e) { return refuse(t0, rec, 400, 'not_json'); }

      // 5 catalog fingerprint (Pitfall 12): the client and the relay must share one catalog
      const fp = labels.catalogFingerprint();
      if (headerValue(inp.headers, CATALOG_HEADER) !== fp) return refuse(t0, rec, 409, 'catalog_skew', { relay_catalog: fp });

      // 6 the shared labels-only validator; the reason only, never the refused path or value
      const v = labels.validateNeutralRequest(req);
      if (!v.ok) return refuse(t0, rec, 422, 'labels_only_refused', { detail: v.reason });

      // 7 question cap
      const n = Object.keys(req.questions).length;
      rec.questions = n;
      if (n > maxQuestions) return refuse(t0, rec, 413, 'too_many_questions');

      // 8 caps. The in-flight bound is checked first and counts nothing. From here to the POST the code
      // is synchronous, so the check and the increment below cannot interleave with another request.
      if (inFlight >= maxInFlight) return refuse(t0, rec, 503, 'relay_busy', null, { 'retry-after': '1' });
      const cap = limits.take(caller, n, inp.address);
      if (!cap.ok) return refuse(t0, rec, cap.status || 429, cap.reason, null, { 'retry-after': String(cap.retryAfterS) });

      // 9 server-side render, pinned model, then the body re-check
      let rendered;
      let body;
      try {
        rendered = adapter.renderRequest(req);
        body = gemini.buildBody(rendered);
      } catch (_e) {
        return refuse(t0, rec, 500, 'body_check_failed');
      }
      const checked = labels.validateProviderBody('gemini', body, req);
      if (!checked.ok || body.model !== gemini.MODEL) return refuse(t0, rec, 500, 'body_check_failed');

      // 10 one POST. The key goes in one header. A redirect is an error. A timeout bounds the call.
      const u0 = now();
      let status;
      let replyText;
      inFlight += 1;
      try {
        const r = await fetchImpl(upstreamUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', [UPSTREAM_KEY_HEADER]: keyValue },
          body: JSON.stringify(body),
          redirect: 'error',
          signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
        });
        status = r.status;
        replyText = await readCapped(r, UPSTREAM_MAX_REPLY_BYTES);
      } catch (e) {
        rec.upstream_ms = Math.max(0, now() - u0);
        if (isTimeout(e)) return refuse(t0, rec, 504, 'upstream_timeout');
        return refuse(t0, rec, 502, 'upstream_unreachable');
      } finally {
        inFlight -= 1;
      }
      rec.upstream_ms = Math.max(0, now() - u0);
      // The upstream text is never passed through: it can echo request content or account details.
      if (status !== 200 || replyText === null) return refuse(t0, rec, 502, 'upstream_error', { upstream_status: status });
      let json;
      try { json = JSON.parse(replyText); } catch (_e) { return refuse(t0, rec, 502, 'upstream_error', { upstream_status: status }); }

      const parsed = gemini.parseResponse(json, rendered.questions);
      limits.recordUsage(caller, parsed.usage.input_tokens);
      rec.input_tokens = parsed.usage.input_tokens;
      return finish(t0, rec, 200, { ok: true, answers: parsed.answers, usage: parsed.usage, model: gemini.MODEL, catalog: fp });
    } catch (_e) {
      // Fail closed. No step above is expected to throw.
      return refuse(t0, rec, 500, 'body_check_failed');
    }
  }

  return { handleDecide };
}

module.exports = { createRelay, UPSTREAM_ORIGIN, CATALOG_HEADER, REASONS, ROUTE, UPSTREAM_MAX_REPLY_BYTES };
