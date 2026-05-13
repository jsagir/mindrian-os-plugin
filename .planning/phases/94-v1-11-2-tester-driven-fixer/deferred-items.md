# Phase 94 -- Deferred Items

Out-of-scope discoveries logged during plan execution. Each item documents what was found, why it was deferred (out of plan scope), and which future plan should address it.

## 2026-04-29 -- Plan 94-08 discovery: 2 additional U+2717 occurrences in commands/room.md

**Found during:** Plan 94-08 final verification (broader `commands/*.md` sweep gate).

**Discovery:**
```
$ grep -nP "[\x{2717}]" commands/*.md
commands/room.md:146:✗ Section not found: [section-name]
commands/room.md:226:  ✗ Room already exists: [path]
```

**Why deferred:**
- Plan 94-08's `files_modified` frontmatter explicitly listed only `commands/admin.md` and `commands/help.md`.
- Plan 94-08's QA handoff (Section 3 FIX-7) evidence enumerated exactly 5 occurrences across only those two files; commands/room.md was not in scope.
- Parallel-execution instructions for Plan 94-08 mandated: "Touch ONLY commands/admin.md and commands/help.md (and SUMMARY.md)."
- Per executor SCOPE BOUNDARY: "Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing... in unrelated files are out of scope. Log out-of-scope discoveries to deferred-items.md."

**Recommended remediation:**
A small follow-on fix in v1.11.3 (or a tiny addendum plan 94-08b in v1.11.2 if scope allows). The fix is mechanically identical to 94-08: two-char replacements (`✗` -> `x`) on commands/room.md lines 146 and 226. Same canonical glyph rationale (skills/ui-system/SKILL.md Section 7 -- ASCII `x` is the error-line glyph).

**QA-handoff Section 3 FIX-7 acceptance gate (broader interpretation):** Plan 94-08 satisfies the literal acceptance (`grep -P "[\x{2717}]" commands/admin.md commands/help.md` returns no matches). The broader acceptance (`grep -lP "[\x{2717}]" commands/*.md` returns no files) requires this deferred fix to ship alongside.

**Status:** OPEN -- assign to v1.11.3 backlog or 94-08b addendum.

---

## 2026-04-29 -- Phase 94 pivot: 94-09 + 94-10 deferred for /mos:heal priority

**Decided by:** Jonathan (user, 2026-04-29 ~12:15 UTC)

**Trigger event:** Parallel session running v1.11.0 wiring heal on the dog-food mindrianOS room surfaced 4 bugs, one of which (BUG-4: missing /mos:heal command) had higher structural value than 94-09 polish + 94-10 release-as-v1.11.2. User invoked counter-proposal during 94-09 dispatch.

**Reasoning grounds (3 independent):**
1. Hughes pattern -- /mos:heal attacks the lagging component (other rooms cannot self-heal without operator in the loop). 94-09 polish advances the front. The asymmetry is wrong.
2. Customer-blocking filter -- /mos:heal is the only deferred-bug item that any current external user (the Wave-1 testers) is plausibly within 30 days of needing. BUG-1 (FEYNMINTO budget) needs 40+ artifact section first; BUG-2 (queue drain) is invisible to external users.
3. Release cleanliness -- stacking 94-01..94-08 + 94.1-01 onto v1.11.1-beta.1 yields a single coherent "tester-driven fixes + heal command" GA. Cleaner CHANGELOG narrative than splitting v1.11.1 (8 fixes) and v1.11.2 (heal).

### Plan 94-09 explain-decision-action-footer (DEFERRED)

**Status:** DEFERRED to v1.11.3 or v1.12.

**Re-trigger condition:** When 5+ external users file UI feedback citing missing footer on `/mos:explain-decision` rendered output. OR when a parallel UI-quality sweep is greenlit and 94-09 is bundled with sibling polish plans. Currently zero external-user reports of footer absence.

**Plan file:** `.planning/phases/94-v1-11-2-tester-driven-fixer/94-09-explain-decision-action-footer-PLAN.md` (preserved verbatim; ready to execute when triggered).

### Plan 94-10 v1.11.2-release-gate (DEFERRED)

**Status:** DEFERRED indefinitely. Replaced by v1.11.1 GA (promoting v1.11.1-beta.1 with 94-01..94-08 + 94.1-01 stacked on top).

