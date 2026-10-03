// Candidate B: the listEvidence slice action. A thin wrapper over the shared action
// layer (D-06): agent-native's own agent and MCP never see it (D-14, SEED-067).
import { defineAction } from "@agent-native/core/action";
import { requireBrowserSession, runSliceAction, sliceSchema } from "../server/lib/action-bridge";

export default defineAction({
  description: "List the open room's nodes (evidence and claims) from the change feed snapshot. Read only.",
  schema: sliceSchema("listEvidence"),
  http: { method: "GET" },
  agentTool: false,
  mcpTool: false,
  authorize: requireBrowserSession,
  run: async (input, ctx) => runSliceAction("listEvidence", input, ctx),
});
