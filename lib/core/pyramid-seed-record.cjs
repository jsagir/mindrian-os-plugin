/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 389-05 -- pyramid-seed-record.
 *
 * The Seed record: one small JSON file per argument, plus the hand-off that
 * /mos:ignite --from-brief and /mos:new-project --from-brief read. It took
 * over the hand-off job of the retired option router (Phase 389 plan 08), so
 * that both commands work without it.
 *
 * Record contract (shared with plans 04 and 06):
 *   schema      "mos.pyramid-seed/1"
 *   id          8 lowercase hex characters (first 8 of the SHA-256 of the
 *               trimmed venture sentence, computed by the caller via idFor;
 *               the record never stores the sentence itself)
 *   created_at  ISO date text
 *   depth       "seed" or "full"
 *   situation, complication, question, answer
 *               non-empty strings, 400 characters or fewer
 *   support     2 to 5 objects { group: string of 120 or fewer,
 *               claims: 1 to 4 strings of 200 or fewer }
 *   objection   non-empty string, 300 characters or fewer
 *   evidence    array (may be empty) of { cell, status (ok, empty, error or
 *               timeout), summary_line (160 or fewer) }
 *   upgraded_from  optional, 8 lowercase hex
 *
 * Where it lives: <home>/.mindrian/pyramid-seed/briefs/<id>.json, mode 0600,
 * written through a temp name in the same folder and a rename.
 * Old side file: <home>/.mindrian/mva/briefs/<id>.json is still READ when no
 * Seed record exists. Nothing is ever written there.
 *
 * Reward note: a Seed receipt is shown the moment it is made, so
 * brief_reward_pending is false for a Seed record. An old side file only
 * exists after its brief was rendered, so it is false there too.
 *
 * Canon Part 8: the record holds the person's venture text. It stays on disk
 * in the person's home. This module requires no network client, no Brain
 * client and no room database.
 *
 * The home folder comes from opts.home or process.env.HOME, read at call
 * time, never at load time. Requiring this module has no side effect.
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const SCHEMA = 'mos.pyramid-seed/1';

// SHA8 validation: exactly 8 lowercase hex characters, no path separators,
// dots or spaces. T-155-04-01 mitigation (kept from the option router): reject
// any value that could build a path outside the briefs folder. Every path join
// in this module goes through this test first (T-389-05-01).
const SHA8_RE = /^[0-9a-f]{8}$/;

const DEPTHS = ['seed', 'full'];
const STATUSES = ['ok', 'empty', 'error', 'timeout'];
const DASH_RE = /[\u2013\u2014]/g;

const NO_BRIEF_MESSAGE =
  'No Seed record found. Run /mos:structure-argument first to make one.';

// ---------- paths ----------

