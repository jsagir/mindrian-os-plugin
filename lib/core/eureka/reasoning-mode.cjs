/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-01 -- the encoder-free reasoning-mode scoring core (SEED-058).
 *
 * WHAT THIS IS
 *   The fallback scoring path for /mos:eureka. When the local embedding encoder
 *   is unavailable (cold machine) or a room's typed-edge graph is too thin, the
 *   shipped embedded path hard-stops at pairs_scored:0. Reasoning-mode instead
 *   reads raw room markdown directly, pre-filters candidate pairs with the FREE
 *   Jaccard lexical anchor (the one numeric leg that survives with no encoder),
 *   runs the SAME Grounding Guard Stage B two-pass rubric at full rigor via the
 *   Claude-session-as-judge seam, and emits statements that structurally CANNOT
 *   carry a fabricated encoder number.
 *
 * THE LOAD-BEARING CORRECTNESS PROPERTY (D1 / G-1, REQ-1)
 *   2 of the critic's 3 numeric legs (differential_score, semantic_similarity)
 *   derive from the encoder this fallback exists to route around, so they are
 *   structurally null here. Only lsa_similarity (jaccard-v1, [0,1]) is a real
 *   number. buildReasoningStatement hard-codes both null legs and banked:false;
 *   assertReasoningInvariants is the deterministic refuse-to-emit guard the writer
 *   (plan 02) calls immediately before fs.writeFileSync. A judge can be wrong; an
 *   assertion on a null field cannot.
 *
 * CRITIC-BAR PARITY (D3 / G-2, REQ-2)
 *   The rubric is NOT softened for the fallback. emitReasoningPrompts calls
 *   critic.buildNeutralPrompt / critic.buildAdversarialPrompt byte-identically
 *   (never a third freer prompt), and scoreReasoningPairs calls critic.runRubric
 *   so CODE (verdictFromRubric, biased to reject) picks the verdict over exactly
 *   two judge passes. The lower confidence label comes ONLY from the missing
 *   similarity/calibration legs, never a slacker analogy bar.
 *
 * BOUNDED FAN-OUT (D8 / G-6, REQ-7)
 *   proposeCandidatePairs caps the paid rubric fan-out at
 *   MINDRIAN_EUREKA_REASONING_MAX_PAIRS (default 25), selected by the free Jaccard
 *   pre-filter, so cost is bounded by the cap, never by room size.
 *
 * RANKING RULE
 *   Only verdict === 'transferable' rows enter the ranked list, ordered ascending
 *   by lsa_similarity (LOW lexical overlap on a still-plausible pair is the eureka
 *   signature: shared meaning the vocabulary hides), rank = index + 1. Rejected
 *   rows are returned separately for provenance counting. No AHP composite is
 *   computed: a blended quality score would fuse trust-in-evidence with
 *   plausibility (D2's explicit Bad case).
 *
 * Canon Part 8: reads LOCAL markdown only, zero network surface, the in-session
 * Claude is the judge (never the Brain). Pure CJS, node built-ins + in-repo
 * requires only, zero new deps. No em-dashes.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// The Jaccard anchor: the ONE numeric leg that survives with no encoder.
const { lexicalOverlap, LEXICAL_METHOD } = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'lexical-overlap.cjs'));
// The encoder-free Grounding Guard: Stage B rubric + the shared prompt builders
// and Gate 1 regexes reasoning-mode reuses byte-identically (Phase 226 seam).
const critic = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka-critic.cjs'));
// The canonical statement assembler (byte-parity output contract).
const oppmod = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'opportunity-statement.cjs'));

// Versioned formula tag: distinguishes a reasoning-mode statement from embedded
// mode's eureka-critic-v1 so a re-run can tell the two apart. Bump if the
// candidate-proposal / anchor / assembly rules change.
const REASONING_FORMULA_VERSION = 'eureka-reasoning-v1';

