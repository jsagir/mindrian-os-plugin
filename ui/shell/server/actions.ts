/*
 * actions.ts -- the shell's review-and-decision action registry (plan 369-32; D-08, D-14, D-15, D-19).
 *
 * The registered actions are the review-and-decision set and nothing else:
 *   listRooms (both), openRoom (human), roomDoc (both), readArtifact (both), feedChanges (human),
 *   askClaude (human), proposeDecision (agent), readGate (human), listOpenGates (human),
 *   approveDecision (human).
 * The write actions the original deliverable named are NOT registered (D-08 keeps the v1 shell a
 * review surface and D-13 puts every room write behind Claude Code), by name:
 * fileArtifact, reviseClaim, attachEvidence, publishDeliverable. Each registered action composes its MCP calls
 * on the server, so a dropped connection cannot leave half an intention done; authorization lives
 * here and never in React (RESEARCH Pattern 9).
 *
 * Principal (D-15): invoke() takes the principal ONLY from its context argument. The browser route
 * passes 'human'; the in-process agent path (the Claude adapter flow, askClaude's second step)
 * passes 'agent'. A `principal` key inside the input is deleted before validation and never read.
 * An action whose exposure does not include the principal is refused `human_only` (the one refusal
 * word covers both directions: an agent reaching a human action, a browser reaching the agent
 * action; the answer names the action's exposure). The generated 1:1 MCP adapter has no route and
 * no export here: action bodies call it only through the wrappers imported below, on the browser
 * session's own pool key.
 *
 * Canon Part 9: only a person approves. approveDecision is the one action that reaches
 * the gate-answer tool, and the agent-only proposeDecision mints the gate on the BROWSER session's MCP key
 * (never the adapter's own session) so the person's button is the only thing that can answer it.
 * Plan 369-21 (D-15): readGate issues a single-use render nonce bound to that gate and that browser session;
 * approveDecision reserves it before any MCP call, releases it when gate_answer refuses or fails, and burns it
 * only when gate_answer returns ok. The nonce is the proof a browser rendered the gate: session ownership alone
 * only says which session minted it. See human-origin.ts.
 *
 * Plan 369-42 (gaps 1 and 2): the shell lists gates raised ANYWHERE in the bound room (gate_list), raises a MIRROR of
 * one on this browser session's own MCP key when the person opens it (gate_render mirror_of; the page keeps the source
 * id, the mirror's ledger id stays here), reads the room's saved answer for a gate it holds no record of (a restart, a
 * second tab), declares `approving` so an approve naming Hold is refused before any MCP call, and keeps a gate whose
 * lookup failed (replay_lookup_failed) instead of dropping it. The one-issue and one-gateAnswer rules above are unchanged.
 *
 * Framework-free erasable TypeScript.
 */
import { z } from 'zod';
import { roomProposalSource } from 'mos-ui-shared/claude-adapter';
import { createActionRegistry, defineShellAction } from 'mos-ui-shared/actions';
import type { Exposure, ShellAction } from 'mos-ui-shared/actions';
import { gateAnswer, gateList, gateRender, questionRead, roomArtifact, roomList, roomState } from 'mos-ui-shared/generated/mcp-adapter';
import type { CallTool } from 'mos-ui-shared/generated/mcp-adapter';
import type { CallResult } from 'mos-ui-shared/mcp-session-pool';
import { ProposalSchema } from 'mos-ui-shared/proposal';
import type { Proposal, ProposalSource } from 'mos-ui-shared/proposal';
import { getConfig } from './config.ts';
import { getConnectionStates } from './connection-state.ts';
import type { ConnectionStates } from './connection-state.ts';
import { getRelay } from './feed-routes.ts';
import { createNonceStore } from './human-origin.ts';
import type { NonceStore } from './human-origin.ts';
import { ensureBound, forgetRoom, getPool, onSessionExpired, rememberRoom, sessionFor } from './sessions.ts';
import type { Pool } from './sessions.ts';

export type Principal = 'human' | 'agent';

// Refusals that leave a gate with nothing to answer: the shell drops its record of it (plan 369-27, from 369-26).
const DROPS_THE_GATE = new Set(['unknown_gate', 'gate_expired', 'unknown_or_expired_gate']);

export type InvokeContext = {
  principal: Principal;
  browserSession: { mcpKey: string };
};

export type ActionAnswer = Record<string, unknown>;

