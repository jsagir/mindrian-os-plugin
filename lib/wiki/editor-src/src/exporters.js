// M:OS wiki article exporters (Phase 232 Plan 05 Task 2, SPEC Req 3).
//
// Plainly: take the article's CURRENT editor content (BlockNote block JSON, possibly
// unsaved) and turn it into a downloadable PDF or Word document, entirely in the
// browser. Nothing leaves the machine (threat register T-232-05-03 accept). We use
// the MIT-licensed pdfmake + docx packages that entered the tree at the Plan 03
// legitimacy gate -- NOT the AGPL @blocknote/xl-* exporters.
//
// Callers pass wikilinksToTextRuns(editor.document), so wikilink inline nodes normally
// arrive as literal [[target]] text already; the walk still handles a stray wikilink
// node defensively by emitting its literal [[target]] form.

import pdfMake from 'pdfmake/build/pdfmake';
import pdfVfs from 'pdfmake/build/vfs_fonts';

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

// pdfmake needs its virtual font filesystem wired before createPdf. 0.2.23 exposes
// addVirtualFileSystem; fall back to the older .vfs assignment if it is ever absent.
if (pdfMake && typeof pdfMake.addVirtualFileSystem === 'function') {
  pdfMake.addVirtualFileSystem(pdfVfs);
} else if (pdfMake) {
  pdfMake.vfs = pdfVfs;
}

function headingLevelOf(block) {
  return (block.props && block.props.level) || 1;
}

// ---- plain literal text of an inline content array (wikilink -> [[target]]) ----
function plainText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .map((n) => {
      if (n.type === 'wikilink') return '[[' + ((n.props && n.props.target) || '') + ']]';
      return n.text || '';
    })
    .join('');
}

// ---- pdfmake mapping --------------------------------------------------------
function pdfRuns(content) {
  if (!Array.isArray(content) || content.length === 0) return [{ text: '' }];
  return content.map((n) => {
    if (n.type === 'wikilink') {
      return { text: '[[' + ((n.props && n.props.target) || '') + ']]', color: '#1e52e0' };
    }
    const s = n.styles || {};
    const run = { text: n.text || '' };
    if (s.bold) run.bold = true;
    if (s.italic) run.italics = true;
    return run;
  });
}

function blocksToPdfContent(blocks) {
  const out = [];
  let listBuf = null; // { kind: 'ul'|'ol', items: [] }
  function flush() {
    if (listBuf) {
      out.push({ [listBuf.kind]: listBuf.items, margin: [0, 2, 0, 6] });
      listBuf = null;
    }
  }
  for (const b of blocks) {
    const type = b.type;
    if (type === 'bulletListItem' || type === 'numberedListItem') {
      const kind = type === 'bulletListItem' ? 'ul' : 'ol';
      if (!listBuf || listBuf.kind !== kind) {
        flush();
        listBuf = { kind, items: [] };
      }
      listBuf.items.push({ text: pdfRuns(b.content) });
      continue;
    }
    flush();
    if (type === 'heading') {
      const level = headingLevelOf(b);
      const size = level === 1 ? 20 : level === 2 ? 16 : 14;
      out.push({ text: pdfRuns(b.content), fontSize: size, bold: true, margin: [0, 10, 0, 4] });
    } else if (type === 'codeBlock') {
      out.push({
        text: plainText(b.content),
        fontSize: 10,
        preserveLeadingSpaces: true,
        margin: [0, 4, 0, 8],
      });
    } else {
      out.push({ text: pdfRuns(b.content), fontSize: 11, margin: [0, 2, 0, 6] });
    }
    if (Array.isArray(b.children) && b.children.length) {
      for (const child of blocksToPdfContent(b.children)) out.push(child);
    }
  }
  flush();
  return out;
}

export function exportPdf(blocks, title) {
  const name = title || 'article';
  const def = {
    info: { title: name },
    content: [
      { text: name, fontSize: 24, bold: true, margin: [0, 0, 0, 12] },
      ...blocksToPdfContent(Array.isArray(blocks) ? blocks : []),
    ],
    defaultStyle: { fontSize: 11 },
  };
  pdfMake.createPdf(def).download(name + '.pdf');
}

// ---- docx mapping -----------------------------------------------------------
function docxRuns(content) {
  if (!Array.isArray(content) || content.length === 0) return [new TextRun('')];
  return content.map((n) => {
    if (n.type === 'wikilink') {
      return new TextRun('[[' + ((n.props && n.props.target) || '') + ']]');
    }
    const s = n.styles || {};
    return new TextRun({ text: n.text || '', bold: !!s.bold, italics: !!s.italic });
  });
}

function blocksToDocxParagraphs(blocks) {
  const paras = [];
  for (const b of blocks) {
    const type = b.type;
    if (type === 'heading') {
      const level = headingLevelOf(b);
      const heading =
        level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      paras.push(new Paragraph({ heading, children: docxRuns(b.content) }));
    } else if (type === 'bulletListItem') {
      paras.push(new Paragraph({ bullet: { level: 0 }, children: docxRuns(b.content) }));
    } else if (type === 'numberedListItem') {
      paras.push(
        new Paragraph({ numbering: { reference: 'mos-numbering', level: 0 }, children: docxRuns(b.content) }),
      );
    } else if (type === 'codeBlock') {
      paras.push(new Paragraph({ children: [new TextRun({ text: plainText(b.content), font: 'Courier New' })] }));
    } else {
      paras.push(new Paragraph({ children: docxRuns(b.content) }));
    }
    if (Array.isArray(b.children) && b.children.length) {
      for (const p of blocksToDocxParagraphs(b.children)) paras.push(p);
    }
  }
  return paras;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportDocx(blocks, title) {
  const name = title || 'article';
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: name })] }),
    ...blocksToDocxParagraphs(Array.isArray(blocks) ? blocks : []),
  ];
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'mos-numbering',
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBlob(doc).then((blob) => triggerBlobDownload(blob, name + '.docx'));
}
