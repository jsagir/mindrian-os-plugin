// Spike 007 action 1 of 3: room_state over MCP. Read only.
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { bridgeInfo, callMos } from "../server/lib/mos-mcp";

export default defineAction({
  description: "Read the bound MindrianOS room's state (health, stage) through the MindrianOS MCP server. Read only.",
  schema: z.object({
    ui_session: z.string().min(8).max(64).describe("The UI session key; one MCP session per key"),
    command: z.enum(["status", "get-state", "suggest-next"]).default("status"),
  }),
  http: { method: "GET" },
  run: async ({ ui_session, command }) => {
    const r = await callMos(ui_session, "room_state", { command });
    // room_state answers STATE.md (frontmatter + an ANSI room map), not JSON.
    const fm = (k: string) => { const m = r.text.match(new RegExp("^" + k + ": *(.+)$", "m")); return m ? m[1].trim() : null; };
    return { ok: r.ok, ms: r.ms, mcp_session: r.mcp_session, summary: { venture_stage: fm("venture_stage"), total_entries: fm("total_entries"), current_room: fm("current_room") }, bridge: bridgeInfo() };
  },
});