export type GateCard = {
  gate_id: string;
  mcp_key: string;
  room: string;
  header: string;
  subject_node_id: string;
  recommended_id: string;
  rationale: string;
  evidence_node_ids: string[];
  options: Array<{ id: string; label: string; description?: string; rank: number; preview?: string }>;
  notice: string | null;
  minted_at: number;
  // Plan 369-27: what the gate view needs to draw the card from the contract (never from zone text).
  kind: string;
  select_mode: 'single' | 'multi';
  // 'claude_code': minted through the agent path (a Claude proposal). 'raised_elsewhere': a gate another session of
  // the room raised, mirrored on this browser session (plan 369-42). The page says so in words.
  proposal_from: 'claude_code' | 'raised_elsewhere';
  // The id the room's gate ledger holds for this browser session (plan 369-42). Equal to gate_id for a gate this
  // session minted; the MIRROR's own id for a raised gate. Server only: publicGate strips it.
  mcp_gate_id: string;
  // The raised gate this card mirrors (the page-facing id), or null for a gate this session minted.
  source_gate_id: string | null;
  // Option ids that mean yes (declared to gate_render, or copied from the room's record); empty when none declared.
  approving: string[];
  // false when the room relabelled the approve option because the claim is below the room's floor; null when unknown.
  floor_met: boolean | null;
  // The rendered contract's own fields (gate_render's `rendered.contract`): the shared superset and the recommended id.
  rendered: { contract: { superset_options: unknown[]; recommended: string | null; multiSelect: boolean; notice?: string } };
};

// What a person was shown the answer to: kept after an answer so a lost response can be confirmed by gate id.
export type AnsweredGate = { gate_id: string; verdict: 'approve' | 'reject' | 'defer'; chosen: string[]; gate: PublicGate | null };

// The card as the page may see it: the server's own session key stays on the server.
export type PublicGate = Omit<GateCard, 'mcp_key' | 'mcp_gate_id'>;

function publicGate(card: GateCard): PublicGate {
  const { mcp_key: _key, mcp_gate_id: _ledgerId, ...rest } = card;
  return { ...rest, options: card.options.map((o) => ({ ...o })), evidence_node_ids: card.evidence_node_ids.slice(), approving: card.approving.slice() };
}

export const ACTION_NAMES = [
  'listRooms',
  'openRoom',
  'roomDoc',
  'readArtifact',
  'feedChanges',
  'askClaude',
  'proposeDecision',
  'readGate',
  'listOpenGates',
  'approveDecision',
] as const;

const FEED_COLLECTIONS = ['nodes', 'relations', 'artifacts', 'decisions', 'activity'] as const;

type Relay = { pageChanges: (sessionKey: string, query: Record<string, unknown>) => Promise<Record<string, unknown>> };

export type ShellActionDeps = {
  pool: Pool;
  proposalSource: ProposalSource;
  relay: Relay;
  connection?: ConnectionStates;
  // The render-nonce store (plan 369-21). One per actions registry unless a caller supplies its own.
  nonces?: NonceStore;
};

function asRec(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function messageOf(err: unknown): string {
  return err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : String(err);
}

// Replace every value equal to `from` with `to`, at any depth (keys are left alone). The mirror's ledger id is the
// daemon's id for a gate the page knows under the source id: an answer the room gives about it is told in the page's id.
function scrubId(v: unknown, from: string, to: string): unknown {
  if (v === from) return to;
  if (Array.isArray(v)) return v.map((x) => scrubId(x, from, to));
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = scrubId(x, from, to);
    return out;
  }
  return v;
}

type CardOption = { id: string; label: string; description?: string; rank: number; preview?: string };

// What gate_render answered ({ ok, gate_id, renderer, rendered }) -> the card's options, notice, floor flag and contract.
// `sent` is what the shell sent: the fallback when the answer carries no superset, and the label the floor check compares.
function readRendered(data: Record<string, unknown>, sent: CardOption[]): {
  options: CardOption[];
  notice: string | null;
  floorMet: boolean | null;
  rendered: GateCard['rendered'];
} {
  const rendered = asRec(data.rendered);
  const contract = rendered ? asRec(rendered.contract) : null;
  const served = contract && Array.isArray(contract.superset_options) ? (contract.superset_options as unknown[]) : null;
  const cardOptions: CardOption[] = served
    ? served
        .map(asRec)
        .filter((o): o is Record<string, unknown> => o !== null && typeof o.id === 'string')
        .map((o) => {
          const out: CardOption = { id: o.id as string, label: str(o.label), rank: typeof o.rank === 'number' ? o.rank : 0 };
          if (typeof o.description === 'string' && o.description) out.description = o.description;
          if (typeof o.preview === 'string' && o.preview) out.preview = o.preview;
          return out;
        })
    : sent;
  // The room relabels the approve option when the claim is below its floor: a label that is not the one sent says so.
  const sentApprove = sent.find((o) => o.id === 'approve');
  const servedApprove = cardOptions.find((o) => o.id === 'approve');
  const floorMet: boolean | null = sentApprove && servedApprove && servedApprove.label !== sentApprove.label ? false : null;
  const notice = contract && typeof contract.notice === 'string' ? contract.notice : null;
  return {
    options: cardOptions.length > 0 ? cardOptions : sent,
    notice,
    floorMet,
    rendered: {
      contract: {
        superset_options: served ?? [],
        recommended: contract && typeof contract.recommended === 'string' ? contract.recommended : null,
        multiSelect: false,
        ...(notice !== null ? { notice } : {}),
      },
    },
  };
}

