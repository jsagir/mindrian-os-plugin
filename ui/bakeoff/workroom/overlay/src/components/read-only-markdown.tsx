'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useEffect, useState } from 'react';
import { paperEditorTheme } from '../lib/blocknote-theme';

// Read-only rendering of a markdown string via a locked BlockNote instance --
// the workroom's own component, tightened for D-13: editable is false and the
// side menu, formatting toolbar, slash menu, link toolbar, file panel, table
// handles and emoji picker are all switched off, so the view is a display and
// there is no save route anywhere behind it.
export function ReadOnlyMarkdown({ markdown }: { markdown: string }) {
  const editor = useCreateBlockNote();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      const blocks = await editor.tryParseMarkdownToBlocks(markdown || '');
      if (cancelled) return;
      editor.replaceBlocks(editor.document, blocks);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  return (
    <div className={ready ? '' : 'opacity-0'} data-testid="artifact-view">
      <BlockNoteView
        editor={editor}
        editable={false}
        theme={paperEditorTheme}
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar={false}
        filePanel={false}
        tableHandles={false}
        emojiPicker={false}
      />
    </div>
  );
}
