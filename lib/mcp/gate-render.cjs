'use strict';
// Phase 198-05 (SPEC-4, Task 1) -- the Mindrian gate superset schema + the
// three-rung renderer ladder.
//
// 307 files today assume the Claude Code AskUserQuestion card; no schema
// exists independent of the host. This module defines ONE Mindrian superset
// card (options + per-option descriptions + ranks + previews + single/multi-
// select) and a 3-rung renderer ladder:
//   (a) renderViaElicitation -- MCP elicitation, where the client declares the
//       capability. LOSSY on the wire: the requestedSchema carries per-option
//       `const` (option ids) plus `title` (labels) on both select modes, via
//       the SDK's titled enum schemas (@modelcontextprotocol/core, package
//       root exports TitledSingleSelectEnumSchemaSchema and
//       TitledMultiSelectEnumSchemaSchema) -- per-option descriptions/ranks/
//       previews never leave the server on this rung (RESEARCH Pitfall 4;
//       SDK 1.29.0 ElicitRequestFormParamsSchema has no per-option
//       description field). Phase 265 ledger: RADAR-06 (265-02-PLAN.md).
//   (b) renderViaAskUserQuestion -- composes the FULL card (through the
//       shipped shape-f8-renderer.cjs toggle envelope + the selector-
//       dispatcher's AskUserQuestion trailer, Canon Part 7 reuse) for the
//       Claude Code thin adapter, enriched with the complete superset
//       metadata (descriptions/ranks/previews) so the adapter can construct
//       the real native AskUserQuestion call with full fidelity.
//   (c) renderViaText -- a structured-text card + next-message fallback for
//       headless clients that declare neither capability.
//
// The three rungs carry different wire fidelity, but they all normalize the
// user's choice into ONE canonical gate_answer payload shape
// `{ gate_id, chosen: [optionId...], verdict }` via normalizeGateAnswer --
// SPEC-4's acceptance bar is that identity, not merely "each renderer works".
//
// D-04 (F.8 binding-card discipline): a gate of kind 'binding' fires ONCE per
// session and ONLY on genuine ambiguity; a resolved/unambiguous context (or a
// session that already saw its one binding card) returns no card at all.
//
// Canon Part 7: reuses lib/hmi/shape-f8-renderer.cjs (binding) +
// lib/hmi/shape-f9-renderer.cjs (reconcile) + lib/hmi/selector-dispatcher.cjs
// -- this module mints NO new card renderer.
// Canon Part 8: zero Brain/network tokens; pure composition + normalization.
// Phase 289 (D-03): the one shared capability ruling, detectGateCapabilities,
// lives here and composes detectHostTier from ./surface-detect.cjs. That
// module is pure and total and requires only the fs module, so the "pure
// composition" claim above still holds: no network, no database, no Brain.
// CJS only. No em-dashes.

const crypto = require('node:crypto');

const { renderShapeF8 } = require('../hmi/shape-f8-renderer.cjs');
const { renderShapeF9 } = require('../hmi/shape-f9-renderer.cjs');
const selectorDispatcher = require('../hmi/selector-dispatcher.cjs');
const { detectHostTier } = require('./surface-detect.cjs');

const DEFAULT_VERDICT = 'approve';

// quick task 260903-h27 (T-h27-03): the normalized card is retained in the
// in-process gate ledger until consumed or TTL-expired, and the caller
// supplying evidence_node_ids is the model itself (the ONLY entity that can
// ever know these ids -- see the plan's objective). An unbounded caller-
// controlled list is therefore caller-controlled retained memory. This cap
// bounds it.
const MAX_EVIDENCE_NODE_IDS = 64;
const MAX_NOTICE_CHARS = 400;
const MAX_APPROVE_LABEL_CHARS = 80;
// Phase 289 ELICIT289-01: the elicitation field title is an instruction line
// in a host dialog. 120 is a contract default, not a measured host limit: the
// dialog shows it on one line, SEED-104's own example title is 45 characters,
// and four labels at MAX_APPROVE_LABEL_CHARS (80) would exceed 300.
const MAX_ELICIT_TITLE_CHARS = 120;