// Directory / file skip sets (the generate-export.cjs SKIP_DIRS / SKIP_FILES
// precedent): identity scaffolding is not eureka evidence.
const SKIP_DIRS = Object.freeze(new Set(['node_modules', 'exports', '.mindrian', '.lazygraph', '.git', '.room-graph']));
const SKIP_FILES = Object.freeze(new Set(['ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md', 'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md']));

// Bodies shorter than this (after frontmatter + comment strip) are noise.
const MIN_BODY_CHARS = 40;

// ---------- reasoningMaxPairs ----------
//
// The eureka-critic.cjs env-tunable idiom (read at CALL time). A non-finite or
// non-positive value falls back to the default cap.
function envInt(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return (Number.isFinite(v) && v > 0) ? v : fallback;
}
function reasoningMaxPairs() {
  return envInt('MINDRIAN_EUREKA_REASONING_MAX_PAIRS', 25);
}

// ---------- readRoomMarkdown ----------
//
// Synchronous recursive walk of roomDir for *.md files, reading raw markdown
// DIRECTLY from the filesystem (NOT room.db), so it works before the write-path
// harness has populated the graph. Never throws on an unreadable file (skip);
// returns [] on a missing dir. Per file: strip YAML frontmatter + HTML comments,
// trim, drop bodies under the noise floor.

function stripBody(raw) {
  let body = String(raw == null ? '' : raw);
  // Strip a leading YAML frontmatter block (the loadCandidate idiom).
  body = body.replace(/^---\n[\s\S]*?\n---\n?/, '');
  // Strip HTML comments (READ-ONLY-FIXTURE markers etc.).
  body = body.replace(/<!--[\s\S]*?-->/g, '');
  return body.trim();
}

function extractTitle(raw, fileName) {
  const m = String(raw == null ? '' : raw).match(/^#\s+(.+?)\s*$/m);
  if (m) return m[1].trim();
  return fileName.replace(/\.md$/i, '');
}

function readRoomMarkdown(roomDir) {
  const out = [];
  let rootStat;
  try {
    rootStat = fs.statSync(roomDir);
  } catch (_e) {
    return out;
  }
  if (!rootStat.isDirectory()) return out;

  const stack = [roomDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      continue; // unreadable dir: skip, never throw
    }
    for (let i = 0; i < ents.length; i += 1) {
      const ent = ents[i];
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.charAt(0) === '.' || SKIP_DIRS.has(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile() && /\.md$/i.test(ent.name)) {
        if (SKIP_FILES.has(ent.name)) continue;
        let raw;
        try {
          raw = fs.readFileSync(full, 'utf8');
        } catch (_e) {
          continue; // unreadable file: skip
        }
        const body = stripBody(raw);
        if (body.length < MIN_BODY_CHARS) continue;
        const rel = path.relative(roomDir, full);
        const seg = rel.split(path.sep);
        const section = seg.length > 1 ? seg[0] : '(root)';
        out.push({ id: rel, section: section, title: extractTitle(raw, ent.name), text: body });
      }
    }
  }
  return out;
}

// ---------- proposeCandidatePairs ----------
//
// Mechanical cross-SECTION enumeration: all i<j pairs whose sections differ; if
// the room has fewer than 2 distinct sections, fall back to all i<j pairs. For
// every pair the free pure-CJS Jaccard anchor is computed (the AI-SPEC 4b
// cost-routing move: free math pre-filters the paid rubric). Sort ascending by
// lsa_similarity and cap at the reasoning-max ceiling. Pure, deterministic,
// never throws.

