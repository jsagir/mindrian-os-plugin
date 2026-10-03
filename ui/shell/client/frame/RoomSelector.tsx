'use client';
// The room selector (D-10, UI-SPEC Rooms): the header's context selector, not a tab. A button showing the
// current room opens a listbox of the rooms on this machine; choosing another room runs openRoom. When a
// decision is open the server answers gate_open and the one confirmation in v1 appears first, because a
// gate is recorded against the room it was minted in and a switch makes it unanswerable (Pattern 10, T-369-20-03).
// The switch only goes through with confirmLeave true. Room names render as React text, never as markup.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { callAction } from '../api.ts';
import { ROOM_REMOVED } from '../copy.ts';
import { ConfirmDialog } from '../primitives/ConfirmDialog.tsx';
import { useAnnounce } from '../primitives/LiveRegion.tsx';
import { useShell } from './shell-context.ts';

// The one confirmation in v1 (369-UI-SPEC.md Destructive confirmation): switching rooms while a decision is open.
const LEAVE = {
  title: 'Leave this decision unanswered?',
  body: (current: string, next: string) =>
    'Your open decision in ' + current + ' closes when you switch to ' + next + '. Nothing is saved. You can ask Larry for it again in Claude Code.',
  primary: (next: string) => 'Switch to ' + next,
  secondary: 'Stay here',
};

type OpenAnswer = { ok?: boolean; reason?: string; room?: string };

export type RoomSwitcher = {
  openRoom: (room: string) => Promise<void>;
  leaving: { next: string; from: string } | null;
  confirm: () => void;
  cancel: () => void;
};

export function useRoomSwitcher(opts: { current: string | null; onOpened: () => void | Promise<void>; onFailed: () => void }): RoomSwitcher {
  const announce = useAnnounce();
  const [leaving, setLeaving] = useState<{ next: string; from: string } | null>(null);
  const { current, onOpened, onFailed } = opts;

  const run = useCallback(
    async (room: string, confirmLeave: boolean) => {
      try {
        const res = await callAction<OpenAnswer>('openRoom', confirmLeave ? { room, confirmLeave: true } : { room });
        if (res.body.ok === false && res.body.reason === 'gate_open') {
          setLeaving({ next: room, from: res.body.room ?? current ?? 'this room' });
          return;
        }
        setLeaving(null);
        if (res.body.ok === false) {
          announce(ROOM_REMOVED.what);
          onFailed();
          return;
        }
        await onOpened();
      } catch {
        setLeaving(null);
        onFailed();
      }
    },
    [announce, current, onOpened, onFailed],
  );

  return {
    openRoom: (room) => run(room, false),
    leaving,
    confirm: () => {
      if (leaving) void run(leaving.next, true);
    },
    cancel: () => setLeaving(null),
  };
}

export function RoomSwitchDialog({ switcher }: { switcher: RoomSwitcher }) {
  const { leaving } = switcher;
  return (
    <ConfirmDialog
      open={leaving !== null}
      title={LEAVE.title}
      body={leaving ? LEAVE.body(leaving.from, leaving.next) : ''}
      primaryLabel={leaving ? LEAVE.primary(leaving.next) : ''}
      secondaryLabel={LEAVE.secondary}
      onPrimary={switcher.confirm}
      onCancel={switcher.cancel}
    />
  );
}

export function RoomSelector() {
  const shell = useShell();
  const { rooms, current, openRoom } = shell;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const listId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, rooms.findIndex((r) => r.slug === current)));
    list.current?.focus();
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, rooms, current]);

  const choose = (slug: string) => {
    close(true);
    if (slug !== current) void openRoom(slug);
  };

  const onKey = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(rooms.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(Math.max(0, rooms.length - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const row = rooms[active];
      if (row) choose(row.slug);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const name = current ?? 'No room open';

  return (
    <div className="room-selector" ref={root}>
      <button
        type="button"
        className="rs-trigger"
        ref={trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rs-label">Room</span>
        <span className="rs-name">{name}</span>
        <span className="rs-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id={listId}
          className="rs-list"
          role="listbox"
          aria-label="Rooms on this machine"
          tabIndex={0}
          ref={list}
          aria-activedescendant={rooms[active] ? listId + '-' + active : undefined}
          onKeyDown={onKey}
        >
          {rooms.length === 0 ? (
            <li className="rs-empty" role="presentation">
              There are no rooms on this machine yet.
            </li>
          ) : null}
          {rooms.map((room, index) => (
            <li
              key={room.slug}
              id={listId + '-' + index}
              className="rs-option"
              role="option"
              aria-selected={room.slug === current}
              data-active={index === active ? 'true' : undefined}
              onClick={() => choose(room.slug)}
              onPointerEnter={() => setActive(index)}
            >
              <span className="rs-option-name">{room.slug}</span>
              {room.slug === current ? <span className="rs-option-status">Open now</span> : null}
              {room.purpose ? <span className="rs-option-purpose">{room.purpose}</span> : null}
              {room.path ? <span className="rs-option-path">{room.path}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
