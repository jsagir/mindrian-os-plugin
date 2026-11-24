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
// Gemini REST path: lib/core/decision-advisor/providers/gemini.cjs PATH (/v1beta/decisions, confirmed
// 2026-11-24 from the vendor API reference). The base host is never a constant here: pass it with --base.
// Both providers carry a confirmed PATH, so the URL is always base origin + base path prefix + PATH. A base
// with a query, a fragment or userinfo is refused (endpoint_unconfirmed), never trimmed or sent.
// Jev: the hosted base is read from opts.base (CLI --base) only; there is no default host constant.
// A self-hosted Kev on loopback needs no key.
//
// Phase 400-14 (RL-05, RL-03 client half; O-07, O-10): the owner's decision relay is a THIRD send mode,
// provider relay. It is gated by the same decision_advisor line by name (default false; a room can only turn
// a line off), so with the shipped policy a relay send makes zero network requests and returns egress_line_off.
// Relay order: 1 validate each chunk (labels only)  2 policy  3 endpoint (base origin + prefix + /v1/decide)
//   4 caller header: the stored install id (x-theo-install-id, read with peekInstallId, never minted here)
//   5 per chunk: re-validate, POST the NEUTRAL chunk (the relay renders server-side) with x-mindrian-catalog set
//     to catalogFingerprint(), redirect 'error', a timeout, no retry   6 check the reply and merge.
// A 409 with relay_catalog is catalog_skew; any other refusal is relay_refused with a reason from the relay's
// closed reason list, else 'status <n>'. The relay mode never reads GEMINI_API_KEY.
// The per-turn path makes no live call: no file under lib/ or hooks/ names the relay or this client
// (tests/test-400-relay-fence.cjs F1).
//
// Operator release run (O-10): the ONLY path that passes the line today. It needs BOTH the CLI flag
// --operator-release-run (no environment variable sets it) AND the operator token.
// Review WR-03: the token never comes from the environment or the command line, so it never enters the shell
// history. It comes from the file <MindrianOS home>/decision-relay-operator-token (a regular file, not a
// symlink, owned by this user, mode 0600 or narrower), or, when that file is absent and the terminal is
// interactive, from one prompt with no echo. Without the flag the file is never read and no prompt is shown.
// The token goes only to an allowlisted origin (OPERATOR_ORIGINS) or to loopback. Any other --base is refused
// endpoint_unconfirmed before the token is read, so a typo or a wrong pasted URL cannot leak it.
// With the flag the run:
//   - refuses endpoint_unconfirmed before the token is read when the --base origin is not allowlisted,
//   - refuses operator_token_missing before any network when the token is absent or its file is unsafe,
//   - passes the line through an in-memory one-run policy (the shipped policy file is never written),
//   - sends Authorization: Bearer <token> and no install id header,
//   - prints one line and the exact JSON body before each POST,
//   - writes one audit record to <MindrianOS home>/decision-relay-audit/<UTC stamp>-<8 hex>.json (0600 in a
//     0700 dir) before the first POST and again at the end, also on a refusal. The record holds counts, status
//     codes, reasons and body hashes; it never holds the token, a key or a body.
//
// Release run (owner-gated). Only the owner runs these steps, against the deployed relay, with the real token.
// No agent and no test runs step 2 against a non-loopback base. Before step 2, store the token once (the
// token is typed at a no-echo prompt, so it is not in the shell history):
//   ( umask 077; mkdir -p ~/.mindrian; read -rs T; printf '%s\n' "$T" > ~/.mindrian/decision-relay-operator-token )
// Or leave the file absent and type the token at the prompt of step 2. The three commands, in order:
//   1 node scripts/build-relay-release-requests.cjs --out-dir <dir>
//   2 node scripts/decision-advisor-transport.cjs --provider relay --operator-release-run
//       --request <dir>/<job>.json [--request ... for each job] --base https://mindrian-decision-relay.onrender.com --out <pairs.json>
//   3 node scripts/derive-decision-fixture.cjs --source <pairs.json> --out <fixture path>
// --out writes {pairs: [{job, command, p}]} from the serves_job_v1 answers; other templates are skipped and counted
// on stderr. --request repeats only with --provider relay; --out needs --provider relay.
// Review WR-10: with --out, each request that succeeds is saved at once to <out>.partial/<job>-<12 hex>.json (0600 in
// a 0700 dir; the answers, usage and the request sha256, never a token or a key). When a later request fails, the
// paid answers stay there; re-run the same command with --resume and each request whose saved request_sha256
// matches is read from its file and not sent again. --out is written when every request has an answer; then the
// .partial dir is removed.
//
// CLI: node scripts/decision-advisor-transport.cjs --provider gemini|jev|relay --request <file> [--request <file> ...]
//        [--base <url>] [--model <jev model id>] [--dry-run] [--room <dir>] [--operator-release-run] [--out <file> [--resume]]
// Exit codes: 0 ok, 2 bad usage or labels_only_refused, 4 egress_line_off,
//             5 no_key, endpoint_unconfirmed, no_install_id, operator_token_missing or audit_unwritable,
//             6 http_error, bad_response, catalog_skew or relay_refused.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const labels = require(path.join(ROOT, 'lib/core/decision-advisor/labels-only.cjs'));
const adapter = require(path.join(ROOT, 'lib/core/decision-advisor/adapter.cjs'));
const egress = require(path.join(ROOT, 'lib/core/research-planner/egress-policy.cjs'));
const installId = require(path.join(ROOT, 'lib/core/install-id.cjs'));
const jevClient = require('./jev-devtime-client.cjs');

