# Phase 341: Install and update overhaul (npm-source plugin artifact, heavy-dep cut, one install location, transactional update) - Research

**Researched:** 2026-09-09
**Domain:** npm packaging and publication mechanics; the Claude Code plugin loader's install pipeline; release-ceremony gating; on-demand native-dependency delivery
**Confidence:** HIGH on the loader pipeline and on every packaging number (both measured on this machine against the shipped Claude Code binary and npm 10.9.8). MEDIUM on Windows behavior (path budget computed, not executed on Windows). LOW on the loader's `npm install` timeout for the npm source (no explicit timeout is passed; the constant could not be resolved in the minified bundle).

**Read-only compliance note:** No tracked file was modified. One exception is recorded honestly: `slopcheck install` (run for the Package Legitimacy Audit) turned out to perform a REAL `npm install` and rewrote `package.json` + `package-lock.json`. Both were reverted immediately with `git checkout --`; `git status --porcelain` is clean. Side effect that remains: the local `node_modules` now holds `@modelcontextprotocol/sdk@1.30.0` and `semver@7.8.5` instead of the locked 1.29.x / 7.7.x. Both satisfy the caret ranges in `package.json`, so nothing is broken, but the first executor should run `npm ci` before trusting a local dep measurement. **Planner action: use `slopcheck check`, never `slopcheck install`, inside this repo.**

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Delivery artifact (locked at the 2026-09-09 Decision Gate; delivery ratified in discussion)**

