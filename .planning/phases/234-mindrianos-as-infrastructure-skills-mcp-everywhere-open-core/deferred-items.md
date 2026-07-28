# Phase 234 deferred items

Out-of-scope discoveries logged during execution. Nothing here was fixed; each is
recorded so it is not re-discovered from scratch.

---

## D-1. RESOLVED 2026-07-28: 234-03 broke the skill-mirror contract (blocked the release gate)

**Found during:** 234-04 Task 2 consumer trace.
**Severity:** blocks `scripts/verify-release`; silently reversible data loss if the
generator is run in write mode.

`scripts/build-skill-mirrors.cjs` mirrors every `commands/<name>.md` into
`skills/<name>/SKILL.md`, byte-for-byte except ONE documented field exception
(`sensor_triggers: []`, the CONN-03 duplicate-tuple desensitize). 111 of the 125
shipped skills are that generated mirror, not hand-authored files.

234-03 applied four frontmatter transformations (`name:` insert, `allowed-tools`
list-to-string, `license:` add, `compatibility:` add) directly to
`skills/*/SKILL.md` and never touched `commands/*.md`. Measured now:

```
node scripts/build-skill-mirrors.cjs --check
build-skill-mirrors --check: 110 mirror(s) missing or stale
```

Three consequences:

1. `scripts/verify-release` line 315 runs that `--check` as a release gate. It fails,
   so `scripts/release.sh <version>` cannot pass today.
2. `scripts/hooks/pre-commit` also carries the leg. The currently-installed
   `.git/hooks/pre-commit` predates it (verified: `grep build-skill-mirrors
   .git/hooks/pre-commit` is empty), which is the only reason commits still work.
   Re-running `scripts/install-pre-commit.sh` would start blocking every commit.
3. **The dangerous one.** Anyone running `node scripts/build-skill-mirrors.cjs` in
   default WRITE mode overwrites all 110 divergent mirrors with the raw command bytes,
   silently REVERTING 234-03's entire migration and re-breaking the Agent Skills spec
   conformance this phase just achieved.

**Root cause:** the mirror contract is "byte-identical except one documented
exception". 234-03 introduced a second de-facto exception class (skill-layer spec
normalization) without amending `computeExpectedMirror()` to know about it.

**Two candidate fixes, both out of 234-04's scope:**
- Propagate the four transformations to `commands/*.md` as well, so mirror and source
  agree again. Cheapest, but it puts skill-spec metadata on command files that do not
  need it, and `build-command-registry.cjs` reads `fm.name` from `commands/*.md`, so a
  `name:` insert there is NOT inert.
- Teach `computeExpectedMirror()` to apply the same normalization when it computes the
  EXPECTED mirror content, making the transformation part of the documented contract.
  This is the architecturally cleaner one and matches how the existing
  `sensor_triggers` exception is already justified in that file's header.

**Related sub-case this plan deliberately did not force:** the same generator is why
`skills/value-proposition/` could not simply be renamed to `skills/validate-proposition/`.
See 234-04-SUMMARY.md.

### RESOLUTION (2026-07-28, unplanned gap-closure fix, code landed in commit `8abfcba1`)

Candidate 2 was taken. `commands/*.md` was NOT touched, honoring the generator's own
documented read-only invariant. `scripts/build-skill-mirrors.cjs` now computes the
skill-spec normalization as part of the EXPECTED mirror content, so the contract reads
"byte-identical to the command EXCEPT the enumerated, deterministic exception classes":

- **Exception class 1 (unchanged):** `sensor_triggers: []` desensitize. Verified
  unregressed: the desensitized set is byte-for-byte the same 61 mirrors as under
  `git show HEAD:scripts/build-skill-mirrors.cjs`, and each of the 61 was independently
  re-proven on disk (command has a non-empty array, mirror has `[]`). `commands/bono.md`
  keeps `[SENS-05]` while `skills/bono/SKILL.md` keeps `[]`, the asymmetry
  `tests/run-all-223.sh` asserts.
- **Exception class 2 (new):** the four 234-03 transformations, restated as line-level
  splices (never a YAML round-trip, which would delete the Canon Part 8 comments inside
  the `rs-experts` / `rs-thesis` `allowed-tools` blocks). `compatibility:` is decided
  STRUCTURALLY, by the presence of the `disable-model-invocation` frontmatter key plus
  the body hook-token grep, not by 234-03's hardcoded 15-name list.
