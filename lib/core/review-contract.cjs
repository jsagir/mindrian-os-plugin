'use strict';
/*
 * lib/core/review-contract.cjs - the review contract check for /mos:grade and /mos:deep-grade (Phase 370).
 *
 * WHAT IT IS: one pure function, checkReview(text, options), that decides pass or fail for the reader-facing
 * BODY of a grade or deep-grade review. It checks the fixed shape (six ordered sections, an optional last
 * note), the counts, optional owner limits, and the internal-name denylist. It is a code check and never a
 * model judgment. Code cannot prove that a method term is "defined in plain words" (D-03); that part stays a
 * human rubric.
 *
 * CANON PART 8 (graph boundary): this module reads local files only, makes no network call, and requires no
 * Brain module. The result carries a rule id, a tier, a class and a line number. It never carries matched text,
 * a body slice or a heading text.
 *
 * FRONTMATTER: handles such as the assessor and the team name are allowed there by design. Only the body is
 * checked, so a provenance handle never fails a review.
 *
 * THE DENYLIST IS GENERATED, NOT KEPT (D-10): agent names (agents/*.md), commands (data/command-registry.json)
 * and tool ids (data/mcp-tool-connectors.json) are read from disk at every call and take a repoRoot parameter.
 * No agent name, command or tool id and no count is written in this file. The hand-kept parts are:
 *   - internal_terms, soft_terms, forbidden headings and forbidden body patterns: in data/review-contract.json,
 *     each with a why;
 *   - the generic class regexes below (the Agent suffix class, the path patterns, the mcp__ and brain_
 *     prefixes, the command prefix): each carries a comment that says why it is hand-kept.
 *
 * Reuse before build (Canon Part 7): findIdLeak comes from lib/hmi/larry-reply-checks.cjs. No second linter
 * framework.
 */

const fs = require('fs');
const path = require('path');
const { findIdLeak, NEVER_SAY_TERMS } = require('../hmi/larry-reply-checks.cjs');

const CONTRACT_VERSION = 1;
const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');

// Safety bound only, not a product rule: the MCP schema caps the content far below this.
const MAX_INPUT_CHARS = 1000000;

const REQUIRED_KEYS = [
  'review_contract', 'applies_to', 'sections', 'optional_tail', 'forbidden_headings',
  'forbidden_body_patterns', 'counts', 'limits', 'internal_terms', 'soft_terms',
];

const INVISIBLE_RE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  // Local one-line helper: larry-reply-checks.cjs does not export its own.
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function invalid(message) {
  const err = new Error(message);
  err.code = 'REVIEW_CONTRACT_INVALID';
  return err;
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

// NFKC plus removal of zero-width and soft-hyphen characters. A newline is never removed, so line numbers stay true.
function normalizeLine(line) {
  return String(line).replace(INVISIBLE_RE, '').normalize('NFKC').replace(INVISIBLE_RE, '');
}

function compile(source, flags, what) {
  try {
    return new RegExp(source, String(flags || '').replace(/[gy]/g, ''));
  } catch (_) {
    throw invalid('invalid pattern in ' + what);
  }
}

// ---------------------------------------------------------------------------
// loadContract
// ---------------------------------------------------------------------------

function loadContract(options) {
  const o = options || {};
  let contract = o.contract;
  if (!contract) {
    const root = o.repoRoot || DEFAULT_ROOT;
    const file = o.contractPath || path.join(root, 'data', 'review-contract.json');
    contract = readJsonSafe(file);
    if (!contract) throw invalid('review contract file cannot be read or parsed');
  }
  if (typeof contract !== 'object' || Array.isArray(contract)) throw invalid('review contract is not an object');
  for (const key of REQUIRED_KEYS) {
    if (contract[key] === undefined || contract[key] === null) throw invalid('review contract is missing the key ' + key);
  }
  if (!Array.isArray(contract.sections) || contract.sections.length !== 6) {
    throw invalid('review contract key sections must hold six items');
  }
  for (const key of ['optional_tail', 'forbidden_headings', 'forbidden_body_patterns', 'internal_terms']) {
    if (!Array.isArray(contract[key])) throw invalid('review contract key ' + key + ' must be an array');
  }
  if (!contract.soft_terms || !Array.isArray(contract.soft_terms.terms)) {
    throw invalid('review contract key soft_terms needs a terms array');
  }
  return contract;
}

// ---------------------------------------------------------------------------
// splitArtifact and isReviewArtifact
// ---------------------------------------------------------------------------

function splitArtifact(text) {
  let src = String(text == null ? '' : text);
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const lines = src.split('\n');
  const isFence = (l) => l.replace(/[ \t\r]+$/, '') === '---';
  if (lines.length > 0 && isFence(lines[0])) {
    for (let j = 1; j < lines.length; j++) {
      if (isFence(lines[j])) {
        return {
          frontmatter: lines.slice(1, j).join('\n'),
          body: lines.slice(j + 1).join('\n'),
          bodyStartLine: j + 2,
        };
      }
    }
  }
  return { frontmatter: null, body: src, bodyStartLine: 1 };
}

// Top-level "key: value" lines only. No YAML library: one regex per line, quotes stripped.
function frontmatterKeys(frontmatter) {
  const out = {};
  if (frontmatter == null) return out;
  for (const raw of String(frontmatter).split('\n')) {
    const m = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*?)[ \t\r]*$/.exec(raw);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2').trim();
  }
  return out;
}

