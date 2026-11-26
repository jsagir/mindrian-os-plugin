#!/usr/bin/env node
'use strict';
// Phase 400.2-15: the offline overlap measure of the four researching hats (PS-06, risk K-11).
// It reads four evidence packs that the door wrote and computes, for each pair of hats, the share of result URLs that
// both hats got. It sends no request. It lives under tests/ and does not ship: package.json ships scripts/ only.
//
// Definitions (plan 400.2-15):
// - The result set of a hat is the set of paper keys of the items of its evidence pack (Phase 400.2-19). The paper key
//   of an item is its DOI, else its arXiv id, else its normalised URL, so one paper found through OpenAlex (DOI) and
//   through arXiv (abs URL) counts once. An arXiv DOI (10.48550/arxiv.<id>) is the same paper as its arXiv id.
// - share(A, B) = size of the intersection / size of the smaller set. An empty set gives null and the pair is no_result.
// - decision: change_needed when 1 or more measured pairs are above 0.5; else inconclusive when 3 or more of the 6 pairs
//   are no_result; else pass. A measured pair above 0.5 is a hard finding, so it outranks missing pairs.
// - The record holds counts and shares only: no URL and no title.
const fs = require('node:fs');
const path = require('node:path');

const HATS = Object.freeze(['white', 'black', 'yellow', 'green']);
const RECORD_SCHEMA = 'mos.persona-spike-overlap/1';
const PACK_SCHEMA = 'mos.persona-evidence/1';
const THRESHOLD = 0.5;
const LIMIT_NOTE = 'A hat has 5 URLs or fewer for one string: the lens run returns 5 findings or fewer for each call. The shares are over small sets.';

/** Equal URLs: scheme and host in lower case, no final slash, no fragment, no default port. Path and query are kept. */
function normaliseUrl(u) {
  const text = typeof u === 'string' ? u.trim() : '';
  if (!text) return '';
  try {
    const p = new URL(text);
    const pathname = p.pathname.replace(/\/+$/, '');
    return p.protocol + '//' + p.host + pathname + p.search;
  } catch (e) {
    return text.replace(/\/+$/, '');
  }
}

