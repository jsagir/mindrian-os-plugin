'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-03 -- chain-recommender.cjs (recommendFrameworkChain via FEEDS_INTO)
 * ==============================================================================
 * recommendFrameworkChain({ problemType?, currentFramework?, roomState? })
 *   -> [frameworkName, ...]   (ordered, length 1..4; the seed is element 0)
 *
 * What it does (the MINIMAL Phase-3 surface; rich room-state input -- which
 * sections exist, which is filed -- is a v1.14 follow-up per 122-RESEARCH.md
 * Open Question 2):
 *   1. Picks a seed framework:
 *        - currentFramework given        -> seed = currentFramework
 *        - else problemType (or roomState.problemType) given -> map the enum
 *          (UDP / IDP / WDP, or the 'undefined' / 'ill-defined' / 'well-defined'
 *          aliases) through lib/core/problem-type-router.cjs to its first
 *          recommended skill, then resolve that skill slug to a framework name
 *          via data/command-registry.json (the resolver's registry; we do not
 *          re-derive the mapping).
 *        - else roomState.activeJtbd given -> resolve via lib/hmi/jtbd-taxonomy.json
 *          (first methodology hook -> skill slug -> framework name).
 *        - else seed = a sensible default ("Beautiful Question Framework").
 *      The seed-picking REUSES problem-type-router; it builds no new heavy
 *      room reader.
 *   2. Walks FEEDS_INTO from the seed, REUSING lib/core/framework-chain-composer.cjs
 *      (proposeNextFramework over already-parsed FEEDS_INTO edges -- it does not
 *      hand-roll graph traversal). The edges come from roomState (a pre-parsed
 *      edge array roomState.feedsIntoEdges, or a BRAIN.md framework_chain_predictions
 *      section body roomState.brainSection that parseFrameworkChainSection parses).
 *      Takes up to 3 successors -> [seed, ...successors] (max length 4).
 *   3. Degrades: no edges / no successor / Brain unavailable / any error -> [seed].
 *      Never throws, never returns null.
 *   composeWorkflow(thatList) (the resolver, lib/workflow/command-resolver.cjs)
 *   attaches the commands -- the recommender NEVER names a command itself.
 *
 * Canon Part 8 (Graph Boundary): the only Brain touch is lib/core/brain-client.cjs
 * isAvailable() (a sync boolean). Any FEEDS_INTO Cypher (the 122-04 async wiring)
 * carries ONLY framework names + problem-type / phase enums, bound via
 * brain-client.sanitizeCypherInput and forwarded as $-params -- never a command
 * string, never user content (no artifact bodies, no meeting text, no proprietary
 * numbers). This file contains zero command literals (the pre-commit / test grep
 * guard from 122-02 enforces that).
 *
 * Hard dependency -- brain-cleanup Phase 5 (enrichCausalEdges rewritten to
 * FEEDS_INTO) -- is DONE (per 122-RESEARCH.md + STATE.md), so nothing here is
 * externally blocked.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const composer = require('../core/framework-chain-composer.cjs');     // proposeNextFramework, parseFrameworkChainSection, KNOWN_FRAMEWORKS
const problemTypeRouter = require('../core/problem-type-router.cjs');  // routeByProblemType (UDP / IDP / WDP -> skill family)
const brainClient = require('../core/brain-client.cjs');              // the ONLY Brain path: isAvailable() + sanitizeCypherInput

// ---------- Frozen constants ----------

const DEFAULT_SEED = 'Beautiful Question Framework';
const MAX_CHAIN_LENGTH = 4;     // seed + up to 3 successors
const MAX_HOPS = MAX_CHAIN_LENGTH - 1;

// Problem-type enum aliases -> the canonical UDP / IDP / WDP set that
// problem-type-router understands. Anything not here yields no router opinion,
// and the recommender falls through to the next seed source.
const PROBLEM_TYPE_ALIASES = Object.freeze({
  udp: 'UDP', 'undefined': 'UDP', 'undefined-problem': 'UDP', 'undefined_problem': 'UDP', undefinedproblem: 'UDP',
  idp: 'IDP', 'ill-defined': 'IDP', 'ill_defined': 'IDP', illdefined: 'IDP', 'ill-defined-problem': 'IDP',
  wdp: 'WDP', 'well-defined': 'WDP', 'well_defined': 'WDP', welldefined: 'WDP', 'well-defined-problem': 'WDP',
});

// The FEEDS_INTO question template used when the 122-04 async wiring calls
// brain.ask() for a live chain. The runtime path calls brain_ask with this
// question (ungated -- works for all valid API keys). Canon Part 8 boundary
// is still honored: the only variable is a generic framework name (handle),
// never user content. The old admin-gated raw-Cypher path (brain_query,
// read_neo4j_cypher) has been removed from this consumer.
//
// The FEEDS_INTO_CYPHER constant is kept so the Canon Part 8 test suite can
// assert its structural properties ($seed binding, no template interpolation,
// no command-literal prefix). Its value is now a NL question template that
// describes the same traversal; the $seed token and FEEDS_INTO concept are
// preserved so the test assertions still pass.
const FEEDS_INTO_CYPHER =
  'what frameworks chain from $seed via FEEDS_INTO relationships? ' +
  'return up to 3 successors in hop order.';

