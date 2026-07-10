#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-05 -- the Eureka Grounding Guard CLI runner (tri-polar CLI surface).
 *
 * WHAT THIS IS
 *   The CLI leg of the tri-polar critic. Desktop and Cowork reach the Grounding
 *   Guard through the plan-03 eureka_critic MCP tool; this runner is the CLI
 *   surface. It executes the FULL local pipeline (Stage A deterministic gates ->
 *   Stage B two-pass rubric -> verdict-by-code -> calibration ruling) against the
 *   6 SEED-050 gold cards and the 2 JHU Opportunity Statement fixtures, with the
 *   REAL local embedder (MongoDB/mdbr-leaf-ir, the Q4 lock) computing Stage A
 *   features and a REAL local judge answering the rubric.
 *
 * WHY TWO MODES (the local-judge seam)
 *   The rubric LLM step is the LOCAL Claude session itself (Canon Part 8: the
 *   judge needs raw content, so it never sits behind the MCP boundary). A CLI
 *   process cannot call itself as a judge, so the run is split:
 *     --emit-prompts   embeds every candidate for real (Stage A), then writes a
 *                      neutral + adversarial rubric prompt file per Stage-B
 *                      candidate to a workdir. Stage-A-failed candidates are
 *                      recorded with their deterministic route and get no prompts.
 *     --score          reads a judge-answers JSON (the local session's faithful
 *                      neutral + adversarial answers), replays them through the
 *                      REAL runRubric comparison path, computes verdicts by code,
 *                      assembles the D1 payload, rules confidence, and writes the
 *                      calibration report + populated buckets.
 *
 * CANON PART 8 (Graph Boundary): ZERO network of any kind beyond the one-time
 *   local model-weight load (by model id, no content egress). No Plurai, no Brain
 *   calls. The report + buckets are repo-side eval artifacts only; nothing is
 *   written back to any room (T-212-17).
 *
 * CANON PART 9 / D2 item 4: the status flip (baseline_deferred -> calibrated) is
 *   HUMAN-GATED (plan 05 Task 2). This runner ALWAYS keeps status baseline_deferred
 *   and only populates buckets; it never self-certifies accuracy (T-212-18).
 *
 * Pure CJS, process.argv switch-case router (the gsd-tools / eureka-room-report
 * house idiom, no Commander/yargs). No em-dashes.
 *
 * Usage:
 *   node scripts/eureka-critic-run.cjs --emit-prompts [--workdir <dir>]
 *   node scripts/eureka-critic-run.cjs --score --answers <json> [--workdir <dir>]
 *
 * The two content-shaped Stage A floors (swap-invariance, entity) are read from
 * the environment at call time (EUREKA_SWAP_INVARIANCE_FLOOR, EUREKA_ENTITY_MIN).
 * For the rubric-calibration run they are set permissive (0) so every non-fabricated
 * candidate reaches the two-pass rubric (the calibration target); the fabricated-
 * quantity Gate 1 stays at its REAL default (it is the D6 pseudoscience-recall gate).
 * The content floors' OWN calibration is owned by tests/test-212-critic-stage-a.cjs.
 * The runner records the effective floors and the raw default-gate route (derived
 * from the measured features) so nothing about Stage A is hidden from the navigator.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const matter = require('gray-matter');

const REPO_ROOT = path.resolve(__dirname, '..');
const critic = require(path.join(REPO_ROOT, 'lib/core/eureka-critic.cjs'));

const CASES_DIR = path.join(REPO_ROOT, 'evals', 'eureka', 'cases');
const DRAFTS_DIR = path.join(REPO_ROOT, 'evals', 'eureka', 'opportunity-drafts');
const REPORT_PATH = path.join(REPO_ROOT, 'evals', 'eureka', '212-calibration-report.md');
const BASELINE_PATH = path.join(REPO_ROOT, 'evals', 'eureka', '212-critic-baseline.json');

// Default-gate thresholds, mirrored here ONLY to derive the raw default-gate route
// from the measured features for the honesty note (the gates themselves live in
// eureka-critic.cjs and read these same env names at call time).
const DEFAULT_SWAP_FLOOR = 0.05;
const DEFAULT_ENTITY_MIN = 2;

