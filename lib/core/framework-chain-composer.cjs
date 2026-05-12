#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-08 -- Framework Chain Composer (FEEDS_INTO chain proposal)
 * ====================================================================
 * Pure module. Parses BRAIN.md framework_chain_predictions section bodies
 * authored by Phase 90-01 deriveSection and proposes the next framework
 * to run when the user just completed framework A. The proposal becomes
 * an engine.offer_next_step candidate consumed by the navigation engine
 * (Plan 91-00) and rendered through the offer presenter (Plan 91-04).
 *
 * Phase 122-04 -- routed through the resolver (the only door)
 * ==========================================================
 * proposeNextFramework() now resolves the next framework's /mos: command
 * via lib/workflow/command-resolver.cjs commandsForFramework() -- the SOLE
 * deterministic framework -> command path, reading only the generated
 * data/command-registry.json. When the registry has no command for that
 * framework, command degrades to null ("no /mos: for [framework] yet" --
 * degrade, not fabricate per WORKFLOW-LAYER-SPEC reliability rule 5); the
 * offer presenter already treats a null/empty command as not-an-offer.
 * proposeNextFramework also returns a workflow field -- the resolver's
 * composeWorkflow([completed, next, ...successors]) array -- so a multi-hop
 * FEEDS_INTO chain is available as data on the proposal (a future plan can
 * carry it into offer_next_step / shape-f1-renderer; this plan only puts
 * the data there). mapFrameworkToCommandSlug() relies solely on the
 * resolver (then FALLBACK_COMMAND_SLUG) so any remaining caller also gets
 * the resolver answer.
 *
 * Phase 122-05 -- the residual map pruned
 * =======================================
 * FRAMEWORK_TO_COMMAND_SLUG is now Object.freeze({}) -- the resolver is the
 * ONLY framework-to-command door (data/command-registry.json, generated from
 * frontmatter; WORKFLOW-LAYER-SPEC reliability rule 1). The empty table is
 * kept only as a back-compat export. KNOWN_FRAMEWORKS stays exported as a
 * name-recognition bootstrap (it is NOT the framework-to-command source).
 *
 * Canon Part 2 Engine 1 + Appendix E:
 *   Framework chains power Act 1 -> BONO Orchestration handoffs.
 *   FEEDS_INTO is the Brain-flagged graph infrastructure (~40 edges in
 *   the curriculum graph as of v1.10.18). This plan converts that
 *   infrastructure into a user-facing capability per locked decision
 *   D-09 (Composable Methodology Adapters).
 *
 * Canon Part 3 Section 6 RECOMMENDED gate:
 *   The composer marks a proposal as recommended_eligible when its
 *   confidence is >= 0.7 (RECOMMENDED_FLOOR). The presenter respects
 *   this flag only when Mode A holds (brain reachable + fresh) -- the
 *   engine writes both flags into decision_trace and the presenter
 *   renders the marker only when both are true.
 *
 * Canon Part 7 (Reuse Before Build):
 *   FEEDS_INTO edges are existing graph infrastructure. Phase 90-01
 *   wrote them into BRAIN.md framework_chain_predictions sections via
 *   deriveSection. This module CONSUMES that representation without
 *   inventing a new chain format.
 *
 * Canon Part 8 (Graph Boundary):
 *   The composer reads ONLY the LOCAL BRAIN.md body via the section
 *   shape passed in by callers (readQuadruple.brain.sections). It NEVER
 *   queries Brain at engine time. The pre-derivation ran in Phase 90-01
 *   inside the buildBrainQueryContext chokepoint. Zero network. Zero
 *   shell-out. Zero brain-client touches.
 *
 * Pure module: zero throws, minimal fs touches (only detectCompleted-
 * Framework's mtime fallback uses fs.readdir + fs.stat, both wrapped in
 * try/catch).
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

// The resolver (the only door). Required lazily inside the functions that
// need it so a missing module never crashes a caller that does not use the
// resolver path -- but it is an in-repo sibling so this never fails in
// practice. Reads only data/command-registry.json; never touches the Brain.

// ---------- Frozen constants ----------

// Confidence gates per locked decision in PLAN frontmatter:
//   < 0.5  -> null (noise floor; proposal suppressed)
//   >= 0.5 -> proposal returned (no RECOMMENDED marker eligibility)
//   >= 0.7 -> proposal returned + recommended_eligible:true
const NOISE_FLOOR = 0.5;
const RECOMMENDED_FLOOR = 0.7;

