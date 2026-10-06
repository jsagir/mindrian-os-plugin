'use strict';
/*
 * lib/core/feyminto/brief.cjs -- the reader-facing brief: ten blocks, generated, with the basis it was rendered from.
 *
 * Plan 369.25-18 (FBRIEF-01, FBRIEF-05; FeyMinto design v2 "The reader-facing brief", adoption notes 1, 4, 5, 7;
 * ICM audit change 9: BRIEF.md is a generated projection, not a fourth stored face, so there is still one owner per
 * state). renderBrief turns the three faces (MINTO.md, FEYNMAN.md, BRAIN.md), the nest's job, the room identity, the
 * decision log, the research-run records and the room's claim records into one markdown text:
 *
 *   THIS NEST SERVES, WE CURRENTLY THINK, BECAUSE, BUT, WHAT CHANGED, THE QUESTION THAT MATTERS NOW, PROPOSED NEXT MOVE,
 *   THEO'S CONTRIBUTION, YOUR DECISION, RECORD BASIS
 *
 * Rules this module keeps (each is a test arm in tests/test-36925-brief.cjs):
 *   - Claim-state words (data/claim-state-vocabulary.json, annex C16) are shown only as `<label>: <definition>` with the
 *     record each stands on. They are a vocabulary, not a ladder. The word "confirm" is emitted only inside
 *     canonically_confirmed, which needs a node a person confirmed in room.db (Canon Part 9).
 *   - Proposed, selected, attempted and verified are four separate lines. A run with no terminal record, or a run.json
 *     whose shape is not recognized, is shown as unresolved, and an earlier unresolved run stays listed until reconciled.
 *   - The next move is what next-move.cjs composes (agreement across sources first, Theo's rank last), never Theo's
 *     top line. When the command-line and Desktop/Cowork primaries differ both are printed, because BRIEF.md is one
 *     file read on all three surfaces.
 *   - Theo's real response envelope is unconfirmed, so the Theo block renders only what the face recorded. A face that
 *     was not asked says "not asked" with its reason, never a blank.
 *   - RECORD BASIS names the room id and each input's content hash and mtime; freshness is read off those, never asserted.
 *   - The body is held under BRIEF_MAX_TOKENS (bytes / 4); long lists are cut and point at the face that holds the rest.
 *   - The banned agreement stem and the empty-answer sentinel are scrubbed from the output (built from pieces here so
 *     this file does not carry them).
 *
 * Pure except for read-only reads of the nest's own files, the plugin's data and, when the caller does not pass the
 * claims in, a read-only room.db handle opened through lib/core/navigation.cjs. No network, no Brain call, no write.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const NM = require('./next-move.cjs');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');

const BRIEF_BLOCKS = Object.freeze([
  '## THIS NEST SERVES',
  '## WE CURRENTLY THINK',
  '## BECAUSE',
  '## BUT',
  '## WHAT CHANGED',
  '## THE QUESTION THAT MATTERS NOW',
  '## PROPOSED NEXT MOVE',
  "## THEO'S CONTRIBUTION",
  '## YOUR DECISION',
  '## RECORD BASIS',
]);
// Derivation (plan 12): MINTO 2000 (FEYNMINTO-12) + FEYNMAN 1500 (FEYNMINTO-01) + this 2000 keeps the largest measured
// fixture load of 1902 tokens plus the contract at 7402 of the walk's 8000 flag.
const BRIEF_MAX_TOKENS = 2000;
const INPUT_FILES = Object.freeze(['MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'CONTEXT.md', 'ROOM.md']);
const UNRESOLVED_THOUGHT = 'No governing thought yet: an explicit unresolved position.';
const DECISION_START = '<!-- feyminto:your-decision:start -->';
const DECISION_END = '<!-- feyminto:your-decision:end -->';
const DEFAULT_DECISION = 'Choose, revise, defer or reject the proposed move above. Answer through the decision card for this nest; the answer is recorded in the MINTO.md decision_log. Until you answer, nothing proposed here has run.';
const FALLBACK_AGENTS = Object.freeze(['larry', 'brain', 'system', 'assistant']);

const BANNED_STEM = new RegExp(['corro', 'borat'].join('') + '\\w*', 'gi');
const EMPTY_SENTINEL = '(no ' + 'signal)';

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }
function oneLine(s) { return String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim(); }
function clip(s, n) { const t = oneLine(s); return t.length > n ? t.slice(0, n - 3) + '...' : t; }
function scrub(s) { return String(s).split(EMPTY_SENTINEL).join('[withheld]').replace(BANNED_STEM, '[withheld]'); }
function sha256(buf) { return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex'); }
function titleCase(slug) { return String(slug).split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' '); }

// ---- the claim-state vocabulary -------------------------------------------------------------------------------------

let vocabCache = null;
function vocabulary() {
  if (!vocabCache) {
    const doc = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'data', 'claim-state-vocabulary.json'), 'utf8'));
    vocabCache = new Map();
    arr(doc.labels).forEach((l) => vocabCache.set(l.label, { definition: l.definition, record: l.record }));
  }
  return vocabCache;
}

function agentIdentities() {
  try {
    const set = require('../navigation/transitions.cjs').AGENT_IDENTITIES;
    if (set && typeof set.has === 'function') return set;
  } catch (_e) { /* fall back to the literal closed list */ }
  return new Set(FALLBACK_AGENTS);
}

