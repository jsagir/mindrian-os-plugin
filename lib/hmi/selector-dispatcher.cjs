/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 101-04 Task 2 -- selector-dispatcher.cjs.
 * THE single integration point for shape rendering. Phase 102 renderer +
 * Phase 104 per-command code call ONLY this dispatcher; never the
 * individual shape modules. See 101-04-PLAN.md for full contract.
 *
 * pickShape({ requestedShape, roomDir, operator, tier, payload })
 *   -> { shape, rendered } | { shape, passthrough: true }
 *    | { shape: 'error', rendered: { error, detail } }
 */

'use strict';

const FREE_TEXT = 'Free-Text';
const PASSTHROUGH_SHAPES = ['A', 'B', 'C', 'D', 'E'];

function ensureFreeTextLast(rendered) {
  // D-10: defense in depth -- if a contract.verbs array exists, ensure
  // Free-Text is its last element. Append a body row to match.
  if (!rendered || typeof rendered !== 'object') return rendered;
  const c = rendered.contract;
  if (!c || !Array.isArray(c.verbs)) return rendered;
  if (c.verbs[c.verbs.length - 1] === FREE_TEXT) return rendered;
  const verbs = c.verbs.filter(function (v) { return v !== FREE_TEXT; });
  verbs.push(FREE_TEXT);
  c.verbs = verbs;
  if (rendered.zones && typeof rendered.zones.body === 'string') {
    rendered.zones.body = rendered.zones.body + '\n▷ ' + String(verbs.length) + '. ' + FREE_TEXT;
  }
  return rendered;
}

function loadF1Renderer() {
  // Phase 88.2 module preferred; HMI-101-06 fallback otherwise.
  try { return require('./shape-f1-renderer.cjs'); }
  catch (e) {
    if (e && e.code !== 'MODULE_NOT_FOUND') throw e;
    return require('./shape-f1-fallback.cjs');
  }
}

function readJtbdSafely(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  try {
    const state = require('./jtbd-state.cjs');
    const current = state.getCurrent(roomDir);
    return (current && typeof current.jtbd === 'string' && current.jtbd.length > 0)
      ? current.jtbd : null;
  } catch (e) { return null; }
}

function dispatchF(jtbd, tier, payload) {
  const f6 = require('./shape-f6-renderer.cjs');
  const recommendedVerb = (payload && typeof payload.recommendedVerb === 'string')
    ? payload.recommendedVerb : null;
  if (jtbd) {
    const result = f6.renderShapeF6({
      jtbd: jtbd, tier: tier, recommendedVerb: recommendedVerb,
      header: payload && payload.header,
    });
    if (result && result.error) return { shape: 'error', rendered: result };
    if (result && result.fallthrough) return dispatchF1(tier, payload);
    return { shape: 'F.6', rendered: ensureFreeTextLast(result) };
  }
  return dispatchF1(tier, payload);
}

function dispatchF1(tier, payload) {
  const f1 = loadF1Renderer();
  const recommendedVerb = (payload && typeof payload.recommendedVerb === 'string')
    ? payload.recommendedVerb : null;
  const result = f1.renderShapeF1({
    tier: tier, recommendedVerb: recommendedVerb,
    header: payload && payload.header,
  });
  return { shape: 'F.1', rendered: ensureFreeTextLast(result) };
}

function dispatchG(payload) {
  const g = require('./shape-g-renderer.cjs');
  const result = g.renderShapeG(payload || {});
  if (result && result.fallthrough) {
    return { shape: 'E', passthrough: true, fallthroughFrom: 'G',
      reason: result.reason || 'degenerate_matrix' };
  }
  return { shape: 'G', rendered: result };
}

function dispatchH(payload) {
  const h = require('./shape-h-renderer.cjs');
  const result = h.renderShapeH(payload || {});
  if (result && result.error) return { shape: 'error', rendered: result };
  return { shape: 'H', rendered: result };
}

function pickShape(input) {
  try {
    const opts = (input && typeof input === 'object') ? input : {};
    const requestedShape = typeof opts.requestedShape === 'string' ? opts.requestedShape : null;
    const roomDir = typeof opts.roomDir === 'string' ? opts.roomDir : null;
    const tier = typeof opts.tier === 'number' ? opts.tier : 0;
    const payload = (opts.payload && typeof opts.payload === 'object') ? opts.payload : {};
    if (!requestedShape) {
      return { shape: 'error', rendered: { error: 'dispatch-failed', detail: 'requestedShape is required' } };
    }
    if (requestedShape === 'F') return dispatchF(readJtbdSafely(roomDir), tier, payload);
    if (requestedShape === 'G') return dispatchG(payload);
    if (requestedShape === 'H') return dispatchH(payload);
    if (PASSTHROUGH_SHAPES.indexOf(requestedShape) !== -1) {
      return { shape: requestedShape, passthrough: true };
    }
    return { shape: 'error', rendered: { error: 'dispatch-failed',
      detail: ('unknown shape: ' + requestedShape).slice(0, 80) } };
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : 'unknown';
    return { shape: 'error', rendered: { error: 'dispatch-failed', detail: msg.slice(0, 80) } };
  }
}

module.exports = {
  pickShape: pickShape,
  _internal: {
    ensureFreeTextLast: ensureFreeTextLast,
    readJtbdSafely: readJtbdSafely,
    loadF1Renderer: loadF1Renderer,
    PASSTHROUGH_SHAPES: PASSTHROUGH_SHAPES.slice(),
  },
};
