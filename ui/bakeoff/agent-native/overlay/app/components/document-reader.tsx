// Candidate B: the read-only document (D-13). BlockNote displays only:
// editable false, no side menu, no toolbars, no panels, no save path. Loaded on
// the client only (BlockNote is a browser editor). No GPL exporter package.
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect } from "react";

export default function DocumentReader({ markdown }: { markdown: string }) {
  const editor = useCreateBlockNote();
  useEffect(() => {
    let alive = true;
    (async () => {
      const blocks = await editor.tryParseMarkdownToBlocks(markdown);
      if (alive) editor.replaceBlocks(editor.document, blocks);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [editor, markdown]);
  return (
    <BlockNoteView
      editor={editor}
      editable={false}
      theme="light"
      sideMenu={false}
      formattingToolbar={false}
      linkToolbar={false}
      slashMenu={false}
      emojiPicker={false}
      filePanel={false}
      tableHandles={false}
    />
  );
}
