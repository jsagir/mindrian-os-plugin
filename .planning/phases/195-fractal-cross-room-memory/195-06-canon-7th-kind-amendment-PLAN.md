---
phase: 195-fractal-cross-room-memory
plan: 06
type: execute
wave: 5
depends_on: ["195-02"]
autonomous: false
requirements: [FCM-08]
files_modified:
  - docs/MINDRIAN-CANON.md
  - docs/CANON-PHASE-MAP.md
  - tests/test-195-canon-7-kind-floor.cjs
user_setup: []
must_haves:
  truths:
    - "Execution HALTS at a blocking checkpoint for navigator APPROVE before ANY canon byte is written."
    - "On approve, ONE atomic lockstep lands: Part 9 six-file list -> seven (+DRIFT) + a new Appendix D entry + a CANON-PHASE-MAP version-history row + a canon version bump + the FLOOR test flipped to assert 7."
    - "Frozen scalars are UNTOUCHED (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15); the CLAUDE.md membrane substring stays intact."
    - "The amendment mints NO new edge type, NO new reach, opens NO Brain wire; DRIFT is LOCAL only."
    - "CI never goes RED mid-amendment (all pieces move together)."
  artifacts:
    - path: "docs/MINDRIAN-CANON.md"
      provides: "Part 9 seven-file complement (+DRIFT) + new Appendix D entry"
      contains: "DRIFT"
    - path: "docs/CANON-PHASE-MAP.md"
      provides: "version-history row for the 6->7 amendment"
      contains: "195"
    - path: "tests/test-195-canon-7-kind-floor.cjs"
      provides: "FLOOR flipped to assert the 7-kind complement + prior entries preserved"
      contains: "DRIFT"
  key_links:
    - from: "docs/MINDRIAN-CANON.md Part 9 (line 338)"
      to: "tests/test-195-canon-7-kind-floor.cjs"
      via: "the FLOOR asserts the 7-kind complement present + frozen scalars intact"
      pattern: "DRIFT"
    - from: "FCM-07 code (Plan 02 BASENAME_TO_KIND)"
      to: "the canon 6->7 ratification"
      via: "the amendment ratifies an already-wired basename"
      pattern: "DRIFT"
---

<rules>
## RULES (restated every plan - non-negotiable)

- **CJS only. NO em-dashes anywhere (hyphens only).** HARD RULE.
- **NAVIGATOR-GATED (D-01):** FCM-08 is a CONSTITUTIONAL change. Execution PAUSES at a blocking `checkpoint:human-verify` for navigator APPROVE BEFORE any canon byte is written. Planning FCM-08 is autonomous-safe; RATIFYING it is NOT. Do NOT draft canon bytes autonomously; the navigator authors the exact bytes on approve.
- **Frozen scalars UNTOUCHED:** MAX_K=3, DIAL_REACH_K=6, 0.70/0.15. The amendment adds a memory KIND, not a Shape-F scalar; the CLAUDE.md membrane substring stays intact.
- **The amendment mints NO new edge type, NO new reach, opens NO Brain wire.** DRIFT is LOCAL only (Part 8): drift entries never egress.
- **ONE atomic lockstep (Part-6 dog-fooding canon-amendment-on-itself):** Part 9 body edit + Appendix D entry + CANON-PHASE-MAP version-history row + canon version bump + the FLOOR flip all move TOGETHER so CI never goes RED mid-amendment. Mirror Appendix D entries 23 (NESTED_WITHIN) and 33 (F.8/F.9).
- **Depends on Plan 02:** FCM-07 code already registered `'DRIFT.md':'DRIFT'` in BASENAME_TO_KIND, so the amendment ratifies an already-wired basename - code and constitution are consistent the instant the amendment lands.
- **Resumable:** the checkpoint gate answer persists; the atomic lockstep is one commit.
</rules>

