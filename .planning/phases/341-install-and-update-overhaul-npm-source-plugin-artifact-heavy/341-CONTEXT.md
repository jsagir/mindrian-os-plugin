# Phase 341: Install and update overhaul: npm-source plugin artifact, heavy-dep cut, one install location, transactional update - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A user on Windows, Mac, or Linux runs the two documented commands (`/plugin marketplace update`,
`claude plugin update mos@mindrian-marketplace`) and gets a working, current MindrianOS - because what
ships is a built npm artifact under the platform's documented ceiling, not the development repository.
In scope: the delivery artifact and its dependency delivery, the release ceremony and `/mos:update`
changes that follow, the harness gates that keep the payload honest, Eureka's on-demand model delivery
and its honest doctor verification, and collapsing to one install location. Out of scope: Theo
awareness/trigger of the intelligence layer (Phase 342), selective install profiles (Phase 285).

</domain>

<decisions>
## Implementation Decisions

### Delivery artifact (locked at the 2026-09-09 Decision Gate; delivery ratified in discussion)
- **D-01:** Marketplace `source` becomes `{"source":"npm","package":"@mindrian_os/cli","version":"<exact>"}`.
  Exact version, never a range or dist-tag: a caret range silently stops resolving once the patch or
  minor tuple moves (measured on semver 7.8.0: `^2.0.0-beta.30` rejects `2.0.1-beta.1` and
  `2.1.0-beta.1`); a dist-tag would auto-push every publish to every user because Step 9.5 promotes
  `@next` to `@latest` (scripts/release.sh:765-775), contradicting "third-party plugins never auto-push".
- **D-02:** The npm tarball IS the plugin. `package.json` `files` = the runtime tree only:
  `.claude-plugin/`, `.mcp.json`, `hooks/`, `commands/`, `skills/`, `agents/`, `lib/`, `scripts/`,
  `bin/`, `data/`, `references/`, `templates/`, `assets/`, `dist/`, plus the `ROOM.md` identity files
  those directories carry. Excluded: `.planning`, `tests`, `evals`, `lab`, `test`, `test-fixtures`,
  `dashboard` sources, the bundled PDF, and EXPLICITLY `lib/wiki/editor-src` (its nested node_modules is
  9,119 entries; npm's node_modules exclusion is root-only; measured: including it pushes the tarball to
  16,893 entries / 251.5 MiB, 4.5 MiB under the ceiling). `docs/` ships only if a runtime read needs it
  (planner verifies).
