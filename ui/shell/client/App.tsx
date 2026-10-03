'use client';
// The client frame (plan 369-19): renders the route registry; when no route matches it shows the
// "No room open" state, and when the shell server does not answer it shows the "Server unreachable"
// copy. Unstyled: plan 369-20 skins it.
import { useEffect, useState } from 'react';
import { feed, ServerUnreachableError } from './api.ts';
import { NO_ROOM_OPEN, serverUnreachable } from './copy.ts';
import { matchRoute } from './routes.ts';

export function App({ pathname = '/', port }: { pathname?: string; port: number }) {
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let live = true;
    feed.status().then(
      () => {
        if (live) setUnreachable(false);
      },
      (err: unknown) => {
        if (live && err instanceof ServerUnreachableError) setUnreachable(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (unreachable) {
    const copy = serverUnreachable(port);
    return (
      <main role="alert">
        <h1>{copy.what}</h1>
        <p>{copy.why}</p>
        <p>{copy.fix}</p>
      </main>
    );
  }

  const route = matchRoute(pathname);
  if (route) {
    const View = route.component;
    return <View />;
  }

  return (
    <main>
      <p>{NO_ROOM_OPEN.title}</p>
      <h1>
        {NO_ROOM_OPEN.heading.before}
        <em>{NO_ROOM_OPEN.heading.emphasis}</em>
        {NO_ROOM_OPEN.heading.after}
      </h1>
      <p>{NO_ROOM_OPEN.body}</p>
    </main>
  );
}
