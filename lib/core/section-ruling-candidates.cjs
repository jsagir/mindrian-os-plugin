'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 02 Task 8 (D-353-3, R-353-H, R-353-N) -- the pure ledger
 * candidate producer. Feeds `f-selector-ranker.cjs::rankForSelector`'s
 * EXISTING `tierCandidates` seam (Phase 244 TRIG-02); this file adds NO new
 * argument to that function and changes NO scalar inside it.
 *
 * WHY THE CONFIDENCE FLOOR HERE IS A DIFFERENT SCALAR from the dial's
 * `RECOMMEND_FLOOR` (0.70, `lib/hmi/dial-reach-orchestrator.cjs`) and from
 * `REGISTRY_DEFAULT_BRAIN_CONFIDENCE` (0.5, same file): THIS floor is a
 * vendor (Jev) score-confidence over a RANKED COMMAND LIST, calibrated per
 * ledger build against a labeled fixture set (R-353-N). THAT floor is a
 * Canon Part 3 FROZEN detent over SIX machine reaches, constitutional and
 * untouched. Nothing in this phase moves a frozen scalar; the two floors
 * measure different things and happen to share the word "confidence".
 *
 * ELIGIBILITY FILTER (D-353-3), applied in this order:
 *   1. Ledger membership itself IS the "produces glob names this folder"
 *      condition: a command only enters a ledger row through the R-353-C
 *      union join (Task 2) at BUILD time, so re-checking a live `produces`
 *      glob against a folder path here would duplicate work already done
 *      and would require threading a folder path this function's frozen
 *      signature does not carry.
 *   2. Stage gate: the shipped ledger carries only `job_id|*|*` wildcard
 *      rows today (no stage-specific row has ever been built), so this gate
 *      is a documented no-op until a future ledger rebuild ships
 *      stage-scoped rows; it becomes load-bearing the day one exists,
 *      without a code change here (the exact-key lookup already tries the
 *      caller's problemType/stage before falling back to the wildcard).
 *   3. `autonomous_safe`: a candidate whose command-registry row declares
 *      `autonomous_safe === false` is EXCLUDED. A data-driven ranking path
 *      never silently offers an unsafe command.
 *   4. Recency window (WD-353-1, N=5 turns): a candidate that appears in
 *      the caller-supplied `decisionTraces` (a plain array of recently-run
 *      command slugs, most-recent-last) within the last `recencyWindow`
 *      entries is EXCLUDED.
 *   5. Declared governance dial: for a `/mos:` command, the shipped
 *      analog of "a declared HITL shape" is `decision_surface`
 *      (`data/connector-registry.json`, `source:'command'` rows) --
 *      confirmed against `scripts/build-connector-registry.cjs`'s own
 *      comment that a command's governance dial is reach/posture +
 *      `decision_surface`, and `hitl_shape` is the MCP-TOOL-CLASS dial
 *      only (27 `mcp:*` rows carry it; zero `/mos:*` rows do). A candidate
 *      with no declared `decision_surface` is EXCLUDED.
 *
 * The confidence gate (independent of the eligibility filter above): a
 * candidate whose `confidence` is `null` qualifies only if its `source` is
 * `'ground-truth'`; otherwise it qualifies only when
 * `confidence >= ledger.confidence_floor`.
 *
 * With no ledger row, an empty survivor set, or a ledger that fails to
 * parse, this producer returns `null` and decide() behaves byte-identically
 * to today (the sensor order, unchanged).
 *
 * Pure, synchronous: no db, no network, no write, no event. The ledger JSON
 * is read ONCE and cached at module level (`__resetLedgerCache` is the test
 * seam); a per-call read is a defect this module's own acceptance test
 * greps for.
 *
 * No em-dashes anywhere in this file (CLAUDE.md hard rule).
 */

const fs = require('node:fs');
const path = require('node:path');

const LEDGER_PATH = path.join(__dirname, '..', '..', 'data', 'section-command-ledger.json');
const COMMAND_REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
const CONNECTOR_REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'connector-registry.json');

const DEFAULT_RECENCY_WINDOW = 5; // WD-353-1

let _ledgerCache = null; // null = not yet loaded; false = load failed
let _commandRegistryCache = null;
let _connectorDecisionSurfaceCache = null;

function _loadLedger() {
  if (_ledgerCache !== null) return _ledgerCache;
  try {
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8'); // data/section-command-ledger.json, module-level cache
    _ledgerCache = JSON.parse(raw);
  } catch (_e) {
    _ledgerCache = false;
  }
  return _ledgerCache;
}

