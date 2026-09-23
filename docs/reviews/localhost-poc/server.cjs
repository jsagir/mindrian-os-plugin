'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const args = process.argv.slice(2);
const PORT = Number(process.env.MINDRIAN_POC_PORT || args.find((x) => /^\d+$/.test(x)) || 3196);
const HOST = '127.0.0.1';
const roomArg = args.includes('--room') ? args[args.indexOf('--room') + 1] : process.env.MINDRIAN_POC_ROOM;
const sectionArg = args.includes('--section') ? args[args.indexOf('--section') + 1] : (process.env.MINDRIAN_POC_SECTION || 'workspace');

// 354-11 (T-354-22): --room is resolved to its realpath and MUST already be a
// bound room (an existing <room>/.mindrian/room.db) -- explicit binding,
// never a silent fallback to an unbound directory. --section is validated
// against the SAME SECTION_RE gate the artifact_file MCP tool uses
// (lib/mcp/tool-router.cjs _test.SECTION_RE), reused rather than
// reimplemented (Canon Part 7). Both checks -- and the require() that reaches
// into the real repo tree via ROOT-relative paths -- are scoped to when
// --room is actually given: fixture mode (and every fixture-mode test, which
// runs server.cjs from a disposable scratch copy with no repo tree beside
// it) never needs SECTION_RE or the room chokepoints at all.
let ROOM = null;
let SECTION = sectionArg;
if (roomArg) {
  const { SECTION_RE } = require(path.resolve(ROOT, '../../../lib/mcp/tool-router.cjs'))._test;
  if (!SECTION_RE.test(sectionArg)) {
    process.stderr.write('MindrianOS localhost POC: refusing to start - --section "' + sectionArg + '" does not match ' + SECTION_RE + '\n');
    process.exit(2);
  }
  SECTION = sectionArg;

  let resolvedRoom = null;
  try {
    resolvedRoom = fs.realpathSync(path.resolve(roomArg));
  } catch (_e) {
    resolvedRoom = null;
  }
  const roomDbPath = path.join(resolvedRoom || path.resolve(roomArg), '.mindrian', 'room.db');
  if (!resolvedRoom || !fs.existsSync(roomDbPath)) {
    process.stderr.write(
      'MindrianOS localhost POC: refusing to start - missing ' + roomDbPath +
      ' (the room is not bound; create/open it first so .mindrian/room.db exists -- no silent fallback to an unbound directory)\n'
    );
    process.exit(2);
  }
  ROOM = resolvedRoom;
}

const navigation = ROOM ? require(path.resolve(ROOT, '../../../lib/core/navigation.cjs')) : null;
// 354-11: the ONE governed filing door -- the same _internal.fileArtifact the
// artifact_file MCP tool calls (section containment, artifact_id, memory_event,
// claim node). Room-mode saves never write documentPath raw.
const viewsInternal = ROOM ? require(path.resolve(ROOT, '../../../lib/mcp/tools/views.cjs'))._internal : null;
const graphPath = path.join(DATA, 'graph.json');
const documentPath = ROOM ? path.join(ROOM, SECTION, 'workspace-poc.md') : path.join(DATA, 'workspace.md');
const MAX_DOCUMENT_CHARS = 1000000; // T-354-18c
const MAX_RAW_BODY_BYTES = 2 * 1024 * 1024; // T-354-18c

// T-354-16/T-354-17: per-launch capability token and Host allowlist, both
// finalized once the server has actually bound (see listen() below). Zero
// requests are dispatched before that callback fires, so this is never a
// race against an incoming connection.
let TOKEN = '';
let ALLOWED_HOSTS = new Set();

function applySecurityHeaders(res) {
  // T-354-16/T-354-17 defense in depth: even a same-origin response should
  // not execute injected script, sniff content type, or leak via Referer.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function json(res, status, payload) {
  applySecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }

// T-354-18c: raw body is capped at MAX_RAW_BODY_BYTES. On overflow the
// request is destroyed and the promise rejects with code BODY_TOO_LARGE so
// the caller can answer 413 instead of hanging or silently truncating.
function readBody(req, capBytes) {
  return new Promise((resolve, reject) => {
    let b = '';
    let tooLarge = false;
    req.on('data', (c) => {
      b += c;
      if (b.length > capBytes) { tooLarge = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('body too large'), { code: 'BODY_TOO_LARGE' }));
      else resolve(b);
    });
    req.on('error', (e) => {
      if (tooLarge) reject(Object.assign(new Error('body too large'), { code: 'BODY_TOO_LARGE' }));
      else reject(e);
    });
  });
}

