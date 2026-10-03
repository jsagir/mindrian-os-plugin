// Candidate B (agent-native): the D-05 vertical slice's six actions, declared
// with ui/shared's defineShellAction (Phase 369 D-06, D-15). Every read and
// write goes through the shared session pool; this file holds no file-system or
// process-spawn module and no outside host. The same six names and exposures as the
// workroom candidate (plan 15), pinned by tests/test-369-bakeoff-agent-native.cjs.
//
// Exposure is the shell's own policy (D-15), declared here. agent-native's
// exposure of an action to ITS agent or ITS MCP is a different thing and is
// closed by actions/*.ts: agentTool false and mcpTool false on every one.
import { z } from "zod";
import { createActionRegistry, defineShellAction } from "mos-ui-shared/actions";
import { ProposalSchema, fixedProposalSource } from "mos-ui-shared/proposal";
import type { ProposalSource } from "mos-ui-shared/proposal";
import { getPool } from "./pool";

export type SliceContext = { sessionKey: string };

const roomSlug = z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/);

export const sliceInputs = {
  listRooms: z.object({}),
  openRoom: z.object({ room: roomSlug }),
  readArtifact: z.object({ path: z.string().min(1).max(400), max_bytes: z.number().int().min(1024).max(2097152).optional() }),
  listEvidence: z.object({ limit: z.number().int().min(1).max(500).optional() }),
  proposeDecision: z.object({
    room: roomSlug,
    selectedNodeId: z.string().min(1).max(200),
    question: z.string().min(1).max(300),
  }),
  approveDecision: z.object({
    gate_id: z.string().min(4).max(96),
    chosen: z.string().min(1).max(100),
    verdict: z.enum(["approve", "reject", "defer"]),
  }),
};

function ctxOf(context: unknown): SliceContext {
  const c = context as SliceContext | undefined;
  if (!c || typeof c.sessionKey !== "string" || c.sessionKey.length === 0) {
    throw new Error("slice action called without a browser session");
  }
  return c;
}

// The proposal source, by env, exactly as candidate A: `fixed` is the
// deterministic source ui/shared ships; `adapter` imports plan 14's headless
// Claude source (loaded lazily so a tree without it still builds).
async function proposalSource(selectedNodeId: string, evidence: string[]): Promise<ProposalSource> {
  const mode = process.env.MOS_PROPOSAL_SOURCE || "fixed";
  if (mode === "fixed") {
    return fixedProposalSource({
      subject_node_id: selectedNodeId,
      verdict_options: [
        { id: "approve_enough", label: "Yes, the evidence is enough", description: "Confirms the claim when the room's floor is met." },
        { id: "hold_more", label: "Not yet, gather more evidence", description: "Records your no and keeps the claim open." },
      ],
      recommended_id: "approve_enough",
      evidence_node_ids: evidence,
      rationale: "Fixed proposal for the bake-off: the selected claim and the room's nearest evidence nodes.",
    });
  }
  if (mode === "adapter") {
    const spec = "mos-ui-shared/claude-adapter";
    const mod = (await import(/* @vite-ignore */ spec)) as { createClaudeAdapterSource?: () => ProposalSource; default?: () => ProposalSource };
    const make = mod.createClaudeAdapterSource || mod.default;
    if (typeof make !== "function") throw new Error("claude-adapter does not export a proposal source");
    return make();
  }
  throw new Error("MOS_PROPOSAL_SOURCE must be fixed or adapter");
}

function verdictFor(optionId: string): "approve" | "reject" | "defer" {
  if (optionId.startsWith("approve")) return "approve";
  if (optionId.startsWith("defer")) return "defer";
  return "reject";
}

export const sliceRegistry = createActionRegistry();

export const listRooms = sliceRegistry.register(
  defineShellAction({
    name: "listRooms",
    exposure: "both",
    input: sliceInputs.listRooms,
    run: async (_input, context) => {
      const res = await getPool().call(ctxOf(context).sessionKey, "room_list", {});
      return { ok: res.ok, rooms: res.data, text: res.ok ? undefined : res.text, reconnected: res.reconnected };
    },
  }),
);

export const openRoom = sliceRegistry.register(
  defineShellAction({
    name: "openRoom",
    exposure: "human",
    input: sliceInputs.openRoom,
    run: async (input, context) => {
      const { room } = input as z.infer<typeof sliceInputs.openRoom>;
      const res = await getPool().bind(ctxOf(context).sessionKey, room);
      const d = res.data as { effective?: boolean } | null;
      return { ok: res.ok && !!d && d.effective === true, room, bind: res.data, reconnected: res.reconnected };
    },
  }),
);

