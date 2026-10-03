'use client';
// The document display loads when a person opens a document, not with the page: the editor is the heaviest
// thing the shell ships. It also only mounts in the browser (the editor needs a DOM), after the first render.
import { lazy, Suspense, useEffect, useState } from 'react';
import { DOCUMENT_LOADING } from '../../copy.ts';

const DocumentDisplay = lazy(() => import('./DocumentDisplay.tsx').then((m) => ({ default: m.DocumentDisplay })));

export function LazyDocument({ path, name }: { path: string; name: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const waiting = <p className="caption">{DOCUMENT_LOADING}</p>;
  if (!mounted) return waiting;
  return (
    <Suspense fallback={waiting}>
      <DocumentDisplay path={path} name={name} />
    </Suspense>
  );
}

export function baseName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : path;
}
