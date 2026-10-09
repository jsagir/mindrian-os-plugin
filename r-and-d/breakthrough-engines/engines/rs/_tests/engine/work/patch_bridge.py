import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
def rep(o, n, c=1):
    global s
    assert s.count(o) == c, (s.count(o), o[:80])
    s = s.replace(o, n)

rep(""" * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
""", """ * 2026 hardening (protocol, tags and exit code unchanged):
 *   - room-db.cjs is required lazily, inside openRoom. The top-level require
 *     used to run on EVERY op, so an `embed` request (which never touches a
 *     database) crashed with a stack trace and a non-zero exit when room-db
 *     could not load, breaking the "ALWAYS exit 0, never throw" contract.
 *   - stdin is bounded (MAX_STDIN_BYTES) and `embed` texts are validated
 *     (every entry a string, at most MAX_TEXTS) before any model work.
 *   - `knn` rejects a query whose length differs from the store dimension
 *     with bad_query instead of passing a mismatched vector to the store.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */
""")
rep("""const MAX_DETAIL_CHARS = 500;""", """const MAX_DETAIL_CHARS = 500;
const MAX_STDIN_BYTES = 64 * 1024 * 1024;
const MAX_TEXTS = 10000;""")
rep("""function readStdin() {
  return new Promise(function (resolve) {
    let data = '';
    try {
      process.stdin.setEncoding('utf8');
    } catch (_e) { /* non-tty stdin without setEncoding support; tolerate */ }
    process.stdin.on('data', function (chunk) { data += chunk; });
    process.stdin.on('end', function () { resolve(data); });
    process.stdin.on('error', function () { resolve(data); });
  });
}""", """function readStdin() {
  return new Promise(function (resolve) {
    let data = '';
    let size = 0;
    let tooBig = false;
    try {
      process.stdin.setEncoding('utf8');
    } catch (_e) { /* non-tty stdin without setEncoding support; tolerate */ }
    process.stdin.on('data', function (chunk) {
      if (tooBig) return;
      size += Buffer.byteLength(chunk);
      if (size > MAX_STDIN_BYTES) { tooBig = true; data = ''; return; }
      data += chunk;
    });
    // An oversized or errored stream resolves to '' / partial data, which
    // parseRequest turns into the stable bad_stdin envelope.
    process.stdin.on('end', function () { resolve(tooBig ? '' : data); });
    process.stdin.on('error', function () { resolve(tooBig ? '' : data); });
  });
}""")
rep("""function openRoom(room) {
  try {
    const db = openRoomDb(room, { allowExtension: true });
    return { ok: true, db: db };
  } catch (err) {
    return { ok: false, detail: boundedDetail(err && err.message) };
  }
}""", """function openRoom(room) {
  try {
    // 2026: lazy, so ops that never open a database do not depend on it.
    // eslint-disable-next-line global-require
    const roomDb = require('../lib/core/room-db.cjs');
    const db = roomDb.openRoomDb(room, { allowExtension: true });
    return { ok: true, db: db, close: roomDb.closeRoomDb };
  } catch (err) {
    return { ok: false, detail: boundedDetail(err && err.message) };
  }
}""")
rep("""  const texts = req.texts;
  if (!Array.isArray(texts) || texts.length === 0) {
    return { success: false, error: 'bad_texts' };
  }
""", """  const texts = req.texts;
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS) {
    return { success: false, error: 'bad_texts', detail: texts && texts.length > MAX_TEXTS ? 'too many texts (max ' + MAX_TEXTS + ')' : undefined };
  }
  for (let i = 0; i < texts.length; i += 1) {
    if (typeof texts[i] !== 'string') {
      return { success: false, error: 'bad_texts', detail: 'texts[' + i + '] is not a string' };
    }
  }
""")
# knn: dimension check + close via opened.close
rep("""    const meta = vectorStore.readMeta(db);

    let hits;
    try {
      hits = vectorStore.knnQuery(db, req.query, k);""", """    const meta = vectorStore.readMeta(db);

    if (Number.isInteger(ensured.dim) && ensured.dim > 0 && req.query.length !== ensured.dim) {
      return { success: false, error: 'bad_query',
        detail: boundedDetail('query length ' + req.query.length + ' does not match store dimension ' + ensured.dim) };
    }

    let hits;
    try {
      hits = vectorStore.knnQuery(db, req.query, k);""")
rep("""    try { closeRoomDb(db); } catch (_e) { /* already closed; ignore */ }
  }
}

// ---------- op: meta ----------""", """    try { opened.close(db); } catch (_e) { /* already closed; ignore */ }
  }
}

// ---------- op: meta ----------""")
rep("""    try { closeRoomDb(db); } catch (_e) { /* already closed; ignore */ }
  }
}

// ---------- router ----------""", """    try { opened.close(db); } catch (_e) { /* already closed; ignore */ }
  }
}

// ---------- router ----------""")
rep("""    clampK: clampK,""", """    clampK: clampK,
    MAX_TEXTS: MAX_TEXTS,
    MAX_STDIN_BYTES: MAX_STDIN_BYTES,""")
open(out, "w", encoding="utf-8").write(s)
print("ok")
