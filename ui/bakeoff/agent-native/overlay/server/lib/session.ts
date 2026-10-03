// Candidate B: the browser session (bake-off version of plan 19's bootstrap).
// An HttpOnly SameSite=Strict cookie holding a per-process random id. The id
// is the pool's session key, so one browser tab-set maps to one MCP session,
// and the key never comes from the request body. The full one-time bootstrap
// code and idle expiry are plan 19's; this is the per-process random cookie
// the plan records as the bake-off stand-in. Hyphens only.
import { randomUUID } from "node:crypto";

export const SESSION_COOKIE = "mos_sid";

const g = globalThis as unknown as { __mosSids?: Set<string> };
function issued(): Set<string> {
  if (!g.__mosSids) g.__mosSids = new Set<string>();
  return g.__mosSids;
}

export function issueSession(): string {
  const sid = "bs-" + randomUUID();
  issued().add(sid);
  return sid;
}

export function isIssuedSession(sid: string | null | undefined): boolean {
  return typeof sid === "string" && issued().has(sid);
}

function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// The session id carried by a request, or null when the cookie is missing or
// was not issued by this process.
export function sessionFromHeaders(headers: Headers | undefined | null): string | null {
  if (!headers) return null;
  const sid = cookieValue(headers.get("cookie"), SESSION_COOKIE);
  return isIssuedSession(sid) ? sid : null;
}
