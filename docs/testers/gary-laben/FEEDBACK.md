---
type: tester-feedback-log
tester: Gary Laben
slug: gary-laben
created: 2026-05-07
---

# Gary Laben -- Feedback Log

Append-only log of every signal Gary gives. Each entry: date, channel, signal, action taken.

---

## 2026-05-07 -- Email (forwarded by Lawrence Aronhime)

**Channel:** garyslaben@gmail.com -> aronhime@jhu.edu -> jsagir@gmail.com

**Signal (verbatim):**

> Claude and Claude Code exist on my PC. I am having difficulty installing it using both the Claude application and the Powershell method. Essentially, Claude returns the following:
>
> [paste of Claude Code's install-script security warning -- third-party plugin, modifies settings.json, adds SessionStart hook, unknown provenance, recommended against running it]
>
> It appears that I can proceed (until I tell it to and it declines for the umpteenth time !LOL), but I think it's concerned the Mindrian will run for every Claude project I open, not just those associated with Mindrian? Can you opine here or direct me to someone who could assist?

**What this tells us:**

1. **Claude Code's third-party plugin warning is a real onboarding friction surface.** It is correct-by-design (Anthropic safety policy) but reads as a hard "no" to a cautious user. We need a tester-facing explanation that addresses the warning head-on, not around it.
2. **Scope concern is the dominant question.** Gary explicitly asked whether the plugin runs in every Claude Code project or only in Mindrian-associated ones. This is the question we need to answer first, in plain words.
3. **Critical surface gap: scope clarity is not in any current tester onboarding doc.** Lawrence, Justin, Aryeh, Adam, Shmuel were not blocked by this. Gary surfaces it because he uses Claude Code for multiple projects.

**Action taken:**

- Onboarded Gary as Wave-2 tester (REGISTRY.md row added 2026-05-07).
- Issued 60-day Brain key (expires 2026-07-06).
- Drafted welcome email at `docs/testers/outbox/2026-05-07-gary-laben-welcome.md` -- gitignored, contains live key. Welcome email leads with the scope answer.
- Logged the Claude-Code-warning friction surface as a candidate input to the next iteration of `docs/testers/STYLE-GUIDE.md` and the install site (`https://mindrianos-install-site.vercel.app/`).

**Open follow-ups:**

- Confirm Gary received the welcome and the install completed.
- Once installed, screen him for the Phase 115 owned-emotion criteria before treating him as a Dror-2.0 validation subject.
- Ask him whether the welcome's scope answer would have been enough on its own (i.e. would he have completed the install without the Claude Code refusal as a conversation prompt). This tells us whether the answer belongs in pre-install copy or only in conversation.

---

## 2026-05-09 -- key rotation + install completed

**Channel:** Gmail thread, Gary's Claude Code session.

**Signal:**

Gary's Claude Code worked through the corrected git-clone install path on 2026-05-08 (paste 17:27, executed 18:02). Three real product bugs surfaced:

1. **Windows long-path failure** on git clone. `.planning/phases/92-refactor-constitution-and-trust-layer-formalizes-audit-driven-refactor-work-constitution-v1-1-directive-1-validation-directive-2-consolidation-directive-3-unidirectional-flow-trust-layer/` exceeds Windows MAX_PATH (260 chars). Gary's CC fixed locally by enabling `git config --global core.longpaths true`. Plugin install.sh does not preflight this.
2. **install.sh dies on missing skills/mullins-scaffold/SKILL.md.** The cp loop hits `set -euo pipefail` and the entire script exits, leaving agents/hook/settings.json registration unfinished. Gary's CC manually completed: created agent symlinks, wrote settings.json with hook + larry-extended default + MINDRIAN_OS_ROOT env var.
3. **`@mindrian/os` npm package unpublished.** Already known. Caused the 17:05 prompt to fail with 404.

Gary's CC also flagged the Brain API key (UUID redacted; original value in gitignored outbox welcome) as exposed in session history. Correctly identified as compromised the moment he pasted it into chat.

**Action taken (2026-05-09):**

- Old Brain key REVOKED 2026-05-09 (UUID redacted from this committed file; original value present only in gitignored welcome email at `docs/testers/outbox/2026-05-07-gary-laben-welcome.md`).
- New Brain key issued 2026-05-09 (UUID redacted from this committed file; current active value present only in the same gitignored welcome email), valid 60 days, expires 2026-07-08, free plan.
- New key delivery: send via narrow channel, not via the same email thread that contained the old one.
- Three plugin bugs filed as Phase 95.3 (insert under v1.13.0 milestone, install-cache failure family case #4).

**Final install state (Gary's machine):** working. 85 commands, 6 skills, 9 agents, SessionStart hook, larry-extended default agent, MINDRIAN_OS_ROOT all registered. Larry should greet on next session.

**Open follow-ups:**

- Confirm Larry greeted on Gary's first fresh session.
- Send the new Brain key in a fresh narrow message (NOT the existing 19e030a02efac30d thread, which carried the old key).
- Run /mos:onboard with him synchronously if he is open to a 20-min call.
- After he settles, screen for the Phase 115 Dror 2.0 owned-emotion criteria before counting him as a validation subject.

