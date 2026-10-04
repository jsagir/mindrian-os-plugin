/*
 * auth.ts -- browser sessions, the sign-in exchange and CSRF (D-08, session contract section 3).
 *
 * Sessions live in this server process only: an opaque id from randomBytes(32), base64url,
 * mapped to { createdAt, lastSeen, csrf, mcpKey }. Nothing is written to a file, a second store
 * or browser storage; the browser holds only the HttpOnly cookie. Idle expiry is 30 minutes (the
 * contract default the spike 007 bridge used, RESEARCH Security Domain V3).
 *
 * The cookie is HttpOnly; SameSite=Strict; Path=/ . It carries no `Secure` attribute because the
 * shell is plain HTTP on 127.0.0.1 (browsers treat loopback as a secure context for cookies on the
 * attributes above, and a Secure cookie would never be sent back over http).
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { NOT_SIGNED_IN } from '../client/copy.ts';
import type { BootstrapStore } from './bootstrap.ts';
import { checkRequest } from './origin-guard.ts';
import type { HeaderBag } from './origin-guard.ts';

export const SESSION_COOKIE = 'mos_shell_sid';
export const CSRF_HEADER = 'x-mos-csrf';
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const COOKIE_ATTRIBUTES = 'HttpOnly; SameSite=Strict; Path=/';

export type Session = {
  id: string;
  createdAt: number;
  lastSeen: number;
  csrf: string;
  mcpKey: string;
};

export type SessionStore = {
  issue(): Session;
  read(id: string | null | undefined): Session | null;
  drop(id: string): void;
  sweep(): string[];
  size(): number;
};

export function createSessionStore(opts: { now?: () => number; idleMs?: number } = {}): SessionStore {
  const now = opts.now ?? (() => Date.now());
  const idleMs = opts.idleMs ?? SESSION_IDLE_MS;
  const sessions = new Map<string, Session>();

  return {
    issue(): Session {
      const t = now();
      const session: Session = {
        id: randomBytes(32).toString('base64url'),
        createdAt: t,
        lastSeen: t,
        csrf: randomBytes(32).toString('base64url'),
        // The pool key plan 369-32 binds an MCP session to; distinct from the cookie id so
        // the cookie value is never used anywhere but here.
        mcpKey: randomBytes(16).toString('base64url'),
      };
      sessions.set(session.id, session);
      return session;
    },
    read(id): Session | null {
      if (!id) return null;
      const s = sessions.get(id);
      if (!s) return null;
      const t = now();
      if (t - s.lastSeen > idleMs) {
        sessions.delete(id);
        return null;
      }
      s.lastSeen = t;
      return s;
    },
    drop(id: string): void {
      sessions.delete(id);
    },
    // Returns the mcpKeys of the sessions that expired, so 369-32 can close their MCP sessions.
    sweep(): string[] {
      const t = now();
      const gone: string[] = [];
      for (const [id, s] of sessions) {
        if (t - s.lastSeen > idleMs) {
          sessions.delete(id);
          gone.push(s.mcpKey);
        }
      }
      return gone;
    },
    size(): number {
      return sessions.size;
    },
  };
}

const SLOT = Symbol.for('mos.shell.sessions');

export function getSessionStore(): SessionStore {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[SLOT]) g[SLOT] = createSessionStore();
  return g[SLOT] as SessionStore;
}

export function issueSession(store: SessionStore = getSessionStore()): { session: Session; setCookie: string } {
  const session = store.issue();
  return { session, setCookie: SESSION_COOKIE + '=' + session.id + '; ' + COOKIE_ATTRIBUTES };
}

export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    if (!(name in out)) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

export function readSession(cookieHeader: string | null | undefined, store: SessionStore = getSessionStore()): Session | null {
  return store.read(parseCookies(cookieHeader)[SESSION_COOKIE]);
}

export type CsrfResult = { ok: true } | { ok: false; status: 401 | 403; reason: 'not_signed_in' | 'csrf_missing' | 'csrf_mismatch' };

// Every state-changing request must carry the session's CSRF token in a header the page sets from its
// own meta tag (never from browser storage). The route glue for POST calls this after the origin guard
// and readSession, in that order.
export function requireCsrf(req: { headers: HeaderBag }, session: Session | null): CsrfResult {
  if (!session) return { ok: false, status: 401, reason: 'not_signed_in' };
  const given = req.headers.get(CSRF_HEADER);
  if (!given) return { ok: false, status: 403, reason: 'csrf_missing' };
  const a = Buffer.from(given);
  const b = Buffer.from(session.csrf);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 403, reason: 'csrf_mismatch' };
  return { ok: true };
}

export type PlainResponse = { status: number; headers: Record<string, string>; body: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The UI-SPEC "Not signed in" page: What / Why / Fix. No script and no inline style, so it renders
// under the strictest policy; plan 20 skins the page through the shared stylesheet.
export function notSignedInResponse(status: number): PlainResponse {
  const body =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not signed in</title></head><body><main>' +
    '<h1>' + escapeHtml(NOT_SIGNED_IN.what) + '</h1>' +
    '<p>' + escapeHtml(NOT_SIGNED_IN.why) + '</p>' +
    '<p>' + escapeHtml(NOT_SIGNED_IN.fix) + '</p>' +
    '</main></body></html>';
  return {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
    body,
  };
}

export type BootstrapRequest = {
  url: string; // the request target: path and query
  headers: HeaderBag;
  port: number;
};

// CR-01 (369-REVIEW.md, plan 369-37): a sign-in is redeemed only by a top-level browser navigation.
// A browser stamps every request with fetch metadata it controls; typing or following a link in the address
// bar, or xdg-open, arrives as Sec-Fetch-Site none, Sec-Fetch-Mode navigate, Sec-Fetch-Dest document.
// curl and an agent's fetch tool send none of these, so they are refused here, BEFORE the code is read or
// burned, and the person's browser can still use the link. A process that FORGES these three headers is the
// CR-02 class (a same-user process acting as the person); that residual risk is recorded in
// 369-SESSION-CONTRACT.md section 3 for the navigator, not closed here.
export function isBrowserNavigation(headers: HeaderBag): boolean {
  return (
    headers.get('sec-fetch-site') === 'none' &&
    headers.get('sec-fetch-mode') === 'navigate' &&
    headers.get('sec-fetch-dest') === 'document'
  );
}

function forbidden(): PlainResponse {
  return {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    body: 'Forbidden',
  };
}

function signedIn(sessions: SessionStore): PlainResponse {
  const { setCookie } = issueSession(sessions);
  return {
    status: 303,
    headers: { Location: '/', 'Set-Cookie': setCookie, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    body: '',
  };
}

// GET /auth/bootstrap?code=...
//  1. Host and Origin allow-list, the fetch-metadata refusal (cross-site or same-site) and the browser-navigation
//     rule: 403 BEFORE the code is touched, so a page elsewhere cannot burn or replay a code and cannot sign this
//     browser into a session someone else armed (login CSRF, T-369-19-04), a rebinding hostname is refused, and a
//     curl-shaped request cannot redeem a link it read from a terminal (CR-01).
//  2. Exchange the code (single use; burned on the attempt).
//  3. On success: Set-Cookie and a 303 to a code-free URL, so the code leaves the address bar and history.
//  4. On failure: the UI-SPEC "Not signed in" page.
export function handleBootstrapRequest(
  req: BootstrapRequest,
  deps: { bootstrap: BootstrapStore; sessions: SessionStore },
): PlainResponse {
  const guard = checkRequest(req.headers, req.port);
  if (!guard.ok || !isBrowserNavigation(req.headers)) return forbidden();
  let code: string | null = null;
  try {
    code = new URL(req.url, 'http://127.0.0.1').searchParams.get('code');
  } catch {
    code = null;
  }
  if (code === null) return notSignedInResponse(401);
  const result = deps.bootstrap.exchange(code);
  if (!result.ok) return notSignedInResponse(401);
  return signedIn(deps.sessions);
}

// GET /auth/start: the secret-free start (CR-01). The launcher arms one start slot through the 0600 control
// channel (POST /control/bootstrap { start: true }) and opens the browser at this URL, so no code appears in
// a process argument list, in the terminal, or in a model's context. Same guards as the code exchange; the
// slot is single use and valid 60 seconds from arming. A refused request leaves the slot armed.
export function handleStartRequest(
  req: BootstrapRequest,
  deps: { bootstrap: BootstrapStore; sessions: SessionStore },
): PlainResponse {
  const guard = checkRequest(req.headers, req.port);
  if (!guard.ok || !isBrowserNavigation(req.headers)) return forbidden();
  if (!deps.bootstrap.redeemStart().ok) return notSignedInResponse(401);
  return signedIn(deps.sessions);
}