**Re-trigger condition:** When v1.12 is ready to ship and shipping the next patch as v1.11.2 (instead of jumping to v1.12.0) is the smaller increment. As of 2026-04-29 the next planned milestone is v1.12 (Goose extension OR roadmap-canonical phase 92+); v1.11.2 will not be cut.

**Plan file:** `.planning/phases/94-v1-11-2-tester-driven-fixer/94-10-v1.11.2-release-gate-PLAN.md` (preserved verbatim; reusable as a v1.X.Y release-gate template).

### Plan 94.1-01 mos-heal-command (NEW; ACTIVE)

**Status:** ACTIVE -- replaces 94-09 + 94-10 in the v1.11.1 GA stack.

**Plan file:** `.planning/phases/94.1-v1-11-1-mos-heal-command/94.1-01-mos-heal-command-PLAN.md`

**Spec source:** `~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md` (10-step recipe, dog-fooded on mindrianOS room 2026-04-29).

**Out of scope for 94.1 (deferred to v1.12 with explicit triggers below):**

#### BUG-1 FEYNMINTO-01 token budget (mega-section MINTO writes blocked)

**Re-trigger condition:** When any monitored user room has a section with 40+ artifacts and the user reports inability to regenerate MINTO. OR when v1.12 milestone planning includes the budget-relaxation work. Heal command in v1.11.1 will graceful-degrade (status='blocked_feynminto_01' + tier-0 fallback) -- the bug is suppressed not solved.

**Code citation:** `lib/memory/narrative-schema.cjs` FEYNMINTO-01 enforcement (1500-token body budget).

**Reproducer:** `node scripts/vault-section-minto-generator.cjs <room> --write --section solution-design --narrative <any-narrative.json>` on a section with 40+ artifacts -> "Narrative body token budget exceeded: estimated N > 1500".

**v1.12 candidate plan:** "94.2 / 95.x feynminto-01 budget scaling for mega-sections" -- relax budget OR introduce sub-section hierarchy OR archive-folder pattern (per recipe Section 'Open issues for the plugin' item 1).

#### BUG-2 brain-derivation-queue auto-drain hook (queue not processed)

**Re-trigger condition:** When the next session-start hook OR /mos:* command-completion hook is being modified for unrelated reasons; bundle the drain hook in. OR when v1.12 milestone planning includes the drain work explicitly.

**Code citation:** No drain processor exists. Queue file: `<room>/.mindrian/brain-derivation-queue.json`. Heal command in v1.11.1 will read queue depth + age but NOT drain (Step 8 is read-only).

**Observed staleness:** mindrianOS room queue holds entries enqueued 2026-04-24, undrained as of 2026-04-29 (5 days; heal recipe Section 'Open issues' item 4).

**v1.12 candidate plan:** "94.3 / 95.y brain-derivation-queue drain hook" -- on-stop OR session-start hook that consumes queue entries and fires brain derivation per entry.

#### BUG-5 (recipe Open Issue 3) Section auto-creation on plugin upgrade

**Re-trigger condition:** When the next plugin version adds a new canonical section (similar to v1.11.0 adding `legal-ip`). OR when first external user reports their room missing a canonical section after upgrade.

**Mitigation in v1.11.1:** /mos:heal Step 2 creates missing canonical sections; users running heal post-upgrade are covered. The auto-scaffold-on-upgrade behavior remains unimplemented.

**v1.12 candidate plan:** "94.4 / 95.z auto-section-scaffold on plugin upgrade" -- post-install hook that walks the registered canonical-section list and creates any missing directories with seed files.

---

## Stream sequencing notes (post-94.1 GA cut)

Per Jonathan's revised 6-week game plan (2026-04-29), execution priority after v1.11.1 GA:

- **Stream A** Closer hire pattern (Jonathan; lead time on hiring decisions; first interviews mid-May)
- **Stream D** First paid pilot precedents (Jonathan + Lawrence; deal definition; feeds Stream A)
- **Stream C** Install friction benchmarks (Jonathan + 2 cold testers; enable closer to point at working install; 22 May target)
- **Stream B** Sub-MINTO hierarchy architecture (Jonathan; spec only in v1.11.1 cycle; ship in v1.12)
- **Stream E** Brain-queue drain design (Jonathan; spec by 07 June; ship in v1.12)

Streams A + D run parallel this week. Streams B + C + E sequence behind. Plugin polish work (94-09, future v1.X.Y polish) is gated behind external-user-feedback triggers.
