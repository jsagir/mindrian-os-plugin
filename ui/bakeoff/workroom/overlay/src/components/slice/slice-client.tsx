'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReadOnlyMarkdown } from '../read-only-markdown';
import { GateCard } from './gate-card';
import { action, postJson } from '../../lib/slice-api';
import type { Proposed } from '../../lib/slice-api';

type Doc = Record<string, unknown> & { id: string };
type Collection = { find: () => { $: { subscribe: (fn: (docs: Array<{ toJSON: () => Doc }>) => void) => { unsubscribe: () => void } } } };
type ReplicaHandle = {
  db: unknown;
  awaitInitialReplication: () => Promise<void>;
  close: () => Promise<void>;
};

type Phase = 'opening' | 'ready' | 'error';

// The whole D-05 slice on one page: the room is opened through the openRoom
// action, one artifact is shown read-only, "Ask Claude" mints a gate on this
// browser's session, Confirm answers it, and the evidence and decisions lists
// are fed by the replica, which pulls the room_changes feed when a hint arrives.
export function SliceClient({ room, artifact }: { room: string; artifact: string }) {
  const [phase, setPhase] = useState<Phase>('opening');
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [artifactNote, setArtifactNote] = useState<string | null>(null);
  const [feed, setFeed] = useState<'starting' | 'live' | 'unavailable'>('starting');
  const [feedNote, setFeedNote] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Doc[]>([]);
  const [decisions, setDecisions] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [proposed, setProposed] = useState<Proposed | null>(null);
  const [asking, setAsking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);
  const replicaRef = useRef<ReplicaHandle | null>(null);

  // 1. open the room (human action), then show the artifact (read action).
  useEffect(() => {
    let live = true;
    (async () => {
      const opened = await action<{ ok?: boolean; reason?: string }>('openRoom', { roomSlug: room });
      if (!live) return;
      if (opened.status !== 200 || opened.body.ok !== true) {
        setPhase('error');
        setError(opened.body.reason === 'not_signed_in' ? 'Not signed in. Reload the page.' : 'The room could not be opened (' + (opened.body.reason || opened.status) + ').');
        return;
      }
      setPhase('ready');
      const art = await action<{ ok?: boolean; reason?: string; markdown?: string; truncated?: boolean }>('readArtifact', { path: artifact });
      if (!live) return;
      if (art.body.ok === true) {
        setMarkdown(art.body.markdown || '');
        if (art.body.truncated) setArtifactNote('Shown truncated.');
      } else {
        setArtifactNote('The document could not be read (' + (art.body.reason || art.status) + ').');
      }
    })().catch(() => {
      if (live) {
        setPhase('error');
        setError('The server could not be reached.');
      }
    });
    return () => {
      live = false;
    };
  }, [room, artifact]);

  // 2. the replica: pull the feed through the server, wake on hints.
  useEffect(() => {
    if (phase !== 'ready') return;
    let live = true;
    (async () => {
      const probe = await postJson<{ ok?: boolean; reason?: string; epoch?: string; room?: string }>('/api/feed/changes', {
        collection: 'nodes',
        mode: 'snapshot',
        limit: 1,
      });
      if (!live) return;
      if (probe.body.ok === false || typeof probe.body.epoch !== 'string') {
        setFeed('unavailable');
        setFeedNote(probe.body.reason || 'feed_unavailable');
        return;
      }
      const epoch = probe.body.epoch;
      const roomId = typeof probe.body.room === 'string' ? probe.body.room : room;
      const { openReplica } = await import('mos-ui-shared/replica');
      const replica = (await openReplica({
        roomKey: room,
        epoch,
        fetchPage: async (collection, checkpoint, batchSize) => {
          const r = await postJson<Record<string, unknown>>('/api/feed/changes', {
            collection,
            after: checkpoint ? checkpoint.seq : 0,
            epoch: checkpoint ? checkpoint.epoch : undefined,
            limit: batchSize,
          });
          return r.body;
        },
        hints: (listener) => {
          const es = new EventSource('/api/feed/hint?room=' + encodeURIComponent(roomId));
          es.addEventListener('hint', () => listener());
          es.onopen = () => listener();
          return () => es.close();
        },
        onReset: () => {
          setFeedNote('The local copy was rebuilt.');
        },
      })) as unknown as ReplicaHandle;
      if (!live) {
        await replica.close();
        return;
      }
      replicaRef.current = replica;
      const db = replica.db as unknown as { nodes: Collection; decisions: Collection };
      db.nodes.find().$.subscribe((docs) => live && setNodes(docs.map((d) => d.toJSON())));
      db.decisions.find().$.subscribe((docs) => live && setDecisions(docs.map((d) => d.toJSON())));
      setFeed('live');
    })().catch((err) => {
      if (!live) return;
      setFeed('unavailable');
      setFeedNote(err && typeof err === 'object' && 'message' in err ? String((err as Error).message).slice(0, 160) : 'feed_error');
    });
    return () => {
      live = false;
      const r = replicaRef.current;
      replicaRef.current = null;
      if (r) void r.close();
    };
  }, [phase, room]);

  const claims = nodes.filter((n) => typeof n.type === 'string' && n.type.toLowerCase() === 'claim');
  const choices = claims.length > 0 ? claims : nodes;
  const subject = selected && choices.some((n) => n.id === selected) ? selected : choices[0]?.id || null;
  const subjectDoc = choices.find((n) => n.id === subject);

  const ask = useCallback(async () => {
    if (!subject) return;
    setAsking(true);
    setRecorded(null);
    setProposed(null);
    try {
      const r = await postJson<Proposed>('/api/ask', {
        roomSlug: room,
        selectedNodeId: subject,
        question: 'Does this claim have enough evidence?',
      });
      setProposed(r.body);
    } finally {
      setAsking(false);
    }
  }, [room, subject]);

  const confirm = useCallback(
    async (optionId: string) => {
      if (!proposed || !proposed.gate_id) return;
      setConfirming(true);
      try {
        const r = await action<{ ok?: boolean; verdict?: string; answer?: { reason?: string } | null }>('approveDecision', {
          gateId: proposed.gate_id,
          chosen: optionId,
        });
        if (r.body.ok) {
          setRecorded('Recorded: ' + (r.body.verdict || optionId) + '.');
          setProposed(null);
        } else {
          setRecorded('Not recorded (' + ((r.body.answer && r.body.answer.reason) || (r.body as { reason?: string }).reason || r.status) + ').');
        }
      } finally {
        setConfirming(false);
      }
    },
    [proposed],
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <header className="lg:col-span-2 flex items-baseline justify-between gap-4 border-b-2 border-mos-black pb-3">
        <h1 className="mos-h1 text-3xl">{room}</h1>
        <Link href="/" className="font-mono text-xs text-mos-muted hover:text-mos-blue">All rooms</Link>
      </header>

      {phase === 'error' && (
        <p className="lg:col-span-2 border-2 border-mos-red p-3 text-sm" role="alert">{error}</p>
      )}

      <main className="min-w-0">
        <div className="mos-eyebrow mb-2 text-mos-muted">Document: {artifact}</div>
        {markdown !== null ? (
          <div className="border-2 border-mos-black bg-mos-soft p-2">
            <ReadOnlyMarkdown markdown={markdown} />
          </div>
        ) : (
          <p className="text-sm text-mos-muted">{phase === 'opening' ? 'Opening the room...' : artifactNote || 'No document.'}</p>
        )}
        {markdown !== null && artifactNote && <p className="mt-2 text-sm text-mos-muted">{artifactNote}</p>}
      </main>

      <aside className="flex min-w-0 flex-col gap-5">
        <section aria-label="Evidence">
          <div className="mos-eyebrow mb-2 text-mos-muted">Evidence {feed === 'live' ? '(' + choices.length + ')' : ''}</div>
          {feed === 'starting' && <p className="text-sm text-mos-muted">Connecting to the room feed...</p>}
          {feed === 'unavailable' && (
            <p className="border-2 border-mos-yellow p-2 text-sm" data-testid="feed-unavailable">
              The room feed is not available yet ({feedNote}). The document above still reads through the server.
            </p>
          )}
          {feed === 'live' && choices.length === 0 && <p className="text-sm text-mos-muted">Nothing in this room yet.</p>}
          <ul className="flex flex-col gap-1" data-testid="evidence-list">
            {choices.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setSelected(n.id)}
                  className={'w-full border-2 px-3 py-2 text-left text-sm ' + (n.id === subject ? 'border-mos-blue bg-white' : 'border-mos-line')}
                >
                  <span className="block font-mono text-[11px] text-mos-muted">{String(n.type || 'node')} {n.status ? ' / ' + String(n.status) : ''}</span>
                  {String(n.title || n.id)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Ask Claude">
          <button
            type="button"
            onClick={ask}
            disabled={!subject || asking || feed !== 'live'}
            className="w-full border-2 border-mos-black bg-mos-yellow px-4 py-2 text-left font-semibold disabled:opacity-50"
            data-testid="ask-claude"
          >
            {asking ? 'Asking Claude...' : 'Ask Claude: does this claim have enough evidence?'}
          </button>
          {subjectDoc && <p className="mt-1 font-mono text-[11px] text-mos-muted">About: {String(subjectDoc.title || subjectDoc.id)}</p>}
          {proposed && proposed.ok === false && (
            <p className="mt-2 border-2 border-mos-red p-2 text-sm" role="alert">No proposal ({proposed.reason || 'unknown'}).</p>
          )}
        </section>

        {proposed && proposed.ok && <GateCard key={proposed.gate_id} proposed={proposed} busy={confirming} onConfirm={confirm} />}
        {recorded && <p className="border-2 border-mos-black bg-mos-soft p-2 text-sm" data-testid="gate-recorded">{recorded}</p>}

        <section aria-label="Decisions">
          <div className="mos-eyebrow mb-2 text-mos-muted">Decisions {feed === 'live' ? '(' + decisions.length + ')' : ''}</div>
          <ul className="flex flex-col gap-1" data-testid="decision-list">
            {decisions.map((d) => (
              <li key={d.id} className="border-2 border-mos-line px-3 py-2 text-sm">
                <span className="block font-mono text-[11px] text-mos-muted">{String(d.verdict || 'decision')}</span>
                {String(d.title || d.id)}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
