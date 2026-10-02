// Spike 007 action 3 of 3: the decision gate over MCP.
//   op "mint":   source "grant"  -> research_run grant_request (the real research-grant gate)
//                source "render" -> gate_render (a generic gate with the same card shape)
//   op "answer": gate_answer on the SAME MCP session that minted it.
// The only write path in this app. Nothing is written until a person answers.
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { callMos } from "../server/lib/mos-mcp";

const mintSchema = z.object({
  ui_session: z.string().min(8).max(64),
  op: z.literal("mint"),
  source: z.enum(["grant", "render"]).default("grant"),
  terms: z.array(z.string().min(2).max(80)).max(8).default(["liquid metal conductor", "deep eutectic solvent"]),
});
const answerSchema = z.object({
  ui_session: z.string().min(8).max(64),
  op: z.literal("answer"),
  gate_id: z.string().min(4).max(96),
  chosen: z.array(z.string().min(1).max(96)).min(1).max(4),
  verdict: z.enum(["approve", "reject", "defer"]),
});

type Option = { id: string; label: string; recommended: boolean };

export default defineAction({
  description: "Mint a MindrianOS decision gate (a research grant by default) or answer one. Answering approve writes the decision to the room through the MCP server.",
  schema: z.discriminatedUnion("op", [mintSchema, answerSchema]),
  http: { method: "POST" },
  run: async (input) => {
    if (input.op === "answer") {
      const r = await callMos(input.ui_session, "gate_answer", { gate_id: input.gate_id, chosen: input.chosen, verdict: input.verdict });
      const j = r.json || {};
      const resumed = j.chain_result || j.resumed || j.result || null;
      return {
        ...r,
        // ok = the room took the answer; ratified = it was an approval. A reject
        // answers ok:true, ratified:false and logs a memory_event only.
        answered: j.ok === true,
        ratified: j.ratified === true,
        verdict: input.verdict,
        refused: j.reason || j.error || null,
        decision_node_id: (resumed && resumed.decision_node_id) || (j.reasoning_node && j.reasoning_node.node_id) || null,
        executed: resumed ? resumed.executed === true : null,
      };
    }
    if (input.source === "grant") {
      const r = await callMos(input.ui_session, "research_run", { op: "grant_request", terms: input.terms });
      const j = r.json || {};
      if (!j.gate || !j.gate.gate_id) return { ...r, gate: null, refused: j.reason || j.error || "no_gate" };
      // The rendered contract drops approve_run when there is no run and carries
      // recommended:null; the card carries the recommendation. Show only options
      // the gate will accept, recommendation from the card.
      const accepted: string[] = (j.gate.rendered?.contract?.superset_options || []).map((o: any) => o.id);
      const options: Option[] = (j.card?.options || [])
        .filter((o: any) => accepted.length === 0 || accepted.includes(o.id))
        .map((o: any) => ({ id: o.id, label: String(o.label).replace(/\s*\(Recommended\)\s*$/, ""), recommended: o.recommended === true }));
      return {
        ok: r.ok, ms: r.ms, mcp_session: r.mcp_session,
        gate: {
          gate_id: j.gate.gate_id, title: j.card?.title || "Decision", question: j.card?.question || "",
          body_md: j.card?.body_md || "", options,
          approving: options.filter((o) => o.id.startsWith("approve")).map((o) => o.id),
        },
      };
    }
    const options: Option[] = [
      { id: "approve_standing", label: "Approve this standing grant", recommended: true },
      { id: "not_now", label: "Not now", recommended: false },
    ];
    const r = await callMos(input.ui_session, "gate_render", { header: "Research grant: Approve this research grant?", options: options.map((o, i) => ({ id: o.id, label: o.label, rank: i + 1 })) });
    const j = r.json || {};
    return { ok: r.ok, ms: r.ms, mcp_session: r.mcp_session, gate: j.gate_id ? { gate_id: j.gate_id, title: "Research grant", question: "Approve this research grant?", body_md: "", options, approving: ["approve_standing"] } : null };
  },
});
