// Browser-side calls to the slice's own server. Same origin only: relative
// URLs, so the browser contacts nothing but the host that served the page.

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  let parsed: unknown = {};
  try {
    parsed = await res.json();
  } catch {
    parsed = {};
  }
  return { status: res.status, body: parsed as T };
}

export function action<T = Record<string, unknown>>(name: string, input: unknown) {
  return postJson<T>('/api/actions/' + encodeURIComponent(name), input);
}

export type GateOption = { id: string; label: string; description?: string | null; rank?: number | null; recommended?: boolean };

export type Proposed = {
  ok: boolean;
  reason?: string;
  gate_id?: string;
  renderer?: string | null;
  rendered?: { contract?: { superset_options?: GateOption[]; notice?: string } } | null;
  options?: GateOption[];
  recommended_id?: string;
  rationale?: string;
  subject_node_id?: string;
  evidence_node_ids?: string[];
};