// documentPath in API responses is always relative to the fixture data dir
// (fixture mode) or the room root (room mode), never an absolute filesystem
// path -- an absolute path would leak the server operator's directory layout
// to any same-origin page.
function relativeDocumentPath() {
  return path.relative(ROOM || DATA, documentPath);
}

// 354-11 (J5 grounded-ask): mirrors lib/mcp/tools/views.cjs's own private
// firstArtifactBodyLine exactly (that helper is not exported via _internal,
// and this POC script already duplicates small local patterns rather than
// reaching into a module's unexported internals -- Canon Part 7 reuse
// applies to the shared WRITE door, fileArtifact, which this file does call;
// it does not require importing a private read-side helper for a two-line
// POC display concern). Strips frontmatter, skips blank/heading/comment/
// blockquote lines, returns the first real content line (300-char cap).
function firstBodyLine(content) {
  if (typeof content !== 'string' || content.length === 0) return '';
  let body = content;
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) body = content.slice(end + 4);
  }
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('<!--')) continue;
    if (trimmed.startsWith('>')) continue;
    return trimmed.length > 300 ? trimmed.slice(0, 300) : trimmed;
  }
  return '';
}

async function graph() {
  if (!ROOM) return readJson(graphPath, { nodes: [], edges: [] });
  const projection = await navigation.getGraphExport(ROOM);
  // 354-11 (T-354-22b/T-354-22c): getGraphExport's own whitelist (Canon Part
  // 8, shared with the exportable wiki/dashboard surfaces) never emits a
  // node's source path or its stored text -- correct for those surfaces, but
  // this POC manages exactly ONE governed working file and already knows
  // both locally without a second graph-store read: read the file this
  // route already serves via /api/document for the first body line, and
  // derive the claim:artifact node's source from the section/filename this
  // process actually filed into (relativeDocumentPath), never a guess.
  let fileFirstLine = '';
  if (fs.existsSync(documentPath)) {
    fileFirstLine = firstBodyLine(fs.readFileSync(documentPath, 'utf8'));
  }
  const artifactSource = relativeDocumentPath();
  const nodes = (projection.elements && projection.elements.nodes || []).map((n) => {
    const isArtifactClaim = typeof n.data.id === 'string' && n.data.id.indexOf('claim:artifact:') === 0;
    return {
      id: n.data.id,
      type: n.data.type,
      title: (isArtifactClaim && fileFirstLine) ? fileFirstLine : n.data.label,
      source: isArtifactClaim ? artifactSource : null,
    };
  });
  const edges = (projection.elements && projection.elements.edges || []).map((e) => ({ source: e.data.source, target: e.data.target, type: e.data.type }));
  return { nodes, edges };
}

