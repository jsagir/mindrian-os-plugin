'use client';
// The shell frame (plan 369-20, D-10, D-04): header with the room first, the room selector, primary
// navigation, the secondary Status surface, the connection banners, ONE live region, and the view outlet.
// It owns the shell's connection and room state (polled from /api/status and the listRooms and listOpenGates
// actions) and hands it to its parts and to any view through useShell(). Plan 369-24 replaces the state with
// the signed session-indicator design. Plan 369-23 mounts the browser-copy provider around the header, the
// banners, the view outlet and the Status panel, so each of them can read the copy (useReplica()).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { callAction, feed, ServerUnreachableError } from '../api.ts';
import { CONNECTION_WORDS, ROOM_REMOVED } from '../copy.ts';
import { ActionButton } from '../primitives/ActionButton.tsx';
import { InlineError } from '../primitives/InlineError.tsx';
import { LiveRegionProvider, useAnnounce } from '../primitives/LiveRegion.tsx';
import { ReplicaProvider, useReplica } from '../replica/ReplicaProvider.tsx';
import { RoomPicker } from '../RoomPicker.tsx';
import { Banners } from './Banners.tsx';
import { PrimaryNav } from './PrimaryNav.tsx';
import { RoomSwitchDialog, useRoomSwitcher } from './RoomSelector.tsx';
import { ShellContext } from './shell-context.ts';
import type { Connection, RoomRow, ShellState, ShellStatus } from './shell-context.ts';
import { ShellHeader } from './ShellHeader.tsx';
import { StatusPanel } from './StatusPanel.tsx';

export const STATUS_POLL_MS = 5000;

type StatusBody = Partial<ShellStatus> & { ok?: boolean };
type RoomsBody = { ok?: boolean; rooms?: RoomRow[]; current?: string | null };
type GatesBody = { ok?: boolean; waiting?: number };

// The bound room is no longer on this machine (its browser copy was deleted with it): say so, and offer the list.
function RoomRemoved() {
  const [choosing, setChoosing] = useState(false);
  return (
    <section className="stack" data-state="room-removed">
      <InlineError what={ROOM_REMOVED.what} why={ROOM_REMOVED.why} fix="Pick another room to keep working." />
      {choosing ? <RoomPicker /> : <ActionButton label={ROOM_REMOVED.action} variant="secondary" onClick={() => setChoosing(true)} />}
    </section>
  );
}

function ViewOutlet({ children }: { children: ReactNode }) {
  const { removed } = useReplica();
  return <>{removed ? <RoomRemoved /> : children}</>;
}

function asConnection(value: unknown): Connection {
  return value === 'connected' || value === 'reconnecting' ? value : 'disconnected';
}

export function ShellFrame({ port, pathname = '/', children }: { port: number; pathname?: string; children: ReactNode }) {
  return (
    <LiveRegionProvider>
      <Frame port={port} pathname={pathname}>
        {children}
      </Frame>
    </LiveRegionProvider>
  );
}

