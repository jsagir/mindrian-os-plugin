'use strict';
// Phase 400 plan 13 (RL-04; O-08): the socket layer and process entry of the decision relay.
// Plain node:http, no framework, no npm dependency, no platform lock (Render runs it; any Node host can).
//
// Two routes only:
//   GET  /health     -> 200 {"status":"ok"}. Liveness only: no catalog hash, no counts, no version (Theo posture).
//   POST /v1/decide  -> the plan-12 pipeline, createRelay(deps).handleDecide({headers, bodyText, bytes, address}).
// Every other path is 404 and every other method is 405 with Allow. The server never sends a 3xx and never
// rewrites a path (no trailing-slash or case redirect).
//
// Bounds: the body is capped WHILE it is read (a declared length over the cap is refused before any byte is
// read; a chunked body is stopped by a running count), the header and request timeouts are set, and the
// connection closes after a refusal so an unread body is not kept.
// The client address comes from the socket, or from X-Forwarded-For through a FIXED hop count
// (RELAY_PROXY_HOPS), the Theo clientAddressOf pattern. The relay hashes it; this file never logs it.
// Logs hold counts, durations and reasons only. CJS, node built-ins only. Hyphens only.

const http = require('node:http');
const net = require('node:net');
const { createRelay, ROUTE } = require('./relay.cjs');
const { loadConfig } = require('./config.cjs');
const { verifyCaller } = require('./verify-caller.cjs');

const HEALTH_PATH = '/health';
const HEALTH_BODY = '{"status":"ok"}';
const SERVER_REASONS = Object.freeze(['not_found', 'method_not_allowed', 'not_json', 'internal']);
const HEADERS_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MARGIN_MS = 5000;
const DEFAULT_PORT = 10000;
const DEFAULT_HOST = '0.0.0.0';

function defaultLog(record) {
  try { process.stdout.write(JSON.stringify(record) + '\n'); } catch (_e) { /* a log line must never break a reply */ }
}

// The caller address. hops 0: the socket peer. hops N > 0: the Nth entry from the RIGHT of X-Forwarded-For,
// because each trusted proxy appends one entry and a caller can only write entries on the left.
// Too low a count makes every caller the proxy (one shared bucket); too high lets a caller mint buckets.
// A header shorter than the hop count falls back to the peer, never to whatever entry is there.
// Review IN-08: a candidate that is not an IP literal (net.isIP) also falls back to the peer.
function clientAddressOf(req, hops) {
  const peer = (req && req.socket && typeof req.socket.remoteAddress === 'string') ? req.socket.remoteAddress : 'unknown';
  const n = Number.isSafeInteger(hops) && hops > 0 ? hops : 0;
  if (n === 0) return peer;
  let raw = req && req.headers ? req.headers['x-forwarded-for'] : undefined;
  if (Array.isArray(raw)) raw = raw.join(',');
  if (typeof raw !== 'string') return peer;
  const entries = raw.split(',').map((e) => e.trim()).filter((e) => e.length > 0);
  const candidate = entries[entries.length - n];
  return typeof candidate === 'string' && candidate.length <= 64 && net.isIP(candidate) !== 0 ? candidate : peer;
}

// Review IN-08: the number of X-Forwarded-For entries, a count only (never an address). The owner reads it
// from the first xff_shape log line after a deploy and sets RELAY_PROXY_HOPS from it; nothing here guesses it.
function forwardedCountOf(req) {
  let raw = req && req.headers ? req.headers['x-forwarded-for'] : undefined;
  if (Array.isArray(raw)) raw = raw.join(',');
  if (typeof raw !== 'string') return 0;
  return raw.split(',').filter((e) => e.trim().length > 0).length;
}

function pathOf(url) {
  const raw = typeof url === 'string' ? url : '';
  const q = raw.indexOf('?');
  return q === -1 ? raw : raw.slice(0, q);
}

function isJsonType(value) {
  if (typeof value !== 'string') return false;
  return value.split(';')[0].trim().toLowerCase() === 'application/json';
}