<objective>
Wave 5 - the NAVIGATOR-GATED canon amendment (FCM-08 ONLY). Extend the canonical per-folder memory complement from SIX to SEVEN (ROOM / STATE / MINTO / BRAIN / FEYNMAN / USER + DRIFT) - a constitutional act, isolated behind a blocking human gate, mirroring how Phase 188 (entry 33) and Phase 169 (entry 23) isolated their frozen-set amendments.

Purpose: DRIFT.md is the memory kind that catches intent-vs-actual slippage where it lives (the 2026-06-11 drift-audit shape). The CODE registration already shipped autonomously (Plan 02); this ratifies it into canon under navigator authority.
Output: on APPROVE, one atomic lockstep landing the Part-9 6->7 edit, a new Appendix D entry, a CANON-PHASE-MAP version-history row, a canon version bump, and the FLOOR flipped to assert 7.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/195-fractal-cross-room-memory/195-CONTEXT.md
@.planning/phases/195-fractal-cross-room-memory/195-RESEARCH.md
@.planning/phases/195-fractal-cross-room-memory/195-PATTERNS.md
@.planning/phases/195-fractal-cross-room-memory/195-VALIDATION.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 1: HALT for navigator APPROVE before any canon byte (FCM-08 gate)</name>
  <action>Blocking checkpoint. This task performs NO file write. It HALTS execution and presents the exact 6->7 canon amendment for navigator review, then waits for an explicit "approved" before Task 2 may write any canon byte. Do NOT draft or land canon bytes in this task.</action>
  <what-built>
    The FCM-07 CODE registration already shipped (Plan 02): `'DRIFT.md':'DRIFT'` is in BASENAME_TO_KIND, DRIFT projects a memory_artifact node, and readSextuple reads it. The constitution has NOT yet been amended - this checkpoint gates the constitutional 6->7 change.
  </what-built>
  <how-to-verify>
    Review the EXACT amendment that Task 2 will write on approve (do NOT let the executor draft canon bytes before this gate). In substance (D-01, RESEARCH Item 5), the amendment must state:
    1. The canonical per-folder memory complement extends from SIX to SEVEN: ROOM / STATE / MINTO / BRAIN / FEYNMAN / USER + DRIFT.
    2. DRIFT.md is the per-folder intent-vs-actual ledger; drift audits file findings WHERE the drift lives (its home folder), not in an evaporating report.
    3. DRIFT.md is LOCAL only: drift entries NEVER egress to the Brain (Part 8), same locality as the other six kinds.
    4. The read contract extends readSextuple -> (the shipped read family grows by one; already coded in Plan 02).
    5. Frozen scalars are UNTOUCHED (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15); the amendment adds a memory KIND, not a Shape-F scalar.
    6. It mints NO new edge type, NO new reach, opens NO Brain wire.
    7. It is applied via the Part-6 dog-fooding canon-amendment-on-itself mechanism as ONE atomic lockstep (Part 9 body edit + Appendix D entry + CANON-PHASE-MAP version-history row + canon version bump + the FLOOR test flip), mirroring Appendix D entries 23 and 33, so CI never goes RED mid-amendment.
    Confirm this is the intended constitutional change and that the navigator authors/approves the exact bytes.
  </how-to-verify>
  <resume-signal>Type "approved" to authorize the atomic canon lockstep (Task 2), or describe required changes.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Atomic canon 6->7 lockstep (only after APPROVE)</name>
  <files>docs/MINDRIAN-CANON.md, docs/CANON-PHASE-MAP.md, tests/test-195-canon-7-kind-floor.cjs</files>
  <read_first>
    - docs/MINDRIAN-CANON.md Part 9 six-file list (PATTERNS.md: line 338 the "Files (Markdown + frontmatter) preserve meaning" list ROOM/STATE/MINTO/FEYNMAN/BRAIN/USER); Appendix D entries 23 (NESTED_WITHIN) + 33 (F.8/F.9) as the mirror precedent for the new entry.
    - docs/CANON-PHASE-MAP.md (prior version-history rows - exact row format to append).
    - tests/test-195-canon-7-kind-floor.cjs (Plan 01 green-as-guard asserting 6; flip it to assert 7 + prior entries preserved + frozen scalars intact).
  </read_first>
  <action>ONLY after the Task-1 checkpoint returns "approved". Execute the amendment as ONE atomic lockstep (one commit, so CI never goes RED mid-change): (1) edit docs/MINDRIAN-CANON.md Part 9 six-file list (line 338) from six to SEVEN by appending DRIFT to the complement; (2) add a new Appendix D entry mirroring entries 23/33 recording the 6->7 memory-kind amendment (DRIFT.md = per-folder intent-vs-actual ledger, LOCAL only, mints no edge/reach, opens no Brain wire); (3) append a version-history row to docs/CANON-PHASE-MAP.md for Phase 195; (4) bump the canon version string; (5) flip tests/test-195-canon-7-kind-floor.cjs to GREEN-ASSERTING-7: the 7-kind complement is present, all prior entries preserved, AND the frozen-scalar membrane substring (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) is intact in CLAUDE.md. Do NOT touch frozen scalars. NO em-dashes. The navigator authors the exact canon bytes; the executor applies the approved text and moves the mechanical pieces in lockstep.</action>
  <verify>
    <automated>node tests/test-195-canon-7-kind-floor.cjs &amp;&amp; bash tests/run-all-195.sh</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-canon-7-kind-floor.cjs passes asserting the 7-kind complement + prior entries preserved + frozen scalars intact; bash tests/run-all-195.sh exits 0 (all legs PASS); the 188 canon frozen-scalars floor is still green.</acceptance_criteria>
  <done>The constitution ratifies DRIFT as the 7th memory kind in one atomic lockstep; code and canon are consistent; frozen scalars untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| autonomous executor -> constitution | A constitutional change must not land without explicit navigator authority; frozen scalars must not drift. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-195-18 | Elevation | canon 6->7 bytes land in an autonomous wave (gate bypass, Pitfall 6) | mitigate | isolated behind a blocking checkpoint:human-verify; FCM-07 code lands autonomously, FCM-08 canon waits for APPROVE (mirror 188 entry 33) |
