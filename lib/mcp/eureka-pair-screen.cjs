'use strict';

// Pair-screen result verifier (Phase 374 plan 06, E5).
//
// This module checks the result of the Eureka pair screen (schema eureka.pair-screen.v1, see the engine run
// contract, "Result, key by key" and "Rules for the consumer") before any other code reads it.
//
// Canon Part 8 rules for this module:
// - It sees result text (titles, source references, the summary line, file content). That text is untrusted.
//   The module never forwards it in a refusal. Every refusal is a fixed sentence written in this file.
// - It requires only node:crypto. It reaches no Brain, no Theo and no network. It spawns no process and
//   reads no file. It is a pure function of its two arguments.
// - Registration of the pair-screen routes and the approval gate belong to later plans. This module only
//   verifies a result.

const crypto = require('node:crypto');

const PAIR_SCREEN_CAPABILITY_ID = 'opportunity.run_pair_screen';
const RESULT_SCHEMA_VERSION = 'eureka.pair-screen.v1';
const LABEL = 'candidate, not verified';
const HEX64 = /^[a-fA-F0-9]{64}$/;
const SUMMARY_LINE_MAX_CHARS = 500;

// The fixed sentences. No value of a result enters any of them.
const MESSAGES = Object.freeze({
  invalid: 'Eureka returned a pair-screen result that does not follow the published result format.',
  missing: 'Eureka returned a pair-screen result with no scope or snapshot lineage.',
  mismatch: 'Eureka returned a pair-screen result for a different capability, scope or snapshot.',
  hash: 'Eureka returned a pair-screen result file that does not match its hash or size.',
});

const EMPTY_LIST_SENTENCE = 'An empty shortlist does not show that no opportunity exists.';

function refuse(reason) {
  const key = { engine_result_invalid: 'invalid', engine_lineage_missing: 'missing',
    engine_lineage_mismatch: 'mismatch', engine_result_hash_mismatch: 'hash' }[reason];
  return { ok: false, reason, message: MESSAGES[key] };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

// Check one file entry. Returns null when it is good, or a reason string.
function fileProblem(file) {
  if (!isObject(file) || typeof file.path !== 'string' || !isCount(file.bytes) ||
      typeof file.sha256 !== 'string' || !HEX64.test(file.sha256) || typeof file.inline !== 'boolean') {
    return 'engine_result_invalid';
  }
  if (!file.inline) return file.content === undefined ? null : 'engine_result_invalid';
  if (typeof file.content !== 'string') return 'engine_result_invalid';
  if (sha256Hex(file.content) !== file.sha256.toLowerCase()) return 'engine_result_hash_mismatch';
  if (Buffer.byteLength(file.content, 'utf8') !== file.bytes) return 'engine_result_hash_mismatch';
  return null;
}

// verifyPairScreenResult(result, expect) with expect = { capability_id, scope_id, snapshot_id }.
// Returns { ok: false, reason, message } or { ok: true, status, shortlist_empty, summary }.
// The summary holds counts and hashes. It does not hold file content or pair text. The summary line is
// returned as untrusted text, marked.
function verifyPairScreenResult(result, expect) {
  const want = isObject(expect) ? expect : {};
  if (!isObject(result)) return refuse('engine_result_invalid');

  // 1. schema version, first
  if (result.schema_version !== RESULT_SCHEMA_VERSION) return refuse('engine_result_invalid');

  // 2. capability
  if (result.capability_id !== PAIR_SCREEN_CAPABILITY_ID || result.capability_id !== want.capability_id) {
    return refuse('engine_lineage_mismatch');
  }

  // 3. scope present, then equal to the request lineage
  const scope = result.scope;
  if (!isObject(scope) || typeof scope.scope_id !== 'string' || typeof scope.snapshot_id !== 'string' ||
      !scope.scope_id || !scope.snapshot_id) {
    return refuse('engine_lineage_missing');
  }
  if (typeof want.scope_id !== 'string' || typeof want.snapshot_id !== 'string' ||
      scope.scope_id !== want.scope_id || scope.snapshot_id !== want.snapshot_id) {
    return refuse('engine_lineage_mismatch');
  }
  // The top-level echoes are optional here; when present they must agree too.
  if ((result.scope_id !== undefined && result.scope_id !== want.scope_id) ||
      (result.snapshot_id !== undefined && result.snapshot_id !== want.snapshot_id)) {
    return refuse('engine_lineage_mismatch');
  }

  // 4. status
  const status = result.status;
  if (status !== 'completed' && status !== 'completed_empty') return refuse('engine_result_invalid');

  // 5. label and the fixed values
  if (result.label !== LABEL) return refuse('engine_result_invalid');
  if (result.room_write !== 'not_performed' || result.portfolio_write !== 'not_performed') return refuse('engine_result_invalid');
  if (!isObject(result.approval) || result.approval.verified_by_engine !== false) return refuse('engine_result_invalid');

  // 6. shapes of the parts that the summary carries
  if (!isObject(result.counts)) return refuse('engine_result_invalid');
  if (!Array.isArray(result.caps_hit) || !Array.isArray(result.warnings)) return refuse('engine_result_invalid');
  if (!result.warnings.every((item) => typeof item === 'string')) return refuse('engine_result_invalid');
  if (typeof result.manifest_sha256 !== 'string' || !HEX64.test(result.manifest_sha256)) return refuse('engine_result_invalid');
  if (!Array.isArray(result.outputs)) return refuse('engine_result_invalid');
  if (status === 'completed_empty' && result.outputs.length > 0) return refuse('engine_result_invalid');
  if (!Array.isArray(result.files)) return refuse('engine_result_invalid');

  // 7. every file: structure and hash first, in order
  for (const file of result.files) {
    const problem = fileProblem(file);
    if (problem) return refuse(problem);
  }
  // The manifest hash names the run. When the manifest file is listed, its hash must be that value.
  for (const file of result.files) {
    if (file.path === 'manifest.json' && file.sha256.toLowerCase() !== result.manifest_sha256.toLowerCase()) {
      return refuse('engine_result_hash_mismatch');
    }
  }

  const handoff = isObject(result.host_handoff) ? result.host_handoff : {};
  const shortlistEmpty = status === 'completed_empty';
  const summary = {
    counts: structuredClone(result.counts),
    label: LABEL,
    summary_line: {
      untrusted: true,
      text: typeof result.summary_line === 'string' ? result.summary_line.slice(0, SUMMARY_LINE_MAX_CHARS) : '',
    },
    manifest_sha256: result.manifest_sha256,
    caps_hit: structuredClone(result.caps_hit),
    warnings: result.warnings.slice(),
    files: result.files.map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256, inline: file.inline })),
    host_handoff: {
      ...(typeof handoff.state === 'string' ? { state: handoff.state } : {}),
      ...(typeof handoff.owner === 'string' ? { owner: handoff.owner } : {}),
    },
  };
  if (shortlistEmpty) summary.empty_list_note = EMPTY_LIST_SENTENCE;
  return { ok: true, status, shortlist_empty: shortlistEmpty, summary };
}

module.exports = { PAIR_SCREEN_CAPABILITY_ID, RESULT_SCHEMA_VERSION, LABEL, verifyPairScreenResult };
