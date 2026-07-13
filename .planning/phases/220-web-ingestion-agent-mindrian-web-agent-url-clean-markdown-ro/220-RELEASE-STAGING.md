# Phase 220: Release Readiness Staging (REQ-6 as RE-AMENDED 2026-07-13)

**Status:** STAGED DRAFTS ONLY - nothing below is applied in Phase 220. `git diff --exit-code package.json .claude-plugin/plugin.json CHANGELOG.md README.md` is CLEAN at staging time (recorded in 220-VERIFICATION.md Section 5.2).
**Precondition state at staging time:** 219 readiness NOT yet recorded (no 219-RELEASE-STAGING.md; 219-VERIFICATION.md corepower section empty - Plans 219-06/07 in flight). Per SPEC REQ-6 ordering, 220 readiness HOLDS OPEN until 219's lands; these drafts are the 220 content share, prepared once, copy-applicable at the Phase 221 cut. This document does NOT edit 219's staging doc - when 219-07 lands its joint CHANGELOG draft with the marked 220 slot, Section 1 below is the verbatim insert for that slot.

---

## 1. CHANGELOG entry - the 220 content for the joint 219+220+221 release entry

Copy-applicable insert for the marked 220 slot in 219's joint draft (applied at cut time by Phase 221, under whatever `### Added` heading the joint entry carries):

```markdown
- **Web ingestion agent: any URL becomes room knowledge in one governed move.** Paste a link
  in conversation, or run `/mos:research <url>`, and after you approve at the card the page
  is fetched (Tavily Extract, server-side clean markdown), filed as a cited research artifact
  in `research/` (source URL, capture date, content hash, review status: proposed), and its
  entities land in the room graph so every engine can use them. Nothing is ever fetched or
  filed without your explicit verb ([Ingest] [Ingest+Explore] [Skip]).
- **Pasted-URL sensor (SENS-15).** A bare URL in your turn offers an ingest card
  contextually - it never auto-files, and it stays quiet for URLs inside code blocks,
  quotes, or ones the room already ingested.
- **Content-hash idempotency + SUPERSEDES versioning.** Re-ingesting an unchanged page is an
  honest no-op; a changed page files a NEW version linked to the prior one - history is
  append-only, nothing is overwritten.
- **Watched sources: crawl-and-learn on cadence.** Register sources in
  `.mindrian/watched-sources.json` and the scout cadence re-ingests changed pages under a
  per-run cap (default 2), with cadence provenance stamped on every artifact. Findings
  surface as candidates at existing gates - never auto-qualified.
- **Provider honesty everywhere (research_mode envelope).** Every ingest and research run
  names which provider produced the bytes (tavily-extract / webfetch / manual), which mode
  it ran in (normal / web_degraded_local_fallback / local_only / insufficient_evidence),
  and never reports success with empty results. A failed fetch is a typed refusal, not a
  silent empty.
- **Part 8 + inbound safety on the new surface.** Outbound carries the URL only through the
  audited egress chokepoint; inbound web content is data end to end (prompt-injection
  inert, size-bounded, path-safe filing, no symlink escape), adversarially test-pinned.
```

## 2. README.md content-refresh draft (Feynman + JTBD voice, content only, ZERO restyle - D-15/219 discipline)

Two additions, both inside EXISTING sections; every other line byte-preserved.

**(a) "What you do in a session" - add one line to the command slice block, after `/mos:file-meeting`:**

```
/mos:research <url>       # paste a link, approve the card, the page becomes cited room knowledge
```

**(b) "The room surfaces what you cannot see" section - append one sentence to the existing paragraph (content-only extension of the existing claim):**

```
The web works the same way: paste a URL and, once you approve, the page is filed as a cited
source in your room and compared against everything already there.
```

Rules at apply time: no new sections, no heading changes, no styling edits, no em-dashes; the "107 commands across 14 skills" count line is re-verified against the live registry at cut time (it is enumerated from disk, never hand-trusted).

## 3. Website update drafts + fact-check checklist additions (mindrian-os.com - THE single canonical web surface, standing 2026-06-09 rule)

**Feature description draft (for whichever capability/feature surface the site carries; De Stijl styling owned by the site, this is content only):**

> Bring the web into your room. Paste any link and Larry offers a card: ingest it, ingest and
> explore it, or skip. Approved pages are filed as cited sources - the URL, the capture date,
> and a content fingerprint travel with the artifact - and their entities join your room's
> graph so every framework and engine can reason over them. Watched sources re-check
> themselves on a cadence you control, and nothing is ever fetched or filed without your
> explicit approval.

**VERSION-BUMP-CHECKLIST additions (the hand-typed-version fact-check discipline, navigator memory rule):**

- [ ] Every hand-typed version string on mindrian-os.com reconciled to the joint-cut version (grep the site source for the OLD version literal; zero stale hits)
- [ ] If the site carries a features/capabilities list: web-ingestion entry added (draft above), no other feature entry disturbed
- [ ] If the site carries a command count: re-verify against the live registry AFTER the cut (the count changed this line: /mos:research gained URL mode but no NEW command was minted - Part 7)
- [ ] Clarity snippet (ID wmu6iasq77) present on any page touched (standing rule)
- [ ] No em-dashes introduced in any copy edit (standing rule)

## 4. Marketplace note

No 220-specific marketplace action exists beyond the joint pin: `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref` pinned to the new tag - lockstep gate 5, executed by `scripts/release.sh` at the Phase 221 cut, staged in 219's doc (219-07). 220 adds nothing to it and duplicates nothing here.

## 5. HANDOFF NOTE (verbatim)

The 219+220+221 version cut is ONE joint cut (navigator decision 2026-07-13, FINAL - ROADMAP release note). scripts/release.sh <version> executes as Phase 221's final requirement, covering all three phases. 220 stages readiness only. Never hand-bump.

---

## Handoff to Phase 221 (what the cut gate consumes)

| Input | Where |
|-------|-------|
| 220 offline + live evidence | 220-VERIFICATION.md Sections 1-2 |
| 220 navigator confirmation | 220-VERIFICATION.md Section 4 (OPEN at staging time - blocking) |
| 219 readiness | 219-RELEASE-STAGING.md + 219-VERIFICATION.md corepower section (NOT YET LANDED at staging time - blocking) |
| CHANGELOG 220 insert | Section 1 above (fills 219-07's marked 220 slot at cut time) |
| README additions | Section 2 above (content-only, apply then diff-confirm zero styling changes) |
| Website drafts + fact-check | Section 3 above |
| Version files clean proof | `git diff --exit-code package.json .claude-plugin/plugin.json CHANGELOG.md README.md` (green, 220-VERIFICATION.md 5.2) |
| The cut itself | `scripts/release.sh <version>` at Phase 221 completion - next increment on the 1.15.3-beta line (current version-of-record 1.15.3-beta.15) unless the navigator directs otherwise |