function isReviewArtifact(text, options) {
  try {
    const o = options || {};
    const contract = o.contract || loadContract({ repoRoot: o.repoRoot });
    const parts = splitArtifact(text);
    if (parts.frontmatter === null) return false;
    const keys = frontmatterKeys(parts.frontmatter);
    const rules = (contract.applies_to && contract.applies_to.frontmatter) || [];
    for (const rule of rules) {
      if (!rule || !Object.prototype.hasOwnProperty.call(keys, rule.key)) continue;
      if (rule.any === true) return true;
      if (Array.isArray(rule.values) && rule.values.indexOf(keys[rule.key]) !== -1) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// buildDenylist (generated from disk at every call)
// ---------------------------------------------------------------------------

// A name is read from the "name:" line of the agent file frontmatter; the file name is the fallback.
function readAgentNames(root) {
  const dir = path.join(root, 'agents');
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch (_) {
    return [];
  }
  const names = [];
  for (const f of files) {
    let name = f.replace(/\.md$/, '');
    try {
      const fm = splitArtifact(fs.readFileSync(path.join(dir, f), 'utf8')).frontmatter;
      const m = /^name:[ \t]*(.+)$/m.exec(fm || '');
      if (m) name = m[1].replace(/\r/g, '').replace(/^(['"])(.*)\1$/, '$2').trim() || name;
    } catch (_) { /* keep the file name */ }
    names.push(name);
  }
  return names;
}

function titleCaseWords(name) {
  return String(name).split(/[-_\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
}

// Word guards: a generated term must not sit inside a longer word, id or kebab name.
const GUARD_BEFORE = '(?<![A-Za-z0-9_-])';
const GUARD_AFTER = '(?![A-Za-z0-9_-])';

function buildDenylist(options) {
  const o = options || {};
  const root = o.repoRoot || DEFAULT_ROOT;
  const contract = o.contract || loadContract({ repoRoot: root });
  const entries = [];

  // H1 agent names ---------------------------------------------------------
  // Hand-kept and generic: any PascalCase word that ends in Agent is a class name of the internal pipeline
  // whatever agent files exist today. The start guard keeps the scan linear on a long letter run.
  entries.push({ tier: 'H1', class: 'agent_name', label: '*Agent', source: '(?<![A-Za-z0-9_])[A-Z][A-Za-z]*Agent(?![A-Za-z0-9_])', flags: '' });
  const agentNames = readAgentNames(root);
  for (const name of agentNames) {
    const words = titleCaseWords(name);
    if (words.length === 0) continue;
    // Title Case form plus " Agent". A single-word name never adds its bare word.
    entries.push({
      tier: 'H1', class: 'agent_name', label: words.join(' ') + ' Agent',
      source: GUARD_BEFORE + words.map(escapeRegex).join('\\s+') + '\\s+Agents?' + GUARD_AFTER, flags: 'i',
    });
    // The kebab form only when the name holds a hyphen.
    if (name.indexOf('-') !== -1) {
      entries.push({
        tier: 'H1', class: 'agent_name', label: name,
        source: GUARD_BEFORE + escapeRegex(name) + GUARD_AFTER, flags: 'i',
      });
    }
  }

  // H2 commands -------------------------------------------------------------
  // Hand-kept and generic: the slash form of the command namespace. The namespace is the plugin short name, it
  // is not a single command, so it is not read from the registry.
  entries.push({ tier: 'H2', class: 'command', label: '/mos:*', source: '(?<![A-Za-z0-9_])/mos:[A-Za-z]', flags: 'i' });
  const registry = readJsonSafe(path.join(root, 'data', 'command-registry.json'));
  const commands = registry && Array.isArray(registry.commands) ? registry.commands : [];
  let commandCount = 0;
  const seenCommands = new Set();
  for (const c of commands) {
    if (!c || typeof c.command !== 'string' || !c.command) continue;
    commandCount++;
    const bare = c.command.replace(/^\//, '');
    if (!bare || seenCommands.has(bare)) continue;
    seenCommands.add(bare);
    entries.push({
      tier: 'H2', class: 'command', label: bare,
      source: GUARD_BEFORE + '/?' + escapeRegex(bare) + GUARD_AFTER, flags: 'i',
    });
  }

  // H3 tool ids -------------------------------------------------------------
  const connectors = readJsonSafe(path.join(root, 'data', 'mcp-tool-connectors.json'));
  const surfaces = connectors && Array.isArray(connectors.connectors) ? connectors.connectors : [];
  let toolCount = 0;
  const seenTools = new Set();
  for (const s of surfaces) {
    if (!s || typeof s.surface !== 'string' || !s.surface) continue;
    toolCount++;
    const id = s.surface.replace(/^mcp:/, '');
    // Same rule as toolIds() in larry-reply-checks: a plain one-word id is a normal word, only an id with an
    // underscore is reported.
    if (id.indexOf('_') === -1 || seenTools.has(id)) continue;
    seenTools.add(id);
    entries.push({
      tier: 'H3', class: 'tool_id', label: id,
      source: '(?<![A-Za-z0-9_])' + escapeRegex(id) + '(?![A-Za-z0-9_])', flags: '',
    });
  }
  // Hand-kept and generic: the mcp__ and brain_ prefixes name whole families of tool ids, so no per-id list can
  // stay current. The start guard keeps the scan linear.
  entries.push({ tier: 'H3', class: 'tool_id', label: 'mcp__*', source: '(?<![A-Za-z0-9_])mcp__[a-z0-9_]+', flags: 'i' });
  entries.push({ tier: 'H3', class: 'tool_id', label: 'brain_*', source: '(?<![A-Za-z0-9_])brain_[a-z_]+', flags: '' });

  // H4 paths and file names -------------------------------------------------
  // Hand-kept and generic: plugin folder paths and *.cjs script names. The pattern text is copied from
  // findMachineryNarration in lib/hmi/larry-reply-checks.cjs (the "script path" line, near line 592) with a
  // start guard added: the original unguarded run form took 5.5 s on a 60000-letter run (plan 370-01 finding).
  entries.push({ tier: 'H4', class: 'path_or_id', label: 'plugin path', source: '(?<![\\w-])(?:scripts|lib|agents|skills|hooks|references|data|\\.planning)/[\\w./-]+', flags: '' });
  entries.push({ tier: 'H4', class: 'path_or_id', label: '*.cjs', source: '(?<![\\w-])[\\w-]+\\.cjs\\b', flags: '' });

  // E1 hand-kept internal terms of the contract (each has a why in the data file) ------
  for (const t of contract.internal_terms) {
    if (!t || typeof t.pattern !== 'string') continue;
    const cls = t.class || 'backend_name';
    entries.push({ tier: cls === 'path_or_id' ? 'H4' : 'E1', class: cls, label: String(t.term), source: t.pattern, flags: String(t.flags || '') });
  }

  // S soft terms: the bare word and its plural ----------------------------------------
  for (const term of contract.soft_terms.terms) {
    entries.push({
      tier: 'S', class: 'soft_term', label: String(term), softTerm: String(term),
      source: '(?<![A-Za-z0-9_])' + escapeRegex(term) + 's?(?![A-Za-z0-9_])', flags: 'i',
    });
  }

  return { entries, counts: { agents: agentNames.length, commands: commandCount, tools: toolCount } };
}

// ---------------------------------------------------------------------------
// checkReview
// ---------------------------------------------------------------------------

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/;
const TOP_LIST_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const ANY_LIST_RE = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const BOLD_LABEL_RE = /^(?:\*\*|__)[ \t]*(.*)$/;
const ID_PREFILTER_RE = /rp-\d{4}|lanes? [A-D]|[a-z]_[a-z0-9]/i;

function cleanHeading(raw) {
  return String(raw).replace(/[ \t]+#+[ \t]*$/, '').replace(/\*\*|__/g, '').trim();
}

// One pass over the body lines: fence state, headings, and the section each line sits in.
function scanStructure(lines, contract) {
  const n = lines.length;
  const inFence = new Array(n).fill(false);
  let fence = null;
  for (let i = 0; i < n; i++) {
    const l = lines[i];
    const m = FENCE_RE.exec(l);
    if (fence) {
      inFence[i] = true;
      if (m && m[1].charAt(0) === fence.ch && m[1].length >= fence.len && /^[ \t\r]*$/.test(l.slice(m[0].length))) fence = null;
    } else if (m) {
      inFence[i] = true;
      fence = { ch: m[1].charAt(0), len: m[1].length };
    }
  }

  const forbidden = contract.forbidden_headings.map((f) => ({ id: String(f.id), re: compile(f.pattern, f.flags || 'i', 'forbidden heading ' + f.id) }));
  const expected = contract.sections.map((s) => ({ id: s.id, heading: s.heading, required: true }))
    .concat(contract.optional_tail.map((t) => ({
      id: t.id, heading: t.heading, required: false,
      re: t.heading_pattern ? compile(t.heading_pattern, t.heading_flags || 'i', 'optional tail ' + t.id) : null,
    })));

  const headings = [];
  const sectionAt = new Array(n).fill(null);
  let current = null;
  for (let i = 0; i < n; i++) {
    if (!inFence[i]) {
      const m = HEADING_RE.exec(lines[i]);
      if (m) {
        const level = m[1].length;
        const clean = cleanHeading(m[2]);
        const h = { index: i, level, clean, forbiddenId: null, expectedIdx: -1 };
        for (const f of forbidden) {
          if (f.re.test(clean)) { h.forbiddenId = f.id; break; }
        }
        if (level === 2) {
          if (!h.forbiddenId) {
            for (let k = 0; k < expected.length; k++) {
              const e = expected[k];
              if (clean === e.heading || (e.re && e.re.test(clean))) { h.expectedIdx = k; break; }
            }
          }
          current = h.expectedIdx >= 0 ? expected[h.expectedIdx].id : '#other';
        }
        headings.push(h);
      }
    }
    sectionAt[i] = current;
  }
  return { inFence, headings, sectionAt, expected };
}

function checkReview(text, options) {
  const o = options || {};
  const repoRoot = o.repoRoot || DEFAULT_ROOT;
  const contract = loadContract({ repoRoot, contract: o.contract });
  const violations = [];
  const add = (rule, tier, cls, line) => { violations.push({ rule, tier, class: cls, line }); };
  const finish = () => {
    const seen = new Set();
    const list = violations.filter((v) => {
      const k = v.rule + '|' + v.tier + '|' + v.class + '|' + v.line;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a, b) => (a.line - b.line) || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0) || (a.class < b.class ? -1 : a.class > b.class ? 1 : 0));
    return { ok: list.length === 0, violations: list, contract_version: CONTRACT_VERSION };
  };

  const src = String(text == null ? '' : text);
  if (src.length > MAX_INPUT_CHARS) {
    add('length', '-', 'size', 1);
    return finish();
  }

  const parts = splitArtifact(src);
  const base = parts.bodyStartLine;
  const lines = parts.body.split(/\r?\n/);
  const lineNo = (i) => base + i;
  const norm = lines.map(normalizeLine);

  // ---- shape ----------------------------------------------------------------
  const st = scanStructure(lines, contract);
  const matched = new Set();
  let lastIdx = -1;
  let orderReported = false;
  for (const h of st.headings) {
    if (h.forbiddenId) {
      add('forbidden_section', '-', h.forbiddenId, lineNo(h.index));
      continue;
    }
    if (h.level !== 2) continue;
    if (h.expectedIdx < 0) {
      add('extra_section', '-', 'shape', lineNo(h.index));
      continue;
    }
    matched.add(h.expectedIdx);
    if (h.expectedIdx <= lastIdx && !orderReported) {
      add('shape_order', '-', 'shape', lineNo(h.index));
      orderReported = true;
    }
    if (h.expectedIdx > lastIdx) lastIdx = h.expectedIdx;
  }
  st.expected.forEach((e, k) => {
    if (e.required && !matched.has(k)) add('missing_section', '-', e.id, base);
  });

  // ---- counts -----------------------------------------------------------------
  const tailIds = new Set(contract.optional_tail.map((t) => t.id));
  const headingLineOf = (sectionId) => {
    const h = st.headings.find((x) => x.level === 2 && x.expectedIdx >= 0 && st.expected[x.expectedIdx].id === sectionId);
    return h ? h : null;
  };
  const rp = contract.counts && contract.counts.revision_points;
  if (rp && typeof rp.min === 'number' && typeof rp.max === 'number') {
    const h = headingLineOf(rp.under);
    if (h) {
      let count = 0;
      for (let i = h.index + 1; i < lines.length; i++) {
        if (st.inFence[i]) continue;
        const hm = HEADING_RE.exec(lines[i]);
        if (hm && hm[1].length === 2) break;
        // Top-level items only: a nested sub-bullet is detail, not a revision point.
        if (TOP_LIST_RE.test(lines[i])) count++;
      }
      if (count < rp.min || count > rp.max) add('revision_points_count', '-', 'count', lineNo(h.index));
    }
  }

  const cd = contract.counts && contract.counts.cross_domain_ideas;
  const marker = cd && typeof cd.marker === 'string' ? cd.marker.toLowerCase() : '';
  const markerItems = [];
  if (marker) {
    for (let i = 0; i < lines.length; i++) {
      if (st.inFence[i]) continue;
      const lm = ANY_LIST_RE.exec(lines[i]);
      if (!lm) continue;
      const bm = BOLD_LABEL_RE.exec(lm[1]);
      if (bm && bm[1].toLowerCase().indexOf(marker) === 0) markerItems.push(i);
    }
    if (cd && typeof cd.max === 'number') {
      const body = markerItems.filter((i) => !tailIds.has(st.sectionAt[i]));
      if (body.length > cd.max) add('cross_domain_count', '-', 'count', lineNo(body[cd.max]));
    }
  }

  // ---- limits: only keys that exist (D-11: invent none) ---------------------------------
  const lim = contract.limits || {};
  if (typeof lim.body_words_max === 'number') {
    const words = parts.body.split(/\s+/).filter(Boolean).length;
    if (words > lim.body_words_max) add('length', '-', 'limit', base);
  }
  if (typeof lim.reflection_questions_max === 'number') {
    let questions = 0;
    let firstLine = base;
    const sh = headingLineOf('strategic_challenge');
    if (sh) firstLine = lineNo(sh.index);
    for (let i = 0; i < lines.length; i++) {
      if (st.inFence[i] || st.sectionAt[i] !== 'strategic_challenge') continue;
      const lm = ANY_LIST_RE.exec(lines[i]);
      if (lm && /\?[ \t\r]*$/.test(lm[1])) questions++;
    }
    if (questions > lim.reflection_questions_max) add('reflection_questions_count', '-', 'limit', firstLine);
  }
  if (typeof lim.cross_domain_under === 'string' && lim.cross_domain_under) {
    for (const i of markerItems) {
      const sec = st.sectionAt[i];
      // The optional last note is where extras are allowed (D-01), so it is not "outside" the named section.
      if (sec !== lim.cross_domain_under && !tailIds.has(sec)) add('cross_domain_position', '-', 'limit', lineNo(i));
    }
  }

  // ---- forbidden body patterns ---------------------------------------------------------
  for (const p of contract.forbidden_body_patterns) {
    const re = compile(p.pattern, p.flags || '', 'forbidden body pattern ' + p.id);
    for (let i = 0; i < norm.length; i++) {
      if (re.test(norm[i])) add('forbidden_pattern', '-', String(p.id), lineNo(i));
    }
  }

  // ---- denylist scan over the whole body, fenced code included -------------------------------
  const policy = contract.soft_terms.policy;
  const skipSoft = o.softTerms === 'skip';
  const sourceNorm = o.sourceText ? normalizeLine(o.sourceText).toLowerCase() : '';
  const sourceHas = (term) => {
    if (!sourceNorm) return false;
    return new RegExp('(?<![a-z0-9_])' + escapeRegex(String(term).toLowerCase()) + 's?(?![a-z0-9_])').test(sourceNorm);
  };
  const normBody = norm.join('\n');
  const toolLines = new Set();
  const denylist = buildDenylist({ repoRoot, contract });
  for (const e of denylist.entries) {
    if (e.tier === 'S') {
      if (skipSoft || policy === 'compound_only') continue;
      if (policy === 'exempt_if_in_source' && sourceHas(e.softTerm)) continue;
    }
    const re = compile(e.source, e.flags, 'denylist entry');
    // One pass over the whole body first; the per-line pass only runs for an entry that hits somewhere.
    if (!re.test(normBody)) continue;
    for (let i = 0; i < norm.length; i++) {
      if (re.test(norm[i])) {
        add('internal_name', e.tier, e.class, lineNo(i));
        if (e.tier === 'H3') toolLines.add(i);
      }
    }
  }

  // Id leaks from the reused checker. leaf_id and shape_code stay chat-only (they match words such as K12).
  for (let i = 0; i < norm.length; i++) {
    if (!ID_PREFILTER_RE.test(norm[i])) continue;
    // Backticks become spaces so an id inside inline code is still scanned (a leak in code is a leak).
    const verdict = findIdLeak(norm[i].replace(/`/g, ' '));
    for (const hit of verdict.hits) {
      if (hit.kind === 'run_id' || hit.kind === 'lane_letter') add('internal_name', 'H4', 'path_or_id', lineNo(i));
      else if (hit.kind === 'verdict_code' && !toolLines.has(i)) add('internal_name', 'H4', 'path_or_id', lineNo(i));
    }
  }

  // ---- dash rule: on the raw line, a dash inside a fence still counts --------------------------
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(EM_DASH) !== -1 || lines[i].indexOf(EN_DASH) !== -1) add('em_dash', '-', 'dash', lineNo(i));
  }

  return finish();
}

// ---------------------------------------------------------------------------
// collectSourceText
// ---------------------------------------------------------------------------

const EXCLUDED_FILES = new Set(['BRAIN.md', 'STATE.md', 'REASONING.md', 'ROOM.md']);
const EXCLUDED_DIRS = new Set(['grades', 'deep-grades', 'node_modules']);
// Safety bounds, not product rules.
const SOURCE_MAX_DEPTH = 3;
const SOURCE_HEAD_BYTES = 262144;

function readHead(file, size, want) {
  const len = Math.min(size, want);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file, 'r');
  try {
    const got = fs.readSync(fd, buf, 0, len, 0);
    return buf.subarray(0, got);
  } finally {
    fs.closeSync(fd);
  }
}

// Student-authored text of a room, bounded. Never throws: any error returns what was read, or an empty string.
function collectSourceText(roomDir, options) {
  const o = options || {};
  const maxFiles = typeof o.maxFiles === 'number' ? o.maxFiles : 200;
  const maxBytes = typeof o.maxBytes === 'number' ? o.maxBytes : 2000000;
  const chunks = [];
  let bytes = 0;
  let files = 0;
  let stop = false;
  let contract = null;
  try { contract = loadContract({}); } catch (_) { contract = null; }

  function takeFile(full, size) {
    if (files >= maxFiles || bytes >= maxBytes) { stop = true; return; }
    let buf;
    try { buf = readHead(full, size, SOURCE_HEAD_BYTES); } catch (_) { return; }
    const text = buf.toString('utf8');
    if (contract && isReviewArtifact(text, { contract })) return;
    files++;
    let remaining = maxBytes - bytes - (chunks.length > 0 ? 1 : 0);
    if (remaining <= 0) { stop = true; return; }
    let out = buf;
    if (out.length > remaining) {
      let end = remaining;
      // Do not cut a multi-byte character in half.
      while (end > 0 && (out[end] & 0xc0) === 0x80) end--;
      out = out.subarray(0, end);
      stop = true;
    }
    const piece = out.toString('utf8');
    bytes += Buffer.byteLength(piece) + (chunks.length > 0 ? 1 : 0);
    chunks.push(piece);
  }

  function walk(dir, depth) {
    if (stop || depth > SOURCE_MAX_DEPTH) return;
    let names;
    try { names = fs.readdirSync(dir).sort(); } catch (_) { return; }
    for (const name of names) {
      if (stop) return;
      if (name.charAt(0) === '.') continue;
      const full = path.join(dir, name);
      let st;
      try { st = fs.lstatSync(full); } catch (_) { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (EXCLUDED_DIRS.has(name)) continue;
        walk(full, depth + 1);
      } else if (st.isFile() && depth >= 1 && name.endsWith('.md') && !EXCLUDED_FILES.has(name)) {
        takeFile(full, st.size);
      }
    }
  }

  try {
    walk(roomDir, 0);
  } catch (_) {
    return chunks.join('\n');
  }
  return chunks.join('\n');
}

module.exports = {
  CONTRACT_VERSION,
  NEVER_SAY_TERMS,
  loadContract,
  buildDenylist,
  splitArtifact,
  isReviewArtifact,
  checkReview,
  collectSourceText,
};
