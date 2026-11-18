'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 08 -- the Part 8 problem-shape packet: one builder, one
 * validator (392-SC3 second half).
 *
 * WHAT THIS IS
 *   Part 8 changes from "filter the free text we send to the Brain" to "send
 *   only a closed-vocabulary problem shape plus the generic question; never
 *   raw room text". This module is the shape half of that contract. It emits
 *   one packet of six keys (SHAPE_KEYS) whose every member is an enum member
 *   of data/brain-shape-vocabulary.json, and it validates a packet by exact
 *   membership. No member is a bare string, so no room text can travel inside
 *   the shape.
 *
 * THE STANDING RULE (392-CONTEXT.md)
 *   The shape is never built by the model: ONE builder, from the BOUND ROOM,
 *   in the process that owns the session binding. buildShapePacket reads the
 *   room directory it is given and nothing else. Any other argument (a
 *   model-supplied `shape`, a `problem_type`, a `question`) is NOT read; the
 *   result reports `ignored_input: true` and the names of the ignored keys.
 *
 * D-01 (stage)
 *   The stage wire ids are Theo's six Phase ids (Phase0..Phase5). The room's
 *   STATE.md `venture_stage` (lib/core/model-profiles.cjs VALID_STAGES) maps
 *   through the ONE table vocabulary.stage_map. A missing or unknown value is
 *   Phase0 (Orientation): Phase0 is reached only this way.
 *
 * D-02 (domain_tag, constraint_categories)
 *   domain_tag is exactly the 11 eureka_critic tags; the STATE.md frontmatter
 *   key `domain`, `industry` or `sector` (first present) is matched by exact
 *   lowercase membership, else `unknown`. constraint_categories are the nine
 *   D-02 members; each entry of the STATE.md `constraints` and `blockers`
 *   lists is matched through the closed vocabulary.constraint_keyword_map
 *   (whole-word, lowercase), deduplicated, in vocabulary order, at most 5.
 *   The entry text itself never leaves this function.
 *
 * SOURCES REUSED (beta.81 anchors)
 *   problem_type: .mindrian/jtbd-state.json goal.rung (the same read as
 *   lib/core/brain-derivation.cjs readRoomRung, :414-415, which is not
 *   exported), accepted only when rung-vocabulary isTheoRung; else
 *   brain-derivation classifyProblemType over the Phase 88 triple read by
 *   lib/core/folder-memory.cjs readTriple (STATE.md + MINTO.md). When the
 *   room has no MINTO.md, the four reasoning scalars classifyProblemType
 *   reads (governing_thought existence, mece_status, arguments_count,
 *   evidence_density) are taken from the STATE.md frontmatter instead. The
 *   UDP/IDP/WDP result maps to a Theo rung id through
 *   vocabulary.problem_type_aliases.
 *   role: lib/core/user-md-ops.cjs readUserMd role_blend, argmax over the
 *   seven axes; a tie falls back to canonical_role through
 *   vocabulary.role_map; a missing or unparseable USER.md, or no winner, gives
 *   vocabulary.role_default. readUserMd is called with ignoreOverride so the
 *   navigator's synthetic persona override never writes the packet.
 *
 * THEO'S TWIN (Phase 48 T1)
 *   /home/jsagi/Theo/src/mcp/content/shape-packet.ts seals the same packet:
 *   z.strictObject, schema_version literal 1, five enums,
 *   constraint_categories 0..5 distinct. Theo validates and never repairs.
 *   validateShapePacket here is the same contract on this side of the wire:
 *   no default, no coercion, no trimming, every refusal typed with the field
 *   and the accepted member list. The drift test
 *   (tests/test-396-vocabulary-drift.cjs) keeps both repos on one list.
 *
 * PATTERN
 *   lib/core/eureka-critic.cjs loadCriticTags / validateCriticPayload: closed
 *   keys, closed enums, typed refusal, the registry read relative to THIS
 *   module and frozen once.
 *
 * This module requires no network and writes no file. Pure CJS, node
 * built-ins plus three lib/core readers. Hyphens only, no em dash.
 */