const DOI_RE = /10\.\d{4,9}\/[^\s?#]+/i;
const ARXIV_DOI_RE = /^10\.48550\/arxiv\.(.+)$/i;
const DOI_HOSTS = Object.freeze(['doi.org', 'dx.doi.org']);

/** The lower case DOI of an item: the doi field, else a doi.org URL. '' when there is none. */
function doiOf(item) {
  const field = item && typeof item.doi === 'string' ? item.doi.trim() : '';
  if (field) {
    const m = DOI_RE.exec(field);
    if (m) return m[0].toLowerCase().replace(/[.,;]+$/, '');
  }
  const url = item && typeof item.url === 'string' ? item.url.trim() : '';
  if (url) {
    try {
      const p = new URL(url);
      if (DOI_HOSTS.includes(p.hostname.toLowerCase())) {
        const m = DOI_RE.exec(decodeURIComponent(p.pathname.replace(/^\//, '')));
        if (m) return m[0].toLowerCase().replace(/[.,;]+$/, '');
      }
    } catch (e) { /* not a URL */ }
  }
  return '';
}

/** The arXiv id of an arxiv.org abs or pdf URL, without the version. '' when the URL is not an arXiv URL. */
function arxivIdOf(url) {
  const text = typeof url === 'string' ? url.trim() : '';
  if (!text) return '';
  try {
    const p = new URL(text);
    const host = p.hostname.toLowerCase();
    if (host !== 'arxiv.org' && !host.endsWith('.arxiv.org')) return '';
    const m = /^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?$/i.exec(p.pathname);
    if (!m) return '';
    return m[1].replace(/v\d+$/i, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

/**
 * The key of the paper behind one item: DOI, else arXiv id, else normalised URL. '' for an item with none of them.
 * An arXiv DOI maps to the arXiv key, so OpenAlex and arXiv agree on a preprint.
 */
function paperKey(item) {
  const doi = doiOf(item);
  if (doi) {
    const a = ARXIV_DOI_RE.exec(doi);
    if (a) return 'arxiv:' + a[1].replace(/v\d+$/i, '');
    return 'doi:' + doi;
  }
  const url = item && typeof item.url === 'string' ? item.url : '';
  const arx = arxivIdOf(url);
  if (arx) return 'arxiv:' + arx;
  const n = normaliseUrl(url);
  return n ? 'url:' + n : '';
}

function itemsOf(pack) {
  if (Array.isArray(pack)) return pack.map(x => (typeof x === 'string' ? { url: x } : x));
  return pack && Array.isArray(pack.items) ? pack.items : [];
}

function urlSet(pack) {
  const set = new Set();
  for (const item of itemsOf(pack)) {
    const n = paperKey(item);
    if (n) set.add(n);
  }
  return set;
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

/**
 * The 6 pairs of the four hats, in the order white-black, white-yellow, white-green, black-yellow, black-green,
 * yellow-green. packs: {white, black, yellow, green}, each an evidence pack (or a list of URLs).
 * @returns {Array<{a: string, b: string, shared: number, size_a: number, size_b: number, share: number|null, state: 'ok'|'no_result'}>}
 */
function pairShares(packs) {
  const sets = {};
  for (const hat of HATS) sets[hat] = urlSet(packs && packs[hat]);
  const pairs = [];
  for (let i = 0; i < HATS.length; i += 1) {
    for (let j = i + 1; j < HATS.length; j += 1) {
      const a = HATS[i];
      const b = HATS[j];
      const sa = sets[a];
      const sb = sets[b];
      let shared = 0;
      for (const u of sa) if (sb.has(u)) shared += 1;
      const smaller = Math.min(sa.size, sb.size);
      if (smaller === 0) pairs.push({ a, b, shared, size_a: sa.size, size_b: sb.size, share: null, state: 'no_result' });
      else pairs.push({ a, b, shared, size_a: sa.size, size_b: sb.size, share: round3(shared / smaller), state: 'ok' });
    }
  }
  return pairs;
}

/** @returns {'pass'|'change_needed'|'inconclusive'} */
function decision(pairs) {
  const list = Array.isArray(pairs) ? pairs : [];
  if (list.some(p => p && p.state === 'ok' && typeof p.share === 'number' && p.share > THRESHOLD)) return 'change_needed';
  if (list.filter(p => p && p.state === 'no_result').length >= 3) return 'inconclusive';
  return 'pass';
}

function stringsOf(pack) {
  const list = pack && Array.isArray(pack.strings) ? pack.strings : [];
  return list.map(s => (s && typeof s.text === 'string' ? s.text : '')).filter(Boolean);
}

function providersOf(pack) {
  const ran = new Set();
  const notRan = new Set();
  for (const s of (pack && Array.isArray(pack.strings) ? pack.strings : [])) {
    for (const p of (s && Array.isArray(s.providers) ? s.providers : [])) {
      if (!p || typeof p.provider !== 'string') continue;
      if (p.operation_state === 'executed_with_results' || p.operation_state === 'executed_empty') ran.add(p.provider);
      else notRan.add(p.provider);
    }
  }
  return { ran: Array.from(ran).sort(), not_executed: Array.from(notRan).filter(x => !ran.has(x)).sort() };
}

/**
 * The spike record: date, handle, the strings, the providers, the item counts, the 6 shares, the decision.
 * It copies no URL and no title.
 */
function buildRecord(input) {
  const o = input || {};
  const packs = o.packs || {};
  const pairs = pairShares(packs);
  const strings = {};
  const providers = {};
  const providersNotExecuted = {};
  const itemCounts = {};
  const researchStates = {};
  for (const hat of HATS) {
    const pack = packs[hat] || {};
    strings[hat] = stringsOf(pack).join(' | ');
    const pv = providersOf(pack);
    providers[hat] = pv.ran;
    providersNotExecuted[hat] = pv.not_executed;
    itemCounts[hat] = itemsOf(pack).length;
    researchStates[hat] = typeof pack.research_state === 'string' ? pack.research_state : 'unknown';
  }
  return {
    schema: RECORD_SCHEMA,
    date: typeof o.date === 'string' ? o.date : new Date().toISOString().slice(0, 10),
    handle: typeof o.handle === 'string' ? o.handle : '',
    strings,
    providers,
    providers_not_executed: providersNotExecuted,
    research_states: researchStates,
    item_counts: itemCounts,
    shares: pairs.map(p => ({ pair: [p.a, p.b], shared: p.shared, size_a: p.size_a, size_b: p.size_b, share: p.share, state: p.state })),
    threshold: THRESHOLD,
    decision: decision(pairs),
    limit_note: LIMIT_NOTE,
  };
}

function readPacks(dir) {
  const packs = {};
  for (const hat of HATS) {
    const file = path.join(dir, hat + '.json');
    let value;
    try {
      value = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return { ok: false, reason: 'pack_unreadable:' + hat };
    }
    if (!value || value.schema !== PACK_SCHEMA || value.hat !== hat) return { ok: false, reason: 'pack_invalid:' + hat };
    packs[hat] = value;
  }
  return { ok: true, packs };
}

/** The handle of the spike: the common start of the four strings, as the pack says. */
function handleOf(packs) {
  const first = stringsOf(packs.white)[0] || '';
  const q = 'data statistics';
  return first.endsWith(' ' + q) ? first.slice(0, first.length - q.length - 1) : first;
}

function main(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (typeof argv[i] === 'string' && argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[i + 1];
  }
  if (typeof flags.packs !== 'string' || typeof flags.out !== 'string') {
    process.stderr.write('usage: lib-4002-hat-overlap.cjs --packs <dir with white.json black.json yellow.json green.json> --out <record path> [--handle <text>] [--date YYYY-MM-DD]\n');
    process.exitCode = 2;
    return undefined;
  }
  const read = readPacks(path.resolve(flags.packs));
  if (!read.ok) {
    process.stderr.write('overlap: ' + read.reason + '\n');
    process.exitCode = 1;
    return undefined;
  }
  const record = buildRecord({ date: flags.date, handle: typeof flags.handle === 'string' ? flags.handle : handleOf(read.packs), packs: read.packs });
  const out = path.resolve(flags.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(record, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({ ok: true, out, decision: record.decision, item_counts: record.item_counts, shares: record.shares.map(s => ({ pair: s.pair.join('-'), share: s.share, state: s.state })) }, null, 2) + '\n');
  process.exitCode = 0;
  return record;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { HATS, RECORD_SCHEMA, THRESHOLD, normaliseUrl, paperKey, pairShares, decision, buildRecord, readPacks, main };
