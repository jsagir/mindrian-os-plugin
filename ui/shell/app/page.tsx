import { headers } from 'next/headers';
import { App } from '../client/App.tsx';
import { NOT_SIGNED_IN } from '../client/copy.ts';
import { CSRF_META } from '../client/api.ts';
import { readSession } from '../server/auth.ts';
import { getConfig } from '../server/config.ts';

// Rendered per request: the CSRF meta tag and the sign-in check belong to one browser session.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const h = await headers();
  const session = readSession(h.get('cookie'));
  if (!session) {
    return (
      <main>
        <h1>{NOT_SIGNED_IN.what}</h1>
        <p>{NOT_SIGNED_IN.why}</p>
        <p>{NOT_SIGNED_IN.fix}</p>
      </main>
    );
  }
  return (
    <>
      <meta name={CSRF_META} content={session.csrf} />
      <App port={getConfig().port} />
    </>
  );
}
