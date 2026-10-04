'use client';
// The gate view (D-11, D-15, UI-SPEC "Gate view"): one decision per view, the route /gate/:gateId. It reads the gate
// card from the shell server (readGate, which keeps the single-use render nonce in page memory only), draws it as
// the fourth render of the Shape F contract (GateCard), and answers it through approveDecision when, and only when,
// a person clicks. "Recorded" is shown only after the room confirms the save; an answer whose response is lost is
// confirmed by gate id (readGate, then the same answer again, until the room says replayed or refuses) and never
// guessed. While an answer is unconfirmed the session indicator is told (setAnswerPending, plan 369-24).
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { approveDecision, readGate } from '../../api.ts';
import { GATE, GATE_UNREADABLE, gateEvidenceHeading, gateFiled, gateRefusalCopy } from '../../copy.ts';
import { useShell } from '../../frame/shell-context.ts';
import { useShellStatus } from '../../frame/status-context.ts';
import { Rule } from '../../primitives/Rule.tsx';
import { useAnnounce } from '../../primitives/LiveRegion.tsx';
import { useCollection } from '../../replica/useCollection.ts';
import { routeParam } from '../../routes.ts';
import { formatDay, readableDocumentPath } from '../format.ts';
import { titleOf, useOpenGates } from '../hooks.ts';
import type { NodeDoc } from '../hooks.ts';
import { tileFor } from '../tile-model.ts';
import { baseName, LazyDocument } from '../evidence/LazyDocument.tsx';
import { GateCard } from './GateCard.tsx';
import type { GateSubject } from './GateCard.tsx';
import { answerPending, chosenFor, classifyAnswer, GateMappingError, INITIAL_GATE_STATE, nextGateState, toGateViewModel } from './gate-model.ts';
import type { CardIn, GateViewModel, RenderedIn, Verdict } from './gate-model.ts';

export const GATE_ROUTE = '/gate/:gateId';

type GateBody = {
  ok?: boolean;
  reason?: string;
  room?: string;
  gate?: CardIn & { rendered?: RenderedIn };
  answered?: { verdict?: string; chosen?: string[] };
};

// The checking state retries by gate id; after this many tries the page says the room has not answered and offers
// "Check again" (the answer is saved once however often it is asked: the room replays by gate id).
const RETRY_DELAYS_MS = [400, 800, 1500, 2500];
const STALLED_AFTER = 4;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const read = () => setDesktop(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);
  return desktop;
}