function isPerson(by) {
  return typeof by === 'string' && by.trim().length > 0 && !agentIdentities().has(by.trim().toLowerCase());
}

/**
 * claimStateFor(claim, records) -> { label, definition, record, states, disputed }
 *   claim    { id, text, source }  (id may be null for a claim that only exists as a line in MINTO.md)
 *   records  { review_status, confirmed_by, standing, status, verification: [checking records] } (room.db, read through
 *            lib/core/navigation.cjs readClaimVerification by gatherClaimRecords) or null
 * The first state whose records hold wins, tested in the order canonically_confirmed, quote_matched,
 * independently_checked, source_reports, derived. That is the order a resolver reads the records in, not a ranking:
 * `states` lists every state the records support, and the brief shows only the first, with the count of the rest.
 */
function claimStateFor(claim, records) {
  const c = isObj(claim) ? claim : {};
  const r = isObj(records) ? records : {};
  const id = typeof c.id === 'string' && c.id ? c.id : null;
  const who = id || 'this claim';
  const recs = arr(r.verification).filter(isObj);
  const supports = recs.filter((x) => x.result === 'supports');
  const V = vocabulary();
  const states = [];
  function push(label, record) {
    const v = V.get(label);
    states.push({ label, definition: v ? v.definition : '', record });
  }
  const detail = (x) => String(x.against_id) + ' via ' + String(x.method) + ' on ' + who;

  if (r.review_status === 'confirmed' && isPerson(r.confirmed_by)) push('canonically_confirmed', 'node ' + who + ', confirmed by ' + String(r.confirmed_by).trim());
  const quote = supports.find((x) => x.method === 'compare' && (x.against_kind === 'artifact' || x.against_kind === 'source') && x.against_id);
  if (quote) push('quote_matched', detail(quote));
  const independent = supports.find((x) => x.against_id && (
    ['experiment', 'observation', 'person'].indexOf(x.against_kind) !== -1 ||
    ['test', 'observe'].indexOf(x.method) !== -1 ||
    (x.against_kind === 'source' && x.method !== 'compare' && c.source && x.against_id !== c.source)));
  if (independent) push('independently_checked', detail(independent));
  const readSource = supports.find((x) => (x.against_kind === 'source' || x.against_kind === 'artifact') && x.against_id);
  if (c.source) push('source_reports', String(c.source));
  else if (r.standing === 'source_edge' || r.standing === 'located_source') push('source_reports', 'a source edge on ' + who);
  else if (readSource) push('source_reports', String(readSource.against_id));
  if (states.length === 0) push('derived', r.standing === 'model_only' ? who + ' was checked only by asking a model' : 'no source or check on record for ' + who);

  const disputed = r.status === 'disputed';
  const first = states[0];
  return {
    label: first.label,
    definition: first.definition,
    record: first.record + (disputed ? '; checking record: disputed' : ''),
    states,
    disputed,
  };
}

// ---- reading the room (claims) --------------------------------------------------------------------------------------

/**
 * gatherClaimRecords(roomDir, section) -> [{ id, text, source: null, records }]
 * The claim nodes filed in this section, read through lib/core/navigation.cjs only: a read-only handle, then
 * readClaimVerification for the checking record and the standing. Any failure is no claims (a legacy room.db).
 */