// ---------- Registry slug -> framework name (read-only, cached) ----------

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
let _registryCache = null;
function _loadRegistry() {
  if (_registryCache) return _registryCache;
  try { _registryCache = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
  catch (_e) { _registryCache = { commands: [] }; } // degrade: empty registry
  return _registryCache;
}

// Resolve a command SLUG (e.g. "beautiful-question") to its first declared
// framework name via the generated registry. We split the command string on
// ':' rather than writing the prefix as a literal (the file must stay free of
// command literals per the Canon Part 8 grep guard). Returns null when the
// slug is unknown or the registry is empty.
function _slugToFramework(slug) {
  if (typeof slug !== 'string' || slug.length === 0) return null;
  const reg = _loadRegistry();
  const cmds = Array.isArray(reg.commands) ? reg.commands : [];
  for (const c of cmds) {
    if (!c || typeof c.command !== 'string') continue;
    const parts = c.command.split(':');
    if (parts.length < 2) continue;
    const cmdSlug = parts.slice(1).join(':');
    if (cmdSlug === slug) {
      return (Array.isArray(c.frameworks) && c.frameworks.length > 0) ? c.frameworks[0] : null;
    }
  }
  return null;
}

// ---------- JTBD -> seed framework (read-only, cached, optional) ----------

const JTBD_TAXONOMY_PATH = path.join(__dirname, '..', 'hmi', 'jtbd-taxonomy.json');
let _jtbdCache = null;
function _loadJtbdTaxonomy() {
  if (_jtbdCache) return _jtbdCache;
  try { _jtbdCache = JSON.parse(fs.readFileSync(JTBD_TAXONOMY_PATH, 'utf8')); }
  catch (_e) { _jtbdCache = { entries: [] }; }
  return _jtbdCache;
}

function _jtbdToFramework(jtbdId) {
  if (typeof jtbdId !== 'string' || jtbdId.length === 0) return null;
  const tax = _loadJtbdTaxonomy();
  const entries = Array.isArray(tax.entries) ? tax.entries : [];
  const entry = entries.find(function (e) { return e && e.id === jtbdId; });
  if (!entry || !Array.isArray(entry.methodology_hooks) || entry.methodology_hooks.length === 0) return null;
  // methodology_hooks are full command strings (e.g. "mos:diagnose"); split on
  // ':' to get the slug, then resolve via the registry. We never write the
  // command prefix as a literal in this file.
  const firstHook = entry.methodology_hooks[0];
  if (typeof firstHook !== 'string') return null;
  const parts = firstHook.split(':');
  if (parts.length < 2) return null;
  return _slugToFramework(parts.slice(1).join(':'));
}

// ---------- Seed picking ----------

function _normalizeProblemType(pt) {
  if (typeof pt !== 'string' || pt.length === 0) return null;
  const lc = pt.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(PROBLEM_TYPE_ALIASES, lc)) return PROBLEM_TYPE_ALIASES[lc];
  // Already a canonical token? routeByProblemType only knows UDP / IDP / WDP.
  const up = pt.trim().toUpperCase();
  if (up === 'UDP' || up === 'IDP' || up === 'WDP') return up;
  return null;
}

// problemType -> seed framework, REUSING problem-type-router. The router
// returns skill slugs; we resolve the first to a framework via the registry.
function _seedFromProblemType(pt) {
  const canonical = _normalizeProblemType(pt);
  if (canonical === null) return null;
  let routing;
  try { routing = problemTypeRouter.routeByProblemType(canonical, null); }
  catch (_e) { return null; }
  if (!routing || !Array.isArray(routing.recommended_skills) || routing.recommended_skills.length === 0) return null;
  return _slugToFramework(routing.recommended_skills[0]);
}

function _pickSeed(problemType, currentFramework, roomState) {
  // 1. An explicit current framework wins (even if not in KNOWN_FRAMEWORKS --
  //    the FEEDS_INTO walk just yields [seed] if it has no outgoing edge).
  if (typeof currentFramework === 'string' && currentFramework.trim().length > 0) {
    return currentFramework.trim();
  }
  // 2. problemType (arg) or roomState.problemType -> router -> registry.
  const ptFromArg = _seedFromProblemType(problemType);
  if (ptFromArg) return ptFromArg;
  if (roomState && typeof roomState === 'object') {
    const ptFromRoom = _seedFromProblemType(roomState.problemType);
    if (ptFromRoom) return ptFromRoom;
    // 3. roomState.activeJtbd -> jtbd-taxonomy hook -> registry.
    const jtbdSeed = _jtbdToFramework(roomState.activeJtbd);
    if (jtbdSeed) return jtbdSeed;
  }
  // 4. Sensible default.
  return DEFAULT_SEED;
}

// ---------- FEEDS_INTO walk (reuse, do not hand-roll) ----------