const fs = require('node:fs');
const path = require('node:path');

const VOCAB_PATH = path.join(__dirname, '..', '..', 'data', 'brain-shape-vocabulary.json');

/** The six packet keys, in wire order (Theo SHAPE_KEYS). */
const SHAPE_KEYS = Object.freeze([
  'schema_version',
  'problem_type',
  'stage',
  'role',
  'domain_tag',
  'constraint_categories',
]);

/** The one schema version this module admits. */
const SHAPE_SCHEMA_VERSION = 1;

/** A packet carries 0 to 5 constraint categories (Theo CONSTRAINT_CATEGORIES_MAX). */
const CONSTRAINT_CATEGORIES_MAX = 5;

/** The five enum lists the vocabulary file must carry. */
const ENUM_LISTS = Object.freeze(['problem_type', 'stage', 'role', 'domain_tag', 'constraint_categories']);

// ---------- loadVocabulary ----------

let _vocabCache = null;

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

/**
 * Read data/brain-shape-vocabulary.json once, check schema_version 1 and the
 * shape of every list this module reads, freeze and cache it. Throws on a
 * malformed file: a vocabulary that cannot be trusted must not build a packet.
 */
function loadVocabulary() {
  if (_vocabCache) return _vocabCache;
  const raw = fs.readFileSync(VOCAB_PATH, 'utf8');
  const vocab = JSON.parse(raw);
  if (vocab.schema_version !== SHAPE_SCHEMA_VERSION) {
    throw new Error('brain-shape-vocabulary.json: unexpected schema_version ' + vocab.schema_version + ' (expected ' + SHAPE_SCHEMA_VERSION + ')');
  }
  for (const key of ENUM_LISTS) {
    if (!Array.isArray(vocab[key]) || vocab[key].length === 0 || !vocab[key].every((m) => typeof m === 'string')) {
      throw new Error('brain-shape-vocabulary.json: ' + key + ' must be a non-empty array of strings');
    }
  }
  for (const key of ['stage_map', 'role_map', 'problem_type_aliases', 'constraint_keyword_map']) {
    if (!vocab[key] || typeof vocab[key] !== 'object' || Array.isArray(vocab[key])) {
      throw new Error('brain-shape-vocabulary.json: ' + key + ' must be an object');
    }
  }
  if (typeof vocab.role_default !== 'string' || !vocab.role.includes(vocab.role_default)) {
    throw new Error('brain-shape-vocabulary.json: role_default must be a role member');
  }
  if (!vocab.stage.includes('Phase0')) {
    throw new Error('brain-shape-vocabulary.json: stage must carry Phase0 (the no-venture_stage default)');
  }
  if (!vocab.domain_tag.includes('unknown')) {
    throw new Error('brain-shape-vocabulary.json: domain_tag must carry unknown (the no-domain default)');
  }
  _vocabCache = deepFreeze(vocab);
  return _vocabCache;
}

// ---------- room readers (local only; values never leave this module) ----------

function readTextOrNull(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return null;
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Split an inline YAML list body `[a, "b c", d]` into trimmed, unquoted items. */
function splitInline(body) {
  const out = [];
  let cur = '';
  let quote = null;
  for (const ch of body) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim().length > 0) out.push(cur);
  return out.map(unquote).filter((x) => x.length > 0);
}

/**
 * A minimal frontmatter reader for the few STATE.md keys this module needs:
 * flat scalars (`key: value`), inline lists (`key: [a, b]`) and block lists
 * (`key:` followed by `  - item` lines). Anything else is skipped. Returns
 * {} when the file has no frontmatter. Scalars stay strings; the callers cast.
 */