function proposeCandidatePairs(entries, opts) {
  const list = Array.isArray(entries) ? entries : [];
  const options = opts || {};
  const cap = Number.isFinite(options.maxPairs) && options.maxPairs > 0
    ? Math.floor(options.maxPairs)
    : reasoningMaxPairs();

  const sections = new Set(list.map(function (e) { return e.section; }));
  const crossOnly = sections.size >= 2;

  const raw = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (crossOnly && list[i].section === list[j].section) continue;
      raw.push([list[i], list[j]]);
    }
  }
  const pairsConsidered = raw.length;

  const scored = raw.map(function (pair) {
    return { a: pair[0], b: pair[1], lsa: lexicalOverlap(pair[0].text, pair[1].text) };
  });
  // Ascending by lexical overlap (the eureka band: low overlap, still plausible).
  scored.sort(function (x, y) { return x.lsa - y.lsa; });

  const candidates = [];
  const limit = Math.min(cap, scored.length);
  for (let k = 0; k < limit; k += 1) {
    const s = scored[k];
    candidates.push({
      id: 'P' + String(k + 1).padStart(4, '0'),
      a: s.a.id,
      b: s.b.id,
      section_a: s.a.section,
      section_b: s.b.section,
      title_a: s.a.title,
      title_b: s.b.title,
      lsa_similarity: s.lsa,
      lexical_method: LEXICAL_METHOD,
      text_a: s.a.text,
      text_b: s.b.text,
    });
  }
  return { pairs_considered: pairsConsidered, cap: cap, candidates: candidates };
}

// ---------- validateMappings ----------
//
// mappings is the session-written object keyed by candidate id:
// { mechanismText, mappingStatement }, both non-empty strings, each bound to
// 2000 chars (truncated honestly). A candidate with a missing/invalid mapping is
// EXCLUDED fail-closed and counted, never guessed.

function validateMappings(candidates, mappings) {
  const list = Array.isArray(candidates) ? candidates : [];
  const map = (mappings && typeof mappings === 'object') ? mappings : {};
  const valid = [];
  let excluded = 0;
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    const m = map[c.id];
    const mech = (m && typeof m.mechanismText === 'string') ? m.mechanismText.trim() : '';
    const mapping = (m && typeof m.mappingStatement === 'string') ? m.mappingStatement.trim() : '';
    if (mech.length === 0 || mapping.length === 0) {
      excluded += 1;
      continue;
    }
    valid.push(Object.assign({}, c, {
      mechanismText: mech.slice(0, 2000),
      mappingStatement: mapping.slice(0, 2000),
    }));
  }
  return { valid: valid, excluded_count: excluded };
}

// ---------- Gate 1 (encoder-free) ----------
//
// The ONLY Stage A gate reasoning-mode runs: the shared fabricated-quantity
// regexes (critic._gate1). Stage A's swap-invariance gate needs the absent
// encoder and is SKIPPED, never faked (AI-SPEC Pitfall 3). The regexes are
// non-global, so .test is stateless across calls.
function gate1Trips(candidate) {
  const combined = String(candidate.mechanismText || '') + ' ' + String(candidate.mappingStatement || '');
  return critic._gate1.FABRICATED_QUANTITY.test(combined) || critic._gate1.DOLLAR_FIGURE.test(combined);
}

// ---------- emitReasoningPrompts ----------
//
// Per candidate: run the encoder-free Gate 1. A tripped gate routes the
// candidate { stage_a_pass:false, route:'pseudoscience', tag:'unsourced_quantity' }
// with NO prompt files. Passing candidates get <id>.neutral.txt /
// <id>.adversarial.txt written from the EXPORTED critic builders (byte-parity by
// construction, never a local copy). A manifest.json mirrors the
// eureka-critic-run.cjs emitPrompts manifest shape.

