'use strict';
// Phase 198-03 (D-01, RESEARCH Open Question 3) -- minimal additive SSE event
// bus for live statusline segments (the opencode /event pattern). In-process,
// loopback-only; a durable daemon process holds the subscriber set for its
// lifetime, mirroring lib/mcp/session-registry.cjs's in-process-only shape.
//
// The vocabulary is FROZEN and additive-only (Open Question 3, resolved in
// this plan): new kinds may be appended in a later phase, never renamed or
// removed. EVENT_KINDS carries navigator-facing segment data ONLY
// (status/gate/reconcile signals) -- never room content bound for the Brain
// (Part 8). status_read's spend/cap segment travels here starting Plan 06.
//
// No em-dashes. CJS only. Zero Brain/network token.

const EVENT_KINDS = Object.freeze(['status-segment', 'gate-fired', 'reconcile-raised']);

// In-memory subscriber set. Never persisted; a subscriber that disconnects
// (its 'close' event fires, when the object exposes `on`) is deregistered.
const subscribers = new Set();

/**
 * subscribe(res) -- attach an SSE response stream. `res` is any object
 * exposing `write(str)`; `on(event, cb)` and `writeHead(status, headers)` are
 * used when present but are NOT required (a plain mock satisfying only
 * `write` still registers -- this keeps the module unit-testable without a
 * real HTTP response). When `writeHead` is available, the standard SSE
 * headers are sent once on subscribe. When `on` is available, the stream
 * auto-deregisters on its 'close' event. Never throws.
 *
 * @param {{write: function(string): void, on?: function, writeHead?: function}} res
 */
function subscribe(res) {
  if (!res || typeof res.write !== 'function') return;
  try {
    if (typeof res.writeHead === 'function') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      // Node/Express buffer headers until the first body write unless
      // explicitly flushed -- without this a real client (EventSource, curl)
      // sees nothing at all until the first publish(), indistinguishable from
      // a hung connection. Flush immediately so "the stream is open" is its
      // own signal, independent of when the first event arrives.
      if (typeof res.flushHeaders === 'function') {
        try { res.flushHeaders(); } catch (_e2) { /* best-effort */ }
      }
    }
  } catch (_e) {
    // A header-write failure never blocks registration -- the subscriber can
    // still receive publish() frames on `write`.
  }
  subscribers.add(res);
  if (typeof res.on === 'function') {
    try {
      res.on('close', () => { subscribers.delete(res); });
    } catch (_e) {
      // A mock `on` that throws still leaves the subscriber registered; a
      // dead-stream write failure in publish() below reaps it instead.
    }
  }
}

/**
 * publish(kind, payload) -- broadcast an SSE event to every live subscriber.
 * Silently no-ops on a kind outside the frozen EVENT_KINDS vocabulary or a
 * payload that cannot be JSON-serialized (refusal, not a throw, on a hot
 * server-side publish path). A subscriber whose `write` throws (a dead
 * stream) is deregistered rather than letting it break the broadcast to
 * every other subscriber. Never throws into the caller.
 *
 * @param {string} kind - one of EVENT_KINDS
 * @param {object} payload
 */
function publish(kind, payload) {
  try {
    if (EVENT_KINDS.indexOf(kind) === -1) return;
    let data;
    try {
      data = JSON.stringify(payload === undefined ? null : payload);
    } catch (_e) {
      return;
    }
    const frame = 'event: ' + kind + '\ndata: ' + data + '\n\n';
    for (const res of subscribers) {
      try {
        res.write(frame);
      } catch (_e) {
        subscribers.delete(res);
      }
    }
  } catch (_e) {
    // Never throw into the publishing call site (mirrors session-registry.close).
  }
}

module.exports = { EVENT_KINDS, publish, subscribe };