function gatherClaimRecords(roomDir, section) {
  let navigation;
  try { navigation = require('../navigation.cjs'); } catch (_e) { return []; }
  let db = null;
  try {
    db = navigation.openRoomDbReadOnlyForCaller(roomDir);
    if (!db) return [];
    const hasSourceSection = db.prepare('PRAGMA table_info(nodes)').all().some((c) => c.name === 'source_section');
    const where = hasSourceSection ? "(json_extract(properties,'$.section') = ? OR source_section = ?)" : "json_extract(properties,'$.section') = ?";
    const args = hasSourceSection ? [section, section] : [section];
    const rows = db.prepare("SELECT id, review_status, confirmed_by FROM nodes WHERE type = 'claim' AND " + where + ' ORDER BY rowid LIMIT 50').all(...args);
    const out = [];
    rows.forEach((row) => {
      const v = navigation.readClaimVerification(db, row.id);
      if (!v || v.ok !== true) return;
      const cl = v.claim;
      out.push({
        id: row.id,
        text: cl.text,
        source: null,
        records: {
          review_status: row.review_status,
          confirmed_by: row.confirmed_by,
          standing: cl.standing,
          status: cl.checking_record.status,
          verification: cl.checking_record.records,
        },
      });
    });
    return out;
  } catch (_e) {
    return [];
  } finally {
    try { if (db) navigation.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
  }
}

function readIdentity(roomDir) {
  try {
    return require('../navigation/room-identity.cjs').readRoomIdentity(roomDir, { door: 'in_place' });
  } catch (e) {
    return { ok: false, state: 'not_ready', reason: 'identity_unreadable', detail: String((e && e.message) || e).slice(0, 120) };
  }
}

// ---- RECORD BASIS ---------------------------------------------------------------------------------------------------

function roomIdFromFaces(sectionPath) {
  for (const f of ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md']) {
    try {
      const t = fs.readFileSync(path.join(sectionPath, f), 'utf8');
      const m = t.match(/^(?:room_id|room):\s*"?([^"\r\n]+?)"?\s*$/m);
      if (m && m[1] !== 'unknown') return m[1];
    } catch (_e) { /* absent */ }
  }
  return null;
}

// 369.25-26 (P6): FEYNMAN.md carries three generated timestamp lines that the timeline and dial-memory renderers
// rewrite to "now" at every session start, with no content change. Hashing them made every brief read stale after a
// session-start. They are left out of the FEYNMAN.md digest, and only they: the two frontmatter keys, and the
// '*Last refreshed: <ISO>. ...*' line in each of its three emitted shapes (the two dial-memory sentences, and the
// timeline summary line whose event counts and first and last touched times still count; only its refresh time and
// the relative '(N minutes ago)' text, both functions of the clock, are masked). Anything else moves the digest.
const GEN_ISO = '\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ';
const GEN_FM_KEYS_RE = /^(?:timeline_last_rendered|dial_memory_last_rendered):[^\r\n]*(?:\r?\n|$)/gm;
const GEN_DIAL_LINE_RE = new RegExp('^\\*Last refreshed: ' + GEN_ISO + '\\. (?:No dial activity yet\\.|Dial activity tracked as a typed graph relationship layer\\.)\\*[ \\t]*(?:\\r?\\n|$)', 'gm');
const GEN_TIMELINE_LINE_RE = new RegExp('^\\*Last refreshed: ' + GEN_ISO + '\\. (\\d+ insight events, first captured [^\\r\\n]*?, last touched [^\\r\\n]*?) \\([^)\\r\\n]*\\)\\.\\*', 'gm');
function maskGeneratedFeynmanLines(text) {
  let s = String(text);
  const fm = s.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (fm) s = fm[0].replace(GEN_FM_KEYS_RE, '') + s.slice(fm[0].length);
  return s.replace(GEN_DIAL_LINE_RE, '').replace(GEN_TIMELINE_LINE_RE, '*Last refreshed: <time>. $1 (<elapsed>).*');
}

/**
 * recordBasis(sectionPath, identity, extras) -> { room_id, inputs, absent, fingerprint, full_fingerprint, extras }
 *   inputs       [{ file, sha256, mtime }] for each input file that exists (MINTO, FEYNMAN, BRAIN, CONTEXT, ROOM)
 *   fingerprint  sha256 over the input files only (what a session-start reader recomputes from the nest alone)
 *   full_fingerprint  also folds in the extras the caller supplies ([{ label, digest }]: claim and run records)
 * The room id is shown, not hashed: every face already carries it, so an identity change moves the file hashes.
 */