// What room_state status returns is the room's STATE.md as markdown: a heading, a purpose
// paragraph and a "Local graph: N nodes, M edges." line. Read only those three things.
export function parseStatusText(text: string): { title: string; purpose: string; counts: Record<string, number> } {
  const head = text.split('\n\n## Suggested Next')[0] ?? text;
  const heading = head.split('\n').find((l) => l.startsWith('# '));
  const paragraphs = head
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('#') && !/^Local graph:/i.test(p));
  const m = /Local graph:\s*(\d+)\s+nodes?,\s*(\d+)\s+edges?/i.exec(head);
  return {
    title: heading ? heading.slice(2).trim() : '',
    purpose: (paragraphs[0] ?? '').replace(/\s+/g, ' ').slice(0, 600),
    counts: m ? { nodes: Number(m[1]), edges: Number(m[2]) } : {},
  };
}

const PROPOSAL_REASONS = ['invalid_request', 'room_unavailable', 'no_proposal', 'proposal_invalid'];

export function createShellActions(deps: ShellActionDeps) {
  const { pool, proposalSource, relay, connection } = deps;
  const nonces: NonceStore = deps.nonces ?? createNonceStore();
  const registry = createActionRegistry();

  // Gate records, per browser session (pool key), per gate id. A gate is minted on the browser
  // session's MCP session, so only that session can answer it; the record carries the room it was
  // minted in. `abandoned` holds the gates a confirmed room switch left behind (gate id -> room).
  const gates = new Map<string, Map<string, GateCard>>();
  const abandoned = new Map<string, Map<string, string>>();
  // Gates the room confirmed answered on this browser session (ok:true). readGate says so for such an id, which is how
  // the page confirms an answer whose response was lost (plan 369-27): the record is the room's own ok, never a guess.
  const answered = new Map<string, Map<string, AnsweredGate>>();

  function answeredOf(key: string): Map<string, AnsweredGate> {
    let m = answered.get(key);
    if (!m) {
      m = new Map();
      answered.set(key, m);
    }
    return m;
  }

  function gatesOf(key: string): Map<string, GateCard> {
    let m = gates.get(key);
    if (!m) {
      m = new Map();
      gates.set(key, m);
    }
    return m;
  }

  function abandonedOf(key: string): Map<string, string> {
    let m = abandoned.get(key);
    if (!m) {
      m = new Map();
      abandoned.set(key, m);
    }
    return m;
  }

  // The pool re-connected this browser session's MCP session (daemon restart or idle expiry): gate
  // ids minted on the old session are gone, so the records are too.
  function sessionRestarted(key: string): void {
    gates.delete(key);
    abandoned.delete(key);
    answered.delete(key);
    nonces.forgetSession(key);
  }

  async function ack(key: string): Promise<void> {
    if (!connection) return;
    const entry = await pool.get(key);
    connection.recordAck(key, { mcpSessionId: entry.mcpSessionId ?? null, roomSlug: entry.boundRoom });
  }

  async function boundRoomOf(key: string): Promise<string | null> {
    const entry = await pool.get(key);
    return entry.boundRoom;
  }

  // Every MCP call an action makes goes through here: the browser session's own pool key, the room
  // restored if the session came back unbound, gate records dropped on a reconnect, and the
  // connection state told about the acknowledged round trip. A throw (no daemon) propagates to invoke(),
  // which records the failed round trip once.
  async function via(key: string, f: (call: CallTool) => Promise<unknown>): Promise<CallResult> {
    await ensureBound(pool, key);
    const res = (await f((tool, args) => pool.call(key, tool, args))) as CallResult;
    if (res.reconnected) sessionRestarted(key);
    await ack(key);
    return res;
  }

  function define<T>(
    name: (typeof ACTION_NAMES)[number],
    exposure: Exposure,
    schema: z.ZodType<T>,
    run: (input: T, key: string, ctx: InvokeContext) => Promise<ActionAnswer>,
  ): void {
    registry.register(
      defineShellAction({
        name,
        exposure,
        input: schema,
        run: (input: unknown, context?: unknown) => {
          const ctx = context as InvokeContext;
          return run(input as T, sessionFor(ctx.browserSession), ctx);
        },
      }),
    );
  }

  // ---- reading: rooms, the room document, one artifact, the change feed ----

  define('listRooms', 'both', z.object({}), async (_input, key) => {
    const res = await via(key, (call) => roomList(call, {}));
    const data = asRec(res.data);
    if (res.isError || !data || !Array.isArray(data.rooms)) return { ok: false, reason: 'rooms_unavailable' };
    const rooms = (data.rooms as unknown[]).filter((r): r is string => typeof r === 'string').map((slug) => ({ slug }));
    return { ok: true, rooms, current: await boundRoomOf(key) };
  });

  // D-19 and bake-off transplant 1: the room is bound through the pool's bind(), which records the
  // bound room so the pool re-binds it after a daemon restart.
  define('openRoom', 'human', z.object({ room: z.string().min(1).max(200), confirmLeave: z.boolean().optional() }), async (input, key) => {
    const mine = gatesOf(key);
    const elsewhere = Array.from(mine.values()).filter((g) => g.room !== input.room);
    if (elsewhere.length > 0 && input.confirmLeave !== true) {
      return { ok: false, reason: 'gate_open', gate_id: elsewhere[0]!.gate_id, room: elsewhere[0]!.room };
    }
    const res = await pool.bind(key, input.room);
    if (res.reconnected) sessionRestarted(key);
    await ack(key);
    const data = asRec(res.data);
    if (res.isError || !data || data.ok !== true || data.effective !== true) {
      return { ok: false, reason: 'room_unavailable', detail: str(data && data.message).slice(0, 200) || undefined };
    }
    rememberRoom(key, input.room);
    if (elsewhere.length > 0) {
      // The person confirmed leaving: the other room's open decisions close. Their ids stay refused.
      const left = abandonedOf(key);
      for (const g of elsewhere) {
        left.set(g.gate_id, g.room);
        mine.delete(g.gate_id);
      }
    }
    return { ok: true, room: input.room };
  });

  define('roomDoc', 'both', z.object({}), async (_input, key) => {
    const slug = await boundRoomOf(key);
    if (!slug) return { ok: false, reason: 'room_unbound' };
    const status = await via(key, (call) => roomState(call, { command: 'status' }));
    if (status.isError) return { ok: false, reason: 'room_unavailable' };
    const parsed = parseStatusText(status.text);
    const q = await via(key, (call) => questionRead(call, {}));
    const qd = asRec(q.data);
    const rendered = qd ? asRec(qd.rendered) : null;
    const question = rendered ? str(rendered.question) : '';
    return {
      ok: true,
      room: {
        id: 'room',
        slug,
        title: parsed.title || slug,
        purpose: parsed.purpose,
        question,
        has_question: !!qd && qd.current !== null && qd.current !== undefined,
        counts: parsed.counts,
      },
    };
  });

  define('readArtifact', 'both', z.object({ path: z.string().min(1).max(500), max_bytes: z.number().int().min(1024).max(2097152).optional() }), async (input, key) => {
    const args: { path: string; max_bytes?: number } = { path: input.path };
    if (input.max_bytes !== undefined) args.max_bytes = input.max_bytes;
    const res = await via(key, (call) => roomArtifact(call, args));
    const data = asRec(res.data);
    if (!data) return { ok: false, reason: 'artifact_unavailable' };
    return data;
  });

  define(
    'feedChanges',
    'human',
    z.object({
      collection: z.enum(FEED_COLLECTIONS),
      after: z.union([z.number().int().min(0), z.string().max(200), z.null()]).optional(),
      epoch: z.union([z.string().max(200), z.null()]).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      mode: z.enum(['delta', 'snapshot']).optional(),
      snapshot_cursor: z.string().max(2000).optional(),
    }),
    async (input, key) => {
      await ensureBound(pool, key);
      const query: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) if (v !== undefined) query[k] = v;
      const page = await relay.pageChanges(key, query);
      if (page && page.ok !== false) await ack(key);
      // The relay turns a dead connection into feed_error instead of throwing: that is a failed round trip.
      else if (page && page.reason === 'feed_error' && connection) connection.recordFailure(key);
      return page;
    },
  );

  // ---- the decision loop: ask, propose, read the card, approve ----

  // D-14: run the ProposalSource, then mint the gate on THIS browser session through the in-process
  // AGENT path. The adapter behind the source reads on its own MCP session and never touches ours.
  define('askClaude', 'human', z.object({ selectedNodeId: z.string().min(1).max(200), question: z.string().min(1).max(1000) }), async (input, key, ctx) => {
    const roomSlug = await boundRoomOf(key);
    if (!roomSlug) return { ok: false, reason: 'room_unbound' };
    let proposal: Proposal;
    try {
      proposal = await proposalSource.propose({ roomSlug, selectedNodeId: input.selectedNodeId, question: input.question });
    } catch (err) {
      const msg = messageOf(err);
      const m = /^(\w+)(?::\s*([\s\S]*))?$/.exec(msg);
      const reason = m && PROPOSAL_REASONS.includes(m[1]!) ? m[1]! : 'proposal_failed';
      return { ok: false, reason, detail: (m && m[2] ? m[2] : msg).slice(0, 300) };
    }
    return invoke('proposeDecision', { proposal }, { principal: 'agent', browserSession: ctx.browserSession });
  });

  define('proposeDecision', 'agent', z.object({ proposal: ProposalSchema }), async (input, key) => {
    const proposal = input.proposal;
    const room = await boundRoomOf(key);
    if (!room) return { ok: false, reason: 'room_unbound' };
    // The recommended option is ranked first; the rest keep the proposal's order.
    const ordered = [
      ...proposal.verdict_options.filter((o) => o.id === proposal.recommended_id),
      ...proposal.verdict_options.filter((o) => o.id !== proposal.recommended_id),
    ];
    const options = ordered.map((o, i) => {
      const out: { id: string; label: string; description?: string; rank: number } = { id: o.id, label: o.label, rank: i + 1 };
      if (o.description) out.description = o.description;
      return out;
    });
    const header = ('Decision on ' + proposal.subject_node_id).slice(0, 200);
    // Plan 369-42 (WR-03): the shell declares which option ids mean yes, so the room itself refuses an approve that
    // names Hold (and a reject that names approve) instead of relying on the page to send the right verdict.
    const approving = ['approve'];
    const res = await via(key, (call) =>
      gateRender(call, {
        header,
        kind: 'general',
        select_mode: 'single',
        options,
        approving,
        subject_node_id: proposal.subject_node_id,
        evidence_node_ids: proposal.evidence_node_ids,
      }),
    );
    const data = asRec(res.data);
    if (res.isError || !data || data.ok !== true || typeof data.gate_id !== 'string') {
      return { ok: false, reason: 'gate_render_failed', detail: res.text.slice(0, 300) };
    }
    // gate_render answers { ok, gate_id, renderer, rendered }: the shared contract is at rendered.contract.
    const read = readRendered(data, options);
    // The minted gate is recorded against THIS browser session and the room it was minted in.
    const card: GateCard = {
      gate_id: data.gate_id,
      mcp_key: key,
      mcp_gate_id: data.gate_id,
      source_gate_id: null,
      approving: approving.slice(),
      room,
      header,
      subject_node_id: proposal.subject_node_id,
      recommended_id: proposal.recommended_id,
      rationale: proposal.rationale,
      evidence_node_ids: proposal.evidence_node_ids,
      options: read.options,
      notice: read.notice,
      minted_at: Date.now(),
      kind: 'general',
      select_mode: 'single',
      proposal_from: 'claude_code',
      floor_met: read.floorMet,
      rendered: read.rendered,
    };
    gatesOf(key).set(card.gate_id, card);
    return { ok: true, gate_id: card.gate_id, room, subject_node_id: card.subject_node_id, recommended_id: card.recommended_id };
  });

  // ---- gates raised elsewhere (plan 369-42) ----

  type Opened = { card: GateCard } | { answer: ActionAnswer };
  const opening = new Map<string, Promise<Opened>>();

  // The room's own state for one gate, read through gate_list on this browser session's key.
  async function lookupGate(key: string, id: string): Promise<{ failed: true } | { failed: false; state: string; contract: Record<string, unknown> | null; answered: Record<string, unknown> | null; room: string }> {
    let res: CallResult;
    try {
      res = await via(key, (call) => gateList(call, { gate_id: id }));
    } catch {
      // The daemon could not be asked: not "no such gate". The page keeps what it has and offers a retry (REV369-06).
      if (connection) connection.recordFailure(key);
      return { failed: true };
    }
    const data = asRec(res.data);
    const gate = data ? asRec(data.gate) : null;
    if (!data || data.ok !== true || !gate) {
      // Nothing is bound, so nothing in reach can be answered here; every other refusal (lookup_failed) is retryable.
      if (data && data.reason === 'room_unbound') return { failed: false, state: 'unknown', contract: null, answered: null, room: '' };
      return { failed: true };
    }
    return { failed: false, state: str(gate.state), contract: asRec(gate.contract), answered: asRec(gate.answered), room: str(data.room) };
  }

  // Open a gate this session holds no card for: ask the room, then mirror it (open), or say what became of it.
  async function openElsewhere(key: string, id: string): Promise<Opened> {
    const held = gatesOf(key).get(id);
    if (held) return { card: held };
    const looked = await lookupGate(key, id);
    if (looked.failed) return { answer: { ok: false, reason: 'replay_lookup_failed', gate_id: id } };
    if (looked.state === 'answered' && looked.answered) {
      const chosen = Array.isArray(looked.answered.chosen) ? (looked.answered.chosen as unknown[]).filter((c): c is string => typeof c === 'string') : [];
      const verdict = str(looked.answered.verdict) as AnsweredGate['verdict'];
      return { answer: { ok: true, answered: { gate_id: id, verdict, chosen }, gate: null } };
    }
    if (looked.state === 'expired') return { answer: { ok: false, reason: 'gate_expired', gate_id: id } };
    const record = looked.contract;
    if (looked.state !== 'open' || !record) return { answer: { ok: false, reason: 'unknown_gate', gate_id: id } };

    const room = (await boundRoomOf(key)) ?? looked.room;
    const recorded = (Array.isArray(record.options) ? record.options : []).map(asRec).filter((o): o is Record<string, unknown> => o !== null && typeof o.id === 'string');
    // The options are repeated as recorded (ids in order): that is how gate_render knows the shell is looking at the record.
    const sent: CardOption[] = recorded.map((o, i) => {
      const out: CardOption = { id: o.id as string, label: str(o.label) || (o.id as string), rank: typeof o.rank === 'number' ? o.rank : i + 1 };
      if (typeof o.description === 'string' && o.description) out.description = o.description;
      if (typeof o.preview === 'string' && o.preview) out.preview = o.preview;
      return out;
    });
    const sourceKind = str(record.kind) || 'general';
    const kind = sourceKind === 'material_step' || sourceKind === 'binding' ? 'general' : sourceKind;
    const selectMode: 'single' | 'multi' = record.select_mode === 'multi' ? 'multi' : 'single';
    const approving = Array.isArray(record.approving) ? (record.approving as unknown[]).filter((a): a is string => typeof a === 'string') : [];
    const evidence = Array.isArray(record.evidence_node_ids) ? (record.evidence_node_ids as unknown[]).filter((e): e is string => typeof e === 'string') : [];
    const args: Parameters<typeof gateRender>[1] = { options: sent, kind, select_mode: selectMode, evidence_node_ids: evidence, mirror_of: id };
    if (str(record.header)) args.header = str(record.header);
    if (str(record.subject_node_id)) args.subject_node_id = str(record.subject_node_id);
    if (approving.length > 0) args.approving = approving;
    let res: CallResult;
    try {
      res = await via(key, (call) => gateRender(call, args));
    } catch {
      if (connection) connection.recordFailure(key);
      return { answer: { ok: false, reason: 'replay_lookup_failed', gate_id: id } };
    }
    const data = asRec(res.data);
    if (!data || data.ok !== true || typeof data.gate_id !== 'string') {
      const reason = data ? str(data.reason) : '';
      if (reason === 'mirror_source_answered') {
        const chosen = Array.isArray(data!.chosen) ? (data!.chosen as unknown[]).filter((c): c is string => typeof c === 'string') : [];
        return { answer: { ok: true, answered: { gate_id: id, verdict: str(data!.verdict) as AnsweredGate['verdict'], chosen }, gate: null } };
      }
      if (reason === 'gate_expired' || reason === 'unknown_gate') return { answer: { ok: false, reason, gate_id: id } };
      if (reason === 'lookup_failed' || !data) return { answer: { ok: false, reason: 'replay_lookup_failed', gate_id: id } };
      return { answer: { ok: false, reason: 'gate_render_failed', detail: (reason || res.text).slice(0, 300), gate_id: id } };
    }
    const read = readRendered(data, sent);
    const recommended = str(record.recommended) || read.rendered.contract.recommended || '';
    const card: GateCard = {
      gate_id: id,
      mcp_key: key,
      mcp_gate_id: data.gate_id,
      source_gate_id: id,
      approving,
      room,
      header: str(record.header),
      subject_node_id: str(record.subject_node_id),
      recommended_id: recommended,
      rationale: '',
      evidence_node_ids: evidence,
      options: read.options,
      notice: read.notice,
      minted_at: typeof record.minted_at === 'number' ? record.minted_at : Date.now(),
      kind,
      select_mode: selectMode,
      proposal_from: 'raised_elsewhere',
      floor_met: read.floorMet,
      rendered: { contract: { ...read.rendered.contract, multiSelect: selectMode === 'multi' } },
    };
    gatesOf(key).set(id, card);
    return { card };
  }

  define('readGate', 'human', z.object({ gate_id: z.string().min(1).max(200) }), async (input, key) => {
    let card = gatesOf(key).get(input.gate_id);
    if (!card) {
      const left = abandonedOf(key).get(input.gate_id);
      if (left) return { ok: false, reason: 'room_switched', room: left };
      // A gate the room already confirmed answered: say so and issue no nonce (there is nothing left to answer).
      const done = answeredOf(key).get(input.gate_id);
      if (done) return { ok: true, answered: { gate_id: done.gate_id, verdict: done.verdict, chosen: done.chosen.slice() }, gate: done.gate };
      // Plan 369-42: not a gate this session holds (a restart, another tab, a gate Larry raised): ask the room. One
      // mirror per session and source, even when two reads arrive together.
      const flightKey = key + '\n' + input.gate_id;
      let flight = opening.get(flightKey);
      if (!flight) {
        flight = openElsewhere(key, input.gate_id).finally(() => opening.delete(flightKey));
        opening.set(flightKey, flight);
      }
      const opened = await flight;
      if ('answer' in opened) return opened.answer;
      card = opened.card;
    }
    // D-15: the one place a render nonce is issued. readGate is human-only, so the agent path cannot reach it.
    const render_nonce = nonces.issue({ gateId: card.gate_id, browserSessionId: key });
    return { ok: true, gate: publicGate(card), render_nonce };
  });

  define('listOpenGates', 'human', z.object({}), async (_input, key) => {
    const mine = Array.from(gatesOf(key).values());
    const open: Array<Record<string, unknown> & { minted_at: number }> = mine.map((g) => ({
      gate_id: g.gate_id,
      header: g.header,
      room: g.room,
      subject_node_id: g.subject_node_id,
      minted_at: g.minted_at,
      raised_elsewhere: g.source_gate_id !== null,
      evidence_count: g.evidence_node_ids.length,
      rationale: g.rationale,
    }));
    // The gates the room lists as open that this session does not already hold (its own gates are recorded in the room
    // too, and a mirrored one is held under the source id).
    const held = new Set<string>();
    for (const g of mine) {
      held.add(g.gate_id);
      if (g.source_gate_id) held.add(g.source_gate_id);
    }
    let unavailable = false;
    try {
      const res = await via(key, (call) => gateList(call, {}));
      const data = asRec(res.data);
      if (data && data.ok === true && Array.isArray(data.gates)) {
        const room = str(data.room) || (await boundRoomOf(key)) || '';
        for (const raw of data.gates as unknown[]) {
          const g = asRec(raw);
          if (!g || typeof g.gate_id !== 'string' || held.has(g.gate_id)) continue;
          held.add(g.gate_id);
          open.push({
            gate_id: g.gate_id,
            header: str(g.header),
            room,
            subject_node_id: str(g.subject_node_id),
            minted_at: typeof g.minted_at === 'number' ? g.minted_at : 0,
            raised_elsewhere: true,
            evidence_count: Array.isArray(g.evidence_node_ids) ? g.evidence_node_ids.length : 0,
            rationale: '',
          });
        }
      } else if (!(data && data.reason === 'room_unbound')) {
        unavailable = true;
      }
    } catch {
      // The shell's own gates are still there to show; the page is told the room's list could not be read.
      unavailable = true;
      if (connection) connection.recordFailure(key);
    }
    open.sort((a, b) => a.minted_at - b.minted_at);
    return { ok: true, gates: open, waiting: open.length, ...(unavailable ? { raised_unavailable: true } : {}) };
  });

  // The one action that answers a gate. The server's own answer comes back unchanged (recorded,
  // replayed, refused) so the UI renders what the room said.
  define(
    'approveDecision',
    'human',
    z.object({
      gate_id: z.string().min(1).max(200),
      chosen: z.array(z.string().min(1).max(200)).min(1).max(6),
      verdict: z.enum(['approve', 'reject', 'defer']),
      render_nonce: z.string().max(200).optional(),
    }),
    async (input, key) => {
      const left = abandonedOf(key).get(input.gate_id);
      if (left) return { ok: false, reason: 'room_switched', room: left, gate_id: input.gate_id };
      // D-15 check-then-reserve: no MCP call is made unless this browser session was shown this gate
      // (the nonce) and no other submit holds it. A refusal here never reaches gate_answer.
      const reserved = nonces.reserve({ nonce: input.render_nonce, gateId: input.gate_id, browserSessionId: key });
      if (!reserved.ok) return { ok: false, reason: 'human_only', detail: reserved.reason, gate_id: input.gate_id };
      const nonce = input.render_nonce as string;
      let burned = false;
      try {
        const card = gatesOf(key).get(input.gate_id);
        if (card) {
          const bound = await boundRoomOf(key);
          if (bound !== card.room) return { ok: false, reason: 'room_switched', room: card.room, gate_id: input.gate_id };
          // Plan 369-42 (WR-03): the verdict must match the option. An approve names only approving ids; a reject or a
          // defer names none. Refused here, before any MCP call; the nonce goes back (the finally below).
          if (card.approving.length > 0) {
            const yes = new Set(card.approving);
            const mismatch = input.verdict === 'approve' ? input.chosen.some((c) => !yes.has(c)) : input.chosen.some((c) => yes.has(c));
            if (mismatch) return { ok: false, reason: 'verdict_chosen_mismatch', gate_id: input.gate_id, verdict: input.verdict, approving: card.approving.slice() };
          }
        }
        // A mirrored gate is answered under the mirror's own ledger id; the page never sees it (plan 369-42).
        const ledgerId = card ? card.mcp_gate_id : input.gate_id;
        const res = await via(key, (call) => gateAnswer(call, { gate_id: ledgerId, chosen: input.chosen, verdict: input.verdict }));
        const raw = asRec(res.data);
        if (!raw) return { ok: false, reason: 'answer_unreadable', gate_id: input.gate_id };
        const data = ledgerId !== input.gate_id ? (scrubId(raw, ledgerId, input.gate_id) as Record<string, unknown>) : raw;
        // An answered gate, and a gate with nothing left to answer (unknown_gate, gate_expired, the chain tools' older
        // slug), are done. A refused one (stale_subject, room_switched, persistence_failed, session_mismatch, the
        // pre-consume refusals) stays open for the person to retry (Phase 289 and plan 369-26).
        if (data.ok === true || DROPS_THE_GATE.has(str(data.reason))) gatesOf(key).delete(input.gate_id);
        if (data.ok === true) {
          // Another session answered first (through its mirror, or the owner): the room's recorded answer is the one to show.
          const recorded = data.answered_elsewhere === true && typeof data.verdict === 'string' && Array.isArray(data.chosen);
          answeredOf(key).set(input.gate_id, {
            gate_id: input.gate_id,
            verdict: recorded ? (data.verdict as AnsweredGate['verdict']) : input.verdict,
            chosen: recorded ? (data.chosen as unknown[]).filter((c): c is string => typeof c === 'string') : input.chosen.slice(),
            gate: card ? publicGate(card) : null,
          });
        }
        // The nonce is burned only when the room recorded the answer.
        if (data.ok === true) {
          nonces.burn(nonce);
          burned = true;
        }
        return data;
      } finally {
        // A refusal or a failure leaves the gate answerable after a fresh read: back from in flight.
        if (!burned) nonces.release(nonce);
      }
    },
  );

  // The one entry for every action call. The principal comes from the code path (ctx), never the input.
  async function invoke(name: string, input: unknown, ctx: InvokeContext): Promise<ActionAnswer> {
    const action: ShellAction | undefined = registry.get(typeof name === 'string' ? name : '');
    if (!action) return { ok: false, reason: 'unknown_action' };
    const principal = ctx ? ctx.principal : undefined;
    if (principal !== 'human' && principal !== 'agent') return { ok: false, reason: 'principal_required' };
    if (!registry.callableBy(principal).includes(action)) return { ok: false, reason: 'human_only', exposure: action.exposure };

    // A principal key in the input is never read: drop it before validation.
    const clean: Record<string, unknown> = {};
    const given = asRec(input);
    if (given) for (const [k, v] of Object.entries(given)) if (k !== 'principal') clean[k] = v;

    const parsed = action.input.safeParse(clean) as { success: boolean; data?: unknown; error?: { issues?: Array<{ path?: unknown[]; message?: string }> } };
    if (!parsed.success) {
      const issues = (parsed.error && parsed.error.issues ? parsed.error.issues : []).slice(0, 5).map((i) => ({
        path: Array.isArray(i.path) ? i.path.join('.') : '',
        message: String(i.message || ''),
      }));
      return { ok: false, reason: 'bad_input', issues };
    }
    try {
      return (await action.run(parsed.data, { principal, browserSession: ctx.browserSession })) as ActionAnswer;
    } catch (err) {
      if (connection) connection.recordFailure(sessionFor(ctx.browserSession));
      return { ok: false, reason: 'mcp_unavailable', detail: messageOf(err).slice(0, 200) };
    }
  }

  registry.assertAllDeclared();

  return {
    invoke,
    registry,
    names(): string[] {
      return registry.list().map((a) => a.name);
    },
    // The gate record for a browser session (the MCP key it was minted on, the room, the card).
    recordedGate(mcpKey: string, gateId: string): GateCard | null {
      return gates.get(mcpKey)?.get(gateId) ?? null;
    },
    forget(mcpKey: string): void {
      gates.delete(mcpKey);
      abandoned.delete(mcpKey);
      answered.delete(mcpKey);
      nonces.forgetSession(mcpKey);
    },
  };
}

