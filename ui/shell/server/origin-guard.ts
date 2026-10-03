/*
 * origin-guard.ts -- Host and Origin allow-list (D-08, MCPV2-17 pattern; T-369-19-01).
 *
 * The shell answers only a request whose Host is exactly 127.0.0.1:<port> (this
 * refuses a DNS-rebinding hostname, and `localhost` spelled as a name) and whose
 * Origin, when present, is exactly http://127.0.0.1:<port>. `isCrossSite` reads
 * Sec-Fetch-Site: a link opened from a terminal arrives as `none`, a request from
 * our own page as `same-origin`; `cross-site` and `same-site` come from some other
 * page the person has open.
 */

export type HeaderBag = { get(name: string): string | null };

export type GuardRefusal = { ok: false; status: 403; reason: 'bad_host' | 'bad_origin' | 'cross_site' };
export type GuardOk = { ok: true };

export function expectedHost(port: number): string {
  return '127.0.0.1:' + port;
}

export function checkHostOrigin(headers: HeaderBag, port: number): GuardOk | GuardRefusal {
  const host = headers.get('host');
  if (host !== expectedHost(port)) return { ok: false, status: 403, reason: 'bad_host' };
  const origin = headers.get('origin');
  if (origin !== null && origin !== 'http://' + expectedHost(port)) return { ok: false, status: 403, reason: 'bad_origin' };
  return { ok: true };
}

export function isCrossSite(headers: HeaderBag): boolean {
  const site = headers.get('sec-fetch-site');
  return site === 'cross-site' || site === 'same-site';
}

// Host and Origin first, then the fetch-metadata refusal. Used by the sign-in
// exchange before it touches the code, and by every state-changing or reading route.
export function checkRequest(headers: HeaderBag, port: number): GuardOk | GuardRefusal {
  const base = checkHostOrigin(headers, port);
  if (!base.ok) return base;
  if (isCrossSite(headers)) return { ok: false, status: 403, reason: 'cross_site' };
  return { ok: true };
}