// -----------------------------------------------------------------------
// SUPERSET_SCHEMA -- Mindrian's OWN card superset (descriptive, not a zod
// validator: the MCP tool layer, lib/mcp/tools/gate.cjs, owns the zod input
// schema for the gate_render tool call itself). Every renderer normalizes
// its raw card input against this shape before rendering.
// -----------------------------------------------------------------------
const SUPERSET_SCHEMA = Object.freeze({
  schema: 'mindrian.gate.superset.v1',
  fields: Object.freeze({
    gate_id: 'string (minted if absent)',
    header: 'string | null',
    kind: "string (e.g. 'binding' for the F.8 once-per-session card, 'general' default)",
    ambiguous: 'boolean (only relevant to kind: binding)',
    selectMode: "'single' | 'multi'",
    options: Object.freeze({
      id: 'string (derived from label if absent)',
      label: 'string',
      description: 'string | null',
      rank: 'number | null',
      preview: 'string | null',
      // Phase 289 D-05: an explicit author flag. Accepted input: recommended
      // (true only). Carried on the normalized option only when set.
      recommended: 'true | absent (explicit flag; outranks rank when deriving the card recommendation)',
    }),
    // Phase 289 D-05: derived, never supplied. The id of the first option
    // flagged recommended:true; else the id of the option with the lowest
    // finite rank (rank 1 is the top, ties keep input order); else null.
    recommended: 'string | null (derived by normalizeCard; the id of one of the options above)',
    // quick task 260903-h27 (T2 gate-card schema half): carryable-only
    // fields. Accepted input keys: subject_node_id / subjectNodeId (snake_case
    // wins when both are present). Normalized output: subjectNodeId. Nothing
    // in this task READS these fields -- they exist so the write half
    // (claim-node creation + provenance edges) can consume an
    // already-populated card.
    subjectNodeId: "string | null (default null; accepted input: subject_node_id, falls back to subjectNodeId)",
    // Accepted input keys: evidence_node_ids / evidenceNodeIds (snake_case
    // wins). Normalized output: evidenceNodeIds. Non-empty-string entries
    // only, de-duped first-wins, capped at MAX_EVIDENCE_NODE_IDS (64).
    evidenceNodeIds: "string[] (default []; accepted input: evidence_node_ids, falls back to evidenceNodeIds; capped at " + MAX_EVIDENCE_NODE_IDS + ")",
    // Phase 365 D-05/D-24: the why-line printed before the answer on every
    // rung, carried as data (never folded into header). Accepted input key:
    // notice. Whitespace collapsed, capped at MAX_NOTICE_CHARS (400).
    notice: "string | null (default null; one plain line, at most " + MAX_NOTICE_CHARS + " characters)",
    // Accepted input keys: approve_label / approveLabel (snake_case wins).
    // Relabels ONLY the option whose id is 'approve'; ids never change.
    approveLabel: "string | null (input only: approve_label, falls back to approveLabel; capped at " + MAX_APPROVE_LABEL_CHARS + "; not echoed on the normalized card)",
  }),
});

// -----------------------------------------------------------------------
// pickRenderer -- the ladder detection. elicitation-declared > insideClaude
// Code > headless-text.
// -----------------------------------------------------------------------
function pickRenderer(capabilities) {
  const caps = (capabilities && typeof capabilities === 'object') ? capabilities : {};
  if (caps.elicitation === true) return 'elicitation';
  if (caps.claudeCode === true) return 'askuserquestion';
  return 'text';
}

// -----------------------------------------------------------------------
// detectGateCapabilities -- the ONE shared capability ruling (Phase 289,
// D-03 and D-02). Every gate surface asks this function which rung to climb;
// pickRenderer above is unchanged and still turns the answer into a rung.
//
// The ruling: on a Claude host surface the gate renders as the Normal card
// (rung b), even when the client declares elicitation. The navigator ruled
// "Normal card on CLI" on 2026-10-02, reversing the 2026-09-23 ruling to let
// elicitation take over on CLI. SEED-104 measured the dialog Claude Code
// opens from an elicitation request: the field read "not set" and Accept did
// nothing, which is why the card is the surface on a Claude host.
//
// Why the rule is "a Claude host surface means card" and never
// `surface === 'cli'`: the server cannot tell CLI from Desktop. A stdio child
// spawned by a host reports desktop (surface-detect.cjs, the stdio-child
// branch of detectSurface), so keying on the literal 'cli' would miss most
// real Claude Code sessions. Claude Code declared elicitation at initialize
// from build 2.1.280 (live tee, 2026-09-23) and opens stdio with
// server/discover from 2.1.287 (267-TRIPOLAR-PROBES.md, lines 69-87), so the
// declared capability alone proves nothing about which surface asked.
//
// Why the rule cannot lean on the 2026 stdio blind spot: SDK 2.1.0's HTTP
// handler backfills the declared capabilities from each 2026 request
// (@modelcontextprotocol/server dist/index.cjs, lines 1405-1408), after which
// an elicitation request throws on that protocol revision. A 2026 HTTP client
// that declared elicitation therefore got render_failed instead of a gate.
//
// D-02: a recognized non-Claude host (detectHostTier names a host other than
// unknown, claude-code or claude-desktop, for example vscode or cursor) that
// declares elicitation keeps rung (a), so elicitation stays reachable and
// tested where a dialog is the right surface. clientInfo is unauthenticated
// (T-234-08, accepted): a spoofed name changes presentation only, never
// authority, because the answer still passes the same server-side checks.
//
// Returns exactly { elicitation, elicitation_declared, claudeCode }.
// -----------------------------------------------------------------------
const CLAUDE_HOST_SURFACES = Object.freeze(['cli', 'desktop', 'cowork']);
const CLAUDE_CLIENT_HOSTS = Object.freeze(['claude-code', 'claude-desktop']);

