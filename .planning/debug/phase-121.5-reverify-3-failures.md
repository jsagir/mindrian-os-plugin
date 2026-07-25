---
status: fixing
trigger: "Diagnose and fix 3 Phase 121.5 re-verify failures after 118/119/120/121 landed (help-renderer Test 3, help-coverage Test 10, coherence-smoke ~line 152)"
created: 2026-05-19T00:00:00Z
updated: 2026-05-19T00:02:30Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED. /mos:dogfood-flush (added in Phase 120, beta-train commit e1014306+47675768) has commands/dogfood-flush.md with valid help_jtbd: frontmatter AND visibility unset (defaults to "user"), but is MISSING from data/help-groups.json. Coverage gate exits 1; help-renderer Test 3 sees 0 group memberships; coherence-smoke Test 9 cross-checks check-help-coverage.cjs and fails on the same exit code.
test: Add "dogfood-flush" to infrastructure group in data/help-groups.json (alongside setup/update/doctor/build-knowledge -- it's a plugin-operations utility, dog-fooding instrument per Canon Part 6, fits the Infrastructure semantic).
expecting: All 3 failing tests pass; bash tests/run-all-121.5.sh exits 0 with 11/11 suites green.
next_action: Apply Edit to data/help-groups.json (single-line append), then re-run the 3 failing suites individually, then the full run-all-121.5.sh.

## Symptoms

expected: `bash tests/run-all-121.5.sh` exits 0 with 11/11 suites green (was green on 2026-05-16 per VERIFICATION.md).
actual: 3 failing suites:
  - lib/memory/help-renderer.test.cjs Test 3 ("every non-admin command appears in exactly one group")
  - lib/memory/help-coverage.test.cjs Test 10 ("check-help-coverage.cjs exits 0 against live repo")
  - tests/test-coherence-smoke.cjs (~line 152, assertion expected: true / actual: false)
errors: see actual (Node test framework assertion failures)
reproduction: `cd /home/jsagi/MindrianOS-Plugin && bash tests/run-all-121.5.sh`
started: Sometime between 2026-05-16 (121.5 verified green) and 2026-05-19 (today). Phases 118, 119, 120, 121, 121.5-08 shipped in between.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-19T00:01:00Z
  checked: node scripts/check-help-coverage.cjs (live coverage gate against current commands/ and data/help-groups.json)
  found: stdout "valid: false / MISSING from help-groups.json: dogfood-flush". Exactly one offender. Exit 1.
  implication: This is THE root cause. One missing entry cascades to 3 test failures because all 3 use the same check.

- timestamp: 2026-05-19T00:01:30Z
  checked: ls commands/dogfood-flush.md + head -20 frontmatter
  found: File exists. Frontmatter declares `help_jtbd: "Manually flush captured plugin edits into the mindrian dataroom."` + body_shape: E + serves_jtbd: ["audit-room"]. No `visibility:` field -> defaults to "user" (per renderer + checker logic) -> MUST appear in a group.
  implication: Phase 120 added the command file with proper help_jtbd but forgot to wire it into data/help-groups.json. Classic naming-drift gap.

- timestamp: 2026-05-19T00:02:00Z
  checked: data/help-groups.json deprecated_aliases block + groups arrays
  found: Phase 121.5-08 correctly registered the 4 demoted commands (heal, query, organize, hmi-status) in deprecated_aliases; commands/visualize.md is in hub group; all other Phase 118/119/121.5-08 work (mva-option, mva-brief, mos, fingerprint) is already wired correctly. ONLY dogfood-flush is missing.
  implication: Phase 121.5-08 sweep was thorough; Phase 120 was the single miss.

- timestamp: 2026-05-19T00:02:30Z
  checked: Cross-check why the 3 tests fail in unison
  found: (1) help-renderer.test.cjs Test 3 builds seen-count map from groups[].commands[]; dogfood-flush count = 0 -> "missing from all groups" error. (2) help-coverage.test.cjs Test 10 spawns check-help-coverage.cjs and asserts exit 0; checker exits 1 -> assertion fails. (3) test-coherence-smoke.cjs Test 9 runs `cross_check_all_tripwires` which calls all 5 CI tripwires including check-help-coverage.cjs; tripwire exits 1 -> r['check-help-coverage.cjs'].ok is false -> equal(... true) at line 152 fails.
  implication: Single fix (add "dogfood-flush" to one group) closes all 3 failures atomically. No other coupling.

## Resolution

root_cause: Phase 120 (breakthrough Category G, commits e1014306 + 47675768) shipped commands/dogfood-flush.md with valid help_jtbd: frontmatter but failed to register the command in data/help-groups.json. Three Phase 121.5-07 CI tripwires (help-renderer Test 3, help-coverage Test 10, coherence-smoke Test 9 via cross_check_all_tripwires) all consume the same coverage check and all flip red on the same missing entry.
fix: Add "dogfood-flush" to the infrastructure group in data/help-groups.json. Semantic fit: infrastructure currently holds setup / update / doctor / build-knowledge -- plugin-operations utilities. dogfood-flush is a Phase 120 dog-fooding instrument that flushes the plugin's own captured edits into its own mindrian room (per Canon Part 6 Product-as-Venture). Same semantic class.
verification: (pending)
files_changed: [data/help-groups.json]
