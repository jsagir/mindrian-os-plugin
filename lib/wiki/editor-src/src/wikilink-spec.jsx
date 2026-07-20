// M:OS wikilink inline pill (Phase 232 Plan 05 Task 2, CONTEXT D-08, SPEC Req 6,
// UI-SPEC Component Inventory item 5).
//
// Plainly: this teaches BlockNote a new kind of inline thing called a 'wikilink'.
// The load transform (wikilink-transforms.cjs) turns [[target]] text into one of
// these nodes; this spec renders it as a clickable blue pill INSIDE the editing
// surface. Clicking it resolves the target the exact same way the read-only page
// renderer does (lib/wiki/page-renderer.cjs buildPageIndex + postProcessPageName)
// and navigates there.
//
// Security posture (threat register T-232-05-01 / -02): the target renders as React
// text children (auto-escaped, no innerHTML), and navigation only ever builds a
// same-origin path -- either a value returned by GET /api/pages or a hyphen-normalized
// slug under the fixed /wiki/ prefix. No protocol or host can be injected.

import { createReactInlineContentSpec } from '@blocknote/react';

// Fetch the page index once per page load and cache the promise. Mirrors
// buildPageIndex: lowercase id / title / basename all map to the page url.
let pageIndexPromise = null;
function loadPageIndex() {
  if (!pageIndexPromise) {
    pageIndexPromise = fetch('/api/pages')
      .then((res) => (res.ok ? res.json() : {}))
      .then((pages) => {
        const index = new Map();
        for (const id of Object.keys(pages || {})) {
          const page = pages[id] || {};
          const url = page.url || '/wiki/' + id;
          index.set(id.toLowerCase(), url);
          if (page.title) index.set(String(page.title).toLowerCase(), url);
          const base = id.includes('/') ? id.split('/').pop() : id;
          if (!index.has(base.toLowerCase())) index.set(base.toLowerCase(), url);
        }
        return index;
      })
      .catch(() => new Map());
  }
  return pageIndexPromise;
}

// Resolve exactly like page-renderer.cjs postProcessPageName + the '/wiki/' baseURL:
// lowercase the target, collapse whitespace runs to hyphens, look it up, else fall
// back to the slug itself under /wiki/ (an unresolved target lands on the wiki 404).
async function navigateToWikilink(target) {
  const normalized = String(target || '').toLowerCase().replace(/\s+/g, '-');
  const index = await loadPageIndex();
  const url = index.has(normalized) ? index.get(normalized) : '/wiki/' + normalized;
  window.location.href = url;
}

export const WikilinkInlineSpec = createReactInlineContentSpec(
  {
    type: 'wikilink',
    propSchema: { target: { default: '' } },
    content: 'none',
  },
  {
    render: (props) => {
      const target = props.inlineContent.props.target;
      return (
        <span
          className="mos-wikilink"
          role="link"
          tabIndex={0}
          title={'[[' + target + ']]'}
          onClick={() => navigateToWikilink(target)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              navigateToWikilink(target);
            }
          }}
        >
          {target}
        </span>
      );
    },
  },
);