function recordBasis(sectionPath, identity, extras) {
  const inputs = [];
  const absent = [];
  const lines = [];
  INPUT_FILES.forEach((f) => {
    const p = path.join(sectionPath, f);
    let buf = null;
    let mtime = null;
    try { buf = fs.readFileSync(p); mtime = fs.statSync(p).mtime.toISOString(); } catch (_e) { buf = null; }
    if (buf === null) { absent.push(f); lines.push(f + ' absent'); return; }
    // inputs[].sha256 is the hash freshness is judged on, so the session-start reader's "which input moved" matches
    // the fingerprint; FEYNMAN.md is hashed with its generated timestamp lines left out (see above).
    const h = sha256(f === 'FEYNMAN.md' ? Buffer.from(maskGeneratedFeynmanLines(buf.toString('utf8')), 'utf8') : buf);
    inputs.push({ file: f, sha256: h, mtime });
    lines.push(f + ' ' + h);
  });
  const fingerprint = sha256(lines.join('\n'));
  const ex = arr(extras).filter(isObj).map((e) => ({ label: String(e.label), digest: String(e.digest) }));
  const full = sha256(fingerprint + '\n' + ex.map((e) => e.label + ' ' + e.digest).sort().join('\n'));
  const roomId = isObj(identity) && identity.ok === true && typeof identity.room_id === 'string' ? identity.room_id : roomIdFromFaces(sectionPath);
  return { room_id: roomId || 'unknown', inputs, absent, fingerprint, full_fingerprint: full, extras: ex };
}

// ---- the blocks -----------------------------------------------------------------------------------------------------

function claimLine(entry, clipLen) {
  const st = claimStateFor(entry.claim, entry.records);
  const more = st.states.length > 1 ? ' (+' + (st.states.length - 1) + ' more recorded state' + (st.states.length > 2 ? 's' : '') + ' in the claim view)' : '';
  return '- ' + clip(entry.claim.text, clipLen) + ' [' + st.label + ': ' + st.definition + '; record: ' + st.record + ']' + more;
}

function becauseBlock(nest, claims, cap, clipLen) {
  const entries = [];
  const seen = new Set();
  arr(claims).forEach((c) => {
    if (!isObj(c) || typeof c.text !== 'string') return;
    seen.add(oneLine(c.text));
    entries.push({ origin: 'room', claim: { id: c.id, text: c.text, source: c.source || null }, records: c.records });
  });
  nest.minto.claims.forEach((c) => {
    if (seen.has(oneLine(c.title))) return;
    entries.push({ origin: 'minto', claim: { id: null, text: c.title, source: c.source || null }, records: null });
  });
  if (entries.length === 0) return 'No supporting claim is recorded yet: this nest has no key claim in MINTO.md and no claim filed in the room graph.';
  const shown = entries.slice(0, cap);
  const lines = shown.map((e) => claimLine(e, clipLen));
  const omitted = entries.slice(cap);
  if (omitted.some((e) => e.origin === 'room')) lines.push('(more in the room graph)');
  if (omitted.some((e) => e.origin === 'minto')) lines.push('(more in MINTO.md)');
  return lines.join('\n');
}

function weakest(minto) {
  const rec = minto.assumptions.find((a) => a.state !== 'model narrative');
  const a = rec || minto.assumptions[0] || null;
  return a;
}

function butBlock(nest, cap, clipLen) {
  const lines = [];
  const a = weakest(nest.minto);
  if (a) lines.push('Weakest assumption: ' + clip(a.text, clipLen) + ' (' + a.state + ')');
  else lines.push('Weakest assumption: none recorded in the room yet; an assumption nobody has written down is itself a gap.');
  lines.push('');
  const counter = nest.minto.counter;
  if (counter.length === 0) lines.push('Counterevidence: none recorded in the room yet.');
  else {
    lines.push('Counterevidence:');
    counter.slice(0, cap).forEach((l) => lines.push('- ' + clip(l, clipLen)));
    if (counter.length > cap) lines.push('(more in MINTO.md)');
  }
  const others = nest.minto.assumptions.filter((x) => x !== a);
  if (others.length > 0) {
    lines.push('', 'Other assumptions:');
    others.slice(0, cap).forEach((x) => lines.push('- ' + clip(x.text, clipLen) + ' (' + x.state + ')'));
    if (others.length > cap) lines.push('(more in MINTO.md)');
  }
  const unexplained = nest.feynman.cannot_explain.filter((l) => !NM.NOTHING_RE.test(l));
  if (unexplained.length > 0) {
    lines.push('', 'Not yet explained:');
    unexplained.slice(0, Math.min(cap, 3)).forEach((l) => lines.push('- ' + clip(l, clipLen)));
    if (unexplained.length > Math.min(cap, 3)) lines.push('(more in FEYNMAN.md)');
  }
  return lines.join('\n');
}

