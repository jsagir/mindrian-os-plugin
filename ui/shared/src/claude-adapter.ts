/*
 * claude-adapter.ts -- the Claude adapter, room-proposal path (Phase 369 D-14).
 *
 * Navigator ruling 2026-10-03 on A1 (see 369-ADAPTER-RULING.md): the shell does
 * NOT spawn the person's Claude Code. A proposal arrives through the room:
 *
 *   1. the shell shows the person ONE line (copyReference) naming the selected
 *      node and the question;
 *   2. the person pastes it to Larry in their own Claude Code; Larry files a
 *      proposed claim whose text names the node id;
 *   3. the shell's change feed shows the new claim, and this source reads it
 *      back and maps it to a governed Proposal;
 *   4. the shell raises the gate on the browser session (plan 21), never here.
 *
 * What this module can do: READ. Every call goes through the adapter's OWN MCP
 * session (pool.adapterCall), never the human's session, and only the room
 * binding call and three read tools are named below. It never files, edits or
 * decides anything, never renders or answers a gate, and never holds a gate
 * nonce or a browser cookie. No model key and no model loop live here (SEED-067).
 *
 * The recommendation is read from the room's own record (the claim's standing),
 * not computed by a model: a claim that points at a source recommends approve,
 * anything else recommends hold. Only a human-originated call answers a gate.
 *
 * Erasable TypeScript only: no enum, no namespace, no parameter properties.
 */
import { ProposalSchema } from './proposal.ts';
import type { Proposal, ProposalRequest, ProposalSource } from './proposal.ts';

// The adapter's whole tool vocabulary. Four names, all reads (room_bind only
// binds this adapter's own session to the room; it writes no room data).
export const ADAPTER_READ_TOOLS = Object.freeze(['room_bind', 'claim_read', 'graph_query'] as const);

export type AdapterCallResult = {
  ok: boolean;
  isError: boolean;
  data: unknown;
  text: string;
};

// The one pool method this module touches: createSessionPool(...).adapterCall.
export type AdapterPool = {
  adapterCall: (tool: string, args?: Record<string, unknown>) => Promise<AdapterCallResult>;
};

export type ProposalAnswer =
  | { ok: true; proposal: Proposal; elapsed_ms: number }
  | {
      ok: false;
      reason: 'invalid_request' | 'room_unavailable' | 'no_proposal' | 'proposal_invalid';
      detail?: string;
    };

export type RoomProposalSource = ProposalSource & {
  proposeResult: (request: ProposalRequest) => Promise<ProposalAnswer>;
};

const MAX_QUERY = 200;
const MAX_CANDIDATES = 5;
const MAX_EVIDENCE = 20;
const MAX_QUESTION_IN_REFERENCE = 300;

// What the room's record says about how a claim was checked, in plain words.
const STANDING_WORDS: Record<string, string> = {
  located_source: 'it points at a source and says where in that source to look',
  source_edge: 'it points at a source',
  model_only: 'only a model counter-argument backs it so far',
  none: 'nothing it was checked against is on file yet',
};

const VERDICT_OPTIONS = [
  { id: 'approve', label: 'Approve', description: 'Confirm this claim. Only the person can do this.' },
  { id: 'hold', label: 'Hold', description: 'Keep it proposed and ask for evidence first.' },
  { id: 'reject', label: 'Reject', description: 'Close it as not true. The reason becomes part of the record.' },
];

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// The one line the shell shows the person to paste into their own Claude Code.
// It carries the opaque local node id and the question, nothing else: never a
// gate nonce, never a session cookie.
export function copyReference(selectedNodeId: string, question: string): string {
  const id = oneLine(String(selectedNodeId));
  let q = oneLine(String(question));
  if (q.length > MAX_QUESTION_IN_REFERENCE) q = q.slice(0, MAX_QUESTION_IN_REFERENCE - 3) + '...';
  return (
    'About node ' + id + ': ' + q +
    ' Please file your answer as a proposed claim and write the node id ' + id + ' in the claim text.'
  );
}

