# Quick Task 260723-ooq: Full Visual Overhaul of the DARK-Canon Tester Email - Research

**Researched:** 2026-07-23
**Domain:** HTML email redesign (table-based, DARK theme) + content accuracy + image-gen pipeline reuse
**Confidence:** HIGH (all 5 focus items directly verified against live repo state, git history, and a live Supabase query)

**Note on repo location:** all files in scope live in `/home/jsagi/dev/MindrianOS-Plugin`, not the
`mindrian-website` working directory this session started in. The blog/hero-image pipeline lives in
a THIRD repo, `/home/jsagi/dev/mindrian-website` (Next.js site), and the image-generation service
itself in a FOURTH, `/home/jsagi/dev/nano-banana-mcp-server`. The plan will need to account for
this cross-repo execution.

## Summary

All three problems named in CONTEXT.md are real and independently confirmed. The two palette docs
conflict because `email-template-standard.md` (2026-05-13) predates `newsletter-email-template.html`
(2026-06-27, the actually-shipped canon) and was never updated when the brighter palette shipped.
The live recipient count is 42 (freshly re-queried, unchanged from the prior issue). The reliability
content is accurate and summarized below in plain language. The hero-image pipeline is real,
reusable, but requires cross-repo invocation (image-gen deps live in `nano-banana-mcp-server`,
`sharp` lives in `mindrian-website/website`, neither is installed in this repo). There is no
precedent in any past sent email for a full-bleed CONTENT color panel — only the top/bottom Mondrian
BARS are full-bleed today, and no past email has ever embedded a photographic/generated hero image
at all (every past DARK-canon send is 100% CSS table blocks, zero `<img>` tags).