function detectGateCapabilities(server, ctx) {
  const inner = (server && server.server) ? server.server : null;

  let declared = false;
  try {
    const caps = (inner && typeof inner.getClientCapabilities === 'function')
      ? inner.getClientCapabilities()
      : null;
    declared = !!(caps && caps.elicitation);
  } catch (_e) {
    declared = false;
  }

  let clientVersion;
  try {
    clientVersion = (inner && typeof inner.getClientVersion === 'function')
      ? inner.getClientVersion()
      : undefined;
  } catch (_e) {
    clientVersion = undefined;
  }
  const host = detectHostTier(clientVersion).host;
  const nonClaudeHost = host !== 'unknown' && CLAUDE_CLIENT_HOSTS.indexOf(host) === -1;

  const surface = (ctx && typeof ctx.surface === 'string') ? ctx.surface : null;
  const claudeSurface = surface !== null && CLAUDE_HOST_SURFACES.indexOf(surface) !== -1;

  const elicitation = declared && (!claudeSurface || nonClaudeHost);
  const claudeCode = claudeSurface && !elicitation;
  return { elicitation: elicitation, elicitation_declared: declared, claudeCode: claudeCode };
}

// -----------------------------------------------------------------------
// Card normalization
// -----------------------------------------------------------------------
function _slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'opt';
}

function _normalizeOption(raw, index) {
  if (raw === null || raw === undefined) return null;
  const obj = (typeof raw === 'string') ? { label: raw } : ((raw && typeof raw === 'object') ? raw : null);
  if (!obj || typeof obj.label !== 'string' || obj.label.length === 0) return null;
  const id = (typeof obj.id === 'string' && obj.id.length > 0) ? obj.id : (_slug(obj.label) + '-' + index);
  const out = {
    id: id,
    label: obj.label,
    description: (typeof obj.description === 'string' && obj.description.length > 0) ? obj.description : null,
    rank: (typeof obj.rank === 'number' && Number.isFinite(obj.rank)) ? obj.rank : null,
    preview: (typeof obj.preview === 'string' && obj.preview.length > 0) ? obj.preview : null,
  };
  // Phase 289 D-05: the flag is carried only when the author set it, so a card
  // that never flags anything keeps byte-identical options.
  if (obj.recommended === true) out.recommended = true;
  return out;
}

/**
 * _deriveRecommended(options) -> an option id or null (Phase 289 D-05). The
 * first option flagged recommended:true wins; else the option with the lowest
 * finite rank (rank 1 is the top, equal ranks resolve to input order); else
 * null. Reads only normalized options, so the id is always one of them.
 */
function _deriveRecommended(options) {
  for (const o of options) {
    if (o.recommended === true) return o.id;
  }
  let best = null;
  for (const o of options) {
    if (typeof o.rank !== 'number' || !Number.isFinite(o.rank)) continue;
    if (best === null || o.rank < best.rank) best = o;
  }
  return best ? best.id : null;
}

/**
 * _normalizeNodeIds(raw) -> a FRESH string[], never throws. Non-array input
 * returns []; otherwise filters to non-empty strings, drops duplicates
 * first-wins via a Set (mirrors the option de-dup loop above), and truncates
 * to MAX_EVIDENCE_NODE_IDS.
 */
function _normalizeNodeIds(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const v of raw) {
    if (typeof v !== 'string' || v.length === 0) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= MAX_EVIDENCE_NODE_IDS) break;
  }
  return out;
}

