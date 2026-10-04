'use client';
// Ask Larry about this (plan 369-43, SHELL369-13; 369-ADAPTER-RULING room-proposal). The Evidence reader's one
// primary action. The shell does not run a model and does not start the person's Claude Code: it shows ONE line
// naming the open item (copyReference), the person pastes it to Larry in their own Claude Code, Larry files a
// proposed claim in the room, and the one action here asks the room for it (askClaude), which raises the decision
// on this browser session and opens it. This control never answers a decision and never reads one: a person's click
// in the decision view is the only thing that approves anything (D-15). Everything the room says renders as text.
import { useEffect, useId, useRef, useState } from 'react';
import { copyReference } from 'mos-ui-shared/copy-reference';
import { callAction } from '../../api.ts';
import { ASK_LARRY } from '../../copy.ts';
import { ActionButton } from '../../primitives/ActionButton.tsx';
import { InlineError } from '../../primitives/InlineError.tsx';
import { useAnnounce } from '../../primitives/LiveRegion.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { useReplicaOptional } from '../../replica/ReplicaProvider.tsx';

type Phase = 'idle' | 'checking' | 'none' | 'no-room' | 'unreadable';

type AskAnswer = { ok?: boolean; reason?: string; gate_id?: string };

const MAX_QUESTION = 1000;

// A refusal that means "no room is bound to this browser session" has its own words; no_proposal is the plain
// "nothing filed yet"; every other refusal, or an answer that never came, is "the room could not be read just now".
function phaseFor(body: AskAnswer | null): Phase {
  const reason = body && typeof body.reason === 'string' ? body.reason : '';
  if (reason === 'room_unbound') return 'no-room';
  if (reason === 'no_proposal') return 'none';
  return 'unreadable';
}

export function AskLarry({ nodeId }: { nodeId: string }) {
  const announce = useAnnounce();
  const replica = useReplicaOptional();
  const seq = replica ? replica.seq : null;
  const inputId = useId();
  const lineRef = useRef<HTMLParagraphElement | null>(null);
  const mounted = useRef(true);
  const [question, setQuestion] = useState<string>(ASK_LARRY.defaultQuestion);
  const [phase, setPhase] = useState<Phase>('idle');
  // After the person copies the line, the read copy's change number is remembered; a higher number means something
  // new reached the room. `base` is null until the copy has said its number. The sentence is spoken once per copy.
  const watching = useRef<{ base: number | null; told: boolean } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const w = watching.current;
    if (!w || w.told || seq === null) return;
    if (w.base === null) {
      w.base = seq;
      return;
    }
    if (seq > w.base) {
      w.told = true;
      announce(ASK_LARRY.arrived);
    }
  }, [seq, announce]);

  const asked = question.trim().length > 0 ? question : ASK_LARRY.defaultQuestion;
  const line = copyReference(nodeId, asked);

  const copyLine = async () => {
    watching.current = { base: seq, told: false };
    try {
      await navigator.clipboard.writeText(line);
      announce(ASK_LARRY.copied);
    } catch {
      const el = lineRef.current;
      const selection = window.getSelection();
      if (el && selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      announce(ASK_LARRY.copyRefused);
    }
  };

  const check = async () => {
    setPhase('checking');
    let body: AskAnswer | null = null;
    try {
      const res = await callAction<AskAnswer>('askClaude', { selectedNodeId: nodeId, question: asked.slice(0, MAX_QUESTION) });
      body = res.body;
    } catch {
      body = null;
    }
    if (!mounted.current) return;
    if (body && body.ok === true && typeof body.gate_id === 'string' && body.gate_id.length > 0) {
      window.location.assign('/gate/' + encodeURIComponent(body.gate_id));
      return;
    }
    const next = phaseFor(body);
    setPhase(next);
    const words = next === 'none' ? ASK_LARRY.none : next === 'no-room' ? ASK_LARRY.noRoom : ASK_LARRY.unreadable;
    announce(words.what);
  };

  const words = phase === 'none' ? ASK_LARRY.none : phase === 'no-room' ? ASK_LARRY.noRoom : phase === 'unreadable' ? ASK_LARRY.unreadable : null;

  return (
    <section className="ask-larry stack" data-ask-larry data-state={phase}>
      <h3>{ASK_LARRY.heading}</h3>
      <p>{ASK_LARRY.lead}</p>
      <div className="ask-field">
        <label htmlFor={inputId} className="ask-label">
          {ASK_LARRY.questionLabel}
        </label>
        <input id={inputId} className="ask-input" type="text" value={question} maxLength={MAX_QUESTION} onChange={(event) => setQuestion(event.target.value)} />
      </div>
      <div className="ask-field">
        <span className="ask-label">{ASK_LARRY.lineLabel}</span>
        <p className="ask-line" ref={lineRef} tabIndex={0}>
          {line}
        </p>
        <TextAction onClick={() => void copyLine()}>{ASK_LARRY.copy}</TextAction>
      </div>
      <ActionButton
        label={phase === 'checking' ? ASK_LARRY.checking : ASK_LARRY.check}
        consequence={phase === 'checking' ? undefined : ASK_LARRY.consequence}
        state={phase === 'checking' ? 'saving' : 'idle'}
        onClick={() => void check()}
      />
      {words ? <InlineError what={words.what} why={words.why} fix={words.fix} /> : null}
    </section>
  );
}
