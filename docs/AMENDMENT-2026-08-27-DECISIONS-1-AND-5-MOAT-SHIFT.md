---
status: applied
date: 2026-08-27
phase: 269
amends: .claude/includes/decisions.md rows 1 and 5; .claude/includes/moat.md
ruling_source: .planning/ROADMAP.md Phase 269 (navigator-locked 2026-08-27)
engineering_status: deferred
---

# Amendment 2026-08-27: Decisions #1 and #5, the Moat Shift

This document is the dated, citable record behind the one-line diffs plan 02 already
landed in `.claude/includes/decisions.md` and `.claude/includes/moat.md`. A reader who
lands on decisions.md row 1 and wonders why it changed should end up here, not in git
history. It quotes the ruling, quotes the before and after text verbatim, maps the
credential option space without deciding it, states the enforcement reality plainly, and
flags four cross-cutting surfaces the roadmap's own scope paragraph never named.

## The ruling

No `CONTEXT.md` exists for Phase 269 because `.planning/config.json` sets
`skip_discuss: true`. That means `.planning/ROADMAP.md`'s two Phase 269 Goal paragraphs
ARE the locked decision record for this phase; there is no separate discuss-session
artifact to defer to.

The navigator's ruling, quoted verbatim from ROADMAP.md:

> the key will be required to install and update mindrian... there will be no dependency on key to access [Theo]... it will be accessible to any mindrianOS user... we are shifting the moat.

The concrete-mechanism refinement, also from ROADMAP.md, quoted for its core claim: the
install page's existing Google-auth flow at `/brain-access` (Supabase's
`signInWithOAuth` with provider google) is repurposed so the same gate that issues a
Brain API key today issues the install/update entitlement credential instead of, or
alongside, that key. Today that flow's only output is a Brain API key; under this phase,
the general-access gate becomes install-and-update, not Brain-specific.

Source: `.planning/ROADMAP.md`, Phase 269 section, both Goal paragraphs and the
`Depends on` line.

## What changed in decisions.md

Row 1, BEFORE:

```
| 1 | One-command install; the Brain is part of what installs. | Larry's methodology comes from the Brain and says so; a keyless session gets an honest refusal and a visible path to a key, never an imitation. |
```

Row 1, AFTER (copied verbatim from the reconciled file on disk):

```
| 1 | One-command install; the Brain is part of what installs, and the key gates installing and updating rather than each query. | Larry's methodology comes from the Brain and says so; the entitlement is checked at install and update time, so a keyless session gets an honest refusal and a visible path to a key at that moment, never an imitation; once an install is entitled, methodology queries carry no separate per-query key check. |
```

Row 5, BEFORE:

```
| 5 | Brain as remote MCP | IP never distributed; users get intelligence, not data. The Brain is remote by design, not optional by default; a keyless session gets an honest refusal, never a silent local substitute. |
```

Row 5, AFTER (copied verbatim from the reconciled file on disk):

```
| 5 | Brain as remote MCP | IP never distributed; users get intelligence, not data. The Brain is remote by design, not optional by default; a keyless session gets an honest refusal, never a silent local substitute. Per-query Brain keys are gone: the entitlement moved to install and update time, and moving the check does not make the Brain local or optional. |
```

## What changed in moat.md

`.planning/ROADMAP.md`'s own paraphrase, "pay per graph query," was verified by
exhaustive grep to appear nowhere in `.claude/includes/*.md`, `docs/MOAT-MANDATE.md`, or
`docs/BUSINESS-MODEL-AND-MOAT.md`. Nothing was replaced, because there was no literal
string to replace. What was actually missing is that `moat.md` never stated, in its own
words, where the commercial boundary sits. The added paragraph, quoted verbatim from the
file on disk:

> Commercial boundary: the paid gate is INSTALLING and UPDATING MindrianOS, not querying
> the graph. An entitled install queries methodology freely, the entitlement is checked
> when the plugin is installed and when it is updated, and it is never checked per query.
> The moat is the graph plus the right to run it, not a metered query counter.

## What did NOT change

- `The Brain is remote by design, not optional by default` -- Decision #5's principle
  survives byte for byte. Only the check location moved from per-query to
  install/update-time; the Brain itself did not become local or optional.
- `served via MCP, never distributed` -- Theo stays remote and is never bundled, per
  Theo's own Phase 9 resolution. Only the entitlement check relocates; Theo's own
  architecture does not change.
- The honest-refusal rail from Phase 250 -- a non-entitled install still refuses
  honestly. It refuses at a different moment (install/update time instead of
  first-query time), never with a silent imitation.
- The moat formula itself (WHEN, WHICH, SEQUENCE) -- `docs/MOAT-MANDATE.md` carries this
  formula unchanged; the review checklist there does not reference payment at all.

## Credential option space (DECIDED 2026-08-27)

`269-RESEARCH.md` Research Question 1 maps three options, grounded in the current state
that both existing credential shapes already share one Supabase `brain_api_keys` table,
distinguished only by the `plan` column:

