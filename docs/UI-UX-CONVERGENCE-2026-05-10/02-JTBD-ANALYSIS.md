---
methodology: analyze-needs (+ user-needs scoring)
created: 2026-05-10
depth: deep
problem_type: ill-defined / complex
venture_stage: Design
room_section: market-analysis
brain_mode: mode-a confirmed (produced Tier 0 while Aura was paused; re-run 2026-05-10 -- graph confirms JTBD HAS_PROCESS_STEP [Identify Situation / Define Need / Expected Outcome], FEEDS_INTO Process Mapping for Innovation, TYPICAL_AT "Opportunity Identified"; see 00b)
---

# Jobs To Be Done -- The Stuck Founder Using MindrianOS

The job-step matrix below doubles as the `/mos:user-needs` importance-satisfaction scoring.

## Customer

Not a segment. The product's own spec named her: **a founder who is stuck on a decision right now and cannot name it** (Phase 115 owned-emotion). Concretely, the two faces in `docs/testers/`: the Wave-2 tester (cautious, runs Claude Code across several projects, reads what tooling tells him, evaluating MindrianOS for a Hopkins advisory board) and Lawrence Aronhime (heavy daily user, lives in multiple rooms, first to find every bug). She is *not* the founder satisfied by her journal / co-founder / advisor call -- the owned-emotion spec is explicit that person isn't in the market. She's the one those workarounds are *failing*.

## Job statement

**When I'm carrying a venture decision I can't even articulate -- too tangled to name, too heavy to ignore -- I want to get its shape onto the table fast, so I can stop circling it and actually move.**

The progress: *from circling to moving.* The struggling moment: the instant she realizes sleeping on it isn't working.

## Job steps -- importance / satisfaction / gap

| Step | What she's doing | Imp | Sat | Gap | Note |
|---|---|---|---|---|---|
| **Define** | Recognize the stuck feeling, decide to act | 10 | 3 | **7** | The emotion is intense; nothing in her world is built to receive it; she has no language for it -> doesn't search. Phase 115 first-touch ("What decision is stuck?") is the fix -- in transition. |
| **Locate** | Install, get past Claude Code's third-party warning, get it running | 8 | 2 | **6** | the tester's saga: Windows long-path failure, `install.sh` dies, warning reads as a hard no, npm 404, leaked Brain key. Lowest satisfaction in the journey. Phase 95.6, NATO deadline. |
| **Prepare** | First session -- orient, understand what's running, set context (which project, what's my job, dump material) | 7 | 3 | **4** | "Does it run in every Claude project?" (the Wave-2 tester, answered nowhere). "I set a JTBD and nothing changed" (Phase 104). Empty room, no guidance (Lawrence's P1, open since March). |
| **Execute** | Work the decision -- talk to Larry, run methodologies, file insights, the room captures | 9 | 5 | **4** | Core value, mostly works (Larry's pedagogy intrinsic; Tier 0 functional). But the picker is generic AskUserQuestion, the Navigation Engine isn't wired (skill activation = "legacy file-state behavior"), Desktop conversational rendering undesigned. |
| **Monitor** | Track where the venture stands -- which room, what state, what decided, what stale | 9 | 4 | **5** | Lawrence's "core power" bug: statusline showed the wrong active room. Typed "8," got the wrong one. On Desktop there's no statusline at all. The canary lied. |
| **Modify** | Revise -- a decision regressed, an assumption went stale, a meeting changed everything | 8 | 5 | **3** | Bidirectional progression is canon, cascade edges exist, `/mos:heal` shipped. But the brain-derivation queue doesn't auto-drain (entries sit days); FEYNMINTO budget blocks mega-section MINTO regen. Degrades at venture scale. |
| **Conclude** | Walk away with something -- a shape on the table, a banked opportunity, an artifact to show the board | 8 | 4 | **4** | "Room as receipt" (Phase 119) not formalized; 30-second MVA (Phase 118) not built; SnapshotHub not shipped. She wanted a shape on the table; gets a folder of markdown -- closer to the journal she was escaping. |

**Gaps, ranked: Define (7) > Locate (6) > Monitor (5) > Prepare / Execute / Conclude (4) > Modify (3).**

## Blocked steps

| Step | Blocker | The give-up moment | Current workaround |
|---|---|---|---|
| Locate | Functional | Claude Code refuses install "for the umpteenth time," or git clone dies on a Windows path, or npm 404s | Forward it to Lawrence to forward to Jonathan; ask for a call; or don't install. *Do-nothing wins by default.* |
| Define | Emotional + Social | The stuck-ness never crystallizes into "I should find a tool for this" -- no language for the feeling, so no search | Journal, vent to a co-founder, sleep on it, call an advisor. The blocker bites exactly the founders those fail. |
| Monitor | Functional + Emotional | Opens a session, statusline says room X, works for an hour, discovers she was in room Y -- now distrusts the tool to know where she is | Manually `/mos:rooms` every session, re-state the room, keep a separate note of "which room am I supposed to be in" |
| Conclude | Social | Wants to show the board "here's the shape we found"; what she has is a folder of `.md` files | Hand-build a deck, or describe it out loud |

## Opportunity clusters

| Cluster | Blocked steps | Dimensions aligned | Size | Maps to |
|---|---|---|---|---|
| 1. "Meet me where I'm stuck" | Define + Prepare | Functional + Emotional + Social -- she feels *seen*, gets *oriented*, can *explain* what she's doing | Every owned-emotion subject = the entire addressable market by construction | Phase 114 / 115 / 117 / 104 |
| 2. "Get it running, keep it scoped" | Locate | Functional only -- but it's the gate; nothing downstream matters if it fails | Every new user; actively losing testers *now* | Phase 95.6 |
| 3. "Know where I am" | Monitor + Modify | Functional + Emotional (trust) | Every multi-room user = every user who stays past week one | Room-identity surface; brain-queue drain; cascade reliability at scale |
| 4. "Hand me something to show" | Conclude | Functional + Social | Every founder with stakeholders = every founder | Phase 118 / 119 + v1.14.0 SnapshotHub |

## The read

**Cluster 1 is the highest-leverage opportunity** -- it's the struggling moment itself, and all three job dimensions align there; it's also the only defensible market boundary (the owned-emotion subject *is* the customer; everyone else has a satisfying workaround). **But Cluster 2 ships first** -- not because it's the biggest, but because it's the broken floor (Kano: fix the must-have before the delighter). **And the biggest competitor is the founder doing nothing** -- journaling, sleeping on it, the co-founder chat. Every gap above is a comparison against *that*. The Conclude gap is the cruel one: finish a session with a folder of markdown and you've handed her a fancier version of the journal she was escaping.

> Cross-reference: `09` -- Cluster 1 ("meet me where I'm stuck") and Cluster 4 ("hand me something") are precisely the clusters that depend on the Brain + the Act-1 algorithmic engine *firing* on first material. They're dormant because the trigger (Navigation Engine) isn't wired.
