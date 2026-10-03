'use client';
// The client app (plan 369-19, skinned and framed by plan 369-20): the shell frame around the route registry's
// view. When no route matches it shows the "No room open" state; when the shell server does not answer it shows
// the "Server unreachable" copy in the view, with the banner and the Status row from the frame.
import { NO_ROOM_OPEN, serverUnreachable } from './copy.ts';
import { ShellFrame } from './frame/ShellFrame.tsx';
import { useShell } from './frame/shell-context.ts';
import { Rule } from './primitives/Rule.tsx';
import { matchRoute } from './routes.ts';

function Outlet({ pathname }: { pathname: string }) {
  const { unreachable, port } = useShell();

  if (unreachable) {
    const copy = serverUnreachable(port);
    return (
      <section className="stack">
        <Rule />
        <h1>{copy.what}</h1>
        <p>{copy.why}</p>
        <p>{copy.fix}</p>
      </section>
    );
  }

  const route = matchRoute(pathname);
  if (route) {
    const View = route.component;
    return <View />;
  }

  return (
    <section className="stack">
      <Rule />
      <p className="eyebrow">{NO_ROOM_OPEN.title}</p>
      <h1>
        {NO_ROOM_OPEN.heading.before}
        <em>{NO_ROOM_OPEN.heading.emphasis}</em>
        {NO_ROOM_OPEN.heading.after}
      </h1>
      <p>{NO_ROOM_OPEN.body}</p>
    </section>
  );
}

export function App({ pathname = '/', port }: { pathname?: string; port: number }) {
  return (
    <ShellFrame port={port} pathname={pathname}>
      <Outlet pathname={pathname} />
    </ShellFrame>
  );
}
