# Phase 269: Moat Shift -- Install/Update Entitlement Gate - Research

**Researched:** 2026-08-27
**Domain:** Product entitlement / licensing architecture; plugin distribution lifecycle; credential design; doctrine reconciliation
**Confidence:** HIGH on current-state facts (all read from disk or verified live), MEDIUM on the recommended credential option (a navigator decision, not a research verdict)

---

## Summary

This phase has two halves running on two different clocks, and the single most important
job of the research is to keep them apart. The **decision-recording half** (reconciling
`.claude/includes/decisions.md` #1 and #5, reframing `.claude/includes/moat.md`, and
flagging the business-model docs) is fully executable today: every file involved is in
this repo, every current value has been read, and no external dependency blocks it. The
**engineering half** (an actual entitlement check in the install/update path) is blocked,
and blocked harder than the roadmap's "Depends on" line implies. Theo's own Phase 9 is
blocked on Phase 8, which is blocked on Phase 7, which is mid-execution right now
(`stopped_at: Completed 07-02-PLAN.md` of 12 plans). Phases 8 and 9 are both literally
`Plans: TBD (not yet planned)`. The "firmer timeline" the roadmap waits for does not
exist and is at least two unplanned phases away.

The second-most important finding is a structural constraint the roadmap does not
mention and that changes the shape of the engineering half completely: **there is no
enforceable choke point at install time today, and Claude Code does not provide one.**
Verified against the live hooks documentation, Claude Code has no `PluginInstall`,
`PluginUpdate`, `PostInstall`, or plugin-activation hook event of any kind. The `Setup`
event exists but only fires under `--init-only` / `-p --init` / `-p --maintenance` and
explicitly cannot block. Meanwhile `jsagir/mindrian-os-plugin` and
`jsagir/mindrian-marketplace` are both `PUBLIC` (verified live via `gh repo view`) and
`@mindrian_os/cli` publishes to public npm with no auth. So `claude plugin install
mos@mindrian-marketplace` clones public bytes over a path this repo does not control and
cannot hook. An "install gate" therefore cannot mean "refuse to deliver the bytes"
without a distribution change (private repo, private npm, authenticated marketplace); in
practice it can only mean "the plugin refuses to OPERATE until a valid entitlement is
present," enforced at `SessionStart` and at the repo's own `install.sh` / `bin/cli.js`
seams. That is a real, buildable design, but it is a different design from the one the
roadmap's wording suggests, and the planner needs to know that before it writes tasks.

