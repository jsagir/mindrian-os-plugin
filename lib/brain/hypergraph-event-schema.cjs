/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 132 Plan 01 Task 2 -- the frozen 5-event-type hypergraph schema
 * contract + the reify Cypher builder.
 *
 * A reified event node is the hypergraph reformat of a fact that the legacy
 * teaching graph carried as a single binary edge. Instead of
 * (Person)-[:AUTHORED]->(Framework), the event becomes a first-class node
 * (:AuthorshipEvent) wired by N binary edges to its participants, so the fact
 * can carry year / organization / context as properties and can itself be a
 * participant in higher-order relationships.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the 5 event types (Plan 02
 * reifies against it; it never hand-rolls label names that could drift from the
 * CONTEXT table). The 5 types and their connected roles are the CONTEXT
 * Sub-plan 132-02 table:
 *
 *   AuthorshipEvent    : Person + Framework/Book + Year + Organization
 *   IllustrationEvent  : Example + Framework + Year + Industry + Outcome
 *   ContradictionEvent : Framework + RivalFramework + Evidence + Status(open/resolved)
 *   MotivationEvent    : Problem + Framework + Severity + Date
 *   EvolutionEvent     : Framework + ParentFramework + Year + Author
 *
 * Canon Part 7 (additive, never breaking a caller): the legacy binary
 * AUTHORED / ILLUSTRATES edges that chain-recommender + dashboard-graph
 * neighborhood read STAY. Reified events are ADDITIVE -- buildReifyCypher emits
 * NO DELETE/REMOVE/DETACH/DROP, and its event-to-participant edge labels are
 * named to coexist with (never collide with) the legacy binary edges.
 *
 * Canon Part 8: a reify Cypher binds only participant names (handles), enum
 * role tags, scalar role values (year, status, severity, outcome, industry),
 * and the provenance scalar. No user-content surface.
 *
 * Zero new deps. CJS only. No em-dashes.
 */
'use strict';

const crypto = require('node:crypto');

// The instance floor every event type must hit in Plan 02 (exported so Plan
// 02's count assertion reads the contract, not a magic number).
const EVENT_INSTANCE_MIN = 20;

// Each role declares:
//   role     -- the participant key supplied to buildReifyCypher.
//   node     -- the participant node label the binary edge points at.
//   edge     -- the binary edge label FROM the event node TO the participant.
//   kind     -- 'participant' (a graph node + edge) | 'scalar' (a property on
//               the event node, no edge). year / status / severity / outcome /
//               industry / date / evidence are scalar/enum properties.
//
// Edge labels are *_IN_EVENT / ABOUT_* / AT_* style so they coexist with the
// legacy binary AUTHORED / ILLUSTRATES edges and never collide with them.
const EVENT_NODE_TYPES = Object.freeze({
  AuthorshipEvent: Object.freeze({
    label: 'AuthorshipEvent',
    roles: Object.freeze([
      Object.freeze({ role: 'person',       node: 'Person',    edge: 'AUTHORED_IN_EVENT', kind: 'participant' }),
      Object.freeze({ role: 'work',         node: 'Framework', edge: 'ABOUT_WORK',        kind: 'participant' }),
      Object.freeze({ role: 'year',                                                       kind: 'scalar' }),
      Object.freeze({ role: 'organization', node: 'Organization', edge: 'AT_ORG',         kind: 'participant' }),
    ]),
  }),
  IllustrationEvent: Object.freeze({
    label: 'IllustrationEvent',
    roles: Object.freeze([
      Object.freeze({ role: 'example',   node: 'Example',   edge: 'ILLUSTRATED_BY_EVENT', kind: 'participant' }),
      Object.freeze({ role: 'work',      node: 'Framework', edge: 'ABOUT_WORK',           kind: 'participant' }),
      Object.freeze({ role: 'year',                                                       kind: 'scalar' }),
      Object.freeze({ role: 'industry',                                                   kind: 'scalar' }),
      Object.freeze({ role: 'outcome',                                                    kind: 'scalar' }),
    ]),
  }),
  ContradictionEvent: Object.freeze({
    label: 'ContradictionEvent',
    roles: Object.freeze([
      Object.freeze({ role: 'framework',     node: 'Framework', edge: 'CONTENDS_FRAMEWORK', kind: 'participant' }),
      Object.freeze({ role: 'rivalFramework', node: 'Framework', edge: 'AGAINST_FRAMEWORK', kind: 'participant' }),
      Object.freeze({ role: 'evidence',                                                     kind: 'scalar' }),
      Object.freeze({ role: 'status',                                                       kind: 'scalar' }),
    ]),
  }),
  MotivationEvent: Object.freeze({
    label: 'MotivationEvent',
    roles: Object.freeze([
      Object.freeze({ role: 'problem',   node: 'Problem',   edge: 'MOTIVATED_BY_PROBLEM', kind: 'participant' }),
      Object.freeze({ role: 'framework', node: 'Framework', edge: 'ABOUT_WORK',           kind: 'participant' }),
      Object.freeze({ role: 'severity',                                                   kind: 'scalar' }),
      Object.freeze({ role: 'date',                                                       kind: 'scalar' }),
    ]),
  }),
  EvolutionEvent: Object.freeze({
    label: 'EvolutionEvent',
    roles: Object.freeze([
      Object.freeze({ role: 'framework',       node: 'Framework', edge: 'EVOLVED_FRAMEWORK',   kind: 'participant' }),
      Object.freeze({ role: 'parentFramework', node: 'Framework', edge: 'FROM_PARENT',         kind: 'participant' }),
      Object.freeze({ role: 'year',                                                            kind: 'scalar' }),
      Object.freeze({ role: 'author',          node: 'Person',    edge: 'EVOLVED_BY_PERSON',   kind: 'participant' }),
    ]),
  }),
});

