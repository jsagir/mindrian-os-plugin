#!/usr/bin/env node
'use strict';

// Phase 232 Plan 05 Task 1 -- hermetic round-trip tests for the pure wikilink
// block-tree transforms (D-09). No BlockNote import, no browser, no network:
// every case runs against hand-built BlockNote-shaped block JSON so plain node
// can prove the load/save bridge behavior. run-all-232.sh glob-discovers this
// file (tests/test-232-*.cjs) with no edit to the harness.

const assert = require('assert');
const path = require('path');
const {
  textRunsToWikilinks,
  wikilinksToTextRuns,
} = require(path.join(
  __dirname,
  '..',
  'lib',
  'wiki',
  'editor-src',
  'src',
  'wikilink-transforms.cjs',
));

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// Flatten a block tree to its literal text, rendering wikilink inline nodes as
// their [[target]] source form and walking children. Lets us assert text
// identity independent of how a run happens to be split into nodes.
function flatten(blocks) {
  return blocks
    .map((b) => {
      let s = '';
      if (Array.isArray(b.content)) {
        for (const n of b.content) {
          if (n.type === 'text') s += n.text;
          else if (n.type === 'wikilink') s += '[[' + n.props.target + ']]';
        }
      }
      if (Array.isArray(b.children)) s += flatten(b.children);
      return s;
    })
    .join('\n');
}

function concatContentText(content) {
  return content
    .map((n) => {
      if (n.type === 'text') return n.text;
      if (n.type === 'wikilink') return '[[' + n.props.target + ']]';
      return '';
    })
    .join('');
}

// ---- Test 1: single link splits, styles carried onto the text fragments ----
test('textRunsToWikilinks splits one link and carries styles', () => {
  const input = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'see [[foo bar]] end', styles: { bold: true } }],
    },
  ];
  const out = textRunsToWikilinks(input);
  const c = out[0].content;
  assert.strictEqual(c.length, 3, 'expected 3 nodes');
  assert.deepStrictEqual(c[0], { type: 'text', text: 'see ', styles: { bold: true } });
  assert.strictEqual(c[1].type, 'wikilink');
  assert.strictEqual(c[1].props.target, 'foo bar');
  assert.deepStrictEqual(c[2], { type: 'text', text: ' end', styles: { bold: true } });
  // input never mutated
  assert.strictEqual(input[0].content.length, 1);
});

// ---- Test 2: two links produce two wikilink nodes with the right targets ----
test('textRunsToWikilinks splits two links into 4+ nodes', () => {
  const input = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'see [[a]] and [[b]] now', styles: {} }],
    },
  ];
  const c = textRunsToWikilinks(input)[0].content;
  assert.ok(c.length >= 4, 'expected 4+ nodes, got ' + c.length);
  const links = c.filter((n) => n.type === 'wikilink');
  assert.strictEqual(links.length, 2);
  assert.strictEqual(links[0].props.target, 'a');
  assert.strictEqual(links[1].props.target, 'b');
});

// ---- Test 3: inverse reproduces the exact literal source text ----
test('wikilinksToTextRuns inverts back to the literal [[foo bar]] text', () => {
  const input = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'see [[foo bar]] end', styles: { bold: true } }],
    },
  ];
  const forward = textRunsToWikilinks(input);
  const back = wikilinksToTextRuns(forward);
  assert.strictEqual(concatContentText(back[0].content), 'see [[foo bar]] end');
  // no wikilink nodes remain after the save transform
  assert.strictEqual(back[0].content.filter((n) => n.type === 'wikilink').length, 0);
});

// ---- Test 4: full round-trip over a nested block tree is text-identical ----
test('round-trip over a nested block tree preserves literal text', () => {
  const input = [
    {
      type: 'heading',
      content: [{ type: 'text', text: 'Title with [[link one]]', styles: {} }],
      children: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'nested [[link two]] here', styles: {} }],
          children: [
            {
              type: 'bulletListItem',
              content: [{ type: 'text', text: 'deep [[link three]]', styles: {} }],
            },
          ],
        },
      ],
    },
  ];
  const roundTripped = wikilinksToTextRuns(textRunsToWikilinks(input));
  assert.strictEqual(flatten(roundTripped), flatten(input));
});

// ---- Test 5: no-bracket blocks pass through both transforms unchanged ----
test('bracket-free blocks pass through both transforms unchanged', () => {
  const input = [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'plain text no links', styles: { italic: true } },
      ],
      children: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'child text too', styles: {} }],
        },
      ],
    },
    // a non-array content shape (table-like) must be left untouched
    {
      type: 'table',
      content: { type: 'tableContent', rows: [] },
    },
  ];
  const forward = textRunsToWikilinks(input);
  assert.strictEqual(JSON.stringify(forward), JSON.stringify(input));
  const back = wikilinksToTextRuns(forward);
  assert.strictEqual(JSON.stringify(back), JSON.stringify(input));
});

// ---- Test 6: malformed brackets are left as plain text ----
// Each fragment is genuinely unbalanced ("[[" with no closing "]]", or "]]" with
// no opening "[["), so the /\[\[([^\[\]]+)\]\]/ pattern never matches. (A combined
// "[[a ]]b" WOULD form a valid link, which is correct and not what this asserts.)
test('malformed brackets never match the wikilink regex', () => {
  for (const bad of ['[[unclosed bracket start', 'stray close ]] here', 'lone [ and ] ']) {
    const input = [{ type: 'paragraph', content: [{ type: 'text', text: bad, styles: {} }] }];
    const c = textRunsToWikilinks(input)[0].content;
    assert.strictEqual(c.length, 1, 'expected a single untouched text node for: ' + bad);
    assert.strictEqual(c[0].type, 'text');
    assert.strictEqual(c[0].text, bad);
    assert.strictEqual(c.filter((n) => n.type === 'wikilink').length, 0);
  }
});

console.log('\ntest-232-transforms: ' + passed + '/6 passed');
process.exit(0);
