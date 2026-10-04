'use client';
// DocumentDisplay (D-13, UI-SPEC Component Inventory): a room document shown through BlockNote 0.51.4, read only.
// The editor is created, filled from the room's markdown and displayed read only (its editable flag is false) with
// every editing surface off: no side menu, no formatting toolbar, no slash menu, no link toolbar, no file panel, no table
// handles, no emoji picker, no comments. There is no change handler and no save route: the markdown comes from
// the room through the readArtifact action (the room_artifact MCP tool) and goes nowhere. Writing a document
// stays in Claude Code.
//
// The raw view is used (no bundled component library), so the display adds no inline style element for the
// shell's Content-Security-Policy to refuse; its sheets are the editor core's and the shell's own themed
// overrides (document-display.css: paper, ink, DM Sans body, Fraunces headings, radius 0, no shadow).
import { useEffect, useState } from 'react';
import { BlockNoteViewRaw, useCreateBlockNote } from '@blocknote/react';
import '@blocknote/core/style.css';
import '@blocknote/react/style.css';
import './document-display.css';
import { callAction } from '../../api.ts';
import { DOCUMENT_COULD_NOT_DISPLAY, DOCUMENT_LOADING, DOCUMENT_SHORTENED, documentFix, documentReason } from '../../copy.ts';
import { InlineError } from '../../primitives/InlineError.tsx';

type ArtifactAnswer = { ok?: boolean; reason?: string; markdown?: string; truncated?: boolean };

type Loaded = { phase: 'loading' } | { phase: 'ready'; markdown: string; truncated: boolean } | { phase: 'failed'; reason: string };

// A leading front-matter block is the room's metadata, not the document's text.
export function withoutFrontMatter(markdown: string): string {
  return markdown.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '');
}

// The editor core adds one style element of its own. The shell's policy lets a style element through only with
// the page's nonce (369-BAKEOFF-DECISION), so the editor is handed the nonce the server stamped on the page's
// scripts; nothing is loosened.
function pageNonce(): string | undefined {
  const el = document.querySelector<HTMLScriptElement>('script[nonce]');
  const nonce = el ? el.nonce : '';
  return nonce ? nonce : undefined;
}

// A room document's own headings sit below the page's one H1 (Canon s7: one H1 per view, measured by C8 of
// tests/e2e-369/egress-and-canon.cjs): a "# Title" in the markdown becomes an H2, a level 2 an H3, and level 3 stays
// H3 (the display's heading blocks stop at three levels). Every heading is drawn at the same Heading size
// (document-display.css), so only the outline changes, never the look.
type HeadingBlock = { type: string; props?: { level?: number }; children?: HeadingBlock[] };
export function demoteHeadings<T extends HeadingBlock>(blocks: T[]): T[] {
  return blocks.map((block) => {
    const children = Array.isArray(block.children) ? demoteHeadings(block.children) : block.children;
    if (block.type !== 'heading') return { ...block, children };
    const level = typeof block.props?.level === 'number' ? block.props.level : 1;
    return { ...block, props: { ...block.props, level: Math.min(3, level + 1) }, children };
  });
}

function Rendered({ markdown }: { markdown: string }) {
  const editor = useCreateBlockNote({ trailingBlock: false, _tiptapOptions: { injectNonce: pageNonce() } });
  useEffect(() => {
    let live = true;
    void (async () => {
      const blocks = await editor.tryParseMarkdownToBlocks(withoutFrontMatter(markdown));
      if (live) editor.replaceBlocks(editor.document, demoteHeadings(blocks as HeadingBlock[]) as typeof blocks);
    })();
    return () => {
      live = false;
    };
  }, [editor, markdown]);
  return (
    <BlockNoteViewRaw
      editor={editor}
      editable={false}
      theme="light"
      sideMenu={false}
      formattingToolbar={false}
      slashMenu={false}
      linkToolbar={false}
      filePanel={false}
      tableHandles={false}
      emojiPicker={false}
      comments={false}
    />
  );
}

export function DocumentDisplay({ path, name }: { path: string; name: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ phase: 'loading' });
  useEffect(() => {
    let live = true;
    setLoaded({ phase: 'loading' });
    void callAction<ArtifactAnswer>('readArtifact', { path })
      .then((res) => {
        if (!live) return;
        const body = res.body;
        if (body && body.ok === true && typeof body.markdown === 'string') {
          setLoaded({ phase: 'ready', markdown: body.markdown, truncated: body.truncated === true });
        } else {
          setLoaded({ phase: 'failed', reason: documentReason(body ? body.reason : undefined) });
        }
      })
      .catch(() => {
        if (live) setLoaded({ phase: 'failed', reason: documentReason(undefined) });
      });
    return () => {
      live = false;
    };
  }, [path]);

  if (loaded.phase === 'loading') return <p className="caption">{DOCUMENT_LOADING}</p>;
  if (loaded.phase === 'failed') {
    return <InlineError what={DOCUMENT_COULD_NOT_DISPLAY} why={loaded.reason + '.'} fix={documentFix(name)} />;
  }
  return (
    <div className="doc-display" data-document="">
      {loaded.truncated ? <p className="caption">{DOCUMENT_SHORTENED}</p> : null}
      <Rendered markdown={loaded.markdown} />
    </div>
  );
}