function emitReasoningPrompts(workdir, validCandidates) {
  const list = Array.isArray(validCandidates) ? validCandidates : [];
  fs.mkdirSync(workdir, { recursive: true });
  // WR-02 fix: carry the prior manifest's retry_used flag forward. The
  // max-1-retry latch (AI-SPEC 4b, scripts/eureka-portfolio-report.cjs
  // reasoningStageScore) relies on retry_used surviving on disk across a
  // reasoning-prompts re-run. Without this, re-running --reasoning-emit between
  // a failed --reasoning-score attempt and the retry silently resets the latch,
  // and the "one retry allowed" bound the command doc promises is unenforced.
  let priorRetryUsed = false;
  try {
    const prior = JSON.parse(fs.readFileSync(path.join(workdir, 'manifest.json'), 'utf8'));
    priorRetryUsed = !!(prior && prior.retry_used === true);
  } catch (_e) {
    // no prior manifest / unreadable / unparseable -> fresh session, stays false
  }
  const manifest = {
    generated_at: new Date().toISOString(),
    formula_version: REASONING_FORMULA_VERSION,
    candidates: [],
  };
  if (priorRetryUsed) manifest.retry_used = true;
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (gate1Trips(c)) {
      manifest.candidates.push({
        id: c.id, stage_a_pass: false, route: 'pseudoscience', tag: 'unsourced_quantity', prompt_files: null,
      });
      continue;
    }
    const nPath = path.join(workdir, c.id + '.neutral.txt');
    const aPath = path.join(workdir, c.id + '.adversarial.txt');
    fs.writeFileSync(nPath, critic.buildNeutralPrompt(c), 'utf8');
    fs.writeFileSync(aPath, critic.buildAdversarialPrompt(c), 'utf8');
    manifest.candidates.push({
      id: c.id, stage_a_pass: true, route: null, tag: null,
      prompt_files: { neutral: nPath, adversarial: aPath },
    });
  }
  fs.writeFileSync(path.join(workdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

// ---------- judgeFromAnswers ----------
//
// The local-session-as-judge dispatcher. Replicated from
// scripts/eureka-critic-run.cjs judgeFromAnswers (lines 282-290; that runner does
// not export it). The adversarial marker string is byte-identical to
// buildAdversarialPrompt's first line so the two-pass dispatch matches.
function judgeFromAnswers(ans) {
  return function (prompt) {
    const isAdversarial = /Argue this proposed analogy is generic filler/.test(String(prompt || ''));
    return isAdversarial ? ans.adversarial : ans.neutral;
  };
}

// ---------- scoreReasoningPairs ----------
//
// Per candidate: run Gate 1 (idempotent with emitReasoningPrompts). A tripped
// gate routes pseudoscience / unsourced_quantity with no judge call. Otherwise
// build the judgeFn from answers[id] and let critic.runRubric pick the verdict by
// CODE over exactly two passes. Missing/garbled answers are NEVER guessed: an
// empty judge answer defaults every rubric item to false via
// critic.parseRubricResponse's bias-to-reject, and judge_answer_missing is
// recorded (max 1 re-emit is the caller's concern, plan 02). The loop is bounded
// by the already-capped candidate list (D8).
//
// answers[id] may be either { neutral, adversarial } (the fixture / session
// shape) OR { judgeFn } (a caller-supplied judge, e.g. the parity test's
// call-counting wrapper). Either way runRubric invokes the judge exactly twice.

async function scoreReasoningPairs(validCandidates, answers, opts) {
  const list = Array.isArray(validCandidates) ? validCandidates : [];
  const map = (answers && typeof answers === 'object') ? answers : {};
  const rows = [];
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (gate1Trips(c)) {
      rows.push(Object.assign({}, c, {
        stage_a_pass: false,
        verdict: 'pseudoscience',
        reasoning_tag: 'unsourced_quantity',
        rubric_pattern: 'xxxxxx',
        judge_answer_missing: false,
      }));
      continue;
    }
    const ans = map[c.id];
    let judgeFn;
    let missing = false;
    if (ans && typeof ans.judgeFn === 'function') {
      judgeFn = ans.judgeFn;
    } else if (ans && ans.neutral && ans.adversarial) {
      judgeFn = judgeFromAnswers(ans);
    } else {
      missing = true;
      // Bias-to-reject: an empty object -> parseRubricResponse defaults every
      // item false -> verdictFromRubric routes a cautious (rejecting) verdict.
      judgeFn = function () { return {}; };
    }
    // eslint-disable-next-line no-await-in-loop
    const rub = await critic.runRubric(
      { mechanismText: c.mechanismText, mappingStatement: c.mappingStatement },
      { judgeFn: judgeFn }
    );
    rows.push(Object.assign({}, c, {
      stage_a_pass: true,
      verdict: rub.verdict,
      reasoning_tag: rub.reasoning_tag,
      rubric_pattern: rub.rubric_pattern,
      judge_answer_missing: missing,
    }));
  }
  return rows;
}

// ---------- buildReasoningStatement ----------
//
// Assemble the candidate shape buildOpportunityStatement expects, call it for the
// canonical text, then OVERRIDE the honesty fields unconditionally (the
// runCriticGate fail-closed precedent): banked false (never delegated),
// mode 'reasoning', the two null legs, and lsa_similarity as the ONLY number.
// The returned flat row matches the embedded statements[] field names plus the
// reasoning extensions.
//
// NOTE (deviation from the plan's literal shared_problems:[]): validateCandidate
// in opportunity-statement.cjs requires a non-empty shared_problems[0] string, so
// an empty array would throw. A deterministic placeholder is supplied instead so
// the canonical assembler runs; the honesty fields below are what actually carry
// the reasoning-mode contract.
function buildReasoningStatement(row, rank) {
  const candidate = {
    a: {
      title: row.title_a,
      primary_problem: 'unclassified problem for ' + row.a,
      section: row.section_a,
      weak_dimensions: [],
    },
    b: {
      title: row.title_b,
      primary_problem: 'unclassified problem for ' + row.b,
      section: row.section_b,
      weak_dimensions: [],
    },
    shared_problems: ['cross-domain structural transfer'],
    score: 0,
    rank: rank,
    tail: false,
  };
  const st = oppmod.buildOpportunityStatement(candidate);
  return {
    rank: rank,
    a: row.a,
    b: row.b,
    tail_flag: false,
    text: st.text,
    banked: false,
    critic: row.verdict,
    weak_dimensions: st.weak_dimensions,
    potential_tier: st.fields.potential_tier,
    // Reasoning-mode extensions (the label + the one surviving number + the two
    // structurally-absent legs).
    mode: 'reasoning',
    lsa_similarity: row.lsa_similarity,
    lexical_method: 'jaccard-v1',
    differential_score: null,
    semantic_similarity: null,
    reasoning_tag: row.reasoning_tag,
  };
}

// ---------- assertReasoningInvariants ----------
//
// The G-1 / G-3 production guard: a deterministic code assertion (never a judge
// call) the writer calls immediately before fs.writeFileSync. THROWS on any
// violation (refuse to emit). Checks every statement and every ranked row plus
// the run_mode provenance.
function assertReasoningInvariants(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('assertReasoningInvariants: result must be an object');
  }
  const rows = [].concat(
    Array.isArray(result.statements) ? result.statements : [],
    Array.isArray(result.ranked) ? result.ranked : []
  );
  for (let i = 0; i < rows.length; i += 1) {
    const x = rows[i] || {};
    assert.strictEqual(x.differential_score, null, 'reasoning differential_score must be null (G-1)');
    assert.strictEqual(x.semantic_similarity, null, 'reasoning semantic_similarity must be null (G-1)');
    assert.strictEqual(x.banked, false, 'reasoning banked must be false (G-3, Canon Part 9)');
    assert.strictEqual(x.mode, 'reasoning', "reasoning mode must be 'reasoning'");
  }
  if (!result.provenance || result.provenance.run_mode !== 'reasoning') {
    throw new Error("assertReasoningInvariants: provenance.run_mode must be 'reasoning'");
  }
  return true;
}

// ---------- Exports ----------

module.exports = {
  reasoningMaxPairs: reasoningMaxPairs,
  readRoomMarkdown: readRoomMarkdown,
  proposeCandidatePairs: proposeCandidatePairs,
  validateMappings: validateMappings,
  emitReasoningPrompts: emitReasoningPrompts,
  scoreReasoningPairs: scoreReasoningPairs,
  buildReasoningStatement: buildReasoningStatement,
  assertReasoningInvariants: assertReasoningInvariants,
  REASONING_FORMULA_VERSION: REASONING_FORMULA_VERSION,
  _test: {
    stripBody: stripBody,
    extractTitle: extractTitle,
    gate1Trips: gate1Trips,
    judgeFromAnswers: judgeFromAnswers,
    envInt: envInt,
    SKIP_DIRS: SKIP_DIRS,
    SKIP_FILES: SKIP_FILES,
  },
};
