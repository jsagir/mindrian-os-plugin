// The route registry. It starts empty: later plans append their routes (plan 369-32 appends the room
// picker as the root route; the views plans append theirs). The App renders the first entry whose
// path matches, and the "No room open" state when none does.
import type { ComponentType } from 'react';

export type ShellRoute = {
  path: string;
  component: ComponentType;
};

export const routes: ShellRoute[] = [];

export function matchRoute(pathname: string, registry: ShellRoute[] = routes): ShellRoute | null {
  return registry.find((r) => r.path === pathname) ?? null;
}
