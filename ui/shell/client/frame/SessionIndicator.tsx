'use client';
// The session indicator (plan 369-24, D-04, CANON369-06), built exactly as the navigator signed it in
// 369-SESSION-INDICATOR-DESIGN.md ("Q1 A, Q2 B, Q3 B, Q4 A"). The words, marks and fixes come from
// indicatorModel(); this component only draws them: a 12 px StateMark (aria-hidden) beside the state words in
// Label 12 mono, the browser copy line under the healthy words, and the state's one-click fix next to the words
// as a text action. Colour never carries a state alone. The header instance announces each state change once
// through the page's polite live region; the Status panel instance (the phone placement) only draws.
import { useEffect, useRef } from 'react';
import { StateMark } from '../primitives/StateMark.tsx';
import { TextAction } from '../primitives/TextAction.tsx';
import { useAnnounce } from '../primitives/LiveRegion.tsx';
import { announceFor, indicatorModel } from './indicator-model.ts';
import type { IndicatorModel } from './indicator-model.ts';
import { useShellStatus } from './status-context.ts';
import { useShell } from './shell-context.ts';

// The model for the current status, shared by the indicator, the banner and the Status panel.
export function useIndicatorModel(): IndicatorModel {
  const s = useShellStatus();
  return indicatorModel({
    connection: s.connection,
    lastAckAt: s.lastAckAt,
    readAt: s.readAt,
    copyState: s.copyState,
    copySeq: s.copySeq,
    waitingCount: s.waitingCount,
    answerPending: s.answerPending,
  });
}

// The one-click fix, wired to the frame: reconnect asks again, check now verifies the answer, Open Status opens the panel.
export function useIndicatorFix(model: IndicatorModel): (() => void) | null {
  const s = useShellStatus();
  const { setStatusOpen } = useShell();
  if (model.fix === null) return null;
  const action = model.fix.action;
  return () => {
    if (action === 'reconnect') s.reconnect();
    else if (action === 'check-now') s.checkAnswer();
    else setStatusOpen(true);
  };
}

// A brief catch-up or rebuild is not worth speaking: the browser copy states are announced only when they outlast
// this long. It also keeps the indicator from overwriting a message another part of the shell queued a moment
// earlier (the live region keeps one waiting message and the newest replaces it), such as the browser copy's
// "The room was tidied since your last visit" note that arrives together with a rebuild.
export const COPY_ANNOUNCE_DELAY_MS = 2500;

// Says each state change once. The first answer sets the baseline: a healthy first answer is silent.
function useAnnounceChanges(model: IndicatorModel, enabled: boolean) {
  const announce = useAnnounce();
  const { status } = useShell();
  const prev = useRef<IndicatorModel | null>(null); // the last model that was actually spoken or settled on
  const ready = status !== null;
  useEffect(() => {
    if (!enabled || !ready) return;
    const speak = () => {
      const said = announceFor(prev.current, model);
      prev.current = model;
      if (said !== null) announce(said);
    };
    if (model.kind === 'catching-up' || model.kind === 'rebuilding') {
      const timer = setTimeout(speak, COPY_ANNOUNCE_DELAY_MS);
      return () => clearTimeout(timer);
    }
    speak();
  }, [enabled, ready, model.kind, model.announce, announce]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function SessionIndicator({ placement = 'header' }: { placement?: 'header' | 'panel' }) {
  const model = useIndicatorModel();
  const fix = useIndicatorFix(model);
  useAnnounceChanges(model, placement === 'header');

  // The risk sentence carries its fix as its last words ("... Check now"): draw the fix once, as the action.
  const label = model.fix ? model.fix.label : null;
  const sentence = label !== null && model.words.endsWith(label) && model.words.length > label.length ? model.words.slice(0, model.words.length - label.length).trimEnd() : model.words;

  return (
    <div className="session-indicator" data-placement={placement} data-state={model.kind}>
      <p className="si-line" data-line="state">
        <StateMark shape={model.mark} />
        <span className="si-words">{sentence}</span>
        {fix !== null && label !== null ? (
          <span className="si-fix">
            <TextAction onClick={fix}>{label}</TextAction>
          </span>
        ) : null}
      </p>
      {model.copyLine !== null ? (
        <p className="si-line si-copy" data-line="copy">
          {model.copyLine}
        </p>
      ) : null}
    </div>
  );
}
