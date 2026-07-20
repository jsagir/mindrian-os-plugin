// M:OS wiki editor mount (Phase 232 Plan 03, SPEC Req 1 + client half of Req 2).
//
// Plainly: this is the whole browser-side editor in one file. When the page has an
// element with id "mos-editor-root", we fetch that article's raw markdown, mount a
// BlockNote editor themed to M:OS tokens, and wire a Save button that writes the
// markdown straight back to disk. On any page WITHOUT that element (the Room Home,
// the Graph tab, a static --export share page) this bundle does nothing at all.
//
// The server routes (GET /api/raw/:pageId, POST /api/save/:pageId) land in Plan 04.

import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';

// BlockNote's own styles FIRST, then our M:OS overrides so the overrides win.
import '@blocknote/mantine/style.css';
import './mos-blocknote-theme.css';

// --- Named transform seams (Plan 05 replaces these with the wikilink inline-node
// transforms; here they are pure identity functions and MUST stay that way this plan). ---
export function loadTransform(blocks) {
  // Load-side seam: markdown-parsed blocks in, blocks out. Identity in Plan 03.
  return blocks;
}
export function saveTransform(blocks) {
  // Save-side seam: editor document in, blocks to serialize out. Identity in Plan 03.
  return blocks;
}

function currentTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' ? 'dark' : 'light';
}

function App({ pageId, initialMarkdown }) {
  const editor = useCreateBlockNote();

  // Track the page theme live: the Plan 01 toggle flips <html data-theme>.
  const [theme, setTheme] = React.useState(currentTheme());
  React.useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setTheme(currentTheme()));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Load the article markdown into the editor once, at mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown || '');
        if (!cancelled && blocks && blocks.length) {
          editor.replaceBlocks(editor.document, loadTransform(blocks));
        }
      } catch (err) {
        // A parse failure leaves the empty starter block; the user can still type.
        console.error('[mos-wiki-editor] markdown load failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, initialMarkdown]);

  const [status, setStatus] = React.useState(null); // {kind:'saved'|'error', file?}

  async function onSave() {
    setStatus(null);
    let md = '';
    try {
      md = await editor.blocksToMarkdownLossy(saveTransform(editor.document));
    } catch (err) {
      console.error('[mos-wiki-editor] serialize failed:', err);
      setStatus({ kind: 'error', file: pageId });
      return;
    }
    try {
      const res = await fetch('/api/save/' + encodeURIComponent(pageId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: md }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStatus({ kind: 'saved' });
    } catch (err) {
      console.error('[mos-wiki-editor] save failed:', err);
      setStatus({ kind: 'error', file: pageId });
    }
  }

  return (
    <div className="mos-editor-shell">
      <div className="mos-editor-actionrow">
        <button id="mos-save" className="mos-save-btn" type="button" onClick={onSave}>
          Save
        </button>
        {/* Plan 05 appends Export PDF / Export Word buttons to this row. */}
      </div>

      {status && status.kind === 'saved' && (
        <div className="mos-toast mos-toast-saved" role="status">
          Saved
        </div>
      )}
      {status && status.kind === 'error' && (
        <div className="mos-redbar" role="alert">
          <div className="mos-redbar-line1">Save failed.</div>
          <div className="mos-redbar-line2">Why: could not write {status.file}.</div>
          <div className="mos-redbar-line3">
            Fix: check the room folder is writable, then Save again.
          </div>
        </div>
      )}

      <BlockNoteView editor={editor} theme={theme} />
    </div>
  );
}

function boot() {
  const root = document.getElementById('mos-editor-root');
  if (!root) return; // no-op on non-article pages and in static exports

  const pageId = root.getAttribute('data-page-id') || '';

  fetch('/api/raw/' + encodeURIComponent(pageId))
    .then((res) => (res.ok ? res.text() : ''))
    .catch(() => '')
    .then((markdown) => {
      createRoot(root).render(
        <StrictMode>
          <App pageId={pageId} initialMarkdown={markdown} />
        </StrictMode>,
      );
      // Mount marker for the server/tests to assert the bundle loaded.
      window.__MOS_WIKI_EDITOR__ = { version: '1' };
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