export type ShellActions = ReturnType<typeof createShellActions>;

// When MOS_PROPOSAL_SOURCE is `fixed` the shell carries no fixed proposal of its own (a scripted
// run injects one through createShellActions), so asking Claude answers no_proposal.
function unconfiguredSource(): ProposalSource {
  return {
    async propose(): Promise<Proposal> {
      throw new Error('no_proposal: no fixed proposal is configured; set MOS_PROPOSAL_SOURCE=adapter');
    },
  };
}

const SLOT = Symbol.for('mos.shell.actions');

// One registry per server process: gate records are shared by every route that reaches them.
export function getShellActions(): ShellActions {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[SLOT]) {
    const pool = getPool();
    const config = getConfig();
    const connection = getConnectionStates();
    const proposalSource = config.proposalSource === 'adapter' ? roomProposalSource({ pool }) : unconfiguredSource();
    const actions = createShellActions({ pool, proposalSource, relay: getRelay(), connection });
    onSessionExpired((key) => {
      actions.forget(key);
      connection.forget(key);
      forgetRoom(key);
    });
    g[SLOT] = actions;
  }
  return g[SLOT] as ShellActions;
}

export const MAX_ACTION_BODY_BYTES = 64 * 1024;

// The browser action route's body text -> the action input. The route then calls invoke() itself with
// principal 'human': the principal is decided by the route's code path, never by anything in the body.
export function parseActionBody(bodyText: string): { ok: true; input: unknown } | { ok: false; status: number; body: ActionAnswer } {
  if (Buffer.byteLength(bodyText) > MAX_ACTION_BODY_BYTES) return { ok: false, status: 413, body: { ok: false, reason: 'too_large' } };
  if (bodyText.trim().length === 0) return { ok: true, input: {} };
  try {
    return { ok: true, input: JSON.parse(bodyText) };
  } catch {
    return { ok: false, status: 400, body: { ok: false, reason: 'bad_json' } };
  }
}

// An action answer -> the HTTP status of the route that served it. Refusals the UI renders as a state
// (gate_open, room_switched, a gate refusal) stay 200: they are answers, not transport errors.
export function actionStatus(answer: ActionAnswer): number {
  const reason = answer.ok === false ? answer.reason : null;
  if (reason === 'unknown_action') return 404;
  if (reason === 'human_only' || reason === 'principal_required') return 403;
  if (reason === 'bad_input') return 400;
  if (reason === 'mcp_unavailable') return 502;
  return 200;
}
