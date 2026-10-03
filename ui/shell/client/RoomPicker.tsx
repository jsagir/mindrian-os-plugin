'use client';
// The room picker (plan 369-32): lists the rooms on this machine (listRooms), opens one (openRoom) and
// shows the UI-SPEC "No room open" and "no rooms" states. Unstyled: plan 369-20 skins it and moves room
// switching into the header's RoomSelector. Room names render as React text, never as markup.
import { useCallback, useEffect, useState } from 'react';
import { callAction } from './api.ts';
import { LAUNCH_COMMAND, NO_ROOM_OPEN, NO_ROOMS } from './copy.ts';

type RoomsAnswer = { ok?: boolean; reason?: string; rooms?: Array<{ slug: string }>; current?: string | null };
type OpenAnswer = { ok?: boolean; reason?: string; gate_id?: string; room?: string };

// The one confirmation in v1 (369-UI-SPEC.md Destructive confirmation): switching rooms while a decision is open.
const LEAVE = {
  title: 'Leave this decision unanswered?',
  body: (current: string, next: string) =>
    'Your open decision in ' + current + ' closes when you switch to ' + next + '. Nothing is saved. You can ask Larry for it again in Claude Code.',
  primary: (next: string) => 'Switch to ' + next,
  secondary: 'Stay here',
};

export function RoomPicker() {
  const [rooms, setRooms] = useState<string[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<{ next: string; from: string } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await callAction<RoomsAnswer>('listRooms');
      if (res.body.ok === false || !Array.isArray(res.body.rooms)) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setRooms(res.body.rooms.map((r) => r.slug));
      setCurrent(res.body.current ?? null);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(room: string, confirmLeave: boolean) {
    try {
      const res = await callAction<OpenAnswer>('openRoom', confirmLeave ? { room, confirmLeave: true } : { room });
      if (res.body.ok === false && res.body.reason === 'gate_open') {
        setLeaving({ next: room, from: res.body.room ?? current ?? 'this room' });
        return;
      }
      setLeaving(null);
      if (res.body.ok !== false) setCurrent(room);
    } catch {
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <main role="alert">
        <h1>{NO_ROOM_OPEN.title}</h1>
        <p>{NO_ROOMS.body}</p>
      </main>
    );
  }

  if (rooms !== null && rooms.length === 0) {
    return (
      <main>
        <h1>{NO_ROOMS.heading}</h1>
        <p>{NO_ROOMS.body}</p>
        <p>
          <code>{LAUNCH_COMMAND}</code>
        </p>
      </main>
    );
  }

  return (
    <main>
      <p>{current === null ? NO_ROOM_OPEN.title : current}</p>
      <h1>
        {NO_ROOM_OPEN.heading.before}
        <em>{NO_ROOM_OPEN.heading.emphasis}</em>
        {NO_ROOM_OPEN.heading.after}
      </h1>
      <p>{NO_ROOM_OPEN.body}</p>
      {leaving ? (
        <section role="alertdialog" aria-label={LEAVE.title}>
          <h2>{LEAVE.title}</h2>
          <p>{LEAVE.body(leaving.from, leaving.next)}</p>
          <button type="button" onClick={() => void open(leaving.next, true)}>
            {LEAVE.primary(leaving.next)}
          </button>
          <button type="button" autoFocus onClick={() => setLeaving(null)}>
            {LEAVE.secondary}
          </button>
        </section>
      ) : null}
      <ul>
        {(rooms ?? []).map((slug) => (
          <li key={slug}>
            <button type="button" aria-current={slug === current ? 'true' : undefined} onClick={() => void open(slug, false)}>
              {slug}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