| Option | What changes | Pros | Cons |
|---|---|---|---|
| A: Replace outright | Retire the dashboard trial key; `/brain-access` issues an install/update entitlement credential instead of a Brain API key | Conceptually cleanest; one credential, one purpose | Breaks every existing keyed user's mental model and byte-locked wire strings; several doc and code surfaces need rewrites |
| B: Unify into one credential with two authorized uses | Keep the existing row shape and the `MINDRIAN_BRAIN_KEY` name; stop checking it per-query, start checking it per-install/update | Smallest blast radius; zero schema change; existing keyed users unaffected | Leaves per-query metering columns as dead weight; a variable named for Brain access that no longer gates Brain access is semantically muddy |
| C: Promote the per-install registration token | `~/.mindrian-install.json` becomes the entitlement credential; `POST /register` stops minting unconditionally and starts requiring proof of an authorized Google identity | Roughly 80 percent of the plumbing already exists: per-install identity, idempotency per `install_id`, mode-0600 storage at `~/.mindrian-install.json`, revocation by flipping one `brain_api_keys` row to `revoked`, a documented threat model, an opt-out via `MINDRIAN_DISABLE_AUTO_REGISTER`, and a register-specific rate cap; per-install granularity fits an install-time gate | `POST /register` becoming authenticated inverts its own documented "unauthenticated by design" contract, which needs a formal amendment, not a quiet edit; requires coordinated changes across repos |

This is a research finding, not a decision. `.planning/ROADMAP.md` explicitly defers the
call to this phase's own planning: "Whether the install/update key REPLACES the Brain key
outright or the two become one credential with two authorized uses is a decision for this
phase's own planning, not decided here."

Before Option C can be locked, assumption A2 from `269-RESEARCH.md` must be probed:
`POST /register` on `pws-brain-mcp.onrender.com` is documented as shipping, but its
production deploy was not independently verified during this research. The chosen option
gets recorded into this same section by plan 04.

Credential model DECIDED: option-b, unify: one credential, two authorized uses.

Navigator's rationale, quoted near-verbatim: "The existing Brain API key becomes the
install/update entitlement credential too. Smallest blast radius: only the CHECK location
moves (query-time to install/update-time), zero schema change, MINDRIAN_BRAIN_KEY and
existing docs stay valid. Per-query metering columns in brain_api_keys stay in the schema
but go unused, that's an accepted, known consequence, not an oversight to fix now."

Rejected: option-a (Replace outright) breaks every existing keyed user's mental model and
the byte-locked `reason: 'MINDRIAN_BRAIN_KEY not set'` wire string in
`lib/core/refusal-messaging.cjs`, forces rewrites across `commands/setup.md`,
`bin/cli.js:206-208`, and `docs/install/BRAIN-SETUP.md`, and is still per-person for a gate
that is fundamentally per-install; option-b reaches the same refusal outcome without any of
that blast radius.

Rejected: option-c (Promote the per-install token) is unneeded because Q2 was answered as
"refuse-to-operate, stays public," which does not need option-c's per-install-granularity
advantage; option-c also inverts POST /register's documented "unauthenticated by design"
contract (requiring a formal amendment to `docs/BRAIN-IDENTITY-DESIGN.md`) and needs
coordinated changes across repos, plus carries the unverified A2 precondition (whether
POST /register is actually live in production), not worth taking on when option-b achieves
the same result with zero schema change.

Preconditions: the dead per-query metering columns (`expires_at`, `daily_limit`,
`total_requests`) in the `brain_api_keys` table stay in the schema unused; the navigator
explicitly accepted this as a KNOWN consequence, not an oversight to fix now, so there is
no pending data-migration decision, it is decided to leave them as unused dead weight.

Q2 distribution reading: refuse-to-operate, stays public. Code/repo distribution stays
exactly as-is (public, BSL-licensed); the repo and npm scope are NOT privatized. The
plugin checks entitlement at install/update time and refuses to proceed without it. This
matches the "graph plus the right to run it" framing already in moat.md.

This is a RECORD only. Phase 269 writes zero entitlement-check code; `269-05-PLAN.md` is
the gated home for that engineering.

## Enforcement reality

Four findings, stated plainly so nobody later expects more than the current design can
deliver:

1. **Public distribution.** `jsagir/mindrian-os-plugin` and `jsagir/mindrian-marketplace`
   are both PUBLIC, and `@mindrian_os/cli` publishes to public npm with no auth --
   verified live 2026-08-27. An install gate therefore cannot mean refusing to deliver
   the bytes without a distribution change; it can only mean the plugin refuses to
   operate until a valid entitlement is present.
2. **No plugin lifecycle hook.** Claude Code has no `PluginInstall`, `PluginUpdate`,
   `PluginLoad`, `PostInstall`, or `PluginActivation` event of any kind, verified against
   the live hooks documentation. The `Setup` event fires only under init or maintenance
   modes and cannot block. The only seam that catches `claude plugin install` and
   `/plugin update` is the next `SessionStart`, and
   `scripts/sessionstart-post-update-preflight.cjs` already ships exactly that blocking
   shape for version drift.
3. **Prospective-only gating.** Every npm version already published and every git tag
   already pushed stays installable forever with no credential. Any gate this phase
   eventually builds is prospective only and cannot be retroactive.