function changedBlock(nest, cap, clipLen) {
  if (!nest.feynman.exists) return 'No FEYNMAN.md on this nest, so no change record exists.';
  const items = nest.feynman.what_changed;
  if (items.length === 0) return 'FEYNMAN.md holds no what-changed entry yet.';
  const lines = items.slice(0, cap).map((l) => '- ' + clip(l, clipLen));
  if (items.length > cap) lines.push('(more in FEYNMAN.md)');
  return lines.join('\n');
}

function questionBlock(nest, clipLen) {
  const wc = nest.minto.would_change[0];
  if (wc) return clip(wc, clipLen * 2);
  const gap = nest.feynman.cannot_explain.find((l) => !NM.NOTHING_RE.test(l));
  if (gap) return clip(gap, clipLen * 2);
  return 'Not yet stated.';
}

function moveName(m) { return '/mos:' + m.command; }
function moveHead(m) { return moveName(m) + ' - ' + (m.capability && m.capability.label ? m.capability.label : 'capability not labeled'); }

function normalizeNextMove(input) {
  const nm = input;
  if (isObj(nm) && Object.prototype.hasOwnProperty.call(nm, 'cli') && Object.prototype.hasOwnProperty.call(nm, 'mcp') && !Object.prototype.hasOwnProperty.call(nm, 'primary')) {
    return { pair: true, cli: isObj(nm.cli) ? nm.cli : {}, mcp: isObj(nm.mcp) ? nm.mcp : {} };
  }
  return { pair: false, cli: isObj(nm) ? nm : {}, mcp: isObj(nm) ? nm : {} };
}

function selectedLine(nest, clipLen) {
  const entries = nest.minto.decision_log.filter((d) => isObj(d) && typeof d.user_response === 'string' && d.user_response.trim().length > 0);
  if (entries.length === 0) return 'Selected: none yet';
  const d = entries[entries.length - 1];
  return 'Selected: ' + clip(d.action || 'unnamed decision', clipLen) + ' (' + clip(d.user_response, 80) + ')' + (d.timestamp ? ' on ' + d.timestamp : '');
}

function attemptedLines(nest) {
  const runs = nest.runs;
  if (runs.length === 0) return ['Attempted: none yet'];
  const latest = runs[0];
  const lines = [];
  if (latest.status === 'terminal') {
    lines.push('Attempted: ' + (latest.mode || 'research') + ' run ' + latest.run_id + ' finished ' + latest.finished_at + ', stop reason ' + latest.stop_reason + ' (a finished run is not a verified result)');
  } else {
    lines.push('Attempted: unresolved: run ' + latest.run_id + ' has no terminal record (' + latest.reason + ')');
  }
  const others = runs.slice(1).filter((r) => r.status === 'unresolved');
  others.slice(0, 2).forEach((r) => lines.push('Unresolved: run ' + r.run_id + ' (' + r.reason + '); it stays unresolved until someone reconciles it'));
  if (others.length > 2) lines.push('Unresolved: ' + (others.length - 2) + ' more earlier runs');
  return lines;
}

function verifiedLine(claims) {
  const checked = arr(claims).filter((c) => isObj(c) && isObj(c.records) && arr(c.records.verification).length > 0);
  if (checked.length === 0) return 'Verified: none yet';
  const ids = checked.slice(0, 3).map((c) => c.id).filter(Boolean).join(', ');
  return 'Verified: ' + checked.length + ' claim' + (checked.length === 1 ? '' : 's') + ' in this nest carry a checking record' + (ids ? ' (' + ids + ')' : '') + '; none of them is a result of the move above';
}

