/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 132 Plan 01 Task 1 -- the reusable curation-batch runner.
 *
 * This is the single WRITE chokepoint every Phase 132 curation pass (Plans
 * 02-05) routes its Brain mutations through, so no plan hand-rolls a
 * neo4j-driver call and every plan inherits THREE invariants by construction:
 *
 *   1. Provenance. Every forward write carries
 *      created_by = 'phase-132-curation-batch-N'. Rollback is REMOVE label /
 *      DELETE edge / restore property by that created_by selector (the
 *      2026-05-17 audit Section 17 reversibility pattern).
 *
 *   2. Reversibility. makeBatch REJECTS any batch with an empty rollbackCyphers
 *      array -- a batch with no rollback path is not a valid batch. assertRollbackPath
 *      proves each rollback names the SAME created_by selector its paired forward
 *      write stamped, so a rollback can never delete a different batch's writes.
 *
 *   3. Write-time 130.7-contract guard. Before ANY forward write, execute()
 *      runs a cheap read probe ('MATCH (n) WHERE n.correlation_id IS NOT NULL
 *      RETURN count(n)') and refuses to mutate unless the Phase 130.7
 *      correlation_id contract is present in the live graph. A checkout where
 *      130.7 has NOT backfilled correlation_ids is refused AT WRITE TIME, not
 *      after the whole reformat. Every mutating batch 02-05 inherits this guard
 *      because they all route through this runner's execute().
 *
 * Transport REUSE (Canon Part 7): the neo4j-driver is required from
 * mcp-server-brain/node_modules exactly as scripts/admin-brain-write.cjs does;
 * the plugin root has NO neo4j-driver dependency by design. getNeo4jCreds reads
 * NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD from process.env then plugin-root .env.
 *
 * Canon Part 8: the harness write payloads carry only methodology-canon handles
 * (participant names, frozen labels), enum/scalar role values (year, status,
 * severity), and provenance scalars. scanBatchForUserContent proves the
 * no-user-content shape by grepping every forward Cypher for forbidden
 * user-content tokens.
 *
 * IMPORTANT: this module WRITES NOTHING in Wave 1. execute()/rollback() EXIST
 * and are gated (creds + the 130.7 probe), but the orchestrator runs the live
 * cleanup later, snapshot-first. The tests drive execute() with an INJECTED
 * fake runner so the guard is unit-testable without a live Brain.
 *
 * Zero new deps. CJS only. No em-dashes.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// scripts/ and lib/ are siblings of the plugin root; lib/brain is two down.
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

// Provenance prefix. Empty by design: the batchId IS the full created_by
// scalar ('phase-132-curation-batch-N'), matching the admin-brain-write.cjs
// convention of created_by = '<phase>-<plan>' string literals. Exported so a
// future phase could namespace batches without editing the validator.
const BATCH_PROVENANCE_PREFIX = '';

// A batchId must look exactly like 'phase-132-curation-batch-<N>'.
const BATCH_ID_RE = /^phase-132-curation-batch-\d+$/;

// Forbidden user-content tokens (Canon Part 8). If any of these appears in a
// forward Cypher body, the payload is carrying user-specific bytes toward the
// Brain -- a constitutional breach. Matched case-insensitively as whole-ish
// tokens. The harness payloads carry only handles + enums + provenance.
const USER_CONTENT_TOKENS = [
  'artifact',
  'MINTO',
  'meeting',
  'transcript',
  'roomDir',
  'room_dir',
  'MindrianRooms',
  'assumption_body',
  'rejection_reason',
  'personal_identifier',
];

// ---------------------------------------------------------------------------
// Credentials + driver transport (REUSED from the admin-brain-write pattern).
// ---------------------------------------------------------------------------

function loadEnvFile(envPath) {
  try {
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const out = {};
    content.split('\n').forEach(function (line) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    });
    return out;
  } catch (err) {
    return {};
  }
}

function getNeo4jCreds() {
  const fileEnv = loadEnvFile(path.join(PLUGIN_ROOT, '.env'));
  return {
    uri:      process.env.NEO4J_URI      || fileEnv.NEO4J_URI      || null,
    user:     process.env.NEO4J_USER     || fileEnv.NEO4J_USER     || null,
    password: process.env.NEO4J_PASSWORD || fileEnv.NEO4J_PASSWORD || null,
  };
}

function loadNeo4jDriver() {
  // Driver lives in mcp-server-brain/node_modules; plugin root has no direct
  // dependency on neo4j-driver, by design. Mirrors admin-brain-write.cjs.
  const driverPath = path.join(PLUGIN_ROOT, 'mcp-server-brain', 'node_modules', 'neo4j-driver');
  return require(driverPath);
}

