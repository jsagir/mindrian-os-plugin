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
import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core';

// BlockNote's own styles FIRST, then our M:OS overrides so the overrides win.
import '@blocknote/mantine/style.css';
import './mos-blocknote-theme.css';

// Plan 05: the real load/save bridge + the wikilink pill + the exporters.
import { textRunsToWikilinks, wikilinksToTextRuns } from './wikilink-transforms.cjs';
import { WikilinkInlineSpec } from './wikilink-spec.jsx';
import { exportPdf, exportDocx } from './exporters.js';

// The editor schema = BlockNote defaults + our custom 'wikilink' inline content. This
// is what lets a { type:'wikilink' } node round-trip through the editor and render as
// a pill (D-08). Built once at module load, shared by every mount.
const mosSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: WikilinkInlineSpec,
  },
});

function currentTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' ? 'dark' : 'light';
}

function App({ pageId, title, initialMarkdown }) {
  const editor = useCreateBlockNote({ schema: mosSchema });

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
          // Load-time boundary (D-09): turn [[target]] text into wikilink pills BEFORE
          // the blocks enter the editor.
          editor.replaceBlocks(editor.document, textRunsToWikilinks(blocks));
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

  const [status, setStatus] = React.useState(null);
  // status kinds: {kind:'saved'} | {kind:'error', file} | {kind:'export-error', format}

  async function onSave() {
    setStatus(null);
    let md = '';
    try {
      // Save-time boundary (D-09): collapse wikilink pills back to literal [[target]]
      // text BEFORE serializing, so the .md on disk stays plain markdown.
      md = await editor.blocksToMarkdownLossy(wikilinksToTextRuns(editor.document));
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

  // Export the CURRENT editor content (possibly unsaved, SPEC Req 3). Wikilink pills
  // are flattened to literal [[target]] text first so exported documents match disk.
  async function onExport(format) {
    setStatus(null);
    try {
      const blocks = wikilinksToTextRuns(editor.document);
      if (format === 'pdf') {
        await exportPdf(blocks, title);
      } else {
        await exportDocx(blocks, title);
      }
    } catch (err) {
      console.error('[mos-wiki-editor] export failed:', err);
      setStatus({ kind: 'export-error', format: format === 'pdf' ? 'PDF' : 'Word' });
    }
  }

  return (
    <div className="mos-editor-shell">
      <div className="mos-editor-actionrow">
        <button id="mos-save" className="mos-save-btn" type="button" onClick={onSave}>
          Save
        </button>
        <button
          id="mos-export-pdf"
          className="mos-export-btn"
          type="button"
          onClick={() => onExport('pdf')}
        >
          Export PDF
        </button>
        <button
          id="mos-export-docx"
          className="mos-export-btn"
          type="button"
          onClick={() => onExport('docx')}
        >
          Export Word
        </button>
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
      {status && status.kind === 'export-error' && (
        <div className="mos-redbar" role="alert">
          <div className="mos-redbar-line1">Export failed.</div>
          <div className="mos-redbar-line2">Why: {status.format} render did not complete.</div>
          <div className="mos-redbar-line3">
            Fix: retry, or Save first and export again.
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

  // Article title for export filenames and the DOCX/PDF heading. Prefer an explicit
  // data-page-title, then the page's own <title>, then the pageId basename.
  const rawTitle =
    root.getAttribute('data-page-title') ||
    (document.title || '').trim() ||
    (pageId.includes('/') ? pageId.split('/').pop() : pageId);
  const title = rawTitle || 'article';

  fetch('/api/raw/' + encodeURIComponent(pageId))
    .then((res) => (res.ok ? res.text() : ''))
    .catch(() => '')
    .then((markdown) => {
      createRoot(root).render(
        <StrictMode>
          <App pageId={pageId} title={title} initialMarkdown={markdown} />
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