function _home(opts) {
  if (opts && typeof opts.home === 'string' && opts.home.length > 0) return opts.home;
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function _seedDir(opts) {
  return path.join(_home(opts), '.mindrian', 'pyramid-seed', 'briefs');
}

function _legacyDir(opts) {
  return path.join(_home(opts), '.mindrian', 'mva', 'briefs');
}

function _legacyStatePath(opts) {
  return path.join(_home(opts), '.mindrian', 'mva', 'state.json');
}

// ---------- validation ----------

function _bad(code, field) {
  return { ok: false, code: code, field: field };
}

function _text(value, max) {
  // Returns null when fine, 'missing' or 'too_long' when not.
  if (typeof value !== 'string' || value.trim().length === 0) return 'missing';
  if (value.length > max) return 'too_long';
  return null;
}

const TOP_TEXT = [
  ['situation', 400],
  ['complication', 400],
  ['question', 400],
  ['answer', 400],
  ['objection', 300],
];

/**
 * validateRecord(record) -> { ok:true } | { ok:false, code, field }
 * Never throws. Codes: not_object, bad_schema, bad_id, bad_created_at,
 * bad_depth, missing_field, too_long, bad_support, bad_support_count,
 * bad_group, bad_claims_count, bad_claim, bad_evidence, bad_evidence_item,
 * bad_status, bad_upgraded_from.
 */
function validateRecord(record) {
  try {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      return _bad('not_object', 'record');
    }
    if (record.schema !== SCHEMA) return _bad('bad_schema', 'schema');
    if (typeof record.id !== 'string' || !SHA8_RE.test(record.id)) return _bad('bad_id', 'id');
    if (typeof record.created_at !== 'string' || Number.isNaN(Date.parse(record.created_at))) {
      return _bad('bad_created_at', 'created_at');
    }
    if (DEPTHS.indexOf(record.depth) === -1) return _bad('bad_depth', 'depth');

    for (const [name, max] of TOP_TEXT) {
      const r = _text(record[name], max);
      if (r) return _bad(r === 'missing' ? 'missing_field' : 'too_long', name);
    }

    if (!Array.isArray(record.support)) return _bad('bad_support', 'support');
    if (record.support.length < 2 || record.support.length > 5) {
      return _bad('bad_support_count', 'support');
    }
    for (let i = 0; i < record.support.length; i++) {
      const g = record.support[i];
      if (g === null || typeof g !== 'object' || Array.isArray(g)) {
        return _bad('bad_group', 'support[' + i + ']');
      }
      const gr = _text(g.group, 120);
      if (gr) return _bad(gr === 'missing' ? 'bad_group' : 'too_long', 'support[' + i + '].group');
      if (!Array.isArray(g.claims)) return _bad('bad_claims_count', 'support[' + i + '].claims');
      if (g.claims.length < 1 || g.claims.length > 4) {
        return _bad('bad_claims_count', 'support[' + i + '].claims');
      }
      for (let j = 0; j < g.claims.length; j++) {
        const cr = _text(g.claims[j], 200);
        if (cr) {
          return _bad(cr === 'missing' ? 'bad_claim' : 'too_long', 'support[' + i + '].claims[' + j + ']');
        }
      }
    }

    if (!Array.isArray(record.evidence)) return _bad('bad_evidence', 'evidence');
    for (let i = 0; i < record.evidence.length; i++) {
      const e = record.evidence[i];
      if (e === null || typeof e !== 'object' || Array.isArray(e)) {
        return _bad('bad_evidence_item', 'evidence[' + i + ']');
      }
      if (typeof e.cell !== 'string' || e.cell.trim().length === 0) {
        return _bad('bad_evidence_item', 'evidence[' + i + '].cell');
      }
      if (STATUSES.indexOf(e.status) === -1) return _bad('bad_status', 'evidence[' + i + '].status');
      if (typeof e.summary_line !== 'string') return _bad('bad_evidence_item', 'evidence[' + i + '].summary_line');
      if (e.summary_line.length > 160) return _bad('too_long', 'evidence[' + i + '].summary_line');
    }

    if (record.upgraded_from !== undefined) {
      if (typeof record.upgraded_from !== 'string' || !SHA8_RE.test(record.upgraded_from)) {
        return _bad('bad_upgraded_from', 'upgraded_from');
      }
    }
    return { ok: true };
  } catch (_err) {
    return _bad('not_object', 'record');
  }
}

// ---------- id ----------

/**
 * idFor(sentence) -> 8 lowercase hex | null
 * First 8 hex characters of the SHA-256 of the trimmed sentence.
 */
function idFor(sentence) {
  if (typeof sentence !== 'string') return null;
  const t = sentence.trim();
  if (t.length === 0) return null;
  return crypto.createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 8);
}

// ---------- write ----------

/**
 * writeRecord(record, opts) -> { ok:true, path } | { ok:false, reason, ... }
 * Validates, then writes through a temp name in the same folder and a rename.
 * The file mode is 0600. Writes only under <home>/.mindrian/pyramid-seed/briefs.
 */
function writeRecord(record, opts) {
  const v = validateRecord(record);
  if (!v.ok) return { ok: false, reason: 'invalid_record', code: v.code, field: v.field };
  const dir = _seedDir(opts);
  const target = path.join(dir, record.id + '.json');
  const tmp = path.join(dir, '.' + record.id + '.' + process.pid + '.' + Date.now() + '.tmp');
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, target);
    return { ok: true, path: target };
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_e) { /* no temp file to remove */ }
    return { ok: false, reason: 'write_error', message: String(err && err.message) };
  }
}

// ---------- read ----------

function _readJson(p) {
  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return { missing: true };
    return { error: true };
  }
  try {
    return { value: JSON.parse(text) };
  } catch (_err) {
    return { error: true };
  }
}

/**
 * readRecord(id, opts) ->
 *   { ok:true, record, source:'seed'|'legacy', path }
 *   | { ok:false, reason:'invalid_id'|'not_found'|'parse_error' }
 * The id is checked before any path is built. Never writes.
 */
function readRecord(id, opts) {
  if (typeof id !== 'string' || !SHA8_RE.test(id)) return { ok: false, reason: 'invalid_id' };

  const seedPath = path.join(_seedDir(opts), id + '.json');
  const s = _readJson(seedPath);
  if (!s.missing) {
    if (s.error) return { ok: false, reason: 'parse_error', source: 'seed' };
    if (!validateRecord(s.value).ok) return { ok: false, reason: 'parse_error', source: 'seed' };
    return { ok: true, record: s.value, source: 'seed', path: seedPath };
  }

  const legacyPath = path.join(_legacyDir(opts), id + '.json');
  const l = _readJson(legacyPath);
  if (l.missing) return { ok: false, reason: 'not_found' };
  if (l.error) return { ok: false, reason: 'parse_error', source: 'legacy' };
  return { ok: true, record: l.value, source: 'legacy', path: legacyPath };
}

