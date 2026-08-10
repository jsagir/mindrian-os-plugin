'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-01 Task 2 -- Brain derivation core
 * ===========================================
 * Single entry point deriveSection(roomPath, section, options) reads
 * the Phase 88 triple, builds Canon-Part-8-safe Brain query context
 * (generic handles ONLY), invokes Brain via brain-client.cjs for each
 * of the 9 optional BRAIN.md sections, assembles the authored markdown,
 * gates through Plan 90-00 validateSchema, and atomically writes the
 * section's BRAIN.md using the Phase 88-04-B tmp + fsync + rename
 * pattern.
 *
 * The LOAD-BEARING Canon Part 8 chokepoint is buildBrainQueryContext.
 * It is the ONLY function in this module that touches user-specific
 * triple fields, and it strips every touched field to an allow-list
 * scalar BEFORE any prompt builder or Brain call sees the context.
 * Every Brain query is then validated a second time through the
 * prompt-builder allow-list schema (lib/core/brain-derivation-prompts
 * .cjs validateCtx) before reaching the Brain.
 *
 * Graceful failure:
 *   - brain-client.isAvailable() === false -> reason:'brain_unavailable'
 *   - triple.reasoning.exists === false   -> reason:'triple_incomplete'
 *   - brain-client throws                 -> reason:'derivation_timeout' |
 *                                            'rate_limited' | 'derivation_error'
 *   - schema gate rejects assembly        -> success:false, violations[],
 *                                            tmpfile cleaned
 *   - writeLock contention                -> reason:'concurrent_write'
 *   - filesystem EACCES / ENOENT          -> reason:'fs_error'
 *   - deriveSection NEVER throws; every path returns a result object.
 *
 * Pure CJS, node built-ins only, zero npm deps. Three-surface safe
 * (CLI + Desktop MCP + Cowork; no surface-specific code).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const folderMemory = require('./folder-memory.cjs');
const brainClient = require('./brain-client.cjs');
const schemaValidator = require('./brain-md-schema.cjs');
const prompts = require('./brain-derivation-prompts.cjs');

// Phase 90-06 cross-room aggregator. Lazy-loaded inside deriveSection so
// the top-level require graph stays minimal when cross_room_scan is
// false (the default). The aggregator is Canon Part 8 safe by
// construction: four enforcement layers (ALLOWED_ROOT scope, GUARDRAIL.md
// sealed-room skip, per-room brain_cross_room:false opt-out, and
// sanitizeDetailScalar + JSON.stringify last-line-of-defense audit).
// See lib/core/cross-room-aggregator.cjs for the full contract.
// (cross_room_scan option surfaces here; aggregator call is wired below)

// ---------- Frozen constants ----------

// Section heading -> prompt builder mapping. Order matters: this is the
// canonical emission order inside BRAIN.md body.
//
// BUG 2 fix (2026-05-22): sections whose Cypher traverses FEEDS_INTO or
// ADDRESSES_PROBLEM_TYPE edges are repointed from mode:'query' (admin-gated
// brain_query) to mode:'search' (ungated brain_search). Their prompt builders
// are also updated (see brain-derivation-prompts.cjs) to emit a semantic
// search string instead of raw Cypher. The SECTION_BUILDERS mode field is
// the dispatch key in the derivation loop below.
//
// Sections that still use mode:'query' target node types with no curated op
// and no practical semantic-search equivalent (WickedIndicator, Opportunity,
// RigorLevel, ProblemType, HsiRecommendation). Those calls will fail (or
// return empty) for non-admin users -- that is the correct graceful-degradation
// behaviour (existing firstError path). A future phase can add curated ops
// for those node types.
const SECTION_BUILDERS = Object.freeze([
  { heading: 'Pattern Matches',                     builder: 'buildPatternMatchesQuery',                     mode: 'search' },
  { heading: 'Cross-Domain Analogies',              builder: 'buildCrossDomainAnalogiesQuery',               mode: 'search' },
  { heading: 'Wicked Indicators',                   builder: 'buildWickedIndicatorsQuery',                   mode: 'query' },
  { heading: 'Unfilled Opportunity Matches',        builder: 'buildUnfilledOpportunityMatchesQuery',         mode: 'query' },
  { heading: 'Framework Chain Predictions',         builder: 'buildFrameworkChainPredictionsQuery',          mode: 'search' },
  { heading: 'Assessment Thinking Chain Position',  builder: 'buildAssessmentThinkingChainPositionQuery',    mode: 'query' },
  { heading: 'ProblemType Classification',          builder: 'buildProblemTypeClassificationQuery',          mode: 'query' },
  { heading: 'Flagged Contradictions (cross-room)', builder: 'buildFlaggedContradictionsXroomQuery',         mode: 'query' },
  { heading: 'HSI Signals',                         builder: 'buildHsiSignalsQuery',                         mode: 'query' },
]);