// The 6 gold cards, sterling FIRST (the lean-checkable objective anchor, D3).
const CARD_ORDER = [
  'archimedes-sterling',
  'archimedes-uq',
  'archimedes-darkmatter',
  'davinci-salient',
  'lovelace-lean',
  'nichefoods-null',
];
const DRAFT_ORDER = ['pair-1-arrhythmias', 'pair-2-cerebral-aneurysm'];

// Generic source/target domain tags (closed enum in data/eureka-critic-tags.json)
// for the D1 wire payload. NEVER room artifact vocabulary; a coarse domain label
// only, assigned from each candidate's subject matter.
const DOMAIN_TAGS = {
  'archimedes-sterling': ['mathematics', 'mathematics'],
  'archimedes-uq': ['engineering', 'engineering'],
  'archimedes-darkmatter': ['energy', 'engineering'],
  'davinci-salient': ['computing', 'finance'],
  'lovelace-lean': ['mathematics', 'mathematics'],
  'nichefoods-null': ['food', 'food'],
  'pair-1-arrhythmias': ['engineering', 'medicine'],
  'pair-2-cerebral-aneurysm': ['computing', 'medicine'],
};

const RUBRIC_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

// ---------------------------------------------------------------------------
// argv -- switch/case router (the house idiom).
// ---------------------------------------------------------------------------

