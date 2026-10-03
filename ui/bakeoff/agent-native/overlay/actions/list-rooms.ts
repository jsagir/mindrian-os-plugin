// Candidate B: the listRooms slice action. A thin wrapper over the shared action
// layer (D-06): agent-native's own agent and MCP never see it (D-14, SEED-067).
import { defineAction } from "@agent-native/core/action";
import { requireBrowserSession, runSliceAction, sliceSchema } from "../server/lib/action-bridge";

export default defineAction({
  description: "List the rooms the MindrianOS daemon serves. Read only.",
  schema: sliceSchema("listRooms"),
  http: { method: "GET" },
  agentTool: false,
  mcpTool: false,
  authorize: requireBrowserSession,
  run: async (input, ctx) => runSliceAction("listRooms", input, ctx),
});