- **D-03:** `@huggingface/transformers` leaves `dependencies` entirely (not `optionalDependencies`: the
  loader's `npm ci` installs optional deps by default). Its transitive stack (onnxruntime-node/-web,
  sharp, @img/*) leaves with it. Delivery of that stack is D-09.
- **D-04:** Dependency delivery = `npm-shrinkwrap.json` at the plugin root + the Claude Code loader's own
  `npm ci --ignore-scripts` (documented npm-source path; "npm excludes package-lock.json from published
  packages"). Platform-correct per machine: sqlite-vec's five platform packages resolve locally.
  Measured 9.3 s cold / 4.3 s warm for the 127-package set against the documented 60-second cutoff; zero
  lifecycle scripts across 139 packages. `bundleDependencies` REJECTED by measurement (bundles only the
  publish host's sqlite-vec platform package; npm refuses the rest with EBADPLATFORM; Windows/Mac would
  silently degrade to the cjs-fallback with no error surface). `devDependencies` stays empty as stated
  policy (`npm ci` `omit` defaults to empty). The existing backstop (lib/core/mcp-dep-heal.cjs
  `requireWithHeal` + scripts/sessionstart-npm-reconcile.cjs) stays live for the timeout tail.
- **D-05:** Fallback ONLY if the npm source shows an undocumented gotcha in research: `archive` source
  (HTTPS zip + documented `sha256` verification, Claude Code v2.1.224+) built by `git archive` +
  `export-ignore`. Not the primary path.

### Release ceremony and /mos:update (adopted as a set)
- **D-06:** Git tag `vN` + Commit A / Commit B stay the source-of-record; only Step 6.7 (vendoring,
  scripts/release.sh:612-672) and its Commit-B untrack block (:1286) are deleted. Step 4 writes
  marketplace `version` + `source.version` instead of `source.ref`; doctor `version-of-record-published`
  (scripts/doctor.cjs:847-890) compares `source.version`; the 5-way rule's record 5 becomes the
  marketplace `source.version` pin. Step 8's expected-2-commits guard, Step 5.5 tag-verify, 9.5 publish,
  9.8 acceptance all survive unchanged. Step 9.5's blanket `grep -Eq 'node_modules/'` payload guard
  (:753) becomes the ceiling assertion of D-08, not a ban.
- **D-07:** `commands/update.md` collapses to Check, Confirm, loader (`claude plugin update`), Verify.
  Deleted: Step 6 stale-path migrator, Step 7 atomic activator, the `~/.mindrian/post-update-restart-
  pending` touch-file and its preflight banner. The restart banner stays ONLY on a real swap (the
  slash-command registry is built once at session start, update.md:196) and drops on `UP_TO_DATE`. The
  SHA leg (`SHA_DIFFERS_INVERSION_HOTFIX`, the api.github.com tag-ref call at
  scripts/check-version-and-sha.cjs:222) is retired: published npm versions are immutable, so an
  in-version hotfix is a new version.
- **D-07a (added 2026-09-10, navigator, mid-execution before wave 8):** The first session after any
  install or update VERIFIES ITSELF and rewards the navigator. (a) Trigger: the plugin version changed
  since last seen (`installed_plugins.json` version vs a last-seen marker under `~/.mindrian/`), which
  replaces the retired touch-file as the post-update signal; the loader cannot forget to set it.
  (b) Local verification, bounded and offline, inside the existing SessionStart hook budget (the
  preflight hook runs at 12 s today, hooks/hooks.json): the doctor points that already exist -
  `install-state`, `session-start-active-version`, `activation-reached-the-wire`,
  `mcp-surface-tool-count`, `harness-policies`. Full `doctor --all` stays opt-in. (c) Statusline: ONE
  segment, version plus glyph - `mos beta.N` with a check mark when the bounded set passes, a warning
  glyph plus the failing count when it does not; the detail is Larry's first line. Co-designed with the
  navigator (this session), per the statusline rule. (d) Theo health: after the local set, probe Theo
  reachability by REUSING the shipped class M brain-smoke / brain-client availability probe (Canon Part
  7), DETACHED so session start never blocks on the network, honest refusal on failure (Decision #8).
  (e) One insight, Theo and Larry together: with Theo reachable, fetch ONE generic methodology nugget
  keyed by a generic handle only (the active room's problem type or stage; never room content, Canon
  Part 8) and let Larry frame it in one sentence as a question or nudge (GUIDED, never a lecture),
  delivered on the first turn after the verification line, once per install or update, never per
  session. This is the Hooked variable reward for the first-step surface (standing rule). Reuse the
  Phase 267.2 detached-spawn delivery pattern (scripts/first-install-router.cjs) rather than a second
  mechanism. (f) Declared as a harness policy in a NEW `session-start` tier of
  `data/harness-policies/`, rung `logged` (on a navigator's machine a failed verification is surfaced,
  never blocking). Lands in plan 341-08 as the Verify step's automatic half; the 341-08 plan is revised
  and re-checked before wave 8 executes.
- **D-08:** Two harness policies in `data/harness-policies/` riding the existing `harness-policies`
  doctor point (scripts/doctor.cjs:1387-1390, blocker, applies_to pre-tag + full), so they run at Step
  6.6 (pre-tag, failure = rollback) and Step 9.8 (full): (a) `release-payload-ceiling`, rung `blocking`,
  asserts `entryCount <= 20000` and `unpackedSize <= 268435456` from `npm pack --dry-run --json` (local,
  offline; NOT packed size); (b) the folded registry-drift gate, rung `logged` for one release, then
  human-promoted per `_schema.json`'s promotion rule. Both authored AFTER the `files`/dependency cut
  (on HEAD today `npm pack --dry-run` measures the 6-entry shim: 250,327 / 674,143 / 6).

### Eureka first-class (navigator: "this might be the moat"; the slim install defers the download, never the capability)
- **D-09:** `/mos:eureka enable`, mirrored as `doctor --fix eureka`, installs the embedding stack into
  `~/.mindrian/eureka-deps/`, platform-scoped (`--os`/`--cpu` so a Mac never downloads DirectML.dll),
  through the existing cross-platform npm invocation (lib/core/npm-cli-resolve.cjs `buildInstallArgs`),
  resolved by a net-new `createRequire` shim; shared across plugin versions for the same reason the model
  cache already lives at `~/.mindrian/model-cache` (cache-prune.cjs deletes the version dir on update).
  REJECTED: SessionStart prefetch (60 s loader / 120 s hook budgets make 380 MB a guaranteed timeout);
  a consent prompt inside `eureka-run` (the scan path is detached/un-awaited, tool-router.cjs:1358-1379,
  so consent cannot render there; it would reproduce the D14 silent hang).
- **D-10:** Capability is never conditional on the model at the registry level. Every engine stays
  reachable on a slim install; an engine that needs the model renders an honest "model not installed,
  run /mos:eureka enable" state, never a silent no-op (12+ consumers already honor
  `encoder_unavailable`; report-html.cjs:78 renders `degrade_cause`). SEED-049 D14's unshipped one-time
  Larry-voiced first-run notice for the lazy weights download (`MongoDB/mdbr-leaf-ir`) ships here.
- **D-11:** Doctor class S (lib/core/doctor/class-s-eureka-smoke.cjs): split L1 into "capability
  reachable" (blocker) and "model installed" (advisory carrying the exact enable command) by ADDING a
  layer id (the harness pins layer ids and order); fix the live bug at :180 (async `isModelCached` called
  without `await` and without `dtype`, so the cache-miss branch at :183-190 is unreachable and L3 always
  embeds for real); add a slim-install arm asserting the honest not-installed state.
  `DOCTOR_SKIP_EUREKA_SMOKE=1` is never used on the shipped artifact.
- **D-12:** Pin the true topology with one no-drift test (the tests/test-213-part8-boundary.cjs
  grep-tripwire idiom): Eureka, critic included, has no Brain/Theo reach (`eureka_critic` is on the LOCAL
  server, lib/mcp/tool-router.cjs:1987, in-process `criticRule`). Theo awareness and trigger are Phase
  342's scope; this phase must NOT preclude them: keep `data/` shipping (command-registry.json,
  framework-names.json, connector-registry.json, brain-orchestration-projection.json,
  harness-manifest.json are runtime reads); the `enable` subcommand must not change
  `command: "/mos:eureka"` identity; keep `data/framework-names.json` and `--refresh-names` intact.

### Proof before anything else
- **D-13:** Migration order is load-bearing: (1) dependency + `files` cut, shrinkwrap, exact-pin npm
  source, the two harness policies; cut the next beta; (2) prove a COLD install on Windows, Mac and Linux
  completes and the two bundled MCP servers load - until that passes nothing else ships; (3) retire the
  second install location; (4) collapse `/mos:update`; (5) retire the doctor classes whose failure mode
  is now unreachable (the proof the overhaul worked).

### Claude's Discretion
- One-install-location mechanics (not selected for discussion; the navigator's teardown direction is the
  guide): the marketplace cache + `CLAUDE_PLUGIN_ROOT` is the only guaranteed location; `install.sh`
  (367 lines) is retired as a primary path - research decides whether any host without the marketplace
  loader still needs it; a `doctor --fix` that verifies nothing in settings resolves through
  `~/.claude/plugins/mindrian-os`, backs it up, removes it (F2 reproduced on Windows, absent on Linux);
  doctor classes A/H and the two-topology halves of I/J retired once unreachable.
- The exact `files` list and whether `docs/` and `dist/` contents are runtime reads.
- The `.planning` runtime readers: lib/core/pitch-feedback-schemas.cjs:286 writes into a
  `.planning/phases/229-*/schemas` path from a command (a dev path leaking into runtime) - fix or
  relocate; drift-baseline.cjs, skillopt-schemas.cjs, planning/reconcile-runner.cjs are scripts-only dev
  tooling - decide whether they ship at all.
- Shrinkwrap generation step placement in release.sh and the `NODE_ENV`/`omit` handling.

### Folded Todos
- **Registry-drift gate - prevent silent command disappearance keyed to F-shape**
  (.planning/todos/pending/2026-07-03-registry-drift-gate-prevent-silent-command-disappearance-key.md):
  a release-time check that a command present in the previous release's registry did not vanish
  silently. Fits as the second harness policy in D-08 (logged rung first, human-promoted).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Verified findings and loader facts
- `.planning/phases/341-install-and-update-overhaul-npm-source-plugin-artifact-heavy/341-FINDINGS.md` -
  every measured number (tag composition, cache layout, `npm pack` results), the VERBATIM Claude Code
  loader documentation quotes (source types, npm/archive schemas, 256 MiB / 20,000-entry ceiling,
  `npm ci --ignore-scripts` conditions and 60 s timeout, `npm-shrinkwrap.json` requirement), and the
  ratified delivery decision with the sqlite-vec platform evidence.
- `.planning/phases/342-theo-aware-intelligence-layer-register-every-local-engine-as-a-theo-known-handle/342-FINDINGS.md` -
  the must-not-preclude list this phase honors (D-12) and the live Theo facts.
- Official docs (quoted in 341-FINDINGS): https://code.claude.com/docs/en/plugin-marketplaces.md
  ("Plugin Source Types", "Npm packages", "Zip archives", "Copy mode and link mode");
  https://code.claude.com/docs/en/plugins-reference.md ("Node.js package dependencies",
  "Environment variables").

### Release process
- `.claude/includes/release-process.md` - the 5-way version consistency rule (record 5 moves to
  `source.version`), the two-command user upgrade path, "never bump by hand".
- `scripts/release.sh` - Steps 4 (:408-419 marketplace bump), 6.6 (pre-tag doctor acceptance), 6.7
  (:612-672, deleted), 7 / 7.5 (Commit A/B; :1286 untrack block deleted), 8 (:1310-1341 ahead guard),
  9.5 (:708-795 npm publish; :753 payload grep to invert; :765-775 dist-tag promotion), 9.8
  (:1401-1445 full acceptance), recovery ladder R.1-R.4 (:1419-1422).
- `scripts/release-lib/verify-tag-push.sh` - the Phase 310 injectable-hook pattern for release-gate
  testability (reuse for the ceiling runner).
- `docs/autopsies/2026-04-13-wrong-workspace-incident.md` - vendored node_modules rule history,
  marketplace-pinning, beta-gating.

### Doctor, harness, self-heal
- `scripts/doctor.cjs` - :847-890 `version-of-record-published`; :898-930 `npx-roundtrip`; :1387-1390
  `harness-policies` point; :1622-1630 `eureka-smoke-stack-ready` (+ `DOCTOR_SKIP_EUREKA_SMOKE`);
  :1691-1694 `eureka-fts-index-visible`.
- `data/harness-policies/_schema.json`, `scripts/run-harness.cjs` (:284, :825-828 tier filtering),
  `.planning/phases/298-*/` - Phase 298 harness-as-code: closed schema, rung ladder, the ONE runner.
- `lib/core/mcp-dep-heal.cjs`, `scripts/sessionstart-npm-reconcile.cjs`, `lib/core/npm-cli-resolve.cjs`
  (:101 `resolveNpmCli`, :138 `buildInstallArgs`), `hooks/hooks.json` (SessionStart, sync, 120 s).
- `lib/core/cache-prune.cjs` - why side directories under `~/.mindrian` exist.

### Eureka
- `lib/core/eureka/embedding-spine.cjs` (:105 DEFAULT_MODEL, :232-243 `resolveCacheDir`, :278
  `isModelCached`, :282/:361 lazy require, :365/:394 `encoder_unavailable`),
  `lib/core/doctor/class-s-eureka-smoke.cjs` (:87-90 L1, :180 the bug, :243-249 `fixEurekaSmoke`),
  `lib/core/eureka/vector-store.cjs` (cjs-fallback), `commands/eureka.md` (:5 argument-hint),
  `commands/doctor.md` (:95 `--eureka-smoke`), `lib/mcp/tool-router.cjs` (:1358-1379 detached scan;
  :1987-2046 `eureka_critic`), `lib/core/eureka-critic.cjs`.
- `.planning/seeds/SEED-049-mindrian-insight-engine-tri-modal-tri-source-hybrid-retrieval.md` - D14
  ("can any user actually run this stack"): the lazy weights download gap and the unshipped first-run
  notice.

### Update command and version check
- `commands/update.md` (256 lines; :196 banner justification), `scripts/check-version-and-sha.cjs`
  (:33-35, :128, :203 version leg from the catalog pin; :222 the retired GitHub tag-ref call).

### Siblings and history
- `.planning/seeds/SEED-015-selective-install-profile-system.md` (Phase 285, unplanned sibling),
  `.planning/seeds/SEED-014-brain-mcp-separate-repo-deployment-unit-of-moat.md` (the server-side critic
  lift, explicitly NOT this phase), `.planning/phases/123-install-lifecycle-harness/123-04-PLAN.md`
  (<recovery> ladder), `install.sh`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/npm-cli-resolve.cjs` `buildInstallArgs(descriptor, installArgs)`: the cross-platform npm
  invocation (absolute npm-cli.js off process.execPath; no `.cmd`, no PATH dependency); takes arbitrary
  args, so `--prefix`/`--os`/`--cpu` for D-09 need no resolver edit.
- `lib/core/mcp-dep-heal.cjs` `requireWithHeal` + `lib/core/npm-install-lock.cjs`: one-shot self-heal with
  a concurrency lock; stays as the backstop under D-04.
- `data/harness-policies/` + `scripts/run-harness.cjs` + the `harness-policies` doctor point: D-08 needs
  two policy files and two `scripts/check-*.cjs` runners, zero new release.sh wiring.
- `scripts/release-lib/verify-tag-push.sh`: the injectable-hook idiom (0/10/1 return codes, hooks
  overridable by env) for testing release gates without network.
- `lib/core/eureka/embedding-spine.cjs` `resolveCacheDir` + `encoder_unavailable` degrade honored by
  12+ consumers: D-09/D-10 build on it, not beside it.
- `scripts/check-version-and-sha.cjs` version leg reads `plugins[].version` from the catalog, so the
  Check step of D-07 keeps working under an exact pin with no change.
- `tests/test-213-part8-boundary.cjs`: the grep-tripwire idiom for D-12's no-drift test.

### Established Patterns
- CJS only, no TypeScript; bash scripts in `scripts/` are authoritative and CJS wraps them.
- Fail-closed gates with additive rungs (declared / logged / blocking) and human-only promotion.
- Side directories under `~/.mindrian/` survive plugin-version pruning; the versioned cache dir does not.
- Every directory ships a `ROOM.md` identity file (ICM Layer 0) - the `files` whitelist keeps them.
- No em-dashes anywhere (hyphens); Feynman-simplified, JTBD-oriented prose; sourced numbers or none.
- Release-gate tests never make a real git push, npm publish or network call (Phase 310 precedent).

### Integration Points
- `scripts/release.sh` Step 4 (pin), Step 6.6 (pre-tag gate), Step 6.7 (deleted), Step 9.5 (:753 guard
  inverted), Step 9.8 (full gate).
- `package.json` (`files`, `dependencies`, shrinkwrap generation), `.npmignore` if needed for
  `lib/wiki/editor-src`.
- `~/mindrian-marketplace/.claude-plugin/marketplace.json` `plugins[].source` (git url -> npm).
- `commands/update.md`, `commands/eureka.md` (new `enable` subcommand), `commands/doctor.md`.
- `scripts/doctor.cjs` acceptance points (D-06 compare, D-11 class S split, retired classes later).
- `hooks/hooks.json` SessionStart reconcile (unchanged contract, now a backstop by design).

</code_context>

<specifics>
## Specific Ideas

- The navigator's install teardown (Windows 11, 2026-09-09) is the design brief for the UX outcome: "A
  new user's install today is: two commands, a clone measured in tens of minutes, an npm install
  including a machine-learning runtime, more than ten permission prompts, and a restart. The target is
  one command, under a minute, one permission prompt, and a plugin that is live when the command
  returns." Its eight findings: F1 update path cannot complete and destroys its own progress; F2 the live
  install path fourteen versions stale (two locations); F3 the delivery unit is the development
  repository; F4 two install locations, two owners; F5 update is a procedure the user performs, not a
  transaction; F6 the cache is never pruned; F7 twenty-two doctor classes map the fragility; F8 install
  debris in user settings. Its three root causes: A the repo is the release; B two answers to "where does
  the plugin live"; C update has no transaction. Its five-step update transaction (Check, Confirm, Fetch
  to staging, Swap, Verify) collapses under D-07 because the npm tarball + loader own Fetch and Swap.