// Deterministic event id from the type + participant handles so re-runs are
// idempotent (the same fact reifies to the same node id, MERGE is a no-op the
// second time). Hash keeps the id short + stable; embedding-independent.
function deterministicEventId(eventType, participants) {
  const roles = EVENT_NODE_TYPES[eventType].roles;
  const parts = [eventType];
  roles.forEach(function (r) {
    const v = participants[r.role];
    if (v != null) parts.push(r.role + '=' + String(v));
  });
  const key = parts.join('|');
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  return eventType.toLowerCase().replace('event', '') + '-' + hash;
}

/**
 * Build the reify { cypher, params } pair for one event instance.
 *
 * MERGEs the reified event node (label = eventType, deterministic id) and one
 * binary edge from the event node to each named participant; SETs created_by on
 * the event node and on each edge; embeds scalar/enum role values as properties
 * on the event node. The Cypher is ADDITIVE (no DELETE/REMOVE/DETACH/DROP) per
 * Canon Part 7 and is directly feedable to curation-batch.makeBatch.
 *
 * @param {string} eventType one of the 5 EVENT_NODE_TYPES keys.
 * @param {object} participants role -> value map (handles for participants,
 *   scalars for year/status/severity/outcome/industry/date/evidence).
 * @param {string} by the created_by provenance scalar (the batchId).
 * @returns {{cypher:string, params:object}}
 */
function buildReifyCypher(eventType, participants, by) {
  const def = EVENT_NODE_TYPES[eventType];
  if (!def) {
    throw new Error('buildReifyCypher: unknown event type ' + JSON.stringify(eventType));
  }
  if (typeof by !== 'string' || !by) {
    throw new Error('buildReifyCypher: a created_by provenance scalar (by) is required');
  }
  participants = participants || {};

  const eventId = deterministicEventId(eventType, participants);
  const params = { event_id: eventId, created_by: by };

  // Scalar/enum role values become properties on the event node.
  const scalarSets = ['e.created_by = $created_by'];
  def.roles.forEach(function (r) {
    if (r.kind === 'scalar' && participants[r.role] != null) {
      const pkey = 'scalar_' + r.role;
      params[pkey] = participants[r.role];
      scalarSets.push('e.' + r.role + ' = $' + pkey);
    }
  });

  // MERGE the event node by deterministic id (idempotent).
  let cypher = 'MERGE (e:' + def.label + ' {id: $event_id}) ' +
    'SET ' + scalarSets.join(', ');

  // One binary edge from the event node to each PARTICIPANT supplied.
  def.roles.forEach(function (r, idx) {
    if (r.kind !== 'participant') return;
    if (participants[r.role] == null) return;
    const pkey = 'p_' + r.role;
    const alias = 'p' + idx;
    params[pkey] = participants[r.role];
    // Match the participant by name (a handle), MERGE the binary edge, stamp
    // created_by on the edge. Additive: never touches the legacy binary edge.
    cypher += ' WITH e ' +
      'MATCH (' + alias + ' {name: $' + pkey + '}) ' +
      'MERGE (e)-[rel_' + idx + ':' + r.edge + ']->(' + alias + ') ' +
      'SET rel_' + idx + '.created_by = $created_by';
  });

  return { cypher: cypher, params: params };
}

module.exports = {
  EVENT_NODE_TYPES,
  buildReifyCypher,
  EVENT_INSTANCE_MIN,
  deterministicEventId,
};