The third finding is good news: the credential plumbing for the recommended answer is
roughly 80 percent already built. Two `mbr_`-prefixed credential shapes already coexist
in the SAME Supabase `brain_api_keys` table, distinguished only by the `plan` column: the
dashboard-issued trial key (`plan: 'free'`, 30-day `expires_at`, `daily_limit: 50`, minted
in `mindrian-website`'s `provisionTrialKey`) and the per-install silent-registration token
(`plan: 'install'`, read-tier ceiling, idempotent per `install_id`, cached at
`~/.mindrian-install.json` mode 0600). The per-install credential the moat shift needs
already exists, already has a documented revocation path, and already has a threat model
on the record (`docs/BRAIN-IDENTITY-DESIGN.md`). What changes under this phase is that
`POST /register` stops minting unconditionally to anyone who POSTs a UUID and starts
requiring proof of an authorized Google identity from `/brain-access`.

**Primary recommendation:** Plan this phase as **two plan families with different
readiness states**. Family D (doctrine, `autonomous: true`, executable now) reconciles
decisions.md #1/#5, reframes moat.md, and files the cross-cutting flags. Family E
(engineering) is planned as **specification-only artifacts** using this repo's existing
`type: out-of-repo-deliverable` precedent plus `checkpoint:human-action gate="blocking"`
gates, so nothing in it is executable until Theo Phase 9 has a date. Do not mint a
requirement ID for Family E engineering this phase.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Doctrine reconciliation (decisions.md, moat.md) | This repo, `.claude/includes/` | docs/ deep-dive files | These are `@include`d into CLAUDE.md; they are the plugin's own constitution surface and live nowhere else |
| Identity minting (who is entitled) | mindrian-website + Supabase | -- | `provisionTrialKey` already owns minting for the dashboard path; Google OAuth is the only identity proof in the system |
| Identity validation (is this token good) | Brain/Theo server (remote) | -- | Validation must be server-side or it is bypassable; `validateViaSupabase` already owns this |
| Entitlement CHECK at install | This repo, `install.sh` + `bin/cli.js` | -- | The only install seams this repo controls; the marketplace path has no hook |
| Entitlement CHECK at update | This repo, `SessionStart` preflight | `bin/cli.js update`, `/mos:update` | `scripts/sessionstart-post-update-preflight.cjs` is the only seam that catches the native `claude plugin update` path |
| Refusal rendering | This repo, `lib/core/refusal-messaging.cjs` | statusline, `/mos:status` | Already the single byte-locked chokepoint for all refusal copy |
| Byte distribution (who can download) | GitHub + npm (public today) | -- | Outside all three repos' code; a visibility change is an operator/account action, not a code task |
| Canonical-domain / session continuity | mindrian-website (`next.config.ts`) | -- | Separate repo; MindrianOS-Plugin plans must not edit files there |

---

## Phase Requirements

**None mapped.** `.planning/REQUIREMENTS.md` (v2.1.0 "Green the Floor") contains zero
references to Phase 269 (`grep -n "269"` returns nothing), and ROADMAP.md's Phase 269
entry reads `**Requirements**: TBD`. Phase 269 also sits outside the v2.1.0 milestone
whose requirements that file scopes.

**Recommendation for the planner:** mint requirement IDs for the DOCTRINE half only this
phase (candidate prefix `MOAT-`, e.g. `MOAT-01` decisions.md #1 reconciled, `MOAT-02`
decisions.md #5 clause added, `MOAT-03` moat.md reframed, `MOAT-04` cross-cutting flags
filed). Do **not** mint requirement IDs for the entitlement-check ENGINEERING. Theo's own
Phase 9 resolution paragraph sets the reciprocal precedent explicitly: "this phase must
not mint a `CUT-` requirement for engineering that belongs in another repo." The same
discipline applies in the other direction -- a requirement ID minted against work that
cannot start creates a permanently-open ledger row.

---

## Project Constraints (from CLAUDE.md)

Binding directives extracted from `./CLAUDE.md` that gate this phase's plans:

| # | Directive | How it binds Phase 269 |
|---|-----------|------------------------|
| C1 | **Workspace guard.** Every commit/git op runs from `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/*` | Any plan task touching install paths must not confuse the install cache with the dev workspace |
| C2 | **Canon Part 8 (graph boundary).** LOCAL user data never egresses to Brain | An entitlement payload must carry only an opaque identity token. `docs/BRAIN-IDENTITY-DESIGN.md` already locks the closed schema `{"install_id": "<UUIDv4>"}` and asserts it via `tests/test-250-silent-registration.cjs` Test 5. Any new field is a Part 8 review item |
| C3 | **Canon Part 11 (invocation constitution / born-wired).** Every invocable surface is born WIRED or EXCLUDED, with a declared `hitl_shape` | If a plan adds a new command (e.g. `/mos:activate`), it must ship `connector:` + `hitl_shape`/`hitl_why` and pass `node scripts/build-connector-registry.cjs --check`. `commands/update.md` is the template: it uses `connector.excluded: true` with a lifecycle-command reason |
| C4 | **Canon Part 7 (reuse before build).** Search the 25 methodology commands first | The entitlement machinery must reuse `resolve-brain-key.cjs`, `refusal-messaging.cjs`, `post-update-activation.cjs`, and `supabase-keys.mjs` rather than adding a second credential resolver. Three independent key guessers were already collapsed into one in Phase 123-07; do not re-fork them |
| C5 | **Tri-Polar rule.** CLI + Desktop + Cowork | An entitlement check that only fires in the CLI `SessionStart` hook leaves Desktop and Cowork ungated. This must be an explicit stated call, not an oversight |
| C6 | **No em-dashes anywhere.** Use hyphens | Applies to every doctrine string this phase writes |
| C7 | **GSD workflow enforcement.** No direct edits outside a GSD workflow | This phase's doctrine edits go through `/gsd-execute-phase`, not ad-hoc Edit calls |
| C8 | **Dev-Research Compositing.** Architecture-touching phases file in BOTH `.planning/phases/` and `~/MindrianRooms/rethinking-mindrianos/research/` | See "Rethinking Room" section below. A trail for the Gaurav finding already exists; this phase's own reasoning needs a cross-linked entry |
| C9 | **Consult ALL relevant grounding sources.** langtalks is one leg, not the whole stool | See "Grounding source selection" in Sources |
| C10 | **Release lockstep (5 gates).** `scripts/release.sh <version>`, never bump by hand | If any engineering ships, the version cut is part of it |

---

## The Phase Boundary: Executable Now vs Blocked

This is the section the planner must read before writing a single task.

### Half 1: DECISION-RECORDING -- executable now

| Artifact | Current state (read 2026-08-27) | Action |
|----------|--------------------------------|--------|
| `.claude/includes/decisions.md` row 1 | "One-command install; the Brain is part of what installs. \| Larry's methodology comes from the Brain and says so; a keyless session gets an honest refusal and a visible path to a key, never an imitation." | Reconcile: the honest refusal moves from query-time to install/update-time |
| `.claude/includes/decisions.md` row 5 | "Brain as remote MCP \| IP never distributed; users get intelligence, not data. The Brain is remote by design, not optional by default; a keyless session gets an honest refusal, never a silent local substitute." | Add a clause noting per-query keys are gone; the "remote by design" half stays true verbatim |
| `.claude/includes/moat.md` (7 lines) | See precision note below | Reframe to name where the paywall sits |
| Cross-cutting flags | Not filed anywhere | File as flags, do not silently edit |

**Precision note the planner needs:** `.claude/includes/moat.md` does **not** contain the
literal string "pay per graph query" (verified: `grep -rn "pay per\|per graph query\|per-query"`
across `.claude/includes/*.md`, `docs/MOAT-MANDATE.md`, `docs/BUSINESS-MODEL-AND-MOAT.md`
returns nothing). The roadmap's phrase is a paraphrase of the *de facto* model, not a
quotation. `moat.md`'s actual text is about WHEN/WHICH/SEQUENCE and "served via MCP, never
distributed" -- which stays true. What the reframe must ADD is an explicit statement of
where the commercial boundary sits, because right now `moat.md` never says. A planner task
written as "replace the phrase X" will fail; write it as "add a boundary clause."

**Cross-cutting flags to file (NOT to edit):**

1. `~/.claude/projects/-home-jsagi/memory/project_mindrianos_business_model.md` -- "Free
   tier = prompt-Larry + Brain MCP; paid = trained Lawrence model." Outside this repo's
   tracked scope. Flag for the human; do not edit from a plan task.
2. **`docs/BUSINESS-MODEL-AND-MOAT.md` -- the roadmap does not name this file and it is
   the single most affected document in the repo.** Its entire tier table is built on
   "Brain access is the paid thing": Free ($0) explicitly lists "What's missing: Brain
   intelligence"; Brain tier is $19/month whose first bullet is "Brain API key"; the
   University tier is priced as "Brain access for all enrolled students." Every one of
   those becomes incoherent the moment Brain/Theo access is unconditional for any
   installed user. This is a 233-line doc with a `status: Draft for review` frontmatter
   -- it can be flagged rather than rewritten, but it must not be left unflagged.
3. `docs/MOAT-MANDATE.md` -- the moat *formula* (WHEN/WHICH/SEQUENCE) survives the shift
   unchanged; the review checklist does not reference payment. Low-risk, but confirm.
4. `LICENSE` (BSL 1.1) -- see the tension flagged under Open Questions Q3.

### Half 2: ENGINEERING -- blocked, must NOT be planned as ready-to-execute

**Verified dependency chain (read from `/home/jsagi/Theo/.planning/ROADMAP.md` and
`/home/jsagi/Theo/.planning/STATE.md`, 2026-08-27):**

| Theo phase | State | Evidence |
|-----------|-------|----------|
| Phase 7 (Schema Extension & PWS-Book Ingestion) | **in execution now** | `Plans: 12 plans in 9 waves`; STATE.md `stopped_at: Completed 07-02-PLAN.md`, `last_activity: 2026-08-27 -- Phase 7 execution started` |
| Phase 8 (Real Brain Ingestion) | **not planned** | `Plans: TBD (not yet planned; blocked on Phase 7's schema landing first)` |
| Phase 9 (Brain-Contract Cutover) | **not planned** | `Plans: TBD (not yet planned; blocked on Phase 8)`; `Depends on: Phase 6, Phase 8` |

So the roadmap's gating condition -- "sequenced after Theo's own Phase 9 gets a firmer
timeline" -- is **not met and is two unplanned phases away**. Theo Phase 7 is 2 of 12 plans
in. Building an entitlement check now means building against an interim cutover state,
which is precisely the throwaway-work risk the roadmap names.

**What IS resolved on the Theo side** (`Theo/.planning/ROADMAP.md`, the "Resolved
2026-08-27" paragraph under Phase 9, read verbatim): `brain_ask` / `brain_query` /
`brain_search` "become keyless and unconditional at cutover for any installed MindrianOS
user -- no per-query API key, no per-tool entitlement check inside Theo." The entitlement
check "moves entirely into MindrianOS-Plugin's own install-and-update flow, which is that
repo's Phase 269 and explicitly not Theo's job to build." Theo "stays remote and is never
bundled," so "only the entitlement CHECK moves, not Theo's own architecture."

**What that paragraph does NOT answer** (and is this phase's own open question): whether
MindrianOS-Plugin's install/update credential is a rename/repurpose of the existing Brain
API key or a wholly new credential type. Research question 1 below maps the option space;
it does not decide it.

---

## Standard Stack

**No new packages.** This phase installs nothing. Verified by inspection: the doctrine half
edits four markdown files; the engineering half, when it eventually runs, reuses machinery
already in-repo (`node:crypto`, `node:fs`, global `fetch`, all Node built-ins per this
repo's "CJS only, node built-ins only, zero npm deps" convention in CLAUDE.md).

### Existing in-repo machinery the engineering half must reuse (Part 7)

| Module | Path | What it already does | Why it is the reuse target |
|--------|------|---------------------|---------------------------|
| Key resolver | `lib/core/resolve-brain-key.cjs` (273 lines) | 4-leg precedence ladder: env -> `~/.mindrian.env` -> cwd `.env` -> `~/.mindrian-install.json`; SEC-02 mode-0600 gate; `Bearer`/`Authorization:` prefix normalization | The ONE chokepoint. Phase 123-07 collapsed three independent guessers into this. Never add a fifth guesser |
| Minting / registration | `lib/core/brain-client.cjs` lines 292-400 | `_tryAutoRegister()`: mints UUIDv4, `POST /register`, caches at mode 0600, once-per-process cap, `MINDRIAN_DISABLE_AUTO_REGISTER` opt-out, honest failure reasons | Owns the minting side by design; the resolver stays a pure read |
| Refusal rendering | `lib/core/refusal-messaging.cjs` | 4 refusal kinds (`no_key`, `unreachable`, `tier_denied`, `not_ready`); byte-locked `DIRECTOR_NOT_AVAILABLE` wire shape; `upgrade_hint: "Request a Brain key at https://mindrian-os.com/brain-access"` | Adding a fifth kind (e.g. `not_entitled`) is the natural extension point. The wire shape is byte-locked, so this is a phase-amendment boundary, exactly like Phase 250-01 was |
| Post-update activation | `scripts/post-update-activation.cjs` | Atomic swap of the active install; writes `~/.mindrian/post-update-restart-pending` touch file | Update-time seam already exists |
| Update preflight | `scripts/sessionstart-post-update-preflight.cjs` | SessionStart hook that reads the touch file and **"refuse[s] Larry load with a red banner"** on version drift | **The precedent for a blocking update-time gate already ships.** An entitlement check is the same shape with a different predicate |
| Server-side validation | `ProblemsWorthSolving-Brain/src/http/supabase-keys.mjs` | `mintInstallToken`, `validateViaSupabase`, `isAdminPlan()`, `tierGate` | Cross-repo. Named for completeness; not this repo's to edit |

---

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages in either half. No
`npm install`, `pip install`, or `cargo add` appears anywhere in the recommended plan
shape. slopcheck was therefore not run; there is nothing for it to check.

---

## Architecture Patterns

### System Architecture Diagram: the gate as it exists today (query-time)

```
  User                    Plugin (local)                    Remote
  ────                    ──────────────                    ──────

  first Brain ask ──►  brain-client.callTool()
                              │
                              ▼
                       resolveBrainKey()  ── 4-leg ladder ──┐
                         1 MINDRIAN_BRAIN_KEY (env)          │
                         2 ~/.mindrian.env                   │
                         3 <cwd>/.env                        │
                         4 ~/.mindrian-install.json          │
                              │                               │
                    ┌─────────┴─────────┐                    │
             found  │                   │  not found         │
                    ▼                   ▼                    │
              use key            _tryAutoRegister()          │
                    │            (once per process)          │
                    │                   │                    │
                    │           POST /register ──────────────┼──►  pws-brain-mcp
                    │           {install_id: UUIDv4}         │      /register
                    │                   │                    │      (UNCONDITIONAL:
                    │            200 {token, tier:"read"}    │       anyone who POSTs
                    │                   │                    │       a UUID gets one)
                    │            write ~/.mindrian-install.json    │
                    │            mode 0600                   │      mintInstallToken()
                    │                   │                    │           │
                    └─────────┬─────────┘                    │           ▼
                              ▼                              │      Supabase
                    Authorization: Bearer <mbr_...>  ────────┼──►  brain_api_keys
                              │                              │      (plan='install')
                    ┌─────────┴─────────┐                    │
              200   │                   │  401/403/429       │      validateViaSupabase()
                    ▼                   ▼                    │      tierGate()
             methodology         refusal-messaging.cjs       │           │
             returned            no_key / tier_denied /      │           ▼
                                 unreachable / not_ready     │      per-query check
                                        │                    │      ◄── THE GATE IS HERE
                                        ▼                    │          TODAY
                                 honest refusal to user      │
```

### Same diagram after the moat shift (target, conceptual)

```
  Website (mindrian-website repo -- SEPARATE, coordinate only)
  ─────────────────────────────────────────────────────────
  /brain-access ──► AuthButton signInWithOAuth({provider:"google"})
                          │
                          ▼
                    /auth/callback exchangeCodeForSession
                          │
                          ▼
                    provisionTrialKey()  ──►  Supabase brain_api_keys
                          │                      ◄── TODAY: mints a query key
                          ▼                          TARGET: mints (or also mints)
                    entitlement credential            the install/update entitlement
                          │
  ────────────────────────┼─────────────────────────────────────────
  Plugin (this repo)      │
                          ▼
     install.sh  ────► CHECK  ──┐
     bin/cli.js install ────────┤
     bin/cli.js update ─────────┼──►  entitlement present + valid?
     SessionStart preflight ────┤              │
     (/plugin install|update    │      ┌───────┴───────┐
      has NO hook -- this is    │  yes │               │ no
      the ONLY seam that        │      ▼               ▼
      catches that path)        │  plugin           refusal-messaging
                                │  operates         (new kind: not_entitled)
                                └──►  ◄── THE GATE MOVES HERE
                          │
  ────────────────────────┼─────────────────────────────────────────
  Theo (Theo repo -- SEPARATE)
                          ▼
     brain_ask / brain_query / brain_search  ──►  KEYLESS + UNCONDITIONAL
                                                  for any installed user
                                                  (Theo Phase 9, resolved 2026-08-27)
```

### Pattern 1: Doctrine reconciliation, not silent edit

**What:** When a Key Decision's *enforcement point* moves but its *principle* survives,
amend the row with the new enforcement point and preserve the principle verbatim.

**When to use:** decisions.md #1 and #5 in this phase.

**Why:** `docs/BRAIN-IDENTITY-DESIGN.md` is the in-repo precedent. Phase 250-04 did not
delete Decision #1; it wrote a standalone design doc that opens by *quoting* the decision
("Decision #1's rewritten form ... stays true only if ...") and then explains what changed
underneath it. That doc also carries the ruling citation, the rejected options (B and C)
with reasons, the threat model, and the revocation path. A plan that just runs a
find-and-replace on decisions.md loses all of that. The pattern is: amend the one-line row,
and file the reasoning in a dated doc that cites the navigator ruling.

**Anti-pattern this avoids:** a decisions.md row whose text no longer matches any code and
whose history is a single unexplained commit diff.

### Pattern 2: The out-of-repo deliverable (this repo's own cross-repo convention)

**What:** When a phase's output must land in a different repo, write a spec file INTO this
repo with `type: out-of-repo-deliverable` frontmatter naming the target repo, and track the
manual application as a CHANGELOG action item.

**Verified precedent:** `.planning/phases/115-owned-emotion-dual-path-first-touch/115-00-PLAN.md`
lines 795-820 emit `docs/copy/115-website-hero.md` with exactly this frontmatter:

```markdown
---
type: out-of-repo-deliverable
phase: 115
target_repo: ~/mindrian-website/
target_url: https://mindrianos-jsagirs-projects.vercel.app
applied_post_merge: pending (manual action in CHANGELOG)
spec_string_source: lib/copy/115-spec-strings.cjs WEBSITE_HERO_TAGLINE
---

> **Out-of-repo:** the website source lives at `~/mindrian-website/` (independent of
> MindrianOS-Plugin). Phase 115 ships the COPY here as a deliverable. The actual edit
> lands in the website repo post-merge per `CHANGELOG.md` action item.
```

**This is the mechanism the planner should use** for anything touching `mindrian-website`.
A Phase 269 PLAN.md must NOT list `/home/jsagi/dev/mindrian-website/website/src/...` in
`files_modified`. It writes a spec file here and names a coordination action.

### Pattern 3: Non-executable plan family via existing GSD markers

**Verified conventions available in this repo** (surveyed across 1,118 PLAN.md files):

| Marker | Usage count / precedent | What it signals |
|--------|------------------------|-----------------|
| `autonomous: false` (frontmatter) | **111 of 1,118 plans** (e.g. `163-01`, `169-00`, `195-06`, `201-03`, `210-06`, `211-04`) | Plan requires human involvement; executor does not run it unattended |
| `<task type="checkpoint:human-action" gate="blocking">` | `246-02:304`, `247-03:146`, `258-06:83`, `261-12:128` | Hard stop; a human must perform an action the machine cannot. Per `~/.claude/gsd-core/references/checkpoints.md`, human-action **still stops even in auto-mode** ("auth gates cannot be automated") |
| `<task type="checkpoint:decision" gate="blocking">` | `265-04:220`, `265-20:116`, `249-03:106` | Hard stop for a choice |
| `type: out-of-repo-deliverable` (task/artifact frontmatter) | `115-00` | Deliverable lands in another repo |
| `type: late-scope` + `wave: late-scope` | `85-10` | Work added after the phase was planned, explicitly not modifying prior scope |
| `type: rollback-procedure` | 1 plan | Procedure artifact, not executable code |

**There is no `[DEFERRED]` or `[BLOCKED]` task-level marker convention in GSD or in this
repo.** Do not invent one. The composable answer that uses only real mechanisms:

```
Family E plan frontmatter:
  autonomous: false
  type: execute
  wave: <a wave number strictly after every Family D wave>
  depends_on: []          # no in-repo dependency -- the block is external

Family E first task:
  <task type="checkpoint:human-action" gate="blocking">
    Blocked on Theo Phase 9 having a planned start date. Verify
    /home/jsagi/Theo/.planning/ROADMAP.md Phase 9 no longer reads
    "Plans: TBD (not yet planned; blocked on Phase 8)" before proceeding.
  </task>
```

The `checkpoint:human-action` gate is load-bearing: `checkpoints.md` states that
`workflow._auto_chain_active` / `auto_advance` auto-approve human-verify and auto-select
decisions, but human-action **still stops**. This repo's config has `auto_advance: false`
today, but the human-action gate is the only one that survives a future flip.

### Anti-Patterns to Avoid

- **Planning the entitlement-check code as executable.** The whole reason this phase exists
  as a two-half phase is that half of it cannot run. A `files_modified` list containing
  `lib/core/entitlement.cjs` is the failure mode.
- **Putting `mindrian-website` file paths in `files_modified`.** Use Pattern 2.
- **Adding a fifth key resolver.** Phase 123-07 collapsed three into one for a documented
  reason (a working HTTP-path Brain still printed a Tier-0 warning because two resolvers
  disagreed). Extend `resolve-brain-key.cjs`, never fork it.
- **Treating "install gate" as "refuse to download."** Both repos are PUBLIC and npm is
  public. See Open Question Q2.
- **Silently editing decisions.md.** The roadmap says "requires reconciling, not silently
  editing" in its own text. Use Pattern 1.
- **Rewriting `docs/BUSINESS-MODEL-AND-MOAT.md` in this phase.** It is a 233-line
  `status: Draft for review` document with a full pricing model. Flag it; a rewrite is its
  own phase and needs the navigator, not a planner.

---

## Research Question 1: Credential Unification -- the actual current mechanism

### What exists today (all verified by reading source)

**Credential shape A: the dashboard-issued Brain API key.**

Minted in `/home/jsagi/dev/mindrian-website/website/src/app/brain-access/actions.ts`,
`provisionTrialKey()`:

```typescript
const apiKey = `mbr_${crypto.randomUUID()}`
const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
await supabase.from("brain_api_keys").insert({
  user_id: user.id,
  email: user.email || "",
  api_key_text: apiKey,
  plan: "free",
  status: "active",
  is_active: true,
  expires_at: expiresAt.toISOString(),
  daily_limit: 50,
  created_by: "self-service",
})
```

- **Issued by:** Google OAuth on `/brain-access`, server-side behind `supabase.auth.getUser()`
- **Idempotency:** `maybeSingle()` on `user_id` -- one key per Google account, returned with
  `existing: true` on repeat
- **Shape:** `mbr_` + UUIDv4
- **Lifecycle fields already in the table:** `expires_at` (30 days), `status`, `plan`,
  `daily_limit` (50), `total_requests`, `grace_ends_at`
- **Stored by the user:** `MINDRIAN_BRAIN_KEY` env var, or `~/.mindrian.env` (chmod 600),
  written by `commands/setup.md` step "Configure Brain" (not by `install.sh` -- see the
  explicit comment at `install.sh:197-202`)
- **Validated:** server-side per request via `validateViaSupabase` in the Brain repo

**Credential shape B: the per-install silent-registration token.**

Minted by `POST /register` on `pws-brain-mcp.onrender.com`, contract documented in
`docs/BRAIN-IDENTITY-DESIGN.md`:

- **Issued by:** nobody -- `POST {"install_id": "<UUIDv4>"}` with **no authentication at all**
  ("Unauthenticated by design. It mints credentials, so it cannot itself require one.")
- **Idempotency:** per `install_id`, keyed on the existing generic `user_id` column, scoped
  by `plan='install'` so it cannot collide with a dashboard row
- **Shape:** the doc says `200 {"token": "<mbr_-prefixed opaque string>", "tier": "read"}`
- **Ceiling:** `plan: 'install'` never classifies as admin via `isAdminPlan()`; `tierGate`
  refuses write tools with `403 MoatViolation`
- **Rate limit:** separate `registerRateLimit` bucket, default 5/window/socket address
- **Stored:** `~/.mindrian-install.json` mode 0600, `{install_id, token, minted_at}`
- **Opt-out:** `MINDRIAN_DISABLE_AUTO_REGISTER=1`
- **Revocation:** flip one `brain_api_keys` row's `status` to `'revoked'`

**They share one table.** Both are `mbr_`-prefixed rows in Supabase `brain_api_keys`,
distinguished only by the `plan` column value. The unification question is therefore not
"can these be one credential" -- structurally they already are one credential type with two
issuance paths. The real question is which issuance path survives and what authorizes it.

### The three options, grounded in that current state

| # | Option | What changes | Pros | Cons |
|---|--------|--------------|------|------|
| **A** | **Replace outright.** Retire the dashboard trial key. `/brain-access` Google-auth issues an install/update entitlement credential instead of a Brain API key. | `provisionTrialKey` renamed/repurposed; `MINDRIAN_BRAIN_KEY` env var name becomes a misnomer; `commands/setup.md` brain-key ceremony retired | Conceptually cleanest; one credential, one purpose; the `mbr_` prefix and Supabase schema survive unchanged | Breaks every existing keyed user's mental model and every doc string. `refusal-messaging.cjs`'s byte-locked `reason: "MINDRIAN_BRAIN_KEY not set"` is a wire-contract change. `commands/setup.md`, `bin/cli.js:206-208`, `docs/install/BRAIN-SETUP.md` all need rewrites |
| **B** | **Unify: one credential, two authorized uses.** Keep the `brain_api_keys` row shape and the `MINDRIAN_BRAIN_KEY` name. Stop checking it per-query (Theo goes keyless). Start checking it per-install/update. | Only the CHECK LOCATION moves; the credential itself is untouched | Smallest blast radius; zero schema change; existing keyed users unaffected; matches the roadmap's own "two authorized uses" phrasing | Leaves `expires_at` / `daily_limit` / `total_requests` columns as dead weight designed for per-query metering. Semantically muddy: a variable named `BRAIN_KEY` that no longer gates Brain access |
| **C** | **Promote the install token (RECOMMENDED as the research finding).** `~/.mindrian-install.json` becomes THE entitlement credential. `POST /register` stops being unconditional and starts requiring proof of an authorized Google identity (the dashboard key, or a short-lived auth code from `/brain-access`). The dashboard key demotes to a *seed* that authorizes registration, not a per-query credential. | `/register`'s auth posture; `/brain-access`'s output; the plugin's install/update seams gain a check | **~80% of the plumbing already exists**: per-install identity, idempotency, mode-0600 storage, revocation path, threat model, opt-out contract, and rate limiting are all built and documented. Per-install granularity is exactly what an install/update gate needs (revoke one machine, not one person). `docs/BRAIN-IDENTITY-DESIGN.md` already names telemetry attribution as a property this affords | `POST /register` becoming authenticated inverts its documented "Unauthenticated by design" contract -- that doc needs a formal amendment, not a quiet edit. Requires coordinated changes in three repos |

**Why C:** the phase goal is "the entitlement gate moves to installing and updating
MindrianOS itself." An install/update gate wants a *per-install* credential, because the
thing being gated is an install. That credential already exists, already has a revocation
story, and already has a threat model on the record. Options A and B both gate an install
with a *per-person* credential, which means one leaked key entitles unlimited installs --
exactly the failure mode Option B (embedded HMAC key) was rejected for in SEED-011.

**This is a research finding, not a decision.** ROADMAP.md says explicitly: "Whether the
install/update key REPLACES the Brain key outright or the two become one credential with
two authorized uses is a decision for this phase's own planning, not decided here." The
planner should surface this as a `checkpoint:decision gate="blocking"` with these three
options, not pre-select C.

---

## Research Question 2: The install/update code path today

### `install.sh` (367 lines, root of repo)

**Does it check anything?** No entitlement of any kind. Verified end to end. Its steps:

| Step | Line | What it does |
|------|------|--------------|
| Windows long-path preflight | 137 | `git config --global core.longpaths true` on MINGW/MSYS/CYGWIN |
| git + node prereq check | 139-156 | Node 18+ floor (note: CLAUDE.md states the real floor is 22.16.0 -- this script's check is stale) |
| Clone or `git pull` | 158-176 | `git clone https://github.com/jsagir/mindrian-os-plugin.git` -- **public, unauthenticated** |
| Install receipt init | 181-183 | `~/.claude/plugins/mindrian-os/.install-receipt.json` |
| `npm install` | 187 | |
| `register_statusline()` | 218 | Writes `~/.claude/settings.json` `statusLine` |
| Register commands / skills / agents | 222-290 | symlink-or-copy into `~/.claude/{commands/mos,skills,agents}` |
| Configure hooks | 296-343 | Writes `settings.hooks.SessionStart` + `settings.env.MINDRIAN_OS_ROOT` |
| Receipt done | 367 | Stamps `completed_at` |

**Where an entitlement check would plug in:** after the prereq check (line 156) and
**before** the clone (line 158) is the only place where a refusal costs nothing. After the
clone, the bytes are already on disk and the "gate" is theatre. Note also lines 197-202,
an explicit standing comment: install.sh does **not** write `~/.mindrian.env`; if it ever
does, it must `chmod 600` immediately or `resolve-brain-key.cjs`'s SEC-02 gate refuses the
key. Any entitlement work that writes a credential from install.sh inherits that rule.

### `bin/cli.js` (219 lines, `npx @mindrian_os/cli`)

`package.json` bins: `mindrian-os` and `cli`, both -> `bin/cli.js`. Package name
`@mindrian_os/cli`, version `2.0.0-beta.12`.

| Subcommand | What it does | Entitlement check today |
|-----------|--------------|------------------------|
| `install` (default; bare flags also mean install) | `claude plugin marketplace add jsagir/mindrian-marketplace` -> `marketplace update` -> `claude plugin install mos@mindrian-marketplace` -> `claude plugin update` unless `--version` pinned | **None.** The Brain key is a *printed hint only*, lines 206-208. The header comment says it outright: "The Brain key stays a printed hint -- writing it to the environment is the one side effect left to you" |
| `doctor` | resolves plugin root, spawns `node <root>/scripts/doctor.cjs` | None |
| `update` | dev clone (`MINDRIAN_OS_ROOT` set, or root has `.git` + `install.sh`) -> `git pull --ff-only` + `bash install.sh`. Marketplace -> `claude plugin marketplace update` + `claude plugin update mos@mindrian-marketplace` | None |

**Where a check would plug in:** `requireClaudeCli()` (line 101) is the existing preflight
shape -- returns false and prints an actionable message. An `requireEntitlement()` sibling
called at the same point in `install` and `update` is the obvious seam and matches the file's
existing style (`process.argv` switch-case, zero deps, node built-ins only).

### The `/plugin update` flow -- THE CRITICAL FINDING

**Claude Code has no plugin lifecycle hook.** Verified against the live documentation at
`https://code.claude.com/docs/en/hooks` (2026-08-27). The complete hook event list is:

```
SessionStart, Setup, UserPromptSubmit, UserPromptExpansion, PreToolUse,
PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure,
PostToolBatch, Notification, MessageDisplay, SubagentStart, SubagentStop,
TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle,
InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged,
WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, Elicitation,
ElicitationResult, SessionEnd
```

There is no `PluginInstall`, `PluginUpdate`, `PluginLoad`, `PostInstall`, or
`PluginActivation`. Plugins define hooks in `hooks/hooks.json` and those merge into the
user's hooks when the plugin is enabled, but **nothing fires when the plugin itself is
installed, updated, or activated.**

The `Setup` event is a false lead. It fires only "when you start Claude Code with
`--init-only`, or with `--init` or `--maintenance` in `-p` mode. For one-time preparation
in CI or scripts," its matchers are `init` and `maintenance`, and per the exit-code-2 table
it **cannot block** ("Shows stderr to user only"). It is not the plugin-activation seam.

**Consequence:** `claude plugin install mos@mindrian-marketplace` and `/plugin update` --
the *documented, recommended* install and update path in `.claude/includes/release-process.md`
-- are completely unhookable. The only seam that catches them is the **next `SessionStart`**.

**The precedent for exactly that already ships.** `scripts/sessionstart-post-update-preflight.cjs`
is registered in `hooks/hooks.json` as a `SessionStart` hook, ordered after
`sessionstart-npm-reconcile` and **before Larry-load**, and its own header states: "if the
wire disagrees with the version-of-record (package.json), we **refuse Larry load with a red
banner** that points at the recovery path." It also carries `detectStaleRegistry()`, added
Phase 7 F8 2026-07-02, which compares the session's loaded version against
`installed_plugins.json` and surfaces a restart cue. That file is the template for an
entitlement preflight: same registration point, same blocking posture, different predicate.

`scripts/post-update-activation.cjs` is the sibling seam: it performs the atomic swap of
the active install and writes the `~/.mindrian/post-update-restart-pending` touch file that
the preflight reads. An update-time entitlement check has a natural home here too.

Note the Tri-Polar gap (C5): `SessionStart` hooks fire in Claude Code CLI. Desktop and
Cowork do not run them the same way. An entitlement gate wired only into SessionStart
gates one of three surfaces. This must be an explicit stated call.

### `scripts/release.sh` (1,440 lines) -- the distribution side

**No entitlement or licensing concept anywhere.** `grep -n -i "brain\|key\|licen\|entitle"`
returns only: comments noting the version-consistency check reads local files with "zero
Brain / network" (lines 283, 308), vendored `node_modules` rationale for the bundled Brain
shim (581-584), and the npm-pack payload allowlist gate (693-712) whose failure message is
"Publishing this would leak the entire repo (including Brain-key code) into the public npm
tarball."

That last line is the tell: **the release pipeline's only security posture is "do not leak
private paths into a public tarball."** Step 9.5 (`npm publish --tag "$NPM_TAG"`, line 729,
then promote to `@latest`) publishes publicly with no access restriction. The five release
gates are version-consistency gates (CHANGELOG, plugin.json, package.json, git tag,
marketplace.json `source.ref`), not entitlement gates.

### Distribution reality (verified live, 2026-08-27)

```
gh repo view jsagir/mindrian-os-plugin  -> {"visibility":"PUBLIC"}
gh repo view jsagir/mindrian-marketplace -> {"visibility":"PUBLIC"}
```

All three install paths are public and unauthenticated:

1. `claude plugin install mos@mindrian-marketplace` -- public marketplace repo pinned to a
   public git tag. Unhookable.
2. `npx @mindrian_os/cli` -- public npm package.
3. `curl -sL .../install.sh | bash` -- public raw GitHub, clones a public repo.

**Plus: already-published artifacts are immutable.** Every npm version already on the
registry and every git tag already pushed remains installable forever with no credential.
Any gate this phase builds is **prospective only** and cannot retroactively gate existing
releases.

### Related docs read

- `docs/INSTALL-LIFECYCLE-HARNESS.md` (134 lines) -- spec for the install-state record,
  deployment-surface manifest, doctor drift classes, `mindrian-os doctor --acceptance`, and
  release.sh's version ownership. Its section "3. `doctor` drift classes = the exhaustive
  enumeration of how the lifecycle breaks" is the natural home for an entitlement drift
  class (a new class letter) if the engineering half ever runs.
- `docs/install-cache-family-premortem.md` (138 lines) -- the install-cache failure family;
  `post-update-activation.cjs` closes case 7.
- `docs/autopsies/2026-04-13-wrong-workspace-incident.md` -- the workspace guard's origin;
  adjacent install-cache context. Also `2026-04-28-install-cache-drift-incident.md`,
  `2026-05-06-install-dir-missing-incident.md`, `2026-05-09-gary-laben-install-failure.md`
  in the same directory, all install-lifecycle failure records.

---

## Research Question 3: mindrian-website auth code, actual state

All four files read in full from `/home/jsagi/dev/mindrian-website/`.

### `website/src/app/brain-access/page.tsx` (16 lines)

Server component. `createServerClient()` -> `supabase.auth.getUser()`. If `user`, renders
`<BrainDashboard user={{id, email}}/>`; else `<BrainPublicPage/>`. No key logic here.

### `website/src/components/brain/AuthButton.tsx` (122 lines)

```typescript
const supabase = createBrowserClient();
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: window.location.origin + "/auth/callback" },
});
```

**`window.location.origin`** -- whatever origin the browser is currently sitting on. Also
exports `SignOutButton` (`supabase.auth.signOut()` + `window.location.reload()`).

### `website/src/app/auth/callback/route.ts` (17 lines, complete)

```typescript
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  if (code) {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/brain-access`)
  }
  return NextResponse.redirect(`${origin}/brain-access?error=auth_failed`)
}
```

The only `?code=` consumer in the site. Uses request-derived `origin` for the redirect --
no canonical pin.

### Does a Brain API key get minted and handed back post-auth?

**Yes, and automatically.** `getDashboardData()` in `actions.ts` runs server-side behind
`getUser()`, selects the user's `brain_api_keys` row, and **if none exists, calls
`provisionTrialKey()` inline**. So the moment a Google sign-in completes and the dashboard
renders, a `mbr_`-prefixed 30-day / 50-per-day trial key exists and is displayed. It also
calls `supabase.rpc("get_usage_stats", {p_key_id: key.id})` for usage telemetry. There is
also `submitUpgradeWaitlist(email)` writing to `brain_access_requests` with `type: "upgrade"`.

**Planning consequence:** the "install page's existing Google-auth flow is repurposed"
mechanism in the roadmap is a small delta on this function, not a new flow. `provisionTrialKey`
is the single mint site. Whatever the entitlement credential turns out to be, it is issued
there or alongside it.

### `website/next.config.ts` -- the canonical-domain gap, CONFIRMED by exact read

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/how-it-works", destination: "/docs", permanent: true },
      { source: "/how-it-works/:path*", destination: "/docs", permanent: true },
    ];
  },
};
export default nextConfig;
```

**14 lines total.** The only redirects are `/how-it-works` -> `/docs`. There is **no**
canonical-domain redirect between `mindrian-os.com` and
`mindrianos-jsagirs-projects.vercel.app`, and no `NEXT_PUBLIC_SITE_URL` pin in any of the
auth files. Confirmed exactly as the session note stated.

**Why this produces Gaurav's double sign-in:** `AuthButton` sends `redirectTo:
window.location.origin + "/auth/callback"`, and `route.ts` redirects back to
`${origin}/brain-access`. If the user starts on `mindrian-os.com` and any hop lands on the
raw Vercel alias (or the reverse), the `?code=` is exchanged on origin X and the session
cookie is set for origin X, while `/brain-access` renders on origin Y with no cookie ->
`getUser()` returns null -> `BrainPublicPage` -> a second Google sign-in. Two identity
checks stacked back to back with nothing bridging the session across the origin hop.

### The RCA-persistence gap

Confirmed: `find` across both repos' `.planning/debug/` finds no file for this. The finding
is written down in two places, neither of which is an RCA:

1. `docs/testers/gaurav-thorat/FEEDBACK.md` (tracked in this repo), 2026-08-25 entry,
   which root-causes it at the code level and names the `next.config.ts` gap explicitly.
2. `~/MindrianRooms/rethinking-mindrianos/research/2026-08-26-trial-install-testimonial/2026-08-26-trial-install-testimonial.md`
   (the research trail).

Per CLAUDE.md's QA/RCA section, a NEW FAILURE warrants `.planning/debug/<slug>.md` at the
`docs/RCA-TEMPLATE.md` standard so `/gsd:debug <slug>` can resume it. **Flag only** -- the
roadmap does not scope the fix to this phase, and the research trail explicitly says
"Deliberately not acted on yet ... should wait until after that swap lands."

### Also live and open, from the same FEEDBACK.md entry

**A Brain API key is currently compromised and unrotated.** `mbr_50147d1c-e4ad-4564-8ba6-6c7321001384`
was printed unmasked in `MindrianOS-Installation-Report-Macos.pdf`, which sits in an email
thread with 2+ recipients. Rotation is listed as an open follow-up, "NOT rotated yet,
pending his call." This intersects Phase 269 directly: any credential-model change is the
moment to resolve it, and it is a live security item independent of the phase.

---

## Research Question 4: Build-vs-defer split -- the mechanism names

Answered in **Pattern 3** above, with counts. Summary for quick reference:

- **Real mechanisms that exist:** `autonomous: false` (frontmatter, 111 uses in this repo),
  `<task type="checkpoint:human-action" gate="blocking">` (4 recent uses),
  `<task type="checkpoint:decision" gate="blocking">` (3 recent uses),
  `type: out-of-repo-deliverable` (1 use, `115-00`), `type: late-scope` + `wave: late-scope`
  (1 use, `85-10`), `type: rollback-procedure` (1 use).
- **Mechanisms that do NOT exist -- do not invent:** there is no `[DEFERRED]` marker, no
  `[BLOCKED]` marker, and no `blocked_on:` frontmatter field in GSD core references or in
  any of this repo's 1,118 PLAN.md files.
- **The composition to use:** separate plan family + `autonomous: false` + a leading
  `checkpoint:human-action gate="blocking"` naming the external precondition. Per
  `~/.claude/gsd-core/references/checkpoints.md`, `human-action` is the only checkpoint kind
  that still stops when auto-mode is on ("auth gates cannot be automated").
- **Config context:** `.planning/config.json` has `mode: "yolo"`, `granularity: "fine"`,
  `auto_advance: false`, `_auto_chain_active: false`, `skip_discuss: true`,
  `nyquist_validation: true`, `plan_check: true`, `verifier: true`. `skip_discuss: true`
  means no CONTEXT.md will exist for this phase (confirmed: the phase directory contains
  only `.gitkeep`), so RESEARCH.md is the planner's sole upstream input.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| "Where is the credential on this machine?" | A new resolver, or an inline `fs.existsSync` check in `install.sh` | `lib/core/resolve-brain-key.cjs` (extend the ladder) | Phase 123-07 collapsed three independent guessers into this one for a documented reason: a working Brain still printed a Tier-0 warning because two guessers disagreed. Also carries the SEC-02 mode-0600 gate and `Bearer`/`Authorization:` prefix normalization (which fixed a real 401 from a double-Bearer env var) |
| Refusal copy for a missing entitlement | New message strings in install.sh or cli.js | `lib/core/refusal-messaging.cjs` (add a fifth kind) | Byte-locked single chokepoint; every surface reads the same bytes. The header explicitly names the module a phase-amendment boundary, so extension is the sanctioned path |
| Update-time drift detection | A new version comparator | `scripts/sessionstart-post-update-preflight.cjs` + `scripts/post-update-activation.cjs` | Already refuses Larry load on drift; already has the touch-file protocol; already has `detectStaleRegistry()` |
| Per-install identity + revocation | A new token scheme | `POST /register` + `~/.mindrian-install.json` (Brain repo `mintInstallToken`) | Already idempotent, rate-limited, tier-ceilinged, mode-0600, revocable per row, threat-modelled |
| Token minting / storage crypto | Custom HMAC, custom signing | Supabase + `crypto.randomUUID()` (the existing shape) | SEED-011 Option B (embedded HMAC key) was formally **rejected**: extractable from shipped CJS by design, rotation binds to the release cycle, no per-install identity. Do not resurrect it |
| Google OAuth | Any custom auth | Supabase `signInWithOAuth({provider:"google"})` (already live in `AuthButton.tsx`) | Working in production; the roadmap's mechanism explicitly reuses it |
| Cross-repo file edits | Listing another repo's paths in `files_modified` | `type: out-of-repo-deliverable` spec file + CHANGELOG action item | This repo's own convention, `115-00-PLAN.md` |

**Key insight:** almost nothing in the engineering half is greenfield. The moat shift is
mostly a *relocation* of checks that already exist, plus one genuinely new decision (what
authorizes a mint). A plan that builds new primitives is a plan that has not read
`docs/BRAIN-IDENTITY-DESIGN.md`.

---

## Runtime State Inventory

This phase changes doctrine now and (later) an entitlement model. Both have runtime state
beyond files in the repo.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | Supabase `brain_api_keys` table holds live rows of BOTH credential shapes: `plan='free'` dashboard trial keys (30-day `expires_at`, `daily_limit` 50, `total_requests`, `grace_ends_at`, `created_by='self-service'`) and `plan='install'` registration tokens (idempotency keyed on the generic `user_id` column). Plus `brain_access_requests` (upgrade waitlist). **Plus one compromised live key**: `mbr_50147d1c-e4ad-4564-8ba6-6c7321001384`, broadcast by email, rotation pending | Data migration decision, NOT just a code edit. Existing `plan='free'` rows carry per-query metering fields that become meaningless under the new model. Separately: rotate the compromised key (independent of this phase, but this phase is the natural moment) |
| **Live service config** | (1) Render `pws-brain-mcp`: `BRAIN_HTTP_REGISTER_RATE_WINDOW_MS`, `BRAIN_HTTP_REGISTER_RATE_MAX`, Supabase URL/keys, `BRAIN_HTTP_ADMIN` -- none in this repo's git. (2) Vercel `mindrian-website`: custom domain `mindrian-os.com` + raw alias `mindrianos-jsagirs-projects.vercel.app`, no canonical redirect configured at either the Vercel or Next layer. (3) npm dist-tags on `@mindrian_os/cli` (`@latest` promotion happens in release.sh step 9.5). (4) `jsagir/mindrian-marketplace` `.claude-plugin/marketplace.json` `source.ref` pin. (5) GitHub repo visibility (both PUBLIC) | All operator/dashboard actions, not code edits. If the model change requires private distribution, items (3), (4), (5) are the levers and all three are outside any repo's code |
| **OS-registered state** | Written by `install.sh` into `~/.claude/settings.json`: `statusLine` block (`bash "<INSTALL_DIR>/scripts/statusline-mos"`), a `SessionStart` hook entry with `_source: 'mindrian-os'` and matcher `startup\|clear\|compact`, `agent: 'larry-extended'`, and `env.MINDRIAN_OS_ROOT`. Plus `~/.claude/plugins/installed_plugins.json` (Claude Code owned), `~/.claude/plugins/mindrian-os/.install-receipt.json`, `~/.mindrian/post-update-restart-pending` touch file | An entitlement preflight registered as a SessionStart hook joins this set and must be idempotent the way `register_statusline()` is (it checks `cur.command !== want.command` before writing) |
| **Secrets / env vars** | `MINDRIAN_BRAIN_KEY` (env, `~/.mindrian.env` chmod 600, `<cwd>/.env`), `~/.mindrian-install.json` (mode 0600), `MINDRIAN_DISABLE_AUTO_REGISTER`, `MINDRIAN_BRAIN_URL`, `BRAIN_TOOL_MATCHER`, `MINDRIAN_OS_ROOT`. Also `commands/setup.md` writes `.mcp.json` with `Authorization: Bearer {brain_key}` for the `mindrian-brain` server | Option A (rename) breaks every one of these by name across `commands/setup.md`, `bin/cli.js:206-208`, `docs/install/BRAIN-SETUP.md`, `refusal-messaging.cjs`'s byte-locked `reason` string, and every user's existing `~/.mindrian.env`. Option B/C keep the names. This is the strongest practical argument against Option A |
| **Build artifacts / installed packages** | `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/` (the marketplace cache), `~/.claude/plugins/mindrian-os/` (the active install, atomically swapped by `post-update-activation.cjs`), published npm tarballs for every prior `@mindrian_os/cli` version, and every pushed git tag | **Immutable and ungatable.** Already-published npm versions and already-pushed tags stay installable forever with no credential. Any gate is prospective only. State this explicitly in the plan so nobody expects retroactive coverage |

---

## Common Pitfalls

### Pitfall 1: Planning the entitlement check as executable work

**What goes wrong:** the planner reads "Move the Brain/Theo access gate off per-query
checks" as a build instruction and emits plans with `lib/core/entitlement.cjs` in
`files_modified`.
**Why it happens:** the phase goal reads like an engineering goal; the blocking condition
is buried in the `Depends on` field.
**How to avoid:** two plan families, Family E `autonomous: false` behind a
`checkpoint:human-action`.
**Warning sign:** any `files_modified` entry under `lib/`, `bin/`, or `scripts/` in a
Phase 269 plan.

### Pitfall 2: Treating "install gate" as "refuse to deliver the bytes"

**What goes wrong:** a plan assumes the install can be blocked, then discovers the repo is
public, npm is public, and `claude plugin install` has no hook.
**Why it happens:** "requires a valid key to install" naturally reads as download gating.
**How to avoid:** name the enforcement point explicitly in the plan: activation-time
refusal at `SessionStart` + the repo's own `install.sh` / `bin/cli.js` preflights, with the
BSL license as the legal backstop for the bypassable client-side portion.
**Warning sign:** any task phrased as "prevent unauthorized download."

### Pitfall 3: Cross-repo file paths in `files_modified`

**What goes wrong:** a MindrianOS-Plugin PLAN.md lists
`/home/jsagi/dev/mindrian-website/website/src/...`. The executor either edits another
repo's working tree outside its GSD state, or fails.
**How to avoid:** Pattern 2 (`type: out-of-repo-deliverable`).
**Warning sign:** any absolute path outside `/home/jsagi/dev/MindrianOS-Plugin/`.

### Pitfall 4: Find-and-replace on a string that does not exist

**What goes wrong:** a task says "replace 'pay per graph query' in moat.md." That string is
not in moat.md, not in MOAT-MANDATE.md, and not in BUSINESS-MODEL-AND-MOAT.md.
**How to avoid:** write the doctrine tasks as "add clause X" / "amend row N to read Y,"
quoting the current text verbatim (supplied in this document) so verification can diff.

### Pitfall 5: Breaking the byte-locked refusal wire shape

**What goes wrong:** an entitlement refusal is added by editing
`refusal-messaging.cjs`'s existing values. The module header states the
`DIRECTOR_NOT_AVAILABLE` shape, the five sentinel keys, and `reason: 'MINDRIAN_BRAIN_KEY
not set'` are byte-locked, and that value changes require an explicit phase amendment (Phase
250-01 was one).
**How to avoid:** add a new refusal kind alongside the existing four; do not mutate them.
Any mutation is a declared phase amendment with its own record.