// Recent-write window for mtime fallback completion detection. Five
// minutes per PLAN frontmatter (Wave 3 acceptable heuristic; future
// plans may layer richer signal on top).
const RECENT_WRITE_WINDOW_MS = 5 * 60 * 1000;

// Bootstrap KNOWN_FRAMEWORKS list. NAME-RECOGNITION BOOTSTRAP ONLY -- this is
// NOT the framework-to-command source (that is OWNED by lib/workflow/
// command-resolver.cjs, reading the generated data/command-registry.json).
// detectCompletedFramework() uses this list to recognize a framework name in a
// governing thought / a filed-artifact slug; the list is conservative; a
// Brain-derived FEEDS_INTO edge may reference a framework outside this set, in
// which case completion detection falls through to the mtime slug fallback.
// The list is extensible; future plans may pull from the Brain frameworks
// catalog directly.
const KNOWN_FRAMEWORKS = Object.freeze([
  'SWOT Analysis',
  'Porter Five Forces',
  'Value Chain Analysis',
  'Business Model Canvas',
  'Lean Canvas',
  'Jobs-to-be-Done',
  'Value Proposition Canvas',
  '5 Whys',
  'First Principles',
  'Design Thinking',
  'Blue Ocean Strategy',
  "Innovator's Dilemma",
  '7 S Framework',
  'Balanced Scorecard',
  'Mullins',
  'Beautiful Question',
  'Soft Systems',
  'Rich Pictures',
]);

// Framework-to-command mapping is OWNED by lib/workflow/command-resolver.cjs
// (the generated data/command-registry.json, built from each command's
// frontmatter -- WORKFLOW-LAYER-SPEC reliability rule 1: a single source of
// truth, nothing else asserts the mapping). Phase 122-05 pruned this table to
// an empty Object.freeze({}); it is kept ONLY as an empty back-compat export
// so any caller that still imports FRAMEWORK_TO_COMMAND_SLUG does not crash.
// Do NOT add entries here -- declare `frameworks:` in the command frontmatter.
const FRAMEWORK_TO_COMMAND_SLUG = Object.freeze({});

// Default fallback command when the next framework has no known mapping.
const FALLBACK_COMMAND_SLUG = 'beautiful-question';

// ---------- Section parser ----------

/**
 * parseFrameworkChainSection(section) -> edges[]
 *
 * Parses BRAIN.md framework_chain_predictions section body into an array
 * of FEEDS_INTO edges. Returns [] on null / undefined / empty / no-signal.
 *
 * Tolerant of two body formats:
 *   1. "Framework A FEEDS_INTO Framework B (confidence: 0.85, phase: x)"
 *   2. "Framework A -> Framework B (confidence: 0.85)"
 *
 * Confidence may be omitted; the resulting edge.confidence is null
 * (preserved per plan Test 4 -- the structural relationship survives so
 * downstream gating can decide).
 *
 * Each line that does not match either pattern is silently skipped.
 *
 * @param {object|null} section -- {body, tokens_estimate} or null
 * @returns {Array<{from:string, to:string, confidence:number|null, phase_indicator:string|null}>}
 */
function parseFrameworkChainSection(section) {
  if (section === null || section === undefined) return [];
  if (typeof section !== 'object') return [];
  const body = section.body;
  if (typeof body !== 'string' || body.length === 0) return [];
  if (/^\s*\(no\s*signal\)\s*$/i.test(body)) return [];

  const out = [];
  const lines = body.split(/\r?\n/);

  // Primary pattern: FEEDS_INTO with optional (confidence: ..., phase: ...) tail.
  // Tolerates leading bullet/whitespace and forms with no confidence.
  // Captures: from, to, confidence (optional), phase (optional).
  // We extract in two passes (with-tail then bare) to keep the regex simple.
  const reFeedsWithTail = /^[\s\-*]*(.+?)\s+FEEDS_INTO\s+(.+?)\s*\(\s*(?:confidence|conf)\s*:\s*([01](?:\.\d+)?|0?\.\d+)(?:\s*,\s*phase\s*:\s*([^)]+?))?\s*\)\s*$/i;
  const reFeedsBare = /^[\s\-*]*(.+?)\s+FEEDS_INTO\s+(.+?)\s*$/i;
  const reArrowWithTail = /^[\s\-*]*(.+?)\s*->\s*(.+?)\s*\(\s*(?:confidence|conf)\s*:\s*([01](?:\.\d+)?|0?\.\d+)(?:\s*,\s*phase\s*:\s*([^)]+?))?\s*\)\s*$/i;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/u, ''); // rtrim
    if (line.length === 0) continue;

    let m = reFeedsWithTail.exec(line);
    if (m) {
      const from = m[1].trim();
      const to = m[2].trim();
      const conf = parseConfidenceOrNull(m[3]);
      const phase = m[4] !== undefined && m[4] !== null ? m[4].trim() : null;
      if (from.length > 0 && to.length > 0) {
        out.push({ from: from, to: to, confidence: conf, phase_indicator: phase });
      }
      continue;
    }

    m = reArrowWithTail.exec(line);
    if (m) {
      const from = m[1].trim();
      const to = m[2].trim();
      const conf = parseConfidenceOrNull(m[3]);
      const phase = m[4] !== undefined && m[4] !== null ? m[4].trim() : null;
      if (from.length > 0 && to.length > 0) {
        out.push({ from: from, to: to, confidence: conf, phase_indicator: phase });
      }
      continue;
    }

    // FEEDS_INTO bare (no parenthetical) -- preserve edge with null
    // confidence per Test 4.
    m = reFeedsBare.exec(line);
    if (m) {
      const from = m[1].trim();
      const to = m[2].trim();
      if (from.length > 0 && to.length > 0) {
        out.push({ from: from, to: to, confidence: null, phase_indicator: null });
      }
      continue;
    }
    // No match -> silent skip (forward-compat with future formats).
  }

  return out;
}

