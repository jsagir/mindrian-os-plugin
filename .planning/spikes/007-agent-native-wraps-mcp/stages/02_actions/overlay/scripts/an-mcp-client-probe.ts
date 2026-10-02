// Spike 007: can agent-native CONSUME an external MCP server as agent tools?
// Uses agent-native's own McpClientManager (the class its agent chat uses per
// principal) against the MindrianOS HTTP server. Prints JSON. No em-dashes.
import { McpClientManager } from "@agent-native/core/mcp-client";

const url = process.env.MOS_MCP_URL || "http://127.0.0.1:3847/mcp";
const text = (r: any) => (r?.content || []).map((c: any) => c?.text || "").join("\n");
const json = (r: any) => { try { return JSON.parse(text(r)); } catch { return null; } };

const out: any = { url };
const m = new McpClientManager({ servers: { mindrian: { type: "http", url } } });
const t0 = Date.now();
await m.start();
out.start_ms = Date.now() - t0;
out.connected = m.connectedServers;
const tools = m.getTools();
out.tool_count = tools.length;
out.sample_tool_names = tools.slice(0, 6).map((t: any) => t.name);
out.has = ["room_state", "graph_query", "gate_render", "gate_answer", "research_run"].map((n) => [n, !!m.getTool("mcp__mindrian__" + n)]);
await m.callTool("mcp__mindrian__room_bind", { room: process.env.MOS_ROOM || "egain-des-liquid-conductor" });
const rs: any = await m.callTool("mcp__mindrian__room_state", { command: "status" });
out.room_state_first_line = text(rs).split("\n").slice(0, 4).join(" | ");
const g: any = json(await m.callTool("mcp__mindrian__gate_render", { header: "Spike 007 via agent-native McpClientManager", options: [{ id: "yes", label: "Approve", rank: 1 }, { id: "no", label: "Not now", rank: 2 }] }));
out.gate_minted = g?.gate_id || null;
const a: any = json(await m.callTool("mcp__mindrian__gate_answer", { gate_id: g?.gate_id, chosen: ["yes"], verdict: "approve" }));
out.gate_answer = { ok: a?.ok, ratified: a?.ratified, reason: a?.reason || null, decision: a?.reasoning_node?.node_id || null };
out.status = m.getStatus();
await m.stop();
console.log(JSON.stringify(out, null, 1));
process.exit(0);