- Its "not verified" list is closed by this discussion: the loader clone limit is undocumented (git
  sources) and 256 MiB / 20,000 entries is the documented directory/archive ceiling; beta.29 changes none
  of it; node_modules is NOT installed after the clone, it is inside the tag (Step 6.7); only the beta.27
  cache was measured; Desktop/Cowork resolution through the legacy path remains unverified.
- Doctor class S should read like a Larry sentence, not a stack trace: "Eureka is reachable; the local
  model is not installed yet - run /mos:eureka enable (one-time, about 380 MB)."

</specifics>

<deferred>
## Deferred Ideas

- Phase 342: Theo-aware intelligence layer (Eureka, RS, whitespace, the intelligence and analysis
  families as Theo-known handles, triggerable through chain_run). Registered; waits for the Theo session's
  exact canonical framework names.
- Phase 285 (SEED-015): selective install via with/without flags + install profiles - the natural
  follow-on once the artifact is slim.
- SEED-014: lifting the critic server-side into the Brain/Theo repo (rejected for this phase; would make
  Eureka a network dependency).
- A prune command for old plugin cache versions (the platform sweeps orphans ~14 days after uninstall and
  documents no prune command; slimming to ~30 MiB per version makes the 1.8 GB problem moot).
- Theo-side schema drift: Theo's database lacks the `declaration_side` property the command sync queries
  (surfaced by `command_neighborhood`); belongs to the Theo session.

### Reviewed Todos (not folded)
- "F7 rescope: re-plan Phases 212/213 against registerCapability before execution" - keyword match only;
  unrelated to install.
- "Never git stash mid-merge-conflict-resolution, it drops MERGE_HEAD" - a tooling lesson, not scope.
- "Ingest the skill-description trigger-design insight into Brain" - Brain-ingestion, not scope.

</deferred>

---

*Phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy*
*Context gathered: 2026-09-09*