// The evidence region (D-11): each evidence node opens inline through the read-only DocumentDisplay. On a desktop it is
// a region beside the card (columns 8-12); on a phone it is a native disclosure under the subject, open by default
// when there are three items or fewer.
function EvidenceRegion({ ids, nodes }: { ids: string[]; nodes: Map<string, NodeDoc> }) {
  const desktop = useDesktop();
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const list =
    ids.length === 0 ? (
      <p className="caption">{GATE.evidenceNone}</p>
    ) : (
      <ul className="gate-evidence-list">
        {ids.map((id) => {
          const node = nodes.get(id);
          const path = node ? readableDocumentPath(node.source_path) : null;
          const status = node ? tileFor({ status: node.status }, { openGate: false, contradicts: null }).status : '';
          return (
            <li key={id} className="gate-evidence-item" data-evidence={id}>
              <details
                onToggle={(event) => {
                  const open = (event.currentTarget as HTMLDetailsElement).open;
                  setOpened((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
              >
                <summary>
                  <span className="gate-evidence-title">{node ? titleOf(node) : id}</span>
                  {status ? <span className="gate-evidence-status">{status}</span> : null}
                </summary>
                {!node ? (
                  <p className="caption">{GATE.evidenceMissing}</p>
                ) : path ? (
                  opened.has(id) ? <LazyDocument path={path} name={baseName(path)} /> : null
                ) : (
                  <p className="caption">{'This item has no source document in the room.'}</p>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    );
  if (desktop) {
    return (
      <aside className="gate-evidence" data-placement="side" aria-label={GATE.evidenceHeading}>
        <h2>{gateEvidenceHeading(ids.length)}</h2>
        {list}
      </aside>
    );
  }
  return (
    <details className="gate-evidence" data-placement="inline" open={ids.length <= 3}>
      <summary>{gateEvidenceHeading(ids.length)}</summary>
      {list}
    </details>
  );
}

function GateLoaded({ gateId }: { gateId: string }) {
  const { refresh } = useShell();
  const { setAnswerPending } = useShellStatus();
  const announce = useAnnounce();
  const nodes = useCollection<NodeDoc>('nodes');
  const { gates } = useOpenGates();

  const [state, dispatch] = useReducer(nextGateState, INITIAL_GATE_STATE);
  const [card, setCard] = useState<(CardIn & { rendered?: RenderedIn }) | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [unreadable, setUnreadable] = useState(false);
  const [refusalRoom, setRefusalRoom] = useState('');
  const [answeredLabelId, setAnsweredLabelId] = useState<string | null>(null);

  const live = useRef(true);
  const inFlight = useRef(false);
  const lastAnswer = useRef<{ verdict: Verdict; chosen: string[] } | null>(null);
  const headingEl = useRef<HTMLHeadingElement | null>(null);
  const statusEl = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const others = gates.filter((g) => g.gate_id !== gateId);

  const vm: GateViewModel | null = useMemo(() => {
    if (!card) return null;
    try {
      return toGateViewModel({ ...card, more_waiting: others.length }, card.rendered ?? null);
    } catch (err) {
      if (err instanceof GateMappingError) return null;
      throw err;
    }
    // others.length, not the array: a new array each render must not rebuild the model.
  }, [card, others.length]);

  useEffect(() => {
    if (card && vm === null) setUnreadable(true);
  }, [card, vm]);

  // ---- opening: read the card (and the render nonce, held in page memory by api.ts) ----
  useEffect(() => {
    let alive = true;
    void readGate<GateBody>(gateId)
      .then((res) => {
        if (!alive || !live.current) return;
        const body = res.body as GateBody;
        if (body && body.ok === true && body.answered) {
          // The room already has this answer. The server keeps the card it was given for, so the recorded state draws
          // with its heading and answer; a card it no longer holds shows the status alone.
          const v = body.answered.verdict;
          const chosen = Array.isArray(body.answered.chosen) ? body.answered.chosen : [];
          setAnsweredLabelId(chosen[0] ?? null);
          setCard(body.gate ?? { header: '' });
          dispatch({ type: 'open_answered', verdict: v === 'reject' || v === 'defer' ? v : 'approve' });
        } else if (body && body.ok === true && body.gate) {
          const gate = body.gate;
          setCard(gate);
          try {
            setSelected(toGateViewModel(gate, gate.rendered ?? null).preselected);
          } catch {
            setSelected([]);
          }
          dispatch({ type: 'opened' });
        } else {
          if (body && typeof body.room === 'string') setRefusalRoom(body.room);
          dispatch({ type: 'open_failed', answer: body });
        }
      })
      .catch(() => {
        // The shell server did not answer: the frame says so; the view keeps its opening line and no answer is guessed.
      });
    return () => {
      alive = false;
    };
  }, [gateId]);

  // ---- focus: the H1 on open, the status line once an answer is recorded ----
  useEffect(() => {
    headingEl.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (state.phase === 'recorded') {
      statusEl.current?.focus({ preventScroll: true });
      announce(state.replayed ? GATE.replayed : state.verdict === 'approve' ? GATE.recordedApprove : GATE.recordedOther);
      void refresh();
    }
    // announce and refresh are stable for the life of the view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // ---- the session indicator's risk tier: an answer is unconfirmed while saving or checking ----
  const confirmOnceRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    setAnswerPending(answerPending(state), () => confirmOnceRef.current());
  }, [state, setAnswerPending]);
  useEffect(
    () => () => {
      setAnswerPending(false);
    },
    [setAnswerPending],
  );

  // ---- answering ----

  // One pass of "was my answer saved?": read the gate by id. If the room records it answered, that is the
  // confirmation. If it is still open, the answer did not land: send the same answer again (the room saves it once).
  // Anything else the room says is a final state. Returns true when the question is settled.
  const confirmOnce = useCallback(async (): Promise<boolean> => {
    const last = lastAnswer.current;
    if (!last) return true;
    let read;
    try {
      read = await readGate<GateBody>(gateId);
    } catch {
      if (live.current) dispatch({ type: 'lost' });
      return false;
    }
    if (!live.current) return true;
    const body = read.body as GateBody;
    if (body && body.ok === true && body.answered) {
      const v = body.answered.verdict;
      // The room confirms the person's own answer was saved: recorded, not "already recorded".
      dispatch({ type: 'answer', answer: { ok: true, replayed: false, verdict: v === 'reject' || v === 'defer' ? v : 'approve' } });
      return true;
    }
    if (body && body.ok === true && body.gate) {
      try {
        const res = await approveDecision<Record<string, unknown>>(gateId, last.chosen, last.verdict);
        if (!live.current) return true;
        dispatch({ type: 'answer', answer: res.body });
        return classifyAnswer(res.body).kind !== 'lost';
      } catch {
        if (live.current) dispatch({ type: 'lost' });
        return false;
      }
    }
    if (body && typeof body.room === 'string') setRefusalRoom(body.room);
    dispatch({ type: 'answer', answer: body && body.ok === false ? body : { ok: false, reason: 'unknown_gate' } });
    return true;
  }, [gateId]);

  const confirmLoop = useCallback(async () => {
    for (let i = 0; i < RETRY_DELAYS_MS.length; i += 1) {
      await sleep(RETRY_DELAYS_MS[i]!);
      if (!live.current) return;
      if (await confirmOnce()) return;
    }
  }, [confirmOnce]);

  confirmOnceRef.current = async () => {
    await confirmOnce();
  };

  const handleAnswerBody = useCallback(
    (body: unknown) => {
      const classified = classifyAnswer(body);
      const rec = body !== null && typeof body === 'object' ? (body as GateBody) : null;
      if (rec && typeof rec.room === 'string') setRefusalRoom(rec.room);
      dispatch({ type: 'answer', answer: body });
      if (classified.kind === 'lost') void confirmLoop();
    },
    [confirmLoop],
  );

  const answer = useCallback(
    async (verdict: Verdict, fromSelection: boolean) => {
      if (!vm || state.phase !== 'ready' || inFlight.current) return;
      // The primary action answers with what is selected (and does nothing with nothing selected); Reject and Decide
      // later name the option that says so.
      const chosen = fromSelection ? selected.slice() : chosenFor(vm, verdict, selected);
      if (chosen.length === 0) return;
      inFlight.current = true;
      lastAnswer.current = { verdict, chosen };
      setAnsweredLabelId(chosen[0] ?? null);
      dispatch({ type: 'submit', verdict });
      try {
        const res = await approveDecision<Record<string, unknown>>(gateId, chosen, verdict);
        if (live.current) handleAnswerBody(res.body);
      } catch {
        // No answer came back. The room may or may not have saved it: confirm by gate id, never guess.
        if (live.current) {
          dispatch({ type: 'lost' });
          void confirmLoop();
        }
      } finally {
        inFlight.current = false;
      }
    },
    [vm, state.phase, selected, gateId, handleAnswerBody, confirmLoop],
  );

  const choose = useCallback(
    (id: string, checked: boolean) => {
      if (!vm) return;
      if (vm.selectMode === 'single') setSelected([id]);
      else setSelected((prev) => (checked ? Array.from(new Set(prev.concat(id))) : prev.filter((x) => x !== id)));
    },
    [vm],
  );

  // ---- what the card draws around the options ----
  const nodeMap = useMemo(() => new Map(nodes.docs.map((d) => [d.id, d])), [nodes.docs]);
  const subject: GateSubject | null = useMemo(() => {
    if (!vm || vm.subjectId === null) return null;
    const node = nodeMap.get(vm.subjectId);
    if (!node) return null;
    const t = tileFor({ status: node.status }, { openGate: false, contradicts: null });
    const filed = node.created_at ? formatDay(node.created_at) : '';
    const file = node.source_path ? baseName(node.source_path) : '';
    return { text: titleOf(node), tile: t.tile, status: t.status, meta: filed ? gateFiled(filed, file) : '' };
  }, [vm, nodeMap]);

  const answeredLabel = vm && answeredLabelId ? (vm.options.find((o) => o.id === answeredLabelId)?.label ?? null) : null;
  const room = state.phase === 'refused' && refusalRoom ? refusalRoom : vm ? vm.roomName : refusalRoom;
  const stalled = state.phase === 'checking' && state.attempt >= STALLED_AFTER;

  // Before the card is read (or when it could not be read) the view is its heading only: the opening line, or, for a
  // gate the person cannot answer at all (gone, another room, drawn wrongly), the refusal in What / Why / Fix.
  if (!vm) {
    const copy = state.phase === 'refused' ? gateRefusalCopy(state.refusal, refusalRoom) : unreadable ? GATE_UNREADABLE : null;
    return (
      <div className="gate" data-view="gate-shell">
        <section className="gate-card" data-view="gate" data-state={unreadable ? 'unreadable' : state.phase} data-refusal={state.phase === 'refused' ? state.refusal : undefined}>
          <Rule />
          <h1 ref={headingEl} tabIndex={-1} className="gate-title">
            {copy ? copy.what : GATE.opening}
          </h1>
          {copy ? <p className="gate-refusal-why">{copy.why}</p> : null}
          {copy ? <p className="gate-refusal-fix">{copy.fix}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="gate" data-view="gate-shell">
      <GateCard
        vm={vm}
        state={state}
        selected={selected}
        onChoose={choose}
        onAnswer={(verdict, fromSelection) => void answer(verdict, fromSelection)}
        onCheckAgain={() => void confirmOnce()}
        subject={subject}
        answeredLabel={answeredLabel}
        nextGate={others[0] ? { gate_id: others[0].gate_id } : null}
        headingRef={(el) => {
          headingEl.current = el;
        }}
        statusRef={(el) => {
          statusEl.current = el;
        }}
        refusalRoom={room}
        stalled={stalled}
        evidence={<EvidenceRegion ids={vm.evidenceIds} nodes={nodeMap} />}
      />
    </div>
  );
}

export function GateView() {
  const { pathname } = useShell();
  const gateId = routeParam(GATE_ROUTE, pathname, 'gateId');
  if (gateId === null || gateId === '') return null;
  return <GateLoaded key={gateId} gateId={gateId} />;
}