// The write-time pre-flight probe Cypher: a single cheap existence read. If at
// least one teaching-graph node carries a non-null correlation_id, the Phase
// 130.7 contract is present in this graph. This is a PRESENCE probe only; it
// does NOT re-derive or re-backfill correlation_ids (that is 130.7's job; the
// scope fence). The LIMIT keeps it O(1)-ish on a populated graph.
const CONTRACT_PROBE_CYPHER =
  'MATCH (n) WHERE n.correlation_id IS NOT NULL RETURN count(n) AS c LIMIT 1';

function getAuditPath() {
  return path.join(os.homedir(), '.mindrian', 'curation-batch.jsonl');
}

function appendAudit(entry) {
  try {
    const auditPath = getAuditPath();
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(auditPath, line);
  } catch (err) {
    process.stderr.write('curation-batch: audit append failed: ' + String(err && err.message) + '\n');
  }
}

// Neo4j Integer { low, high } | number | other -> plain JS number.
function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  if (typeof value === 'object' && typeof value.low === 'number') {
    return value.low + (value.high || 0) * 0x100000000;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// The write-time 130.7-contract guard (pure predicate -- unit-testable).
// ---------------------------------------------------------------------------

/**
 * Pure predicate over the contract probe count. Throws a blocked-on-130.7
 * error when probeCount < 1; returns true otherwise. Kept pure so the guard is
 * testable without a live Brain.
 *
 * @param {number} probeCount count of teaching-graph nodes carrying a non-null
 *   correlation_id (the result of CONTRACT_PROBE_CYPHER).
 * @returns {true}
 */
function assertCorrelationContractPresent(probeCount) {
  const c = toNumber(probeCount);
  if (c < 1) {
    throw new Error(
      'blocked: Phase 130.7 correlation_id contract not present in the live graph -- ' +
      'run Phase 130.7 backfill before --execute'
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Part 8 scan: prove the no-user-content shape.
// ---------------------------------------------------------------------------

/**
 * Greps every forward Cypher body (and its param VALUES that are strings) of a
 * batch for forbidden user-content tokens. Returns a list of { index, token,
 * where } violations; [] when the batch is Part 8 clean.
 *
 * @param {object} batch a batch returned by makeBatch (carries _forward).
 * @returns {Array<{index:number, token:string, where:string}>}
 */
function scanBatchForUserContent(batch) {
  const violations = [];
  const forward = (batch && batch._forward) || [];
  forward.forEach(function (w, i) {
    const cypher = String(w && w.cypher || '');
    const cypherLc = cypher.toLowerCase();
    USER_CONTENT_TOKENS.forEach(function (tok) {
      if (cypherLc.indexOf(tok.toLowerCase()) !== -1) {
        violations.push({ index: i, token: tok, where: 'cypher' });
      }
    });
    // Also scan string param VALUES -- a Cypher can be clean while a bound
    // value smuggles user content (e.g. a meeting transcript as a property).
    const params = (w && w.params) || {};
    Object.keys(params).forEach(function (k) {
      const v = params[k];
      if (typeof v !== 'string') return;
      const vLc = v.toLowerCase();
      USER_CONTENT_TOKENS.forEach(function (tok) {
        if (vLc.indexOf(tok.toLowerCase()) !== -1) {
          violations.push({ index: i, token: tok, where: 'param:' + k });
        }
      });
    });
  });
  return violations;
}

// ---------------------------------------------------------------------------
// Rollback-path assertion: every rollback names the batch's created_by selector.
// ---------------------------------------------------------------------------

/**
 * String-asserts that each rollback Cypher references the SAME created_by
 * selector the batch's forward writes stamped, so rollback cannot target a
 * different batch. Throws when any rollback fails to name the selector or names
 * a different one. Returns true when every rollback is matched.
 *
 * @param {object} batch a batch returned by makeBatch.
 * @returns {true}
 */
function assertRollbackPath(batch) {
  const batchId = batch && batch._batchId;
  const rollback = (batch && batch._rollback) || [];
  if (!batchId) throw new Error('assertRollbackPath: batch carries no batchId');
  if (rollback.length === 0) {
    throw new Error('assertRollbackPath: batch has no rollback path (empty rollbackCyphers)');
  }
  rollback.forEach(function (r, i) {
    const cypher = String(r && r.cypher || '');
    const params = (r && r.params) || {};
    // The rollback must reference the created_by selector. The selector binds a
    // param (commonly $by or $created_by) whose VALUE equals this batch's id.
    const selectorValues = Object.keys(params)
      .map(function (k) { return params[k]; })
      .filter(function (v) { return typeof v === 'string'; });
    // Reject if a selector value names a DIFFERENT phase-132 batch.
    const namesOtherBatch = selectorValues.some(function (v) {
      return BATCH_ID_RE.test(v) && v !== batchId;
    });
    if (namesOtherBatch) {
      throw new Error(
        'assertRollbackPath: rollback[' + i + '] selector targets a different batch (' +
        selectorValues.join(',') + ') than ' + batchId
      );
    }
    // Require positive evidence the rollback is scoped to THIS batch: either a
    // param value equals the batchId, or the cypher body names it literally.
    const matchesThisBatch =
      selectorValues.indexOf(batchId) !== -1 || cypher.indexOf(batchId) !== -1;
    // The rollback must also reference a created_by selector at all.
    const namesCreatedBy = /created_by|relabeled_by|archived_by|_decided_by|_by\b/.test(cypher) ||
      Object.keys(params).some(function (k) { return /by$|created_by/.test(k); });
    if (!matchesThisBatch) {
      throw new Error(
        'assertRollbackPath: rollback[' + i + '] does not reference batch selector ' + batchId
      );
    }
    if (!namesCreatedBy) {
      throw new Error(
        'assertRollbackPath: rollback[' + i + '] does not reference a created_by-style selector'
      );
    }
  });
  return true;
}

// ---------------------------------------------------------------------------
// makeBatch: construct a reversible, provenance-stamped, Part 8-clean batch.
// ---------------------------------------------------------------------------

/**
 * Build a curation batch. Validates the reversibility + provenance contracts at
 * construction (fail loud), then returns { dryRun, execute, rollback } plus the
 * internal _forward / _rollback / _batchId fields the assertions read.
 *
 * @param {object} opts
 * @param {string} opts.batchId          must match /^phase-132-curation-batch-\d+$/
 * @param {Array<{cypher:string, params:object}>} opts.forwardCyphers non-empty;
 *   every params must carry created_by === batchId.
 * @param {Array<{cypher:string, params:object}>} opts.rollbackCyphers non-empty;
 *   the reversibility contract (a batch with no rollback path is rejected).
 * @param {string} [opts.by] optional override for the provenance scalar; defaults
 *   to batchId (the convention).
 */
function makeBatch(opts) {
  opts = opts || {};
  const batchId = opts.batchId;
  const by = opts.by || batchId;
  const forwardCyphers = opts.forwardCyphers;
  const rollbackCyphers = opts.rollbackCyphers;

  if (typeof batchId !== 'string' || !BATCH_ID_RE.test(batchId)) {
    throw new Error(
      'makeBatch: batchId must match /^phase-132-curation-batch-\\d+$/, got ' + JSON.stringify(batchId)
    );
  }
  if (!Array.isArray(forwardCyphers) || forwardCyphers.length === 0) {
    throw new Error('makeBatch: forwardCyphers must be a non-empty array');
  }
  // Reversibility contract: a batch with no rollback path is not a valid batch.
  if (!Array.isArray(rollbackCyphers) || rollbackCyphers.length === 0) {
    throw new Error(
      'makeBatch: rollbackCyphers must be a non-empty array -- a batch without a ' +
      'rollback path is rejected (the Phase 132 reversibility contract)'
    );
  }

  const expectedCreatedBy = BATCH_PROVENANCE_PREFIX + by;

  // Provenance contract: every forward write must carry created_by === batchId.
  forwardCyphers.forEach(function (w, i) {
    if (!w || typeof w.cypher !== 'string' || !w.params || typeof w.params !== 'object') {
      throw new Error('makeBatch: forwardCyphers[' + i + '] must be { cypher, params }');
    }
    if (w.params.created_by !== expectedCreatedBy) {
      throw new Error(
        'makeBatch: forwardCyphers[' + i + '] missing created_by === ' + expectedCreatedBy +
        ' (provenance stamping is mandatory on every forward write)'
      );
    }
  });
  rollbackCyphers.forEach(function (r, i) {
    if (!r || typeof r.cypher !== 'string' || !r.params || typeof r.params !== 'object') {
      throw new Error('makeBatch: rollbackCyphers[' + i + '] must be { cypher, params }');
    }
  });

  const batch = {
    _batchId: batchId,
    _by: expectedCreatedBy,
    _forward: forwardCyphers,
    _rollback: rollbackCyphers,
  };

  /**
   * Pure: returns the forward + rollback Cypher lists + a count summary.
   * Constructs NO driver session, runs NO contract probe, requires NO creds.
   * The 130.7 guard is an --execute-only concern; dry-run stays creds-free and
   * ungated so a planner/CI run is safe.
   */
  batch.dryRun = function dryRun() {
    return {
      batchId: batchId,
      forward: forwardCyphers,
      rollback: rollbackCyphers,
      summary: {
        batch_id: batchId,
        created_by: expectedCreatedBy,
        forward_count: forwardCyphers.length,
        rollback_count: rollbackCyphers.length,
        touched_brain: false,
      },
    };
  };

  /**
   * Run the forward writes against the live Brain -- gated by the write-time
   * 130.7-contract guard. The probe runs FIRST inside the session; if it finds
   * zero correlation_id nodes, execute() refuses (ZERO forward writes) and
   * propagates the blocked-on-130.7 error.
   *
   * The session run is abstracted behind an injectable `runner` so tests can
   * exercise the guard without a live Brain:
   *   runner.runProbe()         -> number (correlation_id node count)
   *   runner.runWrite(w)        -> { ok: bool, ... } for each forward write
   *
   * When no runner is injected, the real neo4j-driver session is opened from
   * mcp-server-brain/node_modules (creds required). Wave 1 NEVER calls this
   * path live -- the orchestrator runs the live cleanup later, snapshot-first.
   *
   * @param {object} [io]
   * @param {object} [io.runner] injected { runProbe, runWrite } for tests.
   */
  batch.execute = function execute(io) {
    io = io || {};
    if (io.runner) {
      return runWithRunner(io.runner, /* isRollback */ false);
    }
    return runLive(/* isRollback */ false);
  };

  /**
   * Run the paired rollbackCyphers. Rollback does NOT run the contract probe
   * because it only deletes THIS batch's own created_by-selected writes.
   *
   * @param {object} [io] same injectable runner shape as execute().
   */
  batch.rollback = function rollback(io) {
    io = io || {};
    if (io.runner) {
      return runWithRunner(io.runner, /* isRollback */ true);
    }
    return runLive(/* isRollback */ true);
  };

  // Injected-runner path (the unit-test path). For execute(), the probe runs
  // FIRST; a zero count throws before any write.
  function runWithRunner(runner, isRollback) {
    const writes = isRollback ? rollbackCyphers : forwardCyphers;
    if (!isRollback) {
      const probeCount = runner.runProbe ? runner.runProbe(CONTRACT_PROBE_CYPHER) : 0;
      assertCorrelationContractPresent(probeCount); // throws on zero -> no writes
    }
    let applied = 0;
    for (let i = 0; i < writes.length; i += 1) {
      const w = writes[i];
      const r = runner.runWrite ? runner.runWrite(w) : { ok: true };
      if (r && r.ok === false) {
        throw new Error('curation-batch: write[' + i + '] failed: ' + (r.error || 'unknown'));
      }
      applied += 1;
    }
    return {
      executed: !isRollback,
      rolledBack: isRollback,
      batchId: batchId,
      applied: applied,
      touched_brain: true,
    };
  }

  // Live path (Wave 1 never runs this). Mirrors admin-brain-write.cjs: load the
  // driver from mcp-server-brain/node_modules, open ONE session, run the probe
  // FIRST (for execute), then each write; audit one JSONL line per write; close
  // in a finally.
  function runLive(isRollback) {
    const creds = getNeo4jCreds();
    if (!creds.uri || !creds.user || !creds.password) {
      throw new Error(
        'curation-batch: NEO4J_URI/USER/PASSWORD missing from env or .env; ' +
        (isRollback ? 'rollback' : 'execute') + ' requires direct driver creds'
      );
    }
    const neo4j = loadNeo4jDriver();
    const driver = neo4j.driver(creds.uri, neo4j.auth.basic(creds.user, creds.password));
    const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });
    const writes = isRollback ? rollbackCyphers : forwardCyphers;
    let applied = 0;
    return (async function run() {
      try {
        if (!isRollback) {
          const probeRes = await session.run(CONTRACT_PROBE_CYPHER);
          const probeCount = probeRes.records && probeRes.records[0]
            ? toNumber(probeRes.records[0].get('c'))
            : 0;
          assertCorrelationContractPresent(probeCount); // throws on zero -> no writes
        }
        for (let i = 0; i < writes.length; i += 1) {
          const w = writes[i];
          await session.run(w.cypher, w.params);
          appendAudit({
            batchId: batchId,
            phase: isRollback ? 'rollback' : 'execute',
            cypher_summary: w.cypher.slice(0, 80),
            params_keys: Object.keys(w.params || {}),
          });
          applied += 1;
        }
        return {
          executed: !isRollback,
          rolledBack: isRollback,
          batchId: batchId,
          applied: applied,
          touched_brain: true,
        };
      } finally {
        await session.close();
        await driver.close();
      }
    })();
  }

  return batch;
}

module.exports = {
  makeBatch,
  BATCH_PROVENANCE_PREFIX,
  assertRollbackPath,
  assertCorrelationContractPresent,
  scanBatchForUserContent,
  // Exported for Plan 02-05 reuse + the schema test:
  getNeo4jCreds,
  loadNeo4jDriver,
  CONTRACT_PROBE_CYPHER,
  USER_CONTENT_TOKENS,
};