function parseConfidenceOrNull(s) {
  if (typeof s !== 'string') return null;
  const v = parseFloat(s);
  if (!Number.isFinite(v)) return null;
  if (v < 0 || v > 1) return null;
  return v;
}

// ---------- Completion detection ----------

/**
 * detectCompletedFramework(roomDir, sectionPath, reasoning) -> string|null
 *
 * Detects which framework the user just completed via two cascading paths:
 *   1. Primary: governing_thought substring match against KNOWN_FRAMEWORKS
 *      (case-insensitive). Returns the canonical framework name from
 *      KNOWN_FRAMEWORKS (preserves canonical capitalization).
 *   2. Fallback: scan section_path for files whose basename slug matches
 *      a known framework slug, with mtime within the recent-write window
 *      (5 minutes). Returns the canonical framework name on match.
 *
 * Returns null on no signal. Never throws.
 *
 * @param {string} roomDir
 * @param {string} sectionPath -- absolute path to active section dir
 * @param {object|null} reasoning -- quadruple.reasoning shape (may be null)
 * @returns {string|null}
 */
function detectCompletedFramework(roomDir, sectionPath, reasoning) {
  // Primary path: governing_thought match.
  if (reasoning && typeof reasoning === 'object') {
    const gt = reasoning.governing_thought;
    if (typeof gt === 'string' && gt.length > 0) {
      const lc = gt.toLowerCase();
      // Case-insensitive substring match against canonical framework
      // names. Iterate KNOWN_FRAMEWORKS in declaration order so longer/
      // more-specific names that contain shorter names (e.g. "Lean
      // Canvas" vs "Canvas") get matched correctly. We do NOT need to
      // dedupe; first match wins.
      for (const fw of KNOWN_FRAMEWORKS) {
        if (lc.indexOf(fw.toLowerCase()) !== -1) {
          return fw;
        }
      }
    }
  }

  // Fallback: mtime scan of section directory.
  if (typeof sectionPath === 'string' && sectionPath.length > 0) {
    try {
      const stat = fs.statSync(sectionPath);
      if (stat.isDirectory()) {
        const now = Date.now();
        const entries = fs.readdirSync(sectionPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const filePath = path.join(sectionPath, entry.name);
          let fileStat;
          try {
            fileStat = fs.statSync(filePath);
          } catch (_) {
            continue;
          }
          if (now - fileStat.mtimeMs > RECENT_WRITE_WINDOW_MS) continue;
          // Slug-match the basename (without extension) against known
          // framework slugs.
          const base = entry.name.replace(/\.[^.]+$/u, '').toLowerCase();
          const baseSlug = base.replace(/[\s_]+/g, '-');
          for (const fw of KNOWN_FRAMEWORKS) {
            const fwSlug = fw.toLowerCase().replace(/[\s_]+/g, '-');
            if (baseSlug === fwSlug || baseSlug.indexOf(fwSlug) !== -1) {
              return fw;
            }
          }
        }
      }
    } catch (_) {
      // missing dir / permission denied / etc -> fall through to null
    }
  }

  return null;
}

// ---------- Chain proposal ----------

