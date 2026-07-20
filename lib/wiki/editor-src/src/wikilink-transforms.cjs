'use strict';

// Phase 232 Plan 05 Task 1 -- the pure load/save bridge between BlockNote's inline
// nodes and literal [[target]] markdown (CONTEXT D-09).
//
// Plainly: BlockNote parses an article's markdown into a tree of block objects.
// Each block carries a `content` array of inline nodes (a plain text run looks like
// { type:'text', text:'...', styles:{...} }) and a `children` array of nested blocks.
// A [[wikilink]] arrives as ordinary text. These two functions convert that text into
// (and back out of) a custom 'wikilink' inline node so the editor can render it as a
// clickable pill (D-08) while the file on disk stays plain [[foo]] markdown.
//
// Why this is safe even where it does nothing (D-07 / D-09 fail-open posture):
// direct inspection of @blocknote/core 0.51.4 proved plain [[foo]] text round-trips
// byte-identical through tryParseMarkdownToBlocks -> blocksToMarkdownLossy. So any
// shape these transforms do NOT positively recognize (a table's non-array content,
// an unknown inline type) is left untouched and still survives as literal text.
//
// Dependency-free on purpose: plain node can unit-test it AND esbuild can bundle it
// into the browser client. It imports nothing and mutates nothing it is handed.

// One [[target]] with no nested brackets. A fresh RegExp with the global flag is made
// per call so there is no shared lastIndex state between invocations.
const WIKILINK_SOURCE = '\\[\\[([^\\[\\]]+)\\]\\]';

// Split a single { type:'text', text, styles } node into an interleaved array of text
// nodes and { type:'wikilink', props:{ target } } nodes. Styles carry onto every text
// fragment. A node with no match returns a one-element copy (text-identical).
function splitTextNode(node) {
  const text = typeof node.text === 'string' ? node.text : '';
  const styles = node.styles ? { ...node.styles } : {};
  const re = new RegExp(WIKILINK_SOURCE, 'g');
  const out = [];
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: 'text', text: text.slice(lastIndex, m.index), styles: { ...styles } });
    }
    out.push({ type: 'wikilink', props: { target: m[1] } });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    out.push({ type: 'text', text: text.slice(lastIndex), styles: { ...styles } });
  }
  if (out.length === 0) {
    // Empty text, or (via the trailing-slice path) never reached: keep a faithful copy.
    return [{ type: 'text', text, styles: { ...styles } }];
  }
  return out;
}

function loadBlock(block) {
  if (!block || typeof block !== 'object') return block;
  const next = { ...block };
  if (Array.isArray(block.content)) {
    const content = [];
    for (const node of block.content) {
      if (node && node.type === 'text') {
        for (const piece of splitTextNode(node)) content.push(piece);
      } else {
        content.push(node);
      }
    }
    next.content = content;
  }
  if (Array.isArray(block.children)) {
    next.children = block.children.map(loadBlock);
  }
  return next;
}

function saveBlock(block) {
  if (!block || typeof block !== 'object') return block;
  const next = { ...block };
  if (Array.isArray(block.content)) {
    next.content = block.content.map((node) => {
      if (node && node.type === 'wikilink') {
        const target = node.props && node.props.target ? node.props.target : '';
        return { type: 'text', text: '[[' + target + ']]', styles: {} };
      }
      return node;
    });
  }
  if (Array.isArray(block.children)) {
    next.children = block.children.map(saveBlock);
  }
  return next;
}

// Load-time (D-09): text runs -> wikilink inline nodes. Returns a new tree; input
// is never mutated. Non-array content (table shapes, etc.) passes through untouched.
function textRunsToWikilinks(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map(loadBlock);
}

// Save-time (D-09): wikilink inline nodes -> literal [[target]] text nodes, so the
// markdown written to disk stays plain and any other tool can read it.
function wikilinksToTextRuns(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map(saveBlock);
}

module.exports = { textRunsToWikilinks, wikilinksToTextRuns };
