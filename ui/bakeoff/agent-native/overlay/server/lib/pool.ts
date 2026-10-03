// Candidate B (agent-native): the one door to room data (Phase 369 D-06, D-19).
// One legacy-mode MCP session pool for the server process, from ui/shared.
// agent-native's own MCP client is never pointed at the MindrianOS daemon: it
// negotiates the modern era and lands on the stateless leg (RESEARCH
// anti-pattern), where the transport-minted session id does not exist.
// No file-system or process-spawn module, no outside host. Hyphens only.
import { createSessionPool } from "mos-ui-shared/mcp-session-pool";

type Pool = ReturnType<typeof createSessionPool>;
const g = globalThis as unknown as { __mosPool?: Pool };

function daemonUrl(): string {
  const url = process.env.MOS_DAEMON_URL;
  if (!url) throw new Error("MOS_DAEMON_URL is not set (the daemon base URL, 127.0.0.1 only)");
  return url.replace(/\/+$/, "");
}

export function getPool(): Pool {
  if (!g.__mosPool) {
    g.__mosPool = createSessionPool({ daemonUrl, clientName: "mindrian-shell" });
  }
  return g.__mosPool;
}

export function getDaemonUrl(): string {
  return daemonUrl();
}