### Pitfall 6: Forgetting Tri-Polar

**What goes wrong:** the gate wires into `SessionStart` and works perfectly in Claude Code
CLI while Desktop and Cowork stay ungated.
**How to avoid:** CLAUDE.md's Tri-Polar rule requires evaluating all three surfaces and
treating a skip as a deliberate stated call. Every entitlement task needs a three-surface
line.

### Pitfall 7: Editing personal memory from a plan task

**What goes wrong:** a task edits `~/.claude/projects/-home-jsagi/memory/project_mindrianos_business_model.md`.
That is outside the repo, outside git, and outside the phase's tracked scope.
**How to avoid:** file it as a flag in the phase output for the human. The roadmap itself
only says "needs revisiting."

### Pitfall 8: Assuming the graph is a usable research source here

**What goes wrong:** a planner queries `.planning/graphs/graph.json` for context.
**Verified:** `graphify status` reports `stale: true`, `age_hours: 831` (34.6 days),
`commits_behind: 978`, built at commit `861fddb` vs current `0d8ddf4`. Every Phase 250-269
artifact postdates the build. Treat any graph relationship as approximate at best; grep is
authoritative for this phase.

---

## Code Examples

Exact current-state anchors the planner can quote in verification steps.

### The two decisions.md rows, verbatim (for diff-based verification)