function moveBlock(nmInput, nest, claims, cap, clipLen) {
  const n = normalizeNextMove(nmInput);
  const cliCmd = n.cli.primary && n.cli.primary.command;
  const mcpCmd = n.mcp.primary && n.mcp.primary.command;
  const differ = n.pair && cliCmd !== mcpCmd;
  const lines = [];
  let proposed;
  let alternatives;
  let outcomesDiffer;
  const noPrimary = (nm) => 'Primary: none. ' + (nm.why || NM.NO_PRIMARY_LINE);
  if (differ) {
    [['On the command line: ', n.cli], ['In Desktop and Cowork: ', n.mcp]].forEach((pair) => {
      const nm = pair[1];
      if (nm.primary) lines.push(pair[0] + moveHead(nm.primary) + '. Why: ' + clip(nm.primary.why, clipLen * 2));
      else lines.push(pair[0] + 'none. ' + (nm.why || NM.NO_PRIMARY_LINE));
    });
    proposed = 'Proposed: ' + [cliCmd ? moveName(n.cli.primary) + ' on the command line' : null, mcpCmd ? moveName(n.mcp.primary) + ' in Desktop and Cowork' : null].filter(Boolean).join('; ') + ' (a proposal; nothing has run)';
    const seen = new Set([cliCmd, mcpCmd]);
    alternatives = [];
    arr(n.cli.alternatives).concat(arr(n.mcp.alternatives)).forEach((a) => { if (isObj(a) && !seen.has(a.command)) { seen.add(a.command); alternatives.push(a); } });
    outcomesDiffer = n.cli.outcomes_differ === true || n.mcp.outcomes_differ === true || (!!cliCmd && !!mcpCmd);
  } else {
    const nm = n.cli;
    if (nm.primary) {
      lines.push('Primary: ' + moveHead(nm.primary));
      lines.push('Why: ' + clip(nm.primary.why, clipLen * 2));
      if (arr(nm.primary.sources).length > 0) lines.push('Sources: ' + nm.primary.sources.join(', '));
      proposed = 'Proposed: ' + moveName(nm.primary) + ' (a proposal; nothing has run)';
    } else {
      lines.push(noPrimary(nm));
      proposed = 'Proposed: no runnable move for this nest';
    }
    alternatives = arr(nm.alternatives).filter(isObj);
    outcomesDiffer = nm.outcomes_differ === true;
  }
  // Plan 06's marker: when the navigator data and the section contract agree that no command is dedicated to this
  // section, say so beside the move, so a general command is never read as the section's own.
  let marker = null;
  try { marker = require('./capability.cjs').sectionMarker(nest.section); } catch (_e) { marker = null; }
  if (marker) lines.push('Note: ' + marker + '. The primary above is a general command, not one dedicated to this section.');
  if (alternatives.length > 0) {
    lines.push(outcomesDiffer ? 'Alternatives (their outcomes differ: they rest on different sources):' : 'Alternatives:');
    alternatives.slice(0, Math.max(1, cap)).forEach((a) => lines.push('- ' + moveHead(a) + '; ' + clip(a.why, clipLen)));
  }
  lines.push('');
  lines.push(proposed);
  lines.push(selectedLine(nest, clipLen));
  attemptedLines(nest).forEach((l) => lines.push(l));
  lines.push(verifiedLine(claims));
  return lines.join('\n');
}

