// Candidate B: the single seam between agent-native's defineAction and the
// shell's action registry (D-06). Each actions/<name>.ts wraps one registry
// entry; the browser session cookie is the only way in, and the pool key is
// read from that cookie, never from the request body. Hyphens only.
import type { ActionRunContext } from "@agent-native/core/action";
import { sessionFromHeaders } from "./session";
import { sliceAction } from "./slice-actions";

// authorize: the call must carry a browser session cookie this process issued.
export function requireBrowserSession(_args: unknown, ctx?: ActionRunContext): boolean {
  return sessionFromHeaders(ctx?.requestHeaders) !== null;
}

export function runSliceAction(name: string, input: unknown, ctx?: ActionRunContext): unknown {
  const sessionKey = sessionFromHeaders(ctx?.requestHeaders);
  if (!sessionKey) throw Object.assign(new Error("Not authorized"), { statusCode: 403 });
  return sliceAction(name).run(input, { sessionKey });
}

export function sliceSchema(name: string) {
  return sliceAction(name).input as never;
}