const LINE = 'decision_advisor';
const PROVIDER_IDS = Object.freeze({ gemini: 'gemini_decision', jev: 'jev_decision', relay: 'decision_relay' });
const KEY_ENV = Object.freeze({ gemini: 'GEMINI_API_KEY', jev: 'TYPESAFE_API_KEY' });
const KEY_HEADER = 'x-goog-api-key'; // confirmed 2026-11-24 from the vendor API reference.
const REFUSALS = Object.freeze(['labels_only_refused', 'egress_line_off', 'no_key', 'endpoint_unconfirmed', 'http_error', 'bad_response',
  'no_install_id', 'catalog_skew', 'relay_refused', 'operator_token_missing', 'audit_unwritable']);
const TIMEOUT_MS = 120000;
const RELAY_PATH = '/v1/decide';
const RELAY_MAX_QUESTIONS = 1000;
const RELAY_CATALOG_HEADER = 'x-mindrian-catalog';
const HEX64_RE = /^[a-f0-9]{64}$/;
// Review WR-03: the token file name under the MindrianOS home, and the only non-loopback origins that may
// receive the token. Loopback (a local relay, the tests) is always allowed. No env name extends this list.
const OPERATOR_TOKEN_FILE = 'decision-relay-operator-token';
const OPERATOR_ORIGINS = Object.freeze(['https://mindrian-decision-relay.onrender.com']);
const OPERATOR_TOKEN_FILE_MAX_BYTES = 1024;
// The relay accepts the same shape (services/decision-relay/verify-caller.cjs BEARER_RE).
const OPERATOR_TOKEN_RE = /^[\x21-\x7e]{1,512}$/;
const AUDIT_DIR = 'decision-relay-audit';
const AUDIT_SCHEMA = 'mos.decision-relay-audit/1';
// A copy of services/decision-relay/relay.cjs REASONS. services/ is not in the npm package, so this shipped
// script does not require it; tests/test-400-relay-transport.cjs T4 pins the two lists equal.
const RELAY_REASONS = Object.freeze([
  'no_caller', 'bad_install_id', 'bad_token', 'user_traffic_off', 'no_upstream_key', 'too_large', 'not_json', 'catalog_skew',
  'labels_only_refused', 'too_many_questions', 'install_rate', 'install_daily_cap', 'address_daily_cap', 'global_daily_requests',
  'global_daily_questions', 'global_token_cap', 'operator_daily_cap', 'bucket_table_full', 'body_check_failed', 'upstream_error',
  'upstream_unreachable', 'upstream_timeout', 'operator_rate', 'operator_token_cap', 'relay_busy',
  'address_rate', 'address_daily_requests',
]);

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
  // Review IN-04: a query, a fragment or userinfo in --base would end up inside the URL (https://h/?x=1/v1beta/...)
  // or carry credentials; refuse them instead of building a wrong URL.
  if (u.search !== '' || u.hash !== '' || u.username !== '' || u.password !== '') return null;
  return { origin: u.origin, prefix: u.pathname.replace(/\/+$/, ''), loopback };
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
        // Review WR-03: never follow a redirect. A 307 or 308 would re-send the body and the custom key
        // header to whatever host the response names. A redirect becomes a fetch error, then http_error.
        redirect: 'error',
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
    } catch (_e) {
      return refuse('labels_only_refused', 'render failed');
    }
    const checked = labels.validateProviderBody(providerKey, body, chunk, cat);
    if (!checked.ok) return refuse('labels_only_refused', checked.reason + ' at ' + checked.path);
    out.push({ chunk, rendered, body });
  }
  return { ok: true, chunks: out };
}