| T-195-19 | Tampering | frozen scalars drift while amending the memory kind | mitigate | the FLOOR asserts the membrane substring intact + frozen scalars untouched; the amendment adds a KIND, not a scalar |
| T-195-20 | Integrity | CI goes RED mid-amendment (partial lockstep) | mitigate | ONE atomic lockstep commit - Part 9 + Appendix D + phase-map row + version bump + FLOOR flip move together |
| T-195-SC | Tampering | npm/pip/cargo installs | accept | ZERO external installs this phase; supply-chain N/A |
</threat_model>

<verification>
- Task 1 checkpoint returned "approved" BEFORE any canon byte was written.
- node tests/test-195-canon-7-kind-floor.cjs green asserting 7 + prior entries preserved + frozen scalars intact.
- bash tests/run-all-195.sh exits 0 (full suite green); 188 canon frozen-scalars floor + 169 edge room-lineage floor still green.
- No em-dashes in docs/MINDRIAN-CANON.md / docs/CANON-PHASE-MAP.md edits.
</verification>

<success_criteria>
- The canon memory complement is SEVEN (+DRIFT), ratified under navigator authority.
- Frozen scalars untouched; no edge/reach/Brain-wire added; DRIFT LOCAL only.
- One atomic lockstep; CI never RED.
</success_criteria>

<artifacts_produced>
## Artifacts this phase produces (Plan 06)
- docs/MINDRIAN-CANON.md (Part 9 seven-file complement + new Appendix D entry)
- docs/CANON-PHASE-MAP.md (version-history row)
- tests/test-195-canon-7-kind-floor.cjs (flipped to assert 7)
</artifacts_produced>

<output>
Create `.planning/phases/195-fractal-cross-room-memory/195-06-SUMMARY.md` when done
</output>
