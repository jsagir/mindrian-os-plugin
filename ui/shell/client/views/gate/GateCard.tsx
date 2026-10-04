'use client';
// The fourth render of the Shape F gate (UI-SPEC Gate Button Anatomy and States). It draws what the view model says
// and what the state machine is in; it holds no state of its own and calls nothing. Parts, top to bottom: the
// eyebrow (the black decision-gate square with "WAITING FOR YOU", then "DECISION / {room}", then "N more waiting"),
// the H1 (the card header), the subject block, the provenance line (agent proposals only), the notice band, the answer
// box (a fieldset of OptionRows), the one primary action (the view's one ochre triangle), Reject, "Decide later" and
// the helper line. Room and proposal text reaches the page only as React text. Plan 369-44: a gate raised outside this
// browser says so in the provenance line; a failed lookup keeps the gate and offers Check again; a verdict that did
// not fit the chosen option shows its own refusal above the options, which stay enabled.
import type { ReactNode } from 'react';
import { GATE, gateEyebrowKind, gateMoreWaitingConsequence, gatePersistenceCopy, GATE_CHOICE_REFUSED, GATE_VERDICT_MISMATCH, gateRefusalCopy, moreWaiting } from '../../copy.ts';
import { ActionButton } from '../../primitives/ActionButton.tsx';
import type { ActionState } from '../../primitives/ActionButton.tsx';
import { InlineError } from '../../primitives/InlineError.tsx';
import { Rule } from '../../primitives/Rule.tsx';
import { StateMark } from '../../primitives/StateMark.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { TileMark } from '../../primitives/TileMark.tsx';
import type { Tile } from '../../primitives/TileMark.tsx';
import { approveLabelFor, consequenceFor, verdictForSelection } from './gate-model.ts';
import type { GateState, GateViewModel, Verdict } from './gate-model.ts';
import { OptionRow } from './OptionRow.tsx';

export type GateSubject = { text: string; tile: Tile; status: string; meta: string };

export type GateCardProps = {
  vm: GateViewModel;
  state: GateState;
  selected: string[];
  onChoose: (id: string, checked: boolean) => void;
  // fromSelection: the primary action, which answers with what is selected; Reject and Decide later name their own option.
  onAnswer: (verdict: Verdict, fromSelection: boolean) => void;
  onCheckAgain: () => void;
  // "Check again" after the room could not be asked (the lookup_failed refusal): the gate is opened again.
  onReopen: () => void;
  subject: GateSubject | null;
  // The label of the option the person answered with (the H1 after the answer), when known.
  answeredLabel: string | null;
  // The next waiting decision, when another is open (the primary action after an answer).
  nextGate: { gate_id: string } | null;
  headingRef: (el: HTMLHeadingElement | null) => void;
  statusRef: (el: HTMLParagraphElement | null) => void;
  // The room's name for the refusal copy (the card's room, or the one a refusal names).
  refusalRoom: string;
  // The checking state has run several times without an answer.
  stalled: boolean;
  // The evidence region: beside the card on a desktop (columns 8-12), under the subject on a phone.
  evidence: ReactNode;
};

function go(path: string) {
  return () => {
    window.location.assign(path);
  };
}