/**
 * _normalizeText(raw, cap) -> a single-line string capped at `cap`, or null.
 * Non-strings, empty and whitespace-only input are null; newlines and runs of
 * whitespace collapse to one space (the notice and the relabel are one plain
 * line on every rung).
 */
function _normalizeText(raw, cap) {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return null;
  return collapsed.length > cap ? collapsed.slice(0, cap) : collapsed;
}

/**
 * normalizeCard(raw) -> canonical superset card (SUPERSET_SCHEMA shape).
 * Never throws. Missing gate_id is minted; duplicate option ids are dropped
 * (first wins, mirrors shape-f8-renderer's own de-dup discipline).
 */
function normalizeCard(raw) {
  const opts = (raw && typeof raw === 'object') ? raw : {};
  const gateId = (typeof opts.gate_id === 'string' && opts.gate_id.length > 0)
    ? opts.gate_id
    : ('gate-' + crypto.randomBytes(8).toString('hex'));
  const rawOptions = Array.isArray(opts.options) ? opts.options : [];
  const options = [];
  const seenIds = new Set();
  for (let i = 0; i < rawOptions.length; i += 1) {
    const n = _normalizeOption(rawOptions[i], i);
    if (!n) continue;
    if (seenIds.has(n.id)) continue;
    seenIds.add(n.id);
    options.push(n);
  }
  // quick task 260903-h27: BOTH casings are read deliberately, not defensive
  // noise. Live precedent this task must not repeat: `select_mode` is
  // emitted by two internal card builders (chain.cjs's
  // _buildMaterialStepCard, sensors.cjs's framework_run halt card) and
  // silently dropped because normalizeCard reads only `selectMode` -- see
  // this module's own selectMode line above. subject_node_id/evidence_node_
  // ids are the design's declared WIRE key (snake_case, the MCP tool-param
  // convention), so it wins when both casings are present; the camelCase
  // fallback covers an internal caller (e.g. a future card builder) that
  // constructs the card object in JS-native camelCase directly.
  const rawSubjectNodeId = (opts.subject_node_id !== undefined) ? opts.subject_node_id : opts.subjectNodeId;
  const subjectNodeId = (typeof rawSubjectNodeId === 'string' && rawSubjectNodeId.length > 0) ? rawSubjectNodeId : null;
  const rawEvidenceNodeIds = (opts.evidence_node_ids !== undefined) ? opts.evidence_node_ids : opts.evidenceNodeIds;
  const evidenceNodeIds = _normalizeNodeIds(rawEvidenceNodeIds);

  // Phase 365 D-05 / D-24: the why-line arrives as DATA from a card builder
  // that can read the room (the gate.cjs gate_render handler, the tool-router.cjs
  // meeting card); this module stays a pure normalizer and opens no database.
  // notice is its own field, never folded into header (gate_answer derives the
  // decision node text from header). approve_label relabels ONLY the option
  // whose id is 'approve'; the id stays the verdict vocabulary.
  const notice = _normalizeText(opts.notice, MAX_NOTICE_CHARS);
  const rawApproveLabel = (opts.approve_label !== undefined) ? opts.approve_label : opts.approveLabel;
  const approveLabel = _normalizeText(rawApproveLabel, MAX_APPROVE_LABEL_CHARS);
  if (approveLabel) {
    for (const o of options) {
      if (o.id === 'approve') o.label = approveLabel;
    }
  }

  return {
    gate_id: gateId,
    header: (typeof opts.header === 'string' && opts.header.length > 0) ? opts.header : null,
    kind: (typeof opts.kind === 'string' && opts.kind.length > 0) ? opts.kind : 'general',
    ambiguous: opts.ambiguous === true,
    selectMode: opts.selectMode === 'multi' ? 'multi' : 'single',
    options: options,
    recommended: _deriveRecommended(options),
    subjectNodeId: subjectNodeId,
    evidenceNodeIds: evidenceNodeIds,
    notice: notice,
  };
}

/**
 * normalizeGateAnswer(gateId, chosenIds, verdict) -> the ONE canonical
 * gate_answer payload shape every rung normalizes to. This is the SPEC-4
 * acceptance bar: whatever wire format captured the user's choice, the same
 * chosen option id + verdict always produces byte-identical output here.
 */
function normalizeGateAnswer(gateId, chosenIds, verdict) {
  return {
    gate_id: gateId,
    chosen: Array.isArray(chosenIds) ? chosenIds.slice() : [],
    verdict: (typeof verdict === 'string' && verdict.length > 0) ? verdict : DEFAULT_VERDICT,
  };
}

