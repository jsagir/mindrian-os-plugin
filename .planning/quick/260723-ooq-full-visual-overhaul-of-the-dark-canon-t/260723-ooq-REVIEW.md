---
phase: 260723-ooq
reviewed: 2026-07-23T15:41:42Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - references/design/email-template-standard.md
  - references/design/newsletter-email-template.html
  - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
  - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Quick Task 260723-ooq: Code Review Report

**Reviewed:** 2026-07-23T15:41:42Z
**Depth:** quick
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the redesigned DARK-canon newsletter template (`newsletter-email-template.html`), its
derived component-pattern doc (`email-template-standard.md`), and the v1.15.3-beta.44
instantiated content demonstration (`.html` + `.md`). No BLOCKER/critical findings: no real
`<style>` tag or `border-radius` CSS property exists in any actual markup (the grep hits are all
inside HTML comments / prose that documents the rule itself - literal-string false positives
correctly ruled out); no unicode em-dash (U+2014/U+2013) anywhere; the full 9-color hex palette is
byte-identical across `email-template-standard.md`, `newsletter-email-template.html`, and the
instantiated outbox `.html`; no leftover unreplaced `{{PLACEHOLDER}}` tokens in the instantiated
file; every CHANGELOG claim in the outbox `.md` (beta.38/40/42/44) cross-checks accurately against
`CHANGELOG.md`; and no tester/advisor PII leaked - the only email address present is the sender's
own (`jsagir@gmail.com`, excluded-from-recipients disclosure), consistent with dozens of prior
outbox files, and `sent_to: []` confirms no Gmail draft was created.

Three warnings and one info item found, detailed below - the most notable is that the "canonical
template wins, this doc is kept in sync with it" doc actually drifted from the template it claims
to mirror (a real, distinct "divider" section exists in the template's markup but is entirely
absent from the `.md`'s Structure list and Palette Usage column).

## Warnings

### WR-01: `email-template-standard.md` Structure list and Palette table omit the template's "divider" section

**File:** `references/design/email-template-standard.md:24-52`
**Issue:** `newsletter-email-template.html` has a distinct, real "divider" section (a two-color
70%/30% red/blue 4px bar row, `<!-- 7. divider -->` at html:113-119) sitting between the READ THE
STORY button and the STEP 0 callout. `email-template-standard.md`'s "Structure" numbered list
(lines 24-39) enumerates only 13 items and has no entry for this row at all (it jumps straight
from "6. READ THE STORY button" to "7. STEP 0 update callout", silently absorbing the template's
real section 8 into item 7). The Palette table's Usage column (lines 41-52) likewise never
mentions this divider's red/blue usage. The file's own header states "this document is the
derived component-pattern reference, kept in sync with [the template] ... update this doc to
match, never the reverse" - this reconciliation task left that promise unfulfilled for one whole
section.
**Fix:**
```markdown
### Structure
1. Top Mondrian bar ...
...
6. READ THE STORY button (gold block, centered text only)
7. Divider (thin 70/30 red/blue bar, bookends the CTA before the update callout)
8. STEP 0 update callout (full-bleed red panel)
...
```
Also add a "Divider" component-pattern subsection (mirroring the template's html:113-119 markup)
and reference red/blue's divider usage in the Palette table's Usage column.

### WR-02: Triple-feature "three more pieces" repeats the primary READ THE STORY link

**File:** `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html:70,174`
**Issue:** The READ THE STORY button (line 70) links to
`https://mindrian-os.com/blog/the-beam-nobody-has-won`. The triple-feature section (line 174) is
introduced with "Three more pieces on the same shelf" and then lists three links - but the first
of the three is `https://mindrian-os.com/blog/the-beam-nobody-has-won`, the exact same URL and
same story already pushed as the hero CTA earlier in the same email. This isn't "three more" -
it's two more plus a repeat, and a reader who clicks the first triple-feature link expecting new
content lands back on the article they were already sent to read.
**Fix:** Replace the first triple-feature link with a genuinely different third post (or drop to
"two more pieces" and list only the two non-duplicate links: `dominant-design-the-brick-that-won`
and `maybe-a-tank-needs-to-be-an-ambulance`).

### WR-03: Hero `<img>` has `width` and `alt` but no `height` attribute

**File:** `references/design/newsletter-email-template.html:100`, `references/design/email-template-standard.md:124`, `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html:62`
**Issue:** All three occurrences of the hero `<img>` tag set `width="576"` and `alt="..."` but
never set an explicit `height` attribute. Outlook's desktop renderer (Word engine) is well known
to size images off the HTML `width`/`height` attributes rather than the CSS
`width:100%;max-width:576px`, so omitting `height` risks the hero image rendering at native pixel
size (breaking the 640px layout) or with distorted aspect ratio in that client family. The
template's own 11-item send checklist (html:266-269, item 11) only requires src/alt/caption, so
this gap isn't caught by the template's own acceptance gate either.
**Fix:**
```html
<img src="{{HERO_IMAGE_URL}}" alt="{{HERO_IMAGE_ALT}}" width="576" height="324"
  style="display:block;width:100%;max-width:576px;border:2px solid #F5F0E8;">
```
(substitute the real height matching each hero image's actual aspect ratio) and add a "height
attribute present, matching aspect ratio" line to the 11-item checklist.

## Info

### IN-01: Garbled sentence describing recipient-query methodology parity

**File:** `docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.md:82-83`
**Issue:** "The query script used the same mechanism as that prior entry: ... filtered/deduped/
excluded client-side exactly as `brain-admin.cjs`'s own `cmdList()` does not do this filtering
server-side." The clause "exactly as X does not do Y" doesn't parse - it reads as if two
different draft phrasings (one asserting the script's filtering matches `cmdList()`, one noting
`cmdList()` doesn't filter server-side) were merged without reconciling the connecting words,
leaving the actual relationship between this script's filtering and `brain-admin.cjs`'s behavior
ambiguous to a future reader.
**Fix:** Rewrite as two clear clauses, e.g. "The query script used the same mechanism as that
prior entry ... filtered/deduped/excluded client-side, since `brain-admin.cjs`'s own `cmdList()`
does not perform this filtering server-side."

---

_Reviewed: 2026-07-23T15:41:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