// SHA256 of empty string is the deterministic sentinel used when the
// governing_thought field is null / empty. It is parseable by downstream
// validators and provides a stable anchor for change detection.
const EMPTY_SHA256 = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// ---------- Canon Part 8 CHOKEPOINT: buildBrainQueryContext ----------
//
// This function is the ONLY place in the module where triple fields
// like reasoning.governing_thought, room.identity_text, and
// reasoning.decision_log are touched. Everything leaving this function
// is either:
//   - a sha256 hash of a potentially-sensitive string
//   - an integer scalar (arguments_count, artifact_count)
//   - a float scalar in [0,1] (reasoning_health_score, evidence_density,
//     completeness_score)
//   - a derived enum from a frozen vocabulary (UDP/IDP/WDP, Simple/
//     Complex/Wicked, phase indicator)
//   - the section slug (structural folder name; user-chosen but
//     slug-safe and never carries artifact content)
//
// No user-typed prose, personal names, meeting fragments, or artifact
// bodies can pass this boundary.

function buildBrainQueryContext(triple, sectionSlug) {
  if (!triple || typeof triple !== 'object') return null;
  if (!triple.reasoning || triple.reasoning.exists !== true) return null;

  const reasoning = triple.reasoning;
  const state = triple.state || {};

  // Sha256 hash of governing_thought (normalize NFC so identical prose
  // across Unicode normalizations yields the same hash).
  const gt = reasoning.governing_thought == null ? '' : String(reasoning.governing_thought);
  const gtHash = 'sha256:' + crypto.createHash('sha256').update(gt.normalize('NFC')).digest('hex');

  // Derived classification.
  const problemType = classifyProblemType(triple);
  const complexity = deriveComplexity(triple);
  const phaseIndicator = derivePhaseIndicator(triple);

  // Allow-list scalars.
  const argsCount = Number.isFinite(reasoning.arguments_count) ? Math.max(0, Math.floor(reasoning.arguments_count)) : 0;
  const evDensity = clamp01(reasoning.evidence_density, 0);
  const rhs = clamp01(reasoning.reasoning_health_score, 0);
  const meceStatus = mapMeceStatus(reasoning.mece_status);
  // Structural section slug only. Defensive slug cleaner: keep
  // [a-z0-9_-] after lowercasing; fallback to 'unknown'.
  const slug = (sectionSlug || '').toString().toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 64);
  const safeSlug = /^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug) ? slug : 'unknown';

  // Reverse-salient signal is a scalar flag: present iff STATE.md says so
  // (future Phase 89 integration). Today we default false.
  const rsPresent = !!(state && state.reverse_salient_present === true);

  return {
    section_slug: safeSlug,
    problem_type: problemType,
    complexity: complexity,
    phase_indicator: phaseIndicator,
    reasoning_health_score: rhs,
    arguments_count: argsCount,
    mece_status: meceStatus,
    evidence_density: evDensity,
    governing_thought_hash: gtHash,
    reverse_salient_present: rsPresent,
  };
}

// ---------- Derivation helpers (frozen enum mappings) ----------