```markdown
| 1 | One-command install; the Brain is part of what installs. | Larry's methodology comes from the Brain and says so; a keyless session gets an honest refusal and a visible path to a key, never an imitation. |
| 5 | Brain as remote MCP | IP never distributed; users get intelligence, not data. The Brain is remote by design, not optional by default; a keyless session gets an honest refusal, never a silent local substitute. |
```

### moat.md, complete (7 lines)

```markdown
# The Moat

Prompts can be copied. The graph that knows WHEN to use WHICH prompt, in WHAT SEQUENCE, calibrated by REAL teaching data, is the moat. Larry's Brain (teaching graph, grading intelligence, mode-engine calibration, curriculum web) is served via MCP, never distributed.

MWP deepening mandate: every feature must deepen the Mindrian Workspace Protocol moat (the 7 layers + edge vocabulary + Brain IP + teaching calibration), not just add surface area.

Deep dive: docs/MOAT-MANDATE.md (review process, what CAN vs CANNOT be copied) and docs/MWP-SPECIFICATION.md (the 7-layer protocol + edge schemas).
```

### The preflight-refusal pattern (the shape an entitlement gate would take)

```javascript
// Source: scripts/sessionstart-post-update-preflight.cjs (module header, verbatim)
// "On the NEXT session, this preflight reads the touch-file + verifies that
//  the now-live MCP server actually serves the new version. If the wire
//  disagrees with the version-of-record (package.json), we refuse Larry load
//  with a red banner that points at the recovery path."
//
// Registered in hooks/hooks.json as a SessionStart hook, ordered AFTER
// sessionstart-npm-reconcile but BEFORE Larry-load.
//
// Defensive rule that MUST be preserved by any sibling:
//   NEVER blocks the hook chain on internal error; touch-file absent -> exit 0 silently.
```

