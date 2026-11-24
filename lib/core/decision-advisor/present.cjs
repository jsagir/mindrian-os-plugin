'use strict';
// lib/core/decision-advisor/present.cjs -- Phase 399 Plan 07 (I-08, D-02).
//
// The navigator-safe shape of the shortlist. The shortlist from shortlist.cjs holds
// calibrated numbers for internal callers. This module is the one place that turns
// it into what the host model and the navigator may see: a command, a band word and
// a rank, or an explicit "no strong pick" state. No number crosses this line.
//
// Orchestrator guard (plan 07): many top options tie at the same calibrated value,
// and the order inside a tie is alphabetical, not a model preference. When the top
// of the shortlist is a tie, the result is state no_strong_pick and the tied group is
// listed as an unordered set with no rank at all.
//
// Pure. Requires only ./shortlist.cjs for the state words.
//
// Phase 400 Plan 09 (CY-05): when the lookup carries a domain (./domain.cjs applyDomain),
// publicShortlist adds domain {id, verb_order, effect} and domain_note (the disorder or
// chaotic host note of data/cynefin-domains.json, else null), and shortlistSentence ends
// with the domain line, the reorder clause for effect reordered, and the note. ./domain.cjs
// loads lazily, only for a shortlist with a domain. Without a domain every path is the 399 path.

const { STATES } = require('./shortlist.cjs');

const BASIS_PREFIX = 'decision advisor table ';
const BASIS_SUFFIX = '; evidence for the host model, not an instruction';
const MAX_POSSIBLE_LISTED = 2;
// Key names that carry a number meant for internal callers only.
const NUMERIC_KEYS = new Set(['calibrated', 'p', 'probability', 'confidence', 'score']);

