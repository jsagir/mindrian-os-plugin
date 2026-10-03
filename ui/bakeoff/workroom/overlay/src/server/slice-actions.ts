/*
 * slice-actions.ts -- the D-05 vertical slice's action layer (candidate A).
 *
 * Every read and write the slice makes is one of the six actions below,
 * declared with defineShellAction and carrying an exposure (D-15). The bodies
 * reach a room only through the ui/shared MCP session pool (D-06). The names
 * and exposures are the same constant the agent-native candidate's test pins:
 *
 *   listRooms        both    room_list
 *   openRoom         human   room_bind
 *   readArtifact     both    room_artifact
 *   listEvidence     both    room_changes (snapshot of the nodes collection)
 *   proposeDecision  agent   a ProposalSource, then gate_render on the HUMAN
 *                            browser session so the person's button can answer
 *   approveDecision  human   gate_answer on the same session
 *
 * Authorship rule (D-14, D-15): the proposal is made by an agent-exposed
 * action and ONLY a human-originated call answers the gate. The verdict is
 * derived here from the option the person chose, never supplied by the caller.
 *
 * Canon Part 8: only local room ids, option text and the person's own question
 * pass through; nothing here calls a Brain or any host but the daemon.
 */
import { z } from 'zod';
import { createActionRegistry, defineShellAction } from 'mos-ui-shared/actions';
import type { ShellAction } from 'mos-ui-shared/actions';
import { ProposalSchema } from 'mos-ui-shared/proposal';
import type { ProposalSource } from 'mos-ui-shared/proposal';
import type { CallResult } from 'mos-ui-shared/mcp-session-pool';
import { gateAnswer, gateRender, roomBind, roomList } from 'mos-ui-shared/generated/mcp-adapter';
import type { CallTool } from 'mos-ui-shared/generated/mcp-adapter';
import { forgetGate, recordGate, shared, takeGate } from './pool';
import { makeProposalSource } from './proposal-source';
import { callFor, snapshotNodes } from './snapshot';

export type ActionContext = { principal: 'human' | 'agent'; sessionKey: string };

function ctxOf(context: unknown): ActionContext {
  const c = context as Partial<ActionContext> | undefined;
  if (!c || typeof c.sessionKey !== 'string' || c.sessionKey.length === 0) {
    throw new Error('action context needs a sessionKey');
  }
  return { principal: c.principal === 'agent' ? 'agent' : 'human', sessionKey: c.sessionKey };
}

async function run(sessionKey: string, wrapper: (call: CallTool) => Promise<unknown>): Promise<CallResult> {
  return (await wrapper(callFor(sessionKey))) as CallResult;
}

// The verdict is a function of the chosen option id: approve and reject map to
// themselves, anything else (hold, defer, more evidence) is a defer.
export function verdictFor(optionId: string): 'approve' | 'reject' | 'defer' {
  if (optionId === 'approve') return 'approve';
  if (optionId === 'reject') return 'reject';
  return 'defer';
}

const listRooms = defineShellAction({
  name: 'listRooms',
  exposure: 'both',
  input: z.object({}),
  run: async (_input, context) => {
    const { sessionKey } = ctxOf(context);
    const res = await run(sessionKey, (call) => roomList(call, {}));
    const d = res.data as { rooms?: unknown } | null;
    const rooms = d && Array.isArray(d.rooms) ? d.rooms.filter((r): r is string => typeof r === 'string') : [];
    return { ok: !res.isError, rooms };
  },
});

const openRoom = defineShellAction({
  name: 'openRoom',
  exposure: 'human',
  input: z.object({ roomSlug: z.string().min(1).max(200) }),
  run: async (input, context) => {
    const { sessionKey } = ctxOf(context);
    const { roomSlug } = input as { roomSlug: string };
    const res = await run(sessionKey, (call) => roomBind(call, { room: roomSlug }));
    const d = res.data as { effective?: boolean } | null;
    const effective = !res.isError && !!d && d.effective === true;
    if (effective) shared().openRooms.set(sessionKey, roomSlug);
    return { ok: effective, room: roomSlug, reconnected: res.reconnected };
  },
});

const readArtifact = defineShellAction({
  name: 'readArtifact',
  exposure: 'both',
  input: z.object({ path: z.string().min(1).max(400) }),
  run: async (input, context) => {
    const { sessionKey } = ctxOf(context);
    const { path } = input as { path: string };
    // room_artifact is plan 13's tool: not in the generated adapter until that
    // plan regenerates it, so the call goes through the pool by name.
    const res = (await callFor(sessionKey)('room_artifact', { path })) as CallResult;
    const d = res.data as { ok?: boolean; reason?: string; markdown?: string; truncated?: boolean; bytes?: number } | null;
    if (res.isError || !d || d.ok === false) {
      const reason = d && typeof d.reason === 'string' ? d.reason : /unknown tool|not found|-32601|-32602/i.test(res.text) ? 'artifact_tool_unavailable' : 'read_failed';
      return { ok: false, reason };
    }
    return { ok: true, path, markdown: String(d.markdown || ''), truncated: d.truncated === true, bytes: d.bytes ?? null };
  },
});

const listEvidence = defineShellAction({
  name: 'listEvidence',
  exposure: 'both',
  input: z.object({}),
  run: async (_input, context) => {
    const { sessionKey } = ctxOf(context);
    return snapshotNodes(sessionKey);
  },
});

