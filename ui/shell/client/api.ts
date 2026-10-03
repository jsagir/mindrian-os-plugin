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