export function GateCard(props: GateCardProps) {
  const { vm, state, selected, onChoose, onAnswer, onCheckAgain, onReopen, subject, answeredLabel, nextGate, headingRef, statusRef, refusalRoom, stalled, evidence } = props;
  const phase = state.phase;
  const waitingPhase = phase === 'opening' || phase === 'ready' || phase === 'saving' || phase === 'checking';
  const ready = phase === 'ready';
  const settled = phase === 'recorded';
  const refused = phase === 'refused';


  const primaryState: ActionState = phase === 'saving' || phase === 'checking' ? 'saving' : ready && selected.length > 0 ? 'idle' : 'disabled';
  const primaryLabel = phase === 'saving' ? GATE.saving : phase === 'checking' ? GATE.checking : approveLabelFor(vm, selected);
  const primaryConsequence = phase === 'saving' || phase === 'checking' ? undefined : consequenceFor(vm, selected);

  const answerError =
    ready && state.error !== undefined
      ? state.error === 'persistence_failed'
        ? gatePersistenceCopy()
        : state.error === 'choice_refused'
          ? GATE_CHOICE_REFUSED
          : state.error === 'verdict_mismatch'
            ? GATE_VERDICT_MISMATCH
            : gateRefusalCopy('default', '')
      : null;

  const recordedVerdict = settled ? state.verdict : null;
  const recordedStatus = settled ? (state.replayed ? GATE.replayed : recordedVerdict === 'approve' ? GATE.recordedApprove : GATE.recordedOther) : '';
  // After an answer the H1 is the answer and a period; with neither the answer nor the card to name it, the status.
  const title = phase === 'opening' ? GATE.opening : settled ? ((answeredLabel ?? vm.header) !== '' ? (answeredLabel ?? vm.header) + '.' : recordedStatus) : vm.header;
  const recordedBody = recordedVerdict === 'approve' ? GATE.recordedApproveBody : GATE.recordedOtherBody;

  return (
    <section className="gate-card" data-view="gate" data-state={phase} data-refusal={refused ? state.refusal : undefined} data-pending={phase === 'saving' || phase === 'checking' ? 'true' : 'false'}>
      <Rule />
      <p className="eyebrow gate-eyebrow">
        {waitingPhase ? <TileMark tile="black" status={GATE.eyebrowStatus} /> : null}
        <span>{gateEyebrowKind(vm.roomName)}</span>
        {vm.moreWaiting > 0 ? <span className="gate-more">{moreWaiting(vm.moreWaiting)}</span> : null}
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="gate-title">
        {title}
      </h1>

      {phase !== 'opening' ? (
        <>
          {vm.subjectId !== null ? (
            subject ? (
              <div className="gate-subject stack">
                <p className="gate-subject-text">{subject.text}</p>
                <p className="gate-subject-meta">
                  <TileMark tile={subject.tile} status={subject.status} />
                  {subject.meta ? <span>{subject.meta}</span> : null}
                </p>
              </div>
            ) : (
              <p className="caption gate-subject-id">{vm.subjectId}</p>
            )
          ) : null}
          {vm.provenanceLine ? <p className="gate-provenance">{vm.provenanceLine}</p> : null}
          {evidence}
        </>
      ) : null}

      {settled ? (
        <div className="gate-recorded stack" data-verdict={recordedVerdict} data-replayed={state.replayed ? 'true' : 'false'}>
          <p ref={statusRef} tabIndex={-1} className="gate-status" data-tone={recordedVerdict === 'approve' ? 'success' : 'ink'} data-gate-status="recorded">
            {recordedVerdict === 'approve' ? <StateMark shape="square" /> : null}
            <span>{recordedStatus}</span>
          </p>
          <p>{recordedBody}</p>
          {nextGate ? (
            <ActionButton
              label={GATE.nextDecision.label}
              consequence={gateMoreWaitingConsequence(vm.moreWaiting > 0 ? vm.moreWaiting : 1)}
              onClick={go('/gate/' + encodeURIComponent(nextGate.gate_id))}
            />
          ) : (
            <ActionButton label={GATE.backToWork.label} consequence={GATE.backToWork.consequence} onClick={go('/')} />
          )}
        </div>
      ) : phase === 'opening' ? null : (
        <>
          {vm.notice ? <p className="gate-notice">{vm.notice}</p> : null}
          <fieldset className="gate-answer" disabled={!ready} data-mode={vm.selectMode}>
            <legend>{vm.selectMode === 'multi' ? GATE.answerLegendMulti : GATE.answerLegend}</legend>
            <ul className="gate-options">
              {vm.options.map((option) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  name={'gate-option'}
                  mode={vm.selectMode}
                  checked={selected.includes(option.id)}
                  disabled={!ready}
                  onChoose={onChoose}
                />
              ))}
            </ul>
          </fieldset>

          {refused ? (
            <div className="gate-refusal" data-refusal={state.refusal}>
              <InlineError
                {...gateRefusalCopy(state.refusal, refusalRoom)}
                action={
                  state.refusal === 'stale_subject' && vm.subjectId !== null ? (
                    <TextAction href={'/evidence?item=' + encodeURIComponent(vm.subjectId)}>{GATE.seeWhatChanged}</TextAction>
                  ) : state.refusal === 'lookup_failed' ? (
                    <TextAction onClick={onReopen}>{GATE.checkAgain}</TextAction>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="gate-actions stack">
              {answerError ? (
                <div className="gate-error" data-error={ready ? state.error : undefined}>
                  <InlineError {...answerError} />
                </div>
              ) : null}
              <ActionButton
                label={primaryLabel}
                {...(primaryConsequence !== undefined ? { consequence: primaryConsequence } : {})}
                state={primaryState}
                onClick={() => onAnswer(verdictForSelection(vm, selected), true)}
              />
              <div className="gate-secondary">
                {ready ? (
                  <>
                    <ActionButton label={GATE.reject} variant="secondary" onClick={() => onAnswer('reject', false)} />
                    <TextAction onClick={() => onAnswer('defer', false)}>{GATE.decideLater}</TextAction>
                  </>
                ) : null}
                {phase === 'checking' && stalled ? (
                  <>
                    <p className="caption">{GATE.checkingStalled}</p>
                    <ActionButton label={GATE.checkAgain} variant="secondary" onClick={onCheckAgain} />
                  </>
                ) : null}
              </div>
              <p className="gate-helper caption">{GATE.helper}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