- **D-01:** Marketplace `source` becomes `{"source":"npm","package":"@mindrian_os/cli","version":"<exact>"}`. Exact version, never a range or dist-tag: a caret range silently stops resolving once the patch or minor tuple moves (measured on semver 7.8.0: `^2.0.0-beta.30` rejects `2.0.1-beta.1` and `2.1.0-beta.1`); a dist-tag would auto-push every publish to every user because Step 9.5 promotes `@next` to `@latest` (scripts/release.sh:765-775), contradicting "third-party plugins never auto-push".
- **D-02:** The npm tarball IS the plugin. `package.json` `files` = the runtime tree only: `.claude-plugin/`, `.mcp.json`, `hooks/`, `commands/`, `skills/`, `agents/`, `lib/`, `scripts/`, `bin/`, `data/`, `references/`, `templates/`, `assets/`, `dist/`, plus the `ROOM.md` identity files those directories carry. Excluded: `.planning`, `tests`, `evals`, `lab`, `test`, `test-fixtures`, `dashboard` sources, the bundled PDF, and EXPLICITLY `lib/wiki/editor-src` (its nested node_modules is 9,119 entries; npm's node_modules exclusion is root-only; measured: including it pushes the tarball to 16,893 entries / 251.5 MiB, 4.5 MiB under the ceiling). `docs/` ships only if a runtime read needs it (planner verifies).
- **D-03:** `@huggingface/transformers` leaves `dependencies` entirely (not `optionalDependencies`: the loader's `npm ci` installs optional deps by default). Its transitive stack (onnxruntime-node/-web, sharp, @img/*) leaves with it. Delivery of that stack is D-09.
- **D-04:** Dependency delivery = `npm-shrinkwrap.json` at the plugin root + the Claude Code loader's own `npm ci --ignore-scripts` (documented npm-source path; "npm excludes package-lock.json from published packages"). Platform-correct per machine: sqlite-vec's five platform packages resolve locally. Measured 9.3 s cold / 4.3 s warm for the 127-package set against the documented 60-second cutoff; zero lifecycle scripts across 139 packages. `bundleDependencies` REJECTED by measurement (bundles only the publish host's sqlite-vec platform package; npm refuses the rest with EBADPLATFORM; Windows/Mac would silently degrade to the cjs-fallback with no error surface). `devDependencies` stays empty as stated policy (`npm ci` `omit` defaults to empty). The existing backstop (lib/core/mcp-dep-heal.cjs `requireWithHeal` + scripts/sessionstart-npm-reconcile.cjs) stays live for the timeout tail.
- **D-05:** Fallback ONLY if the npm source shows an undocumented gotcha in research: `archive` source (HTTPS zip + documented `sha256` verification, Claude Code v2.1.224+) built by `git archive` + `export-ignore`. Not the primary path.

**Release ceremony and /mos:update (adopted as a set)**

- **D-06:** Git tag `vN` + Commit A / Commit B stay the source-of-record; only Step 6.7 (vendoring, scripts/release.sh:612-672) and its Commit-B untrack block (:1286) are deleted. Step 4 writes marketplace `version` + `source.version` instead of `source.ref`; doctor `version-of-record-published` (scripts/doctor.cjs:847-890) compares `source.version`; the 5-way rule's record 5 becomes the marketplace `source.version` pin. Step 8's expected-2-commits guard, Step 5.5 tag-verify, 9.5 publish, 9.8 acceptance all survive unchanged. Step 9.5's blanket `grep -Eq 'node_modules/'` payload guard (:753) becomes the ceiling assertion of D-08, not a ban.
- **D-07:** `commands/update.md` collapses to Check, Confirm, loader (`claude plugin update`), Verify. Deleted: Step 6 stale-path migrator, Step 7 atomic activator, the `~/.mindrian/post-update-restart-pending` touch-file and its preflight banner. The restart banner stays ONLY on a real swap (the slash-command registry is built once at session start, update.md:196) and drops on `UP_TO_DATE`. The SHA leg (`SHA_DIFFERS_INVERSION_HOTFIX`, the api.github.com tag-ref call at scripts/check-version-and-sha.cjs:222) is retired: published npm versions are immutable, so an in-version hotfix is a new version.
- **D-08:** Two harness policies in `data/harness-policies/` riding the existing `harness-policies` doctor point (scripts/doctor.cjs:1387-1390, blocker, applies_to pre-tag + full), so they run at Step 6.6 (pre-tag, failure = rollback) and Step 9.8 (full): (a) `release-payload-ceiling`, rung `blocking`, asserts `entryCount <= 20000` and `unpackedSize <= 268435456` from `npm pack --dry-run --json` (local, offline; NOT packed size); (b) the folded registry-drift gate, rung `logged` for one release, then human-promoted per `_schema.json`'s promotion rule. Both authored AFTER the `files`/dependency cut (on HEAD today `npm pack --dry-run` measures the 6-entry shim: 250,327 / 674,143 / 6).

**Eureka first-class (navigator: "this might be the moat"; the slim install defers the download, never the capability)**

- **D-09:** `/mos:eureka enable`, mirrored as `doctor --fix eureka`, installs the embedding stack into `~/.mindrian/eureka-deps/`, platform-scoped (`--os`/`--cpu` so a Mac never downloads DirectML.dll), through the existing cross-platform npm invocation (lib/core/npm-cli-resolve.cjs `buildInstallArgs`), resolved by a net-new `createRequire` shim; shared across plugin versions for the same reason the model cache already lives at `~/.mindrian/model-cache` (cache-prune.cjs deletes the version dir on update). REJECTED: SessionStart prefetch (60 s loader / 120 s hook budgets make 380 MB a guaranteed timeout); a consent prompt inside `eureka-run` (the scan path is detached/un-awaited, tool-router.cjs:1358-1379, so consent cannot render there; it would reproduce the D14 silent hang).
- **D-10:** Capability is never conditional on the model at the registry level. Every engine stays reachable on a slim install; an engine that needs the model renders an honest "model not installed, run /mos:eureka enable" state, never a silent no-op (12+ consumers already honor `encoder_unavailable`; report-html.cjs:78 renders `degrade_cause`). SEED-049 D14's unshipped one-time Larry-voiced first-run notice for the lazy weights download (`MongoDB/mdbr-leaf-ir`) ships here.
- **D-11:** Doctor class S (lib/core/doctor/class-s-eureka-smoke.cjs): split L1 into "capability reachable" (blocker) and "model installed" (advisory carrying the exact enable command) by ADDING a layer id (the harness pins layer ids and order); fix the live bug at :180 (async `isModelCached` called without `await` and without `dtype`, so the cache-miss branch at :183-190 is unreachable and L3 always embeds for real); add a slim-install arm asserting the honest not-installed state. `DOCTOR_SKIP_EUREKA_SMOKE=1` is never used on the shipped artifact.
- **D-12:** Pin the true topology with one no-drift test (the tests/test-213-part8-boundary.cjs grep-tripwire idiom): Eureka, critic included, has no Brain/Theo reach (`eureka_critic` is on the LOCAL server, lib/mcp/tool-router.cjs:1987, in-process `criticRule`). Theo awareness and trigger are Phase 342's scope; this phase must NOT preclude them: keep `data/` shipping (command-registry.json, framework-names.json, connector-registry.json, brain-orchestration-projection.json, harness-manifest.json are runtime reads); the `enable` subcommand must not change `command: "/mos:eureka"` identity; keep `data/framework-names.json` and `--refresh-names` intact.

**Proof before anything else**

- **D-13:** Migration order is load-bearing: (1) dependency + `files` cut, shrinkwrap, exact-pin npm source, the two harness policies; cut the next beta; (2) prove a COLD install on Windows, Mac and Linux completes and the two bundled MCP servers load - until that passes nothing else ships; (3) retire the second install location; (4) collapse `/mos:update`; (5) retire the doctor classes whose failure mode is now unreachable (the proof the overhaul worked).

### Claude's Discretion

- One-install-location mechanics (not selected for discussion; the navigator's teardown direction is the guide): the marketplace cache + `CLAUDE_PLUGIN_ROOT` is the only guaranteed location; `install.sh` (367 lines) is retired as a primary path - research decides whether any host without the marketplace loader still needs it; a `doctor --fix` that verifies nothing in settings resolves through `~/.claude/plugins/mindrian-os`, backs it up, removes it (F2 reproduced on Windows, absent on Linux); doctor classes A/H and the two-topology halves of I/J retired once unreachable.
- The exact `files` list and whether `docs/` and `dist/` contents are runtime reads.
- The `.planning` runtime readers: lib/core/pitch-feedback-schemas.cjs:286 writes into a `.planning/phases/229-*/schemas` path from a command (a dev path leaking into runtime) - fix or relocate; drift-baseline.cjs, skillopt-schemas.cjs, planning/reconcile-runner.cjs are scripts-only dev tooling - decide whether they ship at all.
- Shrinkwrap generation step placement in release.sh and the `NODE_ENV`/`omit` handling.

### Deferred Ideas (OUT OF SCOPE)

- Phase 342: Theo-aware intelligence layer (Eureka, RS, whitespace, the intelligence and analysis families as Theo-known handles, triggerable through chain_run). Registered; waits for the Theo session's exact canonical framework names.
- Phase 285 (SEED-015): selective install via with/without flags + install profiles - the natural follow-on once the artifact is slim.
- SEED-014: lifting the critic server-side into the Brain/Theo repo (rejected for this phase; would make Eureka a network dependency).
- A prune command for old plugin cache versions (the platform sweeps orphans ~14 days after uninstall and documents no prune command; slimming to ~30 MiB per version makes the 1.8 GB problem moot).
- Theo-side schema drift: Theo's database lacks the `declaration_side` property the command sync queries (surfaced by `command_neighborhood`); belongs to the Theo session.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

No requirement IDs are registered in `.planning/REQUIREMENTS.md` for Phase 341 (it sits outside the v2.1.0 "Green the Floor" requirement set). **The CONTEXT.md decisions D-01 through D-13 ARE the requirements.** Research support per decision:

| ID | Decision (abbreviated) | Research Support |
|----|------------------------|------------------|
| D-01 | npm source, exact version pin | **Strengthened.** The loader's npm cache-hit test is a literal string equality `r.version === installedVersion` (binary 2.1.266, function `Tus`). An exact pin is the ONLY form that ever produces a cache hit; a range or dist-tag re-runs `npm install` on every session-start cache miss. See "Loader Ground Truth" F-2. |
| D-02 | `files` = runtime tree | **Resolved with measurements.** Recommended list, longest-path budget, and the exact exclusion mechanism that actually works are in "The `files` Whitelist, Measured". Root `.npmignore` is INERT when `files` is present (measured) - the CONTEXT integration note that mentions it needs correcting. |
| D-03 | transformers out of `dependencies` | Confirmed: 392.6 MB of the 441 MB local `node_modules` is the transformers stack; 51 MB remains. 33 of the 198 lock entries leave with it. |
| D-04 | shrinkwrap + loader `npm ci --ignore-scripts` | **Confirmed as the only working design, and one silent-failure trap found:** `npm-shrinkwrap.json` is NOT auto-included in a tarball that has a `files` allowlist. It must be listed explicitly. See Pitfall 1. |
| D-05 | archive fallback | Not needed. No undocumented gotcha found that breaks the npm path. The archive path's own 256 MiB `maxContentLength` cap IS machine-enforced (unlike the npm path). Keep as documented fallback only. |
| D-06 | release.sh surgery | **Two concrete blockers found:** Step 9.5's existing payload grep bans `release.sh` and `docs/`, and `tests/run-all-310.sh` legs 3 + 4 hard-pin release.sh's 28 step blocks and its `exit 1` count at >= 49. See "Release Ceremony: What Actually Breaks". |
| D-07 | collapse `/mos:update` | Supported. The loader owns Fetch and Swap end to end (`Tus` + `E$` copy + `xje` dependency install), so Steps 6-7 have no remaining job. |
| D-08 | two harness policies | Schema, rung ladder, runner path rule and the closest analog runner documented in "Harness Policy Shape". The `entryCount`/`unpackedSize` fields exist verbatim in `npm pack --dry-run --json` output on npm 10.9.8 (measured). |
| D-09 | `/mos:eureka enable` into a side dir | `--os`, `--cpu`, `--libc` are all real flags of the locally installed npm 10.9.8 `install` verb (verified via `npm install --help`). `buildInstallArgs` takes an arbitrary tail, so no resolver edit is needed. **No `createRequire` exists anywhere in `lib/`, `scripts/`, `bin/`** - the shim is genuinely net-new. |
| D-10 | capability never conditional on the model | Supported by the existing `encoder_unavailable` degrade in `embedding-spine.cjs`. |
| D-11 | class S split + the :180 bug | **Bug confirmed by reading both sides.** `isModelCached` is `async` (embedding-spine.cjs) and class-s-eureka-smoke.cjs:180 calls it with no `await` and no `dtype`. A second, larger problem found: L1 probes `<pluginRoot>/node_modules/@huggingface/transformers/package.json`, which will NEVER exist under D-09. L1 needs a two-location probe, not just a split. |
| D-12 | no-drift topology test | Unchanged by this research; the recommended `files` list keeps `data/` whole. |
| D-13 | migration order | Supported. Wave structure proposed in "Validation Architecture". |

</phase_requirements>

---

## Summary

The phase's premise survives contact with the evidence, and the evidence makes it stronger. I read the actual plugin-loader code out of the shipped Claude Code binary (`~/.local/share/claude/versions/2.1.266`, an unstripped bun-compiled ELF whose JavaScript is recoverable byte-for-byte), so the loader facts below are not inferred from documentation prose. They are the code.

Three findings change how the plan must be written. First, **the npm source path installs twice and copies once**: the loader runs a real `npm install <pkg>@<version> --prefix ~/.claude/plugins/npm-cache`, then copies ONLY `npm-cache/node_modules/<pkg>` into the plugin cache directory. Every dependency npm hoisted during that install is left behind and never copied. The plugin therefore arrives with an empty `node_modules` and is made whole only by the SECOND install, `npm ci --ignore-scripts`, which runs in the destination directory and only if a supported lockfile is present. `npm-shrinkwrap.json` is not optional wiring, it is the entire dependency delivery mechanism, and I measured that **npm does not auto-include `npm-shrinkwrap.json` in a tarball that declares a `files` allowlist**. One forgotten line in `files` produces a plugin that installs "successfully", logs nothing, and cannot load either MCP server. That is the single highest-risk line in the phase.

Second, **the 256 MiB / 20,000-entry ceiling is not enforced on the npm path at all**. In 2.1.266 the check lives in one function whose error strings read "plugin command source directory has too many files", reachable only from the `command` source type. The npm path has no size check; the `archive` path has a different one (a 256 MiB HTTP `maxContentLength`). This does not weaken D-08, it justifies it: the harness policy is the only enforcement that will ever exist for this artifact, so it has to be real.

Third, **the recommended `files` whitelist measures 1,836 entries / 27.67 MiB unpacked / 8.50 MiB packed**, which is 9.2 percent of the entry ceiling and 10.8 percent of the byte ceiling. Getting there needs a mechanism CONTEXT.md does not name: a root `.npmignore` is completely inert when `files` is present (measured: identical 11,451-entry output with and without it). The working mechanism is negation entries inside `files` itself, and negation is also how `scripts/release.sh` gets excluded, which it must be, because release.sh's own Step 9.5 payload gate greps for the literal string `release.sh` and will refuse to publish a tarball that contains it.

**Primary recommendation:** Ship `files` with explicit negations (`!lib/wiki/editor-src`, `!scripts/release.sh`, `!scripts/release-lib`), list `npm-shrinkwrap.json` explicitly, drop `docs/` and `dist/` (neither has a runtime reader; Step 9.5 already bans `docs/`), and make the very first plan a RED test that fails when `npm pack --dry-run --json` does not contain `npm-shrinkwrap.json`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Producing the delivery artifact | Release ceremony (`scripts/release.sh` + `package.json`) | npm registry | The tarball's contents are decided at pack time by `files`; nothing downstream can add or remove a file. |
| Fetching and staging the artifact | Claude Code loader (`Tus` -> `npm install --prefix`) | npm registry | D-07's "Fetch" step has no plugin-side owner any more. The loader owns it. |
| Swapping the artifact into place | Claude Code loader (`E$` directory copy into the versioned cache dir) | - | D-07's "Swap" step likewise. The plugin cannot and must not do this. |
| Materializing runtime dependencies | Claude Code loader (`npm ci --ignore-scripts`, 60 s cap) | `mcp-dep-heal.cjs` + `sessionstart-npm-reconcile.cjs` | Primary is the loader; the existing self-heal is the timeout tail, by design, not dead code. |
| Enforcing payload size | Harness policy (`data/harness-policies/`, blocking rung) | Nothing | Measured: the platform does NOT enforce a ceiling on the npm path. This tier is the only enforcement. |
| Verifying the install landed | `scripts/doctor.cjs` acceptance points + Class S | `/mos:update` Verify step | Verify is the only one of the teardown's five update steps the plugin still owns. |
| Delivering the embedding stack | `/mos:eureka enable` -> `~/.mindrian/eureka-deps/` | `doctor --fix eureka` | Side directory under `~/.mindrian` because the versioned plugin cache dir is deleted on update (`cache-prune.cjs`). |
| Resolving the side-directory packages | Net-new `createRequire` shim in `lib/core/` | `embedding-spine.cjs` lazy require | The lazy-require boundary already exists; only the resolution root changes. |
| Model weights cache | `~/.mindrian/model-cache` (already shipped, `resolveCacheDir`) | - | Distinct from `eureka-deps`. Two side directories, two lifetimes, do not conflate them. |

---

## Loader Ground Truth (Claude Code 2.1.266, read from the shipped binary)

Method: `/home/jsagi/.local/share/claude/versions/2.1.266` is an unstripped bun-compiled ELF (215,670,184 bytes) that embeds its own JavaScript. I extracted bytes 180,000,000 to 216,000,000 and read the plugin-loader functions directly. Every claim below quotes recovered code. `[VERIFIED: Claude Code 2.1.266 binary]`

### F-1. The source dispatcher

```js
switch (e.source) {
  case "npm":       await v(), await Tus(e.package, y, {registry: e.registry, version: e.version}); break;
  case "github":    await v(), await Cus(e.repo, y, e.ref, e.sha); break;
  case "url":       await v(), await aur(e.url, y, e.ref, e.sha); break;
  case "git-subdir": D = await Aus(e.url, y, e.path, e.ref, e.sha, E); break;
  case "archive":   L = await Ous(e, y, E, ...); break;
  case "claudeai":  L = await htn(e, y, E, ...); break;
  case "command":   { ... } break;
  case "unsupported": ... throw ... "plugin source type unsupported"
}
```

Our marketplace entry today uses `{"source":"url","url":"https://github.com/jsagir/mindrian-os-plugin.git","ref":"v2.0.0-beta.29"}`, which routes to `aur` -> `vus` -> `git clone --depth 1 --recurse-submodules --shallow-submodules --branch <ref>`. That is the clone that dies. `[VERIFIED: ~/mindrian-marketplace/.claude-plugin/marketplace.json + binary]`

### F-2. What the npm source actually does (the decisive finding)

```js
async function Tus(e, n, r = {}) {                       // e=package, n=destination, r={registry,version}
  let o = Sd(Tl(), "npm-cache");                          // ~/.claude/plugins/npm-cache
  await mkdir(o);
  let d = `${e}@${r.version ?? "latest"}`;
  let p = Sd(o, "node_modules", e);                       // ~/.claude/plugins/npm-cache/node_modules/@mindrian_os/cli
  let y;
  try { y = JSON.parse(await read(p + "/package.json")).version } catch {}
  if (!(r.version && r.version === y)) {
    log(`Installing npm package ${d} to cache`);
    let v = ["install", d, "--prefix", o, "--no-fund", "--no-audit", "--no-progress", "--loglevel=error"];
    if (r.registry) v.push("--registry", r.registry);
    let I = await Ue("npm", v, {useCwd: false, toolCgroupClass: "plugin"});
    if (I.code !== 0) throw ... "plugin npm install failed (stderr redacted)"
  } else log(`npm cache hit for ${e}@${y} (pinned, matches requested)`);
  await E$(p, n);                                         // copy ONLY the package dir into the plugin cache
  log(`Copied npm package ${e} from cache to ${n}`);
}
```

Five consequences the plan must be built on:

1. **Hoisted dependencies are discarded.** npm hoists our deps to `npm-cache/node_modules/*`; only `npm-cache/node_modules/@mindrian_os/cli` is copied. The plugin arrives with no `node_modules`. Dependency delivery is entirely on the second install (F-3).
2. **The cache-hit test is exact string equality** on `r.version`. `"version": "2.0.0-beta.31"` hits the cache on every subsequent session-start. A range like `^2.0.0` or a dist-tag like `next` can never equal the installed version string, so npm reinstalls every time. This is an independent, mechanical argument for D-01 beyond the two CONTEXT.md gave.
3. **The tarball's `package/` prefix is irrelevant.** `npm install` strips it. What lands at the plugin root is exactly the package root, so `.claude-plugin/plugin.json` must be at the package root and must therefore appear in `files`. (Answers CONTEXT open item (a) definitively.)
4. **This first install runs WITHOUT `--ignore-scripts`.** Lifecycle scripts of our package and of its dependencies run at this step. Our 139-package set has none (measured in 341-FINDINGS), but that is now a property the payload harness policy should assert, not a fact to assume.
5. **The npm cache is shared across all npm-source plugins** at `~/.claude/plugins/npm-cache` under one synthetic prefix, so two npm-source plugins share one dependency resolution. Not our problem today (there are no other npm-source plugins on this box) but worth a line in the release notes.

Answering CONTEXT open item (a): `.claude-plugin/plugin.json` at the tarball root is required in practice, and the loader also accepts a root-level `plugin.json` as a fallback:

```js
var fe = ".claude-plugin", C9 = join(fe, "plugin.json"), m3t = "plugin.json";
// in BYe:  U = await HK(y, o, be, [Sd(y, m3t)])
// in HK:   let v = [Sd(e, C9), ...o];   // .claude-plugin/plugin.json first, then plugin.json
// if neither: manifest = {name: <temp dir label>, description: `Plugin from ${source}`}
```

A missing manifest does not hard-fail; it silently synthesizes a manifest whose `name` is the internal staging label. That is a worse failure than a crash because the plugin loads under the wrong name. `.claude-plugin/` in `files` is mandatory. `[VERIFIED: binary]`

### F-3. The dependency install (the 60 s step)

```js
var Hcs = 60000, Vwt = [
  {lockfile: "bun.lock",            command: "bun", args: ["install","--frozen-lockfile","--ignore-scripts"]},
  {lockfile: "bun.lockb",           command: "bun", args: ["install","--frozen-lockfile","--ignore-scripts"]},
  {lockfile: "npm-shrinkwrap.json", command: "npm", args: ["ci","--ignore-scripts"], completionRecord: "node_modules/.package-lock.json"},
  {lockfile: "package-lock.json",   command: "npm", args: ["ci","--ignore-scripts"], completionRecord: "node_modules/.package-lock.json"}
];
async function xje(e) {
  let n = await readdir(e);           // e = the installed plugin directory
  let r = new Set(n);
  if (!r.has("package.json")) return {ran: false};
  for (let o of Vwt) {
    if (!r.has(o.lockfile)) continue;
    log(`Installing plugin dependencies: ${o.command} ${o.args.join(" ")} in ${e}`);
    let d = await He(o.command, o.args, {cwd: e, timeout: Hcs, toolCgroupClass: "plugin"});
    if (d.code !== 0) return {ran: true, error: `Plugin dependency install failed (${o.command}): ...`};
    return {ran: true, ...};
  }
}
```

Observations:
- **First matching lockfile wins, in that order.** If both `npm-shrinkwrap.json` and `package-lock.json` were somehow present, shrinkwrap wins. In practice npm never publishes `package-lock.json` (measured, F-6), so this is moot but reassuring.
- **`package.json` must be at the plugin root** (`readdir` of the plugin dir). It always is under the npm source.
- **60,000 ms, hard.** The documented "60-second timeout" is this literal.
- **No `--omit` flag is passed.** Confirmed against `npm config ls -l` on this box: `omit = []`. So a `devDependencies` block in the shrinkwrap WOULD be installed by the loader. D-04's "devDependencies stays empty" is load-bearing and deserves a gate, not a comment. `[VERIFIED: binary + npm 10.9.8 config]`
- `completionRecord: "node_modules/.package-lock.json"` is how the loader detects an install that already completed, so a session-start re-check is cheap.

### F-4. The 256 MiB / 20,000-entry ceiling is command-source only

```js
var ft = 60, Re = 65536, mt = 65536, ve = 500, Te = 268435456, Ce = 20000;
async function Me(e, n, r) {
  ... if (c > Ce) throw new A(`Plugin directory has more than ${Ce} entries; refusing to install it as a plugin.`,
                              "plugin command source directory has too many files");
      ... if (s > Te) throw new A(`Plugin directory is larger than ${Te/1048576} MB; refusing to install it as a plugin.`,
                              "plugin command source directory too large");
}
```

`Me` is called from exactly two places: `tor` (the `command` source install) and `wt` (the content-hash used by the command source). **Nothing on the npm, github, url, git-subdir or archive path calls it.** The documented ceiling lives in a `command`-source subsection of the docs for exactly this reason, and 341-FINDINGS already flagged that placement. `[VERIFIED: binary]`

Planning consequence: D-08's `release-payload-ceiling` policy is the ONLY enforcement of the 256 MiB / 20,000-entry design target for this artifact. Treat those two numbers as our own policy limits with a documented provenance, not as a platform guardrail we are staying under.

The `archive` path does have a real cap, a different one:

```js
var yQ = 268435456, PTt = 5242880, $t = 120000, yEn = "Claude-Code-Plugin-Manager";
... axios.get(e, {timeout: $t, responseType: "arraybuffer", maxRedirects: 5, maxContentLength: yQ, ...})
... if (n.sha256 && n.sha256.toLowerCase() !== h) throw ... "plugin archive sha256 mismatch"
```

256 MiB of COMPRESSED download, 120 s HTTP timeout, 5 redirects, sha256 verified. Useful if D-05 is ever exercised. `[VERIFIED: binary]`

### F-5. Windows path budget

Longest relative path in the recommended tarball: **101 characters**
(`lib/import/test-fixtures/collision-vault/preexisting-room/problem-definition/onboarding/onboarding.md`). `[VERIFIED: npm pack --dry-run --json]`

Longest relative path in the post-cut `node_modules`: **109 characters**
(`node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/sseAndStreamableHttpCompatibleServer.d.ts.map`). Every longer path in the current tree (131 to 139 chars) belongs to `@huggingface/transformers`, which leaves. `[VERIFIED: find + awk on this tree]`

Windows prefix, computed for an 8-character username:

```
C:\Users\jonathan\.claude\plugins\cache\mindrian-marketplace\mos\2.0.0-beta.31\   = 79 chars
C:\Users\jonathan\.claude\plugins\npm-cache\node_modules\                         = 56 chars
C:\Users\jonathan\.mindrian\eureka-deps\node_modules\                             = 52 chars
```

| Location | Prefix | Longest child | Total | MAX_PATH headroom |
|----------|--------|---------------|-------|-------------------|
| Plugin cache, shipped file | 79 | 101 | **180** | 80 |
| Plugin cache, after `npm ci` | 79 | 109 | **188** | 72 |
| Loader npm-cache | 56 | 109 | **165** | 95 |
| `~/.mindrian/eureka-deps` | 52 | 139 (transformers) | **191** | 69 |

All four clear the 260-character `MAX_PATH` limit with 69 characters or more of headroom. A 20-character username still clears. `[ASSUMED]` for the exact Windows username length; `[VERIFIED]` for both path lengths. Compare against the CURRENT failure mode, where `.planning/phases/92-refactor-constitution-and-trust-layer-formalizes-audit-driven-refactor-work-constitution-v1-1-.../` alone exceeded MAX_PATH and forced `core.longpaths` on testers (`docs/testers/gary-laben/FEEDBACK.md:55`). Dropping `.planning` from the artifact removes that class of failure outright. Answers CONTEXT open item (c) as far as it can be answered without a Windows box: **the budget is comfortable; the remaining unknown is whether the loader's own extraction does anything Windows-specific, and it does not - it is `npm install` plus a directory copy.**

### F-6. npm packaging behavior, measured on npm 10.9.8

Minimal probe package, three variants, same tree:

| `files` field | Result |
|---------------|--------|
| `["sub"]` (shrinkwrap + lock present on disk) | `["package.json","sub/a.txt"]` - **shrinkwrap dropped** |
| `["sub","npm-shrinkwrap.json"]` | `["npm-shrinkwrap.json","package.json","sub/a.txt"]` - included |
| field absent entirely | `["extra.txt","npm-shrinkwrap.json","package.json","sub/a.txt"]` - auto-included |
| `["sub","package-lock.json"]` | `["package.json","sub/a.txt"]` - **lock never published, even when explicitly listed** |

`[VERIFIED: local npm pack --dry-run --json, npm 10.9.8]`

This confirms the documentation quote ("npm excludes package-lock.json from published packages") and adds the trap it does not mention: with a `files` allowlist, `npm-shrinkwrap.json` is treated as an ordinary file and is dropped unless named. A plugin published that way has `package.json` and no lockfile, which the loader's own documentation describes as "skipped without a log entry". Silent, total dependency failure.

---

## The `files` Whitelist, Measured

All numbers from `npm pack --dry-run --json` run against a hard-linked copy of the real tree in a scratch directory. No tracked file was touched. `[VERIFIED: measured 2026-09-09, npm 10.9.8, node v22.23.1]`

### Baselines

| Configuration | Entries | Unpacked | Packed |
|---------------|---------|----------|--------|
| HEAD today (the 6-file CLI shim) | 6 | 674,143 | 250,327 |
| D-02 list, `lib` wholesale, `docs/` in | **11,451** | 244,391,001 | 62,405,255 |
| D-02 list + `!lib/wiki/editor-src`, `docs/` in | 2,333 | 36,481,478 | 11,399,522 |
| **RECOMMENDED (below)** | **1,836** | **29,015,424 (27.67 MiB)** | **8,912,616 (8.50 MiB)** |
| Platform design target | 20,000 | 268,435,456 | - |
| Recommended as percent of target | **9.2 %** | **10.8 %** | - |

`lib/wiki/editor-src` alone contributes 9,119 entries and about 208 MiB. It is a build source tree; `lib/wiki/editor-dist` (2 entries) is the runtime artifact.

### The exclusion mechanism (this is the part CONTEXT.md gets wrong)

Three mechanisms tested against the same tree:

| Mechanism | Entries | Verdict |
|-----------|---------|---------|
| A. `"!lib/wiki/editor-src"` inside `files` | **2,332** | **WORKS** |
| B. Root `.npmignore` containing `lib/wiki/editor-src` | 11,451 | **INERT.** `files` wins; the root `.npmignore` is ignored entirely. |
| C. `.npmignore` containing `*` inside `lib/wiki/editor-src/` | 2,332 | Works, but adds a hidden file far from the decision. |

`[VERIFIED: measured]`

CONTEXT.md's Integration Points line says "`.npmignore` if needed for `lib/wiki/editor-src`". That mechanism does not work in the presence of `files`. **Use negation entries inside `files` (mechanism A).** One edit surface, visible in a `package.json` diff, and it composes with the other exclusions the phase needs.

### Recommended `files` value

```json
"files": [
  ".claude-plugin",
  ".mcp.json",
  "settings.json",
  "npm-shrinkwrap.json",
  "hooks",
  "commands",
  "skills",
  "agents",
  "pipelines",
  "output-styles",
  "lib",
  "!lib/wiki/editor-src",
  "scripts",
  "!scripts/release.sh",
  "!scripts/release-lib",
  "bin",
  "data",
  "references",
  "templates",
  "assets",
  "README.md",
  "LICENSE",
  "CHANGELOG.md"
]
```

Per-directory composition of that measurement:

| Path | Entries | Notes |
|------|---------|-------|
| `lib` (minus editor-src) | 919 | Includes 231 co-located `*.test.cjs` and fixture files |
| `scripts` (minus release.sh, release-lib) | 332 | Includes `.cypher` files and a `__pycache__` |
| `skills` | 139 | |
| `data` | 114 | Runtime authority per 342-FINDINGS; ships whole |
| `commands` | 113 | |
| `references` | 110 | Real runtime reads, see below |
| `templates` | 55 | Real runtime reads |
| `pipelines` | 19 | Plugin component class |
| `agents` | 14 | |
| `bin` | 6 | Both MCP server entry points |
| root files | 6 | `package.json`, `.mcp.json`, `settings.json`, README, LICENSE, CHANGELOG |
| `assets` | 5 | `assets/logo.svg` is a real runtime read |
| `hooks` | 2 | |
| `.claude-plugin` | 1 | The manifest |
| `output-styles` | 1 | Plugin component class |

### Deltas from D-02's list, each with evidence

| Change | Evidence |
|--------|----------|
| **ADD `npm-shrinkwrap.json`** | F-6: not auto-included when `files` exists. Without it, the loader installs zero dependencies and logs nothing. |
| **ADD `pipelines/`, `output-styles/`, `settings.json`** | The loader's component-directory vocabulary is `["commands","skills","agents","hooks","themes","output-styles","monitors","workflows"]` plus `[".claude-plugin","SKILL.md",".mcp.json",".lsp.json"]`. `output-styles` is a first-class component class and was missing from D-02's list. `pipelines/` is a MindrianOS surface class named in CLAUDE.md Canon Part 7. `settings.json` is named as part of the plugin format in CLAUDE.md's Constraints. |
| **DROP `docs/`** | Zero runtime readers. The only code paths that open a `docs/` file are `*.test.cjs` (`lib/memory/mcp-server-brain-deps.test.cjs:68`, `lib/memory/brain-server-resolution.test.cjs:82`, `lib/core/mva-rule-linter.test.cjs:373,464`). Two independent existing policies already say docs must not ship: `scripts/release.sh:750` greps for `docs/` and refuses to publish, and `lib/core/update-path.cjs:34` states in a comment that "release.sh Step 9.5's payload gate refuses a tarball containing docs/ or .planning/, so a runtime read of a doc path is a distribution hazard". Saves 221 entries / 4.26 MiB. Answers CONTEXT open item (d) for `docs/`: **no.** |
| **DROP `dist/`** | `dist/generic-claude-dir/` is a build OUTPUT for other agent hosts (VS Code, Cursor, Goose, OpenCode, Copilot, Codex, Gemini CLI, Roo Code, Amp), produced by `scripts/build-dist-bundles.cjs`. Grep across `commands/`, `skills/`, `agents/`, `docs/` and `README.md` for `dist/generic-claude-dir` or `${CLAUDE_PLUGIN_ROOT}/dist` returns zero hits. Nothing in `lib/`, `bin/` or `hooks/` reads it plugin-root-relative. Saves 274 entries / 2.78 MiB. Answers CONTEXT open item (d) for `dist/`: **no.** |
| **NEGATE `scripts/release.sh` and `scripts/release-lib/`** | Not merely tidy: `scripts/release.sh:750` runs `grep -Eq '\.planning/\|^npm notice .*docs/\|mcp-server-brain/\|^npm notice .*tests/\|release\.sh'` on its own `npm pack --dry-run` output and `exit 1`s on a match. The pattern `release\.sh` is unanchored. A tarball containing `scripts/release.sh` **cannot be published by the current release script.** |
| **KEEP `references/`, `templates/`, `assets/`** | All three have real plugin-root-relative runtime reads: `lib/core/lazygraph-ops.cjs:1226` reads `references/methodology/triz-matrix.json`; `lib/mcp/larry-context.cjs:21` reads `references/personality/`; `lib/core/room-skeleton-scaffold.cjs:42` reads `templates/references`; `lib/wiki/wiki-layout.cjs:23` reads `assets/logo.svg`. |
| **KEEP `data/` whole** | 342-FINDINGS' must-not-preclude list, plus Class J's `data/deployment-surfaces.json` and the harness's `data/harness-policies/` + `data/harness-manifest.json`. |

### Optional further reduction (planner's call, not required)

Adding `"!lib/import/test-fixtures"` drops the longest shipped relative path from 101 to about 70 characters and removes fixture-only bytes. It buys 31 characters of Windows headroom for zero risk. Recommended but not blocking. 231 co-located `*.test.cjs` files still ship; excluding them individually is fiddly and they are the CJS convention in this repo, so leave them.

---

## Standard Stack

This phase adds **zero new runtime dependencies**. It removes one and moves that one to an on-demand side directory. The "stack" is npm CLI behavior and existing repo machinery.

### Core (npm CLI features this phase depends on)

| Feature | Verified on | Purpose | Why standard |
|---------|-------------|---------|--------------|
| `package.json` `files` with `!` negation | npm 10.9.8 | The whole payload cut | The only mechanism that works when `files` is present (measured; `.npmignore` is inert) |
| `npm-shrinkwrap.json` | npm 10.9.8 | Dependency delivery to the loader | The only lockfile npm publishes; the loader's documented npm-source path |
| `npm pack --dry-run --json` | npm 10.9.8 | Ceiling policy input | Emits `entryCount`, `unpackedSize`, `size` verbatim, offline, no registry call |
| `npm ci --ignore-scripts` | run by the loader | Materializes deps in the plugin dir | Not our call to make; it is the loader's fixed argv |
| `npm install --os --cpu --libc` | npm 10.9.8 (`npm install --help`) | Platform-scoped eureka-deps install | Forces optional-dependency platform selection without downloading every platform's binaries |
| `npm shrinkwrap` | npm 10.9.8 | Generates the shrinkwrap from the lock | One command, no arguments; "Lock down dependency versions for publication" |

### Supporting (existing repo assets, reuse before build per Canon Part 7)

| Asset | Purpose | Reuse in this phase |
|-------|---------|---------------------|
| `lib/core/npm-cli-resolve.cjs` `resolveNpmCli` / `buildInstallArgs` | Cross-platform npm invocation off `process.execPath` | D-09's install. `buildInstallArgs(descriptor, tail)` accepts an arbitrary tail, so `--prefix`/`--os`/`--cpu` need no resolver edit. Confirmed by reading the function. |
| `lib/core/mcp-dep-heal.cjs` `requireWithHeal` + `lib/core/npm-install-lock.cjs` | One-shot self-heal with a concurrency lock | Stays live as the 60 s timeout tail under D-04 |
| `scripts/release-lib/verify-tag-push.sh` | Injectable-hook idiom for release-gate tests | The pattern for the ceiling runner's testability |
| `data/harness-policies/` + `scripts/run-harness.cjs` + doctor's `harness-policies` point | Fail-closed policy ladder | D-08's two policies; zero new release.sh wiring |
| `lib/core/eureka/embedding-spine.cjs` `resolveCacheDir` / `encoder_unavailable` | Graceful degrade honored by 12+ consumers | D-09/D-10 build on it |
| `tests/test-213-part8-boundary.cjs` | Grep-tripwire idiom | D-12's no-drift test |
| `MOS_TEST_DRY_RUN=1` (release.sh:761) and `RELEASE_TEST_MODE` (tests/test-release-bump-tag-and-publish-gates.cjs) | No-network release-gate testing | The established pattern for D-06's test lock |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `files` negation | Nested `.npmignore` in `lib/wiki/editor-src/` | Works (measured, 2,332 entries) but hides the decision far from `package.json`; a future reader of `files` cannot see why `lib` is smaller than it looks |
| `npm-shrinkwrap.json` | `bundleDependencies` | Already REJECTED by measurement in 341-FINDINGS (packs only the publish host's sqlite-vec platform package). Reading `Tus` adds a second reason: bundled deps WOULD survive the `E$` copy (they live inside the package dir), so `bundleDependencies` is the only mechanism that would work WITHOUT a lockfile - which is exactly why it is tempting and exactly why its platform defect is dangerous. Do not revisit. |
| npm source | `archive` source (D-05) | Real fallback, real sha256 verification, real 256 MiB enforced cap, no git and no npm needed on the user's machine. But it needs a hosting surface and a build step that does not exist. Keep documented, do not build. |

**Installation:** none. This phase adds no package to `dependencies`.

---

## Package Legitimacy Audit

This phase **installs no new packages**. It removes `@huggingface/transformers` from `dependencies` and re-delivers the same, already-vetted package on demand into `~/.mindrian/eureka-deps/`. The audit below covers the packages the phase touches by name.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@huggingface/transformers` | npm | established | high | github.com/huggingface/transformers.js | `[OK]` | Moved out of `dependencies`, installed on demand (D-03/D-09) |
| `sqlite-vec` | npm | established | moderate | github.com/asg017/sqlite-vec | `[OK]` | Stays; its five platform packages carry `os`/`cpu` in the lock (verified below) |
| `@modelcontextprotocol/sdk` | npm | established | high | github.com/modelcontextprotocol/typescript-sdk | `[OK]` | Stays, MCP-critical |
| `zod` | npm | established | very high | github.com/colinhacks/zod | `[OK]` | Stays, MCP-critical |
| `semver` | npm | established | very high | github.com/npm/node-semver | `[OK]` | Stays; used by the release version algebra |

`slopcheck` reported **5 scanned, 5 OK, 0 SLOP, 0 SUS**. `[VERIFIED: slopcheck 2026-09-09]`

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

**WARNING for the planner and every executor:** `slopcheck install <pkgs>` performs a REAL `npm install` in the current working directory and will rewrite `package.json` and `package-lock.json` (observed here: it bumped `@modelcontextprotocol/sdk` to `^1.30.0` and `semver` to `^7.8.5`). Use `slopcheck check` or run it from a scratch directory. Never run `slopcheck install` inside this repo.

### sqlite-vec platform coverage (verified from `package-lock.json`, not from memory)

| Lock entry | `os` | `cpu` | `optional` |
|-----------|------|-------|-----------|
| `sqlite-vec` | - | - | false |
| `sqlite-vec-darwin-arm64` | `["darwin"]` | `["arm64"]` | true |
| `sqlite-vec-darwin-x64` | `["darwin"]` | `["x64"]` | true |
| `sqlite-vec-linux-arm64` | `["linux"]` | `["arm64"]` | true |
| `sqlite-vec-linux-x64` | `["linux"]` | `["x64"]` | true |
| `sqlite-vec-windows-x64` | `["win32"]` | `["x64"]` | true |

All five are present in the lock even though only `sqlite-vec-linux-arm64` is installed on this box, which is exactly the property D-04 depends on: the shrinkwrap travels with all five and each machine resolves its own. `[VERIFIED: package-lock.json on this tree]`

**Gap worth a line in the release notes:** there is no `sqlite-vec-windows-arm64`. A Windows-on-ARM user (Surface, Copilot+ PC) gets `sqlite-vec` with no native binary and degrades to the cjs-fallback in `lib/core/eureka/vector-store.cjs`. That is the same silent-degrade class `bundleDependencies` was rejected for, so Class S should surface it honestly rather than let it pass.

---

## Architecture Patterns

### System Architecture Diagram

```
USER TYPES TWO COMMANDS
  |
  |  /plugin marketplace update
  v
[ marketplace catalog refresh ]  ---- reads ---->  jsagir/mindrian-marketplace
  |                                                 .claude-plugin/marketplace.json
  |                                                 plugins[0].source = {source:npm,
  |                                                   package:@mindrian_os/cli,
  |                                                   version:"<exact>"}
  |  claude plugin update mos@mindrian-marketplace
  v
+------------------------------------------------------------------+
|  CLAUDE CODE LOADER  (owns Fetch and Swap; the plugin owns neither)|
|                                                                    |
|  1. Tus(): cache probe                                             |
|       read ~/.claude/plugins/npm-cache/node_modules/               |
|            @mindrian_os/cli/package.json -> installedVersion       |
|                                                                    |
|       installedVersion === source.version ?                        |
|         YES -> "npm cache hit (pinned, matches requested)" --+     |
|         NO  -> npm install @mindrian_os/cli@<version>        |     |
|                  --prefix ~/.claude/plugins/npm-cache        |     |
|                  --no-fund --no-audit --no-progress          |     |
|                  (NO --ignore-scripts at this step)          |     |
|                deps hoist to npm-cache/node_modules/* ...    |     |
|                ... and are then DISCARDED                    |     |
|                                                              |     |
|  2. E$(): copy npm-cache/node_modules/@mindrian_os/cli  <----+     |
|            -> ~/.claude/plugins/cache/mindrian-marketplace/        |
|                 mos/<version>/                                     |
|            (arrives with NO node_modules)                          |
|                                                                    |
|  3. HK(): read <root>/.claude-plugin/plugin.json                   |
|            fallback <root>/plugin.json                             |
|            neither -> SILENTLY synthesize a wrong-named manifest   |
|                                                                    |
|  4. xje(): readdir(<root>)                                         |
|            has package.json ?  no  -> skip, no log                 |
|            has npm-shrinkwrap.json ?  no  -> skip, NO LOG ENTRY    |
|                                       yes -> npm ci --ignore-scripts|
|                                              timeout 60,000 ms      |
|                                              omit = [] (dev WOULD   |
|                                                install if declared) |
+------------------------------------------------------------------+
  |
  |  node_modules materialized (or partially, on timeout)
  v
[ SessionStart ]
  hooks/hooks.json -> scripts/sessionstart-npm-reconcile.cjs (sync, 120 s)
  lib/core/mcp-dep-heal.cjs requireWithHeal        <-- the timeout tail, by design
  |
  v
[ .mcp.json ]  two servers, both ${CLAUDE_PLUGIN_ROOT}/bin/*.cjs
  mindrian-os     -> bin/mindrian-mcp-server.cjs      (alwaysLoad)
  mindrian-brain  -> bin/mindrian-brain-mcp-client.cjs (alwaysLoad)
  |
  +--> engines reachable on a SLIM install (D-10)
  |      eureka_critic, whitespace_scan, intelligence*, analysis*  (pure JS)
  |
  +--> engines needing the embedding model
         embedding-spine.getEncoder()
            lazy require @huggingface/transformers
              found in <pluginRoot>/node_modules ?    no  (by design now)
              found in ~/.mindrian/eureka-deps ?      <-- NET-NEW createRequire shim
                 no  -> {success:false, error:'encoder_unavailable'}
                        rendered honestly: "model not installed,
                        run /mos:eureka enable (one-time, about 380 MB)"
                 yes -> weights from ~/.mindrian/model-cache (resolveCacheDir)

SIDE DIRECTORIES (survive version pruning; the versioned cache dir does not)
  ~/.mindrian/eureka-deps/   <- packages, platform-scoped (--os/--cpu)   [D-09]
  ~/.mindrian/model-cache/   <- weights, already shipped                 [existing]
```

### Recommended structure of the change (no new top-level directories)

```
package.json                          # files whitelist + negations; transformers out of dependencies
npm-shrinkwrap.json                   # NEW, generated at release time, listed in files
data/harness-policies/
  release-payload-ceiling.json        # NEW, rung blocking, applies_to [pre-tag, full]
  registry-drift.json                 # NEW, rung logged, applies_to [pre-tag, full]
scripts/
  check-release-payload-ceiling.cjs   # NEW runner, offline npm pack --dry-run --json
  check-registry-drift.cjs            # NEW runner, previous-release registry comparison
  release.sh                          # Step 6.7 replaced by shrinkwrap generation; Step 4 + 9.5 edited
lib/core/
  eureka-deps-resolver.cjs            # NEW, the createRequire side-directory shim
  eureka/embedding-spine.cjs          # lazy require goes through the shim
  doctor/class-s-eureka-smoke.cjs     # L1 split + the :180 await bug + two-location probe
commands/
  eureka.md                           # + `enable` subcommand (identity unchanged: /mos:eureka)
  update.md                           # collapsed to Check, Confirm, loader, Verify
tests/
  run-all-341.sh                      # aggregator, the run-all-310.sh shape
  fixtures/341-release-step-block-hashes.txt   # regenerated baseline (see below)
```

### Pattern 1: One-line shrinkwrap generation, placed where the vendoring was

**What:** `npm shrinkwrap` converts the existing `package-lock.json` into `npm-shrinkwrap.json`. It takes no arguments.
**When to use:** at the release.sh slot Step 6.7 currently occupies, so the shrinkwrap is written BEFORE Commit A (the tag carries it) and BEFORE Step 9.5 (the tarball carries it).
**Why there:** publish (Step 9.5) runs after Commit A specifically so the working tree's `package.json` reads vN (release.sh:714-717). The shrinkwrap must be in that same tree.

```bash
# Replaces scripts/release.sh Step 6.7 (:612-672). Sketch, not final code.
echo "=== Step 6.7: Generate npm-shrinkwrap.json (dependency delivery for the npm source) ==="
cd "$PLUGIN_DIR"
if ! npm shrinkwrap; then
  echo "  x npm shrinkwrap failed. package-lock.json is likely out of sync with package.json."
  exit 1
fi
# The loader passes NO --omit, so a dev entry in the shrinkwrap WOULD be installed on every user's box.
if node -e "const l=require('./npm-shrinkwrap.json');process.exit(Object.values(l.packages).some(p=>p&&p.dev===true)?1:0)"; then
  echo "  shrinkwrap carries zero dev entries"
else
  echo "  x npm-shrinkwrap.json contains dev-only packages; the loader would install them on every user machine."
  exit 1
fi
# The single highest-risk assertion in the phase: the lockfile must actually be IN the tarball.
if ! npm pack --dry-run --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s)[0];process.exit(j.files.some(f=>f.path==='npm-shrinkwrap.json')?0:1)})"; then
  echo "  x npm-shrinkwrap.json is NOT in the pack payload. Add it to package.json \"files\"."
  echo "    Without it the loader skips the dependency install WITHOUT a log entry and both MCP servers fail to load."
  exit 1
fi
git add npm-shrinkwrap.json
```

**`NODE_ENV` / `omit` handling (answering the CONTEXT discretion item):** do NOT set `NODE_ENV=production` anywhere in release.sh. `npm ci`'s `omit` default is `[]` unless `NODE_ENV=production`, and the loader controls its own environment, not ours. Setting it at release time would only change what the SHRINKWRAP records, and a shrinkwrap generated under `NODE_ENV=production` can omit metadata a later `npm ci` needs. The correct control is the assertion above: prove the shrinkwrap has no `dev: true` entries, then leave `omit` alone on both sides. `devDependencies` is currently absent from `package.json` entirely, so this gate starts green and stays a tripwire.

### Pattern 2: The `createRequire` side-directory shim (net-new, D-09)

**What:** resolve `@huggingface/transformers` from `~/.mindrian/eureka-deps/node_modules` instead of the plugin's own `node_modules`.
**When to use:** at exactly one place, `embedding-spine.cjs`'s existing lazy require, so the Canon Decision 8 boundary is preserved.
**Why a shim:** verified by grep, **there is no `createRequire` anywhere in `lib/`, `scripts/` or `bin/` today**. This is genuinely new code, and it is the only genuinely new mechanism in the phase.

```js
// lib/core/eureka-deps-resolver.cjs (sketch)
'use strict';
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');

// Same home resolution as lib/core/mva-state.cjs:43 / install-state.cjs.
function eurekaDepsRoot() {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, '.mindrian', 'eureka-deps');
}

// Resolve from the side directory FIRST, then fall back to the plugin's own
// node_modules (a dev checkout that still has transformers installed locally).
// Returns null instead of throwing, so every caller keeps the honest
// encoder_unavailable degrade rather than a stack trace.
function requireEurekaDep(name) {
  const anchor = path.join(eurekaDepsRoot(), 'noop.js');
  try { return createRequire(anchor)(name); } catch (_e) { /* fall through */ }
  try { return require(name); } catch (_e) { return null; }
}

module.exports = { eurekaDepsRoot, requireEurekaDep };
```

Note the anchor-file trick: `createRequire` takes a filename, not a directory, and the file need not exist for module resolution to walk upward from its directory.

### Pattern 3: Platform-scoped on-demand install (D-09)

```js
// Sketch for /mos:eureka enable and doctor --fix eureka.
const { resolveNpmCli, buildInstallArgs } = require('./npm-cli-resolve.cjs');
const { eurekaDepsRoot } = require('./eureka-deps-resolver.cjs');

const d = resolveNpmCli();
const argv = buildInstallArgs(d, [
  '@huggingface/transformers@^4.2.0',
  '--prefix', eurekaDepsRoot(),
  '--os', process.platform,       // win32 | darwin | linux
  '--cpu', process.arch,          // x64 | arm64
  '--no-audit', '--no-fund', '--no-progress'
]);
// spawn(d.command, argv, { shell: d.shell })
```

`--os`, `--cpu` and `--libc` are all real flags of `npm install` on npm 10.9.8, verified from `npm install --help` on this machine. `[VERIFIED: local npm]` They force optional-dependency platform selection, which is what keeps a Mac from downloading `DirectML.dll`.

### Anti-Patterns to Avoid

- **Relying on a root `.npmignore` to trim the payload.** Measured inert when `files` is present. It will look like it works in review and change nothing in the tarball.
- **Assuming the platform enforces the 256 MiB / 20,000-entry ceiling on the npm path.** It does not (F-4). Anything written as "the platform will catch this" is wrong.
- **Adding `docs/` to `files` "just in case".** Two existing policies forbid it, one of them is an `exit 1` in release.sh.
- **Putting the embedding stack in `optionalDependencies`.** Already covered by D-03; the loader's `npm ci` passes no `--omit`, so optional deps install by default. Confirmed against `npm config ls -l` (`omit = []`).
- **Deleting `install.sh` in the same plan that changes release.sh.** `scripts/check-first-touch-drift.cjs:57` lists `'install.sh'` in its surface set. Retiring the file without updating that check turns a green gate red for an unrelated reason.
- **Treating the D-09 side directory and the model cache as one thing.** `~/.mindrian/eureka-deps` holds PACKAGES; `~/.mindrian/model-cache` holds WEIGHTS and already ships (`resolveCacheDir`). Two directories, two lifetimes, two failure modes, two honest messages.

---

## Release Ceremony: What Actually Breaks

Read from `scripts/release.sh` and `tests/run-all-310.sh` on this tree. `[VERIFIED: measured 2026-09-09]`

### Blocker 1: Step 9.5's payload grep refuses `release.sh` and `docs/`

`scripts/release.sh:750`:

```bash
if echo "$PACK_OUT" | grep -Eq '\.planning/|^npm notice .*docs/|mcp-server-brain/|^npm notice .*tests/|release\.sh'; then
  ...  exit 1
fi
```

The `release\.sh` alternative is unanchored, so ANY `npm notice` line naming `scripts/release.sh` trips it. Under D-02's whitelist, `scripts/` ships wholesale and `scripts/release.sh` is inside it. **The publish would refuse.** Two ways out; take both: negate `scripts/release.sh` and `scripts/release-lib` in `files` (recommended above), AND rewrite this gate as part of D-06's Step 9.5 edit so it expresses the ceiling rather than a string blacklist.

### Blocker 2: `tests/run-all-310.sh` hard-pins release.sh's shape

| Leg | Assertion | Measured today | After deleting Step 6.7 |
|-----|-----------|----------------|-------------------------|
| Leg 2 | sha256 of lines 1-79 (preamble) matches the fixture | matches | unaffected unless the preamble is edited |
| Leg 3 | every `^# --- Step` block's sha256 matches `tests/fixtures/310-release-step-block-hashes.txt`, exactly 28 headers, set-equality both directions | 28 headers | **FAILS twice**: "expected 28 step-block headers, found 27" and "block present in fixture but MISSING from current release.sh" |
| Leg 4 | non-comment `exit 1` count `>=` 49 | **50** | Step 6.7's block holds **3** non-comment `exit 1`. 50 - 3 = **47 < 49. FAILS.** |

Neither is a bug; both are Phase 310's scope tripwires doing their job. The plan must handle them deliberately: regenerate `tests/fixtures/310-release-step-block-hashes.txt` from the post-341 release.sh using the reproducible command the fixture header documents, update Leg 3's `28` literal and its authorized-delta list, and rebaseline Leg 4's count. Do this in the SAME plan that edits release.sh so the tree is never knowingly red. Mint a Phase-341 fixture alongside it (`tests/fixtures/341-release-step-block-hashes.txt`) so 341's own authorized regions are pinned the way 310's were.

### The changes themselves

| Step | Lines | Change |
|------|-------|--------|
| Step 4 | :408-419 | Writes `m.plugins[0].source.ref = 'v$NEW_VERSION'` today. Becomes `source.source = 'npm'`, `source.package = '@mindrian_os/cli'`, `source.version = '$NEW_VERSION'` (no `v` prefix; npm versions carry none), and must DELETE any stale `source.ref` / `source.url` keys rather than leaving them beside the new ones. |
| Step 6.7 | :612-672 | Replaced by the shrinkwrap generation + the three assertions of Pattern 1. Its `npm ci --omit=dev`, its `npm ls --omit=dev --depth=0` integrity probe, its `@modelcontextprotocol/sdk` + `zod` presence loop and its `git add -f node_modules` all go. The `MOS_SKIP_VENDOR` escape hatch goes with them. |
| Commit B untrack | :1286 | Deleted (nothing to untrack any more). |
| Step 9.5 | :750-757 | The `docs/`-and-`release.sh` blacklist and the blanket `node_modules/` ban both become the ceiling assertion of D-08. Keep `.planning/`, `mcp-server-brain/` and `tests/` in the blacklist; they are still correct. |
| Steps 5.5, 8, 9.8 | - | Unchanged, per D-06. |

### Doctor `version-of-record-published` (scripts/doctor.cjs:847-890)

Reads `mp.plugins[0].source.ref` and compares it to `'v' + ver`. Under D-06 it reads `mp.plugins[0].source.version` and compares to `ver` (no `v`). The `npm view @mindrian_os/cli@<ver> version` leg at the end already exists and already carries the comment "THIS IS THE ONE NETWORK CALL in this point" - it survives unchanged and is now doubly meaningful, since the npm registry is the distribution channel rather than a side-publish.

---

## Harness Policy Shape (D-08)

`data/harness-policies/_schema.json` is a closed vocabulary. Two new files must validate against it. Fields, verbatim from the schema:

`id`, `kind` (one of `gate|voice|memory|contract`), `runner` (repo-relative, must begin with the literal prefix `scripts/`, no `..`, not absolute, resolves inside the repo root, or `null` for an honest declared ghost), `args` (array, passed verbatim, no interpolation), `rung` (`declared|logged|blocking`), `evidence_log` (path under `MINDRIAN_HOME` or `null`), `promotion_rule` (`{window_runs, max_false_positive_rate, min_true_positives}`), `owner`, `pinned_by` (array of test files), `applies_to` (subset of `pre-flight|pre-tag|full|stop-hook|room`), `notes` (one paragraph, hyphens only, stating which rung it is on TODAY and why).

The runner is always spawned as `spawnSync('node', [resolved, ...args])`, never a shell string. Unknown top-level keys are a hard `--check` failure. `[VERIFIED: data/harness-policies/_schema.json]`

Closest existing analog: **`data/harness-policies/gate-shape-declaration.json`** plus its runner `scripts/check-shape-declaration.cjs`. It is a deterministic pass/fail scanner over repo state, `kind: gate`, `owner: doctor`, `applies_to: ["pre-tag","full"]`, carrying `args: ["--check"]`. Copy that file's shape.

Proposed `data/harness-policies/release-payload-ceiling.json`:

```json
{
  "id": "release-payload-ceiling",
  "kind": "gate",
  "runner": "scripts/check-release-payload-ceiling.cjs",
  "args": ["--check"],
  "rung": "blocking",
  "evidence_log": null,
  "promotion_rule": { "window_runs": 50, "max_false_positive_rate": 0.1, "min_true_positives": 10 },
  "owner": "doctor",
  "pinned_by": ["tests/test-341-payload-ceiling.cjs"],
  "applies_to": ["pre-tag", "full"],
  "notes": "Enters at blocking, not logged, because the platform does NOT enforce the 256 MiB / 20000-entry ceiling on the npm source path - measured against Claude Code 2.1.266, where that check is reachable only from the command source. This policy is the only enforcement that exists for this artifact, so a logged rung would be an honest-looking no-op. The runner is offline: npm pack --dry-run --json makes no registry call. It asserts entryCount and unpackedSize, never packed size, because compression ratio is not a property the platform reads."
}
```

Runner contract (offline, no registry call, exit 0 or 1):

```js
// scripts/check-release-payload-ceiling.cjs -- sketch
const MAX_ENTRIES = 20000;
const MAX_UNPACKED = 268435456;   // 256 MiB
const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
const p = JSON.parse(r.stdout)[0];
// assert p.entryCount <= MAX_ENTRIES
// assert p.unpackedSize <= MAX_UNPACKED
// assert p.files.some(f => f.path === 'npm-shrinkwrap.json')     <-- the silent-failure tripwire
// assert !p.files.some(f => f.path === 'scripts/release.sh')
// assert !p.files.some(f => f.path.startsWith('docs/') || f.path.startsWith('.planning/'))
```

The `entryCount` / `unpackedSize` / `size` / `files[].path` fields all exist verbatim in npm 10.9.8's `npm pack --dry-run --json` output; every measurement in this document was read out of them. `[VERIFIED: measured]`

For the registry-drift policy (the folded todo), `rung: "logged"` with a real `evidence_log` path, and a `promotion_rule` authored now, before any evidence exists, per the schema's `decided_before_the_log_is_read` clause. Its runner compares the current `data/command-registry.json` against the previous release's copy and reports commands that vanished.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Getting the artifact onto the user's machine | A staging/checksum/swap transaction in `/mos:update` | The loader's `Tus` + `E$` + `xje` | Measured: the loader already does all three, atomically, with a versioned cache dir and a cache-hit fast path. D-07's collapse is not a simplification, it is deleting a second implementation of the loader. |
| Installing dependencies into the plugin dir | A first-run installer in a hook | `npm-shrinkwrap.json` + the loader's `npm ci --ignore-scripts` | The loader runs it at install, at update, AND at session start when an enabled plugin is not cached. A hook would race it. |
| Measuring the payload | A `du`/`find` walker over a built tree | `npm pack --dry-run --json` | Emits `entryCount` and `unpackedSize` computed by the same packlist that decides the real tarball. A walker measures a different tree than the one that ships. |
| Deciding which files ship | A custom manifest or build step | `package.json` `files` with `!` negation | One file, diff-visible, and the only thing `npm pack` reads. |
| Excluding a nested `node_modules` | A pre-pack cleanup script | `"!lib/wiki/editor-src"` in `files` | npm's own node_modules exclusion is root-only; negation is the supported mechanism and it is measured to work. |
| Cross-platform npm invocation | `spawn('npm', ...)` or an `.cmd` special case | `lib/core/npm-cli-resolve.cjs` | Already solves the Windows `.cmd` and PATH problem by resolving `npm-cli.js` off `process.execPath`. |
| Resolving a package from a side directory | Path munging on `require.resolve` or `NODE_PATH` | `node:module` `createRequire` | Standard, respects the real resolution algorithm, and needs an anchor filename rather than a directory. |
| Verifying a release gate without network | A mock npm registry | `MOS_TEST_DRY_RUN=1` (release.sh:761) + `RELEASE_TEST_MODE` sandboxes (tests/test-release-bump-tag-and-publish-gates.cjs) | Both already exist and already scaffold plugin + marketplace repos with bare-clone fake origins. |
| Comparing semver ranges | Hand-rolled string comparison | `semver` (already a dependency) | Already used by the release version algebra. |

**Key insight:** almost every "build" in this phase is actually a "delete". The loader grew the capabilities `/mos:update` was hand-rolling, and the payload problem is one `package.json` field away from solved. The only genuinely new code is the `createRequire` shim, the two harness runners, and the Class S split. Everything else is subtraction plus one lockfile.

---

## Runtime State Inventory

This IS a migration phase: it changes the delivery mechanism, the install location, and the dependency root. A grep audit of the repo finds files; it does not find any of the following.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | None in a database. The only persisted per-version state is the plugin cache tree itself. Measured on this box: `~/.claude/plugins/cache/mindrian-marketplace/mos/` holds `2.0.0-beta.23`, `2.0.0-beta.25`, `2.0.0-beta.27`, **597 MB each, 1.8 GB total** (F6 from the teardown, reproduced). | None required by this phase. The platform sweeps orphans about 14 days after uninstall and documents no prune command; slimming to about 30 MiB per version makes it moot. Do NOT build a pruner (deferred). |
| **Live service config** | `~/mindrian-marketplace/.claude-plugin/marketplace.json` is a SEPARATE GIT REPO (`jsagir/mindrian-marketplace`) whose `plugins[0].source` is `{"source":"url","url":"...git","ref":"v2.0.0-beta.29"}` today. It is edited by release.sh Step 4 and committed there. **Nothing in this dev repo can change it; the change lands only when release.sh runs.** Also: `~/.claude/plugins/known_marketplaces.json` records the marketplace as `{"source":"github","repo":"jsagir/mindrian-marketplace"}` - that is the CATALOG source and is unaffected by the plugin `source` change. | release.sh Step 4 rewrite is a **code edit**; the actual marketplace.json flip is a **data migration** that happens on the first post-341 release. Both must appear in the plan as separate tasks. The old `source.ref` and `source.url` keys must be DELETED, not left beside the new `source.version`. |
| **OS-registered state** | `~/.claude/settings.json` may carry a `statusLine` block and hook entries written by `install.sh` pointing at `~/.claude/plugins/mindrian-os` (`install.sh:13` `INSTALL_DIR`, `:319` `hookMarker = 'mindrian-os'`). Reproduced on Windows (teardown F2/F8); **verified ABSENT on this Linux box** (`~/.claude/plugins/` has no `mindrian-os` entry). | The `doctor --fix` of the discretion item must (1) parse `~/.claude/settings.json`, (2) prove no `statusLine`, hook `command`, or env value resolves through `~/.claude/plugins/mindrian-os`, (3) back the directory up, (4) remove it. Order matters: verify, then back up, then remove. |
| **Secrets and env vars** | `MINDRIAN_BRAIN_KEY` in env or `~/.mindrian.env`, read by `bin/mindrian-brain-mcp-client.cjs` via `brain-client.cjs`. **No key name changes in this phase.** `MINDRIAN_MODEL_CACHE` is an existing override read by `resolveCacheDir`. `DOCTOR_SKIP_EUREKA_SMOKE`, `MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD`, `MOS_SKIP_VENDOR` (dies with Step 6.7), `MOS_TEST_DRY_RUN`, `RELEASE_TEST_MODE`. | None. No secret or env key is renamed. `MOS_SKIP_VENDOR` becomes dead and its references should be removed with Step 6.7. |
| **Build artifacts / installed packages** | (a) `node_modules/` on this dev box is 441 MB, of which 392.6 MB is the transformers stack; after D-03 an `npm install` yields about 51 MB. (b) `~/.claude/plugins/npm-cache/` **does not exist yet on this box** - it is created the first time an npm-source plugin installs, so the first post-341 install is a genuine cold path with no local precedent. (c) `lib/wiki/editor-dist/` (4.6 MB, 2 packed entries) is the runtime artifact built from `editor-src`; excluding `editor-src` from the tarball does NOT break it, but a future rebuild of `editor-dist` still needs `editor-src` in GIT (it stays in git, only out of the tarball). (d) `mcp-server-brain/` (50 MB) is NOT in the `files` list and is NOT read by either `bin/*.cjs` entry point. | (a) is automatic on the next `npm install`. (b) is the reason D-13's cold-install proof is step 2 and blocks everything else. (c) needs a one-line note in the plan so nobody "cleans up" `editor-src` from git. (d) see the caveat below. |

**The one runtime reader that breaks under the slim artifact:** `lib/brain/curation-batch.cjs:112` builds `path.join(PLUGIN_ROOT, 'mcp-server-brain', 'node_modules', 'neo4j-driver')` and requires it. `mcp-server-brain/` is not in the `files` list and never was, so this path is already broken for any npm-installed copy - but under the git-clone artifact it worked, because the whole repo shipped. The file's own comments say "Wave 1 NEVER calls this" and it is reached from `scripts/admin-brain-write.cjs`, an operator path. **Action: confirm it is operator-only, and make it fail with an honest "this is an operator path, run it from a dev checkout" message rather than a `MODULE_NOT_FOUND`.** Add it to the plan explicitly; it is exactly the class of thing a grep audit of `files` would miss.

**The `.planning` runtime readers (answering CONTEXT discretion item (e)):**

- `lib/core/pitch-feedback-schemas.cjs:286` - **NOT a runtime path.** The `.planning/phases/229-huji-pitch-feedback-module/schemas` write sits inside the `if (require.main === module)` self-test block (guard at line 208); `toJsonSchemas(outDir)` itself (line 140) takes `outDir` as a parameter and hard-codes nothing. Its production callers are `scripts/huji-run-one.cjs:62` and `scripts/huji-eval.cjs:168,511`, which use `inlineSchemaJson` and the zod schemas, never `toJsonSchemas`. **Recommendation: leave the module as it is and change the self-test's `outDir` to `os.tmpdir()`.** A one-line change, zero risk, and it removes the last `.planning` write from a shipped file. Do not relocate the module.
- `lib/core/drift-baseline.cjs`, `lib/core/skillopt-schemas.cjs`, `lib/core/planning/reconcile-runner.cjs` - dev tooling that reads a `.planning` tree, but all three take the planning directory as a parameter (`opts.planningDir`, `reconcile-runner.cjs:203-206`) rather than hard-coding the plugin's own. **Recommendation: they SHIP.** They live under `lib/`, excluding them individually costs three more negation entries and buys about a dozen entries, and `reconcile-runner.cjs`'s own comment says "the plugin dog-foods its own `.planning`", meaning a room's `.planning` is a legitimate runtime target. Shipping them is correct, not just cheap.

---

## Common Pitfalls

### Pitfall 1: The shrinkwrap that is not in the tarball

**What goes wrong:** `npm-shrinkwrap.json` is generated, committed, present in the git tag, and absent from the published tarball because it was not listed in `files`.
**Why it happens:** npm auto-includes `npm-shrinkwrap.json` when there is NO `files` field, which is the behavior everyone remembers. Add a `files` field and the auto-inclusion silently stops. Measured on npm 10.9.8.
**Downstream:** the loader's `xje` finds `package.json` and no supported lockfile. The official documentation for that case reads: "A plugin with a `package.json` and no lockfile is skipped without a log entry." The plugin installs, reports success, has zero `node_modules`, and both `alwaysLoad` MCP servers fail on `require`.
**How to avoid:** assert `npm pack --dry-run --json` contains `npm-shrinkwrap.json` in THREE places: the release.sh shrinkwrap step, the `release-payload-ceiling` harness runner, and a standalone RED test written before any packaging change lands.
**Warning signs:** a beta where `/mos:doctor` reports MCP servers down on a fresh box but fine on the dev box (where `node_modules` exists from `npm install`).

### Pitfall 2: The `.npmignore` that does nothing

**What goes wrong:** someone adds a root `.npmignore` to exclude `lib/wiki/editor-src`, reviews the diff, and ships a 244 MB / 11,451-entry tarball.
**Why it happens:** `files` takes precedence over the root `.npmignore` completely. Measured: identical output with and without the file.
**How to avoid:** negation entries inside `files`. Have the ceiling policy assert `entryCount <= 20000` so the mistake fails a gate instead of a user's disk.
**Warning signs:** the tarball's `entryCount` is above 10,000.

### Pitfall 3: Publishing a tarball release.sh refuses to publish

**What goes wrong:** `scripts/` ships wholesale, `scripts/release.sh` is inside it, Step 9.5's payload grep matches the literal `release\.sh`, and the release halts AFTER Commit A has been made and tagged. release.sh's own recovery text calls this state "the lockstep contract is now BROKEN until you recover".
**Why it happens:** the grep was written when `files` held five entries and could not have contained release.sh.
**How to avoid:** negate `scripts/release.sh` and `scripts/release-lib` in `files`, AND rewrite the gate in the same plan. Do not rely on only one of the two.
**Warning signs:** the first live run of the new release.sh; there is no earlier signal, which is why this must be caught by a test, not by a release.

### Pitfall 4: The scope tripwires nobody remembered

**What goes wrong:** `tests/run-all-310.sh` leg 3 fails with "expected 28 step-block headers, found 27" and leg 4 fails with "non-comment exit-1 count dropped: baseline=49 actual=47" the moment Step 6.7 is deleted. Measured: 28 headers and 50 `exit 1` today; Step 6.7's block holds 3 of them.
**Why it happens:** Phase 310 pinned release.sh's byte-level shape deliberately. It is working as designed.
**How to avoid:** regenerate `tests/fixtures/310-release-step-block-hashes.txt` using the reproducible command documented in the fixture's own header, adjust leg 3's `28` literal and its authorized-delta list, rebaseline leg 4, and mint a `341-` fixture for this phase's own authorized regions - all in the SAME plan that edits release.sh.
**Warning signs:** `bash tests/run-all-310.sh` red immediately after a release.sh edit.

### Pitfall 5: Class S L1 probes a directory that no longer exists

**What goes wrong:** `lib/core/doctor/class-s-eureka-smoke.cjs:87-90` probes `<pluginRoot>/node_modules/@huggingface/transformers/package.json`. Under D-09 the package lives at `~/.mindrian/eureka-deps/node_modules/...` instead. Splitting L1 into "capability reachable" plus "model installed" without changing the PATH leaves the advisory permanently red on a machine where the user did run `/mos:eureka enable`.
**Why it happens:** D-11 describes the split, not the relocation. Both are needed.
**How to avoid:** make the "model installed" layer probe the side directory first and the plugin's own `node_modules` second, via the same `eureka-deps-resolver.cjs` shim the runtime uses. One resolution authority, not two.
**Warning signs:** doctor says "model not installed" immediately after a successful enable.

### Pitfall 6: The un-awaited `isModelCached`

**What goes wrong:** `class-s-eureka-smoke.cjs:180` reads `const cached = spine._test.isModelCached(model, cacheDir);` with no `await` and no `dtype`. `isModelCached` is declared `async` in `embedding-spine.cjs`, so `cached` is always a Promise, always truthy, and the cache-miss branch at :183-190 is unreachable. Every L3 run performs a real embed, including on a cold cache, which is a network download inside a release gate.
**Why it happens:** the function was changed from sync to async in Phase 272-08 and this call site was not threaded.
**How to avoid:** `await`, and pass the same `dtype` the caller resolves. Then add the test that pins the cache-miss branch as reachable, or the same regression returns.
**Warning signs:** Class S L3 taking tens of seconds on a fresh machine and touching the network under `--acceptance`.

### Pitfall 7: `slopcheck install` inside the repo

**What goes wrong:** it runs a real `npm install` and rewrites `package.json` and `package-lock.json`. Observed live during this research: `@modelcontextprotocol/sdk` `^1.29.0` -> `^1.30.0` and `semver` `^7.7.4` -> `^7.8.5`. Both were reverted.
**Why it happens:** the subcommand name reads as a dry-run and is not.
**How to avoid:** `slopcheck check`, or run it in a scratch directory.
**Warning signs:** `git status` dirty on `package.json` after a "read-only" verification step.

### Pitfall 8: Windows-on-ARM has no `sqlite-vec` binary

**What goes wrong:** the lock carries five sqlite-vec platform packages and none of them is `win32`/`arm64`. A Copilot+ PC gets `sqlite-vec` present with `require.resolve` failing on its native module and degrades to the cjs-fallback in `vector-store.cjs`, silently.
**Why it happens:** upstream does not publish that platform.
**How to avoid:** this is not fixable here; make it VISIBLE. Class S should name the platform and the degrade rather than pass. This is precisely the failure class `bundleDependencies` was rejected for, so it should not be allowed in through a different door.
**Warning signs:** a Windows ARM tester reporting slow or empty vector search with no error.

---

## Code Examples

### Recommended `package.json` diff shape

```jsonc
{
  "files": [
    ".claude-plugin", ".mcp.json", "settings.json",
    "npm-shrinkwrap.json",                 // MANDATORY: not auto-included when files exists
    "hooks", "commands", "skills", "agents", "pipelines", "output-styles",
    "lib", "!lib/wiki/editor-src",         // 9,119 entries, ~208 MiB
    "scripts", "!scripts/release.sh", "!scripts/release-lib",  // Step 9.5 greps for release.sh
    "bin", "data", "references", "templates", "assets",
    "README.md", "LICENSE", "CHANGELOG.md"
    // NOT docs/  (zero runtime readers; release.sh:750 already bans it)
    // NOT dist/  (build output for other agent hosts; zero plugin-root reads)
  ],
  "dependencies": {
    // "@huggingface/transformers": "^4.2.0",   <-- REMOVED (D-03); on-demand via /mos:eureka enable
    "@ig3/markdown-it-wikilinks": "^1.0.2",
    "@modelcontextprotocol/ext-apps": "^1.5.0",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "ajv": "^8.18.0", "asciichart": "^1.5.25", "chokidar": "^4.0.3",
    "chrono-node": "^2.9.1", "express": "^5.1.0", "flexsearch": "^0.7.43",
    "gray-matter": "^4.0.3", "markdown-it": "^14.1.0", "semver": "^7.7.4",
    "sqlite-vec": "^0.1.9", "zod": "^3.25.76"
  }
}
```

### Marketplace entry, before and after

```jsonc
// BEFORE (~/mindrian-marketplace/.claude-plugin/marketplace.json, live today)
"source": { "source": "url", "url": "https://github.com/jsagir/mindrian-os-plugin.git", "ref": "v2.0.0-beta.29" }

// AFTER (D-01). Note: no "v" prefix on an npm version, and the old keys must be DELETED.
"source": { "source": "npm", "package": "@mindrian_os/cli", "version": "2.0.0-beta.31" }
```

### The one-line measurement every plan step should be able to reproduce

```bash
npm pack --dry-run --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s)[0];console.log(j.entryCount,'entries;',j.unpackedSize,'unpacked;',j.size,'packed');console.log('shrinkwrap in payload:', j.files.some(f=>f.path==='npm-shrinkwrap.json'));})"
```

Offline. No registry call. Same packlist the real publish uses.

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|--------------|------------------|--------------|-------------|
| Git-tag delivery with vendored `node_modules` | npm-source delivery with a published shrinkwrap | The `npm` plugin source type exists in Claude Code 2.1.266 and is fully implemented (read from the binary) | The whole phase |
| `bundleDependencies` as the way to ship deps with a package | Lockfile plus the host's own `npm ci` | npm 7+ hoisting plus platform-specific optional dependencies made bundling host-dependent | Already rejected in 341-FINDINGS by measurement; reading `Tus` confirms bundling WOULD survive the copy, which is why it is tempting and must stay rejected |
| `.npmignore` as the exclusion mechanism | `files` with `!` negation | `files` has taken precedence over root `.npmignore` for many npm major versions | Correcting CONTEXT.md's integration note |
| A plugin doing its own fetch/verify/swap | The loader owning fetch and swap | The loader's `Tus`/`E$`/`xje` pipeline as shipped in 2.1.266 | D-07's collapse |
| `install.sh` as a distribution path | Four documented paths, none of which need it | `docs/install/PACKAGING-PATHS.md` already documents marketplace+github, marketplace+npm, ZIP/URL (`--plugin-url`, `--plugin-dir`), and CI/Docker pre-bake (`CLAUDE_CODE_PLUGIN_CACHE_DIR` / `CLAUDE_CODE_PLUGIN_SEED_DIR`) | Answers the (f) discretion item, below |

**Deprecated / outdated in this repo:**

- The 2026-05-21 "every production dependency is pure JS, the 32M tree" premise quoted inside Step 6.7. Expired 2026-07-05.
- `MOS_SKIP_VENDOR` (only meaningful inside Step 6.7).
- The `SHA_DIFFERS_INVERSION_HOTFIX` leg and the `api.github.com` tag-ref call at `scripts/check-version-and-sha.cjs:222` (D-07 retires them; npm versions are immutable).
- `docs/install/PACKAGING-PATHS.md`'s status line "path 2 unblocks once `@mindrian_os/install` is published" - the package is now `@mindrian_os/cli` and IS published. That doc needs a refresh in this phase; it is the user-facing statement of what this phase does.

---

## Answering the remaining CONTEXT discretion items

### (f) Does any host without the marketplace loader still need `install.sh`?

**No.** Evidence:

1. `docs/install/PACKAGING-PATHS.md` enumerates four canonical distribution paths and `install.sh` is not one of them. Paths 3 (ZIP / URL via `--plugin-url` or `--plugin-dir`) and 4 (CI / Docker pre-bake) are exactly the "no marketplace loader" cases, and both go through the platform, not through `install.sh`.
2. `CLAUDE_CODE_PLUGIN_CACHE_DIR` and `CLAUDE_CODE_PLUGIN_SEED_DIR` both exist as literal strings in the Claude Code 2.1.266 binary, so the path-4 env-var contract that doc describes is real, not aspirational. `[VERIFIED: binary]`
3. Desktop and Cowork consume the plugin through `.mcp.json` and the plugin loader, not through a shell installer; `docs/install/` contains no Desktop or Cowork installer path at all (`BRAIN-SETUP.md`, `HEAL.md`, `PACKAGING-PATHS.md` are the whole directory).
4. `install.sh`'s only unique behavior is creating `${HOME}/.claude/plugins/mindrian-os` (line 13) and writing hook and statusline entries keyed to it (line 319). That directory IS the second install location the phase is retiring.
5. Its historical failure record is documented in this repo: it dies under `set -euo pipefail` on a missing file leaving `settings.json` half-written, and it needs `core.longpaths` on Windows (`docs/testers/gary-laben/FEEDBACK.md:55-56`, `docs/UI-UX-CONVERGENCE-2026-05-10/04-REVERSE-SALIENT-INSTALL.md:24`).

**Retire it, with two prerequisites.** First, `scripts/check-first-touch-drift.cjs:57` lists `'install.sh'` in its surface set; that entry must be removed in the same plan or the gate goes red for an unrelated reason. Second, retire it in D-13's step 3, AFTER the cold-install proof in step 2, so there is never a window with no working install path.

**The `doctor --fix` order of operations:** (1) read `~/.claude/settings.json` and prove no `statusLine.command`, no hook `command`, and no env value resolves through `~/.claude/plugins/mindrian-os`; (2) if anything does, report and refuse; (3) copy the directory to a timestamped backup under `~/.mindrian/`; (4) remove the original; (5) re-run the topology half of Class I/J to prove one location remains. Verified absent on this Linux box, reproduced on Windows, so the fix must handle "already clean" as a normal, silent success.

### (g) The `createRequire` side-directory resolver

Confirmed net-new: `grep -rn "createRequire" lib/ scripts/ bin/` returns **zero hits**. Sketch in Pattern 2. Keep it to one module with two exports so there is exactly one resolution authority for `~/.mindrian/eureka-deps`, used by the runtime lazy require, by `/mos:eureka enable`, and by Class S's "model installed" layer.

### (h) How the two policies plug in

Covered in "Harness Policy Shape". Zero new release.sh wiring: the `harness-policies` doctor point (`scripts/doctor.cjs:1387-1390`, severity `blocker`, `applies_to: ["pre-tag","full"]`) already spawns `scripts/run-harness.cjs`, and Steps 6.6 and 9.8 already call `doctor --acceptance`. Closest analog runner: `scripts/check-shape-declaration.cjs` behind `data/harness-policies/gate-shape-declaration.json`.

### (i) What the existing release tests already cover

| File | Covers | Relevance |
|------|--------|-----------|
| `tests/run-all-310.sh` | 10 legs: bash syntax, preamble hash, exhaustive step-block hash tripwire (28 headers), `exit 1` count floor (49), 7 literal-preservation checks, two Phase 310 suites, the pre-existing suite green plus zero diff, scoped working-tree diff, em-dash guard. Header states "Zero real git push, zero real remote, zero npm publish." | **Legs 3 and 4 break on the Step 6.7 deletion.** See Pitfall 4. |
| `tests/test-release-bump-tag-and-publish-gates.cjs` | 13 cases against scaffolded sandboxes: `mkdtempSync` plugin + marketplace + minisite repos, `git init`, bare-clone fake origin remotes, an HTTP mock for the minisite poll, an `npx` shim on PATH, driven by `PLUGIN_DIR` / `MARKETPLACE_DIR` / `MINISITE_DIR` / `MINDRIAN_MINISITE_URL` / `RELEASE_TEST_MODE`. Case 13 asserts the `--dry-run` output lists all the gates. | **This is the pattern for the D-06 test lock.** Add cases in this file's idiom: Step 4 writes `source.version` and deletes `source.ref`; Step 6.7's slot generates a shrinkwrap; Step 9.5's payload gate passes on the new whitelist. Known pre-existing reds: cases 10 and 11 regex the retired package name `@mindrian_os/install`; they were already failing before Phase 310 and are documented as out of scope. Decide explicitly whether 341 fixes them or inherits them. |
| `tests/test-310-verify-tag-push-lib.cjs`, `tests/test-310-release-step55-wiring.cjs` | The injectable-hook unit pattern (0/10/1 return codes, hooks overridable by env) around `scripts/release-lib/verify-tag-push.sh` | The shape for a `scripts/release-lib/` helper if the ceiling check needs one |
| `tests/test-release-npm-gate.sh`, `tests/test-235-release-shape-gate.cjs`, `tests/test-release-bump-algebra.cjs`, `tests/test-check-version-semver-prerelease.cjs`, `tests/test-marketplace-cache-prerelease-pick.cjs` | npm gate, release shape, version algebra, prerelease semver, marketplace cache prerelease selection | All touch surfaces this phase changes; run them all in `tests/run-all-341.sh` |

**The no-network contract is already the house rule** (`.planning` CONTEXT: "Release-gate tests never make a real git push, npm publish or network call (Phase 310 precedent)"). `MOS_TEST_DRY_RUN=1` at release.sh:761 and `RELEASE_TEST_MODE` in the fixture are the two levers; `npm pack --dry-run --json` is offline by construction.

---

## Project Constraints (from CLAUDE.md)

Directives this phase must honor, extracted from `./CLAUDE.md` and its four `@include` files. Treat with the same authority as the locked decisions.

| Directive | Source | Bearing on this phase |
|-----------|--------|-----------------------|
| Every commit, git operation and GSD phase runs from `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/*` | WORKSPACE GUARD | The phase touches BOTH; every measurement in this document names which tree it came from |
| Read this repo's version with `node lib/core/repo-version.cjs`, never a tree search | WORKSPACE GUARD | A stale worktree under `.claude/worktrees/` answers a tree search with a months-old version |
| **All dev work runs through GSD workflows; no direct repo edits** | GSD Workflow Enforcement + MEMORY hard rule 2026-08-19 | Every change here lands via `/gsd-execute-phase` |
| **No em-dashes anywhere; hyphens only** | Conventions | Enforced by an em-dash guard leg in the test aggregators; this document complies |
| **Canon Part 7, reuse before build** | Canon Compliance Core | Justified above for every reused asset; the only net-new mechanism is the `createRequire` shim, and its justification is "zero `createRequire` exists in the tree" |
| **Canon Part 8, LOCAL -> BRAIN: NO** | Canon Compliance Core | The two new harness runners must be pure local filesystem plus `spawnSync('node', [...])`. The `harness-policies` doctor point's own comment already states "Zero network"; the ceiling runner's `npm pack --dry-run` keeps that true |
| **Canon Part 11 (CIRS), every invocable surface born WIRED or EXCLUDED with a declared HITL shape** | Canon Compliance Core | `/mos:eureka enable` is a NEW invocable sub-surface: it needs `hitl_shape`/`hitl_why` frontmatter and must pass `scripts/check-shape-declaration.cjs` |
| Every directory gets a `ROOM.md` (ICM Layer 0) | Conventions | The `files` whitelist keeps them; verify no shipped directory loses its ROOM.md under the negations |
| CJS only, no TypeScript; bash scripts in `scripts/` are authoritative, CJS wraps them | Conventions | Both harness runners are `.cjs`; the shrinkwrap step is bash inside release.sh |
| Never bump versions by hand; `scripts/release.sh <version>` enforces the five gates | release-process.md | The 5-way rule's record 5 moves from `source.ref` to `source.version` |
| Tri-Polar rule: evaluate every feature across CLI, Desktop and Cowork; a skip is a stated call | Tri-Polar Design Rule | D-13's cold-install proof covers three OPERATING SYSTEMS, not three SURFACES. State explicitly whether Desktop and Cowork resolution through the new artifact is proven or deferred |
| Consult all relevant grounding sources; official docs for platform claims | Grounding rule | Loader facts here come from the shipped binary and from the verbatim doc quotes already in 341-FINDINGS, never from memory |
| `.planning/` is gitignored; handoffs travel only through tracked files | WORKSPACE GUARD | Anything a future machine needs must land in `docs/` or in code, not only here |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (floor is >=22.16.0) | none needed |
| npm CLI | pack, shrinkwrap, publish, the loader's two installs | yes | 10.9.8 | none needed |
| `npm install --os/--cpu/--libc` | D-09 platform scoping | yes | present in `npm install --help` on 10.9.8 | none needed |
| Claude Code | the loader under test | yes | 2.1.266 | none needed |
| git | tag, commit, the current source type | yes | in PATH | none needed |
| `slopcheck` | package legitimacy audit | yes | `~/.local/bin/slopcheck` | mark packages `[ASSUMED]`; **use `check`, never `install`** |
| `ctx7` CLI / Context7 MCP | library docs lookup | **no** | - | Local `npm <cmd> --help` plus `npm config ls -l` are authoritative for npm 10.9.8 behavior and were used instead; every npm claim in this document is a local measurement, not a doc paraphrase |
| npm registry network | `npm publish`, `npm view`, the loader's install | assumed yes at release time | - | Not needed by any test in this phase (all release-gate tests are offline by contract) |
| A Windows machine | D-13 step 2 cold-install proof | **no** | - | **No fallback. This is the phase's one hard external dependency.** The Windows leg cannot be simulated; D-13 correctly makes it a blocking gate |
| A macOS machine | D-13 step 2 cold-install proof | **no** | - | **No fallback.** Same as above |

**Missing dependencies with no fallback:** a Windows box and a macOS box for D-13 step 2. The plan must treat that step as a `checkpoint:human-verify` with an explicit hand-off, not as an executable task.

**Missing dependencies with fallback:** Context7 / `ctx7` (replaced by local `npm --help` and `npm config ls -l`, which are strictly more authoritative for the exact npm version in play).

**Environment note for the executor:** `~/.claude/plugins/npm-cache/` does not exist on this box yet. The first npm-source install is a genuine cold path with no local precedent, which is another reason D-13 orders proof before everything else.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Plain `node` assertion scripts (`node:assert`) plus bash aggregators. No jest, no vitest, no mocha. |
| Config file | none. Discovery is by the per-phase aggregator `tests/run-all-<phase>.sh` (glob discovery with a found-eq-0 guard, the `run-all-270.sh` / `run-all-310.sh` idiom) |
| Quick run command | `node tests/test-341-<name>.cjs` |
| Full suite command | `bash tests/run-all-341.sh` |
| Release-tier command | `node scripts/doctor.cjs --acceptance` (spawns `scripts/run-harness.cjs`, which runs the two new policies) |
| Standalone harness | `node scripts/run-harness.cjs --check`, `--tier pre-tag`, `--policy release-payload-ceiling` |

### No-network constraint (house rule, Phase 310 precedent)

Every release-gate test in this phase must make **zero real `git push`, zero `npm publish`, zero registry call**. The three existing levers:

- `MOS_TEST_DRY_RUN=1` (`scripts/release.sh:761`) turns the live `npm publish` into an echo while still exercising the payload gate above it.
- `RELEASE_TEST_MODE` plus `PLUGIN_DIR` / `MARKETPLACE_DIR` env overrides (`tests/test-release-bump-tag-and-publish-gates.cjs`) scaffold `mkdtempSync` plugin and marketplace repos with `git init` and bare-clone fake origins.
- `npm pack --dry-run --json` is offline by construction; it reads only the working tree.

The one point that legitimately makes a network call, doctor's `version-of-record-published` `npm view` leg, is `applies_to: ["full"]` only and is already commented as "THIS IS THE ONE NETWORK CALL in this point". It stays as it is and is never invoked by a phase test.

### Decision-to-proof map

| Decision | Behavior to prove | Test type | Automated command | Exists? |
|----------|-------------------|-----------|-------------------|---------|
| D-01 | Marketplace entry is `source: npm` with an exact version and carries no residual `source.ref` / `source.url` | unit | `node tests/test-341-marketplace-npm-source.cjs` | Wave 0 |
| D-02 | `npm pack --dry-run --json` yields `entryCount <= 20000`, `unpackedSize <= 268435456`, and contains none of `docs/`, `dist/`, `.planning/`, `lib/wiki/editor-src/`, `scripts/release.sh` | unit, offline | `node scripts/check-release-payload-ceiling.cjs --check` | Wave 0 |
| D-02 | `.claude-plugin/plugin.json` is present at the tarball root (else the loader synthesizes a wrong-named manifest) | unit, offline | same runner | Wave 0 |
| **D-04** | **`npm-shrinkwrap.json` is in the pack payload** | unit, offline | same runner, and independently in the release.sh step | **Wave 0, highest priority** |
| D-04 | The shrinkwrap carries zero `"dev": true` entries (the loader passes no `--omit`) | unit | `node tests/test-341-shrinkwrap-no-dev.cjs` | Wave 0 |
| D-04 | The shrinkwrap carries all five sqlite-vec platform packages with `os`/`cpu` | unit | `node tests/test-341-shrinkwrap-platform-coverage.cjs` | Wave 0 |
| D-03 | `@huggingface/transformers` is absent from `dependencies`, `optionalDependencies` and `peerDependencies` | unit | `node tests/test-341-no-heavy-dep.cjs` | Wave 0 |
| D-06 | Step 4 writes `source.version`, deletes `source.ref`; Step 6.7's slot generates a shrinkwrap; Step 9.5 passes on the new whitelist | integration, sandboxed, no network | `node tests/test-release-bump-tag-and-publish-gates.cjs` (new cases, `RELEASE_TEST_MODE`) | Extend existing |
| D-06 | release.sh's step-block shape changed ONLY in the authorized regions | tripwire | `bash tests/run-all-341.sh` leg using `tests/fixtures/341-release-step-block-hashes.txt` | Wave 0 |
| D-06 | `tests/run-all-310.sh` is green again after rebaselining | regression | `bash tests/run-all-310.sh` | Rebaseline required |
| D-06 | Doctor `version-of-record-published` compares `source.version` | unit | `node tests/test-341-version-of-record-source-version.cjs` | Wave 0 |
| D-07 | `commands/update.md` has exactly the four steps and no `post-update-restart-pending` reference anywhere in the tree | grep tripwire | `node tests/test-341-update-collapsed.cjs` | Wave 0 |
| D-07 | The `api.github.com` tag-ref call is gone from `scripts/check-version-and-sha.cjs` | grep tripwire | same | Wave 0 |
| D-08 | Both policies validate against `_schema.json` and the manifest regenerates | unit | `node scripts/build-harness-manifest.cjs --check` | Exists |
| D-08 | The blocking policy actually fails the tier on a violating tree | integration | `node scripts/run-harness.cjs --tier pre-tag` against a fixture with a bloated `files` | Wave 0 |
| D-09 | `/mos:eureka enable` builds the correct argv (`--prefix`, `--os`, `--cpu`) without spawning | unit, no install | `node tests/test-341-eureka-enable-argv.cjs` | Wave 0 |
| D-09 | The `createRequire` shim resolves from `~/.mindrian/eureka-deps` first and returns `null` rather than throwing | unit, tmpdir fixture | `node tests/test-341-eureka-deps-resolver.cjs` | Wave 0 |
| D-10 | Every intelligence engine stays reachable with the model absent, and renders the honest not-installed state | integration, slim-install fixture | `node tests/test-341-slim-install-honest-degrade.cjs` | Wave 0 |
| D-11 | `isModelCached` is awaited and the cache-miss branch is reachable | unit, mocked spine | `node tests/test-341-class-s-await-bug.cjs` | Wave 0 (RED first) |
| D-11 | L1 splits into blocker + advisory, layer ids and order preserved for the harness | unit | `node tests/test-341-class-s-layer-split.cjs` | Wave 0 |
| D-12 | Eureka, critic included, has zero Brain/Theo reach | grep tripwire (the `test-213-part8-boundary.cjs` idiom) | `node tests/test-341-eureka-no-brain-reach.cjs` | Wave 0 |
| D-13 | Cold install completes on Windows, macOS and Linux; both MCP servers load | **manual only** | `checkpoint:human-verify` | Not automatable |
| Convention | No em-dashes in any file this phase touches | lint | em-dash guard leg in `tests/run-all-341.sh` | Copy from `run-all-310.sh` |

### Sampling rate

- **Per task commit:** the single relevant `node tests/test-341-*.cjs`, under 5 seconds each.
- **Per wave merge:** `bash tests/run-all-341.sh` plus `bash tests/run-all-310.sh` (the rebaselined one) plus `node scripts/run-harness.cjs --check`.
- **Phase gate:** `node scripts/doctor.cjs --acceptance` fully green, then the three-platform cold-install checkpoint, then `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `tests/run-all-341.sh` - the aggregator, modeled on `run-all-310.sh` (glob discovery, found-eq-0 guard, em-dash guard, Part 8 sweep)
- [ ] `tests/fixtures/341-release-step-block-hashes.txt` - regenerated baseline for this phase's authorized regions
- [ ] Rebaseline of `tests/fixtures/310-release-step-block-hashes.txt` plus leg 3's `28` literal and leg 4's `49` floor
- [ ] `scripts/check-release-payload-ceiling.cjs` and `scripts/check-registry-drift.cjs` - the two runners
- [ ] `data/harness-policies/release-payload-ceiling.json`, `data/harness-policies/registry-drift.json`
- [ ] The 18 `tests/test-341-*.cjs` files enumerated above
- [ ] A slim-install fixture: a tree with `node_modules` present but no `@huggingface/transformers`, for D-10 and D-11

**Wave ordering, derived from D-13:** Wave 0 = tests and fixtures (lands RED by design). Wave 1 = the `files`/dependency cut, shrinkwrap generation, exact-pin source, the two policies, plus the release.sh surgery and its fixture rebaselines. **Gate: the three-platform cold-install checkpoint.** Wave 2 = one install location plus `install.sh` retirement. Wave 3 = `/mos:update` collapse. Wave 4 = Eureka enable, Class S, the no-drift test. Wave 5 = retire the now-unreachable doctor classes.

Note that D-13 lists Eureka work after the update collapse; the ordering above keeps that. The one deviation worth the planner's attention: **the Class S `await` bug at :180 is a live defect that makes release gates touch the network.** Consider fixing that single line in Wave 1 rather than Wave 4, independently of the L1 split.

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so it is enabled.

### Applicable ASVS categories

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | This phase changes no auth surface. `MINDRIAN_BRAIN_KEY` handling is untouched. |
| V3 Session Management | no | - |
| V4 Access Control | **yes** | The published npm tarball is a PUBLIC artifact. `files` is the access-control boundary. `.env`, `.env.brain.template`, `.mindrian/`, `.planning/`, `mcp-server-brain/` and `cypher/` must all be outside it. release.sh:750's blacklist is the belt; the `files` allowlist is the braces. |
| V5 Input Validation | **yes** | The harness `_schema.json` already fails closed on an unknown key, unknown rung, unknown kind, unknown `applies_to`, or a `runner` that escapes the repo root. The two new policy files inherit that. `npm pack --dry-run --json` output is parsed, so parse defensively. |
| V6 Cryptography | no | Nothing is hashed or signed by this phase's own code. The `archive` fallback's sha256 verification is the platform's, not ours. |
| V12 File and Resource | **yes** | The `doctor --fix` that removes `~/.claude/plugins/mindrian-os` performs a recursive delete of a user directory. Verify, back up, then remove, in that order, and refuse if anything in settings still resolves through it. |
| V14 Configuration | **yes** | The marketplace `source` change is a supply-chain configuration change. An exact version pin is the security-correct form: a dist-tag would let any future publish reach every user without a version bump anywhere in the 5-way record. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status here |
|---------|--------|---------------------|-------------|
| Secrets leaked into a public npm tarball | Information disclosure | Allowlist (`files`), never a denylist; assert the payload contents in a blocking gate | The recommended list is an allowlist; the ceiling runner asserts the absence of `.planning/` and `docs/` on top of it |
| Slopsquatted or hallucinated dependency | Tampering | Registry age plus downloads plus source repo plus `slopcheck` | Zero new packages; five existing ones audited `[OK]` |
| Lifecycle scripts executing on install | Elevation of privilege | The loader's `npm ci --ignore-scripts` | **Partial.** The loader's FIRST install (`Tus`) passes NO `--ignore-scripts`. Our 139-package set has zero lifecycle scripts (measured in 341-FINDINGS); make that an assertion in the ceiling policy rather than a standing assumption. |
| Dependency confusion via a registry override | Spoofing | Omit `registry` from the marketplace entry so the user's default registry is used, or pin it explicitly | D-01's shape omits `registry`. State that as a deliberate choice in the plan. |
| Mutable version reference | Tampering | Exact, immutable version pin | D-01. Published npm versions are immutable, which is also what retires the SHA leg in D-07. |
| Recursive delete of a user directory | Denial of service | Verify-then-back-up-then-remove; refuse on any live reference | The `doctor --fix` design above |
| Command injection through policy args | Injection | `spawnSync('node', [resolved, ...args])`, argv array, never a shell string, args passed verbatim with no interpolation | Already the schema's stated `runner_path_rule`; the two new runners inherit it |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The loader's first `npm install` (`Tus`) has no explicit timeout. No timeout argument is passed at that call site, unlike the dependency install's literal 60,000 ms; the helper's own default could not be resolved in the minified bundle. | Loader Ground Truth F-2 | If a short default exists, a cold registry fetch of the ~51 MB dependency set could time out on a slow link. Mitigation is already in place either way: the SessionStart reconcile hook plus `requireWithHeal`. Worth watching during the D-13 cold-install proof, and worth capturing the loader's own debug log line "Installing npm package ... to cache" with timestamps. |
| A2 | An 8-character Windows username in the MAX_PATH computation. | Loader Ground Truth F-5 | A 40-character username eats 32 characters of the 69-to-95 headroom and still clears. Only a pathological username would breach 260. |
| A3 | Claude Code 2.1.266's loader behavior is representative of what testers run. | Throughout | Loader internals can change between versions. The `npm` source type and the lockfile table are documented, so the SHAPE is stable even if constants move. Re-verify the 60,000 ms constant and the lockfile ordering if a tester reports an install failure on a much newer build. |
| A4 | `lib/brain/curation-batch.cjs`'s `mcp-server-brain/node_modules/neo4j-driver` require is operator-only and never reached from a user command. | Runtime State Inventory | If a user-facing command reaches it, the slim artifact produces a `MODULE_NOT_FOUND` where there used to be a working path. The plan must confirm the caller graph before shipping, not after. |
| A5 | The 231 co-located `*.test.cjs` files shipping in the tarball are harmless. | The `files` Whitelist | They are inert unless executed and they preserve the repo's co-location convention. If a security review objects to shipping test code, the fix is more negation entries, not a redesign. |
| A6 | Desktop and Cowork resolve the plugin through the same loader pipeline as the CLI. | Project Constraints, Tri-Polar | 341-FINDINGS already lists "Desktop/Cowork resolution through the legacy path remains unverified". If they use a different resolution path, the one-install-location work in Wave 2 could strand them. **This is the single most consequential open assumption in the phase and it belongs in front of the navigator before Wave 2, not before Wave 1.** |
| A7 | `npm shrinkwrap` with no arguments produces a shrinkwrap equivalent to the committed `package-lock.json`. | Pattern 1 | Verified only from `npm shrinkwrap --help` ("Lock down dependency versions for publication") on 10.9.8, not executed here, because running it would have written a tracked file. First executor should run it and diff the two files before trusting the step. |
| A8 | The path-4 pre-bake flow (`CLAUDE_CODE_PLUGIN_SEED_DIR`) carries a `node_modules` materialized by the loader's `npm ci` into the baked image. | Answering (f) | If the seed copy predates the dependency install, a pre-baked fleet gets a plugin with no dependencies and no network at runtime. Only matters for the NATO-class deployment; flag it to whoever owns that path. |

---

## Open Questions

1. **Does the loader's `npm install` for the npm source have a timeout?**
   - What we know: the dependency install's timeout is the literal `Hcs = 60000`. The npm-source cache install passes no timeout argument.
   - What is unclear: the exec helper's own default, which is a module-local minified binding.
   - Recommendation: measure it during D-13 step 2 by timing the first cold install on the slowest of the three platforms and reading the loader's `Installing npm package ... to cache` debug line. Do not block Wave 1 on it; the self-heal backstop covers the failure mode either way.

2. **Do Desktop and Cowork resolve the plugin through the same pipeline?**
   - What we know: `.mcp.json` uses `${CLAUDE_PLUGIN_ROOT}`, which the loader sets; the CLI path is fully mapped.
   - What is unclear: whether Desktop and Cowork honor the marketplace loader at all, or read a different location. 341-FINDINGS lists it as unverified and this research did not close it.
   - Recommendation: put it in front of the navigator as a decision gate BEFORE Wave 2 (the one-install-location work), not before Wave 1. Wave 1 is safe either way because it only changes what the artifact contains.

3. **Do release.sh Steps 9.6a and 9.6b (the minisite and website version lockstep) still have live targets?**
   - What we know: MEMORY records `feedback_release_lockstep_npm` and a later entry retiring the minisite in favor of `mindrian-os.com` as the single canonical web surface. Step 9.6a still deploys to `mindrianos-install-site.vercel.app`.
   - What is unclear: whether 9.6a is dead weight that will fail the first post-341 release for an unrelated reason.
   - Recommendation: check before the first release run. Out of this phase's declared scope, but it sits directly in the path of D-13 step 1.

4. **Should `tests/test-release-bump-tag-and-publish-gates.cjs` cases 10 and 11 be fixed here?**
   - What we know: both regex the retired package name `@mindrian_os/install`; both were already red before Phase 310 and were explicitly deferred.
   - What is unclear: whether inheriting two known-red cases inside a phase that is supposed to prove the release train is acceptable.
   - Recommendation: fix them. It is a two-string change and this phase is the one that makes the npm package name load-bearing.

5. **Does `docs/install/PACKAGING-PATHS.md` get updated in this phase?**
   - What we know: it still says path 2 is "Blocked on D-05a" and names the retired package `@mindrian_os/install`. It is the user-facing statement of exactly what this phase delivers.
   - Recommendation: yes, and it is cheap. It also satisfies the CLAUDE.md rule that a handoff must travel through a tracked file, since `.planning/` does not.

---

## Sources

### Primary (HIGH confidence)

- `/home/jsagi/.local/share/claude/versions/2.1.266` - the shipped Claude Code binary, unstripped, JavaScript recovered directly. Functions read: `BYe` (source dispatcher), `Tus` (npm source install), `xje` + `Vwt` + `Hcs` (dependency install and lockfile table), `HK` + `C9` + `m3t` (manifest discovery), `Me` + `Te` + `Ce` (the entry/size ceiling and its single caller class), `Ous` + `yQ` + `$t` (archive download caps), `b7e` + `HRe` (plugin-shaped root markers), `vus` / `aur` / `Cus` / `Aus` (the git paths), plus the presence of `CLAUDE_CODE_PLUGIN_SEED_DIR` and `CLAUDE_CODE_PLUGIN_CACHE_DIR`.
- Local `npm` 10.9.8 - `npm pack --dry-run --json` (nine separate measurements), `npm install --help`, `npm ci --help`, `npm shrinkwrap --help`, `npm config ls -l`.
- This repository at HEAD `c9d8cf91b` - `package.json`, `package-lock.json`, `scripts/release.sh`, `scripts/doctor.cjs`, `scripts/run-harness.cjs`, `data/harness-policies/_schema.json`, `data/harness-policies/gate-shape-declaration.json`, `lib/core/npm-cli-resolve.cjs`, `lib/core/eureka/embedding-spine.cjs`, `lib/core/doctor/class-s-eureka-smoke.cjs`, `lib/core/update-path.cjs`, `lib/core/pitch-feedback-schemas.cjs`, `lib/brain/curation-batch.cjs`, `install.sh`, `tests/run-all-310.sh`, `tests/fixtures/310-release-step-block-hashes.txt`, `tests/test-release-bump-tag-and-publish-gates.cjs`, `docs/install/PACKAGING-PATHS.md`, `.mcp.json`, `.claude-plugin/plugin.json`, `CLAUDE.md` and its four `@include` files.
- `~/mindrian-marketplace/.claude-plugin/marketplace.json`, `~/.claude/plugins/known_marketplaces.json`, `~/.claude/plugins/installed_plugins.json`, `~/.claude/plugins/cache/mindrian-marketplace/mos/`.
- `.planning/phases/341-*/341-CONTEXT.md`, `.planning/phases/341-*/341-FINDINGS.md`, `.planning/phases/342-*/342-FINDINGS.md` - the verbatim Claude Code documentation quotes and the ratified delivery decision. Not re-derived here; the binary reading corroborates every one of them and extends three.
- `slopcheck` 2026-09-09 - 5 packages scanned, 5 OK.

### Secondary (MEDIUM confidence)

- `docs/testers/gary-laben/FEEDBACK.md`, `docs/UI-UX-CONVERGENCE-2026-05-10/04-REVERSE-SALIENT-INSTALL.md` - the historical `install.sh` failure record. Repo-internal, dated, but not independently re-verified.
- Windows MAX_PATH arithmetic - computed from measured path lengths, not executed on Windows.

### Tertiary (LOW confidence)

- The absence of a timeout on the loader's npm-source install (A1). Inferred from the absence of a timeout argument at the call site; the helper's default could not be resolved.
- Desktop and Cowork resolution behavior (A6). Not investigated by this research and still open from 341-FINDINGS.

No general web search was performed, per the phase's grounding rules.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Loader pipeline (F-1 through F-4) | **HIGH** | Read from the shipped binary's own JavaScript, not from documentation prose or training data |
| npm packaging behavior | **HIGH** | Nine `npm pack --dry-run --json` measurements on this machine, including three controlled probes that isolate the exclusion mechanism and the shrinkwrap inclusion rule |
| The recommended `files` list | **HIGH** | Measured end to end; every include and exclude has a named code reference or a named policy behind it |
| release.sh and test breakage | **HIGH** | Step-block count, `exit 1` count and the exact grep pattern all read from the files and counted |
| Windows behavior | **MEDIUM** | Path budget computed from measured lengths; no Windows execution. The loader's Windows path is `npm install` plus a directory copy, which is the same code on every platform |
| Eureka / Class S | **HIGH** | Both sides of the `await` bug read; the L1 path problem found by reading the probe against D-09's target directory |
| `install.sh` retirement | **MEDIUM-HIGH** | Four documented distribution paths, two of them verified against the binary's env-var strings; Desktop and Cowork remain the open question |
| Loader npm-install timeout | **LOW** | See A1 |

**Research date:** 2026-09-09
**Valid until:** 2026-10-09 for the npm packaging facts (stable across npm majors). **Valid until the next Claude Code minor** for the loader constants (60,000 ms, the lockfile table order, `Te`/`Ce`) - re-verify against the installed binary before the first live release if Claude Code has moved past 2.1.266.

*No em-dashes in this file (hyphens only).*