const proposeDecision = defineShellAction({
  name: 'proposeDecision',
  exposure: 'agent',
  input: z.object({
    roomSlug: z.string().min(1).max(200),
    selectedNodeId: z.string().min(1).max(200),
    question: z.string().min(1).max(600),
  }),
  run: async (input, context) => {
    const { sessionKey } = ctxOf(context);
    const req = input as { roomSlug: string; selectedNodeId: string; question: string };
    const source: ProposalSource = await makeProposalSource({ sessionKey });
    const proposal = ProposalSchema.parse(await source.propose(req));
    const options = proposal.verdict_options.map((o, i) => ({
      id: o.id,
      label: o.label,
      description: o.description,
      // The recommended option ranks first; the rest keep the source's order.
      rank: o.id === proposal.recommended_id ? 1 : i + 2,
    }));
    // The gate is minted on the HUMAN browser session, so the person's button
    // is the only thing that can answer it (the daemon refuses any other).
    const res = await run(sessionKey, (call) =>
      gateRender(call, {
        header: req.question,
        kind: 'general',
        select_mode: 'single',
        options,
        subject_node_id: proposal.subject_node_id,
        evidence_node_ids: proposal.evidence_node_ids,
      }),
    );
    const d = res.data as { ok?: boolean; gate_id?: string; renderer?: string; rendered?: unknown; reason?: string } | null;
    if (res.isError || !d || d.ok !== true || typeof d.gate_id !== 'string') {
      return { ok: false, reason: (d && d.reason) || 'gate_render_failed', detail: res.text.slice(0, 300) };
    }
    recordGate(sessionKey, d.gate_id, {
      roomSlug: req.roomSlug,
      optionIds: proposal.verdict_options.map((o) => o.id),
      recommendedId: proposal.recommended_id,
      subjectNodeId: proposal.subject_node_id,
    });
    return {
      ok: true,
      gate_id: d.gate_id,
      renderer: d.renderer || null,
      rendered: d.rendered === undefined ? null : d.rendered,
      options,
      recommended_id: proposal.recommended_id,
      rationale: proposal.rationale,
      subject_node_id: proposal.subject_node_id,
      evidence_node_ids: proposal.evidence_node_ids,
    };
  },
});

const approveDecision = defineShellAction({
  name: 'approveDecision',
  exposure: 'human',
  input: z.object({ gateId: z.string().min(1).max(200), chosen: z.string().min(1).max(100) }),
  run: async (input, context) => {
    const { sessionKey } = ctxOf(context);
    const { gateId, chosen } = input as { gateId: string; chosen: string };
    const rec = takeGate(sessionKey, gateId);
    if (!rec) return { ok: false, reason: 'unknown_gate' };
    if (!rec.optionIds.includes(chosen)) return { ok: false, reason: 'chosen_not_in_card_options' };
    const verdict = verdictFor(chosen);
    const res = await run(sessionKey, (call) => gateAnswer(call, { gate_id: gateId, chosen: [chosen], verdict }));
    const d = res.data as { ok?: boolean; ratified?: boolean; reason?: string } | null;
    // The daemon's answer is returned as the server gave it (recorded or refused).
    if (!res.isError && d && d.ok === true) forgetGate(sessionKey, gateId);
    return { ok: !res.isError && !!d && d.ok === true, verdict, answer: d, reconnected: res.reconnected };
  },
});

// The name-to-exposure map this file declares; tests/test-369-bakeoff-workroom.cjs
// pins it against the same constant the agent-native candidate pins.
export const SLICE_ACTIONS: ShellAction[] = [listRooms, openRoom, readArtifact, listEvidence, proposeDecision, approveDecision];

type RegistryHolder = { registry: ReturnType<typeof createActionRegistry> };
const g = globalThis as unknown as { __mosBakeoffARegistry?: RegistryHolder };

function registry(): ReturnType<typeof createActionRegistry> {
  if (!g.__mosBakeoffARegistry) {
    const r = createActionRegistry();
    for (const a of SLICE_ACTIONS) r.register(a);
    r.assertAllDeclared();
    g.__mosBakeoffARegistry = { registry: r };
  }
  return g.__mosBakeoffARegistry.registry;
}

export type InvokeResult = { status: number; body: unknown };

// The one entry for HTTP routes. The principal comes ONLY from the caller's
// context (the route decides: a browser request is human, the ask route's
// in-process proposal call is agent); any `principal` key in the input is
// deleted before validation, so a body cannot claim to be a human or an agent.
export async function invoke(name: string, rawInput: unknown, context: ActionContext): Promise<InvokeResult> {
  const reg = registry();
  const action = reg.get(name);
  if (!action) return { status: 404, body: { ok: false, reason: 'unknown_action' } };
  if (!reg.callableBy(context.principal).some((a) => a.name === name)) {
    return { status: 403, body: { ok: false, reason: context.principal === 'human' ? 'agent_only' : 'human_only' } };
  }
  const input: Record<string, unknown> = rawInput && typeof rawInput === 'object' ? { ...(rawInput as Record<string, unknown>) } : {};
  delete input.principal;
  const parsed = action.input.safeParse(input) as { success: boolean; data?: unknown };
  if (!parsed.success) return { status: 400, body: { ok: false, reason: 'bad_input' } };
  try {
    return { status: 200, body: await action.run(parsed.data, context) };
  } catch (err) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : String(err);
    return { status: 502, body: { ok: false, reason: 'action_failed', detail: message.slice(0, 300) } };
  }
}