// Relay chunks: the neutral request split at RELAY_MAX_QUESTIONS, each chunk re-validated. No render here:
// the relay renders server-side. Refuses with labels_only_refused. Never throws.
function buildRelayChunks(req) {
  const cat = labels.buildLabelCatalog();
  const first = labels.validateNeutralRequest(req, cat);
  if (!first.ok) return refuse('labels_only_refused', first.reason + ' at ' + first.path);
  const out = [];
  for (const chunk of adapter.chunkRequest(req, RELAY_MAX_QUESTIONS)) {
    const v = labels.validateNeutralRequest(chunk, cat);
    if (!v.ok) return refuse('labels_only_refused', v.reason + ' at ' + v.path);
    out.push(chunk);
  }
  return { ok: true, chunks: out };
}

function mindrianHome(env) {
  return typeof env.MINDRIAN_HOME === 'string' && env.MINDRIAN_HOME.length > 0 ? env.MINDRIAN_HOME : path.join(os.homedir(), '.mindrian');
}

// Review WR-03: true when an operator run may send the token to this base.
function operatorOriginAllowed(base) {
  return !!base && (base.loopback === true || OPERATOR_ORIGINS.indexOf(base.origin) !== -1);
}

// Review WR-03: read the operator token file. Opened with O_NOFOLLOW and checked on the open descriptor, so a
// symlink or a file swapped after a check is refused. Returns { ok: true, token }, { ok: false, absent: true }
// when there is no file, or an operator_token_missing refusal with a fixed detail. The token is never in a detail.
function readOperatorTokenFile(home) {
  const file = path.join(home, OPERATOR_TOKEN_FILE);
  const flags = fs.constants.O_RDONLY | (typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0);
  let fd;
  try {
    fd = fs.openSync(file, flags);
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ok: false, absent: true };
    if (e && e.code === 'ELOOP') return refuse('operator_token_missing', 'token file is a symlink');
    return refuse('operator_token_missing', 'token file unreadable');
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return refuse('operator_token_missing', 'token file is not a regular file');
    if (process.platform !== 'win32') {
      if ((st.mode & 0o077) !== 0) return refuse('operator_token_missing', 'token file mode wider than 0600');
      if (typeof process.getuid === 'function' && st.uid !== process.getuid()) return refuse('operator_token_missing', 'token file owner');
    }
    if (st.size > OPERATOR_TOKEN_FILE_MAX_BYTES) return refuse('operator_token_missing', 'token shape');
    const text = fs.readFileSync(fd, 'utf8').replace(/\r?\n$/, '');
    return { ok: true, token: text };
  } catch (_e) {
    return refuse('operator_token_missing', 'token file unreadable');
  } finally {
    try { fs.closeSync(fd); } catch (_e) { /* already closed */ }
  }
}

// Review WR-03: one no-echo token prompt on an interactive terminal, asked at most once per process.
// Returns a function that resolves the typed text, or null when stdin or stderr is not a terminal.
function ttyTokenPrompt() {
  const stdin = process.stdin;
  if (!stdin.isTTY || !process.stderr.isTTY || typeof stdin.setRawMode !== 'function') return null;
  let asked = null;
  return function prompt() {
    if (asked) return asked;
    asked = new Promise((resolve) => {
      let buf = '';
      const finish = (v) => {
        stdin.removeListener('data', onData);
        try { stdin.setRawMode(false); } catch (_e) { /* terminal gone */ }
        stdin.pause();
        process.stderr.write('\n');
        resolve(v);
      };
      function onData(chunk) {
        for (const ch of String(chunk)) {
          if (ch === '\r' || ch === '\n' || ch === '\u0004') { finish(buf); return; }
          if (ch === '\u0003') { finish(''); return; }
          if (ch === '\u007f' || ch === '\b') { buf = buf.slice(0, -1); continue; }
          buf += ch;
        }
      }
      process.stderr.write('decision relay operator token (not echoed): ');
      stdin.setEncoding('utf8');
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onData);
    });
    return asked;
  };
}

