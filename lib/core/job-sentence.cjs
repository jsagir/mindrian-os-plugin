'use strict';
// Phase 400 plan 01: the one job-sentence module.
//
// O-01 formula: "When <when>, I want <want>, so I can <so>."
// Pattern 1: the three slots {when, want, so} are the stored truth. The sentence is a pure
// render of the slots. Free prose is never parsed into slots, except the ruled framework
// statements of data/framework-jobs.json, where frameworkSlots is a read-time view.
// O-11 and the runtime cost constraint: the slots live in their own frontmatter keys
// (job_when, job_want, job_so, job_sentence_status), never in description, because
// description loads into every session.
//
// Pure module: node:fs and node:path only, no network, no environment read.
const fs = require('node:fs');
const path = require('node:path');

const SLOT_KEYS = Object.freeze(['when', 'want', 'so']);
const FRONTMATTER_KEYS = Object.freeze({
  when: 'job_when',
  want: 'job_want',
  so: 'job_so',
  status: 'job_sentence_status',
});
const SENTENCE_STATUSES = Object.freeze(['provisional', 'ruled']);

const MAX_SLOT_CHARS = 160;
const HEAD = 'When ';
const MID = ', I want ';
const TAIL = ', so I can ';
const MARKERS = [MID, TAIL];

function renderJob(slots) {
  return HEAD + slots.when + MID + slots.want + TAIL + slots.so + '.';
}

// Anchored parse: the first ", I want " and the last ", so I can ". Never a bare comma.
function parseJob(sentence) {
  if (typeof sentence !== 'string') return null;
  if (!sentence.startsWith(HEAD) || !sentence.endsWith('.')) return null;
  const i = sentence.indexOf(MID);
  if (i < HEAD.length) return null;
  const j = sentence.lastIndexOf(TAIL);
  if (j < i + MID.length) return null;
  const out = {
    when: sentence.slice(HEAD.length, i),
    want: sentence.slice(i + MID.length, j),
    so: sentence.slice(j + TAIL.length, -1),
  };
  for (const k of SLOT_KEYS) if (!out[k]) return null;
  return out;
}

// Returns a list of error strings; [] means the slot set is valid.
// The limits protect the hand-rolled frontmatter parser of scripts/build-command-registry.cjs
// (no double quote, no backslash, no newline) and the anchored parse (no formula marker).
function slotErrors(slots) {
  const e = [];
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return ['slots is not an object'];
  for (const k of Object.keys(slots)) {
    if (!SLOT_KEYS.includes(k)) e.push('extra key ' + k);
  }
  for (const k of SLOT_KEYS) {
    const v = slots[k];
    if (typeof v !== 'string' || !v.trim()) {
      e.push(k + ' is missing or blank');
      continue;
    }
    if (v !== v.trim()) e.push(k + ' has surrounding space');
    if (v.length > MAX_SLOT_CHARS) e.push(k + ' is over ' + MAX_SLOT_CHARS + ' characters');
    if (/[\u2013\u2014]/.test(v)) e.push(k + ' has an en dash or an em dash');
    if (v.includes('"')) e.push(k + ' has a double quote');
    if (v.includes('\\')) e.push(k + ' has a backslash');
    if (/[\r\n]/.test(v)) e.push(k + ' has a newline');
    if (/[.;:!?]$/.test(v.trim())) e.push(k + ' ends with punctuation');
    for (const m of MARKERS) if (v.includes(m)) e.push(k + ' holds the marker "' + m.trim() + '"');
  }
  if (typeof slots.when === 'string' && /^when\b/i.test(slots.when.trim())) e.push('when begins with "when"');
  if (typeof slots.want === 'string' && slots.want.trim() && !slots.want.startsWith('to ')) e.push('want does not begin with "to "');
  if (typeof slots.so === 'string') {
    if (/^so\b/i.test(slots.so.trim())) e.push('so begins with "so"');
    if (/^i can\b/i.test(slots.so.trim())) e.push('so begins with "I can"');
  }
  return e;
}

// Slots from a parsed frontmatter object; null when any of the three keys is absent.
function slotsFromFrontmatter(fm) {
  if (!fm || typeof fm !== 'object') return null;
  const out = {};
  for (const k of SLOT_KEYS) {
    const v = fm[FRONTMATTER_KEYS[k]];
    if (typeof v !== 'string') return null;
    out[k] = v;
  }
  return out;
}

// Read-time view of one ruled framework statement. Accepts "so I can" and "so we can";
// keeps a leading "to " in want; the final period is optional.
function frameworkSlots(text) {
  if (typeof text !== 'string' || !text.startsWith(HEAD)) return null;
  const i = text.indexOf(MID);
  if (i < HEAD.length) return null;
  const jI = text.lastIndexOf(', so I can ');
  const jWe = text.lastIndexOf(', so we can ');
  const j = Math.max(jI, jWe);
  if (j < i + MID.length) return null;
  const tailLen = j === jI ? ', so I can '.length : ', so we can '.length;
  let so = text.slice(j + tailLen);
  if (so.endsWith('.')) so = so.slice(0, -1);
  const out = { when: text.slice(HEAD.length, i), want: text.slice(i + MID.length, j), so };
  for (const k of SLOT_KEYS) if (!out[k].trim()) return null;
  return out;
}

let cache = null;
// The ruled main statements of data/framework-jobs.json as {name, text, slots}. The file is
// read, never written (S1 reuse rule).
function frameworkSentences() {
  if (!cache) {
    const file = path.join(__dirname, '..', '..', 'data', 'framework-jobs.json');
    const fj = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out = [];
    for (const fw of fj.frameworks || []) {
      for (const j of fw.jobs || []) {
        if (j.status === 'ruled' && j.main === true) {
          out.push(Object.freeze({ name: fw.name, text: j.text, slots: frameworkSlots(j.text) }));
        }
      }
    }
    cache = Object.freeze(out);
  }
  return cache.slice();
}

module.exports = {
  SLOT_KEYS,
  FRONTMATTER_KEYS,
  SENTENCE_STATUSES,
  renderJob,
  parseJob,
  slotErrors,
  slotsFromFrontmatter,
  frameworkSlots,
  frameworkSentences,
};
