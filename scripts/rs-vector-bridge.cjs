#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 296 Plan 03 (SEED-030) -- scripts/rs-vector-bridge.cjs, the D-02 answer.
 *
 * This is the D-02 answer (296-CONTEXT.md REVISION, locked by 296-RESEARCH.md
 * F-2, HIGH, highest-risk). room.db carries ONE of TWO vector tables, chosen
 * by a RUNTIME CAPABILITY PROBE inside lib/core/eureka/vector-store.cjs:
 *
 *   eureka_vec           a vec0 virtual table, when the sqlite-vec extension
 *                        loads on this handle
 *   eureka_vec_fallback  a plain BLOB table, when it does not
 *
 * Only CJS knows which one is live for a given room -- the probe result is
 * process-latched inside vector-store.cjs and is never exposed as a fact
 * Python could infer some other way. `sqlite-vec` is a hard `dependencies`
 * entry in package.json (not `optionalDependencies`), so it IS installed on
 * every real user machine and IS ABSENT from this dev checkout. That inverts
 * the usual dev-vs-prod risk: a direct Python `sqlite3` SELECT against
 * `eureka_vec` PASSES in this checkout (fallback table active, plain BLOBs,
 * a plain Python reader can read it) and THROWS `OperationalError: no such
 * module: vec0` on every real user's machine, live-verified this session
 * (296-RESEARCH.md F-2). A verification step that only ever runs in this
 * checkout would go green on code that is broken for every real user.
 *
 * This file exists so that read can never be attempted from Python at all:
 * it is the ONE CJS entry point every vector operation the Python side needs
 * goes through, over a JSON stdio protocol, mirroring the shape of the
 * existing mirror-image handoff (lib/core/rs-pinecone-bridge.cjs, which
 * shells `python3` from CJS today, in the opposite direction).
 *
 * Protocol: read ONE JSON envelope from stdin to end of stream, write ONE
 * JSON envelope to stdout, ALWAYS exit 0. Never throw across the process
 * boundary -- the Python caller on the far side treats a failure as data,
 * never as an exception it has to catch.
 *
 * Ops: embed | knn | meta. See --help for request/response shapes.
 *
 * Stable error tags (byte-locked once shipped -- downstream Python string-
 * matches them): bad_op, bad_stdin, bad_room, bad_texts, bad_query,
 * encoder_unavailable, embed_failed, room_open_failed, store_unavailable,
 * knn_failed.
 *
 * Reuse discipline (Canon Part 7 -- nothing new is built here):
 *   - Text -> vector goes through embedding-spine.cjs::embedTexts ONLY.
 *     embedTexts owns the model-load singleton, batch sizing, cache-dir
 *     resolution and the first-run download notice. This file never
 *     requires @huggingface/transformers and never constructs a second
 *     ONNX feature-extraction pipeline -- that is an explicit anti-pattern
 *     (lib/core/rs-engine.cjs:31-35) and a tens-of-megabytes-per-process
 *     memory bug.
 *   - room.db is opened ONLY through lib/core/room-db.cjs::openRoomDb, with
 *     `allowExtension: true`. That option is REQUIRED, not cosmetic:
 *     vector-store.cjs's header states that on a plain handle the
 *     sqlite-vec leg silently degrades to the CJS cosine fallback, which
 *     would make this bridge report 'cjs-fallback' on a machine that
 *     actually HAS sqlite-vec and mask the very divergence this file exists
 *     to prevent. This file never constructs the native sqlite handle
 *     class directly -- openRoomDb owns WAL, `synchronous`, `foreign_keys`,
 *     `timeout: 5000` and the migration chain.
 *   - Backend selection happens ONLY inside vector-store.cjs::ensureStore.
 *     This file never requires 'sqlite-vec' and never reads an extension
 *     path from the environment -- vector-store.cjs loads the extension
 *     only from require('sqlite-vec').getLoadablePath() (the T-211-03
 *     mitigation), and duplicating that load here would reopen it.
 *
 * Write boundary (Canon Part 9): this bridge writes NOTHING. It only reads
 * the eureka_vec / eureka_vec_fallback / eureka_meta projections through
 * vector-store.cjs, which documents them as rebuildable derived projections
 * carrying zero typed edges, zero memory_event rows and zero node
 * mutations. `ensureStore` may create a table on first call; that is table
 * creation for a derived projection, inside the module that already owns
 * it, not a graph write.
 *
 * Transaction discipline (Pitfall 8): this bridge never opens a write
 * transaction. The `embed` op touches no database at all; `knn` and `meta`
 * only read. Holding a write transaction across an `await` (a model forward
 * pass) would lock room.db for the duration -- avoided here by construction
 * because there is no write to begin with.
 *
 * Egress: zero network. No fetch, no node:http, no node:https, no
 * brain-client. Every `detail` string is bounded to 500 characters and
 * never echoes an environment variable value, matching the scrubSecret
 * discipline recorded as T-272-11.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

// ---------- constants ----------