### The cli.js preflight shape (the seam for an install-time check)

```javascript
// Source: bin/cli.js:101-110 (verbatim)
function requireClaudeCli() {
  const check = spawnSync('claude', ['--version'], { stdio: 'ignore', shell: isWindows });
  if (ok(check)) return true;
  console.error('Claude Code is not installed (no `claude` command on your PATH).');
  console.error('Install it first:');
  console.error('  npm install -g @anthropic-ai/claude-code');
  console.error('Then re-run:');
  console.error('  npx @mindrian_os/cli');
  return false;
}
// An entitlement preflight is this shape: boolean return, actionable stderr,
// called at the top of both `install` and `update`.
```

### The current post-install Brain-key hint (what changes under the new model)

```javascript
// Source: bin/cli.js:206-208 (verbatim) -- today's entire "key ceremony" from the CLI
console.log('Optional -- connect the Brain for enriched intelligence:');
console.log('  inside Claude Code:  /mos:setup   (choose "Configure Brain", paste your key)');
console.log('  or set it directly:  export MINDRIAN_BRAIN_KEY="<your-key>"   (or add it to ~/.claude/.env)');
```

Note the word **"Optional"**. Under the moat shift this becomes non-optional and moves
BEFORE the install, not after it. That single word is a good verification anchor.

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|--------------|------------------|--------------|---------------------|
| Manual Brain key required for every install | Silent per-install registration (`POST /register`) with manual key as override | Phase 250-04, 2026-08-10 | The per-install credential this phase needs already exists |
| Tier-0 graceful degradation (keyless serves reduced methodology) | Honesty rail: typed refusal, four kinds, no silent substitute | Phase 250-01 (HONEST-01) | Decision #1's "honest refusal" language dates from here; moving its enforcement point is an amendment to a recent, deliberate design |
| `tier0-messaging.cjs` | `refusal-messaging.cjs` (git mv, wire contract byte-identical) | Phase 252-01 (SWEEP-01) | Use the current filename |
| Neo4j Aura + Pinecone | Memgraph + local e5 embeddings, Pinecone retired | 2026-07-22 | `docs/BUSINESS-MODEL-AND-MOAT.md`'s "23K Neo4j nodes + 12K Pinecone embeddings" is stale on top of being business-model-stale |
| Brain serves methodology, gated per query | Theo replaces the Brain; `brain_ask`/`brain_query`/`brain_search` keyless and unconditional | Theo Phase 9, resolved 2026-08-27, **not yet built** | This is the change this phase responds to |