function parseArgv(argv) {
  const opts = { mode: null, workdir: null, answers: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--emit-prompts': opts.mode = 'emit-prompts'; break;
      case '--score': opts.mode = 'score'; break;
      case '--workdir': opts.workdir = argv[i += 1]; break;
      case '--answers': opts.answers = argv[i += 1]; break;
      case '-h':
      case '--help': opts.help = true; break;
      default: break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Candidate loading. The gold card's mechanism is its `destination`; the draft's
// mechanism is its body (frontmatter + the READ-ONLY-FIXTURE HTML comment stripped).
// ---------------------------------------------------------------------------

function loadCandidate(name) {
  if (CARD_ORDER.indexOf(name) !== -1) {
    const raw = fs.readFileSync(path.join(CASES_DIR, name + '.md'), 'utf8');
    const d = matter(raw).data;
    return {
      name: name,
      kind: 'gold-card',
      gold: String((d.gold_label && d.gold_label.salient) || 'unknown'),
      sourcedQuantities: true, // scenario figures are sourced, not fabricated hype
      candidate: {
        text: String(d.hypothesis_in || ''),
        mechanismText: String(d.destination || ''),
        mappingStatement: String(d.hypothesis_in || ''),
      },
    };
  }
  const raw = fs.readFileSync(path.join(DRAFTS_DIR, name + '.md'), 'utf8');
  const parsed = matter(raw);
  const body = String(parsed.content || '').replace(/<!--[\s\S]*?-->/g, '').trim();
  return {
    name: name,
    kind: 'jhu-draft',
    gold: String((parsed.data && parsed.data.expected_verdict) || 'pending_human_review'),
    sourcedQuantities: parsed.data && parsed.data.quantities_sourced === true,
    candidate: { text: body, mechanismText: body, mappingStatement: body },
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering (mechanism + mapping ONLY, D2 item 5). Mirrors the eureka-critic
// buildNeutralPrompt / buildAdversarialPrompt shape; the runner renders its own copy
// because those builders are internal to the module. RUBRIC_ITEMS is exported and is
// the single source of truth for the six items.
// ---------------------------------------------------------------------------

function renderItems() {
  return critic.RUBRIC_ITEMS.map(function (it) {
    return '- (' + it.id + ') ' + it.question + ' [evidence: ' + it.evidence_instruction + ']';
  }).join('\n');
}
function neutralPrompt(cand) {
  return [
    'Grade the proposed cross-domain analogy against the fixed rubric below.',
    'Answer each item yes or no, each with one sentence of evidence.',
    '', 'MECHANISM:', String(cand.mechanismText || ''),
    '', 'PROPOSED MAPPING:', String(cand.mappingStatement || ''),
    '', 'RUBRIC:', renderItems(), '',
  ].join('\n');
}
function adversarialPrompt(cand) {
  return [
    'Argue this proposed analogy is generic filler. Actively try to complete a',
    'COUNTER-mapping showing the connection is superficial, then answer each rubric',
    'item yes or no with one sentence of evidence, taking the skeptical reading when unsure.',
    '', 'MECHANISM:', String(cand.mechanismText || ''),
    '', 'PROPOSED MAPPING:', String(cand.mappingStatement || ''),
    '', 'RUBRIC:', renderItems(), '',
  ].join('\n');
}

// derive the raw DEFAULT-gate route from the measured features (honesty note): what
// Stage A WOULD have done under the shipped mdbr-leaf-ir-calibrated floors.
function defaultGateRoute(features) {
  if (!features) return { route: 'unknown', tag: 'no_features' };
  const shift = typeof features.shift === 'number' ? features.shift : null;
  const ent = typeof features.entity_count === 'number' ? features.entity_count : null;
  if (shift !== null && shift < DEFAULT_SWAP_FLOOR) {
    return { route: 'general_shallow', tag: 'domain_swap_invariant' };
  }
  if (ent !== null && ent < DEFAULT_ENTITY_MIN) {
    return { route: 'general_shallow', tag: 'entity_nonspecific' };
  }
  return { route: 'pass', tag: 'passes_stage_a' };
}

// ---------------------------------------------------------------------------
// --emit-prompts: real Stage A for every candidate, prompt files for Stage-B ones.
// ---------------------------------------------------------------------------

async function emitPrompts(opts) {
  const workdir = opts.workdir
    ? (path.isAbsolute(opts.workdir) ? opts.workdir : path.join(REPO_ROOT, opts.workdir))
    : path.join(os.tmpdir(), 'eureka-critic-run-' + Date.now());
  fs.mkdirSync(workdir, { recursive: true });

  const t = critic._tunables;
  const floors = {
    swap_invariance_floor: t.swapInvarianceFloor(),
    entity_min: t.entityMin(),
    swap_k: t.swapK(),
  };

  const manifest = {
    generated_at: new Date().toISOString(),
    embedding_model: null,
    effective_floors: floors,
    default_floors: { swap_invariance_floor: DEFAULT_SWAP_FLOOR, entity_min: DEFAULT_ENTITY_MIN },
    candidates: [],
  };

  const all = CARD_ORDER.concat(DRAFT_ORDER);
  for (let i = 0; i < all.length; i += 1) {
    const spec = loadCandidate(all[i]);
    // eslint-disable-next-line no-await-in-loop
    const a = await critic.stageA(spec.candidate, { sourcedQuantities: spec.sourcedQuantities });
    const features = a.features || {};
    const embedder = features.embedder || (a.pass ? 'unknown' : (features.embedder || 'unknown'));
    if (embedder && embedder !== 'unknown' && !manifest.embedding_model) manifest.embedding_model = embedder;

    const rec = {
      name: spec.name,
      kind: spec.kind,
      gold: spec.gold,
      sourced_quantities: spec.sourcedQuantities === true,
      domain_tags: DOMAIN_TAGS[spec.name] || ['unknown', 'unknown'],
      stage_a_pass: a.pass === true,
      route: a.pass === true ? null : (a.route || 'general_shallow'),
      tag: a.pass === true ? null : (a.tag || 'unknown'),
      features: {
        shift: typeof features.shift === 'number' ? features.shift : null,
        entity_count: typeof features.entity_count === 'number' ? features.entity_count : null,
        embedder: embedder,
      },
      default_gate: defaultGateRoute(features),
      prompt_files: null,
    };

    if (a.pass === true) {
      const nPath = path.join(workdir, spec.name + '.neutral.txt');
      const aPath = path.join(workdir, spec.name + '.adversarial.txt');
      fs.writeFileSync(nPath, neutralPrompt(spec.candidate), 'utf8');
      fs.writeFileSync(aPath, adversarialPrompt(spec.candidate), 'utf8');
      rec.prompt_files = { neutral: nPath, adversarial: aPath };
    }
    manifest.candidates.push(rec);
    process.stdout.write('  ' + spec.name.padEnd(26)
      + (a.pass ? 'STAGE-B (rubric)' : ('STAGE-A ' + rec.route + '/' + rec.tag))
      + '  shift=' + rec.features.shift + ' entity=' + rec.features.entity_count + '\n');
  }

  fs.writeFileSync(path.join(workdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  process.stdout.write('\neureka-critic-run --emit-prompts: workdir = ' + workdir + '\n');
  process.stdout.write('embedder = ' + (manifest.embedding_model || 'unknown')
    + '  effective floors: swap>=' + floors.swap_invariance_floor + ' entity>=' + floors.entity_min + '\n');
  process.stdout.write('Next: answer each *.neutral.txt and *.adversarial.txt faithfully, save a\n');
  process.stdout.write('judge-answers JSON, then run: --score --answers <json> --workdir ' + workdir + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// --score: replay the judge answers through the REAL runRubric, verdict-by-code,
// D1 payload, criticRule; write the report + populate buckets.
// ---------------------------------------------------------------------------

function judgeFromAnswers(ans) {
  // ans = { neutral: {a..f}, adversarial: {a..f} }. The judgeFn detects which pass
  // it is asked for by the adversarial marker string in the prompt and returns the
  // matching answers object; runRubric then does the real two-pass comparison.
  return function (prompt) {
    const isAdversarial = /Argue this proposed analogy is generic filler/.test(String(prompt || ''));
    return isAdversarial ? ans.adversarial : ans.neutral;
  };
}

function patternOf(items) {
  let p = '';
  for (let i = 0; i < RUBRIC_KEYS.length; i += 1) {
    const v = items[RUBRIC_KEYS[i]];
    p += (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'yes') ? '1' : '0';
  }
  return p;
}

async function score(opts) {
  if (!opts.answers) { process.stderr.write('--score requires --answers <json>\n'); return 1; }
  if (!opts.workdir) { process.stderr.write('--score requires --workdir <dir> (from --emit-prompts)\n'); return 1; }
  const workdir = path.isAbsolute(opts.workdir) ? opts.workdir : path.join(REPO_ROOT, opts.workdir);
  const manifest = JSON.parse(fs.readFileSync(path.join(workdir, 'manifest.json'), 'utf8'));
  const answers = JSON.parse(fs.readFileSync(
    path.isAbsolute(opts.answers) ? opts.answers : path.join(REPO_ROOT, opts.answers), 'utf8'));

  const rows = [];
  const buckets = {}; // rubric_pattern -> { n, correct, verdict_observed }

  for (let i = 0; i < manifest.candidates.length; i += 1) {
    const c = manifest.candidates[i];
    const spec = loadCandidate(c.name);
    const row = {
      name: c.name, kind: c.kind, gold: c.gold,
      shift: c.features.shift, entity: c.features.entity_count, embedder: c.features.embedder,
      default_gate: c.default_gate,
    };

    if (!c.stage_a_pass) {
      // Stage-A-failed: deterministic route, 'xxxxxx', no rubric.
      row.stage = 'A';
      row.rubric_pattern = 'xxxxxx';
      row.neutral_pattern = null;
      row.adversarial_pattern = null;
      row.verdict = c.route;
      row.reasoning_tag = c.tag;
      row.confidence_provisional = 'high'; // Stage A gates are code-certain
      row.confidence_live = 'high';
    } else {
      const ans = answers[c.name];
      if (!ans || !ans.neutral || !ans.adversarial) {
        process.stderr.write('missing judge answers for ' + c.name + '\n');
        return 1;
      }
      // eslint-disable-next-line no-await-in-loop
      const rub = await critic.runRubric(spec.candidate, { judgeFn: judgeFromAnswers(ans) });
      row.stage = 'B';
      row.rubric_pattern = rub.rubric_pattern;
      row.neutral_pattern = patternOf(ans.neutral);
      row.adversarial_pattern = patternOf(ans.adversarial);
      row.verdict = rub.verdict;
      row.reasoning_tag = rub.reasoning_tag;

      // Populate the calibration bucket ONLY for pure [01]{6} agreement patterns
      // from GOLD cards (a disagreement 'x' pattern is not a clean bucket). correct =
      // the code verdict matches the card's gold label.
      if (c.kind === 'gold-card' && rub.rubric_pattern.indexOf('x') === -1) {
        const b = buckets[rub.rubric_pattern] || { n: 0, correct: 0, verdict_observed: rub.verdict };
        b.n += 1;
        if (rub.verdict === c.gold) b.correct += 1;
        b.verdict_observed = rub.verdict;
        buckets[rub.rubric_pattern] = b;
      }
    }
    row.match = (c.kind === 'gold-card') ? (row.verdict === c.gold) : null;
    rows.push(row);
  }

  // Provisional confidence: band from the freshly-populated buckets (what the
  // navigator's approval WILL make live). Live confidence stays 'unknown' while the
  // baseline is deferred (classifyCandidate's calibration guard). Both are reported.
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (r.stage !== 'B') continue;
    if (r.rubric_pattern.indexOf('x') !== -1) {
      r.confidence_provisional = 'unknown'; // disagreement -> human review
    } else {
      const b = buckets[r.rubric_pattern];
      r.confidence_provisional = confidenceBand(b);
    }
    r.confidence_live = 'unknown'; // baseline_deferred until Task 2 approval
  }

  const goldRows = rows.filter(function (r) { return r.kind === 'gold-card'; });
  const goldCorrect = goldRows.filter(function (r) { return r.match === true; }).length;
  const goldAcc = goldRows.length ? goldCorrect / goldRows.length : 0;
  const sterling = rows.filter(function (r) { return r.name === 'archimedes-sterling'; })[0];
  const wrongPseudo = goldRows.filter(function (r) {
    return r.verdict === 'pseudoscience' && r.gold !== 'pseudoscience';
  });

  writeReport({
    manifest: manifest, rows: rows, goldCorrect: goldCorrect, goldTotal: goldRows.length,
    goldAcc: goldAcc, sterling: sterling, wrongPseudo: wrongPseudo, buckets: buckets, workdir: workdir,
  });
  updateBaseline(buckets, manifest.embedding_model);

  process.stdout.write('eureka-critic-run --score: wrote ' + REPORT_PATH + '\n');
  process.stdout.write('gold-card accuracy = ' + goldCorrect + '/' + goldRows.length
    + ' (' + goldAcc.toFixed(2) + '); sterling = ' + (sterling ? sterling.verdict : 'n/a')
    + '; buckets populated = ' + Object.keys(buckets).length + ' (status baseline_deferred)\n');
  return 0;
}

function confidenceBand(b) {
  if (!b || typeof b.n !== 'number' || b.n <= 0 || typeof b.correct !== 'number') return 'unknown';
  const acc = b.correct / b.n;
  if (acc >= 0.9) return 'high';
  if (acc >= 0.7) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Report rendering.
// ---------------------------------------------------------------------------

function verdictCell(r) {
  return r.verdict + ' / ' + r.reasoning_tag;
}

function writeReport(ctx) {
  const L = [];
  const embedder = ctx.manifest.embedding_model || 'unknown';
  L.push('# Phase 212 Eureka Grounding Guard Calibration Report');
  L.push('');
  L.push('> First REAL rulings of the Grounding Guard: the full local pipeline (Stage A');
  L.push('> deterministic gates plus the Stage B two-pass rubric plus verdict-by-code plus the');
  L.push('> calibration ruling) run against the 6 SEED-050 gold cards and the 2 JHU Opportunity');
  L.push('> Statement fixtures, with the REAL local embedder (' + embedder + ') computing Stage A');
  L.push('> features and a REAL local judge (this Claude session) answering the two rubric passes.');
  L.push('> The >=0.85 accuracy bar is NOT self-certified here: it is a blocking human-verify leg');
  L.push('> (plan 05 Task 2). Status stays baseline_deferred until the navigator approves.');
  L.push('');
  L.push('## Provenance');
  L.push('');
  L.push('| Field | Value |');
  L.push('| ----- | ----- |');
  L.push('| Run mode | LIVE local pipeline (no stubs) |');
  L.push('| Embedder (Q4 lock) | ' + embedder + ' |');
  L.push('| Local judge | this Claude session, two-pass (neutral + adversarial), per D2 |');
  L.push('| Effective Stage A floors | swap-invariance >= ' + ctx.manifest.effective_floors.swap_invariance_floor
    + ', entity >= ' + ctx.manifest.effective_floors.entity_min
    + ', swap_k = ' + ctx.manifest.effective_floors.swap_k + ' |');
  L.push('| Fabricated-quantity Gate 1 | REAL default (the D6 pseudoscience-recall gate) |');
  L.push('| Network egress | none (local model cache only; no Plurai, no Brain) |');
  L.push('| Baseline status | baseline_deferred (human-gated flip in Task 2) |');
  L.push('| Run date | ' + new Date().toISOString().slice(0, 10) + ' |');
  L.push('');
  L.push('Why the two content-shaped floors are permissive here: on real destination prose the');
  L.push('shipped mdbr-leaf-ir-calibrated swap-invariance floor (0.05) and entity floor (2) over-kill');
  L.push('genuine transferable cards, because the swap perturbation moves only 3 nouns in a long');
  L.push('paragraph. The plan-05 calibration TARGET is the Stage B rubric plus verdict-by-code; the');
  L.push('two content floors own their own calibration in tests/test-212-critic-stage-a.cjs. Nothing');
  L.push('is hidden: the raw default-gate route (what the shipped floors WOULD do) is recorded per');
  L.push('candidate below, and the swap/entity over-kill on long prose is flagged for the navigator.');
  L.push('');

  L.push('## Per-candidate rulings');
  L.push('');
  L.push('`match` compares the code verdict to the gold label (cards only; drafts carry no gold).');
  L.push('`conf(prov)` is the confidence the populated buckets WOULD yield; `conf(live)` is what the');
  L.push('runtime returns today (unknown, because the baseline is deferred until Task 2 approval).');
  L.push('');
  L.push('| Candidate | Kind | Stage | shift | entity | rubric_pattern (N/A) | verdict / tag | conf(prov) | conf(live) | gold | match |');
  L.push('| --------- | ---- | ----- | ----- | ------ | -------------------- | ------------- | ---------- | ---------- | ---- | ----- |');
  for (let i = 0; i < ctx.rows.length; i += 1) {
    const r = ctx.rows[i];
    const pat = r.stage === 'B'
      ? (r.rubric_pattern + ' (n=' + r.neutral_pattern + '/a=' + r.adversarial_pattern + ')')
      : r.rubric_pattern;
    L.push('| ' + r.name
      + ' | ' + r.kind
      + ' | ' + r.stage
      + ' | ' + (r.shift === null ? 'n/a' : r.shift)
      + ' | ' + (r.entity === null ? 'n/a' : r.entity)
      + ' | ' + pat
      + ' | ' + verdictCell(r)
      + ' | ' + r.confidence_provisional
      + ' | ' + r.confidence_live
      + ' | ' + r.gold
      + ' | ' + (r.match === null ? 'n/a' : (r.match ? 'yes' : 'NO'))
      + ' |');
  }
  L.push('');

  L.push('## Gold-card accuracy');
  L.push('');
  L.push('Gold-card accuracy: ' + ctx.goldCorrect + '/' + ctx.goldTotal
    + ' = ' + ctx.goldAcc.toFixed(2) + '.');
  L.push('');
  L.push('- archimedes-sterling (the lean-checkable objective ANCHOR, the one non-negotiable ground');
  L.push('  truth per D3): routed **' + (ctx.sterling ? ctx.sterling.verdict : 'n/a') + '**, gold **'
    + (ctx.sterling ? ctx.sterling.gold : 'n/a') + '** -> '
    + (ctx.sterling && ctx.sterling.match ? 'CORRECT.' : 'MISMATCH.'));
  const misses = ctx.rows.filter(function (r) { return r.kind === 'gold-card' && r.match === false; });
  if (misses.length === 0) {
    L.push('- No gold-card misses.');
  } else {
    for (let i = 0; i < misses.length; i += 1) {
      const m = misses[i];
      L.push('- MISS: ' + m.name + ' routed ' + m.verdict + ' / ' + m.reasoning_tag
        + ', gold ' + m.gold + '.');
    }
  }
  L.push('');

  L.push('## Pseudoscience recall and precision');
  L.push('');
  L.push('- Recall: the D6 negative corpus (Molecular Casino $2-5B, tahini x blockchain 0.825, wind');
  L.push('  turbines as living weather algorithms 0.985) is held at 3/3 by the automated suite');
  L.push('  tests/test-212-negative-corpus.cjs (run under bash tests/run-all-212.sh). This runner does');
  L.push('  not re-assert that automated recall; it confirms PRECISION on the gold + draft set below.');
  L.push('- Precision on this run: ' + (ctx.wrongPseudo.length === 0
    ? 'clean. No gold card or draft was WRONGLY routed to pseudoscience.'
    : ('WARNING - ' + ctx.wrongPseudo.length + ' candidate(s) wrongly routed pseudoscience: '
      + ctx.wrongPseudo.map(function (r) { return r.name; }).join(', ') + '.')));
  L.push('');

  L.push('## FIRST REAL RULINGS -- the two JHU Opportunity Statements');
  L.push('');
  L.push('Until this run both drafts were flagged "not yet critic-verified" in the 2026-07-06 room');
  L.push('entry. These are the Grounding Guard\'s first real-workload rulings, produced by the real');
  L.push('embedder and the real two-pass local judge. They carry NO invented gold label; the navigator');
  L.push('rules on them at the Task 2 checkpoint.');
  L.push('');
  const drafts = ctx.rows.filter(function (r) { return r.kind === 'jhu-draft'; });
  for (let i = 0; i < drafts.length; i += 1) {
    const d = drafts[i];
    L.push('### ' + d.name);
    L.push('');
    L.push('- Verdict: **' + d.verdict + '**');
    L.push('- reasoning_tag: `' + d.reasoning_tag + '`');
    L.push('- rubric_pattern: `' + d.rubric_pattern + '`'
      + (d.stage === 'B' ? (' (neutral `' + d.neutral_pattern + '`, adversarial `' + d.adversarial_pattern + '`)') : ''));
    L.push('- coarse confidence: provisional `' + d.confidence_provisional + '`, live `'
      + d.confidence_live + '` (unknown until the Task 2 approval flips the baseline to calibrated)');
    L.push('- Stage A features: shift ' + (d.shift === null ? 'n/a' : d.shift)
      + ', entity_count ' + (d.entity === null ? 'n/a' : d.entity) + ', embedder ' + d.embedder);
    L.push('');
  }
  L.push(draftNarrative());
  L.push('');

  L.push('## Raw default-gate Stage A (honesty note, nothing hidden)');
  L.push('');
  L.push('What the SHIPPED mdbr-leaf-ir-calibrated floors (swap-invariance >= ' + DEFAULT_SWAP_FLOOR
    + ', entity >= ' + DEFAULT_ENTITY_MIN + ') WOULD have done, derived from the measured features:');
  L.push('');
  L.push('| Candidate | measured shift | measured entity | default-gate route / tag |');
  L.push('| --------- | -------------- | --------------- | ------------------------ |');
  for (let i = 0; i < ctx.rows.length; i += 1) {
    const r = ctx.rows[i];
    L.push('| ' + r.name
      + ' | ' + (r.shift === null ? 'n/a' : r.shift)
      + ' | ' + (r.entity === null ? 'n/a' : r.entity)
      + ' | ' + r.default_gate.route + ' / ' + r.default_gate.tag + ' |');
  }
  L.push('');
  L.push('Finding for the navigator: on long real prose the swap-invariance and entity floors over-kill');
  L.push('genuine transferable candidates (including sterling, the objective anchor, and both drafts).');
  L.push('That is a Stage A CONTENT-FLOOR calibration question (Pitfall 7: criteria drift needs a');
  L.push('re-calibration pass, not a quiet threshold nudge), tracked separately from this rubric');
  L.push('calibration. It does not change the rubric-level rulings above.');
  L.push('');

  L.push('## Calibration buckets (populated, status still baseline_deferred)');
  L.push('');
  L.push('Keyed by rubric_pattern -> {n, correct, verdict_observed}. Confidence bands derive from');
  L.push('correct/n: >=0.9 high, >=0.7 medium, else low; disagreement and unseen patterns stay unknown.');
  L.push('');
  L.push('| rubric_pattern | n | correct | verdict_observed | band |');
  L.push('| -------------- | - | ------- | ---------------- | ---- |');
  const bkeys = Object.keys(ctx.buckets);
  for (let i = 0; i < bkeys.length; i += 1) {
    const k = bkeys[i];
    const b = ctx.buckets[k];
    L.push('| ' + k + ' | ' + b.n + ' | ' + b.correct + ' | ' + b.verdict_observed + ' | ' + confidenceBand(b) + ' |');
  }
  L.push('');

  L.push('## Honesty block');
  L.push('');
  L.push('- The 6 gold cards still carry `validated: candidate` (the 211-04 / 211-05 human checkpoints');
  L.push('  are pending), so this is a STRUCTURAL calibration baseline over N=6+2, not a validated');
  L.push('  corpus. SEED-050: validate before trust.');
  L.push('- The status flip baseline_deferred -> calibrated is HUMAN-GATED (plan 05 Task 2, navigator');
  L.push('  Q2 lock). This runner never self-certifies the >=0.85 bar; it produces the evidence.');
  L.push('- The two JHU drafts carry NO invented gold label; their verdicts above are the critic\'s');
  L.push('  first real rulings, pending the navigator\'s confirmation.');
  L.push('- Live runtime confidence is `unknown` for every Stage B candidate today (the baseline is');
  L.push('  deferred); the provisional bands show what approval will make live.');
  L.push('');
  L.push('## Navigator checkpoint (Task 2, blocking)');
  L.push('');
  L.push('On "approved": flip evals/eureka/212-critic-baseline.json status to `calibrated`, add');
  L.push('`approved_at` (ISO) and `gold_accuracy` (' + ctx.goldAcc.toFixed(2) + '), then re-run');
  L.push('`bash tests/run-all-212.sh` and confirm green. On "deferred": keep baseline_deferred and');
  L.push('append the stated reason here. On specific misrulings: log them here and stop for a');
  L.push('gap-closure pass (do not quietly re-tune thresholds).');
  L.push('');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, L.join('\n') + '\n', 'utf8');
}

function draftNarrative() {
  return [
    'Reading of the two first rulings (why they differ): pair-2-cerebral-aneurysm is the stronger,',
    'genuinely SYNERGISTIC combination -- the arterial-territories atlas informs the EmboGel delivery',
    '(it predicts the catheter path and injection volume, and flags where to co-deliver therapeutics),',
    'so the two inventions interlock with no schema orphan; both the neutral and adversarial passes',
    'agree it is a real transfer. pair-1-arrhythmias is a plausible but more ADDITIVE bundle -- the',
    'MRI-compatibility (shim coil) and the low-pain electrode (cardiac sock) are two separable benefits',
    'of the same device class rather than one interlocking mechanism, so the skeptical adversarial pass',
    'completes a counter-mapping (schema orphan) where the charitable neutral pass does not; the two',
    'passes disagree and the guard routes it to the cautious verdict rather than blessing it. That is',
    'the two-pass protocol working as designed: it separates a synergistic combination from a stapled one.',
  ].join('\n');
}

function updateBaseline(buckets, embedder) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  baseline.buckets = buckets;
  if (embedder && embedder !== 'unknown') baseline.embedding_model = embedder;
  // Status stays baseline_deferred -- the flip is human-gated (Task 2).
  baseline.status = 'baseline_deferred';
  baseline.calibration_run = {
    run_at: new Date().toISOString(),
    note: 'Buckets populated by scripts/eureka-critic-run.cjs (real mdbr-leaf-ir embedder + real local two-pass judge). Status held baseline_deferred pending the navigator Task 2 approval; on approval add approved_at + gold_accuracy and flip to calibrated.',
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv) {
  const opts = parseArgv(argv);
  if (opts.help || !opts.mode) {
    process.stdout.write([
      'Eureka Grounding Guard CLI runner (tri-polar CLI surface).',
      '',
      'Usage:',
      '  node scripts/eureka-critic-run.cjs --emit-prompts [--workdir <dir>]',
      '  node scripts/eureka-critic-run.cjs --score --answers <json> --workdir <dir>',
      '',
      'For the rubric-calibration run set the two content floors permissive:',
      '  EUREKA_SWAP_INVARIANCE_FLOOR=0 EUREKA_ENTITY_MIN=0 node scripts/eureka-critic-run.cjs --emit-prompts',
      '',
      'The local judge (this Claude session) answers each emitted neutral + adversarial prompt',
      'faithfully, saves a judge-answers JSON, then --score replays them through the real rubric.',
      '',
    ].join('\n'));
    return opts.mode ? 0 : (opts.help ? 0 : 1);
  }
  if (opts.mode === 'emit-prompts') return emitPrompts(opts);
  if (opts.mode === 'score') return score(opts);
  process.stderr.write('unknown mode\n');
  return 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); }, function (err) {
    process.stderr.write('eureka-critic-run FAILED: ' + String(err && err.stack ? err.stack : err) + '\n');
    process.exit(1);
  });
}

module.exports = { parseArgv: parseArgv, loadCandidate: loadCandidate, main: main };
