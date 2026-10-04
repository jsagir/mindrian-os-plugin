'use client';
// The view's one dominant action region (UI-SPEC Opening screen). With a gate waiting it names the next decision,
// why it is asked, how much evidence stands behind it, and offers the one primary action (the view's one ochre
// triangle). With none waiting it says so and offers the evidence instead. A gate Larry raised outside this browser
// says so under its title. It reads the list only; it never reads a gate and never answers a decision: approval is
// the gate view's alone (D-15).
import {
  evidenceCount,
  moreWaiting,
  NEXT_DECISION,
  NO_DECISION_WAITING,
  OPEN_THE_EVIDENCE,
  RAISED_LINE,
  REVIEW_NEXT_DECISION,
} from '../../copy.ts';
import { ActionButton } from '../../primitives/ActionButton.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { useOpenGates } from '../hooks.ts';

export function NextDecisionPanel() {
  const { gates, ready } = useOpenGates();
  const next = gates[0];
  // The why line and the evidence count come from the list. The panel never reads the gate itself: reading a raised
  // gate makes the server raise a mirror and issue a nonce, and only the gate view that shows the card for answering
  // may do that.
  const why = next && typeof next.rationale === 'string' ? next.rationale : '';
  const evidence = next && typeof next.evidence_count === 'number' ? next.evidence_count : 0;
  const raised = next ? next.raised_elsewhere === true : false;

  const go = (path: string) => () => {
    window.location.assign(path);
  };

  return (
    <aside className="work-panel stack" data-surface="deep" aria-labelledby="next-decision-heading">
      <h2 id="next-decision-heading">{NEXT_DECISION}</h2>
      {next ? (
        <>
          {gates.length > 1 ? <p className="eyebrow">{moreWaiting(gates.length - 1)}</p> : null}
          <p className="work-panel-title">{next.header}</p>
          {raised ? <p className="caption work-panel-raised">{RAISED_LINE}</p> : null}
          {why ? <p className="work-panel-why">{why}</p> : null}
          {evidence > 0 ? (
            <p>
              <TextAction href={'/gate/' + encodeURIComponent(next.gate_id)}>{evidenceCount(evidence)}</TextAction>
            </p>
          ) : null}
          <ActionButton label={REVIEW_NEXT_DECISION.label} consequence={REVIEW_NEXT_DECISION.consequence} onClick={go('/gate/' + encodeURIComponent(next.gate_id))} />
        </>
      ) : (
        ready ? (
          <>
            <p>{NO_DECISION_WAITING}</p>
            <ActionButton label={OPEN_THE_EVIDENCE.label} consequence={OPEN_THE_EVIDENCE.consequence} onClick={go('/evidence')} />
          </>
        ) : null
      )}
    </aside>
  );
}