function createServer(deps) {
  const d = deps || {};
  const env = d.env || process.env;
  const cfg = d.cfg || loadConfig(env);
  const log = typeof d.log === 'function' ? d.log : defaultLog;
  const now = typeof d.now === 'function' ? d.now : Date.now;
  // deps.relay is the test seam; otherwise the real pipeline with the same deps.
  const relay = d.relay || createRelay(Object.assign({}, d, { env, cfg, log }));
  // Review IN-08: one xff_shape line per process, on the first POST /v1/decide (counts only).
  let xffLogged = false;

  // A reply this file writes itself. `close` ends the connection after the reply (an unread body is not kept).
  function send(res, status, body, extraHeaders, closeAfter) {
    if (res.headersSent || res.writableEnded) return;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = Object.assign({
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-length': String(Buffer.byteLength(text, 'utf8')),
    }, extraHeaders || {});
    if (closeAfter) headers.connection = 'close';
    res.writeHead(status, headers);
    res.end(text);
  }

  function refuse(res, t0, route, status, reason, extraHeaders, closeAfter) {
    log({ t: new Date(now()).toISOString(), route, status, reason, ms: Math.max(0, now() - t0) });
    send(res, status, { ok: false, reason }, extraHeaders, closeAfter);
  }

  // Read the body with a running byte count. Resolves {ok, text, bytes} or {ok: false} when the cap is passed.
  function readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      let bytes = 0;
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      req.on('data', (c) => {
        if (settled) return;
        bytes += c.length;
        if (bytes > cfg.maxBodyBytes) {
          chunks.length = 0;
          req.pause();
          done({ ok: false, over: true });
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => done({ ok: true, text: Buffer.concat(chunks).toString('utf8'), bytes }));
      req.on('error', () => done({ ok: false, over: false }));
      req.on('aborted', () => done({ ok: false, over: false }));
    });
  }

  async function onDecide(req, res, t0) {
    if (!xffLogged) {
      xffLogged = true;
      log({ t: new Date(now()).toISOString(), event: 'xff_shape', xff_entries: forwardedCountOf(req), proxy_hops: cfg.proxyHops });
    }
    if (!isJsonType(req.headers['content-type'])) { refuse(res, t0, ROUTE, 415, 'not_json', null, true); return; }
    const address = clientAddressOf(req, cfg.proxyHops);
    // A caller the relay will refuse is refused before any body byte is read. The relay itself writes the
    // refusal (one reason list, one log line); the empty body is never parsed because step 1 stops first.
    if (!verifyCaller(req.headers, cfg).ok) {
      const r = await relay.handleDecide({ headers: req.headers, bodyText: '', bytes: 0, address });
      send(res, r.status, r.body, r.headers, true);
      return;
    }
    const declared = req.headers['content-length'];
    if (typeof declared === 'string' && /^[0-9]{1,15}$/.test(declared) && Number(declared) > cfg.maxBodyBytes) {
      refuse(res, t0, ROUTE, 413, 'too_large', null, true);
      return;
    }
    const b = await readBody(req);
    if (!b.ok) {
      if (b.over) refuse(res, t0, ROUTE, 413, 'too_large', null, true);
      else if (!res.destroyed) res.destroy();
      return;
    }
    const r = await relay.handleDecide({ headers: req.headers, bodyText: b.text, bytes: b.bytes, address });
    send(res, r.status, r.body, r.headers, false);
  }

  async function handler(req, res) {
    const t0 = now();
    const p = pathOf(req.url);
    try {
      if (p === HEALTH_PATH) {
        if (req.method === 'GET' || req.method === 'HEAD') {
          if (req.method === 'HEAD') {
            res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'content-length': String(HEALTH_BODY.length) });
            res.end();
          } else {
            send(res, 200, HEALTH_BODY, null, false);
          }
          return;
        }
        refuse(res, t0, HEALTH_PATH, 405, 'method_not_allowed', { allow: 'GET, HEAD' }, true);
        return;
      }
      if (p === ROUTE) {
        if (req.method !== 'POST') { refuse(res, t0, ROUTE, 405, 'method_not_allowed', { allow: 'POST' }, true); return; }
        await onDecide(req, res, t0);
        return;
      }
      refuse(res, t0, null, 404, 'not_found', null, true);
    } catch (_e) {
      // Fail closed with a fixed body. No error text or stack leaves the process.
      refuse(res, t0, p === ROUTE ? ROUTE : null, 500, 'internal', null, true);
    }
  }

  // Node refuses a headersTimeout above requestTimeout, so a small upstream timeout lowers the header bound too.
  const requestTimeout = cfg.upstreamTimeoutMs + REQUEST_TIMEOUT_MARGIN_MS;
  const server = http.createServer({
    headersTimeout: Math.min(HEADERS_TIMEOUT_MS, requestTimeout),
    requestTimeout,
  }, (req, res) => { handler(req, res); });
  // A refusal with `connection: close` ends the socket once the reply is flushed, even with unread body bytes.
  server.on('request', (req, res) => {
    res.on('finish', () => {
      if (res.getHeader('connection') === 'close' && req.socket && !req.socket.destroyed) req.socket.destroySoon();
    });
  });
  return server;
}

function portOf(raw) {
  if (typeof raw === 'string' && /^[0-9]{1,5}$/.test(raw)) {
    const n = Number(raw);
    if (n >= 0 && n <= 65535) return n;
  }
  return DEFAULT_PORT;
}

function hostOf(raw) {
  return typeof raw === 'string' && /^[0-9a-fA-F:.]{2,45}$/.test(raw) ? raw : DEFAULT_HOST;
}

function main() {
  const env = process.env;
  const cfg = loadConfig(env);
  const server = createServer({ env, cfg, log: defaultLog });
  const host = hostOf(env.RELAY_HOST);
  server.listen(portOf(env.PORT), host, () => {
    // Counts and booleans only: never the key, a hash or a token.
    defaultLog({
      t: new Date().toISOString(),
      event: 'start',
      port: server.address().port,
      user_traffic: cfg.userTraffic === true,
      operator_hashes: cfg.operatorHashes.length,
      has_key: cfg.hasKey === true,
    });
  });
  const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 10000).unref(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

if (require.main === module) main();

module.exports = { createServer, clientAddressOf, forwardedCountOf, SERVER_REASONS, HEALTH_PATH };
