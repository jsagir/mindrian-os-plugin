// The shell's shared state and its context (plan 369-20). ShellFrame owns the values; the header, the room
// selector, the navigation, the Status surface and any view read them through useShell().
import { createContext, useContext } from 'react';

export type Connection = 'connected' | 'reconnecting' | 'disconnected';

export type ShellStatus = {
  connection: Connection;
  lastAckAt: number | null;
  mcpSessionPrefix: string | null;
  roomSlug: string | null;
  version: string | null;
  // Client time at which this answer was read (plan 369-24): how fresh the acknowledgement was is judged then.
  readAt?: number;
};

// listRooms answers slugs today; purpose and the child-room path are shown when the server supplies them.
export type RoomRow = { slug: string; purpose?: string; path?: string };

export type ShellState = {
  port: number;
  pathname: string;
  status: ShellStatus | null; // null until the first answer
  unreachable: boolean;
  rooms: RoomRow[];
  roomsState: 'loading' | 'ready' | 'failed';
  current: string | null;
  waiting: number;
  roomEpoch: number;
  refresh: () => Promise<void>;
  openRoom: (room: string) => Promise<void>;
  statusOpen: boolean;
  setStatusOpen: (open: boolean) => void;
};

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell: no ShellFrame above this component');
  return value;
}
