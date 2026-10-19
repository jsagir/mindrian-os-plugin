'use strict';
// Host-neutral startup operations over the existing navigation and gate authorities.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const navigation = require('../core/navigation.cjs');
const { listRoomRoots } = require('../core/icm-forest.cjs');
const { isRealpathContained, realRoomRoot: resolveExistingRealpath } = require('../core/room-path-containment.cjs');
const gateRender = require('./gate-render.cjs');
const gateLedger = require('./gate-ledger.cjs');

function slugFor(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/g, '')
    || 'room-' + crypto.createHash('sha256').update(name).digest('hex').slice(0, 10);
}
function destination(slug, expectedHome) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return { ok: false, reason: 'invalid_room_slug' };
  const home = listRoomRoots().home;
  const realHome = resolveExistingRealpath(home);
  if (!realHome || (expectedHome && realHome !== expectedHome)) return { ok: false, reason: 'rooms_home_changed' };
  const target = path.join(home, slug);
  if (!isRealpathContained(home, target) || resolveExistingRealpath(target) === realHome) return { ok: false, reason: 'room_path_outside_home' };
  try { fs.lstatSync(target); return { ok: false, reason: 'room_exists', slug }; }
  catch (error) { if (error.code !== 'ENOENT') return { ok: false, reason: 'room_path_unreadable' }; }
  return { ok: true, home, realHome, target, slug };
}
async function mintCard(server, ctx, sessionId, card, extra, options = {}) {
  if (gateLedger.liveCountFor(sessionId) >= 200) return { ok: false, reason: 'too_many_open_gates' };
  const capabilities = gateRender.detectGateCapabilities(server, ctx);
  // Briefing precedes the returned next-move card; no inline dialog before it.
  if (options.afterBriefing) capabilities.elicitation = false;
  const renderCtx = { capabilities, sessionId };
  if (capabilities.elicitation && server?.server?.elicitInput) renderCtx.elicitInput = params => server.server.elicitInput(params);
  const rendered = await gateRender.renderGate(card, renderCtx);
  const entry = { card: rendered.card, kind: extra.kind || rendered.card.kind || 'general', sessionId,
    renderer: gateRender.ledgerRenderer(rendered, renderCtx), ...extra };
  if (rendered.answer?.chosen) entry.elicited_answer = rendered.answer.chosen;
  if (!gateLedger.mintGate(rendered.card.gate_id, entry)) return { ok: false, reason: 'gate_id_in_use' };
  return { ok: true, gate_id: rendered.card.gate_id, card: rendered.card, renderer: rendered.renderer,
    rendered: rendered.rendered, approving: extra.approving || null };
}
async function prepareRoomCreation(server, ctx, sessionId, input) {
  if (!sessionId) return { ok: false, reason: 'no_session_id' };
  const slug = input.slug || slugFor(input.name);
  const target = destination(slug);
  if (!target.ok) return target;
  const preview = { name: input.name, purpose: input.purpose, slug, folder: target.target };
  const gate = await mintCard(server, ctx, sessionId, {
    kind: 'material_step', header: 'Create ' + input.name + '?', selectMode: 'single',
    options: [
      { id: 'approve', label: 'Approve and create room', description: input.purpose, preview: 'Local folder: ' + target.target },
      { id: 'reject', label: 'Do not create room', description: 'Keep the filesystem unchanged.' },
      { id: 'defer', label: 'Decide later', description: 'Decide later without creating a room.' },
    ],
  }, { kind: 'material_step', roomCreation: true, approving: ['approve'],
    resumeFn(answer) {
      if (answer.verdict !== 'approve') return { ok: true, created: false, verdict: answer.verdict };
      const checked = destination(slug, target.realHome);
      if (!checked.ok) return checked;
      const result = navigation.birthRoom({ slug, roomDir: checked.target, sessionId,
        ventureText: input.purpose, jtbd: input.purpose, vname: input.name, approvedBy: 'navigator',
        creationGateId: answer.gate_id, creationAnsweredVia: answer.answered_via,
        gateAnswers: [{ gate_id: answer.gate_id, canonical_verb: 'Approve', option_key: 'approve' }],
      });
      return { ...result, created: result.ok === true, room_dir: result.roomDir || checked.target, name: input.name };
    },
  });
  return gate.ok ? { ok: true, preview, gate } : gate;
}
function answerRoomCreation(live, answer, sessionId) {
  let outcome;
  try { outcome = live.resumeFn(answer); }
  catch (_) { return { ok: false, reason: 'room_creation_failed', gate_id: answer.gate_id }; }
  if (!outcome?.ok) return { ok: false, gate_id: answer.gate_id, room_creation: outcome, reason: outcome?.reason || 'room_creation_failed' };
  gateLedger.releaseGate(answer.gate_id, sessionId);
  return { ok: true, gate_id: answer.gate_id, chosen: answer.chosen, verdict: answer.verdict,
    ratified: answer.verdict === 'approve', answered_via: answer.answered_via, room_creation: outcome };
}
async function nextMoveForWorkday(server, ctx, sessionId, roomDir, slug, briefing) {
  const gateId = 'workday-' + briefing.visit_id.slice(0, 32);
  const live = gateLedger.peekGate(gateId, sessionId);
  if (live && live.ok !== false) return { ok: true, gate_id: gateId, card: live.card, renderer: live.renderer };
  const ro = navigation.openRoomDbReadOnlyForCaller(roomDir);
  try {
    if (ro && navigation.readGateAnswerAnchor(ro, gateId).found) return { status: 'answered', gate_id: gateId };
  } finally { if (ro) navigation.closeRoomDbForCaller(ro); }
  const hasUnfinished = !!briefing.last_session?.next_action || briefing.open_questions.length || briefing.pending_decisions.length;
  return mintCard(server, ctx, sessionId, {
    gate_id: gateId, kind: 'general', header: 'What would you like to work on in ' + slug + '?', selectMode: 'single',
    options: [
      { id: 'continue', label: hasUnfinished ? 'Continue the unfinished work' : 'Review the room understanding' },
      { id: 'review_changes', label: 'Review what changed' },
      { id: 'another_direction', label: 'Choose another direction' },
      { id: 'free_text', label: 'Tell Larry what you need today' },
    ],
  }, { mintedRoomDir: roomDir, mintedRoomSlug: slug, roomDir }, { afterBriefing: true });
}
module.exports = { prepareRoomCreation, answerRoomCreation, nextMoveForWorkday, slugFor, destination };
