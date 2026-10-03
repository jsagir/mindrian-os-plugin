/*
 * snapshot.ts -- the two small server helpers the slice actions and the fixed
 * proposal source share: a per-session CallTool over the pool, and a snapshot
 * of the nodes collection through room_changes (D-06: the pool is the only door).
 */
import type { CallResult } from 'mos-ui-shared/mcp-session-pool';
import type { CallTool } from 'mos-ui-shared/generated/mcp-adapter';
import { shared } from './pool';

// The wrappers take a CallTool; ours returns the pool's CallResult.
export function callFor(sessionKey: string): CallTool {
  return (tool, args) => shared().pool.call(sessionKey, tool, args);
}

type NodeDoc = { id: string; type?: string; title?: string; status?: string; section?: string };

// room_changes on the nodes collection in snapshot mode: the current rows with
// one as_of_seq. Used by the listEvidence action and by the fixed proposal
// source, which needs the evidence ids on the page.
export async function snapshotNodes(sessionKey: string): Promise<
  { ok: true; room: string | null; epoch: string | null; as_of_seq: number | null; nodes: NodeDoc[] } | { ok: false; reason: string; detail?: string }
> {
  const res = (await callFor(sessionKey)('room_changes', { collection: 'nodes', mode: 'snapshot', limit: 200 })) as CallResult;
  const d = res.data as {
    ok?: boolean;
    reason?: string;
    room?: string;
    epoch?: string;
    as_of_seq?: number;
    docs?: Array<Record<string, unknown>>;
  } | null;
  if (res.isError || !d || d.ok === false) {
    const reason = d && typeof d.reason === 'string' ? d.reason : /unknown tool|not found|-32601|-32602/i.test(res.text) ? 'feed_unavailable' : 'feed_error';
    return { ok: false, reason, detail: res.text.slice(0, 300) };
  }
  // Snapshot mode answers `docs` (current rows, one as_of_seq), not change rows.
  const nodes: NodeDoc[] = [];
  for (const doc of d.docs || []) {
    const id = String(doc.id || '');
    if (!id) continue;
    nodes.push({
      id,
      type: typeof doc.type === 'string' ? doc.type : undefined,
      title: typeof doc.title === 'string' ? doc.title : undefined,
      status: typeof doc.status === 'string' ? doc.status : undefined,
      section: typeof doc.section === 'string' ? doc.section : undefined,
    });
  }
  return {
    ok: true,
    room: typeof d.room === 'string' ? d.room : null,
    epoch: typeof d.epoch === 'string' ? d.epoch : null,
    as_of_seq: typeof d.as_of_seq === 'number' ? d.as_of_seq : null,
    nodes,
  };
}