function _loadCommandRegistry() {
  if (_commandRegistryCache !== null) return _commandRegistryCache;
  try {
    const raw = fs.readFileSync(COMMAND_REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const map = new Map();
    for (const c of (Array.isArray(parsed.commands) ? parsed.commands : [])) {
      if (c && typeof c.command === 'string') map.set(c.command, c);
    }
    _commandRegistryCache = map;
  } catch (_e) {
    _commandRegistryCache = new Map();
  }
  return _commandRegistryCache;
}

function _loadConnectorDecisionSurfaces() {
  if (_connectorDecisionSurfaceCache !== null) return _connectorDecisionSurfaceCache;
  try {
    const raw = fs.readFileSync(CONNECTOR_REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const map = new Map();
    for (const c of (Array.isArray(parsed.connectors) ? parsed.connectors : [])) {
      if (c && typeof c.surface === 'string') {
        map.set(c.surface, c.decision_surface || c.hitl_shape || null);
      }
    }
    _connectorDecisionSurfaceCache = map;
  } catch (_e) {
    _connectorDecisionSurfaceCache = new Map();
  }
  return _connectorDecisionSurfaceCache;
}

/**
 * __resetLedgerCache() -- test seam. Clears all three module-level caches
 * (ledger, command registry, connector decision-surface map) so a test can
 * inject a fresh fixture between runs.
 */
function __resetLedgerCache() {
  _ledgerCache = null;
  _commandRegistryCache = null;
  _connectorDecisionSurfaceCache = null;
}

/**
 * buildLedgerCandidates({ jobId, problemType, stage, ledger, decisionTraces,
 * recencyWindow }) -> [{ source: 'section_ledger', items: [{id, confidence,
 * source}] }] | null
 *
 * Pure, synchronous. Never throws (every fault degrades to null).
 *
 * @param {{jobId?: string, problemType?: string, stage?: string, ledger?: object, decisionTraces?: string[], recencyWindow?: number}} args
 */
function buildLedgerCandidates(args) {
  try {
    const a = args || {};
    const jobId = (typeof a.jobId === 'string' && a.jobId.length > 0) ? a.jobId : null;
    if (!jobId) return null;

    const problemType = (typeof a.problemType === 'string' && a.problemType.length > 0) ? a.problemType : '*';
    const stage = (typeof a.stage === 'string' && a.stage.length > 0) ? a.stage : '*';
    const recencyWindow = (typeof a.recencyWindow === 'number' && a.recencyWindow >= 0) ? a.recencyWindow : DEFAULT_RECENCY_WINDOW;
    const decisionTraces = Array.isArray(a.decisionTraces) ? a.decisionTraces : [];

    const ledger = (a.ledger && typeof a.ledger === 'object') ? a.ledger : _loadLedger();
    if (!ledger || typeof ledger !== 'object' || !ledger.rows || typeof ledger.rows !== 'object') return null;

    const exactKey = jobId + '|' + problemType + '|' + stage;
    const wildcardKey = jobId + '|*|*';
    const row = ledger.rows[exactKey] || ledger.rows[wildcardKey] || null;
    if (!Array.isArray(row) || row.length === 0) return null;

    const commandRegistry = _loadCommandRegistry();
    const decisionSurfaces = _loadConnectorDecisionSurfaces();
    const confidenceFloor = (typeof ledger.confidence_floor === 'number') ? ledger.confidence_floor : null;
    const recentSet = new Set(decisionTraces.slice(Math.max(0, decisionTraces.length - recencyWindow)));

    const survivors = [];
    row.forEach(function (candidate, idx) {
      if (!candidate || typeof candidate.command !== 'string') return;

      const commandRow = commandRegistry.get(candidate.command);
      if (!commandRow) return; // unknown to the registry: never offer a ghost command

      if (commandRow.autonomous_safe === false) return; // condition 3

      if (recentSet.has(candidate.command)) return; // condition 4 (WD-353-1, N=5)

      const decisionSurface = decisionSurfaces.get(candidate.command);
      if (!decisionSurface) return; // condition 5: no declared governance dial

      // Confidence gate.
      if (candidate.confidence === null || candidate.confidence === undefined) {
        if (candidate.source !== 'ground-truth') return;
      } else if (confidenceFloor !== null && candidate.confidence < confidenceFloor) {
        return;
      }

      survivors.push({
        id: candidate.command,
        confidence: candidate.confidence,
        source: candidate.source,
        _score: (typeof candidate.score === 'number') ? candidate.score : 0,
        _idx: idx,
      });
    });

    if (survivors.length === 0) return null;

    // Ordered by ledger score, descending; ties broken by the ledger's own
    // original row order (a stable sort over the pre-filter index).
    survivors.sort(function (a, b) { return (b._score - a._score) || (a._idx - b._idx); });
    const items = survivors.map(function (s) { return { id: s.id, confidence: s.confidence, source: s.source }; });

    return [{ source: 'section_ledger', items: items }];
  } catch (_e) {
    return null;
  }
}

module.exports = { buildLedgerCandidates, __resetLedgerCache };
