'use strict';
/*
 * Phase 369.25 plan 13 -- the recovery card: the heal net offered behind its existing approval.
 *
 * When a governed write meets a room whose record cannot hold it (room.db missing or damaged), or a legacy room
 * whose identity is missing, lib/mcp/session-room.cjs resolveMcpWriteRoom mints ONE card per session and room here.
 * Answering it (gate_answer, approve) runs the heal net, lib/core/graph-backfill.cjs runDeriveBackfill, under
 * approvedBy 'gate:<gate_id>'; defer changes nothing. Nothing is rebuilt without that answer (Canon Part 3).
 *
 * The card is named by its job and carries no id (CONTEXT card vocabulary rule). It is a material_step gate, the
 * precedent being lib/core/research-planner/canon-release.cjs mintReleaseGate, so gate_render, gate_answer and the
 * ledger need no new kind: it works on the CLI, Desktop and Cowork alike (Tri-Polar).
 *
 * Two things differ from an ordinary gate and are marked on the ledger entry (recovery: true):
 *   - the room it recovers cannot record a ratification before it is healed, so gate_answer takes the gate and runs
 *     the recovery directly (lib/mcp/tools/gate.cjs, _answerRecoveryGate); the approval is the approvedBy handle
 *     the recovery receives, and the recovery itself is the durable record;
 *   - the gate-raised observer skips it (the same reason: nothing may be written into the room before the heal).
 *
 * Hyphens only in this file. Local only: no network, no Brain.
 */
const path = require('node:path');

const gateRender = require('./gate-render.cjs');
const gateLedger = require('./gate-ledger.cjs');

const RECOVERY_CARD_HEADER = "Recover this room's record so work can continue";

// One card per (session, room.db) while it is still live; a card that was answered, deferred or expired is replaced.
const _minted = new Map();

function noDerive() { return []; }

function summarize(r) {
  const out = { state: r && r.state, reason: r && r.reason };
  ['slug', 'room_id', 'created_db', 'moved_aside', 'registered', 'indexed', 'unknown_keys', 'repair_reason', 'readback_reason'].forEach((k) => {
    if (r && r[k] !== undefined) out[k] = r[k];
  });
  return out;
}

function recoveredMessage(r) {
  const parts = ['The room record was rebuilt and your files were left as they were.'];
  if (r && Array.isArray(r.moved_aside) && r.moved_aside.length > 0) {
    parts.push('The damaged room.db was kept beside it (' + r.moved_aside.map((p) => path.basename(String(p))).join(', ') + ').');
  }
  if (r && Array.isArray(r.unknown_keys) && r.unknown_keys.length > 0) {
    parts.push('These fields had no source and stay marked unknown: ' + r.unknown_keys.join(', ') + '.');
  }
  return parts.join(' ');
}

function notRecoveredMessage(r) {
  if (r && (r.repair_reason || r.slug === 'unknown' || (typeof r.registry_detail === 'string' && /slug_unknown/.test(r.registry_detail)))) {
    return 'The record could not be named from ROOM.md, .room-root or the registry, so it was not rebuilt and nothing was invented. Nothing else was changed.';
  }
  return 'The record could not be rebuilt' + (r && r.readback_reason ? ' (' + r.readback_reason + ')' : '') + '. Nothing was invented.';
}

/**
 * mintRecoveryGate({ roomDir, sessionId, readiness }) -> { ok:true, gate_id, card, reused } | { ok:false, reason }
 *
 * readiness is the readinessFor result that triggered the offer (its requirement goes on the card as the why-line).
 * At most one live card per (sessionId, room.db path): a second call returns the first one's id and card.
 */
function mintRecoveryGate(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  if (typeof o.roomDir !== 'string' || o.roomDir.length === 0) return { ok: false, reason: 'no_room_dir' };
  const roomDir = path.resolve(o.roomDir);
  const readiness = (o.readiness && typeof o.readiness === 'object') ? o.readiness : {};
  const key = gateLedger.ledgerSessionKey(o.sessionId) + '|' + path.join(roomDir, '.mindrian', 'room.db');

  const prior = _minted.get(key);
  if (prior && gateLedger.isGateLive(prior.gate_id)) return { ok: true, gate_id: prior.gate_id, card: prior.card, reused: true };

  const lost = readiness.reason === 'room_graph_lost';
  const why = (typeof readiness.requirement === 'string' ? readiness.requirement + '. ' : '')
    + (lost
      ? 'What comes back: the files already here are indexed again and the recorded room id is kept. '
        + 'What cannot come back: claims, decisions and edges that lived only in the graph cannot come back. Nothing is deleted.'
      : "FeyMinto keeps this room's reasoning per folder; its record lives in room.db, and this recovery rebuilds it from ROOM.md and the registry. "
        + 'Recovering also indexes the files already here. Nothing is deleted.');
  const gateCard = gateRender.normalizeCard({
    kind: 'material_step',
    header: RECOVERY_CARD_HEADER,
    notice: why,
    selectMode: 'single',
    options: [
      { id: 'recover', label: 'Recover the record' },
      { id: 'defer', label: 'Not now' },
    ],
  });
  const gateId = gateCard.gate_id;

  async function resumeFn(answer) {
    const verdict = answer && answer.verdict;
    if (verdict !== 'approve') return { ok: true, executed: false, verdict: verdict || 'defer', note: 'Nothing was changed.' };
    const approvedBy = 'gate:' + gateId + (answer && answer.decision_node_id ? ':' + answer.decision_node_id : '');
    let result;
    try {
      const backfill = require('../core/graph-backfill.cjs');
      // approveFolders [] approves no folder: the recovery rebuilds the room record only, it never turns a folder
      // into a child room. noDerive keeps the encoder out of it.
      result = await backfill.runDeriveBackfill({ roomDir, approvedBy, deriveFn: noDerive, approveFolders: [] });
    } catch (e) {
      return { ok: false, executed: true, recovered: false, reason: 'recovery_threw', detail: String((e && e.message) || e).slice(0, 160) };
    }
    const r = (result && result.readiness) || null;
    const recovered = !!r && r.recovered === true;
    return {
      ok: recovered,
      executed: true,
      recovered,
      readiness: r ? summarize(r) : null,
      message: recovered ? recoveredMessage(r) : notRecoveredMessage(r),
    };
  }

  const minted = gateLedger.mintGate(gateId, {
    card: gateCard,
    sessionId: o.sessionId,
    kind: 'material_step',
    resumeFn,
    approving: ['recover'],
    renderer: 'none',
    recovery: true,
    recoveryRoomDir: roomDir,
  });
  if (!minted) return { ok: false, reason: 'gate_mint_refused' };

  const card = {
    gate_id: gateId,
    header: gateCard.header,
    notice: gateCard.notice || why,
    options: gateCard.options.map((op) => ({ id: op.id, label: op.label })),
  };
  _minted.set(key, { gate_id: gateId, card });
  return { ok: true, gate_id: gateId, card, reused: false };
}

module.exports = { mintRecoveryGate, RECOVERY_CARD_HEADER };