// -----------------------------------------------------------------------
// D-04: F.8 binding-card once-per-session-on-ambiguity discipline. A
// resolved/unambiguous context NEVER fires; an ambiguous context fires
// exactly once per session (subsequent calls for the SAME session return no
// card). In-process, single-use-per-session ledger -- mirrors the T-198-10
// live-gate ledger in lib/mcp/tools/gate.cjs (same "mint once, consume once"
// shape, different concern).
// -----------------------------------------------------------------------
const _firedBindingSessions = new Set();

function shouldFireBindingCard(sessionId, ambiguous) {
  if (ambiguous !== true) return false; // unambiguous: never fires
  const key = (typeof sessionId === 'string' && sessionId.length > 0) ? sessionId : '__no_session__';
  if (_firedBindingSessions.has(key)) return false; // already fired once this session
  _firedBindingSessions.add(key);
  return true;
}

function _resetBindingFiredForTest() {
  _firedBindingSessions.clear();
}

// -----------------------------------------------------------------------
// Rung (a): MCP elicitation. LOSSY -- per-option const (ids) + title (labels)
// on both select modes, via the SDK's titled enum schemas; no descriptions.
// -----------------------------------------------------------------------
// _capTitle(s) -> s cut to MAX_ELICIT_TITLE_CHARS: 117 characters plus three
// ASCII periods when it is longer, unchanged otherwise.
function _capTitle(s) {
  if (s.length <= MAX_ELICIT_TITLE_CHARS) return s;
  return s.slice(0, MAX_ELICIT_TITLE_CHARS - 3) + '...';
}

// Phase 289 ELICIT289-01: the host dialog opens on the field, so the field
// carries the recommendation and says what to do. SEED-104 measured a dialog
// with the field "not set" and a dead Accept; `default` preselects the
// recommended option and the title is an instruction built from the labels
// ("Choose: A / B"). Single-select defaults to card.recommended when it is
// non-null; a basket defaults only to options the author explicitly flagged
// (a rank alone never preselects a row, Canon Appendix D entry 32). No field
// `description` is added: tests/test-198-gate-renderers.test.cjs pins it
// undefined and the elicitation message already begins with the card header,
// so the header is not lost. This departs from the 289-RESEARCH.md Q4
// suggestion to move the header into the field description.
function buildElicitRequestedSchema(card) {
  const labels = card.options.map((o) => o.label).join(' / ');
  if (card.selectMode === 'multi') {
    const choices = {
      type: 'array',
      title: _capTitle('Choose one or more: ' + labels),
      items: {
        anyOf: card.options.map((o) => ({ const: o.id, title: o.label })),
      },
    };
    const flagged = card.options.filter((o) => o.recommended === true).map((o) => o.id);
    if (flagged.length > 0) choices.default = flagged;
    return {
      type: 'object',
      properties: { choices: choices },
      required: ['choices'],
    };
  }
  const choice = {
    type: 'string',
    title: _capTitle('Choose: ' + labels),
    oneOf: card.options.map((o) => ({ const: o.id, title: o.label })),
  };
  if (card.recommended !== null && card.recommended !== undefined) choice.default = card.recommended;
  return {
    type: 'object',
    properties: { choice: choice },
    required: ['choice'],
  };
}

function extractElicitChoice(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.action !== 'accept') return null;
  const content = result.content;
  if (!content || typeof content !== 'object') return null;
  if (Array.isArray(content.choices)) {
    const out = content.choices.filter((c) => typeof c === 'string');
    return out.length > 0 ? out : null;
  }
  if (typeof content.choice === 'string' && content.choice.length > 0) return [content.choice];
  return null;
}

async function renderViaElicitation(card, ctx) {
  const requestedSchema = buildElicitRequestedSchema(card);
  let message = card.header || ('mindrianOS gate: ' + card.gate_id);
  // Phase 365 D-05: the why-line prints before the answer. Rung (a) has no
  // signals zone, so it rides at the end of the elicitation message after a
  // blank line. A null notice leaves the message byte-identical.
  if (card.notice) message = message + '\n\n' + card.notice;
  const rendered = { requestedSchema: requestedSchema, message: message };

  const elicitFn = (ctx && typeof ctx.elicitInput === 'function') ? ctx.elicitInput : null;
  let answer = null;
  if (elicitFn) {
    const result = await elicitFn({ message: message, requestedSchema: requestedSchema });
    const chosenIds = extractElicitChoice(result);
    if (chosenIds && chosenIds.length > 0) {
      const verdict = (ctx && typeof ctx.verdictFor === 'function') ? ctx.verdictFor(chosenIds) : DEFAULT_VERDICT;
      answer = normalizeGateAnswer(card.gate_id, chosenIds, verdict);
    }
  }
  return { renderer: 'elicitation', rendered: rendered, answer: answer };
}