4. **Tri-Polar gap.** `SessionStart` hooks fire in Claude Code CLI; Desktop and Cowork do
   not run them the same way. A `SessionStart`-only gate covers one of three surfaces,
   and that must be a stated call, not an oversight.

## Cross-cutting flags

`.planning/ROADMAP.md`'s Phase 269 scope paragraph names `.claude/includes/decisions.md`,
`.claude/includes/moat.md`, and the personal-memory business-model note. Research
surfaced two more surfaces the roadmap does not mention at all. All four are flagged
here, not edited, so a later reader cannot mistake omission for a considered decision.

### FLAG 1: docs/BUSINESS-MODEL-AND-MOAT.md

The single most affected document in the repo, and entirely unnamed by the phase scope.
Current state: its whole tier ladder is priced on Brain access being the paid thing --
the Free tier explicitly lists "What's missing: Brain intelligence"; the Brain tier's
first bullet is "Brain API key"; the University tier is priced as Brain access for all
enrolled students. All of this becomes incoherent the moment Theo access is unconditional
for any installed user. The file is 233 lines with `status: Draft for review`
frontmatter, and its stack figures (23K Neo4j nodes, 12K Pinecone embeddings) are already
stale independent of this shift, since the backend moved to Memgraph with local e5
embeddings on 2026-07-22 and Pinecone is retired. Recommended action: amend the
frontmatter status and add a superseding note pointing at this amendment; do not rewrite
the pricing model here. Rewriting a full pricing model is its own phase.
Owner: navigator.

### FLAG 2: project_mindrianos_business_model.md

Lives outside this repo, at `~/.claude/projects/-home-jsagi/memory/`, outside git and
outside this phase's tracked scope. Its current claim, verbatim: "Free tier = prompt-Larry
+ Brain MCP; paid = trained Lawrence model." That is now inconsistent with a model where
the paid thing is the install and update right rather than Brain access itself.
Recommended action: the human updates it. No plan task in this phase edits it, per
`269-RESEARCH.md` Pitfall 7.
Owner: human, outside GSD.

### FLAG 3: LICENSE BSL 1.1 Additional Use Grant (d)

Research-surfaced, not named in the roadmap at all. `LICENSE`'s Additional Use Grant (d)
currently permits "Using the Licensed Work as an installed plugin in Claude Code, Claude
Desktop, or Cowork for your own projects, even if those projects are commercial" -- the
exact right this phase proposes to charge for. The license draws its commercial line at
reselling or hosting (a "Commercial Offering"), not at installing. This is the legal
counterpart of the enforcement-reality finding that a client-side check in a public repo
is strippable: a user who forks and strips the check is arguably doing what grant (d)
permits. Recommended action: the licensor, who is also the navigator, makes the call
before any gate ships. This is a reading, not a legal opinion.
Owner: licensor.

### FLAG 4: Gaurav Thorat double sign-in RCA gap

Root-caused twice and written down twice -- in `docs/testers/gaurav-thorat/FEEDBACK.md`
(2026-08-25 entry) and in the `rethinking-mindrianos` research trail at
`research/2026-08-26-trial-install-testimonial/` -- yet with zero `.planning/debug/` file
in either repo. Root cause, in one paragraph: `AuthButton.tsx` sends `redirectTo` built
from `window.location.origin`, `auth/callback/route.ts` redirects back to a
request-derived `origin`, and `next.config.ts` carries no canonical-domain redirect and
no `NEXT_PUBLIC_SITE_URL` pin, so a hop between `mindrian-os.com` and the raw Vercel
alias sets the session cookie on one origin and renders `/brain-access` on the other,
producing a second Google sign-in. CLAUDE.md's QA and RCA section requires a NEW FAILURE
to get a `.planning/debug/<slug>.md` file at the `docs/RCA-TEMPLATE.md` standard so
`/gsd:debug <slug>` can resume it; this phase flags the gap rather than closing it,
because both existing write-ups say the fix waits for the Theo swap to land. Also on the
record from the same FEEDBACK.md entry: an unmasked live Brain API key value was printed
into an emailed install-report PDF with two or more recipients, and rotation is still
pending. That item is independent of this phase, but a credential-model change is the
natural moment to resolve it. See `docs/testers/gaurav-thorat/FEEDBACK.md` for the
credential detail; it is not restated here.
Owner: human, plus a future `/gsd-debug` session.

## Dev-Research Compositing action (CLAUDE.md C8)

`~/MindrianRooms/rethinking-mindrianos/research/` already holds the directly relevant
prior art at `2026-08-26-trial-install-testimonial/`, whose closing "Deliberately not
acted on yet" section independently corroborates this phase's defer posture a day before
the navigator's ruling. No room entry yet covers the moat shift itself.

Required post-execution action: a dated entry in that room, cross-linked back to this
amendment and to `.planning/phases/269-moat-shift-install-update-entitlement-gate-replaces-per-quer/269-RESEARCH.md`.
Filing it is not a MindrianOS-Plugin repo file edit and is therefore not a task in any
Phase 269 plan; it is a compositing action for the operator after execution.
