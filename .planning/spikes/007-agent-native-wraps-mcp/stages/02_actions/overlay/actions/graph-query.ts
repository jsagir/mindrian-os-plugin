// Spike 007 action 2 of 3: graph_query over MCP. Read only.
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { callMos } from "../server/lib/mos-mcp";

export default defineAction({
  description: "Read the graph neighborhood of one room node through the MindrianOS MCP server. Read only.",
  schema: z.object({
    ui_session: z.string().min(8).max(64),
    node_id: z.string().min(1).max(512).describe("The node to center on"),
    top_k: z.number().int().min(1).max(50).default(10),
  }),
  http: { method: "GET" },
  run: async ({ ui_session, node_id, top_k }) => callMos(ui_session, "graph_query", { node_id, top_k, max_depth: 2 }),
});