function Frame({ port, pathname, children }: { port: number; pathname: string; children: ReactNode }) {
  const announce = useAnnounce();
  const [status, setStatus] = useState<ShellStatus | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomsState, setRoomsState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [current, setCurrent] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [roomEpoch, setRoomEpoch] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);
  const live = useRef(true);
  const lastWord = useRef<Connection | null>(null);
  const viewRef = useRef<HTMLElement | null>(null);

  const readStatus = useCallback(async () => {
    try {
      const res = await feed.status<StatusBody>();
      if (!live.current) return;
      setUnreachable(false);
      const body = res.body;
      const connection = res.status === 200 && body.ok !== false ? asConnection(body.connection) : 'disconnected';
      const next: ShellStatus = {
        connection,
        lastAckAt: typeof body.lastAckAt === 'number' ? body.lastAckAt : null,
        mcpSessionPrefix: typeof body.mcpSessionPrefix === 'string' ? body.mcpSessionPrefix : null,
        roomSlug: typeof body.roomSlug === 'string' ? body.roomSlug : null,
        version: typeof body.version === 'string' ? body.version : null,
      };
      setStatus(next);
      if (lastWord.current !== null && lastWord.current !== connection) announce(CONNECTION_WORDS[connection]);
      lastWord.current = connection;
    } catch (err) {
      if (!live.current) return;
      if (err instanceof ServerUnreachableError) {
        setUnreachable(true);
        setStatus((prev) => (prev ? { ...prev, connection: 'disconnected' } : { connection: 'disconnected', lastAckAt: null, mcpSessionPrefix: null, roomSlug: null, version: null }));
        if (lastWord.current !== 'disconnected') announce(CONNECTION_WORDS.disconnected);
        lastWord.current = 'disconnected';
      }
    }
  }, [announce]);

  const roomsRead = useRef(0);
  const readRooms = useCallback(async () => {
    // Only the most recently started read may apply its answer: a slow answer that was asked before a room switch
    // must not put the old room back as the open one (the browser copy follows `current`).
    const mine = ++roomsRead.current;
    try {
      const res = await callAction<RoomsBody>('listRooms');
      if (!live.current || mine !== roomsRead.current) return;
      if (res.body.ok === false || !Array.isArray(res.body.rooms)) {
        setRoomsState('failed');
        return;
      }
      setRooms(res.body.rooms.filter((r) => r && typeof r.slug === 'string'));
      setCurrent(res.body.current ?? null);
      setRoomsState('ready');
    } catch {
      if (live.current && mine === roomsRead.current) setRoomsState('failed');
    }
  }, []);

  const readGates = useCallback(async () => {
    try {
      const res = await callAction<GatesBody>('listOpenGates');
      if (!live.current || res.body.ok === false) return;
      setWaiting(typeof res.body.waiting === 'number' ? res.body.waiting : 0);
    } catch {
      /* the status read reports an unreachable server */
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([readStatus(), readRooms(), readGates()]);
  }, [readStatus, readRooms, readGates]);

  useEffect(() => {
    live.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void readStatus();
      void readGates();
      // The room list is read on the same beat so a room taken off this machine is noticed within one poll.
      void readRooms();
    }, STATUS_POLL_MS);
    return () => {
      live.current = false;
      clearInterval(timer);
    };
  }, [refresh, readStatus, readGates, readRooms]);

  // The room selector asks for a switch through this one function; it owns the leave-a-decision confirmation.
  const switcher = useRoomSwitcher({
    current,
    onOpened: async () => {
      await refresh();
      setRoomEpoch((n) => n + 1);
    },
    onFailed: () => void readRooms(),
  });

  // After a room switch the view remounts for the new room; keyboard focus lands on it, not on the old room's view.
  useEffect(() => {
    if (roomEpoch > 0) viewRef.current?.focus({ preventScroll: true });
  }, [roomEpoch]);

  const value = useMemo<ShellState>(
    () => ({ port, pathname, status, unreachable, rooms, roomsState, current, waiting, roomEpoch, refresh, openRoom: switcher.openRoom, statusOpen, setStatusOpen }),
    [port, pathname, status, unreachable, rooms, roomsState, current, waiting, roomEpoch, refresh, switcher.openRoom, statusOpen],
  );

  return (
    <ShellContext.Provider value={value}>
      <ReplicaProvider>
        <a className="skip-link" href="#view">
          Skip to the view
        </a>
        <ShellHeader />
        <PrimaryNav />
        <Banners />
        <div className="shell-body">
          <main id="view" className="shell-view" tabIndex={-1} ref={viewRef} key={roomEpoch}>
            <ViewOutlet>{children}</ViewOutlet>
          </main>
          <StatusPanel />
        </div>
        <RoomSwitchDialog switcher={switcher} />
      </ReplicaProvider>
    </ShellContext.Provider>
  );
}