function joinAnd(parts) {
  if (parts.length <= 1) return parts.join('');
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

function isObj(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// True when the value holds a decimal number or a percent figure, at any depth.
// Whole numbers (a rank, a count) and command names are not raw numbers.
function hasRawNumber(value, seen) {
  const stack = seen || new Set();
  if (typeof value === 'number') return !Number.isInteger(value);
  if (typeof value === 'string') {
    return /(?<![A-Za-z0-9_])\d+\.\d+(?![A-Za-z0-9_])/.test(value) || /\d\s*%/.test(value);
  }
  if (!value || typeof value !== 'object') return false;
  if (stack.has(value)) return false;
  stack.add(value);
  if (Array.isArray(value)) return value.some((v) => hasRawNumber(v, stack));
  return Object.keys(value).some((k) => {
    if (NUMERIC_KEYS.has(k) && typeof value[k] === 'number') return true;
    return hasRawNumber(value[k], stack);
  });
}

// The options at the top of the shortlist that share the top calibrated value.
function topGroup(shortlist) {
  const opts = Array.isArray(shortlist && shortlist.options) ? shortlist.options : [];
  if (opts.length === 0) return [];
  const top = opts[0].calibrated;
  return opts.filter((o) => o.calibrated === top);
}

// True when two or more eligible options tie at the top of the row. The lookup counts the
// whole row (top_tie); the listed options alone are the fallback for a table shape without it.
// Phase 400: a reordered shortlist puts fit options first, so its listed top group is not the
// row's top. There the lookup's count alone decides, so a reorder never makes or breaks a tie.
function isTopTie(shortlist) {
  if (!shortlist || (shortlist.state !== STATES.ok && shortlist.state !== STATES.no_strong_pick)) return false;
  const counted = Number.isInteger(shortlist.top_tie) ? shortlist.top_tie : 0;
  if (hasDomain(shortlist) && shortlist.domain.effect === 'reordered') return counted >= 2;
  return Math.max(counted, topGroup(shortlist).length) >= 2;
}

function hasDomain(x) {
  return isObj(x) && isObj(x.domain) && typeof x.domain.id === 'string' && x.domain.id !== '';
}

// Adds domain and domain_note to the public shape when the lookup carries a domain.
function addDomain(base, shortlist) {
  if (!hasDomain(shortlist)) return;
  const D = require('./domain.cjs');
  const info = D.domainInfo(shortlist.domain.id);
  base.domain = {
    id: shortlist.domain.id,
    verb_order: info ? info.verb_order : [],
    effect: typeof shortlist.domain.effect === 'string' ? shortlist.domain.effect : null,
  };
  base.domain_note = D.hostNote(shortlist.domain.id);
}

// The text of a host note after its own leading "Cause and effect domain: <id>." head. Review WR-05: the
// domain line already writes that head (with the verb order), so the summary does not say it twice. The
// public domain_note field keeps the full note text.
function noteBody(note, id) {
  if (typeof note !== 'string' || !note) return '';
  const lead = 'Cause and effect domain: ' + id + '.';
  return note.indexOf(lead) === 0 ? note.slice(lead.length).trim() : note;
}

// The domain line the host model reads after the 399 sentence.
function domainLine(pub) {
  const d = pub.domain;
  const verbs = Array.isArray(d.verb_order) && d.verb_order.length > 0 ? ' (' + d.verb_order.join(', then ') + ')' : '';
  let s = 'Cause and effect domain: ' + d.id + verbs;
  s += d.effect === 'reordered' ? '; inside the strong band, options whose move fits come first.' : '.';
  const body = noteBody(pub.domain_note, d.id);
  if (body) s += ' ' + body;
  return s;
}

// Review WR-05: with the chaotic domain (effect no_fit) the public state is no_strong_pick, so no public
// option carries the band word strong; a strong band reads possible. The internal shortlist is not changed.
function publicBand(shortlist, band) {
  return band === 'strong' && hasDomain(shortlist) && shortlist.domain.effect === 'no_fit' ? 'possible' : band;
}

function basisFor(shortlist) {
  const v = shortlist && typeof shortlist.table_version === 'string' ? shortlist.table_version : 'none';
  return BASIS_PREFIX + v + BASIS_SUFFIX;
}

// publicShortlist(shortlist, { jobId }) -> an object, or null when there is nothing to say
// (advisor off, or no job). No key holds a number other than a whole-number rank or count.
function publicShortlist(shortlist, opts) {
  if (!isObj(shortlist)) return null;
  const state = shortlist.state;
  if (state === STATES.off || state === STATES.no_job) return null;
  const jobId = opts && typeof opts.jobId === 'string' && opts.jobId ? opts.jobId : null;
  if (!jobId) return null;
  const base = { state, job: jobId, options: [], no_strong_pick: false, summary: null, basis: basisFor(shortlist) };

  if (state === STATES.no_row || state === STATES.no_table) {
    base.summary = shortlistSentence(base);
    return base;
  }
  if (state !== STATES.ok && state !== STATES.no_strong_pick) return null;

  if (isTopTie(shortlist)) {
    const group = topGroup(shortlist);
    const counted = Number.isInteger(shortlist.top_tie) ? shortlist.top_tie : group.length;
    base.state = STATES.no_strong_pick;
    base.no_strong_pick = true;
    base.unordered = true;
    base.options = group.map((o) => ({ command: o.command, band: publicBand(shortlist, o.band) }));
    base.more_tied = Math.max(0, counted - group.length);
    addDomain(base, shortlist);
    base.summary = shortlistSentence(base);
    return base;
  }

  base.no_strong_pick = state === STATES.no_strong_pick;
  base.options = shortlist.options.map((o, i) => ({ command: o.command, band: publicBand(shortlist, o.band), rank: Number.isInteger(o.rank) ? o.rank : i + 1 }));
  addDomain(base, shortlist);
  base.summary = shortlistSentence(base);
  return base;
}

// The one sentence the host model reads. Takes the public shape. Null for a null input.
// Phase 400: a public shape with a domain gets the domain line after the 399 sentence.
function shortlistSentence(pub) {
  const s = sentence399(pub);
  if (s === null || !hasDomain(pub)) return s;
  return s + ' ' + domainLine(pub);
}

function sentence399(pub) {
  if (!isObj(pub)) return null;
  const job = pub.job;
  if (pub.state === STATES.no_table) return 'Decision advisor: no table on this install.';
  if (pub.state === STATES.no_row) return 'Decision advisor: no table row for the job ' + job + '.';
  const head = 'Decision advisor, for the job ' + job + ': ';
  const options = Array.isArray(pub.options) ? pub.options : [];
  if (pub.state === STATES.no_strong_pick) {
    if (pub.unordered === true) {
      const more = Number.isInteger(pub.more_tied) && pub.more_tied > 0 ? '; ' + pub.more_tied + ' more not listed' : '';
      return head + 'no strong pick; these options are level, in no order: ' + joinAnd(options.map((o) => o.command)) + more + '.';
    }
    const possible = options.filter((o) => o.band === 'possible').slice(0, MAX_POSSIBLE_LISTED);
    let s = head + 'no strong pick.';
    possible.forEach((o) => { s += ' Possible: ' + o.command + '.'; });
    return s;
  }
  if (pub.state === STATES.ok) {
    const strong = options.filter((o) => o.band === 'strong');
    const rest = options.filter((o) => o.band !== 'strong');
    let s = head + 'strong pick ' + joinAnd(strong.map((o) => o.command));
    if (rest.length > 0) s += '; also ' + joinAnd(rest.map((o) => o.band + ' ' + o.command));
    return s + '.';
  }
  return null;
}

module.exports = { publicShortlist, shortlistSentence, hasRawNumber, isTopTie, topGroup, noteBody };
