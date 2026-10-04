// Hooks the five views share (plan 369-25). Views read the room through the browser read copy and call
// actions through client/api.ts only; none of them writes to the room.
import { useCallback, useEffect, useRef, useState } from 'react';
import { callAction } from '../api.ts';
import { useShell } from '../frame/shell-context.ts';
import { useReplicaOptional } from '../replica/ReplicaProvider.tsx';

// The row shapes the projection hands the views (ui/shared/src/projection.ts FIELDS).
export type NodeDoc = {
  id: string;
  revision?: number;
  type?: string;
  title?: string;
  status?: string;
  section?: string;
  source_path?: string;
  created_at?: string;
  provenance?: string;
  confirmed_by?: string;
  confirmed_at?: string;
};
export type RelationDoc = { id: string; source?: string; target?: string; type?: string; status?: string };
export type ArtifactDoc = { id: string; revision?: number; title?: string; section?: string; file?: string; filed_at?: string; status?: string };
export type DecisionDoc = {
  id: string;
  revision?: number;
  title?: string;
  verdict?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  gate_id?: string;
  subject_node_id?: string;
};
export type RoomDoc = { id: string; question?: string; purpose?: string; counts?: Record<string, unknown> };

// One open decision of the bound room (listOpenGates). A gate Larry raised outside this browser carries raised_elsewhere;
// the list also carries the evidence count and, for a gate this shell opened, the rationale (empty for a raised one),
// so a view never has to read the gate itself to describe it (reading raises a mirror and issues a nonce).
export type OpenGate = {
  gate_id: string;
  header: string;
  room: string;
  subject_node_id: string;
  minted_at: number;
  raised_elsewhere?: boolean;
  evidence_count?: number;
  rationale?: string;
};

// The list is read again when the browser's read copy advances, but never more than once a second.
export const OPEN_GATES_MIN_GAP_MS = 1000;

// Focus moves to the H1 on every view change (UI-SPEC Accessibility Contract). The heading is focusable by
// script only (tabIndex -1), so it never becomes a tab stop.
export function useHeadingFocus() {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

// The item a view has open, carried in the address (?item=...) so a link, a reload and the back button all agree.
// Server render and first client render both see "none"; the address is read after mount.
export function useSelectedItem(): [string | null, (id: string | null) => void] {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.search).get('item');
      setSelected(value !== null && value.length > 0 ? value : null);
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  const select = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) url.searchParams.delete('item');
    else url.searchParams.set('item', id);
    window.history.pushState({}, '', url.pathname + url.search);
    setSelected(id);
  }, []);
  return [selected, select];
}

export function itemHref(path: string, id: string): string {
  return path + '?item=' + encodeURIComponent(id);
}

// The open decisions of the bound room, read from the shell server (listOpenGates): the decisions this shell opened
// and the ones Larry raised in other sessions of the room. It reads again when the frame's waiting count changes and
// whenever the read copy advances (seq), so a gate raised in Claude Code shows without a reload. raisedUnavailable is
// true when the room could not be asked for the ones raised elsewhere (the shell's own are still listed).
export function useOpenGates(): { gates: OpenGate[]; ready: boolean; raisedUnavailable: boolean } {
  const { waiting, current } = useShell();
  const replica = useReplicaOptional();
  const seq = replica ? replica.seq : null;
  const [gates, setGates] = useState<OpenGate[]>([]);
  const [ready, setReady] = useState(false);
  const [raisedUnavailable, setRaisedUnavailable] = useState(false);
  const lastRead = useRef(0);
  useEffect(() => {
    let live = true;
    const wait = Math.max(0, lastRead.current + OPEN_GATES_MIN_GAP_MS - Date.now());
    const timer = setTimeout(() => {
      lastRead.current = Date.now();
      void callAction<{ ok?: boolean; gates?: OpenGate[]; raised_unavailable?: boolean }>('listOpenGates')
        .then((res) => {
          if (!live) return;
          const list = res.body && res.body.ok !== false && Array.isArray(res.body.gates) ? res.body.gates : [];
          setGates(list.filter((g) => g && typeof g.gate_id === 'string' && (current === null || g.room === current)));
          setRaisedUnavailable(Boolean(res.body && res.body.raised_unavailable === true));
          setReady(true);
        })
        .catch(() => {
          if (live) setReady(true);
        });
    }, wait);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [waiting, current, seq]);
  return { gates, ready, raisedUnavailable };
}

export function titleOf(doc: { title?: string; id: string } | undefined | null): string {
  if (!doc) return '';
  return typeof doc.title === 'string' && doc.title.trim() !== '' ? doc.title : doc.id;
}
