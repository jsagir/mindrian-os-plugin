import { NOT_FOUND } from '../client/copy.ts';

// The shell's own 404 (Egress, Privacy and Offline: no chassis chrome survives). Plain markup in the token sheet's
// styles, no style attribute.
export default function NotFound() {
  return (
    <main className="shell-view stack">
      <h1>{NOT_FOUND.what}</h1>
      <p>{NOT_FOUND.why}</p>
      <p>
        <a href="/">{NOT_FOUND.fix}</a>
      </p>
    </main>
  );
}