const MAX_DETAIL_CHARS = 500;
const DEFAULT_K = 10;
const MIN_K = 1;
const MAX_K = 1000;

const HELP_TEXT = [
  'rs-vector-bridge.cjs -- the D-02 CJS-to-Python vector bridge (296-RESEARCH.md F-2)',
  '',
  'Protocol: one JSON envelope on stdin, one JSON envelope on stdout, always exit 0.',
  '',
  'Usage:',
  '  echo \'<request JSON>\' | node scripts/rs-vector-bridge.cjs <op>',
  '',
  'Ops:',
  '',
  '  embed',
  '    request  {"texts": string[]}',
  '    success  {"success":true,"vectors":number[][],"provenance":object,"dim":number}',
  '    failure  {"success":false,"error":"bad_texts"|"encoder_unavailable"|"embed_failed","detail":string}',
  '',
  '  knn',
  '    request  {"room": string, "query": number[], "k"?: number}   (k clamps to 1..1000, default 10)',
  '    success  {"success":true,"backend":"sqlite-vec"|"cjs-fallback","meta":object,"dim":number,"hits":[{"node_id":string,"score":number}]}',
  '    failure  {"success":false,"error":"bad_room"|"bad_query"|"room_open_failed"|"store_unavailable"|"knn_failed","detail":string}',
  '',
  '  meta',
  '    request  {"room": string}',
  '    success  {"success":true,"backend":"sqlite-vec"|"cjs-fallback","meta":object,"dim":number}',
  '    failure  {"success":false,"error":"bad_room"|"room_open_failed"|"store_unavailable","detail":string}',
  '',
  'Every failure path returns a structured envelope with exit code 0. Nothing throws',
  'across the process boundary.',
  '',
].join('\n');

// ---------- helpers ----------

function boundedDetail(value) {
  if (value === undefined || value === null) return '';
  const s = String(value);
  return s.length > MAX_DETAIL_CHARS ? s.slice(0, MAX_DETAIL_CHARS) : s;
}

function writeEnvelope(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function readStdin() {
  return new Promise(function (resolve) {
    let data = '';
    try {
      process.stdin.setEncoding('utf8');
    } catch (_e) { /* non-tty stdin without setEncoding support; tolerate */ }
    process.stdin.on('data', function (chunk) { data += chunk; });
    process.stdin.on('end', function () { resolve(data); });
    process.stdin.on('error', function () { resolve(data); });
  });
}

function parseRequest(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false };
    }
    return { ok: true, value: parsed };
  } catch (_e) {
    return { ok: false };
  }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isFiniteNumberArray(v) {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (let i = 0; i < v.length; i += 1) {
    if (typeof v[i] !== 'number' || !Number.isFinite(v[i])) return false;
  }
  return true;
}

function clampK(raw) {
  const n = Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_K;
  if (n < MIN_K) return MIN_K;
  if (n > MAX_K) return MAX_K;
  return n;
}

// openRoom: the ONLY place this file opens room.db. allowExtension:true is
// REQUIRED so ensureStore's probe can actually register sqlite-vec on this
// handle rather than silently degrading to cjs-fallback (see header).
// Never throws: openRoomDb's own throw paths (RoomDbBusyError,
// RoomDbBrokenError, or a bare mkdirSync/native-handle-construction failure
// on an unwritable/nonexistent room path) are caught here and turned into a
// structured room_open_failed envelope.
function openRoom(room) {
  try {
    const db = openRoomDb(room, { allowExtension: true });
    return { ok: true, db: db };
  } catch (err) {
    return { ok: false, detail: boundedDetail(err && err.message) };
  }
}

// ---------- op: embed ----------

async function opEmbed(req) {
  const texts = req.texts;
  if (!Array.isArray(texts) || texts.length === 0) {
    return { success: false, error: 'bad_texts' };
  }

  let embeddingSpine;
  try {
    // eslint-disable-next-line global-require
    embeddingSpine = require('../lib/core/eureka/embedding-spine.cjs');
  } catch (err) {
    return { success: false, error: 'encoder_unavailable', detail: boundedDetail(err && err.message) };
  }

  let result;
  try {
    result = await embeddingSpine.embedTexts(texts);
  } catch (err) {
    // embedTexts is documented never-throws; this is defense-in-depth only.
    return { success: false, error: 'embed_failed', detail: boundedDetail(err && err.message) };
  }

  if (!result || result.success !== true) {
    const tag = (result && typeof result.error === 'string') ? result.error : 'embed_failed';
    return { success: false, error: tag, detail: boundedDetail(result && result.detail) };
  }

  return {
    success: true,
    vectors: result.vectors,
    provenance: embeddingSpine.encoderProvenance(),
    dim: embeddingSpine.resolveDim(),
  };
}

// ---------- op: knn ----------

