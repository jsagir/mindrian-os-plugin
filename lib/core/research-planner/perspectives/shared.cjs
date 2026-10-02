'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 08 (D-06): the helpers every research-planner perspective
 * shares, lifted out of eureka-recall.cjs so there is one copy.
 *
 *   text and token helpers   parseProps, textOfProps, hasFieldTitle, titleOfProps, tokenize, jaccard, pairKey
 *   run-file helpers         runTagNow, writeJsonl (atomic), readJsonl, STAGES, deriveStatus, runDirFor
 *   the contract helpers     makeCandidateStore, writeRunFiles, readCandidates
 *
 * makeCandidateStore is THE exclusion-set upsert (ADR-E14): a pair the room
 * already connects, or already holds as the evidence of an opportunity, is
 * dropped and counted, for every perspective, in one place. A perspective adds
 * its own score keys through `extra.fields` and never rebuilds the check.
 *
 * Nothing here touches room.db, the network or a model. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const STOPWORDS = Object.freeze(new Set(('the a an and or but of to in on for with by at from as is are was were be been this that these those it its into over under about ' +
  'we our you your they their he she his her not no yes can could would should will may might must do does did done have has had having than then there here where when ' +
  'which what who whom why how all any each some more most other such only own same so too very just also via per within without between across through during before after ' +
  'above below up down out off again further once because while if else both few many much new one two three first second last next').split(/\s+/)));

// ---------------------------------------------------------------------------
// text and token helpers
// ---------------------------------------------------------------------------
function parseProps(raw) {
  if (raw && typeof raw === 'object') return raw;
  try { const o = JSON.parse(String(raw || '{}')); return (o && typeof o === 'object') ? o : {}; } catch (_e) { return {}; }
}

function textOfProps(p, cap) {
  const parts = [];
  ['title', 'name', 'label', 'text', 'summary', 'body', 'content', 'excerpt'].forEach(function (k) {
    if (typeof p[k] === 'string' && p[k].trim()) parts.push(p[k].trim());
  });
  return parts.join('\n').slice(0, cap);
}

// hasFieldTitle(p) -> true when title, name or label is a real field, so the
// title is a name someone gave the thing, not a first sentence of its text.
function hasFieldTitle(p) {
  return ['title', 'name', 'label'].some(function (k) { return typeof p[k] === 'string' && p[k].trim().length > 0; });
}

function titleOfProps(p, id) {
  for (const k of ['title', 'name', 'label']) if (typeof p[k] === 'string' && p[k].trim()) return p[k].trim();
  if (typeof p.text === 'string' && p.text.trim()) return p.text.trim().split('\n')[0].slice(0, 120);
  return String(id);
}

function tokenize(text) {
  const out = new Set();
  String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).forEach(function (t) {
    if (t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t)) out.add(t);
  });
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function pairKey(a, b) { return a < b ? a + '\u0000' + b : b + '\u0000' + a; }

// ---------------------------------------------------------------------------
// run files (edit surfaces) and STATUS.md (derived)
// ---------------------------------------------------------------------------
function runTagNow(now) {
  const d = now ? new Date(now) : new Date();
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

// runDirFor(roomDir, runRoot, tag): runRoot is relative to the room, e.g.
// .mindrian/eureka-perspective or .mindrian/perspectives/<id>.
function runDirFor(roomDir, runRoot, tag) { return path.join(roomDir, runRoot, tag); }

function writeJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, rows.map(function (r) { return JSON.stringify(r); }).join('\n') + (rows.length ? '\n' : ''));
  fs.renameSync(tmp, file);
}

function readJsonl(file) {
  let raw = '';
  try { raw = fs.readFileSync(file, 'utf8'); } catch (_e) { return null; }
  return raw.split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (_e) { return null; } }).filter(Boolean);
}

const STAGES = Object.freeze([
  ['01_substrate', 'things.jsonl'],
  ['02_recall', 'candidates.jsonl'],
  ['03_judge', 'verdicts.jsonl'],
  ['04_plan', 'plan.json'],
]);

const DEFAULT_STATUS_TITLE = 'Eureka perspective run';

function deriveStatus(runDir, title) {
  const lines = ['# ' + (title || DEFAULT_STATUS_TITLE), '', 'Derived from which output files exist. Never hand-edit.', ''];
  const state = {};
  STAGES.forEach(function (s) {
    const f = path.join(runDir, s[0], 'output', s[1]);
    let n = null;
    try { n = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length; } catch (_e) { n = null; }
    state[s[0]] = n === null ? 'absent' : 'present';
    lines.push('- ' + s[0] + ': ' + (n === null ? 'absent' : ('present (' + n + ' lines)')));
  });
  const done = STAGES.filter(function (s) { return state[s[0]] === 'present'; }).map(function (s) { return s[0]; });
  lines.push('', 'stage: ' + (done.length ? done[done.length - 1] : 'none'));
  fs.writeFileSync(path.join(runDir, 'STATUS.md'), lines.join('\n') + '\n');
  return state;
}