**Deprecated / outdated in this phase's blast radius:**

- `install.sh:150` Node 18 floor. CLAUDE.md states the real floor is Node >= 22.16.0
  (`node:sqlite` `timeout` option). Not this phase's job, but any install.sh task touching
  the preflight block will sit next to it.
- `commands/setup.md:170`: "Do you have a Brain API key? If not, request one at
  mindrian-os.com/brain-access -- you'll get it within 24 hours." The 24-hour turnaround is
  already wrong: `provisionTrialKey` mints instantly on Google sign-in. This copy is stale
  *today* and becomes doubly stale under the moat shift.
- `refusal-messaging.cjs` `upgrade_hint: "Request a Brain key at
  https://mindrian-os.com/brain-access"` -- the URL survives, the noun ("Brain key") may not.

---

## Rethinking Room (Dev-Research Compositing, CLAUDE.md C8)

Searched `~/MindrianRooms/rethinking-mindrianos/research/` for moat / entitlement /
brain-access / gaurav / double-sign-in. **Reporting only; nothing written into the room.**

**Directly relevant, already filed:**

- `2026-08-26-trial-install-testimonial/2026-08-26-trial-install-testimonial.md` --
  the Gaurav Thorat trial-install trail. Root-causes the double sign-in at the code level
  in `mindrian-website`, names the missing canonical-domain enforcement and the absent
  `NEXT_PUBLIC_SITE_URL` pin, and characterises it as "a seam gap (two identity checks
  stacked back-to-back with nothing bridging the session across the hop), not a copy tweak."
  Its closing section, "Deliberately not acted on yet," records Jonathan's mid-session flag
  that Theo is about to replace the Brain hookup and that "any install-instruction
  regrouping or auth-flow rework ... should wait until after that swap lands." **That is
  independent corroboration of this phase's own defer posture, filed a day before the
  navigator decision.**

**Adjacent, worth the planner's awareness:**

- `2026-08-20-plugin-gate-trust-429-void` -- plugin gate / trust / rate-limit territory,
  the same domain as `/register`'s rate cap.
- `2026-08-11-gate0-cursor-windows`, `2026-08-20-gate0-live-diagnostic` -- Gate 0 diagnostics.
- `2026-07-05-testers-and-investors-synthesis` -- matched the moat/business-model search.

**No existing room entry covers the moat shift itself.** Per C8, this phase's own reasoning
needs a dated entry in the room, cross-linked back to the phase. That is a
post-planning compositing action for the orchestrator, not a research deliverable.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Supabase `brain_api_keys` columns and semantics are as described | Q1, Runtime State | Read from `provisionTrialKey`'s insert/select and `BRAIN-IDENTITY-DESIGN.md`; the live table schema was NOT queried (no credentials in this sandbox). A column drift would change the migration shape but not the option space |
| A2 | `POST /register` is deployed and live on `pws-brain-mcp.onrender.com` | Q1 | `BRAIN-IDENTITY-DESIGN.md` "Deploy status" says it ships with local commits in the brain repo and is "NOT live until the operator deploy ceremony." Not probed live this session. If it never deployed, Option C's plumbing is a design, not a running system. **Verify before locking Option C** |
| A3 | Existing keyed users' `plan='free'` rows are still the dominant live population | Runtime State | Not measured. Affects migration sizing only |
| A4 | Desktop and Cowork do not execute `hooks/hooks.json` `SessionStart` entries the way the CLI does | Pitfall 6, Arch Map | Inferred from CLAUDE.md's Tri-Polar table ("Hooks fire, scripts run" listed under CLI only) and from the MCP-server instructions block ("on surfaces without hooks (Claude Desktop, Cowork), YOU run it"). Strongly supported but not tested this session |
| A5 | The BSL Additional Use Grant (d) tension is real (see Q3 below) | Open Questions | A legal reading, not a verified fact. Needs the licensor's own call, not a planner's |
| A6 | `mbr_50147d1c-...` is still unrotated | Runtime State, Q3 | Last recorded state in FEEDBACK.md (2026-08-26, "NOT rotated yet"). May have changed since |

