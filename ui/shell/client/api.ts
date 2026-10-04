// The browser's one client for the shell server. Same origin only (relative URLs), so the browser
// contacts nothing but the host that served the page. The CSRF token comes from a same-origin meta
// tag the server renders for a signed-in session; it is never kept in browser storage.

export class ServerUnreachableError extends Error {}

export const CSRF_META = 'mos-csrf';
export const CSRF_HEADER = 'x-mos-csrf';

function csrfToken(): string {
  const el = document.querySelector('meta[name="' + CSRF_META + '"]');
  return el?.getAttribute('content') ?? '';
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new ServerUnreachableError('the shell server did not answer');
  }
}

export type ApiResult<T> = { status: number; body: T };

async function readJson<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { status: res.status, body: body as T };
}

// POST /api/actions/<name>: the one HTTP entry to actions (plan 369-32 serves it).
export async function callAction<T = Record<string, unknown>>(name: string, input: unknown = {}): Promise<ApiResult<T>> {
  const res = await send('/api/actions/' + encodeURIComponent(name), {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER]: csrfToken() },
    body: JSON.stringify(input ?? {}),
  });
  return readJson<T>(res);
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<ApiResult<T>> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) q.set(k, String(v));
  const qs = q.toString();
  return readJson<T>(await send(path + (qs ? '?' + qs : ''), { method: 'GET' }));
}

// The feed endpoints plan 369-32 serves; written against their names now so 369-32 and plan 23
// import one client.
export const feed = {
  changes: <T = Record<string, unknown>>(params: Record<string, string | number | undefined>) => get<T>('/api/feed/changes', params),
  room: <T = Record<string, unknown>>() => get<T>('/api/feed/room'),
  // The SSE hint stream. The caller owns the EventSource: new EventSource(feed.hintUrl).
  hintUrl: '/api/feed/hint',
  status: <T = Record<string, unknown>>() => get<T>('/api/status'),
};

// ---- the decision loop's human proof (plan 369-21; D-15) ----
//
// readGate hands the page a single-use render nonce for that gate. It lives in this module's memory
// (the page's memory) and nowhere else: no cookie, no storage, no URL, never passed to anything but the
// approveDecision call below. Only a person's click reaches approveDecision; the server accepts it only
// with the nonce it issued to this browser session for this exact gate.

const renderNonces = new Map<string, string>();

// Refusals after which the page has no gate to answer (plan 369-27, from the Phase 289 and plan 369-26 answer set).
const NO_GATE_TO_ANSWER = new Set(['unknown_or_expired_gate', 'unknown_gate', 'gate_expired', 'room_switched']);

type GateAnswer = Record<string, unknown> & { ok?: boolean; reason?: string; render_nonce?: string };

// Read one gate card and keep its render nonce in page memory. The nonce is not part of what the caller gets back.
export async function readGate<T extends GateAnswer = GateAnswer>(gateId: string): Promise<ApiResult<T>> {
  const res = await callAction<T>('readGate', { gate_id: gateId });
  const body = res.body as GateAnswer;
  if (body && body.ok !== false && typeof body.render_nonce === 'string') {
    renderNonces.set(gateId, body.render_nonce);
    const { render_nonce: _drop, ...rest } = body;
    return { status: res.status, body: rest as T };
  }
  renderNonces.delete(gateId);
  return res;
}

// Send the person's decision with the nonce this page was given for that gate. On `human_only` the page
// re-reads the gate once (a fresh nonce) before the refusal copy shows, so the next click is a valid one.
export async function approveDecision<T extends GateAnswer = GateAnswer>(
  gateId: string,
  chosen: string[],
  verdict: 'approve' | 'reject' | 'defer',
): Promise<ApiResult<T>> {
  const nonce = renderNonces.get(gateId);
  const input: Record<string, unknown> = { gate_id: gateId, chosen, verdict };
  if (nonce !== undefined) input.render_nonce = nonce;
  const res = await callAction<T>('approveDecision', input);
  const body = res.body as GateAnswer;
  if (body && body.ok === true) {
    renderNonces.delete(gateId);
  } else if (body && body.reason === 'human_only') {
    renderNonces.delete(gateId);
    await readGate(gateId);
  } else if (body && typeof body.reason === 'string' && NO_GATE_TO_ANSWER.has(body.reason)) {
    // Nothing left to answer: the gate is gone (unknown_gate, gate_expired, the chain tools' older slug) or this
    // browser left its room (room_switched). Drop the nonce; the other refusals keep the gate open and the nonce
    // the next read issues.
    renderNonces.delete(gateId);
  }
  return res;
}
