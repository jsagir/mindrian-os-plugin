// Candidate B: the openRoom slice action. A thin wrapper over the shared action
// layer (D-06): agent-native's own agent and MCP never see it (D-14, SEED-067).
import { defineAction } from "@agent-native/core/action";
import { requireBrowserSession, runSliceAction, sliceSchema } from "../server/lib/action-bridge";

export default defineAction({
  description: "Open a room: bind this browser session to it. Human only.",
  schema: sliceSchema("openRoom"),
  http: { method: "POST" },
  agentTool: false,
  mcpTool: false,
  uiOnly: true,
  authorize: requireBrowserSession,
  run: async (input, ctx) => runSliceAction("openRoom", input, ctx),
});