// -----------------------------------------------------------------------
// Rung (b): canUseTool/AskUserQuestion thin adapter inside Claude Code.
// Composes from the SHIPPED shape-f8-renderer.cjs toggle envelope (Canon
// Part 7 reuse -- this module never reinvents a card renderer), enriched with
// the FULL superset metadata (id/description/rank/preview) so the thin
// adapter can construct the real native AskUserQuestion call at full
// fidelity. The AskUserQuestion trailer imperative is appended through the
// shipped selector-dispatcher SEED-020 single door.
// -----------------------------------------------------------------------
/**
 * validateChosenAgainstCard(card, chosen) -> the server-side allow-list
 * check every gate ratification path needs (ASVS V5 Input Validation).
 * Phase 238 (GATE-01 G-2): until this phase, gate_answer's and chain_run's
 * ratification paths had no value-domain check at all -- the zod schema on
 * gate_answer's tool input validated only the SHAPE of `chosen`
 * (z.array(z.string().min(1)).min(1)), never that a submitted value was
 * actually among the minted card's own options. This is that check,
 * lifted from the AskUserQuestion rung's own resolver (below) so 238-03
 * (gate.cjs) and 238-04 (chain.cjs) can both call the SAME implementation
 * rather than growing a second copy.
 *
 * Returns an array of resolved option ids when at least one submitted
 * value matches an option id or an option label; returns null when
 * nothing survives (null means REJECT). Guards defensively: a null or
 * malformed card, a card with no options array, or a non-array chosen all
 * return null rather than throwing, because both new call sites run
 * inside MCP tool handlers where a throw becomes an opaque tool error.
 */
function validateChosenAgainstCard(card, chosen) {
  if (!Array.isArray(chosen)) return null;
  const options = (card && Array.isArray(card.options)) ? card.options : null;
  if (!options) return null;
  const byId = new Set(options.map((o) => o.id));
  const byLabel = new Map(options.map((o) => [o.label, o.id]));
  const out = [];
  for (const c of chosen) {
    if (typeof c !== 'string') continue;
    if (byId.has(c)) { out.push(c); continue; }
    if (byLabel.has(c)) { out.push(byLabel.get(c)); continue; }
  }
  return out.length > 0 ? out : null;
}

/**
 * checkVerdictAgainstApproving(entry, chosenIds, verdict) -> a refusal reason
 * string, or null when the answer is coherent (Phase 289 review CR-01).
 *
 * `verdict` is taken verbatim from the caller and `chosen` is only checked for
 * membership in the card, so nothing tied the two together: an approve verdict
 * that named the reject option ran a material step, and a reject verdict that
 * named the approving option was recorded as a reject. A gate whose minter
 * knows which option ids approve persists them on the ledger entry as
 * `approving` (an array of option ids). For such an entry:
 *   - verdict 'approve' must name at least one approving id, else
 *     'chosen_not_approving';
 *   - verdict 'reject' or 'defer' must name none, else
 *     'verdict_chosen_mismatch'.
 * An entry with no `approving` array (a plain gate_render card, whose option
 * ids carry no declared meaning) is not checked: that residual is named in the
 * 289-REVIEW-FIX.md report. Both consumers call this on the PEEKED entry, before
 * the consume, so a refusal writes nothing, runs nothing and leaves the gate for
 * its owner. `chosenIds` are the resolved ids from validateChosenAgainstCard.
 */
function checkVerdictAgainstApproving(entry, chosenIds, verdict) {
  const approving = (entry && Array.isArray(entry.approving)) ? entry.approving : null;
  if (!approving) return null;
  const ids = Array.isArray(chosenIds) ? chosenIds : [];
  const namesApproving = ids.some(function (id) { return approving.indexOf(id) !== -1; });
  if (verdict === 'approve') return namesApproving ? null : 'chosen_not_approving';
  return namesApproving ? 'verdict_chosen_mismatch' : null;
}

/**
 * _resolveChosenIds -- thin caller kept for the AskUserQuestion rung's own
 * existing contract (its guard on `picked` is not part of
 * validateChosenAgainstCard's own signature). Behavior is byte-stable:
 * this is the rung's only current caller and its tests must not move.
 */