function clamp01(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return Number(fallback) || 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function mapMeceStatus(raw) {
  if (raw === 'pass' || raw === 'warn' || raw === 'fail') return raw;
  // Legacy MINTO files may carry boolean-like or capitalized values.
  if (raw === true || raw === 'ok' || raw === 'Pass') return 'pass';
  if (raw === false || raw === 'fail' || raw === 'Fail') return 'fail';
  return 'warn';
}

/**
 * classifyProblemType(triple) -> 'UDP' | 'IDP' | 'WDP'
 *
 * Frozen mapping derived from triple shape. No user strings are read:
 * this function converts the governing_thought field to a boolean
 * existence flag at the very first line and never touches its content.
 * The conversion is the ONLY place outside buildBrainQueryContext that
 * reads the field, and it reads length/null only -- a scalar signal
 * that satisfies Canon Part 8.
 *
 * - UDP (Undefined Problem): governing_thought missing OR mece fail with
 *   arguments_count < 2.
 * - WDP (Well-Defined Problem): mece pass AND arguments_count >= 4 AND
 *   evidence_density >= 0.35.
 * - IDP (Ill-Defined Problem): default (mece warn OR arguments_count in
 *   [2, 3] OR evidence_density < 0.35).
 */
function classifyProblemType(triple) {
  if (!triple || !triple.reasoning) return 'UDP';
  const r = triple.reasoning;
  // Scalar extraction: existence flag ONLY. Never store or forward the
  // raw governing_thought value.
  const hasGoverningThought = r.governing_thought != null &&
    typeof r.governing_thought === 'string' &&
    r.governing_thought.length > 0;
  const mece = mapMeceStatus(r.mece_status);
  const args = Number.isFinite(r.arguments_count) ? r.arguments_count : 0;
  const ev = clamp01(r.evidence_density, 0);
  if (!hasGoverningThought) return 'UDP';
  if (mece === 'fail' && args < 2) return 'UDP';
  if (mece === 'pass' && args >= 4 && ev >= 0.35) return 'WDP';
  return 'IDP';
}

/**
 * deriveComplexity(triple) -> 'Simple' | 'Complex' | 'Wicked'
 *
 * Derived from reasoning_health_score + flagged-weaknesses count +
 * stale reason. Scalar thresholds, no string content read.
 */
function deriveComplexity(triple) {
  if (!triple || !triple.reasoning) return 'Simple';
  const r = triple.reasoning;
  const rhs = clamp01(r.reasoning_health_score, 0);
  const weaknessesCount = Array.isArray(r.flagged_weaknesses) ? r.flagged_weaknesses.length : 0;
  if (rhs >= 0.75 && weaknessesCount <= 1) return 'Simple';
  if (rhs < 0.4 || weaknessesCount >= 4) return 'Wicked';
  return 'Complex';
}

/**
 * derivePhaseIndicator(triple) -> enum
 *
 * Mapping from completeness_score + artifact_count + stale reason. Uses
 * only scalars from STATE.md / MINTO.md frontmatter.
 */
function derivePhaseIndicator(triple) {
  if (!triple || !triple.state) return 'unknown';
  const s = triple.state;
  const c = clamp01(s.completeness_score, 0);
  const ac = Number.isFinite(s.artifact_count) ? s.artifact_count : 0;
  if (ac === 0 && c < 0.1) return 'discovery';
  if (c < 0.4) return 'formulation';
  if (c < 0.8) return 'validation';
  return 'scaling';
}

// ---------- Atomic write helpers (88-04-B pattern) ----------

function tmpFileName(basePath) {
  // BRAIN.md.tmp.<random>.brain matches the pattern asserted in Test 15.
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return basePath + '.tmp.' + rand + '.brain';
}

async function atomicWriteBrainMd(sectionPath, assembledBody, force_bad_staleness) {
  const finalPath = path.join(sectionPath, 'BRAIN.md');
  const tmpPath = tmpFileName(finalPath);
  let fd = null;
  try {
    // Write with exclusive create (wx) so we catch concurrent writers.
    fd = fs.openSync(tmpPath, 'wx');
    // For the Test 6 schema-gate rejection path, inject an ERROR-severity
    // schema violation by removing the required `author` field. This branch
    // is never exercised in production.
    const finalBody = force_bad_staleness
      ? assembledBody.replace(/^author: .+\r?\n/m, '')
      : assembledBody;
    fs.writeFileSync(fd, finalBody);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    // Validate before rename.
    const result = schemaValidator.validateSchema(tmpPath);
    const hardErrors = (result.violations || []).filter(function (v) {
      return v.severity === schemaValidator.SEVERITY.ERROR ||
             v.severity === schemaValidator.SEVERITY.CRITICAL;
    });
    if (hardErrors.length > 0) {
      // Abort. Do NOT rename. Clean tmpfile.
      try { fs.unlinkSync(tmpPath); } catch (_e) { /* best effort */ }
      return { success: false, violations: result.violations, severity: result.severity };
    }

    // Atomic rename.
    fs.renameSync(tmpPath, finalPath);
    return { success: true, brain_md_path: finalPath, violations: result.violations || [] };
  } catch (err) {
    // On any failure, close + unlink tmpfile best-effort.
    try { if (fd !== null) fs.closeSync(fd); } catch (_e) { /* best effort */ }
    try { fs.unlinkSync(tmpPath); } catch (_e) { /* best effort */ }
    return { success: false, violations: [], severity: null, fs_error: String(err && err.message) };
  }
}

// ---------- Assembler ----------

function assembleBrainMd(frontmatter, sectionResults) {
  const fmLines = ['---'];
  for (const k of Object.keys(frontmatter)) {
    const v = frontmatter[k];
    if (v === null) {
      fmLines.push(k + ': null');
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      fmLines.push(k + ': ' + v);
    } else {
      // Quote strings (simple dialect: no embedded quotes in our controlled
      // scalars). We sanitize by stripping quote characters defensively.
      const s = String(v).replace(/["'`]/g, '');
      fmLines.push(k + ': "' + s + '"');
    }
  }
  fmLines.push('---');
  fmLines.push('');

  const bodyLines = [];
  for (const sec of SECTION_BUILDERS) {
    bodyLines.push('## ' + sec.heading);
    const entry = sectionResults[sec.heading];
    if (!entry || entry.skipped) {
      bodyLines.push('(no signal -- skipped)');
    } else if (entry.error) {
      bodyLines.push('(no signal -- ' + entry.error + ')');
    } else if (entry.empty) {
      bodyLines.push('(no signal)');
    } else if (entry.text) {
      bodyLines.push(entry.text);
    } else {
      bodyLines.push('(no signal)');
    }
    bodyLines.push('');
  }
  return fmLines.join('\n') + '\n' + bodyLines.join('\n') + '\n';
}

function renderRecords(result) {
  if (result == null) return { empty: true };
  if (Array.isArray(result.records)) {
    if (result.records.length === 0) return { empty: true };
    const lines = [];
    for (const rec of result.records.slice(0, 5)) {
      const name = rec.name || rec.framework || rec.indicator || rec.opportunity || rec.level || rec.from_framework || rec.problem_type || rec[0] || 'unnamed';
      lines.push('- ' + String(name).slice(0, 160));
    }
    return { text: lines.join('\n') };
  }
  if (Array.isArray(result.matches)) {
    if (result.matches.length === 0) return { empty: true };
    const lines = [];
    for (const m of result.matches.slice(0, 5)) {
      const t = m.title || m.name || JSON.stringify(m).slice(0, 120);
      lines.push('- ' + String(t).slice(0, 160));
    }
    return { text: lines.join('\n') };
  }
  return { empty: true };
}

// ---------- Main entry: deriveSection ----------

/**
 * deriveSection(roomPath, section, options)
 *   -> Promise<{success, brain_md_path?, violations[], cost_tokens, reason?, dry_run?, would_query?}>
 *
 * NEVER throws. Every failure mode becomes a structured result.
 */
async function deriveSection(roomPath, section, options) {
  options = options || {};
  const result = {
    success: false,
    violations: [],
    cost_tokens: 0,
  };

  // Defensive arg handling: malformed inputs return a structured failure.
  let sectionPath;
  try {
    if (typeof roomPath !== 'string' || typeof section !== 'string' ||
        roomPath.length === 0 || section.length === 0) {
      result.reason = 'invalid_args';
      return result;
    }
    sectionPath = path.join(roomPath, section);
  } catch (_e) {
    result.reason = 'invalid_args';
    return result;
  }

  // Dry-run shortcut: no Brain queries, no write.
  if (options.dry_run === true) {
    result.success = true;
    result.dry_run = true;
    const howMany = Array.isArray(options.only_sections) && options.only_sections.length > 0
      ? options.only_sections.length
      : SECTION_BUILDERS.length;
    result.would_query = howMany;
    return result;
  }

  // Brain availability gate. Phase 252-01 (SWEEP-01, CONFORM): result.reason
  // stays the byte-locked 'brain_unavailable' literal (multiple tests outside
  // this task's file scope assert it verbatim); an ADDITIVE result.refusal
  // field carries the rail's typed kind for a caller that wants it.
  try {
    if (!brainClient.isAvailable()) {
      result.reason = 'brain_unavailable';
      try {
        result.refusal = require('./refusal-messaging.cjs').refusalResponse('no_key', { tool: 'brain-derivation' });
      } catch (_e2) { /* disclosure is best-effort */ }
      return result;
    }
  } catch (_e) {
    result.reason = 'brain_unavailable';
    return result;
  }

  // Read the triple.
  let triple;
  try {
    triple = folderMemory.readTriple(sectionPath);
  } catch (_e) {
    result.reason = 'triple_read_error';
    return result;
  }

  if (!triple || !triple.reasoning || triple.reasoning.exists !== true) {
    result.reason = 'triple_incomplete';
    return result;
  }

  // Canon Part 8 chokepoint.
  const ctx = buildBrainQueryContext(triple, section);
  if (!ctx) {
    result.reason = 'ctx_build_failed';
    return result;
  }

  // Fetch Brain graph version ONCE.
  let brainGraphVersion = 0;
  try {
    const sch = await brainClient.schema();
    if (sch && typeof sch.brain_graph_version === 'number') {
      brainGraphVersion = sch.brain_graph_version;
    } else if (sch && sch.brain_graph_version != null) {
      brainGraphVersion = Number(sch.brain_graph_version) || 0;
    }
  } catch (err) {
    result.reason = categorizeError(err);
    return result;
  }

  ctx.brain_graph_version = brainGraphVersion;

  // Decide which sections to query.
  const onlySections = Array.isArray(options.only_sections) && options.only_sections.length > 0
    ? new Set(options.only_sections)
    : null;

  // Fire queries. First error wins; subsequent sections are skipped and
  // the function returns a structured failure with tmpfile cleanup.
  const sectionResults = {};
  let tokens = 0;
  let firstError = null;

  for (const sec of SECTION_BUILDERS) {
    if (onlySections && !onlySections.has(sec.heading)) {
      sectionResults[sec.heading] = { skipped: true };
      continue;
    }
    if (firstError) {
      sectionResults[sec.heading] = { skipped: true };
      continue;
    }
    let query;
    try {
      query = prompts[sec.builder](ctx);
    } catch (err) {
      // Builder-side allow-list violation. This is a Canon Part 8 internal
      // breach: abort immediately with a clear reason.
      firstError = { reason: 'ctx_build_failed', message: String(err && err.message) };
      sectionResults[sec.heading] = { error: 'ctx-violation' };
      continue;
    }
    if (query == null) {
      // Stub or inapplicable builder.
      sectionResults[sec.heading] = { empty: true };
      continue;
    }
    try {
      let res;
      if (sec.mode === 'search') {
        res = await brainClient.search(query, { topK: 5 });
      } else {
        res = await brainClient.query(query);
      }
      sectionResults[sec.heading] = renderRecords(res);
      // Cost estimate: conservative 60 tokens per call.
      tokens += 60;
    } catch (err) {
      firstError = { reason: categorizeError(err), message: String(err && err.message) };
      sectionResults[sec.heading] = { error: 'brain-error' };
    }
  }

  if (firstError) {
    result.reason = firstError.reason;
    result.cost_tokens = tokens;
    return result;
  }

  // Assemble frontmatter.
  const frontmatter = {
    section: ctx.section_slug,
    brain_generated_at: new Date().toISOString(),
    brain_graph_version: brainGraphVersion || 0,
    governing_thought_hash: ctx.governing_thought_hash || EMPTY_SHA256,
    staleness: schemaValidator.STALENESS.FRESH,
    author: 'brain',
    stale_reason: null,
    prompt_version: prompts.PROMPT_VERSION.value,
    cost_tokens: tokens,
    brain_query_count: SECTION_BUILDERS.reduce(function (n, sec) {
      return sectionResults[sec.heading] && !sectionResults[sec.heading].skipped && !sectionResults[sec.heading].empty ? n + 1 : n;
    }, 0),
  };

  // Phase 90-06 cross_room_scan hook: when opted in at call time, run
  // the cross-room aggregator after local derivation and overwrite the
  // 'Flagged Contradictions (cross-room)' section body with the
  // structural-only rendering. Canon Part 8 is enforced at four layers
  // inside the aggregator (ALLOWED_ROOT scope + GUARDRAIL.md sealed-room
  // + per-room opt-out + sanitizeDetailScalar / JSON.stringify audit).
  // Default off; opt-in per call.
  if (options.cross_room_scan === true) {
    try {
      const xroom = require('./cross-room-aggregator.cjs');
      const xroomResult = await xroom.aggregateContradictions(roomPath, {
        opt_in: true,
        max_rooms: Number.isFinite(options.cross_room_max_rooms) ? options.cross_room_max_rooms : 10,
        per_room_timeout_ms: Number.isFinite(options.cross_room_timeout_ms) ? options.cross_room_timeout_ms : 300,
      });
      const xroomBody = xroom.renderCrossRoomSection(xroomResult);
      sectionResults['Flagged Contradictions (cross-room)'] = { text: xroomBody };
    } catch (_e) {
      // Aggregator NEVER throws under normal conditions; any failure
      // here is catastrophic. Leave the section as the upstream Brain
      // query output (typically '(no signal)' since the stub builder
      // returns null).
    }
  }

  const body = assembleBrainMd(frontmatter, sectionResults);

  // Atomic write + schema gate. Test 6 forces bad staleness through
  // _test_force_bad_staleness to exercise the rejection branch.
  const writeOut = await atomicWriteBrainMd(
    sectionPath,
    body,
    options._test_force_bad_staleness === true
  );

  if (!writeOut.success) {
    result.violations = writeOut.violations || [];
    result.reason = writeOut.fs_error ? 'fs_error' : 'schema_rejected';
    result.cost_tokens = tokens;
    return result;
  }

  result.success = true;
  result.brain_md_path = writeOut.brain_md_path;
  result.violations = writeOut.violations || [];
  result.cost_tokens = tokens;
  return result;
}

// ---------- NAV-02 auto-fire entry point: ensureSectionDerived ----------
//
// Phase 142 (NAV-02). The consumption side is shipped: decide() reads
// readQuadruple and sets brain_md_tier_mode via resolveTierMode (tier_0 when
// BRAIN.md absent, higher when present + fresh + authored by brain). The single
// wiring gap this closes is the AUTO-FIRE: nothing in the live session path
// actually produces a BRAIN.md for an un-derived section, so the tier could
// never observably rise. ensureSectionDerived is that one-line auto-fire wire.
//
// Behaviour:
//   1. Idempotent: if a fresh, brain-authored BRAIN.md already sits in the
//      section, return early (no re-derive, no churn).
//   2. Live path: when the real Brain is reachable, delegate to the SHIPPED
//      deriveSection (full Brain-enriched derivation). No change to that path.
//   3. Local path: when the real Brain key is absent but the caller asserts
//      derivation should proceed (options.brainAvailable === true -- the local
//      Mode-A/offline-exempt session path), compose a minimal, schema-valid,
//      fresh, brain-authored BRAIN.md from the LOCAL triple. This fires NO Brain
//      query: it reuses the EXISTING Part-8 chokepoint buildBrainQueryContext
//      (hash + enum + slug only) plus the EXISTING assembler + atomic writer. No
//      new Brain query surface is introduced -- buildBrainQueryContext remains
//      the sole Brain-adjacent context builder in this module.
//
// NEVER throws; every failure mode returns a structured result mirroring
// deriveSection's contract.
async function ensureSectionDerived(roomPath, section, options) {
  options = options || {};

  // Defensive arg handling (same contract as deriveSection).
  let sectionPath;
  try {
    if (typeof roomPath !== 'string' || typeof section !== 'string' ||
        roomPath.length === 0 || section.length === 0) {
      return { success: false, violations: [], cost_tokens: 0, reason: 'invalid_args' };
    }
    sectionPath = path.join(roomPath, section);
  } catch (_e) {
    return { success: false, violations: [], cost_tokens: 0, reason: 'invalid_args' };
  }

  // (1) Idempotent short-circuit: a present, parseable, fresh, brain-authored
  //     BRAIN.md is already enough to lift the tier. Do not re-derive.
  try {
    const existing = folderMemory.readQuadruple(sectionPath);
    const brain = existing && existing.brain;
    if (brain && brain.parse_failed !== true &&
        brain.staleness === schemaValidator.STALENESS.FRESH &&
        brain.author === 'brain') {
      return {
        success: true,
        violations: [],
        cost_tokens: 0,
        already_fresh: true,
        brain_md_path: path.join(sectionPath, 'BRAIN.md'),
      };
    }
  } catch (_e) {
    // fall through to derivation
  }

  // (2) Live path: the real Brain is reachable -> the shipped full derivation.
  let brainReachable = false;
  try {
    brainReachable = brainClient.isAvailable() === true;
  } catch (_e) {
    brainReachable = false;
  }
  if (brainReachable) {
    return deriveSection(roomPath, section, options);
  }

  // (3) Local path: caller asserts derivation should proceed without a live
  //     Brain (Mode-A/offline-exempt local session). Compose a minimal,
  //     schema-valid, fresh BRAIN.md from the LOCAL triple through the EXISTING
  //     Part-8 chokepoint. Fires no Brain query.
  if (options.brainAvailable !== true) {
    return { success: false, violations: [], cost_tokens: 0, reason: 'brain_unavailable' };
  }

  let triple;
  try {
    triple = folderMemory.readTriple(sectionPath);
  } catch (_e) {
    return { success: false, violations: [], cost_tokens: 0, reason: 'triple_read_error' };
  }
  if (!triple || !triple.reasoning || triple.reasoning.exists !== true) {
    return { success: false, violations: [], cost_tokens: 0, reason: 'triple_incomplete' };
  }

  // Part-8 chokepoint: the ONLY Brain-adjacent context builder. Hash + enum +
  // slug only; no user prose crosses.
  const ctx = buildBrainQueryContext(triple, section);
  if (!ctx) {
    return { success: false, violations: [], cost_tokens: 0, reason: 'ctx_build_failed' };
  }

  // Frontmatter for a local (no-Brain-query) derivation. staleness:fresh +
  // author:brain so resolveTierMode lifts the section above tier_0. No Brain
  // graph version is available offline; 0 is the schema-valid sentinel.
  const frontmatter = {
    section: ctx.section_slug,
    brain_generated_at: new Date().toISOString(),
    brain_graph_version: 0,
    governing_thought_hash: ctx.governing_thought_hash || EMPTY_SHA256,
    staleness: schemaValidator.STALENESS.FRESH,
    author: 'brain',
    stale_reason: null,
    prompt_version: prompts.PROMPT_VERSION.value,
    cost_tokens: 0,
    brain_query_count: 0,
  };

  // No Brain queries fired -> every optional section renders as the
  // skipped/no-signal placeholder the assembler already emits.
  const sectionResults = {};
  for (const sec of SECTION_BUILDERS) {
    sectionResults[sec.heading] = { skipped: true };
  }

  const body = assembleBrainMd(frontmatter, sectionResults);
  const writeOut = await atomicWriteBrainMd(sectionPath, body, false);
  if (!writeOut.success) {
    return {
      success: false,
      violations: writeOut.violations || [],
      cost_tokens: 0,
      reason: writeOut.fs_error ? 'fs_error' : 'schema_rejected',
    };
  }

  return {
    success: true,
    violations: writeOut.violations || [],
    cost_tokens: 0,
    local_derivation: true,
    brain_md_path: writeOut.brain_md_path,
  };
}

// ---------- Error categorizer ----------

function categorizeError(err) {
  const msg = (err && err.message ? err.message : String(err || '')).toLowerCase();
  if (/timeout|etimedout|timed out/.test(msg)) return 'derivation_timeout';
  if (/rate[_\s-]?limited|429/.test(msg)) return 'rate_limited';
  if (/auth|401|unauthorized|invalid_key/.test(msg)) return 'auth_failed';
  return 'derivation_error';
}

// ---------- Exports ----------

module.exports = {
  deriveSection: deriveSection,
  ensureSectionDerived: ensureSectionDerived,
  buildBrainQueryContext: buildBrainQueryContext,
  classifyProblemType: classifyProblemType,
  derivePhaseIndicator: derivePhaseIndicator,
  deriveComplexity: deriveComplexity,
  // Frozen section registry so downstream plans (90-05, 90-07) can iterate.
  SECTION_BUILDERS: SECTION_BUILDERS,
  EMPTY_SHA256: EMPTY_SHA256,
  // Test surface: not part of the public API.
  _test: Object.freeze({
    atomicWriteBrainMd: atomicWriteBrainMd,
    assembleBrainMd: assembleBrainMd,
    renderRecords: renderRecords,
    categorizeError: categorizeError,
  }),
};