/**
 * proposeNextFramework(completedFramework, edges) -> proposal|null
 *
 * Filters edges by edge.from === completedFramework (case-insensitive),
 * sorts by confidence descending (null confidence sorts last), takes the
 * top edge, applies the noise gate (< 0.5 -> null), maps the next
 * framework to a /mos: command, and returns the proposal.
 *
 * Output:
 *   {
 *     next: string,                  // canonical "next" framework name
 *     confidence: number,
 *     source: 'FEEDS_INTO',
 *     phase_indicator: string|null,
 *     command: string|null,          // '/mos:<slug>' from the resolver, or null
 *                                    //   when the registry has no command for
 *                                    //   `next` yet (degrade, do not fabricate)
 *     workflow: Array|null,           // resolver.composeWorkflow([completed, next, ...])
 *                                    //   -- the multi-hop chain as data; the engine
 *                                    //   does not propagate it yet (future plan)
 *     reason: string,                // grounding text (FEEDS_INTO + Brain + confidence)
 *     recommended_eligible: boolean, // true when confidence >= 0.7
 *   }
 *
 * Returns null when:
 *   - completedFramework is null/empty
 *   - edges is null/empty
 *   - no edge has matching from
 *   - top edge confidence < 0.5
 *
 * Never throws.
 *
 * @param {string|null} completedFramework
 * @param {Array} edges
 * @returns {object|null}
 */
function proposeNextFramework(completedFramework, edges) {
  if (typeof completedFramework !== 'string' || completedFramework.length === 0) return null;
  if (!Array.isArray(edges) || edges.length === 0) return null;

  const targetLc = completedFramework.toLowerCase();

  // Filter: edge.from must match completedFramework (case-insensitive).
  const matching = [];
  for (const e of edges) {
    if (!e || typeof e !== 'object') continue;
    const f = typeof e.from === 'string' ? e.from : null;
    const t = typeof e.to === 'string' ? e.to : null;
    if (f === null || t === null) continue;
    if (f.toLowerCase() !== targetLc) continue;
    matching.push(e);
  }
  if (matching.length === 0) return null;

  // Sort by confidence descending (null sorts last).
  matching.sort(function (a, b) {
    const ac = (typeof a.confidence === 'number') ? a.confidence : -Infinity;
    const bc = (typeof b.confidence === 'number') ? b.confidence : -Infinity;
    return bc - ac;
  });

  const top = matching[0];
  const conf = (typeof top.confidence === 'number') ? top.confidence : null;

  // Noise gate: < 0.5 -> null. null confidence is ALSO suppressed by
  // the noise gate (we cannot certify a confidenceless edge).
  if (conf === null || conf < NOISE_FLOOR) return null;

  // Resolve next -> /mos: command via the resolver (the only door). The
  // resolver reads only data/command-registry.json; it never touches the
  // Brain. When the registry has no command for `next`, command degrades
  // to null -- "no /mos: for [framework] yet" -- never a fabricated one
  // (WORKFLOW-LAYER-SPEC reliability rule 5). The offer presenter already
  // treats a null/empty command as not-an-offer.
  let resolver = null;
  try {
    resolver = require('../workflow/command-resolver.cjs');
  } catch (_e) {
    resolver = null;
  }
  let command = null;
  let workflow = null;
  if (resolver) {
    try {
      const cmds = resolver.commandsForFramework(top.to);
      command = (Array.isArray(cmds) && cmds.length > 0) ? cmds[0] : null;
    } catch (_e) {
      command = null;
    }
    // Multi-step path: build the resolver's composeWorkflow for the chain
    // [completedFramework, next, ...further FEEDS_INTO successors up to ~3].
    // This puts the multi-hop chain on the proposal as data; the navigation
    // engine does not propagate `workflow` into offer_next_step in this plan
    // (the presenter / shape-f1-renderer wiring is a future plan's job).
    try {
      const chain = collectForwardChain(completedFramework, edges, 3);
      workflow = resolver.composeWorkflow(chain);
    } catch (_e) {
      workflow = null;
    }
  }

  // Grounding-rule reason: must contain FEEDS_INTO + Brain + the
  // confidence number per Plan 91-04 presenter contract + Test 13. When
  // there is no command for `next`, the reason still names the framework
  // (the consumer prints "run [framework] manually" rather than a command).
  const confStr = conf.toFixed(2);
  const reason =
    completedFramework + ' FEEDS_INTO ' + top.to +
    ' (Brain confidence ' + confStr + '). Continuing the chain keeps pedagogical flow.';

  return {
    next: top.to,
    confidence: conf,
    source: 'FEEDS_INTO',
    phase_indicator: (typeof top.phase_indicator === 'string') ? top.phase_indicator : null,
    command: command,
    workflow: workflow,
    reason: reason,
    recommended_eligible: conf >= RECOMMENDED_FLOOR,
  };
}

