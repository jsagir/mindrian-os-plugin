'use strict';
/*
 * report-from-transcript.cjs -- lab-side conversation-flow scorer.
 * =========================================================================
 * WHAT: takes a Larry conversation transcript, splits it into material (Larry)
 * turns plus running frame context, and scores each turn with the four LIVE
 * Plurai judge endpoints, then prints a per-turn + aggregate flow report. This
 * is the lab half of the tester conversation-flow report (D2 of the brief).
 *
 * WHY: the 2026-07-01 tester-cohort standup promise -- "did it FIRE THE RIGHT
 * THINGS AT THE RIGHT TIME... the quality of the conversation flow... I'm flying
 * blind without it." D1 (the paste-able extraction prompt) gets a clean report
 * OUT of a tester's Larry session; this script scores a returned transcript so
 * Jonathan can read progression / elevation / reach-gate / voice numbers.
 *
 * Brief: .planning/briefs/tester-conversation-flow-report-BRIEF.md
 * Standup: docs/testers/weekly-cohort/2026-07-01-standup.md
 *
 * The four judges (slugs + labels confirmed against the live Plurai workspace
 * 2026-07-01; each classifier is inputType=text, outputSchema={label, reason}):
 *   - cross-topic-connection        -> No Connection | Hedged | Confident
 *   - ai-turn-progress-evaluator    -> circular | progressing
 *   - reach-gate-choice-classifier  -> Correct | Wrong | Missed | Ambiguous
 *   - de-stijl-mark-classifier      -> Pass | Missing | Wrong-Color | Multiple
 *
 * Voice-signature REUSES lab/eval/voice-mark-hybrid.cjs: deterministic labels
 * (Missing / Multiple / Wrong-Color / native-host) resolve locally with ZERO
 * network; the de-stijl endpoint fires ONLY for the single-valid-mark
 * color-move-match beat (the "Pass?" case). That is the 0.75-laggard lesson.
 *
 * PART 8 (privacy): real tester transcripts carry real names + deal names. The
 * WHOLE raw transcript is scrubbed (emails redacted + a caller-supplied
 * name/deal replacement map) at a SINGLE choke point BEFORE any parse or any
 * Plurai call. Nothing unscrubbed can egress. Offline by default in tests.
 *
 * CJS only. No em-dashes. Node >= 22 (global fetch). Lives in lab/, not the user
 * hot path; kept under lab/eval/ to stay clear of Phase 205-09's lab/plurai-suite/.
 */

const fs = require('node:fs');
const path = require('node:path');
const { scoreVoiceMarkHybrid } = require(path.join(__dirname, 'voice-mark-hybrid.cjs'));
const { MARK_GLYPHS } = require(path.join(__dirname, '..', '..', 'lib', 'hmi', 'voice-color-mark.cjs'));

// A line that begins with a De Stijl voice glyph IS a Larry turn (Canon Part 12:
// every Larry turn wears the mark). This lets the parser handle raw transcripts
// that lack explicit "Larry:" labels. Reused from the detector so it never drifts.
const VOICE_GLYPHS = Object.keys(MARK_GLYPHS);
function startsWithVoiceGlyph(line) {
  const t = String(line).replace(/^[\s>*_-]+/, '');
  return VOICE_GLYPHS.some(function (g) { return t.startsWith(g); });
}

// -------------------------------------------------------------------------
// Endpoint map. Slug + version confirmed live 2026-07-01. The run-serving path
// is `${RUN_BASE}/ioa/v1/${slug}/${version}`; auth is `Authorization: Bearer`.
// The request-body field and response shape are centralized in buildRequestBody
// + parseJudgeResponse so a single edit corrects both if the live contract moves.
// -------------------------------------------------------------------------
const RUN_BASE = process.env.PLURAI_RUN_BASE || 'https://run.plurai.ai';
const VERSION = '1.0.0';

