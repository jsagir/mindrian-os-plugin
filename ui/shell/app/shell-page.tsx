import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { App } from '../client/App.tsx';
import { NOT_SIGNED_IN } from '../client/copy.ts';
import { CSRF_META } from '../client/api.ts';
import { VIEW_ROOTS } from '../client/frame/view-roots.ts';
import { readSession } from '../server/auth.ts';
import { getConfig } from '../server/config.ts';

// The one page body, shared by the root page and the catch-all, so the primary navigation's paths (/evidence,
// /decisions, /gate/..., /deliverables, /graph) reach the same frame. The route registry (client/routes.ts)
// decides what each path shows; a first segment the shell does not serve is a 404.
export async function renderShell(view: string[] | undefined) {
  const first = view?.[0];
  if (first !== undefined && !VIEW_ROOTS.includes(first)) notFound();
  const pathname = '/' + (view ?? []).join('/');

  const h = await headers();
  const session = readSession(h.get('cookie'));
  if (!session) {
    return (
      <main className="shell-view stack">
        <h1>{NOT_SIGNED_IN.what}</h1>
        <p>{NOT_SIGNED_IN.why}</p>
        <p>{NOT_SIGNED_IN.fix}</p>
      </main>
    );
  }
  return (
    <>
      <meta name={CSRF_META} content={session.csrf} />
      <App port={getConfig().port} pathname={pathname} />
    </>
  );
}