- **Exception class 2b (new):** the name override. `commands/value-proposition.md` keeps
  `name: validate-proposition` (the Phase-122 resolver keys off it); the mirror's `name:`
  is overridden to the directory name for the Agent Skills spec. The extra comment run
  234-04 wrote above that line is PRESERVED verbatim from the mirror on disk, accepted
  only when the source's own comment run is an exact prefix of it. That is what makes a
  write-mode run non-destructive of a written reason.

Neither `skills/*/SKILL.md` nor `commands/*.md` was edited. The generator was never run
in write mode. `--check` went green purely by teaching the generator what "expected"
means, which is the property that proves 234-03/234-04's output was correct all along.

Verified: `build-skill-mirrors.cjs --check` OK (111 mirrors); `check-skill-spec.cjs
--check` OK (125/125); `--catalog-budget` 25%; `tests/run-all-234.sh` PASS=7 FAIL=0;
`tests/test-skill-mirrors-tripwire.cjs` PASS; `tests/run-all-216.sh` skill-mirror gate
PASS (its 2 remaining failures are D-4 and D-5 below, both pre-existing and untouched);
`scripts/verify-release` now reports 28 passed / 0 failed, "CLEAR TO RELEASE", with
section 10b green.

Consequence 3, the dangerous one, is closed: a write-mode run is now a no-op, because
`writeMirrors()` and `checkMirrors()` compute the same expected bytes and `writeMirrors()`
only writes when they differ.

**Commit-hygiene caveat, recorded rather than hidden.** The 342-line change to
`scripts/build-skill-mirrors.cjs` did NOT land under its own root-cause message. It was
staged, a shell-quoting error aborted this session's `git commit`, and a CONCURRENT
session's pathspec-less `git commit` (the v1.16.0 milestone docs run) then swept the
already-staged file into `8abfcba1 docs: define milestone v1.16.0 requirements`. The
committed bytes are exactly the intended fix (`git diff 8abfcba1 -- scripts/build-skill-mirrors.cjs`
is empty, `--check` is green at that commit), so nothing is wrong with the CODE. History
was deliberately NOT rewritten: `8abfcba1` is the branch tip of a live concurrent session
and force-rewinding it would be the multi-active destruction hazard the executor contract
forbids. So `git log -- scripts/build-skill-mirrors.cjs` will show a docs subject for this
fix; this note is the root-cause record that subject should have carried. Prevention: never
leave a path staged across a failed commit while another session may be running.

---

## D-2. Pre-existing: `tests/test-connector-exhaustive-coverage.cjs` 3 of 6 checks fail

Baseline at HEAD before 234-04, unchanged after it (verified against
`git show HEAD:data/...`):

- CHECK 1: 34 live surfaces classified in NEITHER the registry nor the allow-list
  (`/mos:agentshield`, `skill:admin`, `skill:doctor`, `skill:help`, ...).
- CHECK 2: 26 surfaces double-classified (in registry AND allow-list).
- CHECK 5: the count identity `wired + allowlisted === live` fails, 259 vs 246.

234-04 touched exactly one allow-list key (`skill:MOSDeckEngine` ->
`skill:mos-deck-engine`), which moved CHECK 3 from FAIL back to PASS. The 3 failures
above are untouched and predate this phase.

---

## D-3. Pre-existing: `tests/test-209-room-pick-sensor.cjs` fails

`run-all-209.sh` reports `PASS=8 FAIL=1`. The failing leg is
"REJECT-with-reason writes a typed REJECTED edge and does NOT promote", a SQL typed-edge
assertion. The file contains zero references to any surface 234-04 touched
(`grep -c "MOSDeckEngine\|mos-deck-engine\|value-proposition"` returns 0). Unrelated.

---

## D-4. Pre-existing: `scripts/check-help-coverage.cjs` exits 1

`MISSING from help-groups.json: intel-pipeline` and `pws-brain`. `data/help-groups.json`
was not modified by 234-04.

---

## D-5. Pre-existing advisory: `check-shape-declaration.cjs` WARN

`skills/visualize/SKILL.md` declares `hitl_shape: F.1` (a genuine Decision-Gate fork)
AND `connector.excluded: true` (the no-fork exemption) at once, contradicting Canon
Part 11. Advisory since Phase 210, exits 0.

---

## D-6. Stale prose, low priority

`data/deck-aliases.json` and `data/deck-styles.json` `_note` fields still describe the
skill as "the in-repo MOSDeckEngine skill". 234-04 updated the stale FILE PATHS inside
those notes (they pointed at a file that no longer exists) but left the prose naming of
the legacy alias handle alone, since `MOSDeckEngine` is still a live routing handle in
`data/deck-aliases.json`. A future editorial pass could reword the prose to distinguish
"the legacy handle MOSDeckEngine" from "the mos-deck-engine skill" more crisply.
