// Candidate B: the proposeDecision slice action. A thin wrapper over the shared action
// layer (D-06): agent-native's own agent and MCP never see it (D-14, SEED-067).
import { defineAction } from "@agent-native/core/action";
import { requireBrowserSession, runSliceAction, sliceSchema } from "../server/lib/action-bridge";

export default defineAction({
  description: "Ask the proposal source whether a claim has enough evidence and mint the gate on this browser session.",
  schema: sliceSchema("proposeDecision"),
  http: { method: "POST" },
  agentTool: false,
  mcpTool: false,
  authorize: requireBrowserSession,
  run: async (input, ctx) => runSliceAction("proposeDecision", input, ctx),
});
