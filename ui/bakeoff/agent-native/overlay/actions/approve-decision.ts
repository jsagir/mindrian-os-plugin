// Candidate B: the approveDecision slice action. A thin wrapper over the shared action
// layer (D-06): agent-native's own agent and MCP never see it (D-14, SEED-067).
import { defineAction } from "@agent-native/core/action";
import { requireBrowserSession, runSliceAction, sliceSchema } from "../server/lib/action-bridge";

export default defineAction({
  description: "Answer a gate with the person's chosen option. Human only.",
  schema: sliceSchema("approveDecision"),
  http: { method: "POST" },
  agentTool: false,
  mcpTool: false,
  uiOnly: true,
  authorize: requireBrowserSession,
  run: async (input, ctx) => runSliceAction("approveDecision", input, ctx),
});
