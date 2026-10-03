/*
 * human-origin.ts -- the single-use render nonce behind "only a person approves" (plan 369-21; D-15).
 *
 * A browser session that was SHOWN a gate (readGate, a human-only action) is handed one nonce, bound to that
 * gate id and that browser session. approveDecision must carry it back. Nothing on the in-process agent path
 * can obtain one: nonces are issued only inside readGate, and the agent path cannot call readGate.
 * Session ownership says which session minted a gate; the nonce says a browser rendered it.
 *
 * Lifecycle (check-then-reserve, one synchronous step, so two concurrent submits cannot both pass):
 *   issue    -> state `issued` (a re-issue for the same gate and session replaces the earlier nonce, unless
 *               that nonce is in flight, in which case the same in-flight nonce is returned)
 *   reserve  -> `issued` becomes `in_flight` before any MCP call
 *   release  -> `in_flight` back to `issued` (gate_answer refused or failed: the person may retry)
 *   burn     -> `in_flight` becomes `used` (gate_answer returned ok), terminal
 *
 * The nonce lives in server memory and in the browser's page memory only: never a cookie, storage, a URL
 * or anything the adapter sees. Tokens come from crypto.randomBytes and are compared in constant time.
 * Framework-free erasable TypeScript, Node built-ins only.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';

// The gate ledger forgets a gate after 30 minutes (LEDGER_TTL_MS in lib/mcp/gate-ledger.cjs). This package is
// walled and never imports lib/, so the value is carried here by value; the D-15 acceptance test pins the two equal.
export const DEFAULT_NONCE_TTL_MS = 30 * 60 * 1000;

export type NonceRefusal = 'nonce_missing' | 'nonce_mismatch' | 'nonce_in_flight' | 'nonce_used' | 'nonce_expired';

export type ReserveResult = { ok: true } | { ok: false; reason: NonceRefusal };

export type NonceStoreOptions = {
  now?: () => number;
  ttlMs?: number;
};

type State = 'issued' | 'in_flight' | 'used';

type Rec = {
  nonce: string;
  gateId: string;
  browserSessionId: string;
  expiresAt: number;
  state: State;
};

function recKey(browserSessionId: string, gateId: string): string {
  return browserSessionId + '\u0000' + gateId;
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  // Equal length is checked first (timingSafeEqual throws on unequal lengths); a nonce's length is public.
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createNonceStore(options: NonceStoreOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? DEFAULT_NONCE_TTL_MS;
  // One record per (browser session, gate). byNonce lets release and burn find the record of a nonce that
  // already passed reserve; reserve itself looks the record up by (session, gate) and compares in constant time.
  const byPair = new Map<string, Rec>();
  const byNonce = new Map<string, Rec>();

  function drop(rec: Rec): void {
    byPair.delete(recKey(rec.browserSessionId, rec.gateId));
    byNonce.delete(rec.nonce);
  }

  function sweep(): void {
    const t = now();
    for (const rec of Array.from(byPair.values())) if (rec.state !== 'in_flight' && rec.expiresAt <= t) drop(rec);
  }

  return {
    issue(args: { gateId: string; browserSessionId: string }): string {
      sweep();
      const k = recKey(args.browserSessionId, args.gateId);
      const existing = byPair.get(k);
      // A re-read while an approval is in flight hands back the same nonce: it stays reserved, so the
      // re-read cannot open a second path to gate_answer.
      if (existing && existing.state === 'in_flight') return existing.nonce;
      if (existing) drop(existing);
      const rec: Rec = {
        nonce: randomBytes(32).toString('base64url'),
        gateId: args.gateId,
        browserSessionId: args.browserSessionId,
        expiresAt: now() + ttlMs,
        state: 'issued',
      };
      byPair.set(k, rec);
      byNonce.set(rec.nonce, rec);
      return rec.nonce;
    },

    reserve(args: { nonce: unknown; gateId: string; browserSessionId: string }): ReserveResult {
      if (typeof args.nonce !== 'string' || args.nonce.length === 0) return { ok: false, reason: 'nonce_missing' };
      const rec = byPair.get(recKey(args.browserSessionId, args.gateId));
      // No nonce was issued to this browser session for this gate: whatever was sent belongs to another
      // gate or another session.
      if (!rec) return { ok: false, reason: 'nonce_mismatch' };
      if (!sameToken(rec.nonce, args.nonce)) return { ok: false, reason: 'nonce_mismatch' };
      if (rec.state === 'used') return { ok: false, reason: 'nonce_used' };
      if (rec.state === 'in_flight') return { ok: false, reason: 'nonce_in_flight' };
      if (rec.expiresAt <= now()) {
        drop(rec);
        return { ok: false, reason: 'nonce_expired' };
      }
      rec.state = 'in_flight';
      return { ok: true };
    },

    release(nonce: string): void {
      const rec = byNonce.get(nonce);
      if (rec && rec.state === 'in_flight') rec.state = 'issued';
    },

    burn(nonce: string): void {
      const rec = byNonce.get(nonce);
      if (rec && rec.state === 'in_flight') rec.state = 'used';
    },

    // A browser session expired or its MCP session restarted: its gates are gone, so are its nonces.
    forgetSession(browserSessionId: string): void {
      for (const rec of Array.from(byPair.values())) if (rec.browserSessionId === browserSessionId) drop(rec);
    },

    size(): number {
      return byPair.size;
    },
  };
}

export type NonceStore = ReturnType<typeof createNonceStore>;
