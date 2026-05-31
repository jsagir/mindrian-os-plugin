# Session Closeout -- Memory-System Review -> Cluster -> Release -> Fix Sweep

**Date:** 2026-05-30 / 2026-05-31
**Outcome:** v1.13.0-beta.36 shipped to users; Canon Part 9 memory system made real; review findings closed.
**Registered by:** Claude-as-Larry (Opus 4.8 1M)

This is the durable record of the session so it can be forgotten with confidence. Three parts:
what we built, what we fixed, what remains (tracked).

---

## 1. What we built (the memory cluster -- shipped in v1.13.0-beta.36)

Triggered by a 21-agent dog-food review of MindrianOS-as-a-memory-system (graded D+; filed at
`MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/`). The review found the
Canon Part 9 substrate was built but dormant. We closed the gaps via four phases, planned + verified +
executed through GSD, all on the v1.13.1 train but shipped on the v1.13.0 beta cadence:

| Phase | What landed | Review findings closed |
|-------|-------------|------------------------|
| **128** substrate-contract-adr | SUBSTRATE-CONTRACT.md ADR + `check-substrate.cjs` pre-commit guard (net-new-aware, self-allowlisting) wired into the live hook; SUBSTRATE-BASELINE.md (195 pre-existing bypasses, per-phase ownership) | C3, H1, M11 |
| **129** spine-repair-memory-event | 6 spine surfaces journal `memory_event` via navigation.cjs (5 new event types + FOLLOWS_FROM edge); `operator.cjs` sqlite bypass retired | C2, H3, M9 |
| **129.5** truth-machine-activation (net-new phase) | `confirmNode(db,id,byUser)` chokepoint; human APPROVE is the only path to a confirmed truth-claim node; USER.md byUser; agent identities rejected; Canon amended to v1.5 (audit-node carve-out) | **C1** (highest-value orphan) |
| **130** lens-engine-skeleton | `lib/core/lens-engine.cjs` + 3 synthesizers; 4 cognitive commands -> thin clients; hats filesystem-state retired to room.db; INFORMS + REJECTED_BECAUSE added to edge allow-list | H2 |

**Dog-food wins:** the Phase 128 guard caught + exposed its own three defects on the very next commit
(net-new whole-file, no self-allowlist, m4 false-positive) -- fixed same session, no `--no-verify`. Phases
composed (130 promotes via 129.5's confirmNode; 129.5 rides 129's memory_event spine). Validated live in the
real mindrianOS dog-food room: new spine events journaled, truth-machine promoted a human-confirmed node and
rejected an agent-confirmed one, brain-smoke PASS (Bug B fixed). Smoke evidence in the session transcript.

## 2. What we fixed (the sweep, 2026-05-31)

Bug B (the trigger) + the loose threads surfaced during the cluster:

| # | Fix | Commit | Status |
|---|-----|--------|--------|
| Bug B | doctor --brain-smoke Windows libuv UV_HANDLE_CLOSING crash (undici socket not drained on 401/403 + synchronous process.exit). Reported by tester Gary Laben. | `e409658f` | DONE; Linux-verified; Windows confirm pending Gary/CI |
| Guard hardening | check-substrate `--diff` net-new-aware + self-allowlist (the 128 guard blocked its own next commit) | `0d92bd76` | DONE |
| A | m4-cypher guard false-positive (matched any "match"+`${}` -- tightened to require a Cypher node pattern; case-sensitive MATCH); Case 5b regression test | `46fb6dbe` | DONE; suite 10/10 |
| G | DI-130-04-01 em-dashes in run-feynman-tests.cjs | `46fb6dbe` | DONE |
| E | DI-129-05-01 -- Phase 122 e2e Part 8 proximity false-positive (a `/mos:do` literal near "Brain" in a comment); reworded | `01ac581e` | DONE; e2e test passes 8/8 |
| D | release.sh Step 9.7 npx self-test flake (ran before npm propagated -> spurious `mindrian-os: not found` abort during the beta.36 cut). Added propagation-wait poll + `--prefer-online` | `e448492c` | DONE |
| B | npm `@latest` was stale at beta.12 (direct npm installers got months-old). Moved `@latest` -> beta.36 | (npm dist-tag) | DONE; `{latest: beta.36, next: beta.36}` |
| C | Gary's "403-despite-active" Brain key. ROOT CAUSE: brain-admin.cjs writes keys to a Supabase `brain_api_keys` table; the Brain edge (onrender) validates against its own store, so a key can be is_active in Supabase yet 403 at the edge (store separation / stale propagation, likely from the 2026-05-09 issuance). PREVENTION (adopted): verify every freshly-issued key with a live 200 probe before delivery -- done for the replacement key f5279e85. | (process change) | INVESTIGATED + DOCUMENTED; remote-edge code fix out of scope here |

## 3. The release

- **v1.13.0-beta.36** cut + shipped: npm `@mindrian_os/install` (@next + @latest), marketplace ref pinned to
  the pushed tag, install minisite + website, all consistent. Users get it via `/plugin marketplace update`.
- The release.sh self-test flaked mid-cut (transient, fixed forward by D). Recovery: pushed Commit A + tag so
  the marketplace ref resolved (closed a live missing-ref break), then Commit B.
- **Version policy adopted (maintainer):** NO pre-emptive next-bump. main HEAD stays AT the released version
  (beta.36), not perpetually one ahead "in progress". The next bump (beta.37) happens when the next pipeline
  item actually starts. This is what caused beta.35 to be skipped (it was only the phantom in-progress marker).

## 4. What remains (tracked, NOT done -- pick up deliberately)

- **F / H5 -- Brain-packet value-space (Part 8).** `data/brain-packet-schema.json` leaves `summary`/`explanation`
  as unbounded strings; `packet.cjs shortText()` can return prose. NOT a mechanical hash-it fix: the packet has a
  deliberate privacy-mode design (`local_summary_only` default / `allow_filenames` / `allow_excerpts`), so whether
  prose may ever cross is a DESIGN decision. DORMANT (zero live `sendPacket` consumers), so latent-only today.
  Needs a dedicated session reasoning about the privacy-mode contract + the ~7 packet tests. Tracked in
  `.planning/phases/_backlog/memory-review-residuals-h5-m7.md`.
- **M7 -- file-vs-graph reconciliation surface.** No doctor class proves STATE/MINTO/BRAIN agree with room.db.
  Best done AFTER 119 (room.db population). Same backlog file.
- **The 195 baselined substrate bypasses.** Catalogued in SUBSTRATE-BASELINE.md with per-phase ownership
  (the bulk -- ~15 lazygraph-ops/openGraph callers -- owned by 131 / v1.14.0). By design, not a fast-follow.
- **GSD-SDK cannot parse this repo's narrative STATE.md** (executors updated STATE/ROADMAP by hand). Dev-tooling
  friction, low priority.
- **review backlog (UI + brain-packet + memory-files):** H4/H5 -> Phase 125; H6/M5/M6/M7 -> Phase 119;
  **M1-M4 (UI enforcement) -> Phase 121.5** -- relevant to the NEXT session (UI/TUI/room-visualization unification).

## 5. Open human-loop items (not code)

- **Gary Laben:** Gmail draft `19e79ed6c59f1368` ready to send (beta.36 fixes the exact Windows crash he reported
  + his fresh Brain key f5279e85). Not yet sent.
- **Active room** left at `mindrianOS` (was `mof-procurement-workshop`).

---

_Closeout registered so the work is durable. Next session: UI / TUI / room-visualization unification -- see the
review's M1-M4 (UI enforcement) + Phase 121.5 terminal-coherence-capstone as the existing home._
