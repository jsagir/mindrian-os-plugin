// The route registry. Plan 369-19 started it empty; plan 369-32 appends the room picker as the root route
// and the views plans append theirs. The App renders the first entry whose path matches, and the
// "No room open" state when none does.
import type { ComponentType } from 'react';
import { RoomPicker } from './RoomPicker.tsx';

export type ShellRoute = {
  path: string;
  component: ComponentType;
};

export const routes: ShellRoute[] = [{ path: '/', component: RoomPicker }];

export function matchRoute(pathname: string, registry: ShellRoute[] = routes): ShellRoute | null {
  return registry.find((r) => r.path === pathname) ?? null;
}