async function graphAnswer(question) {
  const q = String(question || '').toLowerCase();
  const g = await graph();
  const terms = q.split(/\W+/).filter(x => x.length > 2);
  const hits = g.nodes.filter(n => terms.some(t => JSON.stringify(n).toLowerCase().includes(t))).slice(0, 8);
  const relatedIds = new Set(hits.map(n => n.id));
  const edges = g.edges.filter(e => relatedIds.has(e.source) || relatedIds.has(e.target)).slice(0, 10);
  // T-354-22b: labelled and shaped as a deterministic local lookup, never a
  // model call -- references carry only the node id + the local source path
  // already known to this process, never a raw Brain/model round trip.
  const references = hits.map(n => ({ id: n.id, source: n.source || null }));
  if (!hits.length) {
    return {
      mode: 'deterministic_graph_lookup',
      answer: 'The local graph has no matching nodes. Try a concept such as customer, urgency, handoff, or budget.',
      nodes: [], edges: [], references: [],
    };
  }
  return {
    mode: 'deterministic_graph_lookup',
    answer: `The local graph found ${hits.length} relevant node${hits.length === 1 ? '' : 's'} and ${edges.length} related connection${edges.length === 1 ? '' : 's'}.`,
    nodes: hits, edges, references,
  };
}
function serveFile(res, file, type) {
  try {
    const body = fs.readFileSync(file);
    applySecurityHeaders(res);
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch (_) {
    applySecurityHeaders(res);
    res.writeHead(404);
    res.end('not found');
  }
}

// index.html carries a <!--MOS_POC_TOKEN--> marker inside <head>; this
// injects the per-launch token as a same-origin-only <meta> tag so app.js
// can read it without ever transmitting it cross-origin (only a same-origin
// page can read its own DOM).
function serveIndex(res) {
  let html;
  try {
    html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  } catch (_e) {
    applySecurityHeaders(res);
    res.writeHead(404);
    res.end('not found');
    return;
  }
  html = html.replace('<!--MOS_POC_TOKEN-->', '<meta name="mos-poc-token" content="' + TOKEN + '">');
  applySecurityHeaders(res);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// T-354-18: revision is the sha256 of the file's exact bytes on disk. A save
// whose base_revision no longer matches loses (409 conflict) instead of
// silently clobbering a concurrent editor's work. A missing file (room mode,
// never written on read -- see GET /api/document below) reads as an empty
// buffer, so its revision is sha256('').
function computeRevision() {
  let bytes;
  try { bytes = fs.readFileSync(documentPath); } catch (_e) { bytes = Buffer.alloc(0); }
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

// T-354-18: temp-file-then-rename so a crashed or interrupted write can
// never leave a torn file on disk. 'wx' refuses to clobber a stale temp
// file left by a prior crash rather than silently reusing it. Cites the
// lib/core/recovery/case-file.cjs atomicWrite idiom (temp + fs.renameSync).
// Fixture mode's only writer, including its own missing-file seed content --
// 354-11 removed the last raw synchronous whole-file write call, so every
// byte that lands on documentPath in EITHER mode goes through either this
// atomic writer (fixture) or fileArtifact (room, see POST /api/document).
function atomicWriteDocument(content) {
  const dir = path.dirname(documentPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, '.' + path.basename(documentPath) + '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  const fd = fs.openSync(tmp, 'wx');
  try {
    fs.writeSync(fd, content, null, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, documentPath);
}

// T-354-17: Host allowlist, applied to every route (reads included). Without
// this a DNS-rebinding attacker page can point a hostname at 127.0.0.1 and
// bypass same-origin assumptions entirely.
function isAllowedHost(req) {
  const host = req.headers.host || '';
  return ALLOWED_HOSTS.has(host);
}

// T-354-16: exact-Origin CSRF guard. A foreign page's simple request (the
// kind that skips CORS preflight, e.g. no-cors text/plain) still arrives
// here with a foreign Origin header the browser cannot forge; refusing any
// mismatch closes that gap without relying on preflight at all.
function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string') return false;
  return origin === 'http://' + req.headers.host;
}

// T-354-16: constant-time token compare. Buffer length must match before
// crypto.timingSafeEqual is called (it throws on length mismatch), so a
// length check first is both correct and still timing-safe (length itself
// is not the secret).
function safeTokenMatch(provided) {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(TOKEN, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// T-354-16: shared guard for every mutating (POST) route -- exact Origin,
// JSON-only content type (forces a CORS preflight for any cross-origin
// caller), and the per-launch capability token a foreign page can never
// read (it lives only in this same-origin page's DOM).
function checkPostGuards(req, res) {
  if (!isAllowedOrigin(req)) { json(res, 403, { error: 'forbidden_origin' }); return false; }
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('application/json')) { json(res, 415, { error: 'unsupported_media_type' }); return false; }
  if (!safeTokenMatch(req.headers['x-mindrian-poc-token'])) { json(res, 403, { error: 'bad_token' }); return false; }
  return true;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);

  // T-354-17: Host check first, before any route dispatch, GET or POST.
  if (!isAllowedHost(req)) return json(res, 403, { error: 'forbidden_host' });

  if (req.method === 'GET' && u.pathname === '/') return serveIndex(res);
  if (req.method === 'GET' && u.pathname === '/app.js') return serveFile(res, path.join(ROOT, 'app.js'), 'text/javascript; charset=utf-8');
  if (req.method === 'GET' && u.pathname === '/styles.css') return serveFile(res, path.join(ROOT, 'styles.css'), 'text/css; charset=utf-8');
  if (req.method === 'GET' && u.pathname === '/api/room') {
    // 354-11 (J1 bind): explicit room identity for the client -- never
    // guessed client-side. name is 'fixture' in fixture mode, the room's own
    // basename in room mode (never an absolute path).
    return json(res, 200, { mode: ROOM ? 'room' : 'fixture', name: ROOM ? path.basename(ROOM) : 'fixture', section: SECTION });
  }
  if (req.method === 'GET' && u.pathname === '/api/graph') return json(res, 200, await graph());
  if (req.method === 'GET' && u.pathname === '/api/document') {
    if (ROOM) {
      // 354-11 (T-354-22c): a missing working file in room mode reads as
      // empty -- never auto-created on a GET. The only room-mode writer is
      // POST /api/document's fileArtifact call below.
      const exists = fs.existsSync(documentPath);
      return json(res, 200, {
        markdown: exists ? fs.readFileSync(documentPath, 'utf8') : '',
        revision: computeRevision(),
        updatedAt: exists ? fs.statSync(documentPath).mtime.toISOString() : null,
        documentPath: relativeDocumentPath(),
      });
    }
    if (!fs.existsSync(documentPath)) atomicWriteDocument('# Working file\n\nStart writing here.\n');
    return json(res, 200, {
      markdown: fs.readFileSync(documentPath, 'utf8'),
      revision: computeRevision(),
      updatedAt: fs.statSync(documentPath).mtime.toISOString(),
      documentPath: relativeDocumentPath(),
    });
  }
  if (req.method === 'GET' && u.pathname === '/api/document/revision') {
    // Read-only polling target for 354-11's external-edit detection; no
    // POST guards needed, same Host check as every other route already ran.
    // Room mode never writes on read (see GET /api/document above).
    if (!ROOM && !fs.existsSync(documentPath)) atomicWriteDocument('# Working file\n\nStart writing here.\n');
    return json(res, 200, { revision: computeRevision() });
  }
  if (req.method === 'POST' && u.pathname === '/api/document') {
    if (!checkPostGuards(req, res)) return;
    let raw;
    try {
      raw = await readBody(req, MAX_RAW_BODY_BYTES);
    } catch (e) {
      if (e && e.code === 'BODY_TOO_LARGE') return json(res, 413, { error: 'too_large' });
      return json(res, 400, { error: e.message });
    }
    let b;
    try { b = JSON.parse(raw); } catch (e) { return json(res, 400, { error: e.message }); }
    if (typeof b.markdown !== 'string') return json(res, 400, { error: 'invalid document' });
    if (b.markdown.length > MAX_DOCUMENT_CHARS) return json(res, 413, { error: 'too_large' });
    const currentRevision = computeRevision();
    if (typeof b.base_revision !== 'string' || b.base_revision !== currentRevision) {
      return json(res, 409, { error: 'conflict', current_revision: currentRevision });
    }
    if (ROOM) {
      // T-354-22c (J8 isolation): files ONLY through fileArtifact, the SAME
      // governed door artifact_file uses (354-05 realpath containment,
      // artifact_id, memory_event, claim node). b.section / b.path -- or any
      // other extra key a caller sends -- are never read: this server only
      // ever files into the ROOM and SECTION it was bound to at launch.
      const db = navigation.openRoomDbForCaller(ROOM);
      if (!db) return json(res, 500, { error: 'room_db_unavailable' });
      let result;
      try {
        result = viewsInternal.fileArtifact(db, ROOM, { section: SECTION, filename: 'workspace-poc.md', content: b.markdown });
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
      if (!result || result.ok !== true) {
        return json(res, 422, { error: (result && result.reason) || 'file_failed' });
      }
      return json(res, 200, {
        ok: true,
        revision: computeRevision(),
        markdown: fs.readFileSync(documentPath, 'utf8'),
        artifact_id: result.artifact_id,
      });
    }
    atomicWriteDocument(b.markdown);
    return json(res, 200, { ok: true, revision: computeRevision(), markdown: fs.readFileSync(documentPath, 'utf8') });
  }
  if (req.method === 'POST' && u.pathname === '/api/graph/ask') {
    if (!checkPostGuards(req, res)) return;
    try {
      const raw = await readBody(req, MAX_RAW_BODY_BYTES);
      const b = JSON.parse(raw);
      return json(res, 200, await graphAnswer(b.question));
    } catch (e) {
      if (e && e.code === 'BODY_TOO_LARGE') return json(res, 413, { error: 'too_large' });
      return json(res, 400, { error: e.message });
    }
  }
  applySecurityHeaders(res);
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, HOST, () => {
  const boundPort = server.address().port;
  ALLOWED_HOSTS = new Set(['127.0.0.1:' + boundPort, 'localhost:' + boundPort]);
  TOKEN = crypto.randomBytes(32).toString('hex');
  process.stdout.write(`MindrianOS localhost POC: http://${HOST}:${boundPort}/ (${ROOM ? `room: ${ROOM} section: ${SECTION}` : 'fixture mode'})\n`);
});
process.on('SIGINT', () => server.close(() => process.exit(0)));
