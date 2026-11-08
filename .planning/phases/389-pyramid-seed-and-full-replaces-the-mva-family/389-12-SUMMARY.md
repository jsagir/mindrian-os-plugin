---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 12
subsystem: share-step
tags: [share, vercel, opt-in, consent-card, d10-approve, part-8]
requires: [389-02, 389-06, 389-10, 389-11]
provides:
  - lib/core/pyramid-seed-share.cjs (buildSharePage, shareCardLines, pageHash, prepareCard, send, FOOTER_TEXT)
  - scripts/pyramid-seed-share.cjs (card and send, exit 0/1/3/4)
  - tests/test-389-share.cjs (49 checks)
  - one share-offer sentence in the Seed block of commands/structure-argument.md and skills/structure-argument/SKILL.md (byte equal)
affects: [389-13, 389-14, 390]
key-files:
  created:
    - lib/core/pyramid-seed-share.cjs
    - scripts/pyramid-seed-share.cjs
    - tests/test-389-share.cjs
  modified:
    - commands/structure-argument.md
    - skills/structure-argument/SKILL.md
    - tests/test-389-seed-structure.cjs
decisions:
  - D10 APPROVE (owner, 2026-11-08), read from the gate.
  - Task 3 (DROP) skipped; D10 token is APPROVE.
metrics:
  tasks: 2 of 3 (Task 3 not applicable)
completed: 2026-11-08
---

# Phase 389 Plan 12: Opt-in share of a Seed (owner D10 = APPROVE)

One line: a Seed can become a public Vercel page only through a card that prints the exact page text and names Vercel, and the send step needs a single-use confirmation bound to the SHA-256 of that exact page; the old default (deploy whenever a token exists) is gone.

## Owner gate (Task 1)

```
$ node 389-decision.cjs gate 389-DECISION.md D10
D10 APPROVE APPROVED
GATE PASS            (exit 0)
```

HEAD at start: 8adc3ccc7. Scope guard snapshot 389-12 taken first. The tree was clean for every tracked path edited (git diff --quiet HEAD exit 0). Task 3 (DROP) was skipped: the token is APPROVE.

## What was built

- Page: the visible text is the receipt text of the record (renderReceipt, one block per line) plus one footer line "Made with MindrianOS". Every field is HTML-escaped. Inline styles only (no style element), palette from DECK_PALETTE. No script, no local path, no environment value, no record id, no sentence hash.
- Card (`card --id ID`): JSON { card_id, page_sha256, third_party: "Vercel", text, footer, note }. The note says Vercel hosts the page, anyone with the link can read it and nothing is sent until the person says yes. The card writes one pending file (`<home>/.mindrian/pyramid-seed/share-pending/<hash>.json`) holding the hash and a time only, no text. It sends nothing.
- Send (`send --id ID --confirm HASH`): refuses with exit 3 and card_required unless the confirm value is a 64-hex string, equals the hash of the page built now, and a pending file younger than 1 hour exists for it. The pending file is deleted before the deploy module is loaded, so a confirmation is single use. An edited record gives another page hash and needs a new card. The only deploy call is `deployDeck` of the unchanged `mva-vercel-deploy.cjs`, loaded lazily inside send. With no token the deploy writes the local fallback file and nothing leaves the machine; the script prints `shared: false` and the fallback path.
- Exit codes: 0 ok, 1 usage, 3 card_required, 4 no such record or bad id (2 for a record that fails validation).
- Seed block: one sentence added to step 7 of the Seed block in both files, byte equal. Frontmatter (teaching, help_jtbd) byte equal to HEAD (pinned by Test 9.4 of test-389-share).

## RED and GREEN

RED (module and script absent, `node tests/test-389-share.cjs`, exit 1): 1 passed, 17 failed, then a crash at the first call of `share.prepareCard` ("not a function"). The one pass was "the card makes no fallback file", true when nothing exists.

GREEN: `test-389-share: 49 passed, 0 failed`. `test-389-seed-structure: 91 passed, 0 failed` (was 86; five new checks, Test 9). `test-389-seed-record: 101 passed`.

The test uses the documented option `opts.deploy` as the deploy stub. Script tests run with VERCEL_TOKEN unset, HOME and the working folder in a scratch folder, and MINDRIAN_BRAIN_URL on a closed port. No real call to Vercel was made.

