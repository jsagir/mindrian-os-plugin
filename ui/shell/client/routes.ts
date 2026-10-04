// The route registry. Plan 369-19 started it empty; plan 369-32 appended the room picker as the root route; plan
// 369-25 registers the review views: Work at the root once a room is open (HomeRoute) and at /work, then Evidence,
// Decisions, Deliverables and the secondary Graph tab. Plan 369-27 appends the gate view at /gate/:gateId (the one parameterised route). The App renders the
// first entry whose path matches, and the "No room open" state when none does.
import type { ComponentType } from 'react';
import { DecisionsView } from './views/decisions/DecisionsView.tsx';
import { DeliverablesView } from './views/deliverables/DeliverablesView.tsx';
import { EvidenceView } from './views/evidence/EvidenceView.tsx';
import { GateView } from './views/gate/GateView.tsx';
import { GraphView } from './views/graph/GraphView.tsx';
import { HomeRoute } from './views/HomeRoute.tsx';
import { requireRoom } from './views/guarded.tsx';
import { WorkView } from './views/work/WorkView.tsx';

export type ShellRoute = {
  path: string;
  component: ComponentType;
};

export const routes: ShellRoute[] = [
  { path: '/', component: HomeRoute },
  { path: '/work', component: requireRoom(WorkView) },
  { path: '/evidence', component: requireRoom(EvidenceView) },
  { path: '/decisions', component: requireRoom(DecisionsView) },
  { path: '/deliverables', component: requireRoom(DeliverablesView) },
  { path: '/graph', component: requireRoom(GraphView) },
  { path: '/gate/:gateId', component: requireRoom(GateView) },
];

// A path segment that starts with a colon matches any one non-empty segment (/gate/:gateId). The view reads the
// value from the address with routeParam().
function segments(path: string): string[] {
  return path.split('/').filter((part) => part !== '');
}

function matches(pattern: string, pathname: string): boolean {
  const want = segments(pattern);
  const have = segments(pathname);
  if (want.length !== have.length) return false;
  return want.every((part, i) => part.startsWith(':') || part === have[i]);
}

export function matchRoute(pathname: string, registry: ShellRoute[] = routes): ShellRoute | null {
  return registry.find((r) => r.path === pathname) ?? registry.find((r) => r.path.includes(':') && matches(r.path, pathname)) ?? null;
}

// The value of a `:name` segment in the address, decoded; null when the path has none.
export function routeParam(pattern: string, pathname: string, name: string): string | null {
  const want = segments(pattern);
  const have = segments(pathname);
  const i = want.indexOf(':' + name);
  if (i === -1 || have.length !== want.length) return null;
  try {
    return decodeURIComponent(have[i]!);
  } catch {
    return have[i]!;
  }
}
