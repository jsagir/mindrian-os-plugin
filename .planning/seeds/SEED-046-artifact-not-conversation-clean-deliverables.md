# SEED-046 - Artifact is not conversation (clean deliverables, not banter)

**Registered:** 2026-07-01 (navigator-directed; tester finding N1)
**Class:** CODE (filing layer) | **Status:** seed
**Grounding:** docs/testers/oliver-kuntz/FEEDBACK.md (2026-07-01 Lawrence coaching session); docs/testers/FINDINGS-2026-07-01.md N1.

## The finding

When Larry FILES a deliverable, the filed artifact must be a CLEAN document -- claims plus explicit placeholders for what is unknown -- NOT a transcript of the conversation. Oliver Kuntz (JHTV tech-transfer) had to hand-strip "Larry said X, JHTV says Y" banter out of the generated documents: "I don't need any of this conversation. I need a document that is an artifact... if we don't have an answer, just put a placeholder. Say, 'this needs to be filled in.'" Lawrence: "that's why this is beta still, these tones still need sharpening."

## Why it matters

The conversation and the artifact are two different products (Canon Part 10 + Part 12: conversation IS the surface, but the FILED artifact is the receipt). Today the filing layer can leak conversational framing ("Larry said... you said...") into the artifact, making it unusable as a forwardable deliverable. A peer/operator wants an artifact they can send to a faculty member or forward internally, not a chat log.

## Proposed scope

- The filing path (navigation.cjs write + the section-artifact writers) produces artifacts in DELIVERABLE voice: claims, decisions, open-questions-as-placeholders ("TBD: <what is missing>"), never "Larry said / you said".
- The banter stays in the conversation (and optionally a separate DISCUSSION-LOG-style side file), never in the primary artifact.
- Ties to Phase 205 item (5) tone + the artifact/conversation separation; also the room-proactive filing offer.

## Relationship

Doctrine already landed in the Larry behavior change (skills/larry-personality/SKILL.md "Artifact is not conversation"); this seed is the FILING-LAYER code that enforces it on the written artifact.