function _resolveChosenIds(picked, card) {
  if (!picked || !Array.isArray(picked.chosen)) return null;
  return validateChosenAgainstCard(card, picked.chosen);
}

async function renderViaAskUserQuestion(card, ctx) {
  const base = renderShapeF8({
    options: card.options.map((o) => ({ label: o.label, confidence: null })),
    header: card.header || undefined,
  });
  // Reuse stops at the envelope shape; the superset's extra fidelity
  // (descriptions/ranks/previews, and the true single/multi mode -- F.8's own
  // renderer always sets multiSelect:true) is folded on top, not reinvented.
  base.contract.multiSelect = card.selectMode === 'multi';
  base.contract.superset_options = card.options.map((o) => ({
    id: o.id,
    label: o.label,
    description: o.description,
    rank: o.rank,
    preview: o.preview,
    // Phase 289 D-05: single-select marks the derived top option; a basket
    // marks only what the author explicitly flagged, never a rank-derived row.
    recommended: card.selectMode === 'multi' ? (o.recommended === true) : (o.id === card.recommended),
  }));
  // Phase 289 D-05 (Canon Appendix D entry 32): a basket has no single
  // answer, so a multi-select contract keeps recommended null. The F.8
  // renderer pins null; the gate layer sets the id, as it already does for
  // multiSelect above.
  base.contract.recommended = card.selectMode === 'multi' ? null : card.recommended;
  // Phase 289 D-07: F.8 stores its rows under `options` while the shared
  // trailer counts `contract.verbs`, which made the imperative say "0 options
  // above" (289-RESEARCH.md Pitfall 6). The fix stays in the gate layer; the
  // dispatcher and its F.4 pin are untouched.
  base.contract.verbs = card.options.map((o) => o.label);
  // Phase 365 D-05: the why-line rides in the signals zone and on the
  // contract so the thin adapter prints it before the question. Guarded: a
  // null notice adds no key and leaves the payload byte-identical.
  if (card.notice) {
    base.zones.signals = card.notice;
    base.contract.notice = card.notice;
  }
  selectorDispatcher.appendAskUserQuestionTrailer(base, base.contract.shape || 'F.8');

  let answer = null;
  const responder = (ctx && typeof ctx.simulateAskUserQuestion === 'function') ? ctx.simulateAskUserQuestion : null;
  if (responder) {
    const picked = await responder(base);
    const chosenIds = _resolveChosenIds(picked, card);
    if (chosenIds) {
      const verdict = (picked && typeof picked.verdict === 'string')
        ? picked.verdict
        : ((ctx && typeof ctx.verdictFor === 'function') ? ctx.verdictFor(chosenIds) : DEFAULT_VERDICT);
      answer = normalizeGateAnswer(card.gate_id, chosenIds, verdict);
    }
  }
  return { renderer: 'askuserquestion', rendered: base, answer: answer };
}

// -----------------------------------------------------------------------
// Rung (c): structured-text fallback for headless clients.
// -----------------------------------------------------------------------
function parseTextReply(text, card) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const tokens = text.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const out = [];
  for (const t of tokens) {
    const idx = parseInt(t, 10);
    if (Number.isInteger(idx) && String(idx) === t && idx >= 1 && idx <= card.options.length) {
      out.push(card.options[idx - 1].id);
      continue;
    }
    const byId = card.options.find((o) => o.id === t);
    if (byId) { out.push(byId.id); continue; }
  }
  return out.length > 0 ? out : null;
}

async function renderViaText(card, ctx) {
  const lines = card.options.map((o, i) => {
    let line = (i + 1) + '. ' + o.label + ' [' + o.id + ']';
    if (o.description) line += ' - ' + o.description;
    // Phase 289 D-05: single-select marks the recommended option's line; a
    // basket carries no marker (Canon Appendix D entry 32).
    if (card.selectMode !== 'multi' && card.recommended !== null && o.id === card.recommended) line += ' (recommended)';
    return line;
  });
  // Phase 365 D-05: the why-line prints before the options (body) and rides
  // in the signals zone and on the contract. A null notice changes nothing.
  const body = card.notice ? (card.notice + '\n\n' + lines.join('\n')) : lines.join('\n');
  const rendered = {
    zones: {
      header: card.header || '-- mindrianOS -- gate --',
      body: body,
      signals: card.notice ? card.notice : '',
      footer: 'Reply with the option number or id' + (card.selectMode === 'multi' ? 's (comma-separated)' : '') + ' to answer.',
    },
    contract: {
      shape: 'text',
      keyboard: 'next-message',
      multiSelect: card.selectMode === 'multi',
      recommended: card.selectMode === 'multi' ? null : card.recommended,
      freeTextOffered: false,
      options: card.options.map((o) => o.id),
    },
  };
  if (card.notice) rendered.contract.notice = card.notice;

  let answer = null;
  const responder = (ctx && typeof ctx.simulateTextReply === 'function') ? ctx.simulateTextReply : null;
  if (responder) {
    const replyText = await responder(rendered);
    const chosenIds = parseTextReply(replyText, card);
    if (chosenIds) {
      const verdict = (ctx && typeof ctx.verdictFor === 'function') ? ctx.verdictFor(chosenIds) : DEFAULT_VERDICT;
      answer = normalizeGateAnswer(card.gate_id, chosenIds, verdict);
    }
  }
  return { renderer: 'text', rendered: rendered, answer: answer };
}