// ---------------------------------------------------------------------------
// the contract helpers
// ---------------------------------------------------------------------------
/**
 * makeCandidateStore(substrate) -> { upsert, get, rows, size, excludedKnown }
 *
 * upsert(a, b, lane, extra) -> true only when it CREATED a new row.
 *   - skips a === b, a missing thing, a same-section pair (returns false, counts nothing);
 *   - a pair in substrate.connected or substrate.opp_pairs is excluded: the
 *     excluded counter goes up and nothing is added (returns false);
 *   - otherwise creates the row (ordered by id) with keys a, b, section_a,
 *     section_b, title_a, title_b, lanes [], lexical 0, shared_entities [];
 *   - unions the lane, keeps the larger extra.lexical, adds extra.entity once;
 *   - Object.assigns extra.fields (perspective score keys such as lag_score,
 *     divergence, direction, canon_a, canon_b, zone_id) onto the row.
 */
function makeCandidateStore(substrate) {
  const byId = {};
  substrate.things.forEach(function (t) { byId[t.id] = t; });
  const cands = new Map();
  let excluded = 0;

  function upsert(a, b, lane, extra) {
    if (a === b) return false;
    const ta = byId[a]; const tb = byId[b];
    if (!ta || !tb || ta.section === tb.section) return false;
    const k = pairKey(a, b);
    if (substrate.connected.has(k) || substrate.opp_pairs.has(k)) { excluded += 1; return false; }
    let created = false;
    if (!cands.has(k)) {
      const first = a < b ? ta : tb; const second = a < b ? tb : ta;
      cands.set(k, { a: first.id, b: second.id, section_a: first.section, section_b: second.section, title_a: first.title, title_b: second.title, lanes: [], lexical: 0, shared_entities: [] });
      created = true;
    }
    const c = cands.get(k);
    if (lane && c.lanes.indexOf(lane) === -1) c.lanes.push(lane);
    if (extra && typeof extra.lexical === 'number' && extra.lexical > c.lexical) c.lexical = extra.lexical;
    if (extra && extra.entity && c.shared_entities.indexOf(extra.entity) === -1) c.shared_entities.push(extra.entity);
    if (extra && extra.fields && typeof extra.fields === 'object') Object.assign(c, extra.fields);
    return created;
  }

  return {
    upsert: upsert,
    get: function (a, b) { return cands.get(pairKey(a, b)) || null; },
    rows: function () { return Array.from(cands.values()); },
    size: function () { return cands.size; },
    excludedKnown: function () { return excluded; },
  };
}

/**
 * writeRunFiles(roomDir, runRoot, tag, substrate, recall, opts) -> run dir
 *   opts = { title, lanes, header_extra }
 * things.jsonl row shape and the candidates.jsonl header key order are the
 * eureka ones, byte for byte (the golden pins them).
 */
function writeRunFiles(roomDir, runRoot, tag, substrate, recall, opts) {
  const o = opts || {};
  const dir = runDirFor(roomDir, runRoot, tag);
  const things = substrate.things.map(function (t) { return { id: t.id, type: t.type, section: t.section, title: t.title, degree: t.degree, chars: t.text.length, canon_handle: t.canon_handle }; });
  writeJsonl(path.join(dir, '01_substrate', 'output', 'things.jsonl'), things);
  const header = { header: true, counts: recall.counts, pairs_truncated: recall.pairs_truncated, couplings: recall.couplings, lanes: o.lanes };
  if (o.header_extra && typeof o.header_extra === 'object') Object.assign(header, o.header_extra);
  writeJsonl(path.join(dir, '02_recall', 'output', 'candidates.jsonl'), [header].concat(recall.candidates));
  deriveStatus(dir, o.title);
  return dir;
}

function readCandidates(roomDir, runRoot, tag) {
  const rows = readJsonl(path.join(runDirFor(roomDir, runRoot, tag), '02_recall', 'output', 'candidates.jsonl'));
  if (!rows) return null;
  const header = rows.filter(function (r) { return r.header === true; })[0] || null;
  return { header: header, candidates: rows.filter(function (r) { return r.header !== true; }) };
}

module.exports = {
  STOPWORDS: STOPWORDS,
  STAGES: STAGES,
  DEFAULT_STATUS_TITLE: DEFAULT_STATUS_TITLE,
  parseProps: parseProps,
  textOfProps: textOfProps,
  hasFieldTitle: hasFieldTitle,
  titleOfProps: titleOfProps,
  tokenize: tokenize,
  jaccard: jaccard,
  pairKey: pairKey,
  runTagNow: runTagNow,
  runDirFor: runDirFor,
  writeJsonl: writeJsonl,
  readJsonl: readJsonl,
  deriveStatus: deriveStatus,
  makeCandidateStore: makeCandidateStore,
  writeRunFiles: writeRunFiles,
  readCandidates: readCandidates,
};
