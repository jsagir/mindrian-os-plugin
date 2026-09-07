---
status: active
kind: coordination-brief
scope: cross-repo
direction: M-side -> T-side
sides: [MindrianOS-Plugin, Theo]
from_session: jsagi-81 (M-side, 2026-09-07)
for_phases_theo: [13, 14, 15, 06.3]
canon_parts: [8, 9]
created: 2026-09-07
---

# M-side to T-side: harness-manifest v2 compatibility brief

Durable channel entry per `2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md`. Nothing in
this file edits Theo; it names what Theo's Phases 13, 14, 15 and 06.3 need to know so that
what they build stays compatible with what M-side is about to build. Every number below was
measured live on 2026-09-07 from `/home/jsagi/dev/MindrianOS-Plugin` at `73c367c5`.

## 1. What M-side decided (navigator-approved, D1-D9)

- Phase 298 (SEED-032 harness-as-code, absorbing Phase 297) is the next M-side train.
  Spec: `docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md` (tracked, pushed).
  Design review: https://claude.ai/code/artifact/5398b3c4-b1d7-4c95-8fb0-05da01271992
- The existing `data/harness-manifest.json` (Phase 167) moves from v1 to v2. It ADDS three
  top-level keys (`policies`, `larry_surfaces`, `fixture_ref`) and changes NOTHING in the three
  maps it digests. `maps` stays exactly three. `data/command-registry.json` and
  `lib/core/recipe-maps.cjs` are NOT changed by Phase 298. Theo's sync trigger (its CLAUDE.md
  lines 370-372: a change to `command-registry.json` or `recipe-maps.cjs` in a release) does
  NOT fire from this phase.
- Shipped today in v2.0.0-beta.27 (tag at origin, npm latest): Larry recognizes Theo by name on
  all three surfaces and admits thin grounding with one capability clause. The trigger for that
  clause is the SHAPE of three Theo tool responses (section 3).

## 2. What Theo's Phase 13 / 15 should know before ruling on `MindrianCommand`

- M-side keeps `data/command-registry.json` authoritative for the command set (113 surfaces
  at `73c367c5`; the manifest's `maps[posture]` entry carries its sha256 digest and
  `source_count`). Phase 15's on-record argument (command-registry, not a raw Brain export,
  is the source) matches M-side's position. If `MindrianCommand` is admitted, the
  `mapped_by: command-registry@<version>` stamp (Theo SYNC-01) should anchor to the plugin
  RELEASE version, i.e. `2.0.0-beta.27` today; the manifest's `version` and the posture
  digest are the two machine-readable anchors M-side exposes for that.
- Coverage that M-side's honesty rule depends on: at the beta.19 flip, 228 of 258 command
  nodes had at least one framework link in Theo and 30 had zero (`/mos:leadership` among
  them). M-side has not re-measured since; per the protocol it will not reuse that snapshot.
  ASK: after Phase 13's compile lands, T-side publishes a fresh command-to-framework coverage
  count in its durable file, and names which of the 30 gained links from the four admitted
  labels (`MethodologyChunk`, `Framework`, `Technique`, `ProcessStep`).
- Nothing in Phase 298 asks Theo to admit any of the eleven deferred labels. The BPE memory
  channels (Belief / Progress / Experience) and the policy schema are LOCAL machinery metadata
  (Canon Part 8: `methodology_tier=mindrian-operation`), never Brain-side nodes.

## 3. Tool-contract shapes M-side now depends on (do not change silently)

Larry's shipped thin-grounding rule (`skills/larry-personality/SKILL.md`, "Honest about thin
grounding", commit `faef7e50`) keys off exactly these shapes. If any changes, say so in the
durable channel BEFORE it ships, so M-side can move the trigger in the same release:

| Theo tool | Shape M-side reads | Meaning on M-side |
|---|---|---|
| `brain_ask` | DirectiveEnvelope with an EMPTY `signals` set when upstream carries none | thin grounding: one honesty clause fires |
| `normalize_framework_name` | exactly ONE canonical match is the healthy floor; zero or multiple = thin | thin grounding |
| `orchestration_readiness` | `readiness.readiness_score`, floor 3 | below 3 = thin |
| `brain_stats` | node count against the per-origin floor (`THEO_NODE_FLOOR = 1000` on M-side) | doctor store-identity check |

Theo's roadmap already carries an open envelope question (`normalize_taxonomy_term` vs
`normalize_framework_name`, its lines 2212 and 2236) and names `feeds_into_chains` and
`orchestration_readiness` as "shape-correct thin-coverage tools" (CUT-02). Resolve that
question with the table above in view; M-side reads the `normalize_framework_name` shape,
not the taxonomy one.

## 4. Phase 14 (`.book-graph/` -> `theo-graph/` rename)

M-side references no Theo filesystem path. It talks to Theo only over MCP at the bare origin
in `lib/core/brain-client.cjs:40`. The rename is invisible to M-side as long as the served tool
names and shapes in section 3 do not change. No action needed on M-side; if the rename touches
any served tool name, that is a section-3 event.

## 5. Phase 06.3 (bidirectional sync drift detection)

Manifest v2 gives Theo a cheaper drift signal than diffing `command-registry.json`: the
manifest's `maps[posture].digest` changes whenever the registry changes. Recommended: Theo's
drift detector reads the manifest digest first and diffs the registry only when the digest
moved. The manifest is a tracked file at the repo root; no Brain call is involved.

## 6. What M-side asks of T-side, concretely

1. A fresh coverage count (section 2) after Phase 13 compiles, in T-side's durable file.
2. A one-line acknowledgement in that file that the section-3 shapes are frozen until
   announced, or the announced change.
3. If Phase 15 admits `MindrianCommand`, the stamp anchors to the plugin release version.

Live-channel note: at send time no T-side session was alive on this machine (the session
previously named "Brain-Theo graph reconciliation execution" is offline; `jsagi-9d` is
M-side). This file is the record; a ping follows when a T-side session exists.
