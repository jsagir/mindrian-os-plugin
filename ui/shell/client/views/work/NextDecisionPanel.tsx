'use client';
// The view's one dominant action region (UI-SPEC Opening screen). With a gate waiting it names the next decision,
// why it is asked, how much evidence stands behind it, and offers the one primary action (the view's one ochre
// triangle). With none waiting it says so and offers the evidence instead. It reads; it never answers a decision:
// approval is the gate view's alone (D-15).
import { useEffect, useState } from 'react';
import { callAction } from '../../api.ts';
import {
  evidenceCount,
  moreWaiting,
  NEXT_DECISION,
  NO_DECISION_WAITING,
  OPEN_THE_EVIDENCE,
  REVIEW_NEXT_DECISION,
} from '../../copy.ts';
import { ActionButton } from '../../primitives/ActionButton.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { useOpenGates } from '../hooks.ts';

type GateDetail = { why: string; evidence: number };

export function NextDecisionPanel() {
  const { gates, ready } = useOpenGates();
  const next = gates[0];
  const gateId = next ? next.gate_id : null;
  const [detail, setDetail] = useState<GateDetail | null>(null);

  // The gate card carries the rationale and the evidence ids; the list does not. The nonce readGate issues is
  // not kept here: only the gate view that shows the card for answering holds one (client/api.ts readGate).
  useEffect(() => {
    setDetail(null);
    if (gateId === null) return;
    let live = true;
    void callAction<{ ok?: boolean; gate?: { rationale?: unknown; evidence_node_ids?: unknown } }>('readGate', { gate_id: gateId })
      .then((res) => {
        if (!live || !res.body || res.body.ok === false || !res.body.gate) return;
        const why = typeof res.body.gate.rationale === 'string' ? res.body.gate.rationale : '';
        const evidence = Array.isArray(res.body.gate.evidence_node_ids) ? res.body.gate.evidence_node_ids.length : 0;
        setDetail({ why, evidence });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [gateId]);

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
          {detail && detail.why ? <p className="work-panel-why">{detail.why}</p> : null}
          {detail && detail.evidence > 0 ? (
            <p>
              <TextAction href={'/gate/' + encodeURIComponent(next.gate_id)}>{evidenceCount(detail.evidence)}</TextAction>
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
