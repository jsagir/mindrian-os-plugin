/*
 * proposal.ts -- the contract the Claude adapter fills (Phase 369 D-14).
 *
 * The local Claude Code adapter receives selected context from the shell and
 * returns a GOVERNED PROPOSAL: a subject, the verdict options, which one is
 * recommended, the evidence it rests on, and why. It never decides: only a
 * human-originated call may answer a gate (D-15). A fixed source is the
 * deterministic implementation tests and scripted measurement runs use; plan 14
 * adds the headless Claude source against the same ProposalSource type.
 *
 * Erasable TypeScript only.
 */
import { z } from 'zod';

export const ProposalSchema = z
  .object({
    subject_node_id: z.string().min(1).max(200),
    verdict_options: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          label: z.string().min(1).max(200),
          description: z.string().max(600).optional(),
        }),
      )
      .min(1)
      .max(6),
    recommended_id: z.string().min(1).max(100),
    evidence_node_ids: z.array(z.string().min(1).max(200)).max(20),
    rationale: z.string().min(1).max(1200),
  })
  .refine((p) => p.verdict_options.some((o) => o.id === p.recommended_id), {
    message: 'recommended_id must equal one of the verdict option ids',
    path: ['recommended_id'],
  });

export type Proposal = z.infer<typeof ProposalSchema>;

export type ProposalRequest = {
  roomSlug: string;
  selectedNodeId: string;
  question: string;
};

export type ProposalSource = {
  propose: (request: ProposalRequest) => Promise<Proposal>;
};

export function fixedProposalSource(proposal: unknown): ProposalSource {
  const valid = ProposalSchema.parse(proposal);
  return {
    async propose(): Promise<Proposal> {
      return valid;
    },
  };
}