---

## Open Questions

### Q1: Which credential option -- A, B, or C?

- **What we know:** the option space, grounded in the two live credential shapes and the
  shared Supabase table; the rejected options from SEED-011 (embedded HMAC, anonymous
  degraded tier); that Option A breaks every env-var name and doc string; that Option C's
  plumbing is largely built.
- **What is unclear:** the navigator's intent. ROADMAP.md defers it to "this phase's own
  planning."
- **Recommendation:** emit a `checkpoint:decision gate="blocking"` in the DOCTRINE family
  with the three options and the pros/cons table from Q1 above. The decision is recordable
  now even though the engineering is not buildable now -- and recording it now is exactly
  what unblocks a fast Family E later.

### Q2: What is an "install gate" when distribution is public?

- **What we know (verified):** both repos PUBLIC, npm public, no plugin lifecycle hook in
  Claude Code, already-published artifacts immutable. The only enforceable levers are
  (a) change distribution to private/authenticated, (b) let anyone install but refuse to
  OPERATE without an entitlement (client-side, forkable, BSL-backed), or (c) gate the thing
  only the server can grant -- which the phase's own decision removes for Theo content.
- **What is unclear:** whether "shifting the moat" means accepting a bypassable
  client-side gate backed by the license, or genuinely privatising distribution.
- **Why it matters:** (a) and (b) produce completely different plans. (a) is mostly
  operator/account work (repo visibility, npm access, a private marketplace) with small
  code changes; (b) is mostly code (`refusal-messaging` extension, SessionStart preflight,
  cli.js preflight) with an accepted bypass surface.
- **Recommendation:** surface as a navigator question in the phase output. Do not pick.
  Note the subtlety that keeps (c) partially alive: if Theo is "keyless for any installed
  MindrianOS user," Theo still needs to distinguish an installed user from an anonymous
  curl, which means a credential is still on the wire -- just one minted at install time
  rather than purchased per user. That is exactly Option C's shape, and it is the reading
  under which the moat shift is genuinely enforceable rather than honour-system.

### Q3: Does the BSL license text still say what the business model says?

- **What we know:** `LICENSE` is BSL 1.1 (Licensor: Jonathan Sagir, Change Date 2030-04-16,
  Change License Apache 2.0). Additional Use Grant (a) permits "Personal use, academic use,
  and internal business use ... including using it to manage your own venture Data Rooms";
  (b) permits "Non-commercial research, education, and evaluation"; **(d) permits "Using the
  Licensed Work as an installed plugin in Claude Code, Claude Desktop, or Cowork for your
  own projects, even if those projects are commercial."** The commercial line is drawn at
  "Commercial Offering" -- reselling or hosting the work -- not at installing it.
- **What is unclear:** grant (d) expressly permits the exact act this phase proposes to
  charge for. A paid-install gate and a license that grants free installed use are not
  obviously compatible.
- **Why it matters:** this is the legal counterpart of Q2's technical bypass question. A
  user who forks the public repo and strips a client-side check is, under the current
  LICENSE, arguably doing something grant (d) permits.
- **Recommendation:** flag for the licensor (who is also the navigator). Not a planner
  decision and not a research verdict. **The roadmap does not mention LICENSE at all --
  this is a research-surfaced gap in the phase's stated scope.**

### Q4: Should the Gaurav double-sign-in finding get a real RCA file?

- **What we know:** root-caused twice (FEEDBACK.md + the room trail), zero
  `.planning/debug/` file in either repo, and CLAUDE.md's QA/RCA section requires one for a
  NEW FAILURE so `/gsd:debug <slug>` can resume it.
- **Recommendation:** flag it. It is explicitly not this phase's job to fix, and both
  existing write-ups say the fix waits for the Theo swap. But "root-caused in conversation
  and in a room trail" is not "written down at the RCA standard."

### Q5: Does `docs/BUSINESS-MODEL-AND-MOAT.md` get amended, superseded, or archived?

- **What we know:** its entire tier ladder is priced on Brain access being the paid thing.
  It carries `status: Draft for review` and a 2026-03-25 date. The roadmap names decisions.md,
  moat.md, and the personal-memory note, but not this file.
- **Recommendation:** flag with a recommendation to amend the frontmatter status and add a
  superseding note pointing at this phase, rather than rewriting the pricing model inside a
  planner task.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|-----------|-------------|-----------|---------|----------|
| `git` | doctrine commits, all git ops | yes | repo clean at `0d8ddf4` on `main` | -- |
| `node` | all repo tooling | yes | repo floor is >= 22.16.0 per CLAUDE.md | -- |
| `gh` CLI (authenticated) | repo visibility verification | yes | verified live this session | -- |
| `/home/jsagi/dev/mindrian-website/` | reading auth-flow current state (READ ONLY) | yes | all 5 confirmed files read | -- |
| `/home/jsagi/Theo/` | dependency-chain verification (READ ONLY) | yes | ROADMAP.md + STATE.md read | -- |
| `~/MindrianRooms/rethinking-mindrianos/` | compositing check (READ ONLY) | yes | 27 research entries | -- |
| `gsd-tools` on PATH | init context | **no** | -- | `node "$HOME/.claude/gsd-core/bin/gsd-tools.cjs"` works; use the full path in every plan task |
| `.planning/graphs/graph.json` | semantic discovery | present but **stale** | 831h old, 978 commits behind | Use grep; treat graph relations as approximate |
| Live Supabase credentials | verifying `brain_api_keys` schema | **no** | -- | Design from `provisionTrialKey`'s insert + `BRAIN-IDENTITY-DESIGN.md`; gate any schema-dependent task behind `checkpoint:human-action` |
| `pws-brain-mcp.onrender.com/register` deploy status | confirming Option C's plumbing is live | **not probed** | -- | Probe before locking Option C (see assumption A2) |
| `tests/run-all-269.sh` | phase verification aggregator | **no** | -- | Wave 0 gap; create it |

**Missing dependencies with no fallback:** none block the DOCTRINE half.
**Missing with fallback:** `gsd-tools` (use the full node path), graph.json (use grep),
Supabase schema access (gate behind a human checkpoint).

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section applies.

### Test framework

| Property | Value |
|----------|-------|
| Framework | None. Plain Node CJS assertion scripts (`*.test.cjs` under `lib/` and `tests/`) plus per-phase bash aggregators |
| Config file | None (no jest/vitest/pytest config anywhere) |
| Quick run command | `bash tests/run-all-269.sh` (**does not exist -- Wave 0**) |
| Full suite command | `node scripts/doctor.cjs --acceptance` |
| Release gate | `scripts/verify-release` |
| Structural gates | `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/check-shape-declaration.cjs` |
| Naming precedent | `tests/run-all-<phase>.sh` (latest: `run-all-264.sh`, `run-all-266.sh`) |

### Requirement -> test map (doctrine half; IDs are candidates, not yet minted)

| Candidate ID | Behavior | Test type | Automated command | File exists? |
|-------------|----------|-----------|-------------------|-------------|
| MOAT-01 | decisions.md row 1 states the install/update enforcement point and no longer implies a query-time key | unit (text assertion) | `node tests/269-doctrine-reconcile.test.cjs` | ❌ Wave 0 |
| MOAT-02 | decisions.md row 5 keeps "remote by design" verbatim AND carries the per-query-keys-are-gone clause | unit (text assertion, verbatim-substring check on the preserved half) | same | ❌ Wave 0 |
| MOAT-03 | moat.md carries an explicit commercial-boundary clause naming install/update | unit (text assertion) | same | ❌ Wave 0 |
| MOAT-04 | The cross-cutting flags (business-model doc, personal memory, LICENSE, RCA gap) are all recorded in the phase output | unit (presence assertion) | same | ❌ Wave 0 |
| -- | No em-dashes in any file this phase touches (C6) | lint | `grep -n "—" .claude/includes/*.md` returns nothing | grep, no file needed |
| -- | CLAUDE.md still loads its four includes cleanly after the edits | smoke | `node scripts/doctor.cjs --acceptance` | ✅ exists |
| -- | Structural gates unaffected (no new invocable surface) | structural | `node scripts/build-connector-registry.cjs --check` | ✅ exists |

**No automated test is possible for the engineering half** -- there is no code to test.
Family E's verification is a `checkpoint:human-action` confirming the external precondition,
not a test run.

### Sampling rate

- **Per task commit:** `node tests/269-doctrine-reconcile.test.cjs`
- **Per wave merge:** `bash tests/run-all-269.sh`
- **Phase gate:** `node scripts/doctor.cjs --acceptance` green + `node scripts/build-connector-registry.cjs --check` exit 0 before `/gsd-verify-work`

### Wave 0 gaps

- [ ] `tests/run-all-269.sh` -- the phase aggregator (pattern: `tests/run-all-266.sh`)
- [ ] `tests/269-doctrine-reconcile.test.cjs` -- verbatim assertions on the reconciled
      decisions.md rows and moat.md clause, plus a preserved-substring check proving
      Decision #5's "remote by design, not optional by default" survived unchanged
- [ ] No framework install needed (plain node, zero deps)

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section applies.

### Applicable ASVS categories