function readFrontmatter(text) {
  const out = {};
  if (typeof text !== 'string') return out;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  let openList = null;
  for (const line of lines) {
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    if (openList !== null && /^\s+-\s*/.test(line)) {
      const item = unquote(line.replace(/^\s+-\s*/, ''));
      if (item.length > 0) out[openList].push(item);
      continue;
    }
    openList = null;
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const rest = kv[2].trim();
    if (rest.length === 0) {
      out[key] = [];
      openList = key;
      continue;
    }
    if (rest[0] === '[' && rest[rest.length - 1] === ']') {
      out[key] = splitInline(rest.slice(1, -1));
      continue;
    }
    out[key] = unquote(rest);
  }
  return out;
}

/** .mindrian/jtbd-state.json goal.rung, or null (the brain-derivation.cjs:414 read). */
function readJtbdRung(roomDir) {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'jtbd-state.json'), 'utf8'));
    return doc && doc.goal && typeof doc.goal.rung === 'string' ? doc.goal.rung : null;
  } catch (_e) {
    return null;
  }
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return parseFloat(v);
  return NaN;
}

/**
 * The Phase 88 triple for classifyProblemType. folder-memory readTriple reads
 * STATE.md and MINTO.md. When the room has no MINTO.md (reasoning.exists is
 * false), the four scalars classifyProblemType reads are taken from the
 * STATE.md frontmatter instead; governing_thought is reduced to an existence
 * flag at this line and its text is dropped.
 */
function readTripleForClassify(roomDir, stateFm) {
  const folderMemory = require('./folder-memory.cjs');
  const triple = folderMemory.readTriple(roomDir);
  if (triple && triple.reasoning && triple.reasoning.exists === true) return triple;
  const reasoning = Object.assign({}, triple && triple.reasoning ? triple.reasoning : {});
  const gt = stateFm.governing_thought;
  reasoning.governing_thought = typeof gt === 'string' && gt.length > 0 ? 'x' : null;
  if (typeof stateFm.mece_status === 'string') reasoning.mece_status = stateFm.mece_status;
  const args = toNumber(stateFm.arguments_count);
  if (Number.isFinite(args)) reasoning.arguments_count = args;
  const ev = toNumber(stateFm.evidence_density);
  if (Number.isFinite(ev)) reasoning.evidence_density = ev;
  return Object.assign({}, triple, { reasoning: reasoning });
}

// ---------- the five members ----------

function deriveProblemType(roomDir, stateFm, vocab) {
  const rungVocab = require('./strategy/rung-vocabulary.cjs');
  const rung = readJtbdRung(roomDir);
  if (rungVocab.isTheoRung(rung) && vocab.problem_type.includes(rung)) {
    return { value: rung, source: 'jtbd_goal' };
  }
  const derivation = require('./brain-derivation.cjs');
  const legacy = derivation.classifyProblemType(readTripleForClassify(roomDir, stateFm));
  const mapped = vocab.problem_type_aliases[legacy];
  if (typeof mapped === 'string' && vocab.problem_type.includes(mapped)) {
    return { value: mapped, source: 'classify' };
  }
  // classifyProblemType is frozen to UDP/IDP/WDP; an unmapped value is a
  // vocabulary fault, not a room fault. Fall back to the first alias target.
  return { value: vocab.problem_type_aliases.UDP || vocab.problem_type[0], source: 'classify' };
}

function deriveStage(stateFm, vocab) {
  const raw = stateFm.venture_stage;
  if (typeof raw === 'string') {
    const mapped = vocab.stage_map[raw];
    if (typeof mapped === 'string' && vocab.stage.includes(mapped)) {
      return { value: mapped, source: 'state_md' };
    }
  }
  return { value: 'Phase0', source: 'default' };
}

function deriveRole(roomDir, vocab) {
  const userMdOps = require('./user-md-ops.cjs');
  const user = userMdOps.readUserMd(path.join(roomDir, 'USER.md'), { ignoreOverride: true });
  if (!user || user.parse_failed) return { value: vocab.role_default, source: 'default' };
  const blend = user.role_blend || {};
  let best = null;
  let bestScore = -Infinity;
  let tie = false;
  for (const axis of vocab.role) {
    const v = blend[axis];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (v > bestScore) { bestScore = v; best = axis; tie = false; } else if (v === bestScore) { tie = true; }
  }
  if (best !== null && !tie && bestScore > 0) return { value: best, source: 'user_md' };
  const canonical = user.canonical_role;
  if (typeof canonical === 'string') {
    const mapped = vocab.role_map[canonical];
    if (typeof mapped === 'string' && vocab.role.includes(mapped)) return { value: mapped, source: 'user_md' };
    if (vocab.role.includes(canonical)) return { value: canonical, source: 'user_md' };
  }
  return { value: vocab.role_default, source: 'default' };
}

