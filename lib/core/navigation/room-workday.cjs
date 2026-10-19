'use strict';
// SQL-backed startup checkpoint and a briefing composed from existing local readers.
// Caller owns the handle/transaction. This module opens no database or network.
const crypto = require('node:crypto');
const { getRoomHomeView } = require('./room-home.cjs');
const { readOpenRaisedGates } = require('./room-projection.cjs');
const { logEvent, findRecentChanges } = require('./memory-events.cjs');
const { readSessionState } = require('../session-state.cjs');

function iso(value) {
  const time = typeof value === 'number' ? value : Date.parse(value || '');
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function short(value, max = 600) { return typeof value === 'string' ? value.slice(0, max) : ''; }
// The one formula for a visit's next-move gate id (quick 261019-ksf, 371 review WR-02): the briefing and the
// card minter share it, so the briefing can drop its own card from the pending list.
function workdayGateId(visitId) { return 'workday-' + String(visitId).slice(0, 32); }
function startRoomWorkday(db, roomDir, opts) {
  const { roomId, sessionId, navigatorId } = opts;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  // Quick 261019-ksf (2026-10-19, 371 review CR-02): a visit is scoped to one binding, not to the process. A stdio
  // session id lives as long as the server process, so without the binding generation every later chat in that
  // process found the first chat's frozen visit. A retry inside one binding keeps the visit. Visits recorded with
  // the old 3-part hash simply serve as the previous visit once.
  const bindingGen = typeof opts.bindingGen === 'string' && opts.bindingGen.length > 0 ? opts.bindingGen : null;
  const visitId = crypto.createHash('sha256').update(JSON.stringify([roomId, sessionId, navigatorId, bindingGen])).digest('hex');
  const label = "CASE WHEN json_valid(properties) THEN json_extract(properties, '$.label') END";
  const actor = "CASE WHEN json_valid(properties) THEN json_extract(properties, '$.navigator_id') END";
  const rows = db.prepare("SELECT properties FROM nodes WHERE type = 'memory_event' AND " + label + " = ? AND " + actor + " = ? ORDER BY created_at DESC LIMIT 200")
    .all('room_workday_started', navigatorId);
  const visits = rows.map(row => { try { return JSON.parse(row.properties); } catch (_) { return {}; } });
  const current = visits.find(visit => visit.visit_id === visitId);
  const previous = visits.find(visit => visit.visit_id !== visitId && iso(visit.opened_at) && Date.parse(visit.opened_at) <= now);
  const ended = readSessionState(roomDir);
  const endedAt = ended && iso(ended.last_updated);
  const validEndedAt = endedAt && Date.parse(endedAt) <= now ? endedAt : null;
  const previousAt = previous ? iso(previous.opened_at) : null;
  const candidates = [
    validEndedAt && { at: validEndedAt, basis: 'last_session_end' },
    previousAt && { at: previousAt, basis: 'previous_startup' },
  ].filter(Boolean).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const baseline = current ? { at: current.previous_at || null, basis: current.baseline_basis || 'none' } : (candidates[0] || { at: null, basis: 'none' });
  const openedAt = current ? iso(current.opened_at) : new Date(now).toISOString();
  const home = getRoomHomeView(db, roomId);
  // Bounded activity. A startup's own bookkeeping is never presented as new work.
  const events = baseline.at ? findRecentChanges(db, Date.parse(baseline.at), { limit: 201 })
    .filter(event => event.createdAt <= Date.parse(openedAt) && event.properties?.label !== 'room_workday_started') : [];
  const changes = events.slice(0, 50).map(event => ({
    id: event.id, at: iso(event.createdAt), kind: event.eventType,
    label: event.properties?.label === 'gate_answer' ? 'Decision: ' + short(event.properties.verdict, 40)
      : short(event.properties?.label || event.eventType, 160),
    source: short(event.sourcePath, 240), target_node_id: event.targetNodeId || null,
  }));
  const questions = [];
  for (const question of [...(ended?.open_questions || []), ...(home.openQuestions || [])]) {
    const text = typeof question === 'string' ? question : (question.text || question.summary || question.question || question.id || '');
    if (text && !questions.includes(text)) questions.push(short(text));
    if (questions.length === 20) break;
  }
  // The visit's own next-move card is the choice this briefing returns, never one of its pending decisions (WR-02).
  const ownGateId = workdayGateId(visitId);
  const pending = readOpenRaisedGates(db, { now, limit: 50 }).filter(gate => gate.gate_id !== ownGateId);
  if (!current) {
    const recorded = logEvent(db, 'mcp_client_event_logged', {
      label: 'room_workday_started', navigator_id: navigatorId, visit_id: visitId,
      opened_at: openedAt, previous_at: baseline.at, baseline_basis: baseline.basis,
      created_by: 'system', source_path: 'startup:workday', dedupe_key: 'workday:' + visitId,
    });
    if (!recorded?.ok) throw new Error('workday_checkpoint_failed');
  }
  return {
    schema: 'mindrian.workday.v1', visit_id: visitId, opened_at: openedAt,
    first_recorded_visit: !previous && !validEndedAt,
    previous_at: baseline.at, baseline_basis: baseline.basis,
    last_session: ended ? { ended_at: validEndedAt, active_methodology: short(ended.active_methodology),
      next_action: short(ended.next_suggested_action), source: '.mindrian/last-session.md' } : null,
    current_understanding: home.currentThesis || null,
    confirmed_facts: (home.confirmedFacts || []).slice(0, 10),
    changes: { status: !baseline.at ? 'no_previous_checkpoint' : changes.length ? 'recorded_changes' : 'no_recorded_changes',
      items: changes, truncated: events.length > 50 || events.length === 201 },
    open_questions: questions,
    pending_decisions: pending.map(gate => ({ gate_id: gate.gate_id, header: gate.card?.header || gate.header || 'Pending decision', expires_at: gate.expires_at || null })),
    next_move: { status: 'not_requested' },
  };
}
module.exports = { startRoomWorkday, workdayGateId };