// Review WR-03: the operator token, from the file, else from the prompt seam. Returns { ok: true, token } or a refusal.
async function operatorToken(home, o) {
  const f = readOperatorTokenFile(home);
  let t = null;
  if (f.ok) {
    t = f.token;
  } else if (f.absent && typeof o.tokenPrompt === 'function') {
    try { t = await o.tokenPrompt(); } catch (_e) { t = null; }
  } else if (!f.absent) {
    return f;
  }
  if (typeof t !== 'string' || t.length === 0) return refuse('operator_token_missing');
  if (!OPERATOR_TOKEN_RE.test(t)) return refuse('operator_token_missing', 'token shape');
  return { ok: true, token: t };
}

// One POST of an exact body string. No retry: a relay refusal is final, and a resend can spend twice.
// A redirect is a fetch error (status 0). Returns { status, json }.
async function relayPost(url, headers, bodyText, o) {
  const doFetch = o.fetchImpl || globalThis.fetch;
  let r;
  try {
    r = await doFetch(url, {
      method: 'POST',
      headers,
      body: bodyText,
      redirect: 'error',
      signal: AbortSignal.timeout(typeof o.timeoutMs === 'number' && o.timeoutMs > 0 ? o.timeoutMs : TIMEOUT_MS),
    });
  } catch (_e) {
    return { status: 0, json: null };
  }
  let json = null;
  try { json = JSON.parse(await r.text()); } catch (_e) { json = null; }
  return { status: r.status, json };
}

function isProb(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function probMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const k of Object.keys(raw)) {
    if (k.length > 80 || !isProb(raw[k])) return null;
    out[k] = raw[k];
  }
  return Object.keys(out).length ? out : null;
}

// The relay reply is untrusted. Every answer id must be a question of the chunk and carry its type and a
// value in range; anything else voids the chunk (null). An unanswered question becomes { type, missing: true }.
function checkRelayAnswers(answers, chunk) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const out = {};
  for (const id of Object.keys(answers)) {
    if (!Object.prototype.hasOwnProperty.call(chunk.questions, id)) return null;
    const q = chunk.questions[id];
    const a = answers[id];
    if (!a || typeof a !== 'object' || a.type !== q.type) return null;
    if (a.missing === true) { out[id] = { type: q.type, missing: true }; continue; }
    if (q.type === 'yes_no') {
      if (!isProb(a.p)) return null;
      out[id] = { type: 'yes_no', p: a.p };
    } else if (q.type === 'choice') {
      const probabilities = probMap(a.probabilities);
      if (typeof a.choice !== 'string' || a.choice.length > 80 || !probabilities) return null;
      out[id] = { type: 'choice', probabilities, choice: a.choice, confidence: isProb(a.confidence) ? a.confidence : null };
    } else if (q.type === 'score') {
      const probabilities = probMap(a.probabilities);
      if (!isProb(a.score) || !probabilities) return null;
      out[id] = { type: 'score', score: a.score, probabilities, confidence: isProb(a.confidence) ? a.confidence : null };
    } else {
      return null;
    }
  }
  for (const id of Object.keys(chunk.questions)) {
    if (!Object.prototype.hasOwnProperty.call(out, id)) out[id] = { type: chunk.questions[id].type, missing: true };
  }
  return out;
}