**Primary recommendation:** Update `email-template-standard.md` to match the shipped
`newsletter-email-template.html` palette (don't touch the reverse); re-run the live recipient query
at send time (it is cheap and already proven, ~1 second); write the reliability content using the
Feynman one-liners below; treat the hero image as a genuinely new pattern for this template (needs a
public URL, not just a generated file) and build the cross-repo generation command chain explicitly
into the plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email HTML template rendering | Static asset (this repo) | — | Table-based HTML, no build step, hand-authored |
| Recipient query | External API (Supabase REST via brain-admin.cjs) | — | Lives in `mcp-server-brain/`, own `.env` credentials |
| Hero image generation | External service (Gemini via `@google/genai`) | Local compression (`sharp`) | Generation and compression are two different node_modules trees in two other repos |
| Hero image hosting | Public web (mindrian-os.com or equivalent) | — | Email `<img src>` must be an externally reachable HTTPS URL; local files never render in email clients |
| Content accuracy | This repo's CHANGELOG.md | — | Source of truth for what actually shipped |

## Standard Stack

No new libraries are being installed for this task. Everything needed already exists:

| Tool | Location | Purpose | Already installed? |
|------|----------|---------|---------------------|
| `mcp-server-brain/brain-admin.cjs` | this repo | Recipient query (`cmdList`, live Supabase REST) | Yes — zero deps, uses Node's native `fetch` |
| `@google/genai` ^1.44.0 | `/home/jsagi/dev/nano-banana-mcp-server` | Hero image generation (Gemini) | Yes, in that repo only |
| `sharp` | `/home/jsagi/dev/mindrian-website/website` | Image compression (resize 1800px, q82 JPEG) | Yes, in that repo only |

No `npm install` is required anywhere for this task — **Package Legitimacy Audit is not applicable**
(no new packages installed). If the plan chooses to `npm install sharp` directly into this repo
instead of shelling out cross-repo, that would be a new install and would require the audit at plan
time.

## Focus Area 1: Reconcile the Two Palette Docs

**Verdict: update `email-template-standard.md` to match `newsletter-email-template.html`. Do not
touch the reverse.**

Evidence:
- `email-template-standard.md` was last touched 2026-05-13 (`bc0c6b99`, a Johns-Hopkins-attribution
  strip — not a design-intent commit). `[VERIFIED: git log]`
- `newsletter-email-template.html` was created 2026-06-27 (`1e9b9b0e`) — six weeks later, explicitly
  as "the real shipped format (newsletter-04)... the reusable template for every newsletter
  challenge email." `[VERIFIED: git log + file header comment]`
- `newsletter-email-template.html`'s own header comment calls `email-template-standard.md` "the
  component rules" companion, but the reverse link doesn't exist and nothing else in the repo
  references `email-template-standard.md` by name. `[VERIFIED: grep, zero hits outside the file
  itself]`
- The actual shipped/drafted emails (this week's `docs/testers/outbox/2026-07-23-the-beam-nobody-has-won.md`
  and `docs/testers/outbox/beta-36-40-update-email.html`) both use the brighter palette
  (`#0D0D0D`/`#1A1A1A`/`#C8A43C`/`#D40000`/`#FFD500`/`#0033A0`), never the muted `email-template-standard.md`
  values (`#0a0a0f`/`#12121a`/`#a63d2f`). `[VERIFIED: grep across docs/testers/outbox/*.md]`
- The muted palette (`#a63d2f`, `#12121a`, `#0a0a0f`) IS live elsewhere in the repo — but only in the
  unrelated Data Room presentation system (`templates/showcase/*.html`, `scripts/generate-deck.cjs`,
  `references/design/graph-visualization-standard.md`), a different surface entirely (decks/dashboards,
  not tester emails). `[VERIFIED: grep]`
- A third, genuinely current design system exists — **M:OS Canonical Design System v1.1**
  (`skills/ui-system/rules/design-system.md`, landed this week via quick task `260723-m5d`) — but its
  own "Applies to" list explicitly covers decks/dashboards/exports/wikis/snapshots, NOT email
  templates. It is also a light/warm-cream theme by default, which would conflict with this user's
  standing hard rule that tester emails are DARK. **Do not reconcile the email palette toward M:OS
  v1.1** — wrong surface, wrong theme. `[VERIFIED: skills/ui-system/rules/design-system.md read in full]`

**Action for the plan:** rewrite `email-template-standard.md`'s color table, typography table, and
component-pattern hex values to match `newsletter-email-template.html` exactly (Red #D40000, Yellow
#FFD500, Blue #0033A0, Gold/OS #C8A43C, Cream #F5F0E8, Surface #1A1A1A, Black #111111, Background
#0D0D0D, Muted #999999), and note at the top of the file that `newsletter-email-template.html` is
canonical and this doc is the derived component-pattern reference.

## Focus Area 2: Real Current Recipient Count

**Confirmed live: 42 recipients** (re-queried moments ago, same session as this research).

Method used (matches the prior newsletter issue's mechanism exactly, per its outbox frontmatter):
```bash
cd /home/jsagi/dev/MindrianOS-Plugin/mcp-server-brain
node -e '<script loading .env manually, GET brain_api_keys?select=email,is_active,last_request_at,
  filter is_active===true && last_request_at!==null, dedup by lowercased email, exclude jsagir@gmail.com>'
```
Live credentials WERE available in this research session (`mcp-server-brain/.env` has
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` already provisioned) — this was actually run, not simulated.

Results: `[VERIFIED: live query, run 2026-07-23]`
- Raw rows returned: 73 (identical to the prior issue's own raw count)
- After `is_active=true AND last_request_at IS NOT NULL`: 49
- After dedup by lowercased email: 43
- After excluding sender `jsagir@gmail.com`: **42**

This exactly matches the prior issue's final count (42), confirming the pool has not changed since
that query ran earlier the same day. The executor should still re-run this query fresh at actual
send time (cheap, ~1 second, no side effects) rather than hardcode "42" — the whole point of this
CONTEXT.md decision was not to trust a stale number.

`brain-admin.cjs`'s own `cmdList()` (the CLI command, `node brain-admin.cjs list`) does NOT apply
this filter server-side — it does a plain `select` with no WHERE clause and prints ALL 73 rows
(including revoked keys and duplicate emails from multiple key issuances). The filter/dedup/exclude
logic is done client-side in an ad hoc script, same as the prior issue did — there is no ready-made
`brain-admin.cjs` subcommand that outputs the filtered count directly. The plan should write a small
one-off script (or extend `brain-admin.cjs` with a filtered mode) rather than eyeball the raw
`list` table.

## Focus Area 3: Accurate "This Week's Reliability Hardening" Content

Pulled directly from `CHANGELOG.md` (top ~150 lines). Feynman one-liners below, written for email
copy (not CHANGELOG technical language):

| Version | What actually happened | Feynman "who cares / why" one-liner |
|---------|------------------------|----------------------------------------|
| **v1.15.3-beta.38** | Brain's default endpoint flipped from the old Neo4j Aura+Pinecone server to a new Memgraph-backed one, same API contract | "The brain behind Larry moved to a faster house. Every existing API key still works exactly the same — you don't have to do anything, it just answers quicker and stays in sync better now." |
| **v1.15.3-beta.40** | Windows: `os.rename()` isn't POSIX rename on Windows — it throws instead of overwriting, so the room registry silently froze after the FIRST write on every Windows install | "If you're on Windows, your room used to work once and then quietly stop saving anything after that. Now it doesn't stop." |
| **v1.15.3-beta.42** (2 fixes) | (1) Python source built by interpolating a shell variable straight into source text broke on Windows paths with backslashes; (2) the test suite's OWN Windows probe mechanism got mangled by how Windows spawns `bash.exe` | "The Windows fix above had two more of its own kind hiding right behind it — same root cause (Windows paths use backslashes, and naive string-building chokes on them), found and closed same day." |
| **v1.15.3-beta.44** | The Stop-hook's calm error message got replaced by a raw, ugly Claude Code schema-validation error, because the code was setting a JSON field (`hookSpecificOutput`) that Stop hooks aren't allowed to set at all — the 4th time this exact bug reappeared in this repo's history | "When Larry needed to pause and ask you something, you'd sometimes see a scary raw error instead of Larry's normal calm message. Fixed — and this time we also added a permanent guardrail so it can't quietly come back a 5th time." |

Framing for the email's "MindrianOS is much more powerful now" header content: lead with beta.38
(the Memgraph migration, a real infrastructure upgrade, matches CONTEXT.md's headline instruction),
then the three hardening fixes as proof points of "maturing fast, not just one feature" — matching
the locked content-emphasis decision. `[VERIFIED: CHANGELOG.md, source of truth for what shipped]`

## Focus Area 4: Hero Image Generation Pipeline

**Confirmed real and reusable, but genuinely cross-repo.** Three separate repos are involved:

1. **Generation** — `/home/jsagi/dev/nano-banana-mcp-server` has `@google/genai` ^1.44.0 installed
   and its own `.env` with the Gemini API key already provisioned. This session's blog hero image
   was generated via a standalone Node script calling `@google/genai` directly (model
   `gemini-3.1-flash-image-preview`), as a documented workaround for the nano-banana MCP tool not
   being invokable in a restricted-tool execution context (`.planning/quick/260723-inu-.../260723-inu-SUMMARY.md`).
   The normal path (when MCP tools ARE available) is the `nano-banana-2` MCP tool, falling back to
   `nanobanana-pro` on 403. `[VERIFIED: read that quick task's own SUMMARY.md + PLAN.md]`
2. **Compression** — `sharp` is installed at `/home/jsagi/dev/mindrian-website/website/node_modules/sharp`
   (the Next.js site's own dependency), used to resize to 1800px width, JPEG quality 82.
3. **This repo** (`MindrianOS-Plugin`) has **neither** `@google/genai` nor `sharp` installed.
   `[VERIFIED: `node -e "require.resolve(...)"` failed for both in this repo, 2026-07-23]`

**Implication for the plan:** the executor cannot run image generation "in place" from this repo.
Options, in order of least friction:
- Invoke the generation script with `node` pointed at the `nano-banana-mcp-server` directory
  (so its `node_modules` resolves), write raw output to the shared scratchpad, then invoke a
  compression one-liner with `node` pointed at `mindrian-website/website` (so `sharp` resolves),
  writing the final JPEG to this repo's own asset path.
- This is exactly the same pattern already used for the blog hero image this session — no new
  mechanism needs inventing, just the same two `node` invocations run from two different
  directories via absolute paths.

**Publishing gap not mentioned in CONTEXT.md, but load-bearing:** the current
`newsletter-email-template.html` has **zero `<img>` tags anywhere** — the entire template is CSS
table color blocks, no photographic or generated imagery at all. Adding a real hero image means the
image needs a stable, **public HTTPS URL** for email clients to render it (Gmail, Outlook, etc. do
not load local files or most `data:` URIs reliably in inboxes). The blog's own hero images are
public because they're served from the deployed Next.js site
(`mindrian-os.com/images/blog/...`). The new email hero image will need an equivalent public home —
most likely a new path under the same `mindrian-website` deployment (e.g.
`public/images/email/...`), or another already-public host. **This requires a deploy step in
`mindrian-website`, a fourth repo touch, before the email can actually reference the image by URL.**
This is a genuinely new operational step this template has never needed before and should be an
explicit task in the plan, not an assumption.

## Focus Area 5: Precedent for Full-Bleed Color Panels

**No precedent for a full-bleed CONTENT panel exists in any past sent/drafted email.** Checked:
`newsletter-email-template.html` (the 12-section canon), `docs/testers/outbox/2026-07-23-the-beam-nobody-has-won.md`,
and `docs/testers/outbox/beta-36-40-update-email.html`. All three use one of exactly two patterns for
content sections:
1. **6px-left-border + `#1A1A1A` card** (the canon's own pattern, called out as monotone in
   CONTEXT.md's diagnosis) — used in the 2026-07-23 issue.
2. **3px-left-border "rail," no card background at all**, content sitting directly on `#0D0D0D` —
   used in `beta-36-40-update-email.html`, a slightly different (and arguably more recent) variant,
   but still a left-border rail, not a full-bleed block.

**What IS already full-bleed and proven-safe across clients:** the top/bottom Mondrian BARS
(structural bookends — full-width colored `<td>` strips with `&nbsp;`) exist in every single
template checked, including the very first line of the current canon. This is a real, low-risk
precedent the plan should lean on: **the table-cell-as-solid-color-block technique is already
validated for this email's rendering environment** (Gmail/Outlook table rendering), just never
applied to full-width CONTENT sections (only to thin decorative strips). Extending an
already-proven technique to content panels is a much safer bet than inventing a new HTML email
pattern from scratch — the risk is un-tested at content scale, not un-tested as a technique.

`[VERIFIED: read newsletter-email-template.html in full, both outbox HTML files in full; no other
outbox .md file contains `border-left` or full-width `width="100%"` content-panel markup]`

## Common Pitfalls

### Pitfall 1: Assuming the generated hero image "just works" once created
**What goes wrong:** image renders fine as a local file / in a preview but shows a broken-image icon
in the actual sent email.
**Why it happens:** email clients require a public HTTPS URL for `<img src>`; local paths and most
`data:` URIs are stripped or blocked by major clients (Gmail in particular).
**How to avoid:** deploy the image to the `mindrian-website` public asset path and verify the URL
resolves with a plain `curl -I` before referencing it in the email HTML.
**Warning signs:** image src pointing at a `file://` path, a scratchpad path, or an un-deployed repo
path.

### Pitfall 2: Trusting `brain-admin.cjs list`'s printed count directly
**What goes wrong:** using the raw table row count (73, or the visually-scrolled subset) as "the
recipient count."
**Why it happens:** `cmdList()` has no server-side filter — it prints every row including revoked
keys and duplicate email issuances.
**How to avoid:** always apply the three-step filter (is_active=true AND last_request_at NOT NULL,
dedup by lowercased email, exclude sender) client-side, exactly as done in this research and the
prior issue.

### Pitfall 3: Editing the wrong palette doc
**What goes wrong:** "fixing" `newsletter-email-template.html` to match `email-template-standard.md`'s
muted values, since the .md file reads as more official ("Standard").
**Why it happens:** the filename itself implies authority.
**How to avoid:** the actually-shipped emails are the ground truth — verified in this research they
all use the brighter palette. Update the doc to match reality, not the reverse.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new hero image's public URL will live under the `mindrian-website` deploy (e.g. `public/images/email/...`) | Focus Area 4 | If the user wants a different host, the deploy step in the plan targets the wrong repo/path — low risk, easy to redirect since it's an explicit plan task, not baked into template markup |

No other assumptions — every other claim in this document was directly verified via git log, grep,
a live Supabase query, or reading the source file in full this session.

## Open Questions

1. **Exact public path for the new email hero image**
   - What we know: it must be a public HTTPS URL; the blog's own hero images live at
     `mindrian-os.com/images/blog/<slug>.jpg` via the `mindrian-website` deploy.
   - What's unclear: whether the plan should create a parallel `images/email/` path in that same
     repo, or reuse/rename an existing blog asset path.
   - Recommendation: create `website/public/images/email/` as a new, clearly-scoped path — keeps
     email assets from cluttering the blog's own image directory and makes future email-hero
     reuse of this pipeline a one-line path change.

## Sources

### Primary (HIGH confidence — read/run directly this session)
- `references/design/newsletter-email-template.html` — full file read
- `references/design/email-template-standard.md` — full file read
- `docs/testers/outbox/2026-07-23-the-beam-nobody-has-won.md` — full file read
- `docs/testers/outbox/beta-36-40-update-email.html` — full file read
- `CHANGELOG.md` (top ~150 lines) — beta.36 through Unreleased(beta.45)
- `mcp-server-brain/brain-admin.cjs` — `cmdList()` and `supa()` read directly
- Live Supabase query run against `brain_api_keys` via the repo's own provisioned credentials,
  2026-07-23, this session
- `skills/ui-system/rules/design-system.md` — full file read (M:OS v1.1, confirmed out of scope
  for email surface)
- `.planning/quick/260723-inu-write-and-publish-a-new-mindrianos-newsl/260723-inu-SUMMARY.md` and
  `260723-inu-PLAN.md` — hero-image pipeline mechanism, read in full
- `git log` / `git show` on both palette docs and the newsletter template

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` line for quick task `260723-m5d` — cross-checked to confirm the M:OS v1.1
  design system's scope (decks/dashboards, not email) is current as of this week

## Metadata

**Confidence breakdown:**
- Palette reconciliation: HIGH — git history + grep + actual sent-email evidence all agree
- Recipient count: HIGH — live query run this session, cross-checked against the prior issue's own numbers
- Content accuracy: HIGH — pulled directly from CHANGELOG.md, the project's own source of truth
- Hero image pipeline: HIGH on mechanism (verified via prior session's own written record), MEDIUM
  on the exact public-hosting path (not yet decided, flagged as Open Question)
- Full-bleed precedent: HIGH — every candidate file was read in full, no partial sampling

**Research date:** 2026-07-23
**Valid until:** same day for the recipient count (re-query at send time regardless); ~7 days for
everything else (fast-moving repo, multiple betas shipping same week)
