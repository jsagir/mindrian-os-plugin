'use strict';
// lib/core/decision-advisor/domain.cjs -- Phase 400 Plan 09 (CY-05).
//
// The room's cause and effect domain applied to a shortlist. Pure. It is not a second
// ranker: it never changes a band or a value, it reorders only inside the strong band,
// and it keeps a top tie as a tie. The advisor advises and the host judges (D-02).
//
// Only methodology commands take part in move matching (F-05): a command fits a domain
// when its registry kind is methodology and its move_type equals the domain's move.
//
// Rules of applyDomain(shortlist, domain), in this order:
//   1. domain not a closed domain, or state not ok and not no_strong_pick: the same object.
//   2. chaotic: a copy with state no_strong_pick and options unchanged (F-04), effect no_fit.
//   3. disorder: a copy with state and options unchanged, effect note (O-03, no forced abstain).
//   4. a top tie of 2 or more: a copy with options unchanged, effect tie_kept.
//   5. else: fit strong options first, other strong options next, possible and weak options
//      after them, each part in its order; ranks 1..n; effect reordered or no_change.
//
// Reads data/command-registry.json and data/cynefin-domains.json relative to this file,
// cached. Requires only node:fs and node:path so a hook can load it inside its budget.

const fs = require('node:fs');
const path = require('node:path');

// Frozen copies of lib/core/problem-axes.cjs CAUSE_EFFECT_DOMAINS and DOMAIN_MOVE, so this
// module loads nothing else. tests/test-400-advisor-domain.cjs leg A9 pins the copies.
const CAUSE_EFFECT_DOMAINS = Object.freeze(['clear', 'complicated', 'complex', 'chaotic', 'disorder']);
const DOMAIN_MOVE = Object.freeze({
  clear: 'categorize',
  complicated: 'analyze',
  complex: 'probe',
  chaotic: 'act',
  disorder: 'slice',
});

const DOMAIN_EFFECTS = Object.freeze(['no_fit', 'note', 'tie_kept', 'reordered', 'no_change']);

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const REGISTRY_FILE = path.join(DATA_DIR, 'command-registry.json');
const DOMAINS_FILE = path.join(DATA_DIR, 'cynefin-domains.json');

let labelsCache = null;
let domainsCache = null;

function isDomain(x) {
  return typeof x === 'string' && CAUSE_EFFECT_DOMAINS.indexOf(x) !== -1;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return null; }
}

// capabilityLabels(): { '<command>': { kind, move_type } } from the registry. Never throws.
function capabilityLabels() {
  if (labelsCache) return labelsCache;
  const reg = readJson(REGISTRY_FILE);
  const out = {};
  const list = reg && Array.isArray(reg.commands) ? reg.commands : [];
  for (const c of list) {
    if (!c || typeof c.command !== 'string') continue;
    out[c.command] = {
      kind: typeof c.kind === 'string' ? c.kind : null,
      move_type: typeof c.move_type === 'string' ? c.move_type : null,
    };
  }
  labelsCache = Object.freeze(out);
  return labelsCache;
}

function domainFile() {
  if (domainsCache) return domainsCache;
  const d = readJson(DOMAINS_FILE);
  domainsCache = d && typeof d === 'object' ? d : { domains: [], host_notes: {} };
  return domainsCache;
}

// fitsDomain(command, domain): true when the command is a methodology command whose
// move_type is the domain's move.
function fitsDomain(command, domain) {
  if (!isDomain(domain)) return false;
  const l = capabilityLabels()[command];
  return !!l && l.kind === 'methodology' && l.move_type === DOMAIN_MOVE[domain];
}

// domainInfo(id): { id, verb_order } from data/cynefin-domains.json, or null.
function domainInfo(id) {
  if (!isDomain(id)) return null;
  const list = Array.isArray(domainFile().domains) ? domainFile().domains : [];
  const d = list.find((x) => x && x.id === id);
  if (!d) return null;
  return { id, verb_order: Array.isArray(d.verb_order) ? d.verb_order.slice() : [] };
}

// hostNote(id): the host note text for disorder and chaotic, else null.
function hostNote(id) {
  if (id !== 'disorder' && id !== 'chaotic') return null;
  const notes = domainFile().host_notes || {};
  const n = notes[id];
  return n && typeof n.text === 'string' && n.text ? n.text : null;
}

// Rule 5 over a list of items with a band word. Returns { items, fits }.
// getName reads the command name of one item. Possible and weak items never rise.
function fitFirst(items, domain, getName) {
  const fit = [];
  const other = [];
  const tail = [];
  for (const it of items) {
    if (it.band !== 'strong') tail.push(it);
    else if (fitsDomain(getName(it), domain)) fit.push(it);
    else other.push(it);
  }
  return { items: fit.concat(other, tail), fits: fit.map(getName) };
}

function applyDomain(shortlist, domain) {
  if (!isDomain(domain) || !shortlist || typeof shortlist !== 'object') return shortlist;
  if (shortlist.state !== 'ok' && shortlist.state !== 'no_strong_pick') return shortlist;
  const options = Array.isArray(shortlist.options) ? shortlist.options : [];
  if (domain === 'chaotic') {
    return Object.assign({}, shortlist, {
      state: 'no_strong_pick',
      no_strong_pick: true,
      options: options.map((o) => Object.assign({}, o)),
      domain: { id: domain, effect: 'no_fit' },
    });
  }
  if (domain === 'disorder') {
    return Object.assign({}, shortlist, {
      options: options.map((o) => Object.assign({}, o)),
      domain: { id: domain, effect: 'note' },
    });
  }
  if (Number.isInteger(shortlist.top_tie) && shortlist.top_tie >= 2) {
    return Object.assign({}, shortlist, {
      options: options.map((o) => Object.assign({}, o)),
      domain: { id: domain, effect: 'tie_kept' },
    });
  }
  const r = fitFirst(options, domain, (o) => o.command);
  const changed = r.items.some((o, i) => o !== options[i]);
  return Object.assign({}, shortlist, {
    options: r.items.map((o, i) => Object.assign({}, o, { rank: i + 1 })),
    domain: { id: domain, effect: changed ? 'reordered' : 'no_change', fits: r.fits },
  });
}

module.exports = {
  CAUSE_EFFECT_DOMAINS,
  DOMAIN_MOVE,
  DOMAIN_EFFECTS,
  capabilityLabels,
  fitsDomain,
  fitFirst,
  domainInfo,
  hostNote,
  applyDomain,
};