export function roomProposalSource(options: { pool: AdapterPool }): RoomProposalSource {
  const pool = options.pool;

  async function proposeResult(request: ProposalRequest): Promise<ProposalAnswer> {
    const started = Date.now();
    const roomSlug = request && typeof request.roomSlug === 'string' ? request.roomSlug : '';
    const nodeId = request && typeof request.selectedNodeId === 'string' ? request.selectedNodeId : '';
    if (!roomSlug || !nodeId || nodeId.length > MAX_QUERY) {
      return { ok: false, reason: 'invalid_request' };
    }

    // Bind the adapter's own session to the room (never the human's session).
    const bound = await pool.adapterCall('room_bind', { room: roomSlug });
    const boundData = asRecord(bound.data);
    if (bound.isError || !boundData || boundData.effective !== true) {
      return { ok: false, reason: 'room_unavailable', detail: 'room_bind' };
    }

    // Proposed claims whose text names the selected node, newest first.
    const listed = await pool.adapterCall('claim_read', { query: nodeId, limit: 20 });
    const listData = asRecord(listed.data);
    if (listed.isError || !listData || !Array.isArray(listData.claims)) {
      return { ok: false, reason: 'room_unavailable', detail: 'claim_read' };
    }
    const wanted = nodeId.toLowerCase();
    const candidates = (listData.claims as unknown[])
      .map(asRecord)
      .filter((c): c is Record<string, unknown> => c !== null)
      .filter((c) => c.review_status === 'proposed' && typeof c.claim_id === 'string' && c.claim_id !== nodeId)
      .slice(0, MAX_CANDIDATES);

    for (const cand of candidates) {
      const claimId = cand.claim_id as string;
      const read = await pool.adapterCall('claim_read', { claim_id: claimId });
      const claimData = asRecord(read.data);
      const claim = claimData ? asRecord(claimData.claim) : null;
      if (read.isError || !claim) continue;
      const text = typeof claim.text === 'string' ? claim.text : '';
      if (!text.toLowerCase().includes(wanted)) continue;
      const confirmation = asRecord(claim.confirmation);
      if (confirmation && confirmation.review_status !== 'proposed') continue;

      // The sources the claim points at, from the claim's own outbound edges.
      const evidence: string[] = [nodeId];
      const hood = await pool.adapterCall('graph_query', { node_id: claimId, max_depth: 1, top_k: MAX_EVIDENCE });
      const hoodData = asRecord(hood.data);
      if (!hood.isError && hoodData && Array.isArray(hoodData.results)) {
        for (const r of hoodData.results as unknown[]) {
          const row = asRecord(r);
          if (row && row.edgeTypeIn === 'SOURCED_FROM' && typeof row.id === 'string' && !evidence.includes(row.id)) {
            evidence.push(row.id);
          }
        }
      }

      const standing = typeof claim.standing === 'string' ? claim.standing : 'none';
      const words = STANDING_WORDS[standing] || STANDING_WORDS.none;
      const recommended = standing === 'located_source' || standing === 'source_edge' ? 'approve' : 'hold';
      const rationale = (
        'Larry filed a proposed claim about ' + nodeId + ': "' + oneLine(text) + '". On the room\'s record, ' +
        words + '. Checked is not confirmed: only you can approve it.'
      ).slice(0, 1200);

      const parsed = ProposalSchema.safeParse({
        subject_node_id: claimId,
        verdict_options: VERDICT_OPTIONS,
        recommended_id: recommended,
        evidence_node_ids: evidence.slice(0, MAX_EVIDENCE),
        rationale: rationale,
      });
      if (!parsed.success) {
        return { ok: false, reason: 'proposal_invalid', detail: parsed.error.issues.map((i) => i.message).join('; ').slice(0, 200) };
      }
      return { ok: true, proposal: parsed.data, elapsed_ms: Date.now() - started };
    }
    return { ok: false, reason: 'no_proposal' };
  }

  return {
    proposeResult,
    // ProposalSource contract: resolve a Proposal or reject with the reason.
    async propose(request: ProposalRequest): Promise<Proposal> {
      const answer = await proposeResult(request);
      if (answer.ok) return answer.proposal;
      throw new Error(answer.reason + (answer.detail ? ': ' + answer.detail : ''));
    },
  };
}
