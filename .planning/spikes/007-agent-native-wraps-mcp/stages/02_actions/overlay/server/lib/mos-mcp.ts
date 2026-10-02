// Spike 007: the bridge from agent-native actions to the MindrianOS MCP server
// (Streamable HTTP, per-connection session mode, spike 005).
//
// One MCP session per UI session key. A gate belongs to the MCP session that
// minted it (005: a cross-connection answer is refused session_mismatch), so the
// Confirm click must travel on the SAME session as the mint. The UI passes its
// key; the bridge keeps one client per key and drops it after 30 idle minutes.
// Nothing here stores room data: every read and write is an MCP tool call.
// No em-dashes.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MOS_MCP_URL || "http://127.0.0.1:3847/mcp";
const ROOM = process.env.MOS_ROOM || "egain-des-liquid-conductor";
const IDLE_MS = 30 * 60 * 1000;

type Entry = { client: Client; transport: StreamableHTTPClientTransport; last: number; ready: Promise<void> };
const sessions = new Map<string, Entry>();

function sweep() {
  const now = Date.now();
  for (const [k, e] of sessions) {
    if (now - e.last > IDLE_MS) { sessions.delete(k); e.client.close().catch(() => {}); }
  }
}

async function session(key: string): Promise<Entry> {
  sweep();
  let e = sessions.get(key);
  if (!e) {
    const client = new Client({ name: "mos-ui-spike007", version: "0.0.1" });
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
    const ready = (async () => {
      await client.connect(transport);
      await client.callTool({ name: "room_bind", arguments: { room: ROOM } });
    })();
    e = { client, transport, last: Date.now(), ready };
    sessions.set(key, e);
    ready.catch(() => sessions.delete(key));
  }
  e.last = Date.now();
  await e.ready;
  return e;
}

function textOf(res: any): string {
  return (res?.content || []).map((c: any) => c?.text || "").join("\n");
}
export function parseToolJson(text: string): any {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

export async function callMos(key: string, name: string, args: Record<string, unknown>) {
  let e = await session(key);
  const t0 = Date.now();
  let res: any;
  try {
    res = await e.client.callTool({ name, arguments: args });
  } catch (err) {
    // The MCP server restarted (its session map is in memory): drop this
    // session and open a fresh one once. Gates minted on the old session are
    // gone with it; the UI must mint again.
    sessions.delete(key);
    e.client.close().catch(() => {});
    e = await session(key);
    res = await e.client.callTool({ name, arguments: args });
    (res as any)._reconnected = true;
  }
  const text = textOf(res);
  return { ok: !res?.isError, ms: Date.now() - t0, mcp_session: e.transport.sessionId || null, reconnected: !!res?._reconnected, json: parseToolJson(text), text: text.slice(0, 4000) };
}

export function bridgeInfo() {
  return { mcp_url: MCP_URL, room: ROOM, open_sessions: sessions.size };
}
