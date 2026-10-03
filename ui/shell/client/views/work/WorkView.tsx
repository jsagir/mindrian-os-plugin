'use client';
// The Hooked opening screen (D-09, UI-SPEC "Opening screen: the Work view"). It answers what am I trying to
// resolve (the room's question, the one H1), what do I know ("Since you were here", or honestly "What the room
// holds now"), and what needs my attention next (the Next decision panel). Asymmetric: a dominant text region
// in columns 1-8 and the paper-deep decision panel in 9-12; on phones the order is question, Next decision, then
// Since you were here. The one cobalt circle of the view precedes the "Current question" eyebrow.
import { useEffect, useState } from 'react';
import { callAction } from '../../api.ts';
import { CURRENT_QUESTION, NO_QUESTION, READING } from '../../copy.ts';
import { useShell } from '../../frame/shell-context.ts';
import { useCollection } from '../../replica/useCollection.ts';
import { useReplica } from '../../replica/ReplicaProvider.tsx';
import { Rule } from '../../primitives/Rule.tsx';
import { StateMark } from '../../primitives/StateMark.tsx';
import { questionOf } from '../format.ts';
import { useHeadingFocus } from '../hooks.ts';
import type { RoomDoc } from '../hooks.ts';
import { NextDecisionPanel } from './NextDecisionPanel.tsx';
import { SinceLastVisit } from './SinceLastVisit.tsx';

type RoomAnswer = { ok?: boolean; room?: { question?: unknown; has_question?: unknown } };

export function WorkView() {
  const heading = useHeadingFocus();
  const replica = useReplica();
  const { current } = useShell();
  const room = useCollection<RoomDoc>('room');
  const doc = room.docs.find((d) => d.id === 'room');
  const copied = questionOf(doc?.question);

  // The room document in the copy always carries some question text (the room's own sentence when none is
  // recorded, and the question card's lines around the question when one is), so the question is read out of that
  // text (questionOf) and whether the room HAS one is asked of the room itself (roomDoc, a read action).
  const [asked, setAsked] = useState<{ done: boolean; has: boolean; question: string }>({ done: false, has: false, question: '' });
  useEffect(() => {
    let live = true;
    void callAction<RoomAnswer>('roomDoc')
      .then((res) => {
        if (!live) return;
        const r = res.body && res.body.ok !== false ? res.body.room : undefined;
        if (r) setAsked({ done: true, has: r.has_question === true, question: questionOf(typeof r.question === 'string' ? r.question : '') });
        else setAsked({ done: true, has: copied !== '', question: copied });
      })
      .catch(() => {
        if (live) setAsked({ done: true, has: copied !== '', question: copied });
      });
    return () => {
      live = false;
    };
    // Asked again when the room's own question text changes in the copy or another room opens.
  }, [current, copied]);

  const question = asked.has ? copied || asked.question : '';
  // Until the room has answered, the one H1 says what the view is doing.
  const reading = !asked.done;

  return (
    <div className="work grid" data-view="work">
      <section className="work-question stack" aria-label={CURRENT_QUESTION}>
        <Rule />
        <p className="eyebrow work-eyebrow">
          <StateMark shape="circle" />
          <span>{CURRENT_QUESTION}</span>
        </p>
        {reading ? (
          <h1 ref={heading} tabIndex={-1}>
            {replica.loadingLine ?? READING}
          </h1>
        ) : question !== '' ? (
          <h1 ref={heading} tabIndex={-1} data-question="">
            {question}
          </h1>
        ) : (
          <>
            <h1 ref={heading} tabIndex={-1} data-question="empty">
              {NO_QUESTION.heading.before}
              <em>{NO_QUESTION.heading.emphasis}</em>
              {NO_QUESTION.heading.after}
            </h1>
            <p>{NO_QUESTION.body}</p>
          </>
        )}
      </section>
      <NextDecisionPanel />
      <SinceLastVisit />
    </div>
  );
}