const JUDGES = {
  elevation: {
    slug: 'cross-topic-connection',
    title: 'cross-frame elevation',
    labels: ['No Connection', 'Hedged', 'Confident'],
  },
  progress: {
    slug: 'ai-turn-progress-evaluator',
    title: 'anti-circular',
    labels: ['circular', 'progressing'],
  },
  reachgate: {
    slug: 'reach-gate-choice-classifier',
    title: 'reach+gate',
    labels: ['Correct', 'Wrong', 'Missed', 'Ambiguous'],
  },
  voice: {
    slug: 'de-stijl-mark-classifier',
    title: 'voice-signature',
    labels: ['Pass', 'Missing', 'Wrong-Color', 'Multiple'],
  },
};

function endpointUrl(slug) {
  return `${RUN_BASE}/ioa/v1/${slug}/${VERSION}`;
}

// -------------------------------------------------------------------------
// Part 8 scrub. Single choke point: scrub the RAW transcript string before it is
// parsed or sent anywhere. Emails are always redacted; a caller-supplied
// replacement map pseudonymizes people + deal names.
// -------------------------------------------------------------------------
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function scrubText(raw, rules) {
  const r = rules || {};
  let text = String(raw == null ? '' : raw);
  const stats = { emails: 0, replaced: 0 };

  // 1) replacement map (names + deal names -> pseudonyms). Applied first so a
  // name embedded in an email local-part still gets pseudonymized before the
  // whole address collapses to [EMAIL].
  const pairs = normalizeReplacements(r.replacements);
  for (const [find, replace] of pairs) {
    if (!find) continue;
    const re = new RegExp(escapeRegExp(find), 'g');
    text = text.replace(re, function () { stats.replaced += 1; return replace; });
  }

  // 2) emails always redacted unless explicitly disabled.
  if (r.redactEmails !== false) {
    text = text.replace(EMAIL_RE, function () { stats.emails += 1; return '[EMAIL]'; });
  }

  return { text, stats };
}

function normalizeReplacements(replacements) {
  if (!replacements) return [];
  // Accept an array of [find, replace] pairs OR an object map {find: replace}.
  if (Array.isArray(replacements)) {
    return replacements
      .map(function (p) { return Array.isArray(p) ? [String(p[0]), String(p[1])] : null; })
      .filter(Boolean);
  }
  if (typeof replacements === 'object') {
    return Object.keys(replacements).map(function (k) { return [k, String(replacements[k])]; });
  }
  return [];
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Advisory only (Part 8 safety net): flag capitalized bigrams that look like
// unredacted person names when no replacement map was supplied. Never blocks.
function likelyUnredactedNames(text) {
  const SAFE = new Set([
    'De Stijl', 'Data Room', 'Shape F', 'No Connection', 'Wrong Color',
    'Larry', 'Mindrian', 'MindrianOS', 'Claude Code',
  ]);
  const found = new Set();
  const re = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const pair = `${m[1]} ${m[2]}`;
    if (!SAFE.has(pair)) found.add(pair);
  }
  return Array.from(found);
}

// -------------------------------------------------------------------------
// Transcript parsing. A material turn is a Larry / assistant turn. Two shapes
// are supported: speaker-prefixed lines ("Larry:", "You:", "User:") and markdown
// heading blocks ("### Larry"). Optional per-turn metadata for reach + gate is
// read from a bracket/comment annotation the extraction prompt (D1) can emit,
// e.g. "[reach: cross_room | gate: F.1]" or "<!-- reach=cross_room gate=F.1 -->".
// -------------------------------------------------------------------------
const LARRY_ROLES = new Set(['larry', 'assistant', 'ai', 'mindrian', 'mindry']);
const USER_ROLES = new Set(['you', 'user', 'navigator', 'human', 'tester', 'me']);

