---
kind: seed
status: open
severity: medium
created: 2026-07-18
canon_parts: [10, 11]
related: [SEED-063 (OpenCode -- milestone 1, which this does not touch), SEED-006 (mindrian-wiki-sprint -- the visible room, the closest existing seed to this milestone)]
proving_case: "Licence verification against actual LICENSE files 2026-07-18, not blog summaries. AFFiNE root LICENSE carves packages/backend and packages/common/native under a proprietary AFFiNE EE License reading 'It is forbidden to copy, merge, publish, distribute, sublicense, and/or sell the Software' absent a subscription -- while the README still claims 'free for self-host under the MIT license'. Docmost is AGPL-3.0 with the §13 network clause. OpenHands added a PolyForm Free Trial carve-out to enterprise/ on 2025-09-02, after most published summaries said 'OpenHands is MIT'."
source: "navigator pasted a proposed stack 2026-07-18 recommending AFFiNE as 'the closest ready-made shell; strong candidate for forking'. Licence verification found it to be the single worst option on the list for a commercial closed-source product. Sequencing decision the same session: terminal first, workspace later."
---

# SEED-066: Collaborative-shell licence findings -- AFFiNE and Docmost are disqualified

## What's actually open

Nothing active. **Sequencing decision 2026-07-18 was terminal-first, workspace-later.**

**Trigger:** the collaborative-workspace milestone. This seed exists so that milestone is
not architected around a foundation that cannot legally carry it -- the expensive failure
mode is discovering this *after* building toward it.

## DISQUALIFIED -- do not build on these

**AFFiNE.** The root LICENSE carves `packages/backend` and `packages/common/native` under
a proprietary **AFFiNE Enterprise Edition License**:

> "It is forbidden to copy, merge, publish, distribute, sublicense, and/or sell the
> Software" (absent an AFFiNE subscription)

The client is MIT. **The sync/collaboration server -- exactly what multiuser rooms need --
is the forbidden part.** Three aggravating factors:

- **The README contradicts the LICENSE.** It still says "CE is free for self-host under
  the MIT license." A maintainer publicly called the server licence a mistake
  (discussion #5947) and it was never corrected. A code-license-only or README-only
  review walks straight into this.
- **De-branding is sold as an Enterprise feature.** MIT on the client says nothing about
  the trademark, and AFFiNE monetises exactly the thing a white-label needs.
- CLA in place, VC-backed (TOEVERYTHING PTE. LTD.), HIGH relicensing risk.

**Docmost.** AGPL-3.0. The **§13 network clause** means offering a modified version over
a network obliges publishing the Corresponding Source **to those users** -- our entire
rebranded fork becomes publicly available, and competitors can take it. Close-source is
impossible; no purchasable AGPL exception was found. `ee/` directories are additionally
non-distributable.

## CONDITIONAL

- **BlockSuite** -- MPL-2.0. Workable (file-level copyleft: modified BlockSuite files stay
  MPL and must be published; our own files stay closed). But **already relicensed once**
  (Apache-2.0 -> MPL-2.0, commit `d5efbc8`, 2022-10-17), same company as AFFiNE, CLA in
  place. HIGH relicensing risk.
- **BlockNote** -- MPL-2.0 core, **GPL-3.0** for `packages/xl-*` (AI, multi-column
  layouts, PDF/DOCX/ODT export). GPL is incompatible with closed-source; commercial
  licence is $195/mo, pricing public.
- **OpenHands** -- MIT **only after deleting `enterprise/`** (PolyForm Free Trial 1.0.0:
  30 days use per calendar year, non-distributable, no sublicensing). Carve-out added
  2025-09-02. **Registered USPTO trademark** on OPENHANDS (99583644).

## CLEAN

- **Yjs** -- MIT, individually maintained (Kevin Jahns, academic origin), **no CLA**.
  Lowest relicensing risk on the board.
- **Tiptap core** -- MIT. Pro / Collaboration / Comments / AI toolkit are separate
  proprietary subscriptions and are **not in the repo at all** (Start $59/mo through
  Business $1,199/mo, on-prem is Enterprise-only).
- **Hocuspocus** -- MIT, but owned by Tiptap GmbH, who sell a competing hosted Cloud.
  MEDIUM relicensing risk; existing MIT releases are irrevocable, so worst case is
  forking at the last MIT commit.

## Consequence for the milestone

**The clean components are the low-level ones.** Milestone 2 is therefore **assemble from
parts we control**, not **fork a workspace**. That is more work than forking AFFiNE
appeared to be -- but it means no proprietary backend, no vendor selling us the right to
use our own name, and no CLA-backed relicensing gun under the foundation.

The sequencing decision looks better for this, not worse: milestone 1 (SEED-063) touches
none of it, and the same `lib/` and the same prompts feed both milestones.

## Meta-lesson worth keeping

**A permissive code licence is not permission to rebrand.** Two of eight projects had
traps invisible to a code-license-only review:

- AFFiNE monetises de-branding as an Enterprise feature
- All Hands AI holds a registered USPTO trademark on the OpenHands name

In both cases the code licence is silent on the matter. **Always check trademark
separately, and always read the LICENSE file rather than the README.**