function deriveDomainTag(stateFm, vocab) {
  for (const key of ['domain', 'industry', 'sector']) {
    const raw = stateFm[key];
    if (typeof raw === 'string' && raw.length > 0) {
      const lower = raw.toLowerCase();
      if (vocab.domain_tag.includes(lower)) return { value: lower, source: 'state_md' };
      return { value: 'unknown', source: 'default' };
    }
  }
  return { value: 'unknown', source: 'default' };
}

function deriveConstraintCategories(stateFm, vocab) {
  const entries = [];
  for (const key of ['constraints', 'blockers']) {
    const v = stateFm[key];
    if (Array.isArray(v)) entries.push(...v);
    else if (typeof v === 'string' && v.length > 0) entries.push(v);
  }
  if (entries.length === 0) return { value: [], source: 'default' };
  const hit = new Set();
  for (const entry of entries) {
    const words = new Set(String(entry).toLowerCase().split(/[^a-z0-9_]+/).filter((w) => w.length > 0));
    for (const category of vocab.constraint_categories) {
      const keywords = vocab.constraint_keyword_map[category];
      if (!Array.isArray(keywords)) continue;
      if (keywords.some((k) => words.has(k))) hit.add(category);
    }
  }
  const ordered = vocab.constraint_categories.filter((c) => hit.has(c)).slice(0, CONSTRAINT_CATEGORIES_MAX);
  return { value: ordered, source: ordered.length > 0 ? 'state_md' : 'default' };
}

// ---------- buildShapePacket ----------

/**
 * buildShapePacket({roomDir}) -> {shape, sources, ignored_input, ignored_keys}
 *
 * Reads ONLY the bound room directory: STATE.md frontmatter, USER.md,
 * .mindrian/jtbd-state.json and MINTO.md (through readTriple). Every member of
 * `shape` is a vocabulary member; `sources` carries labels only. Any argument
 * other than roomDir is not read: `ignored_input` is true and `ignored_keys`
 * names the keys (names only, never values). Never writes. Never throws on a
 * missing or unreadable room: every member falls to its default.
 */
function buildShapePacket(args) {
  const vocab = loadVocabulary();
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  const roomDir = typeof input.roomDir === 'string' && input.roomDir.length > 0 ? input.roomDir : null;
  const ignoredKeys = Object.keys(input).filter((k) => k !== 'roomDir').sort();

  const stateFm = roomDir ? readFrontmatter(readTextOrNull(path.join(roomDir, 'STATE.md'))) : {};
  const problemType = roomDir ? deriveProblemType(roomDir, stateFm, vocab) : deriveProblemType('', stateFm, vocab);
  const stage = deriveStage(stateFm, vocab);
  const role = roomDir ? deriveRole(roomDir, vocab) : { value: vocab.role_default, source: 'default' };
  const domainTag = deriveDomainTag(stateFm, vocab);
  const constraints = deriveConstraintCategories(stateFm, vocab);

  const shape = {
    schema_version: SHAPE_SCHEMA_VERSION,
    problem_type: problemType.value,
    stage: stage.value,
    role: role.value,
    domain_tag: domainTag.value,
    constraint_categories: constraints.value,
  };
  const check = validateShapePacket(shape);
  if (!check.ok) {
    // The builder and the validator read one vocabulary; this is unreachable
    // unless the file is inconsistent. Fail loud rather than ship a bad shape.
    throw new Error('buildShapePacket: built packet failed validation on ' + check.field + ': ' + check.reason);
  }
  return {
    shape: shape,
    sources: {
      problem_type: problemType.source,
      stage: stage.source,
      role: role.source,
      domain_tag: domainTag.source,
      constraint_categories: constraints.source,
    },
    ignored_input: ignoredKeys.length > 0,
    ignored_keys: ignoredKeys,
  };
}

