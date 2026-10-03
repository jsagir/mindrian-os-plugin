/*
 * bootstrap.ts -- the one-time sign-in code (369-SESSION-CONTRACT.md section 3).
 *
 * The launcher mints a 32-byte random code and hands the server only its sha256.
 * The store keeps hashes, never codes. A code is valid 60 seconds (a contract
 * default: long enough to open a printed link on the same machine, short enough
 * that a link left in scrollback is dead), single use, and burned by ANY exchange
 * attempt that matches an armed hash, success or not. The store lives in this
 * process only, so a code armed for another process never matches here.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export const DEFAULT_BOOTSTRAP_TTL_MS = 60000;

type Entry = { hash: Buffer; expiresAt: number };

export type ExchangeResult = { ok: true } | { ok: false; reason: 'malformed' | 'unknown_or_used' | 'expired' };

export type BootstrapStore = {
  arm(sha256Hex: string, ttlMs?: number): void;
  exchange(code: unknown): ExchangeResult;
  size(): number;
};

export function createBootstrapStore(opts: { now?: () => number } = {}): BootstrapStore {
  const now = opts.now ?? (() => Date.now());
  let entries: Entry[] = [];

  function prune(): void {
    const t = now();
    entries = entries.filter((e) => e.expiresAt > t);
  }

  return {
    arm(sha256Hex: string, ttlMs: number = DEFAULT_BOOTSTRAP_TTL_MS): void {
      if (typeof sha256Hex !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256Hex)) throw new Error('arm: sha256 must be 64 hex characters');
      if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('arm: ttlMs must be positive');
      prune();
      entries.push({ hash: Buffer.from(sha256Hex.toLowerCase(), 'hex'), expiresAt: now() + ttlMs });
    },

    exchange(code: unknown): ExchangeResult {
      if (typeof code !== 'string' || code.length < 1 || code.length > 256) return { ok: false, reason: 'malformed' };
      const given = createHash('sha256').update(code).digest();
      const t = now();
      // Compare against every entry (constant-time each) so timing does not say which matched.
      let hit = -1;
      for (let i = 0; i < entries.length; i += 1) {
        if (timingSafeEqual(given, entries[i]!.hash) && hit < 0) hit = i;
      }
      if (hit < 0) {
        prune();
        return { ok: false, reason: 'unknown_or_used' };
      }
      const entry = entries[hit]!;
      entries.splice(hit, 1); // burned on the attempt, whatever the outcome
      prune();
      if (entry.expiresAt <= t) return { ok: false, reason: 'expired' };
      return { ok: true };
    },

    size(): number {
      prune();
      return entries.length;
    },
  };
}

// One store per server process, shared by the control route, the exchange route
// and startup. globalThis because the chassis bundles those separately.
const SLOT = Symbol.for('mos.shell.bootstrap');

export function getBootstrapStore(): BootstrapStore {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[SLOT]) g[SLOT] = createBootstrapStore();
  return g[SLOT] as BootstrapStore;
}