const SPEAKER_LINE_RE = /^\s*(?:[*_#>\s-]*)(Larry|Assistant|AI|Mindrian|Mindry|You|User|Navigator|Human|Tester|Me)\s*[:>–-]\s*(.*)$/i;
const HEADING_RE = /^\s*#{1,6}\s*(Larry|Assistant|AI|Mindrian|Mindry|You|User|Navigator|Human|Tester|Me)\b\s*(.*)$/i;

function roleOf(rawSpeaker) {
  const s = String(rawSpeaker || '').trim().toLowerCase();
  if (LARRY_ROLES.has(s)) return 'larry';
  if (USER_ROLES.has(s)) return 'user';
  return null;
}

function parseTranscript(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const turns = [];
  let current = null;

  function push() {
    if (current) {
      current.text = current.buffer.join('\n').trim();
      delete current.buffer;
      turns.push(current);
    }
  }

  for (const line of lines) {
    let match = SPEAKER_LINE_RE.exec(line);
    let rest = '';
    let speaker = null;
    if (match) { speaker = match[1]; rest = match[2] || ''; }
    else {
      match = HEADING_RE.exec(line);
      if (match) { speaker = match[1]; rest = match[2] || ''; }
    }
    const role = speaker ? roleOf(speaker) : null;
    if (role) {
      push();
      current = { role, buffer: rest ? [rest] : [], meta: {} };
    } else if (startsWithVoiceGlyph(line)) {
      // A glyph-led line always begins a new Larry turn (Part 12: exactly one mark
      // per turn, at the start). Keep the glyph in the text for the voice detector.
      push();
      current = { role: 'larry', buffer: [line], meta: {} };
    } else if (current) {
      current.buffer.push(line);
    }
    // lines before the first turn marker are preamble; ignored.
  }
  push();

  // Attach reach/gate metadata + index the material turns.
  let materialIndex = 0;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    t.absIndex = i;
    Object.assign(t.meta, extractTurnMeta(t.text));
    if (t.role === 'larry') { t.materialIndex = ++materialIndex; }
  }
  return { turns, materialCount: materialIndex };
}

function extractTurnMeta(text) {
  const meta = {};
  const reach = /(?:^|[[(<!\s-])reach\s*[:=]\s*([a-z_]+)/i.exec(text);
  const gate = /(?:^|[[(<!\s-])gate\s*[:=]\s*([A-Za-z0-9._-]+)/i.exec(text);
  if (reach) meta.reach = reach[1];
  if (gate) meta.gate = gate[1];
  return meta;
}

// Running context for the judges: the last N turns rendered role: text, capped
// so payloads stay small. Cross-frame + progression + reach-gate all need it.
function contextBefore(turns, absIndex, maxTurns, maxChars) {
  const n = maxTurns || 6;
  const cap = maxChars || 1500;
  const slice = turns.slice(Math.max(0, absIndex - n), absIndex);
  const rendered = slice
    .map(function (t) { return `${t.role === 'larry' ? 'Larry' : 'Navigator'}: ${t.text}`; })
    .join('\n');
  return rendered.length > cap ? rendered.slice(rendered.length - cap) : rendered;
}

// Format the single text input each classifier receives (they take ONE field).
function buildJudgeInput(judgeKey, turn, context) {
  const t = turn.text;
  if (judgeKey === 'voice') return t;
  if (judgeKey === 'progress') {
    return `## Conversation so far:\n${context || '(start of conversation)'}\n\n## Current AI turn:\n${t}`;
  }
  if (judgeKey === 'elevation') {
    return `## Conversation so far:\n${context || '(start of conversation)'}\n\n## Current AI turn:\n${t}`;
  }
  if (judgeKey === 'reachgate') {
    const reach = turn.meta.reach || '(not annotated)';
    const gate = turn.meta.gate || '(not annotated)';
    return `## Room and conversation state:\n${context || '(start of conversation)'}\n\n` +
      `## Reach Larry fired: ${reach}\n## Shape-F gate rendered: ${gate}\n\n## Larry turn:\n${t}`;
  }
  return t;
}

// -------------------------------------------------------------------------
// Transport. buildRequestBody + parseJudgeResponse isolate the live contract.
// callJudge returns { label, reason } or { label: 'ERROR', error: true, reason }.
// Never throws on a bad response; the report surfaces the error per-turn so an
// un-provisioned endpoint is a visible gap, not a crash.
// -------------------------------------------------------------------------
function buildRequestBody(inputText) {
  return JSON.stringify({ input: inputText });
}

function parseJudgeResponse(json) {
  if (!json || typeof json !== 'object') return { label: null, reason: '' };
  const label = json.label != null ? json.label
    : (json.output && json.output.label != null) ? json.output.label
    : (json.result && json.result.label != null) ? json.result.label
    : null;
  const reason = json.reason != null ? json.reason
    : (json.output && json.output.reason) ? json.output.reason
    : (json.result && json.result.reason) ? json.result.reason
    : '';
  return { label, reason };
}

async function callJudge(slug, apiKey, inputText, opts) {
  const o = opts || {};
  const doFetch = o.fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    return { label: 'ERROR', error: true, reason: 'no fetch implementation available' };
  }
  const url = endpointUrl(slug);
  try {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, o.timeoutMs || 30000) : null;
    let res;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: buildRequestBody(inputText),
        signal: controller ? controller.signal : undefined,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res || typeof res.status !== 'number' || res.status < 200 || res.status >= 300) {
      const status = res ? res.status : 'no-response';
      let bodyText = '';
      try { bodyText = res && res.text ? await res.text() : ''; } catch (_e) { bodyText = ''; }
      return { label: 'ERROR', error: true, reason: `HTTP ${status} ${String(bodyText).slice(0, 160)}`.trim() };
    }
    const json = await res.json();
    const parsed = parseJudgeResponse(json);
    if (parsed.label == null) {
      return { label: 'ERROR', error: true, reason: 'response had no label field' };
    }
    return parsed;
  } catch (err) {
    return { label: 'ERROR', error: true, reason: String(err && err.message ? err.message : err) };
  }
}

// -------------------------------------------------------------------------
// Scoring. For each material (Larry) turn: run voice via the hybrid (LLM leg
// only on Pass?), and run the other three judges unless --offline.
// -------------------------------------------------------------------------
async function scoreTurn(turn, context, apiKey, opts) {
  const o = opts || {};
  const offline = o.offline === true || !apiKey;
  const result = { materialIndex: turn.materialIndex, absIndex: turn.absIndex, meta: turn.meta, judges: {} };

  // Voice-signature: deterministic-first hybrid. The LLM leg fires only for a
  // single-valid-mark turn AND only when not offline.
  const voice = await scoreVoiceMarkHybrid(turn.text, {
    assumeLarryTurn: true,
    llmJudge: offline ? undefined : async function (turnText, color) {
      const r = await callJudge(JUDGES.voice.slug, apiKey, turnText, o);
      if (r.error) return 'Pass'; // network gap: keep the deterministic pre-verdict, do not invent Wrong-Color
      return r.label === 'Pass' ? 'Pass' : 'Wrong-Color';
    },
  });
  result.judges.voice = { label: voice.label, reason: voice.reason,
    deterministic: voice.deterministic === true, needsLlm: voice.needsLlm === true, color: voice.color };

  if (offline) {
    for (const key of ['elevation', 'progress', 'reachgate']) {
      result.judges[key] = { label: 'SKIPPED', reason: 'offline (no network judges)', skipped: true };
    }
    return result;
  }

  const [elevation, progress, reachgate] = await Promise.all([
    callJudge(JUDGES.elevation.slug, apiKey, buildJudgeInput('elevation', turn, context), o),
    callJudge(JUDGES.progress.slug, apiKey, buildJudgeInput('progress', turn, context), o),
    callJudge(JUDGES.reachgate.slug, apiKey, buildJudgeInput('reachgate', turn, context), o),
  ]);
  result.judges.elevation = elevation;
  result.judges.progress = progress;
  result.judges.reachgate = reachgate;
  return result;
}

async function scoreTranscript(rawTranscript, opts) {
  const o = opts || {};
  const scrub = scrubText(rawTranscript, o.scrubRules);
  const warnings = [];
  const pairs = normalizeReplacements((o.scrubRules || {}).replacements);
  if (pairs.length === 0) {
    const names = likelyUnredactedNames(scrub.text);
    if (names.length > 0) {
      warnings.push(`Part 8 advisory: ${names.length} possible unredacted name(s) and no scrub map supplied ` +
        `(e.g. ${names.slice(0, 3).join(', ')}). Provide a .scrub.json before sending real transcripts.`);
    }
  }

  const parsed = parseTranscript(scrub.text);
  const larryTurns = parsed.turns.filter(function (t) { return t.role === 'larry'; });
  const perTurn = [];
  for (const turn of larryTurns) {
    const context = contextBefore(parsed.turns, turn.absIndex);
    // eslint-disable-next-line no-await-in-loop -- turns are sequential by design (context ordering)
    const scored = await scoreTurn(turn, context, o.apiKey, o);
    perTurn.push(scored);
  }

  return {
    perTurn,
    aggregate: aggregate(perTurn),
    scrubStats: scrub.stats,
    warnings,
    materialCount: larryTurns.length,
    offline: o.offline === true || !o.apiKey,
  };
}

function aggregate(perTurn) {
  const agg = {
    turns: perTurn.length,
    progress: { progressing: 0, circular: 0, error: 0, skipped: 0 },
    elevation: { 'No Connection': 0, Hedged: 0, Confident: 0, error: 0, skipped: 0 },
    reachgate: { Correct: 0, Wrong: 0, Missed: 0, Ambiguous: 0, error: 0, skipped: 0 },
    voice: { Pass: 0, Missing: 0, 'Wrong-Color': 0, Multiple: 0, 'native-host': 0, error: 0 },
  };
  for (const t of perTurn) {
    tally(agg.progress, t.judges.progress);
    tally(agg.elevation, t.judges.elevation);
    tally(agg.reachgate, t.judges.reachgate);
    tally(agg.voice, t.judges.voice);
  }
  return agg;
}

function tally(bucket, judge) {
  if (!judge) return;
  if (judge.error) { bucket.error += 1; return; }
  if (judge.skipped) { bucket.skipped = (bucket.skipped || 0) + 1; return; }
  const label = judge.label;
  if (Object.prototype.hasOwnProperty.call(bucket, label)) bucket[label] += 1;
}

// -------------------------------------------------------------------------
// Report rendering. Plain text (this is a lab CLI, not a /mos: command surface).
// -------------------------------------------------------------------------
function formatReport(result) {
  const lines = [];
  lines.push('Conversation-flow report (lab-side, 4-judge Plurai)');
  lines.push('Source brief: .planning/briefs/tester-conversation-flow-report-BRIEF.md');
  lines.push('Cohort standup: docs/testers/weekly-cohort/2026-07-01-standup.md');
  lines.push('');
  lines.push(`Material Larry turns: ${result.materialCount}` +
    (result.offline ? '   [OFFLINE: only voice-signature scored deterministically]' : ''));
  lines.push(`Part 8 scrub: ${result.scrubStats.emails} email(s) redacted, ${result.scrubStats.replaced} mapped replacement(s).`);
  for (const w of result.warnings) lines.push(`WARN: ${w}`);
  lines.push('');
  lines.push('Per-turn:');
  for (const t of result.perTurn) {
    lines.push(`  turn ${t.materialIndex}:`);
    lines.push(`    voice-signature : ${fmtJudge(t.judges.voice)}`);
    lines.push(`    anti-circular   : ${fmtJudge(t.judges.progress)}`);
    lines.push(`    cross-frame     : ${fmtJudge(t.judges.elevation)}`);
    lines.push(`    reach+gate      : ${fmtJudge(t.judges.reachgate)}`);
  }
  lines.push('');
  lines.push('Aggregate:');
  lines.push(`  ${summaryLine(result.aggregate)}`);
  lines.push(`  progress   : ${dist(result.aggregate.progress)}`);
  lines.push(`  elevation  : ${dist(result.aggregate.elevation)}`);
  lines.push(`  reach+gate : ${dist(result.aggregate.reachgate)}`);
  lines.push(`  voice      : ${dist(result.aggregate.voice)}`);
  return lines.join('\n');
}

function fmtJudge(judge) {
  if (!judge) return '(none)';
  if (judge.skipped) return 'SKIPPED';
  if (judge.error) return `ERROR (${judge.reason})`;
  const tag = judge.deterministic ? ' [deterministic]' : '';
  return `${judge.label}${tag}`;
}

function dist(bucket) {
  return Object.keys(bucket)
    .filter(function (k) { return k !== 'turns' && bucket[k] > 0; })
    .map(function (k) { return `${bucket[k]} ${k}`; })
    .join(', ') || '(none)';
}

// The acceptance summary line, e.g. "3/5 progressing, 1 missed cross-frame, 0 voice violations".
function summaryLine(agg) {
  const total = agg.turns;
  const progressing = agg.progress.progressing;
  const missedCross = agg.elevation['No Connection'];
  const voiceViolations = agg.voice.Missing + agg.voice['Wrong-Color'] + agg.voice.Multiple;
  const parts = [
    `${progressing}/${total} progressing`,
    `${missedCross} missed cross-frame`,
    `${voiceViolations} voice violation${voiceViolations === 1 ? '' : 's'}`,
  ];
  const reachWrong = agg.reachgate.Wrong + agg.reachgate.Missed;
  parts.push(`${reachWrong} reach-gate miss${reachWrong === 1 ? '' : 'es'}`);
  return parts.join(', ');
}

// -------------------------------------------------------------------------
// Key + scrub-rule loading (CLI convenience; never used by the offline test).
// -------------------------------------------------------------------------
function loadApiKey() {
  if (process.env.PLURAI_API_KEY) return process.env.PLURAI_API_KEY;
  try {
    const p = path.join(require('node:os').homedir(), '.config', 'evals', 'credentials.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j.api_key || null;
  } catch (_e) {
    return null;
  }
}

function loadScrubRules(transcriptPath, cliReplacements) {
  const rules = { replacements: [] };
  const sidecar = `${transcriptPath}.scrub.json`;
  try {
    if (fs.existsSync(sidecar)) {
      const j = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      if (j.replacements) rules.replacements = normalizeReplacements(j.replacements);
      else rules.replacements = normalizeReplacements(j); // bare map or pair-array
      if (j.redactEmails === false) rules.redactEmails = false;
    }
  } catch (e) {
    process.stderr.write(`WARN: could not read scrub sidecar ${sidecar}: ${e.message}\n`);
  }
  for (const kv of cliReplacements || []) {
    const idx = kv.indexOf('=');
    if (idx > 0) rules.replacements.push([kv.slice(0, idx), kv.slice(idx + 1)]);
  }
  return rules;
}

// -------------------------------------------------------------------------
// CLI.
// -------------------------------------------------------------------------
function parseArgv(argv) {
  const args = { _: [], scrub: [], offline: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--offline') args.offline = true;
    else if (a === '--json') args.json = true;
    else if (a === '--scrub') { args.scrub.push(argv[++i]); }
    else if (a === '-h' || a === '--help') args.help = true;
    else args._.push(a);
  }
  return args;
}

async function main(argv) {
  const args = parseArgv(argv);
  if (args.help || args._.length === 0) {
    process.stdout.write(
      'Usage: node lab/eval/report-from-transcript.cjs <transcript-file> [--offline] [--json] [--scrub Name=Person1 ...]\n' +
      '  Scores a Larry conversation transcript with the four Plurai judge endpoints.\n' +
      '  Part 8: emails are always redacted; supply a <transcript>.scrub.json or --scrub pairs for names + deal names.\n' +
      '  --offline runs only the deterministic voice-signature (no network).\n');
    return args.help ? 0 : 1;
  }
  const transcriptPath = args._[0];
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch (e) {
    process.stderr.write(`ERROR: cannot read transcript ${transcriptPath}: ${e.message}\n`);
    return 1;
  }
  const scrubRules = loadScrubRules(transcriptPath, args.scrub);
  const apiKey = args.offline ? null : loadApiKey();
  if (!args.offline && !apiKey) {
    process.stderr.write('WARN: no Plurai API key (PLURAI_API_KEY or ~/.config/evals/credentials.json). Falling back to --offline.\n');
  }
  const result = await scoreTranscript(raw, { apiKey, offline: args.offline, scrubRules });
  process.stdout.write((args.json ? JSON.stringify(result, null, 2) : formatReport(result)) + '\n');
  return 0;
}

module.exports = {
  scrubText, normalizeReplacements, likelyUnredactedNames,
  parseTranscript, extractTurnMeta, contextBefore, buildJudgeInput,
  buildRequestBody, parseJudgeResponse, callJudge,
  scoreTurn, scoreTranscript, aggregate, formatReport, summaryLine,
  endpointUrl, loadScrubRules, JUDGES, main,
};

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code || 0); });
}