## BEFORE and AFTER (scratch HOME, closed-port Brain URL, no keys, MINDRIAN_EUREKA_ROOT unset)

| leg | before | after |
|-----|--------|-------|
| run-all-118 | exit 1, only mva-deck-builder.test fails (pre-existing Test 12 palette parity) | same |
| run-all-267 | PASS=31 FAIL=2 SKIP=1 | same |
| run-all-267.3 | PASS=5 FAIL=0 | same |
| run-all-389 | PASS=14 FAIL=0 | PASS=15 FAIL=0 (the new test) |
| test-270 (9 files, run one by one) | all 0 except resource-session-room 1 | same (resource-session-room is red before and after) |
| mva-vercel-deploy.test, resolve-vercel-key.test | pass | pass (not touched) |
| mva-deck-builder.test | 1 red leg (pre-existing) | same, not touched |
| build-skill-mirrors, build-connector-registry --check, build-orchestration-projection --check, check-render-coverage (Part 11) | 0 | 0 |
| irreversibility ledger --check | WARN 24 | WARN 24 (ledger not edited) |
| test-252 guard census | 3 unclassified files (not ours) | same 3, plus the pre-existing 5b fail |
| test-220 part 8 egress | PASS=8 | PASS=8 |
| dist check-stale | STALE (beta.52 vs beta.82) | same |

The Part 11 generators wrote no file (git status shows only this plan's files).

## Deviations from Plan

**1. [Scope] Dist copies not regenerated.** The two dist skill copies (`dist/generic-claude-dir/...`, `dist/zed/...`) hold no Seed block at all (0 matches for the seed marker): the bundles date from beta.52, and `build-dist-bundles.cjs` would regenerate the whole bundle and bring baseline drift (the standing instruction since plan 11). They stay as they are. `--check-stale` stays STALE as before.

**2. [Rule 2 - Part 8] Deployment name is the first 8 characters of the page hash, not the record id.** The plan says the record id works as sha8. The id is the first 8 hex characters of the hash of the venture sentence, so it would put a sentence hash in the Vercel deployment name and in the local fallback file name. The page hash prefix is used instead. Test 4.3 pins that the name is not the record id.

**3. [Wording] The share sentence also names the two commands.** The plan text gives the words "Offer once: ... says yes." Without the script name the offer cannot be carried out, so the same sentence continues with the card command and the send command. The pinned words of the plan are unchanged.

**4. The send script prints `shared` and the deploy result.** `shared` is true only when the deploy returned a URL. With no token or on any Vercel failure it is false and `fallback_path` is the local file.

## Now-unreachable functions (Phase 390 candidates)

`buildDeck` and `buildSlide` of `lib/core/mva-deck-builder.cjs` have no caller (only `DECK_PALETTE` is used, by the share module). The module also loads `data/mva-deck-template.html` at load time for this reason; it stays.

## Carry-over list

1. Pre-existing red: mva-deck-builder.test Test 12 (palette parity). Left as it is under APPROVE.
2. Dist copies of structure-argument stay without the Seed block until the next dist regeneration.
3. Old Vercel deployments named mos-brief-<sha8> stay on third-party accounts; Theo and the Desktop copy learn of the share step at the next release cut.
4. test-270-resource-session-room is red before and after (cause not investigated; not in scope).
5. The share step uses the home folder for the token lookup (env var VERCEL_TOKEN, `~/.mindrian.env`, `./.env` of the working folder), unchanged from resolve-vercel-key.

## UNVERIFIED

- No real Vercel deploy was made. The API shape is the shipped one in `mva-vercel-deploy.cjs`, unchanged.
- The offer inside a live Claude session (only the text and the scripts were checked).
- Theo-side and Desktop-copy state.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: network-egress-opt-in | lib/core/pyramid-seed-share.cjs | New path to api.vercel.com, reachable only through the share module behind the card and a single-use hash-bound confirmation (T-389-12-01). Covered by the plan threat model. |

## Self-Check: PASSED

Files exist: lib/core/pyramid-seed-share.cjs, scripts/pyramid-seed-share.cjs, tests/test-389-share.cjs. Non-ASCII grep over the three new files and over the added lines of the three edited files: no hits.