function tokenCount(v) {
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

// Maps one relay reply to { ok: true, answers, usage, model } or a refusal.
function readRelayReply(res, chunk, fp) {
  const json = res.json && typeof res.json === 'object' && !Array.isArray(res.json) ? res.json : null;
  if (res.status === 0) return refuse('http_error', 'status 0');
  if (res.status === 409 && json && typeof json.relay_catalog === 'string' && HEX64_RE.test(json.relay_catalog)) {
    return refuse('catalog_skew', 'relay catalog ' + json.relay_catalog);
  }
  if (res.status !== 200) {
    const listed = json && typeof json.reason === 'string' && RELAY_REASONS.indexOf(json.reason) !== -1;
    return refuse('relay_refused', listed ? json.reason : 'status ' + res.status);
  }
  if (!json || json.ok !== true) return refuse('bad_response');
  if (json.catalog !== fp) {
    return typeof json.catalog === 'string' && HEX64_RE.test(json.catalog) ? refuse('catalog_skew', 'relay catalog ' + json.catalog) : refuse('bad_response');
  }
  const answers = checkRelayAnswers(json.answers, chunk);
  if (!answers) return refuse('bad_response');
  const u = json.usage && typeof json.usage === 'object' ? json.usage : {};
  return {
    ok: true,
    answers,
    usage: { input_tokens: tokenCount(u.input_tokens), output_tokens: tokenCount(u.output_tokens) },
    model: typeof json.model === 'string' && json.model.length <= 80 ? json.model : null,
  };
}

// The one-run policy of an operator release run: the shape of loadEgressPolicy output, only decision_advisor on.
// Built in memory for one call; nothing is written. Every other line is copied with allowed false.
function oneRunPolicy() {
  const shipped = egress.loadEgressPolicy('', { offline: false });
  const lines = {};
  for (const name of Object.keys(shipped.lines || {})) lines[name] = Object.assign({}, shipped.lines[name], { allowed: name === LINE });
  if (!lines[LINE]) lines[LINE] = { endpoint: '', default: false, scope: '', providers: [], allowed: true };
  return { schema: shipped.schema, offline: false, lines, ignored: [], one_run: 'operator_release_run' };
}

function auditStamp(d) {
  return d.toISOString().replace(/\.[0-9]{3}Z$/, 'Z').replace(/[-:]/g, '');
}

// Atomic temp-and-rename write, file mode 0600 in a 0700 directory. Returns true or false, never throws.
function writeAudit(file, rec) {
  const dir = path.dirname(file);
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    // Review IN-07: never chmod through a symlink; a symlinked directory is refused (audit_unwritable).
    if (fs.lstatSync(dir).isSymbolicLink()) return false;
    if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
    fs.writeFileSync(tmp, JSON.stringify(rec, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, file);
    if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
    return true;
  } catch (_e) {
    try { fs.unlinkSync(tmp); } catch (_e2) { /* no temp file left */ }
    return false;
  }
}

// The relay send mode. Same line, same refusal order as the other providers. The caller is the stored install
// id, or the operator token on an operator release run.
async function sendRelay(req, o) {
  // 1 validate, before the policy check
  const built = buildRelayChunks(req);
  if (!built.ok) return built;
  const env = o.env || process.env;
  const operator = o.operatorReleaseRun === true;

  const home = mindrianHome(env);
  const base = parseBase(o.base);

  // 1b operator release run: the origin pin first, then the token, read only here, only with the flag
  let token = null;
  if (operator) {
    if (!operatorOriginAllowed(base)) return refuse('endpoint_unconfirmed', 'operator base origin not allowlisted');
    const t = await operatorToken(home, o);
    if (!t.ok) return t;
    token = t.token;
  }

  const fp = labels.catalogFingerprint();
  const started = new Date();
  const audit = operator ? {
    file: path.join(home, AUDIT_DIR, auditStamp(started) + '-' + crypto.randomBytes(4).toString('hex') + '.json'),
    rec: {
      schema: AUDIT_SCHEMA,
      at: started.toISOString(),
      base_origin: base ? base.origin : null,
      path: (base ? base.prefix : '') + RELAY_PATH,
      catalog: fp,
      chunks: [],
      totals: { questions: 0, input_tokens: 0, output_tokens: 0 },
      ok: false,
      operator_release_run: true,
    },
  } : null;
  // The trail exists before any byte leaves: no record, no send.
  if (audit && !writeAudit(audit.file, audit.rec)) return refuse('audit_unwritable');

  const result = await relaySteps(built, o, { env, home, fp, base, token, audit });
  if (audit) {
    audit.rec.ok = result.ok === true;
    if (!writeAudit(audit.file, audit.rec)) return refuse('audit_unwritable', 'final record');
  }
  return result;
}

async function relaySteps(built, o, ctx) {
  // 2 policy: the shipped policy, or the in-memory one-run policy of an operator release run
  const policy = ctx.token ? oneRunPolicy() : (o.policy || egress.loadEgressPolicy(o.roomDir || '', { offline: o.offline === true }));
  if (!egress.lineAllowed(policy, LINE)) return refuse('egress_line_off');

  // 3 endpoint
  if (!ctx.base) return refuse('endpoint_unconfirmed');
  const url = ctx.base.origin + ctx.base.prefix + RELAY_PATH;

  // 4 caller header: the operator token, or the stored install id read only (this script never mints one)
  const headers = { 'content-type': 'application/json', [RELAY_CATALOG_HEADER]: ctx.fp };
  if (ctx.token) {
    headers.authorization = 'Bearer ' + ctx.token;
  } else {
    const id = installId.peekInstallId({ homeDir: ctx.home });
    if (!id) return refuse('no_install_id');
    headers[installId.installIdHeaderName] = id;
  }

  // 5 send each chunk, 6 check and merge
  const out = o.out && typeof o.out.write === 'function' ? o.out : process.stdout;
  const answers = {};
  const usage = { input_tokens: 0, output_tokens: 0 };
  let requests = 0;
  let model = null;
  const n = built.chunks.length;
  for (let i = 0; i < n; i += 1) {
    const chunk = built.chunks[i];
    const again = labels.validateNeutralRequest(chunk);
    if (!again.ok) return refuse('labels_only_refused', 'body_not_validated_chunk');
    const bodyText = JSON.stringify(chunk);
    const q = Object.keys(chunk.questions).length;
    if (ctx.audit) out.write('decision relay release run: chunk ' + (i + 1) + ' of ' + n + ', ' + q + ' questions, to ' + url + '\n' + bodyText + '\n');
    requests += 1;
    const res = await relayPost(url, headers, bodyText, o);
    const r = readRelayReply(res, chunk, ctx.fp);
    if (ctx.audit) {
      ctx.audit.rec.chunks.push({ questions: q, body_sha256: crypto.createHash('sha256').update(bodyText, 'utf8').digest('hex'), status: res.status, reason: r.ok ? null : r.reason });
      ctx.audit.rec.totals.questions += q;
      if (r.ok) {
        ctx.audit.rec.totals.input_tokens += r.usage.input_tokens;
        ctx.audit.rec.totals.output_tokens += r.usage.output_tokens;
      }
    }
    if (!r.ok) return r;
    Object.assign(answers, r.answers);
    usage.input_tokens += r.usage.input_tokens;
    usage.output_tokens += r.usage.output_tokens;
    model = r.model;
  }
  return { ok: true, answers, usage, provider: 'relay', model, requests };
}

// send(req, opts) -> { ok: true, answers, usage, provider, model, requests } | { ok: false, reason, detail? }
// opts: { provider: 'gemini' | 'jev' | 'relay', base, model, roomDir, offline, env, fetchImpl, sleepImpl, timeoutMs,
//         policy (test seam: an object shaped like loadEgressPolicy output; no CLI flag or env sets it),
//         operatorReleaseRun, tokenPrompt (async () => token; asked only on an operator run with no token file) }
async function send(req, opts) {
  const o = opts || {};
  const providerKey = o.provider;
  if (providerKey === 'relay') return sendRelay(req, o);
  if (o.operatorReleaseRun === true) return refuse('labels_only_refused', 'operator release run needs provider relay');
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
  if (!base || typeof provider.PATH !== 'string' || provider.PATH.length === 0) return refuse('endpoint_unconfirmed');
  const url = base.origin + base.prefix + provider.PATH;

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
// For provider relay the bodies are the neutral chunks the relay would receive.
function dryRun(req, opts) {
  const o = opts || {};
  if (o.provider === 'relay') {
    const r = buildRelayChunks(req);
    return r.ok ? { ok: true, bodies: r.chunks } : r;
  }
  if (o.provider !== 'gemini' && o.provider !== 'jev') return refuse('labels_only_refused', 'unknown provider');
  const built = buildChunks(req, o.provider, o.model);
  if (!built.ok) return built;
  return { ok: true, bodies: built.chunks.map((c) => c.body) };
}

const EXIT = {
  labels_only_refused: 2, egress_line_off: 4, no_key: 5, endpoint_unconfirmed: 5, http_error: 6, bad_response: 6,
  no_install_id: 5, catalog_skew: 6, relay_refused: 6, operator_token_missing: 5, audit_unwritable: 5,
};

function parseArgs(argv) {
  const a = { provider: null, request: null, requests: [], base: null, model: null, dryRun: false, room: null, operatorReleaseRun: false, out: null, resume: false, error: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    switch (flag) {
      case '--provider': a.provider = argv[++i] || null; break;
      case '--request': {
        const v = argv[++i] || null;
        if (v) a.requests.push(v);
        if (!a.request) a.request = v;
        break;
      }
      case '--out': a.out = argv[++i] || null; break;
      case '--resume': a.resume = true; break;
      case '--base': a.base = argv[++i] || null; break;
      case '--model': a.model = argv[++i] || null; break;
      case '--room': a.room = argv[++i] || null; break;
      case '--dry-run': a.dryRun = true; break;
      // The only switch for an operator release run. No environment variable sets it (O-10).
      case '--operator-release-run': a.operatorReleaseRun = true; break;
      default: a.error = 'unknown flag ' + flag;
    }
  }
  if (!a.error && a.provider !== 'gemini' && a.provider !== 'jev' && a.provider !== 'relay') a.error = 'provider must be gemini, jev or relay';
  if (!a.error && !a.request) a.error = 'missing --request';
  if (!a.error && a.operatorReleaseRun && a.provider !== 'relay') a.error = '--operator-release-run needs --provider relay';
  if (!a.error && a.operatorReleaseRun && a.dryRun) a.error = '--operator-release-run and --dry-run do not combine';
  if (!a.error && a.requests.length > 1 && (a.provider !== 'relay' || a.dryRun)) a.error = 'a repeated --request needs --provider relay without --dry-run';
  if (!a.error && a.out && (a.provider !== 'relay' || a.dryRun)) a.error = '--out needs --provider relay without --dry-run';
  if (!a.error && a.resume && !a.out) a.error = '--resume needs --out';
  return a;
}

// The pairs source of scripts/derive-decision-fixture.cjs: {pairs: [{job, command, p}]} from the serves_job_v1
// yes/no answers. Other templates and missing answers are skipped and counted.
function pairsOf(runs) {
  const pairs = [];
  let skipped = 0;
  for (const run of runs) {
    for (const id of Object.keys(run.req.questions)) {
      const q = run.req.questions[id];
      const a = run.result.answers[id];
      if (q.template === 'serves_job_v1' && a && a.type === 'yes_no' && typeof a.p === 'number') {
        pairs.push({ job: run.req.context.job_id, command: q.subject, p: a.p });
      } else {
        skipped += 1;
      }
    }
  }
  return { pairs, skipped };
}

function summaryOf(r) {
  return { provider: r.provider, model: r.model, requests: r.requests, usage: r.usage, answers: r.answers };
}

// Review WR-10: the saved answers of one request, keyed by the sha256 of the request text.
const PARTIAL_SCHEMA = 'mos.decision-relay-partial/1';
function requestSha(req) {
  return crypto.createHash('sha256').update(JSON.stringify(req), 'utf8').digest('hex');
}
function partialFile(dir, req, sha) {
  const job = req && req.context && typeof req.context.job_id === 'string' ? req.context.job_id : 'job';
  const safe = job.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60) || 'job';
  return path.join(dir, safe + '-' + sha.slice(0, 12) + '.json');
}
// A saved result, or null when the file is absent, unreadable, a symlink or for another request.
function readPartial(file, sha) {
  try {
    if (fs.lstatSync(file).isSymbolicLink()) return null;
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!doc || doc.schema !== PARTIAL_SCHEMA || doc.request_sha256 !== sha) return null;
    const r = doc.result;
    if (!r || typeof r.answers !== 'object' || r.answers === null || Array.isArray(r.answers)) return null;
    return { ok: true, provider: r.provider, model: r.model, requests: r.requests, usage: r.usage, answers: r.answers };
  } catch (_e) {
    return null;
  }
}

