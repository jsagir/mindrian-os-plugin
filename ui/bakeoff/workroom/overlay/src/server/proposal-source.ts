/*
 * proposal-source.ts -- who fills the proposal (D-14), chosen by environment.
 *
 *   MOS_PROPOSAL_SOURCE=fixed    (default) the deterministic source from
 *                                ui/shared (fixedProposalSource): the same
 *                                three options and a recommendation, with the
 *                                evidence ids read from the room's snapshot.
 *   MOS_PROPOSAL_SOURCE=adapter  plan 14's ui/shared/src/claude-adapter.ts,
 *                                loaded at run time from the repo (a variable
 *                                file URL the bundler is told to leave alone,
 *                                because Node refuses type stripping under
 *                                node_modules and the adapter must not be
 *                                copied into this tree). Plan 18 measures with
 *                                this setting.
 *
 * MOS_SHARED_DIR names the ui/shared directory (serve.sh sets it);
 * MOS_ADAPTER_MODULE overrides the adapter file path outright.
 */
import { pathToFileURL } from 'node:url';
import { fixedProposalSource } from 'mos-ui-shared/proposal';
import type { ProposalRequest, ProposalSource } from 'mos-ui-shared/proposal';
import { daemonUrl, shared } from './pool';
import { snapshotNodes } from './snapshot';

const EVIDENCE_TYPES = /evidence|source|citation|fact/i;

async function evidenceIds(sessionKey: string, selectedNodeId: string): Promise<string[]> {
  const snap = await snapshotNodes(sessionKey);
  if (!snap.ok) return [];
  const evidence = snap.nodes.filter((n) => n.id !== selectedNodeId && n.type && EVIDENCE_TYPES.test(n.type));
  return evidence.slice(0, 20).map((n) => n.id);
}

function fixedSource(sessionKey: string): ProposalSource {
  return {
    async propose(req: ProposalRequest) {
      const ids = await evidenceIds(sessionKey, req.selectedNodeId);
      const have = ids.length;
      return fixedProposalSource({
        subject_node_id: req.selectedNodeId,
        verdict_options: [
          { id: 'approve', label: 'Enough evidence', description: 'Confirm this claim on the evidence on the page.' },
          { id: 'hold', label: 'Needs more evidence', description: 'Keep the claim proposed and gather more.' },
          { id: 'reject', label: 'Not supported', description: 'Close the claim as unsupported.' },
        ],
        recommended_id: have > 0 ? 'approve' : 'hold',
        evidence_node_ids: ids,
        rationale:
          have > 0
            ? 'Fixed proposal for measurement: ' + have + ' evidence node(s) sit in this room next to the claim.'
            : 'Fixed proposal for measurement: no evidence node was found in this room for the claim.',
      }).propose(req);
    },
  };
}

async function adapterSource(): Promise<ProposalSource> {
  const file =
    process.env.MOS_ADAPTER_MODULE ||
    (process.env.MOS_SHARED_DIR ? process.env.MOS_SHARED_DIR.replace(/\/$/, '') + '/src/claude-adapter.ts' : '');
  if (!file) throw new Error('MOS_PROPOSAL_SOURCE=adapter needs MOS_SHARED_DIR or MOS_ADAPTER_MODULE');
  const href = pathToFileURL(file).href;
  let mod: Record<string, unknown>;
  try {
    mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ href)) as Record<string, unknown>;
  } catch (err) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : String(err);
    throw new Error('adapter module unavailable (plan 14 not landed?): ' + message.slice(0, 200));
  }
  if (typeof mod.headlessClaudeProposalSource === 'function') {
    return (mod.headlessClaudeProposalSource as (o: Record<string, unknown>) => ProposalSource)({ daemonUrl: daemonUrl() });
  }
  if (typeof mod.roomProposalSource === 'function') {
    return (mod.roomProposalSource as (o: Record<string, unknown>) => ProposalSource)({ pool: shared().pool });
  }
  throw new Error('adapter module exports no known proposal source');
}

export async function makeProposalSource(opts: { sessionKey: string }): Promise<ProposalSource> {
  const mode = process.env.MOS_PROPOSAL_SOURCE || 'fixed';
  if (mode === 'adapter') return adapterSource();
  if (mode !== 'fixed') throw new Error('MOS_PROPOSAL_SOURCE must be fixed or adapter');
  return fixedSource(opts.sessionKey);
}