/**
 * listRecords(opts) -> array of ids, newest first (by created_at).
 * Reads the Seed folder only. File names that are not valid ids are ignored.
 */
function listRecords(opts) {
  let names;
  try {
    names = fs.readdirSync(_seedDir(opts));
  } catch (_err) {
    return [];
  }
  const rows = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -5);
    if (!SHA8_RE.test(id)) continue;
    const j = _readJson(path.join(_seedDir(opts), name));
    let t = 0;
    if (j.value && typeof j.value.created_at === 'string') {
      const p = Date.parse(j.value.created_at);
      if (!Number.isNaN(p)) t = p;
    }
    rows.push({ id: id, t: t });
  }
  rows.sort((a, b) => (b.t - a.t) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return rows.map((r) => r.id);
}

// ---------- receipt ----------

function _one(s) {
  return String(s).replace(DASH_RE, '-').replace(/\s+/g, ' ').trim();
}

const MAX_EVIDENCE_LINES = 10;

/**
 * renderReceipt(record) -> string
 * The conversation receipt: title, the answer first, the support groups in
 * order, the strongest objection, then outside evidence (only when an entry
 * has status ok). Deterministic, 60 lines or fewer, no em dash or en dash.
 */
function renderReceipt(record) {
  const lines = [];
  lines.push('Your argument, answer first');
  lines.push('Answer: ' + _one(record.answer));
  lines.push('');
  lines.push('Why, in order:');
  const support = Array.isArray(record.support) ? record.support : [];
  support.forEach((g, i) => {
    lines.push((i + 1) + '. ' + _one(g.group));
    (Array.isArray(g.claims) ? g.claims : []).forEach((c) => {
      lines.push('   - ' + _one(c));
    });
  });
  lines.push('');
  lines.push('Strongest objection: ' + _one(record.objection));
  const ok = (Array.isArray(record.evidence) ? record.evidence : []).filter(
    (e) => e && e.status === 'ok'
  );
  if (ok.length > 0) {
    lines.push('');
    lines.push('Outside evidence:');
    ok.slice(0, MAX_EVIDENCE_LINES).forEach((e) => {
      lines.push(
        '- ' + _one(e.cell) + ': outside evidence, quoted: "' + _one(e.summary_line) + '"'
      );
    });
  }
  return lines.join('\n');
}

// ---------- hand-off ----------

function _resolveNewestId(opts) {
  const ids = listRecords(opts);
  if (ids.length > 0) return ids[0];
  // Older side file: the state manifest names the latest brief. Read-only.
  const j = _readJson(_legacyStatePath(opts));
  if (j.value && typeof j.value.current_sha8 === 'string' && j.value.current_sha8.length > 0) {
    return j.value.current_sha8;
  }
  return null;
}

/**
 * resolveFromBrief(idInput, opts) -> the hand-off shape the old option router used:
 *   { action: 'ignite_from_brief' | 'no_brief_available' | 'brief_parse_error',
 *     sha8?, brief_content?, canon_verb: 8, invoke_command?, message?,
 *     brief_reward_pending? }
 * With null, the newest Seed record is used; with none, the older state
 * manifest is tried (read-only).
 */
function resolveFromBrief(idInput, opts) {
  let id = idInput;
  if (typeof id !== 'string' || id.length === 0 || id === 'null') {
    id = _resolveNewestId(opts);
  }

  if (typeof id !== 'string' || !SHA8_RE.test(id)) {
    return {
      action: 'no_brief_available',
      canon_verb: 8,
      message: NO_BRIEF_MESSAGE,
      error: id && typeof id === 'string' ? 'invalid_sha8' : undefined,
    };
  }

  const r = readRecord(id, opts);
  if (!r.ok && r.reason === 'not_found') {
    return { action: 'no_brief_available', canon_verb: 8, message: NO_BRIEF_MESSAGE };
  }
  if (!r.ok) {
    return {
      action: 'brief_parse_error',
      canon_verb: 8,
      sha8: id,
      message: 'Brief file for ' + id + ' is malformed. Run /mos:structure-argument again to regenerate it.',
    };
  }

  let content = r.record;
  if (r.source === 'seed') {
    content = Object.assign({}, r.record, { receipt: renderReceipt(r.record) });
  }
  return {
    action: 'ignite_from_brief',
    sha8: id,
    brief_content: content,
    canon_verb: 8,
    invoke_command: '/mos:ignite --from-brief ' + id,
    brief_reward_pending: false,
  };
}

module.exports = {
  SCHEMA,
  SHA8_RE,
  validateRecord,
  idFor,
  writeRecord,
  readRecord,
  listRecords,
  resolveFromBrief,
  renderReceipt,
};