/**
 * collectForwardChain(start, edges, maxHops) -> [start, next, ...]
 *
 * Walks the highest-confidence FEEDS_INTO edge from `start`, then from that
 * successor, etc., up to `maxHops` hops. Cycle-safe (a framework already in
 * the chain stops the walk). Only follows edges that pass the noise floor.
 * Returns at least [start]. Pure: no I/O.
 *
 * @param {string} start
 * @param {Array} edges
 * @param {number} maxHops
 * @returns {string[]}
 */
function collectForwardChain(start, edges, maxHops) {
  const chain = [start];
  if (!Array.isArray(edges) || edges.length === 0) return chain;
  const hops = (typeof maxHops === 'number' && maxHops > 0) ? maxHops : 3;
  const seen = new Set([String(start).toLowerCase()]);
  let current = start;
  for (let i = 0; i < hops; i += 1) {
    const cur = String(current).toLowerCase();
    let best = null;
    for (const e of edges) {
      if (!e || typeof e !== 'object') continue;
      if (typeof e.from !== 'string' || typeof e.to !== 'string') continue;
      if (e.from.toLowerCase() !== cur) continue;
      const c = (typeof e.confidence === 'number') ? e.confidence : null;
      if (c === null || c < NOISE_FLOOR) continue;
      if (best === null || c > best.confidence) best = { to: e.to, confidence: c };
    }
    if (best === null) break;
    const nextLc = best.to.toLowerCase();
    if (seen.has(nextLc)) break;
    chain.push(best.to);
    seen.add(nextLc);
    current = best.to;
  }
  return chain;
}

/**
 * mapFrameworkToCommandSlug(name) -> slug
 *
 * Maps a framework name (in any case) to a /mos: command slug via the resolver
 * (lib/workflow/command-resolver.cjs commandsForFramework -- the ONLY door,
 * reads only data/command-registry.json, never touches the Brain), falling
 * back to FALLBACK_COMMAND_SLUG ('beautiful-question') when the registry has no
 * command for `name` or the resolver is unavailable. Phase 122-05 removed the
 * legacy in-module table (FRAMEWORK_TO_COMMAND_SLUG is now empty) -- the
 * resolver is authoritative.
 *
 * Note: proposeNextFramework() does NOT use this helper -- it calls
 * commandsForFramework() directly so it can degrade to command:null (the
 * helper keeps a non-null fallback for back-compat with callers that expect
 * a slug string).
 *
 * @param {string} name
 * @returns {string}
 */
function mapFrameworkToCommandSlug(name) {
  if (typeof name !== 'string' || name.length === 0) return FALLBACK_COMMAND_SLUG;
  // Resolver -- the only door.
  try {
    const cmds = require('../workflow/command-resolver.cjs').commandsForFramework(name);
    if (Array.isArray(cmds) && cmds.length > 0) {
      return cmds[0].replace(/^\/mos:/, '');
    }
  } catch (_e) {
    // resolver unavailable -> fall through to the fallback slug
  }
  return FALLBACK_COMMAND_SLUG;
}

// ---------- Exports ----------

module.exports = {
  parseFrameworkChainSection: parseFrameworkChainSection,
  detectCompletedFramework: detectCompletedFramework,
  proposeNextFramework: proposeNextFramework,
  collectForwardChain: collectForwardChain,
  // Exported for back-compat: relies solely on the resolver, then the
  // fallback slug. Phase 122-05 removed the legacy in-module table.
  mapFrameworkToCommandSlug: mapFrameworkToCommandSlug,
  // KNOWN_FRAMEWORKS is a name-recognition bootstrap (NOT the framework-to-
  // command source). FRAMEWORK_TO_COMMAND_SLUG is an EMPTY back-compat export
  // (Phase 122-05) -- the resolver (data/command-registry.json) is the only door.
  KNOWN_FRAMEWORKS: KNOWN_FRAMEWORKS,
  FRAMEWORK_TO_COMMAND_SLUG: FRAMEWORK_TO_COMMAND_SLUG,
  // Constants exposed for invariant tests + downstream callers.
  NOISE_FLOOR: NOISE_FLOOR,
  RECOMMENDED_FLOOR: RECOMMENDED_FLOOR,
  RECENT_WRITE_WINDOW_MS: RECENT_WRITE_WINDOW_MS,
  FALLBACK_COMMAND_SLUG: FALLBACK_COMMAND_SLUG,
};