function theoBlock(nest, clipLen) {
  const face = nest.face;
  let notAskedLines = {};
  try { notAskedLines = require('./theo-ask.cjs').NOT_ASKED_LINES || {}; } catch (_e) { notAskedLines = {}; }
  if (!face.exists) return 'Theo: not asked. This nest has no BRAIN.md face yet (reason: face_missing), so no Theo guidance is on record. The move above comes from the contract, the ledger and the nest itself.';
  if (!face.keyed) return 'Theo: not recorded. BRAIN.md has no FeyMinto face keys, so nothing says whether Theo was asked, with which handles, or what came back. See BRAIN.md for what it does hold.';
  if (!face.asked) {
    const code = face.not_asked_reason || 'not_recorded';
    const line = notAskedLines[code] || ('not asked: ' + code);
    const tier = face.staleness === 'unavailable' ? ' (staleness unavailable, so the engine reads this nest at tier_0)' : (face.staleness ? ' (staleness ' + face.staleness + ')' : '');
    return 'Theo: ' + line + ' (reason: ' + code + '). This nest has no Theo guidance' + tier + '. The move above comes from the contract, the ledger and the nest itself. Full face: BRAIN.md.';
  }
  const lines = [];
  lines.push('Theo was asked' + (face.asked_at ? ' on ' + face.asked_at : '') + (face.theo_origin ? ' (origin ' + face.theo_origin + ')' : '') + ': ' + (face.queries_sent === null ? 'query count not recorded' : face.queries_sent + ' queries') + '; handles on the wire: ' + (face.handles_on_wire || 'not recorded') + '.');
  const r = face.rows;
  lines.push('Rows returned: frameworks ' + (r.find_frameworks === null ? 'n/a' : r.find_frameworks) + ', commands ' + (r.commands === null ? 'n/a' : r.commands) + ', route ' + (r.route === null ? 'n/a' : r.route) + ', neighborhood ' + (r.neighborhood === null ? 'n/a' : r.neighborhood) + '.');
  if (face.queries_sent === 0) lines.push('A zero query count is an investigation lead, not a verdict.');
  if (face.commands.length > 0) lines.push('Suggested commands: ' + face.commands.slice(0, 5).map((c) => c.name + ' (' + (c.cli || '?') + ' / ' + (c.mcp || '?') + ')').join(', ') + (face.commands.length > 5 ? ' and ' + (face.commands.length - 5) + ' more' : '') + '.');
  if (face.frameworks.length > 0) lines.push('Suggested frameworks: ' + face.frameworks.slice(0, 6).join(', ') + '.');
  if (face.refusals) lines.push('Refusals: ' + face.refusals.split(',').join(', ') + '.');
  const lim = face.limitations.filter((l) => !/^## /.test(l)).slice(0, 2).map((l) => clip(l, clipLen * 2));
  if (lim.length > 0) lines.push('Limitations the face records: ' + lim.join(' '));
  lines.push('Theo\'s own rank is not the next move: the move above is composed from all three faces, the job and the constraints. Full face: BRAIN.md (provenance, three command sources, limitations).');
  return lines.join('\n');
}

function basisBlock(basis, identity, extras) {
  const lines = [];
  const id = isObj(identity) && identity.ok === true;
  lines.push('Room: ' + basis.room_id + (id && identity.slug ? ' (' + identity.slug + ')' : '') + (id ? '' : ' (identity not ready' + (identity && identity.reason ? ': ' + identity.reason : '') + ')'));
  lines.push('Inputs read at render time, each with its content hash and last-modified time:');
  basis.inputs.forEach((i) => lines.push('- ' + i.file + ' ' + i.sha256 + ' modified ' + i.mtime));
  basis.absent.forEach((f) => lines.push('- ' + f + ' absent'));
  extras.forEach((e) => lines.push('- ' + e.label + ': ' + e.summary + ' (digest ' + e.digest.slice(0, 12) + ')'));
  lines.push('Fingerprint: ' + basis.fingerprint);
  lines.push('Freshness is read off the inputs above: this brief is current only while every hash still matches the file on disk.');
  return lines.join('\n');
}

function digestOf(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }

// ---- renderBrief ----------------------------------------------------------------------------------------------------

/**
 * renderBrief({ sectionPath, roomDir?, identity?, nextMove?, nextMoveInputs?, claims?, yourDecision?, now? }) -> markdown
 *   sectionPath     the nest directory (required)
 *   roomDir         the room directory; default the parent of sectionPath
 *   identity        readRoomIdentity's result; read in place when absent
 *   nextMove        composeNextMove's result, or { cli, mcp } of two; composed through nextMoveForSection when absent
 *   nextMoveInputs  composeNextMove's arguments, composed here (one surface each when surface is not given)
 *   claims          [{ id, text, source, records }] from gatherClaimRecords; read through navigation when absent
 *   yourDecision    the text a person left inside the YOUR DECISION block (kept verbatim), if any
 *   now             a function returning an ISO time (a test seam)
 * Returns the whole file text: frontmatter (generated: true), then the ten blocks.
 */
function renderBrief(input) {
  const inp = isObj(input) ? input : {};
  const sectionPath = path.resolve(String(inp.sectionPath || ''));
  const roomDir = path.resolve(String(inp.roomDir || path.dirname(sectionPath)));
  const section = path.basename(sectionPath);
  const identity = isObj(inp.identity) ? inp.identity : readIdentity(roomDir);
  const nest = NM.gatherNest({ roomDir, sectionDir: sectionPath });
  const claims = Array.isArray(inp.claims) ? inp.claims : gatherClaimRecords(roomDir, section);

  let nextMove = inp.nextMove;
  if (!isObj(nextMove)) {
    if (isObj(inp.nextMoveInputs)) {
      nextMove = {
        cli: NM.composeNextMove(Object.assign({}, inp.nextMoveInputs, { surface: 'cli' })),
        mcp: NM.composeNextMove(Object.assign({}, inp.nextMoveInputs, { surface: 'mcp' })),
      };
    } else {
      nextMove = {
        cli: NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'cli', nest }),
        mcp: NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'mcp', nest }),
      };
    }
  }

  const claimsDigest = digestOf(claims.map((c) => [c.id, c.text, isObj(c.records) ? [c.records.review_status, c.records.confirmed_by, c.records.status, arr(c.records.verification).length] : null]));
  const runsDigest = digestOf(nest.runs.map((r) => [r.run_id, r.status, r.stop_reason, r.finished_at]));
  const extras = [
    { label: 'claim records', digest: claimsDigest, summary: claims.length + ' claim' + (claims.length === 1 ? '' : 's') + ' filed in this section' },
    { label: 'run records', digest: runsDigest, summary: nest.runs.length + ' research run' + (nest.runs.length === 1 ? '' : 's') + ' for this nest' },
  ];
  const basis = recordBasis(sectionPath, identity, extras.map((e) => ({ label: e.label, digest: e.digest })));
  const nowIso = typeof inp.now === 'function' ? String(inp.now()) : new Date().toISOString();
  const preserved = typeof inp.yourDecision === 'string' && inp.yourDecision.trim().length > 0 ? inp.yourDecision.trim() : null;

  function build(cap, clipLen) {
    const serves = (nest.job.id ? 'Job: ' + nest.job.id + '.' : 'Job: not declared for this nest.') + ' ' + (nest.job.statement ? nest.job.statement : 'This nest\'s ROOM.md carries no statement.');
    let think;
    if (nest.minto.governing_thought && !nest.minto.placeholder) think = clip(nest.minto.governing_thought, clipLen * 3);
    else think = UNRESOLVED_THOUGHT;
    if (nest.minto.exists && nest.minto.last_generated_at) think += '\nFrom MINTO.md, generated ' + nest.minto.last_generated_at + '.';
    const blocks = [
      serves,
      think,
      becauseBlock(nest, claims, cap, clipLen),
      butBlock(nest, cap, clipLen),
      changedBlock(nest, cap, clipLen),
      questionBlock(nest, clipLen),
      moveBlock(nextMove, nest, claims, cap, clipLen),
      theoBlock(nest, clipLen),
      DECISION_START + '\n' + (preserved || DEFAULT_DECISION) + '\n' + DECISION_END,
      basisBlock(basis, identity, extras),
    ];
    const parts = ['# ' + titleCase(section) + ' brief', '', 'Rendered from MINTO.md, FEYNMAN.md, BRAIN.md, the room records and the room identity. Only YOUR DECISION is editable; every other block is regenerated.', ''];
    BRIEF_BLOCKS.forEach((h, i) => { parts.push(h, '', blocks[i], ''); });
    return scrub(parts.join('\n'));
  }

  const tokensOf = (body) => Math.ceil(Buffer.byteLength(body, 'utf8') / 4);
  let body = null;
  const plans = [[8, 200], [6, 200], [4, 160], [3, 120], [2, 100], [1, 80], [1, 50]];
  for (let k = 0; k < plans.length; k++) {
    body = build(plans[k][0], plans[k][1]);
    if (tokensOf(body) <= BRIEF_MAX_TOKENS) break;
  }

  const fmLines = [
    '---',
    'type: feyminto-brief',
    'face: feyminto-brief',
    'generated: true',
    'generated_at: "' + nowIso + '"',
    'section: ' + section,
    'room_id: ' + basis.room_id,
  ];
  if (!(isObj(identity) && identity.ok === true) && isObj(identity) && identity.reason) fmLines.push('room_identity: ' + identity.reason);
  fmLines.push(
    'record_basis_fingerprint: ' + basis.fingerprint,
    'record_basis_full_fingerprint: ' + basis.full_fingerprint,
    'edit_surface: "YOUR DECISION is the one editable block: answer through the decision card; every other block is regenerated"',
    'editable_fields: [your_decision]',
    'edit_recorded_in: "decision record in MINTO.md decision_log, committed by the owner"',
    '---',
    ''
  );
  return scrub(fmLines.join('\n')) + body;
}

module.exports = {
  renderBrief,
  BRIEF_BLOCKS,
  BRIEF_MAX_TOKENS,
  claimStateFor,
  recordBasis,
  maskGeneratedFeynmanLines,
  gatherClaimRecords,
};