async function main(argv) {
  const a = parseArgs(argv);
  if (a.error) {
    process.stderr.write('usage error: ' + a.error + '\n');
    return 2;
  }
  const reqs = [];
  for (const file of a.requests) {
    try { reqs.push(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (_e) {
      process.stderr.write('usage error: request file is not readable JSON\n');
      return 2;
    }
  }
  const req = reqs[0];
  if (a.provider === 'relay' && !a.dryRun) {
    // One send per request, in order. The first refusal stops the run; --out is written only when all succeed.
    // Review WR-10: with --out, each answered request is saved to <out>.partial at once; --resume reads it back.
    const runs = [];
    const partialDir = a.out ? path.resolve(a.out) + '.partial' : null;
    let resumed = 0;
    let saved = 0;
    // Review WR-03: the prompt is the fallback when the token file is absent; it asks at most once per run.
    const tokenPrompt = a.operatorReleaseRun ? ttyTokenPrompt() : null;
    for (const one of reqs) {
      const sha = partialDir ? requestSha(one) : null;
      const pfile = partialDir ? partialFile(partialDir, one, sha) : null;
      const kept = a.resume ? readPartial(pfile, sha) : null;
      if (kept) {
        resumed += 1;
        runs.push({ req: one, result: kept });
        continue;
      }
      const r = await send(one, { provider: 'relay', base: a.base, roomDir: a.room || '', operatorReleaseRun: a.operatorReleaseRun, tokenPrompt, out: process.stdout });
      if (!r.ok) {
        process.stderr.write(r.reason + (r.detail ? ': ' + r.detail : '') + '\n');
        if (partialDir && saved + resumed > 0) {
          process.stderr.write('transport --out: ' + (saved + resumed) + ' of ' + reqs.length + ' requests have saved answers in ' + partialDir + '; run the same command with --resume\n');
        }
        return EXIT[r.reason] || 6;
      }
      if (partialDir) {
        const ok = writeAudit(pfile, { schema: PARTIAL_SCHEMA, request_sha256: sha, result: summaryOf(r) });
        if (ok) saved += 1;
        else process.stderr.write('transport --out: could not save the answers of one request in ' + partialDir + '\n');
      }
      runs.push({ req: one, result: r });
    }
    if (resumed > 0) process.stderr.write('transport --resume: ' + resumed + ' of ' + reqs.length + ' requests read from saved answers, not sent\n');
    const summaries = runs.map((x) => summaryOf(x.result));
    process.stdout.write(JSON.stringify(summaries.length === 1 ? summaries[0] : summaries, null, 2) + '\n');
    if (a.out) {
      const p = pairsOf(runs);
      const target = path.resolve(a.out);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify({ pairs: p.pairs }, null, 1) + '\n');
      process.stderr.write('transport --out: wrote ' + p.pairs.length + ' pairs, skipped ' + p.skipped + ' answers (not serves_job_v1, or missing)\n');
      // Every request has an answer and --out holds them: the saved answers are no longer needed.
      try {
        if (fs.existsSync(partialDir) && !fs.lstatSync(partialDir).isSymbolicLink()) fs.rmSync(partialDir, { recursive: true, force: true });
      } catch (_e) { /* a leftover dir is harmless; --resume checks each file */ }
    }
    return 0;
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
  const r = await send(req, { provider: a.provider, base: a.base, model: a.model, roomDir: a.room || '', operatorReleaseRun: a.operatorReleaseRun, out: process.stdout });
  if (!r.ok) {
    process.stderr.write(r.reason + (r.detail ? ': ' + r.detail : '') + '\n');
    return EXIT[r.reason] || 6;
  }
  process.stdout.write(JSON.stringify({ provider: r.provider, model: r.model, requests: r.requests, usage: r.usage, answers: r.answers }, null, 2) + '\n');
  return 0;
}

module.exports = { send, dryRun, LINE, PROVIDER_IDS, REFUSALS, RELAY_PATH, RELAY_MAX_QUESTIONS, RELAY_REASONS, OPERATOR_ORIGINS, OPERATOR_TOKEN_FILE };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, () => {
    process.stderr.write('transport failed\n');
    process.exitCode = 6;
  });
}