export const readArtifact = sliceRegistry.register(
  defineShellAction({
    name: "readArtifact",
    exposure: "both",
    input: sliceInputs.readArtifact,
    run: async (input, context) => {
      const { path, max_bytes } = input as z.infer<typeof sliceInputs.readArtifact>;
      const args: Record<string, unknown> = { path };
      if (max_bytes !== undefined) args.max_bytes = max_bytes;
      const res = await getPool().call(ctxOf(context).sessionKey, "room_artifact", args);
      const d = (res.data || {}) as Record<string, unknown>;
      return { ok: res.ok && d.ok === true, ...d, text: res.data ? undefined : res.text };
    },
  }),
);

export const listEvidence = sliceRegistry.register(
  defineShellAction({
    name: "listEvidence",
    exposure: "both",
    input: sliceInputs.listEvidence,
    run: async (input, context) => {
      const { limit } = input as z.infer<typeof sliceInputs.listEvidence>;
      const res = await getPool().call(ctxOf(context).sessionKey, "room_changes", {
        collection: "nodes",
        mode: "snapshot",
        limit: limit || 50,
      });
      const d = (res.data || {}) as Record<string, unknown>;
      return { ok: res.ok && d.ok === true, ...d, text: res.data ? undefined : res.text };
    },
  }),
);

export const proposeDecision = sliceRegistry.register(
  defineShellAction({
    name: "proposeDecision",
    exposure: "agent",
    input: sliceInputs.proposeDecision,
    run: async (input, context) => {
      const { room, selectedNodeId, question } = input as z.infer<typeof sliceInputs.proposeDecision>;
      const pool = getPool();
      const sid = ctxOf(context).sessionKey;
      // Evidence for the fixed source: the room's other nodes, nearest first.
      let evidence: string[] = [];
      try {
        const feed = await pool.call(sid, "room_changes", { collection: "nodes", mode: "snapshot", limit: 20 });
        const rows = ((feed.data as { changes?: Array<{ entity_id?: string; id?: string }> } | null)?.changes) || [];
        evidence = rows.map((r) => String(r.entity_id || r.id || "")).filter((id) => id && id !== selectedNodeId).slice(0, 3);
      } catch (_e) {
        evidence = [];
      }
      const source = await proposalSource(selectedNodeId, evidence);
      const proposal = ProposalSchema.parse(await source.propose({ roomSlug: room, selectedNodeId, question }));
      // The gate is minted on the HUMAN browser session, so the person's own
      // button can answer it (gate ownership is the minting session, D-19).
      const res = await pool.call(sid, "gate_render", {
        header: question,
        subject_node_id: proposal.subject_node_id,
        evidence_node_ids: proposal.evidence_node_ids,
        options: proposal.verdict_options.map((o, i) => ({
          id: o.id,
          label: o.label,
          ...(o.description ? { description: o.description } : {}),
          rank: o.id === proposal.recommended_id ? 1 : i + 2,
        })),
      });
      const d = (res.data || {}) as {
        ok?: boolean;
        gate_id?: string;
        reason?: string;
        rendered?: { contract?: { superset_options?: Array<{ id?: string }> } };
      };
      if (!res.ok || d.ok !== true || !d.gate_id) {
        return { ok: false, refused: d.reason || "no_gate", text: res.data ? undefined : res.text };
      }
      // Show only options the gate will accept (the rendered contract's
      // superset), the recommendation from the proposal itself.
      const accepted = (d.rendered?.contract?.superset_options || []).map((o) => String(o.id));
      const options = proposal.verdict_options
        .filter((o) => accepted.length === 0 || accepted.includes(o.id))
        .map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description || "",
          recommended: o.id === proposal.recommended_id,
          verdict: verdictFor(o.id),
        }));
      return {
        ok: true,
        reconnected: res.reconnected,
        gate: {
          gate_id: d.gate_id,
          header: question,
          subject_node_id: proposal.subject_node_id,
          evidence_node_ids: proposal.evidence_node_ids,
          rationale: proposal.rationale,
          recommended_id: proposal.recommended_id,
          options,
        },
      };
    },
  }),
);

export const approveDecision = sliceRegistry.register(
  defineShellAction({
    name: "approveDecision",
    exposure: "human",
    input: sliceInputs.approveDecision,
    run: async (input, context) => {
      const { gate_id, chosen, verdict } = input as z.infer<typeof sliceInputs.approveDecision>;
      const res = await getPool().call(ctxOf(context).sessionKey, "gate_answer", { gate_id, chosen: [chosen], verdict });
      const d = (res.data || {}) as Record<string, unknown>;
      return {
        ok: res.ok && d.ok === true,
        answered: d.ok === true,
        ratified: d.ratified === true,
        verdict,
        refused: d.ok === true ? null : String(d.reason || d.error || "refused"),
        reconnected: res.reconnected,
        result: d,
      };
    },
  }),
);

export function sliceAction(name: string) {
  const entry = sliceRegistry.get(name);
  if (!entry) throw new Error("unknown slice action: " + name);
  return entry;
}
