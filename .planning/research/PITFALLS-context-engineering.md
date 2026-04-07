# Pitfalls Research

**Domain:** Context engineering optimization for existing Claude Code plugin (MindrianOS v1.8.8 -> v1.9.0)
**Researched:** 2026-04-07
**Confidence:** HIGH (based on documented Claude Code bugs, Anthropic engineering guidance, and real-world plugin breakage patterns)

---

## Critical Pitfalls

### Pitfall 1: CLAUDE.md Diet Removes Load-Bearing Sections

**What goes wrong:**
Aggressive CLAUDE.md reduction (34KB -> 20KB target) removes sections that appear redundant but are actually load-bearing for Claude's behavioral calibration. The plugin works today BECAUSE Claude sees the full moat definition, tri-polar design rule, Simon/Rittel theory, and release process in every session. Remove these and Claude stops enforcing them -- not with errors, but with silent behavioral drift. You won't notice until a user reports that Larry stopped filing artifacts correctly or the cascade pipeline stopped firing.

**Why it happens:**
Theory sections (Simon's Architecture of Complexity, MWP Moat Awareness, Cross-Subsystem Cascade Rule) look like documentation, not instructions. A developer optimizing for token count sees 8KB of academic references and thinks "move to external file." But these sections are behavioral anchors -- they shape HOW Claude reasons about every action, not just WHAT it does. Research shows Claude's instruction-following capacity is approximately 150-200 distinct instructions. Claude Code's built-in system prompt already contains roughly 50 instructions. That leaves approximately 100-150 items of effective instruction budget. The current CLAUDE.md likely already approaches this threshold. The danger isn't only token count -- it's instruction density degradation when you restructure.

**How to avoid:**
1. Classify every CLAUDE.md section as IDENTITY (must stay), ROUTING (can become conditional), or REFERENCE (can externalize). Only externalize REFERENCE sections.
2. The following sections are load-bearing and CANNOT be removed from root CLAUDE.md:
   - "What Is This?" (identity -- Claude must know it's a PWS plugin)
   - "The Three Layers" (routing -- decides where artifacts go)
   - "Tri-Polar Design Rule" (constraint -- prevents single-surface features)
   - "Key Decisions" table (behavioral anchors -- 14 rules that govern every action)
   - "Release Process" (procedural -- prevents broken releases)
   - "MWP Moat Awareness" mandate (quality gate -- prevents shallow features)
3. The following CAN be externalized to @include or .claude/rules/:
   - "Source Material" table (reference lookup, not behavioral)
   - "Architectural Evolution" room structure diagram (reference)
   - Full "Technology Stack" details (only needed during development)
   - "What NOT to Use" / "Alternatives Considered" tables (defensive, rarely referenced)
   - Verbose Simon/Rittel/Hughes theory paragraphs (keep the table mapping, remove the exposition)
4. The 4 @include files (.claude/includes/) are already 5.6KB total and correctly externalized. They duplicate content from the main CLAUDE.md -- remove the duplicated content from main, keep the @include references.
5. Test each removal by running 10 representative user prompts before and after. Compare outputs for behavioral drift.

**Warning signs:**
- Larry stops mentioning wicked problems or Simon's hierarchy in responses
- Cascade pipeline stops detecting cross-section relationships
- New features ship without tri-polar surface consideration
- Release process steps get skipped
- Moat-deepening mandate stops being enforced in feature design

**Phase to address:**
Phase 1 (CLAUDE.md Diet) -- this is the FIRST thing to get right because every subsequent phase depends on the remaining CLAUDE.md being correct.

---

### Pitfall 2: Progressive Skill Loading Creates the "Unknown Unknown" Problem

**What goes wrong:**
You replace 7 always-loaded skills (37KB total) with stub descriptions (~50 tokens each, ~350 tokens total). Claude sees the stub, decides the skill isn't relevant, and proceeds WITHOUT the skill's behavioral rules. But the skill WAS relevant -- Claude just couldn't assess relevance from a one-line description. This is the "unknown unknown" problem: Claude doesn't know what it doesn't know is in the unloaded skill.

Example: User says "file this meeting." Claude sees stub "room-passive: Passive room management." Claude decides room-proactive (5.8KB) is the relevant skill, loads it, but MISSES room-passive (4.3KB) which contains the artifact filing cross-reference rules. Meeting gets filed but cascade detection doesn't trigger.

**Why it happens:**
Skill stubs are lossy summaries. Claude's relevance judgment from a stub is based on keyword matching against the user's request, not deep understanding of the skill's behavioral rules. Skills with broad, implicit scope (like room-passive, which quietly governs ALL artifact filing) get under-triggered because their stubs describe passive behavior that doesn't match active user requests. Anthropic's own skill loading documentation confirms skills consume only ~30-50 tokens as stubs until activated, but provides no mechanism for guaranteed activation of cross-cutting behavioral skills.

**How to avoid:**
1. Never make skills with cross-cutting concerns (room-passive, context-engine) demand-loaded. These are effectively extensions of CLAUDE.md behavioral rules.
2. Classify skills into tiers:
   - **Always-loaded** (behavioral): room-passive, larry-personality, context-engine (~16KB) -- these shape every interaction
   - **Session-loaded** (contextual): room-proactive, brain-connector (~11KB) -- loaded when room/Brain state indicates relevance
   - **Demand-loaded** (specialized): ui-system, pws-methodology (~10KB) -- loaded only when explicitly needed
3. Stubs for demand-loaded skills must include TRIGGER CONDITIONS, not just descriptions. Example: "Load this skill when: user asks about dashboards, exports, or visual output" not just "UI system for visual output."
4. Add a safety net: if Claude's response would create/modify files in a skill's domain directory without having loaded that skill, the PostToolUse hook should warn.

**Warning signs:**
- Users report "it used to do X automatically, now I have to ask for it"
- Behavioral rules from unloaded skills silently stop being enforced
- Claude loads the wrong skill for a task (relevance misjudgment)
- Cross-reference detection stops working for certain artifact types

**Phase to address:**
Phase 2 (Progressive Skill Loading) -- must be designed with the tier classification, not implemented as "make everything demand-loaded."

---

### Pitfall 3: Context Budgeting Over-Prunes Critical State

**What goes wrong:**
STATE.md caching with TTL means Claude sometimes operates on stale state. A user files 3 artifacts in quick succession. The first triggers STATE.md recalc. The second and third see cached state (TTL hasn't expired). Claude's cross-reference detection misses relationships between artifact 2 and artifact 3 because it thinks the room state hasn't changed. The 24-hour Brain cache similarly means a framework query returns yesterday's answer even after the user restructured their entire problem definition.

**Why it happens:**
Caching is inherently a freshness-vs-cost tradeoff. The current system (full recalc every session) is expensive but correct. Introducing caching saves tokens but introduces a correctness window where state is stale. The danger is that "stale" isn't visibly wrong -- Claude just makes slightly worse decisions. Users experience gradual quality degradation rather than obvious errors. This matches the documented Claude Code KV cache regression (issue #29230) where stale pre-compaction prefixes were served into post-compaction turns without errors, just silently wrong behavior.

**How to avoid:**
1. STATE.md: Use delta detection (mtime-based), not TTL-based caching. After any file write to the room, invalidate STATE.md cache. The PostToolUse hook on Write already exists -- extend it to set a "state-dirty" flag rather than recalculating immediately.
2. Brain cache: Cache by query+room-hash, not just query. If room content changes (new artifact, modified section), the cache key changes automatically. This gives you cache hits when nothing changed and automatic invalidation when something did.
3. Never cache proactive intelligence results (cross-reference detection, convergence signals). These are the highest-value outputs and most sensitive to staleness.
4. Add cache-miss logging. If you can't measure cache hit rates, you can't tune TTLs without guessing.

**Warning signs:**
- Cross-reference detection stops finding relationships that exist
- Brain responses reference artifacts or frameworks the user has since abandoned
- "Larry seems less smart than before" user feedback
- Proactive suggestions become repetitive (cached intelligence, not fresh scan)

**Phase to address:**
Phase 3 (Smart Caching) -- but the invalidation strategy must be designed in Phase 1 alongside the CLAUDE.md diet, because the hook infrastructure is shared.

---

### Pitfall 4: npm Distribution Breaks Existing Git-Based Installs

**What goes wrong:**
Users who installed via `git clone` or `claude plugin install mindrian-os@mindrian-marketplace` now have a second install path (npm). Version conflicts arise: the git-installed copy is at v1.8.8, npm installs v1.9.0, and Claude Code loads both (or neither, or the wrong one). Hooks fire from one install while skills load from the other. The user sees bizarre behavior -- half old, half new. Claude Code's plugin resolution follows precedence: project-scope > user-scope > marketplace. npm creates a path that may or may not respect this precedence.

**Why it happens:**
Multiple distribution channels without a migration strategy is a well-documented failure pattern. The OpenClaw project documented exactly this in Q1 2026: three separate releases each introduced breaking changes because npm updates only update the binary, not the config/migration layer. Claude Code itself has the same problem: Homebrew users see false "Update available" banners because the update check queries npm (issue #41840). Adding a distribution channel without consolidating the existing one creates a dual-install hazard.

**How to avoid:**
1. npm distribution must include a migration script that detects and removes/migrates existing git-based installs before activating. Not a warning -- an actual migration.
2. Version the hook protocol with a header. Each hook script should declare its expected plugin version. If the hook's version doesn't match the loaded plugin version, fail loudly with "Plugin version mismatch -- run mindrian-tools.cjs doctor."
3. Ship a `mindrian-tools.cjs doctor` command that:
   - Finds all MindrianOS installs (npm global, npm local, git clone, marketplace)
   - Reports which one Claude Code will actually load
   - Offers to clean up duplicates
4. Never have two install paths active simultaneously. The npm installer must deactivate the git path, or vice versa.
5. npm postinstall should NOT run migration automatically (can break CI). First `session-start` run detects new install and offers interactive migration.

**Warning signs:**
- Hook scripts fail with "file not found" (wrong install path)
- Skills load from old version while commands reference new version
- Users report "I updated but nothing changed"
- `plugin.json` version doesn't match CHANGELOG
- Two plugin directories exist in different locations

**Phase to address:**
Phase 4 (Release System Hardening) -- this is the riskiest phase because it affects every existing user.

---

### Pitfall 5: ICM Hierarchy Traversal Adds Latency to Session Start

**What goes wrong:**
The session-start hook currently runs `analyze-room` synchronously. Adding ICM hierarchy traversal (Layer 0 -> Layer 1 -> Layer 2 -> selective skill loading) makes session start slower. Current hooks.json shows timeouts of 2000-3000ms on most hooks. If traversal takes >3 seconds, the hook times out and session starts with incomplete context. Claude proceeds without the ICM hierarchy -- effectively reverting to v1.8.8 behavior but with LESS context because the CLAUDE.md was already dieted.

**Why it happens:**
ICM traversal requires reading multiple files: room STATE.md, .context-profile.json, skill stubs, section-level state files. In a room with 8+ sections, each with their own STATE.md, this compounds. Each file read is a filesystem call. The existing session-start hook already does work (analyze-room) -- adding traversal on top pushes past timeout limits.

**How to avoid:**
1. Pre-compute the traversal result and cache it as `.context-cache.json` in the room root. Session start reads ONE file, not N files.
2. Increase the SessionStart hook timeout in hooks.json to at minimum 5000ms.
3. Make traversal incremental: if `.context-cache.json` exists and no room files changed since last computation (check mtime of room root), skip traversal entirely.
4. The traversal script must be Node.js (fast startup), not Bash (slow for file iteration) or Python (slow cold start).
5. Background the heavy work: return essential context immediately (Layer 0 identity + Layer 1 routing), then compute Layer 2 state asynchronously.
6. Profile the existing session-start hook timing BEFORE adding anything. Know your baseline.

**Warning signs:**
- Session start takes >3 seconds (was <1 second before)
- Hook timeout errors in Claude Code logs
- Incomplete skill loading on first prompt (traversal was cut short)
- Larry's greeting is missing room context that used to appear

**Phase to address:**
Phase 1 (ICM-Driven Context Loading) -- must profile and benchmark before shipping.

---

### Pitfall 6: .context-profile.json Cold Start -- No Usage Data on First Run

**What goes wrong:**
Per-room `.context-profile.json` is auto-generated from usage patterns and venture stage. On first run (new room, new user, or after clearing state), there are no usage patterns. The profile is empty or uses defaults that may be wildly wrong for the user's actual workflow. Claude loads the wrong skills, misses the right context, and the first session is worse than v1.8.8 (which loaded everything). This is the classic cold start problem that blocks every personalization system.

**Why it happens:**
Usage-based profiling is inherently a warm-start optimization. It assumes historical data exists. Every personalization system faces this chicken-and-egg problem: you need usage data to optimize context, but you need optimized context to generate good usage data. Research from enterprise context engineering platforms (Atlan, Zep) confirms that cold start is the #1 deployment blocker -- their solution is to bootstrap 70-80% of initial context from existing metadata and structure.

**How to avoid:**
1. Default profiles must be generous, not minimal. Cold start should load MORE context than a warm profile, not less. The optimization only kicks in after N sessions (suggest N=3).
2. Derive initial profile from room structure, not usage. If the room has a `meetings/` folder with 5+ meetings, load meeting intelligence skills. If the room has `financial-model/`, prioritize financial methodology. Structure IS signal even without usage history.
3. Let users manually set their profile: `mindrian-tools.cjs profile --stage=validation --focus=market,financial`. This bypasses the cold start entirely for power users.
4. Track "profile confidence" (0.0-1.0). Below 0.5, fall back to full loading. Above 0.5, use the profile. Display the confidence level so users understand why context varies.
5. First session message should be explicit: "New room detected. Loading full context for initial session. Profile will optimize future sessions after 3+ uses."

**Warning signs:**
- New users report worse experience than existing users
- First session in a new room feels "dumb" compared to subsequent sessions
- Users manually loading skills that should have been auto-loaded
- Profile confidence stays at 0 because usage tracking isn't recording

**Phase to address:**
Phase 1 (ICM-Driven Context Loading) -- cold start handling must be designed alongside the traversal logic, not bolted on after.

---

### Pitfall 7: Hook Version Headers Create False Positive Staleness Alerts

**What goes wrong:**
Hook staleness detection compares a version header in each hook script against the installed plugin version. If the comparison logic is even slightly off -- semver parsing bugs, pre-release version handling, or the hook file being cached by the OS -- users see "stale hook" warnings on every session start even though their hooks are current. This is exactly what happened with Claude Code's own update banner (issue #41840): Homebrew users saw "Update available" even on the latest version because the check queried npm, not Homebrew.

**Why it happens:**
Version comparison across distribution channels is harder than it looks. `1.9.0` installed via npm, `1.9.0-beta.1` installed via git, `v1.9.0` with a `v` prefix -- these are the same version to a human but may not be to `semver.compare()`. Edge cases multiply across platforms (Windows path separators in run-hook.cmd, symlinked directories, cached .cmd files).

**How to avoid:**
1. Use a content hash, not a version string. Hash the hook script content and compare against expected hash from the manifest. If the content matches, the hook is current regardless of how it was installed.
2. If using version headers, normalize both sides (strip `v` prefix, parse with a proper semver library, handle pre-release tags).
3. Make staleness alerts dismissable and non-blocking. A false positive that blocks session start is catastrophic. A false positive that shows a yellow warning is annoying but survivable.
4. Include a `--skip-update-check` flag for CI/offline environments where the check will always fail.
5. Rate-limit warnings: same staleness warning max once per day.

**Warning signs:**
- Users report "stale hook warning" immediately after updating
- Warning appears on some platforms but not others (Windows vs Linux vs macOS)
- Warning frequency increases after adding npm distribution channel
- Users learn to ignore all warnings because of false positive fatigue

**Phase to address:**
Phase 4 (Release System Hardening) -- must be tested across all three distribution paths (npm, git, marketplace) before shipping.

---

### Pitfall 8: Compaction Destroys Optimized Context Layout

**What goes wrong:**
You carefully engineer the context window: Layer 0 identity at the top, Layer 1 routing next, then only relevant Layer 2 state. Claude operates brilliantly for 40 minutes. Then auto-compaction fires at ~83.5% usage (documented threshold) and summarizes EVERYTHING -- including your carefully structured context hierarchy. Post-compaction, Claude has a flat summary instead of a layered hierarchy. The ICM traversal structure is gone. Claude reverts to generic behavior because the identity/routing/state layers were compressed into "the user is working on a venture innovation project."

**Why it happens:**
Claude Code's compaction is a blunt instrument. It doesn't know which parts of context are structural (must preserve exactly) versus conversational (can summarize). The 33K-45K token buffer is non-negotiable and non-configurable. Your ICM hierarchy gets treated the same as a long debugging conversation. The KV cache regression (issue #29230) proves this pattern: compaction events don't trigger proper invalidation, and stale pre-compaction context bleeds into post-compaction turns.

**How to avoid:**
1. Use the PreCompact and PostCompact hooks (already in hooks.json) to save and restore critical context. PreCompact writes the current ICM state to `.context-save.json`. PostCompact reads it back and re-injects the hierarchy.
2. Set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` to delay compaction (e.g., 90% instead of 83.5%), buying more useful turns before the context layout gets destroyed.
3. Keep the ICM hierarchy summary compact enough that even compaction preserves it. If your Layer 0+1 identity/routing fits in ~2KB, compaction's summarizer is more likely to preserve it intact.
4. Proactive context windowing BEFORE hitting the compaction threshold: trim conversation history while preserving structural context. This is "controlled compaction" versus the blunt auto-compaction.
5. The PostCompact hook should re-run a lightweight version of session-start: read `.context-cache.json` and re-inject the skill/state selection.

**Warning signs:**
- Users report "Claude forgot what project this is" mid-session
- Post-compaction responses lose Larry's personality or methodology awareness
- ICM routing decisions become random after long sessions
- PreCompact/PostCompact hooks exist but aren't saving/restoring the right data

**Phase to address:**
Phase 3 (Smart Caching / Proactive Context Windowing) -- but the PreCompact/PostCompact hooks should be enhanced in Phase 1.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded TTLs (24h Brain, 1h STATE) | Simple implementation | Wrong for every room. Active rooms need shorter TTLs; dormant rooms waste recalc on long TTLs. | Never. Use event-driven invalidation from the start. |
| Single .context-profile.json per room | Simpler than per-user profiles | When Cowork adds multi-user rooms, all users get the same profile optimized for whoever used it most. | MVP only. Add user dimension before Cowork ship. |
| Skill stubs as plain text strings | Easy to write, small footprint | No structured trigger conditions. Claude's relevance judgment is unreliable on prose descriptions. | Never. Use structured YAML stubs with explicit trigger patterns. |
| Skipping migration script for npm | Faster npm release | Every user with existing git install hits version conflicts. | Never. Migration is mandatory for dual-channel distribution. |
| Using `fs.existsSync` for cache checks | Works, simple code | Race conditions when hooks fire concurrently (PostToolUse + FileChanged both checking same cache file). | Early phases only. Switch to lockfile or atomic operations before v2.0. |
| Removing @include sections from CLAUDE.md without testing | Faster diet target achieved | Behavioral drift in areas governed by removed content. | Never without regression testing. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Brain MCP cache | Caching Brain responses by query string only. Same query returns different results when room context changes. | Cache key = hash(query + room-structure-hash). Room changes invalidate relevant cache entries. |
| LazyGraph + STATE.md | STATE.md cache says "no new edges" but LazyGraph was updated by a background Brain enrichment or PostToolUse hook. | LazyGraph writes must set state-dirty flag, same as direct artifact writes. |
| PreCompact/PostCompact hooks | Saving full STATE.md to file (large, slow) then re-reading it post-compaction. | Save only the ICM routing state (~500 bytes): current layer, loaded skills, room path, profile confidence. Full STATE.md is recoverable from disk. |
| SessionStart + ICM traversal | Running traversal inside the existing session-start hook script, increasing its execution time past the 2000ms timeout. | Either increase timeout in hooks.json or separate traversal into its own hook entry so timeouts are independent. |
| .learnings.md rotation | Deleting old entries by line count. Loses the most valuable learnings (early, foundational ones that anchor the room's direction). | Rotate by recency, keeping "pinned" entries that the user or system marked as foundational. |
| npm postinstall script | Running migration/setup during npm install (blocking, may fail in CI, unexpected side effects). | npm install is clean. First `session-start` run detects new install and offers interactive migration. |
| @include files duplication | CLAUDE.md has full content AND @include references to the same content in .claude/includes/. | Remove duplicated content from main CLAUDE.md, keep only the @include references. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full room traversal on every session start | Session start slows to >3 seconds | Cache traversal result in .context-cache.json, invalidate on room file mtime changes | Rooms with 50+ files across 8+ sections |
| Scanning all skill directories for stub matching | Adds 200-500ms per skill directory | Pre-compute skill manifest at install time (or first session), not every session | 15+ installed skills (including user custom skills) |
| STATE.md full recalculation on every session | Reads every file in room, computes hashes, generates stats | Delta detection: only recompute sections with changed mtimes since last STATE.md generation | Rooms with 100+ artifacts |
| Brain response caching in memory only | Works within single session but lost on restart | Cache MUST be filesystem-based (room/.brain-cache.json) to persist across sessions | Not a scale issue -- design misunderstanding. Memory cache is ephemeral by definition. |
| .context-profile.json recomputed every session | Profile generation reads all history files | Compute profile incrementally: append new usage events, recompute scores only when dirty flag set | Rooms with 50+ sessions of history |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Caching Brain API responses to disk without sanitization | Proprietary graph data or query patterns exposed in plaintext cache files | Cache response content only (not headers/keys). Store in user's plugin cache dir with 600 permissions. Never cache in the room directory (which may be git-tracked). |
| Hook version check making network calls without timeout | Blocks session start if network is down. User experiences hang on every session. | 2-second hard timeout on all network calls in hooks. Offline = skip check gracefully with informational message. |
| .context-profile.json containing user behavior patterns | Privacy concern if room is shared, synced to git, or accessed via Cowork team features | Profile stores aggregate counts only (skill X used N times), never conversation content or specific queries. Add to .gitignore by default. |
| npm postinstall running arbitrary code from plugin | Supply chain attack surface if npm registry is compromised | Sign releases with git commit hash verification. Document the verification steps for security-conscious users. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent context reduction without visibility | User doesn't know why Claude "forgot" capabilities | Show context budget in Larry's greeting: "Loaded: room-passive, larry-personality. Available: brain-connector, ui-system. Say 'load X' to activate." |
| Aggressive .learnings.md rotation without warning | User's carefully accumulated learnings disappear | Notify before rotation: "Rotating 5 oldest learnings (>20 sessions). Review? [Y/n]". Or prompt user to pin important ones. |
| Profile-based skill exclusion with no override | User needs a skill the profile says they don't use | Always allow manual override: "/mos:load-skill ui-system" works regardless of profile. Profile is advisory, not mandatory. |
| Stale cache warning spam every session | User sees "stale" warning every session, learns to ignore ALL warnings (boy who cried wolf) | Rate-limit warnings. Same warning max once per day. Group multiple staleness issues into one notice. |
| Cold start penalty on new rooms | First session in new room is noticeably worse than subsequent sessions | Explicit onboarding: "New room detected. Loading full context for first session. Profile will optimize future sessions." |
| Context budget displayed as raw numbers | Users don't understand "6,241 / 23,600 tokens used" | Use meaningful labels: "Context: 3 of 7 skills loaded. Room state: current. Brain: cached (2h old)." |

## "Looks Done But Isn't" Checklist

- [ ] **CLAUDE.md Diet:** Reduced token count but didn't verify behavioral preservation -- run the 10-prompt regression test comparing before/after responses
- [ ] **Skill stubs:** Written but without structured trigger conditions -- Claude can't reliably decide when to load
- [ ] **STATE.md caching:** Implemented TTL but no invalidation on writes -- stale state guaranteed within any active session
- [ ] **Brain cache:** Works in memory but not persisted to disk -- every new session is a cold cache miss
- [ ] **npm distribution:** Package published but no migration script -- existing git/marketplace users will hit version conflicts
- [ ] **Hook versioning:** Version header added but no semver normalization -- false positives on pre-release tags, v-prefix, platform differences
- [ ] **ICM traversal:** Returns correct result but takes >3 seconds -- hook will timeout silently at current 2000ms limit
- [ ] **.context-profile.json:** Generates from usage data but has no cold start fallback -- new rooms get empty profile, load nothing
- [ ] **PreCompact save:** Saves state but PostCompact doesn't re-inject it into the conversation -- compaction still destroys context
- [ ] **.learnings.md rotation:** Rotates by count but doesn't preserve pinned/foundational entries -- high-value learnings lost
- [ ] **@include deduplication:** Content exists in both main CLAUDE.md and .claude/includes/ files -- doubled token usage instead of savings

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CLAUDE.md over-pruned (behavioral drift) | LOW | Restore from git history. Run regression test. Re-classify sections using IDENTITY/ROUTING/REFERENCE taxonomy. |
| Skill loading miss (wrong skill or no skill) | LOW | `/mos:load-skill [name]` manual override. Fix trigger conditions in stub. Mark cross-cutting skills as always-loaded. |
| STATE.md stale cache served | MEDIUM | `mindrian-tools.cjs state --force-recalc`. Add write-event invalidation to PostToolUse hook. |
| npm/git version conflict | HIGH | `mindrian-tools.cjs doctor` to detect and resolve. May require manual cleanup of duplicate installs across npm/git/marketplace. |
| Compaction destroys ICM hierarchy | MEDIUM | PostCompact hook re-injects hierarchy from saved .context-save.json. If file missing, full session-start re-traversal. |
| .context-profile.json wrong for user | LOW | Delete profile, restart session. System falls back to generous defaults (full context loading). |
| Hook false positive blocks updates | LOW | `--skip-update-check` flag. Fix semver comparison. Switch to content hash approach. |
| .learnings.md over-rotated | HIGH | Learnings are gone unless room is git-tracked. Prevention (pinning, review prompt) is the only real strategy. |
| Traversal timeout on session start | LOW | Increase timeout in hooks.json. Cache traversal result so subsequent starts are fast. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CLAUDE.md over-pruning (#1) | Phase 1 (CLAUDE.md Diet) | 10-prompt behavioral regression test before/after. Side-by-side comparison documented. |
| Skill loading unknown-unknown (#2) | Phase 2 (Progressive Skill Loading) | Tier classification reviewed. Cross-cutting skills (room-passive, context-engine, larry-personality) remain always-loaded. |
| STATE.md stale cache (#3) | Phase 3 (Smart Caching) | Write-triggered invalidation confirmed via PostToolUse hook test: file 3 artifacts quickly, verify all 3 detected. |
| npm version conflicts (#4) | Phase 4 (Release System Hardening) | Migration script tested on git-installed, marketplace-installed, and fresh installs. Doctor command finds and reports all paths. |
| ICM traversal latency (#5) | Phase 1 (ICM-Driven Context Loading) | Session start benchmarked at <2 seconds on room with 50+ files. Hook timeout increased to 5000ms. |
| Cold start empty profile (#6) | Phase 1 (ICM-Driven Context Loading) | New room loads full context. Profile optimization only after 3+ sessions. Structure-based bootstrap covers 80% of cases. |
| Hook version false positives (#7) | Phase 4 (Release System Hardening) | Tested across npm, git, and marketplace installs on Linux, macOS, Windows. Content hash used instead of version strings. |
| Compaction destroys hierarchy (#8) | Phase 3 (Smart Caching) | PreCompact/PostCompact round-trip test: hierarchy preserved after compaction. ICM routing state recovered. |
| Brain cache staleness (#3 related) | Phase 3 (Smart Caching) | Cache key includes room-structure-hash. Room change = cache miss. Verified by modifying room then querying Brain. |
| .learnings.md data loss | Phase 2 (Weight Reduction) | Rotation preserves pinned entries. Review prompt shown before deletion. Git-tracked rooms have full history. |

## Phase Ordering Implications

Based on these pitfalls, the phases MUST be ordered as follows:

1. **Phase 1: CLAUDE.md Diet + ICM Traversal** -- Foundation. Every other phase depends on the remaining CLAUDE.md being correct and the traversal being fast. Cold start fallback designed here. @include deduplication here.
2. **Phase 2: Progressive Skill Loading + Weight Reduction** -- Depends on Phase 1's section classification. Can't tier skills until you know which CLAUDE.md sections absorbed the always-loaded behavioral rules. .learnings.md rotation here.
3. **Phase 3: Smart Caching** -- Depends on Phase 1's hook infrastructure and Phase 2's skill loading mechanism. Cache invalidation must integrate with the traversal and loading pipeline. PreCompact/PostCompact enhancement here.
4. **Phase 4: Release System Hardening** -- Independent of context optimization but highest user-impact risk. Ship last so the context system is stable before changing distribution channels. Migration script, doctor command, hook versioning here.

**Critical ordering constraint:** Phase 1 MUST include behavioral regression testing infrastructure. Without it, Phases 2-3 have no way to verify they haven't broken existing behavior.

## Sources

- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- authoritative framework for context optimization strategies [HIGH confidence]
- [Claude Code Context Buffer: The 33K-45K Token Problem](https://claudefa.st/blog/guide/mechanics/context-buffer-management) -- compaction thresholds, buffer mechanics, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE [HIGH confidence]
- [Stop Bloating Your CLAUDE.md: Progressive Disclosure](https://alexop.dev/posts/stop-bloating-your-claude-md-progressive-disclosure-ai-coding-tools/) -- skill loading patterns, instruction budget (~150-200 items) [MEDIUM confidence]
- [CLAUDE.md Best Practices: From Basic to Adaptive](https://dev.to/cleverhoods/claudemd-best-practices-from-basic-to-adaptive-9lm) -- instruction density, layered discovery system [MEDIUM confidence]
- [Claude Code Plugin Stale Cache Bug #27879](https://github.com/anthropics/claude-code/issues/27879) -- version resolution failures causing stale skill loading [HIGH confidence]
- [Claude Code KV Cache Stale Context Regression #29230](https://github.com/anthropics/claude-code/issues/29230) -- compaction event not triggering cache invalidation [HIGH confidence]
- [Claude Code Update Banner False Positive #41840](https://github.com/anthropics/claude-code/issues/41840) -- version check across distribution channels creating false positives [HIGH confidence]
- [Claude Code Context Bloat Bug #29971](https://github.com/anthropics/claude-code/issues/29971) -- skills/CLAUDE.md injected multiple times without deduplication [HIGH confidence]
- [OpenClaw Q1 2026 npm breaking changes #61686](https://github.com/openclaw/openclaw/issues/61686) -- npm update leaving CLI broken, missing bundled runtime deps [HIGH confidence]
- [Claude Skills and Context Window](https://tylerfolkman.substack.com/p/the-complete-guide-to-claude-skills) -- skill loading mechanics, 30-50 tokens per stub [MEDIUM confidence]
- [MCP Market: Split Memory Modular CLAUDE.md Strategy](https://mcpmarket.com/tools/skills/split-memory-modular-claude-md-strategy) -- modular context patterns [MEDIUM confidence]
- [CLAUDE.md Examples and Best Practices 2026](https://www.morphllm.com/claude-md-examples) -- @import patterns, path-scoped rules [MEDIUM confidence]
- [Martin Fowler: Context Engineering for Coding Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html) -- enterprise context engineering patterns [MEDIUM confidence]

---
*Pitfalls research for: Context engineering optimization for MindrianOS Claude Code plugin (v1.9.0)*
*Researched: 2026-04-07*