function opKnn(req) {
  if (!isNonEmptyString(req.room)) return { success: false, error: 'bad_room' };
  if (!isFiniteNumberArray(req.query)) return { success: false, error: 'bad_query' };
  const k = clampK(req.k);

  const opened = openRoom(req.room);
  if (!opened.ok) {
    return { success: false, error: 'room_open_failed', detail: opened.detail };
  }
  const db = opened.db;

  try {
    let vectorStore;
    try {
      // eslint-disable-next-line global-require
      vectorStore = require('../lib/core/eureka/vector-store.cjs');
    } catch (err) {
      return { success: false, error: 'store_unavailable', detail: boundedDetail(err && err.message) };
    }

    let dim;
    try {
      // eslint-disable-next-line global-require
      dim = require('../lib/core/eureka/embedding-spine.cjs').resolveDim();
    } catch (_e) {
      dim = undefined; // ensureStore falls back to its own resolveWidth on undefined
    }

    let ensured;
    try {
      ensured = vectorStore.ensureStore(db, dim);
    } catch (err) {
      return { success: false, error: 'store_unavailable', detail: boundedDetail(err && err.message) };
    }

    const meta = vectorStore.readMeta(db);

    let hits;
    try {
      hits = vectorStore.knnQuery(db, req.query, k);
    } catch (err) {
      return { success: false, error: 'knn_failed', detail: boundedDetail(err && err.message) };
    }

    return { success: true, backend: ensured.backend, meta: meta, dim: ensured.dim, hits: hits };
  } finally {
    // Guarded so a close failure can never turn into a throw across the
    // process boundary.
    try { closeRoomDb(db); } catch (_e) { /* already closed; ignore */ }
  }
}

// ---------- op: meta ----------

function opMeta(req) {
  if (!isNonEmptyString(req.room)) return { success: false, error: 'bad_room' };

  const opened = openRoom(req.room);
  if (!opened.ok) {
    return { success: false, error: 'room_open_failed', detail: opened.detail };
  }
  const db = opened.db;

  try {
    let vectorStore;
    try {
      // eslint-disable-next-line global-require
      vectorStore = require('../lib/core/eureka/vector-store.cjs');
    } catch (err) {
      return { success: false, error: 'store_unavailable', detail: boundedDetail(err && err.message) };
    }

    let dim;
    try {
      // eslint-disable-next-line global-require
      dim = require('../lib/core/eureka/embedding-spine.cjs').resolveDim();
    } catch (_e) {
      dim = undefined;
    }

    let ensured;
    try {
      ensured = vectorStore.ensureStore(db, dim);
    } catch (err) {
      return { success: false, error: 'store_unavailable', detail: boundedDetail(err && err.message) };
    }

    const meta = vectorStore.readMeta(db);
    return { success: true, backend: ensured.backend, meta: meta, dim: ensured.dim };
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* already closed; ignore */ }
  }
}

// ---------- router ----------
//
// A plain switch-case on process.argv[2]. No Commander, no yargs, matching
// this repo's other scripts/*-command.cjs entry points (e.g.
// scripts/rs-experts-command.cjs).

async function main() {
  const op = process.argv[2];

  if (op === '--help' || op === '-h') {
    process.stdout.write(HELP_TEXT);
    process.exitCode = 0;
    return;
  }

  if (op !== 'embed' && op !== 'knn' && op !== 'meta') {
    writeEnvelope({ success: false, error: 'bad_op', detail: boundedDetail(op) });
    process.exitCode = 0;
    return;
  }

  const raw = await readStdin();
  const parsed = parseRequest(raw);
  if (!parsed.ok) {
    writeEnvelope({ success: false, error: 'bad_stdin' });
    process.exitCode = 0;
    return;
  }
  const req = parsed.value;

  let result;
  try {
    if (op === 'embed') {
      result = await opEmbed(req);
    } else if (op === 'knn') {
      result = opKnn(req);
    } else {
      result = opMeta(req);
    }
  } catch (err) {
    // Defense-in-depth: every op above is written to return, not throw. This
    // catch is the last line of the never-throw-across-the-boundary contract.
    result = { success: false, error: 'bridge_error', detail: boundedDetail(err && err.message) };
  }

  writeEnvelope(result);
  process.exitCode = 0;
}

// Guard CLI execution so require()-ing this file (e.g. from a test that
// wants the _test seams) never triggers stdin consumption or a stdout
// write as a side effect. Mirrors scripts/rs-experts-command.cjs and
// scripts/entity-extract.cjs's identical require.main === module idiom.
if (require.main === module) {
  main().catch(function (err) {
    // main() itself is written to never reject; this is the outermost
    // never-throw-across-the-boundary guard so an unhandled rejection can
    // never surface as a nonzero exit or a Node stack trace on stderr.
    try {
      writeEnvelope({ success: false, error: 'bridge_error', detail: boundedDetail(err && err.message) });
    } catch (_e) { /* stdout itself failed; nothing left to do */ }
    process.exitCode = 0;
  });
}

module.exports = {
  _test: {
    boundedDetail: boundedDetail,
    parseRequest: parseRequest,
    isNonEmptyString: isNonEmptyString,
    isFiniteNumberArray: isFiniteNumberArray,
    clampK: clampK,
    opEmbed: opEmbed,
    opKnn: opKnn,
    opMeta: opMeta,
  },
};