| ASVS category | Applies | Standard control (current state) |
|--------------|---------|----------------------------------|
| V2 Authentication | **yes** | Supabase `signInWithOAuth({provider:"google"})` (`AuthButton.tsx`) + `exchangeCodeForSession` (`auth/callback/route.ts`). Server-side `getUser()` on every data read in `actions.ts` -- the file's own comment says these "fail CLOSED if Supabase RLS ever regresses" |
| V3 Session Management | **yes** | Supabase session cookies. **Known defect:** cross-origin cookie break between `mindrian-os.com` and the raw Vercel alias, no canonical redirect, no `NEXT_PUBLIC_SITE_URL` pin. Confirmed by exact read of `next.config.ts` |
| V4 Access Control | **yes** | Supabase RLS (user SELECTs/INSERTs own key only); `isAdminPlan()` + `tierGate` server-side; `plan: 'install'` read-tier ceiling; `403 MoatViolation` on write-tool attempts |
| V5 Input Validation | **yes** | `POST /register` closed schema: `install_id` UUIDv4 ONLY; missing/non-UUIDv4/extra-field/non-JSON -> `400`. Part 8 payload audit asserted by `tests/test-250-silent-registration.cjs` Test 5 |
| V6 Cryptography | **partial** | `crypto.randomUUID()` for both `mbr_` key bodies and `install_id`. Not a signed/verifiable token -- it is an opaque bearer looked up in Supabase. Adequate for a bearer-lookup design; **do not** hand-roll signing to "improve" it (SEED-011 Option B, embedded HMAC, was formally rejected) |
| V7 Error Handling / Logging | **yes** | Token never logged, only `sha256-16` prefix (`token_sha256_16=<prefix> created=<bool>`). `503` on unconfigured Supabase rather than a fabricated `200` |
| V8 Data Protection at Rest | **yes** | SEC-02: mode 0600 required on `~/.mindrian.env`, `<cwd>/.env`, and `~/.mindrian-install.json`; `checkFilePermissions()` rejects any group/world bit (`mode & 0o077`) with an explicit reason, POSIX only (no-op on Windows) |
| V11 Business Logic | **yes** | Idempotency per `install_id` prevents unbounded minting; `registerRateLimit` default 5/window/socket address, separate bucket from `perKeyRateLimit` (120/window) |
| V13 API / Web Service | **yes** | `/register` mounted ahead of `/mcp` in `app.mjs`; unauthenticated by documented design |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation (state) |
|---------|--------|---------------------------|
| Cross-origin session-cookie break -> repeated auth prompt | Spoofing / poor UX that trains users to re-auth | Canonical-domain redirect + `NEXT_PUBLIC_SITE_URL` pin. **NOT MITIGATED TODAY.** Separate repo; flag only |
| Credential exposure in generated reports | Information disclosure | Masking. **Partially mitigated:** the Windows install-report path masks (`mbr_xxxx...yyyy`); the macOS path does not, and printed a live key into an emailed PDF. **One live key compromised and unrotated** |
| Token farming via unauthenticated `/register` | Spoofing / DoS | Closed UUIDv4 schema, per-`install_id` idempotency, register-specific rate cap, Cloudflare/WAF at the Render edge (`BRAIN-IDENTITY-DESIGN.md` threat table) |
| Elevation of privilege (install token reaching write tools) | Elevation | `plan: 'install'` never `isAdminPlan()`; `tierGate` -> `403 MoatViolation`; proven by `register-endpoint.test.mjs` Test 5 |
| Client-side entitlement check stripped from a public fork | Tampering | **Unmitigatable in code** given public distribution. Backstop is the BSL license -- which grant (d) may not actually support (Open Q3). This is the phase's central security-vs-business tension |
| Embedded shared secret extraction | Information disclosure | Already rejected as a design (SEED-011 Option B: "extractable from shipped CJS by design (`cat lib/... \| grep KEY`)"). Do not resurrect under a new name |
| User data leaking in an entitlement payload | Information disclosure / Canon Part 8 breach | Closed schema + the plugin-side outbound payload audit. **Any new field in an entitlement request is a Part 8 review item, not a routine change** |
| Retroactive gating expectation | -- (design risk) | None possible. Published npm tarballs and pushed git tags are immutable; every prior version stays installable keyless forever |

---

## Sources

### Primary (HIGH confidence) -- read from disk or verified live this session

**This repo (`/home/jsagi/dev/MindrianOS-Plugin/`):**
- `.planning/ROADMAP.md` Phase 269 section (both Goal paragraphs, the reconciliation
  paragraph, cross-references, `Depends on`)
- `.planning/STATE.md` (frontmatter + the four documented `gsd-tools` resync-clobber notes)
- `.planning/REQUIREMENTS.md` (v2.1.0; `grep -n "269"` -> no matches)
- `.planning/config.json`
- `CLAUDE.md`, `.claude/includes/{decisions,moat,architecture,release-process}.md`
- `install.sh` (all 367 lines), `bin/cli.js` (all 219 lines), `package.json`
- `lib/core/resolve-brain-key.cjs` (all 273 lines)
- `lib/core/brain-client.cjs` lines 290-400 (`_tryAutoRegister`, `ensureAvailable`)
- `lib/core/refusal-messaging.cjs` header (wire contract)
- `scripts/post-update-activation.cjs` header, `scripts/sessionstart-post-update-preflight.cjs` header
- `scripts/release.sh` (targeted greps; 1,440 lines)
- `commands/update.md` frontmatter + rationale, `commands/setup.md` (brain-key ceremony)
- `docs/BRAIN-IDENTITY-DESIGN.md` (all 160 lines)
- `docs/BUSINESS-MODEL-AND-MOAT.md` (tier structure)
- `docs/MOAT-MANDATE.md` (headings), `docs/INSTALL-LIFECYCLE-HARNESS.md` (headings)
- `docs/testers/gaurav-thorat/FEEDBACK.md` (2026-08-25 entry, full)
- `LICENSE` (BSL 1.1, full grant text)
- `.claude-plugin/plugin.json`, `hooks/hooks.json` (event inventory)
- `.planning/phases/115-.../115-00-PLAN.md` lines 795-820 (out-of-repo-deliverable precedent)
- `.planning/phases/85-.../85-10-PLAN.md` (late-scope precedent)
- `.planning/phases/266-.../266-01-PLAN.md` (current PLAN.md frontmatter shape)
- Convention survey across 1,118 PLAN.md files (`type:`, `autonomous:`, checkpoint types)
- `node .claude/gsd-core/bin/gsd-tools.cjs graphify status` (live)

**mindrian-website (`/home/jsagi/dev/mindrian-website/`) -- READ ONLY:**
- `website/src/app/brain-access/page.tsx` (16 lines), `actions.ts` (133 lines)
- `website/src/components/brain/AuthButton.tsx` (122 lines)
- `website/src/app/auth/callback/route.ts` (17 lines)
- `website/next.config.ts` (14 lines -- canonical-redirect gap confirmed by exact read)

**Theo (`/home/jsagi/Theo/`) -- READ ONLY:**
- `.planning/ROADMAP.md` Phase 7/8/9 sections including the "Resolved 2026-08-27" paragraph
- `.planning/STATE.md` frontmatter

**Rethinking room (`~/MindrianRooms/rethinking-mindrianos/`) -- READ ONLY:**
- `research/2026-08-26-trial-install-testimonial/2026-08-26-trial-install-testimonial.md`
- Directory listing (27 entries) + keyword search

**GSD core (`~/.claude/gsd-core/references/`):**
- `checkpoints.md` (checkpoint types, auto-mode behavior), `skeleton-template.md`,
  reference-directory inventory

**Live external:**
- `https://code.claude.com/docs/en/hooks` -- complete hook event list; confirmation that no
  plugin install/update/activation hook exists; `Setup` event semantics and its inability
  to block. `[CITED: code.claude.com/docs/en/hooks]`
- `gh repo view jsagir/mindrian-os-plugin` / `jsagir/mindrian-marketplace` -> both PUBLIC
  `[VERIFIED: GitHub API via gh]`

### Grounding source selection (CLAUDE.md C9)

Per the "Consult ALL Relevant Grounding Sources" rule, source selection was made per claim
rather than defaulting to one leg:

- **Claude Code hook events / plugin lifecycle** -> official Claude Code docs. This is a
  Claude-Code-internal question; the docs are authoritative and were fetched live.
- **Current repo state, credential mechanics, plan conventions** -> primary-source reads of
  this repo. Nothing in this section is from training data.
- **Website auth flow** -> primary-source reads of the actual files.
- **Dependency chain** -> primary-source read of Theo's own ROADMAP/STATE.
- **langtalks-graph-expert: judged NOT applicable, deliberately.** The corpus covers
  agent/LLM engineering concepts (memory, RAG, knowledge graphs, context engineering, agent
  protocols). This phase's questions are product licensing, plugin distribution, and
  credential design -- none of which that corpus was built to answer. Per C9's own warning
  ("picking it by default for every question ... is itself a research gap, not rigor"),
  skipping it here is the correct call, and it is stated rather than silently omitted.
- **Context7: judged NOT applicable.** No new library or API behavior is in question. The
  one library-adjacent claim (Supabase `signInWithOAuth` behavior) was answered by reading
  the actual calling code rather than the general docs, which is more authoritative for
  "what does THIS site do."

### Tertiary (LOW confidence) -- flagged for validation

- Live `brain_api_keys` schema: inferred from calling code, not queried (assumption A1)
- `/register` production deploy status: not probed (assumption A2)
- Desktop/Cowork hook behavior: inferred from CLAUDE.md + MCP instructions (assumption A4)
- BSL grant (d) tension: a reading, not a legal opinion (assumption A5)

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Current install/update code path (Q2) | **HIGH** | Every file read in full; distribution visibility verified live via `gh`; hook-event absence verified against live official docs |
| Website auth state (Q3) | **HIGH** | All five files read in full; the `next.config.ts` gap confirmed by exact read, not inference |
| Dependency chain / defer justification | **HIGH** | Theo's ROADMAP and STATE read directly; Phases 8 and 9 both literally `Plans: TBD (not yet planned)` |
| Current credential mechanism (Q1 current state) | **HIGH** | `resolve-brain-key.cjs`, `brain-client.cjs` minting block, `provisionTrialKey`, and `BRAIN-IDENTITY-DESIGN.md` all read directly |
| Credential option recommendation (Q1 verdict) | **MEDIUM** | Option C is well-grounded in existing plumbing, but its key dependency (`/register` actually deployed) is unverified, and this is explicitly a navigator decision, not a research verdict |
| Build-vs-defer mechanism (Q4) | **HIGH** | Counted across 1,118 PLAN.md files; confirmed no `[DEFERRED]`/`[BLOCKED]` convention exists in GSD core or this repo |
| Doctrine current text | **HIGH** | Verbatim reads; the "pay per graph query" non-existence confirmed by exhaustive grep |
| Live Supabase / deploy state | **LOW** | No credentials in this sandbox; flagged as A1/A2 |
| BSL license tension | **LOW** | A reading, not a legal opinion; needs the licensor |

**Research date:** 2026-08-27
**Valid until:** 2026-09-10 (14 days). Short window: Theo Phase 7 is actively executing and
its completion changes this phase's blocking condition. Re-check
`/home/jsagi/Theo/.planning/ROADMAP.md` Phase 8/9 status before planning Family E.