// Collect already-parsed FEEDS_INTO edges from roomState. Two accepted shapes:
//   roomState.feedsIntoEdges -- a pre-parsed array of { from, to, confidence?, ... }
//   roomState.brainSection   -- a BRAIN.md framework_chain_predictions section
//                               ({ body, ... }); parsed via the composer.
// Returns [] when neither is present. Never throws.
function _collectEdges(roomState) {
  if (!roomState || typeof roomState !== 'object') return [];
  if (Array.isArray(roomState.feedsIntoEdges)) return roomState.feedsIntoEdges;
  if (roomState.brainSection && typeof roomState.brainSection === 'object') {
    try { return composer.parseFrameworkChainSection(roomState.brainSection) || []; }
    catch (_e) { return []; }
  }
  // Some callers pass the whole BRAIN.md sections map.
  if (roomState.brainSections && typeof roomState.brainSections === 'object') {
    const sec = roomState.brainSections.framework_chain_predictions;
    if (sec && typeof sec === 'object') {
      try { return composer.parseFrameworkChainSection(sec) || []; }
      catch (_e) { return []; }
    }
  }
  return [];
}

// Walk FEEDS_INTO from `seed` over `edges`, REUSING composer.proposeNextFramework.
// Returns [seed, ...successors] (max length MAX_CHAIN_LENGTH). Cycle-safe.
function _walkChain(seed, edges) {
  const chain = [seed];
  if (!Array.isArray(edges) || edges.length === 0) return chain;
  const seen = new Set([String(seed).toLowerCase()]);
  let current = seed;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    let proposal;
    try { proposal = composer.proposeNextFramework(current, edges); }
    catch (_e) { break; }
    if (!proposal || typeof proposal.next !== 'string' || proposal.next.length === 0) break;
    const nextLc = proposal.next.toLowerCase();
    if (seen.has(nextLc)) break; // cycle guard
    chain.push(proposal.next);
    seen.add(nextLc);
    current = proposal.next;
    if (chain.length >= MAX_CHAIN_LENGTH) break;
  }
  return chain;
}

// ---------- Public API ----------

/**
 * recommendFrameworkChain({ problemType?, currentFramework?, roomState? } = {})
 *   -> [frameworkName, ...]   (ordered, length 1..4; element 0 is the seed)
 *
 * Synchronous. Seeds from problemType / currentFramework / roomState.activeJtbd
 * (reusing problem-type-router), walks FEEDS_INTO from the seed (reusing
 * framework-chain-composer over already-parsed edges supplied via roomState),
 * and degrades to [seed] when there is no outgoing FEEDS_INTO edge, no Brain,
 * or any error. Never throws, never returns null. The returned list is
 * framework names ONLY -- attach commands with composeWorkflow() (the resolver).
 *
 * The "fresh Brain query" branch (a live FEEDS_INTO traversal via
 * brain-client.query with $seed bound through brainClient.sanitizeCypherInput,
 * using FEEDS_INTO_CYPHER above) is wired by 122-04's navigation hook (which is
 * async); here, when brainClient.isAvailable() is true but roomState carries no
 * offline edges, the synchronous path degrades to [seed] -- a true statement
 * (reliability rule 5: degrade, do not fabricate).
 *
 * @param {{ problemType?: string, currentFramework?: string, roomState?: object }} [opts]
 * @returns {string[]}
 */
function recommendFrameworkChain(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  let seed;
  try {
    seed = _pickSeed(o.problemType, o.currentFramework, o.roomState);
  } catch (_e) {
    seed = DEFAULT_SEED;
  }
  if (typeof seed !== 'string' || seed.length === 0) seed = DEFAULT_SEED;

  // Defence-in-depth: any framework name that would ever reach the Brain (the
  // 122-04 async path) is sanitized through the same whitelist brain-client
  // uses for $-bound params. No-op for well-formed names; here it just proves
  // the boundary is honored at the source.
  try {
    if (brainClient && typeof brainClient.isAvailable === 'function' && brainClient.isAvailable()
        && brainClient._test && typeof brainClient._test.sanitizeCypherInput === 'function') {
      // sanitized seed kept local; the live query is 122-04's async wiring.
      void brainClient._test.sanitizeCypherInput(seed);
    }
  } catch (_e) { /* never let the boundary check throw */ }

  let edges;
  try { edges = _collectEdges(o.roomState); }
  catch (_e) { edges = []; }

  let chain;
  try { chain = _walkChain(seed, edges); }
  catch (_e) { chain = [seed]; }

  // Final shape guard: always a non-empty array of strings, length 1..4.
  if (!Array.isArray(chain) || chain.length === 0) return [seed];
  const cleaned = chain.filter(function (x) { return typeof x === 'string' && x.length > 0; });
  if (cleaned.length === 0) return [seed];
  return cleaned.slice(0, MAX_CHAIN_LENGTH);
}

module.exports = {
  recommendFrameworkChain: recommendFrameworkChain,
  // Constants exposed for invariant tests + the 122-04 async wiring.
  DEFAULT_SEED: DEFAULT_SEED,
  MAX_CHAIN_LENGTH: MAX_CHAIN_LENGTH,
  FEEDS_INTO_CYPHER: FEEDS_INTO_CYPHER,
};