// ---------- validateShapePacket ----------

function refuse(field, reason, members) {
  return { ok: false, field: field, reason: reason, members: members };
}

/**
 * validateShapePacket(shape) -> {ok: true} | {ok: false, field, reason, members}
 *
 * Exact key set SHAPE_KEYS (an extra key is refused by name, a missing key is
 * refused by name); schema_version is the number 1; the four scalar members
 * are exact enum members (case included, no trimming); constraint_categories
 * is an array of 0 to 5 distinct members. No repair, no coercion. `members`
 * lists the accepted enum for the refused field (SHAPE_KEYS for a key fault).
 */
function validateShapePacket(shape) {
  const vocab = loadVocabulary();
  if (shape === null || typeof shape !== 'object' || Array.isArray(shape)) {
    return refuse('shape', 'shape must be an object with exactly the keys ' + SHAPE_KEYS.join(', '), Array.from(SHAPE_KEYS));
  }
  for (const key of Object.keys(shape)) {
    if (!SHAPE_KEYS.includes(key)) {
      return refuse(key, 'unexpected key ' + key + '; accepted keys: ' + SHAPE_KEYS.join(', '), Array.from(SHAPE_KEYS));
    }
  }
  for (const key of SHAPE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(shape, key)) {
      return refuse(key, 'missing key ' + key + '; accepted keys: ' + SHAPE_KEYS.join(', '), Array.from(SHAPE_KEYS));
    }
  }
  if (shape.schema_version !== SHAPE_SCHEMA_VERSION) {
    return refuse('schema_version', 'schema_version must be the number ' + SHAPE_SCHEMA_VERSION + ' (got ' + JSON.stringify(shape.schema_version) + ')', [SHAPE_SCHEMA_VERSION]);
  }
  for (const key of ['problem_type', 'stage', 'role', 'domain_tag']) {
    const list = vocab[key];
    if (typeof shape[key] !== 'string' || !list.includes(shape[key])) {
      return refuse(key, key + ' must be one of ' + list.join(', ') + ' (got ' + JSON.stringify(shape[key]) + ')', Array.from(list));
    }
  }
  const cc = shape.constraint_categories;
  const members = Array.from(vocab.constraint_categories);
  if (!Array.isArray(cc)) {
    return refuse('constraint_categories', 'constraint_categories must be an array of 0 to ' + CONSTRAINT_CATEGORIES_MAX + ' members of ' + members.join(', ') + ' (got ' + typeof cc + ')', members);
  }
  if (cc.length > CONSTRAINT_CATEGORIES_MAX) {
    return refuse('constraint_categories', 'constraint_categories carries ' + cc.length + ' members; the maximum is ' + CONSTRAINT_CATEGORIES_MAX, members);
  }
  for (const c of cc) {
    if (typeof c !== 'string' || !vocab.constraint_categories.includes(c)) {
      return refuse('constraint_categories', 'constraint_categories member must be one of ' + members.join(', ') + ' (got ' + JSON.stringify(c) + ')', members);
    }
  }
  if (new Set(cc).size !== cc.length) {
    return refuse('constraint_categories', 'constraint_categories must not repeat a member', members);
  }
  return { ok: true };
}

module.exports = {
  buildShapePacket: buildShapePacket,
  validateShapePacket: validateShapePacket,
  loadVocabulary: loadVocabulary,
  SHAPE_KEYS: SHAPE_KEYS,
  SHAPE_SCHEMA_VERSION: SHAPE_SCHEMA_VERSION,
  CONSTRAINT_CATEGORIES_MAX: CONSTRAINT_CATEGORIES_MAX,
  // Test surface: not part of the public API.
  _test: Object.freeze({
    readFrontmatter: readFrontmatter,
    deriveConstraintCategories: deriveConstraintCategories,
  }),
};