// -----------------------------------------------------------------------
// renderGate -- the single entry point. Dispatches by pickRenderer(ctx.
// capabilities); every rung normalizes its answer to the SAME gate_answer
// shape (SPEC-4 acceptance). Applies the D-04 F.8 binding-card discipline
// BEFORE dispatch: a suppressed binding card never reaches a renderer.
// -----------------------------------------------------------------------
async function renderGate(card, ctx) {
  const normalized = normalizeCard(card);
  const context = (ctx && typeof ctx === 'object') ? ctx : {};

  if (normalized.kind === 'binding' && !shouldFireBindingCard(context.sessionId, normalized.ambiguous)) {
    return { renderer: 'none', card: normalized, rendered: null, answer: null, suppressed: true };
  }

  const renderer = pickRenderer(context.capabilities);
  let result;
  if (renderer === 'elicitation') {
    // Phase 289 review WR-03: a recognized non-Claude host that declares
    // elicitation keeps rung (a) (D-02), but a 2026 HTTP client can still make
    // elicitInput throw on that protocol revision (see the header comment on
    // detectGateCapabilities). A throw must not turn a mintable gate into
    // render_failed or a failed tool call: fall through to the card rung
    // (rung b), which needs no client round trip, and record why on the
    // rendered result. The gate stays answerable through gate_answer.
    try {
      result = await renderViaElicitation(normalized, context);
    } catch (e) {
      const reason = 'elicitation_threw: ' + String((e && e.message) || e).slice(0, 120);
      result = await renderViaAskUserQuestion(normalized, context);
      result.elicit_fallback = reason;
      if (result.rendered && typeof result.rendered === 'object') result.rendered.elicit_fallback = reason;
    }
  } else if (renderer === 'askuserquestion') {
    result = await renderViaAskUserQuestion(normalized, context);
  } else {
    result = await renderViaText(normalized, context);
  }
  return Object.assign({ card: normalized, suppressed: false }, result);
}

module.exports = {
  SUPERSET_SCHEMA: SUPERSET_SCHEMA,
  pickRenderer: pickRenderer,
  detectGateCapabilities: detectGateCapabilities,
  CLAUDE_HOST_SURFACES: CLAUDE_HOST_SURFACES,
  renderGate: renderGate,
  normalizeCard: normalizeCard,
  // normalizeGateAnswer is the shared normalization every rung (and the
  // gate_answer MCP tool, lib/mcp/tools/gate.cjs) funnels through -- the
  // { gate_id, chosen, verdict } shape gate_answer ratifies.
  normalizeGateAnswer: normalizeGateAnswer,
  // validateChosenAgainstCard is the public contract 238-03 (gate.cjs) and
  // 238-04 (chain.cjs) call to reject an out-of-card gate_answer before
  // ratification (GATE-01 G-2).
  validateChosenAgainstCard: validateChosenAgainstCard,
  // checkVerdictAgainstApproving is the pre-consume verdict/chosen coherence
  // check gate_answer and chain_run's resume both run (289 review CR-01).
  checkVerdictAgainstApproving: checkVerdictAgainstApproving,
  shouldFireBindingCard: shouldFireBindingCard,
  _resetBindingFiredForTest: _resetBindingFiredForTest,
  _internal: {
    renderViaElicitation: renderViaElicitation,
    renderViaAskUserQuestion: renderViaAskUserQuestion,
    renderViaText: renderViaText,
    buildElicitRequestedSchema: buildElicitRequestedSchema,
    extractElicitChoice: extractElicitChoice,
    parseTextReply: parseTextReply,
  },
};
