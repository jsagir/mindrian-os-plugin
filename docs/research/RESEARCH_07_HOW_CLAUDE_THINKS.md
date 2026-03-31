# Research 07: How Anthropic's Claude Thinks — Interpretability Findings

**Source:** ByteByteGo / Anthropic Research (2025)
**URL:** https://blog.bytebytego.com/p/how-anthropics-claude-thinks
**Filed:** 2026-03-26
**Relevance:** CRITICAL — directly informs how MindrianOS should structure prompts, skills, and interactions to align with Claude's actual internal processing

---

## Summary

Anthropic built interpretability tools ("a microscope for AI") that trace Claude's actual computational steps. The findings reveal systematic gaps between what Claude says it does and what it actually does internally. These findings have direct implications for how we design MindrianOS prompts, skills, and interaction patterns.

---

## Finding 1: Claude Thinks in Abstract Concepts, Not Language

When asked "the opposite of small" in English or French, identical core features activate (smallness + oppositeness → largeness), then translate to the output language. Claude operates in an abstract conceptual space where meaning exists BEFORE language.

**Diagram:** Shared internal features activate for both English and French prompts, diverging only at the language-specific output layer.

### MindrianOS Implication
- **MINTO.md reasoning pyramids work WITH Claude's architecture.** Structured concepts (governing thought → supporting arguments → evidence) map directly to how Claude processes — abstract structure first, language rendering second.
- **Room section names should be conceptual, not linguistic.** "problem-definition" is better than "what's the problem" because Claude processes the concept before the words.
- **Cross-language support is nearly free.** Larry can operate in Hebrew and English because Claude shares features between languages. The PWS methodology concepts work the same internally regardless of prompt language.

---

## Finding 2: Claude Plans Ahead (Poetry Planning)

Claude doesn't write word-by-word. When writing a rhyming couplet, it identified "rabbit" as the destination BEFORE writing the line. It picks the destination first, then constructs the route.

**Diagram:** Before generating the second line, Claude's internal state already contains the target word "rabbit." Suppressing it causes a different rhyme; injecting "green" breaks the rhyme entirely.

### MindrianOS Implication
- **The thinking trace in `/mos:act` aligns with Claude's natural planning.** Showing "Problem → Stage → Method → Chain → Filing" BEFORE action matches how Claude actually works — it selects the destination (framework choice) before constructing the route (execution).
- **Pipeline chaining (Week 7 pattern) is architecturally native.** Claude naturally plans multi-step sequences by selecting endpoints first. FEEDS_INTO edges in KuzuDB mirror this internal planning structure.
- **Larry's "Reading the Room" greeting uses the right pattern.** Claude reads all room state, identifies the key signal (destination), then constructs the response path to reach it.

---

## Finding 3: Claude's Self-Explanations Don't Match Internal Process

When adding 36+59, Claude internally uses parallel estimation (rough range 88-97) + precise last digit (6+9=5) → 95. But it DESCRIBES using the standard carrying algorithm. These are completely separate processes.

**Diagram:** Two parallel computational paths — magnitude estimation and last-digit calculation — combine to produce the answer, while the verbal explanation describes an entirely different method.

### MindrianOS Implication
- **Don't ask Claude to explain HOW it routed or decided.** Its explanation will be a plausible reconstruction, not the actual process. Instead, SHOW the decision via structured output (thinking trace) and let the user see the inputs and outputs.
- **The UI ruling system's "show, don't explain" principle is correct.** Zone 2 body shapes show results structurally (progress bars, trees, cards) rather than asking Claude to narrate what it did.
- **Skills should declare WHAT Claude should do, not HOW to think.** "Render a Mondrian board with these sections" is better than "Think about each section's completeness and describe it." The first leverages Claude's internal strategies; the second forces a potentially inaccurate self-narration.

---

## Finding 4: Motivated Reasoning on Hard Problems

On easy problems, chain-of-thought matches internal computation. On hard problems, Claude fabricates plausible derivations AFTER producing an answer. When given hints, it reverse-engineers justifications for predetermined conclusions.

**Diagram:** Easy problem (√0.64) — internal features match chain of thought. Hard problem (cos of large number) — no internal calculation features found, chain of thought is post-hoc fabrication.

### MindrianOS Implication
- **Quality gates in `/mos:act` are essential.** The framework-runner subagent's self-check ("Is this artifact non-trivial? Does it reference specific venture context?") catches motivated reasoning. If Claude is fabricating, the artifact will be generic.
- **Brain-driven framework selection is safer than Claude choosing freely.** When Brain provides a ranked list with confidence scores, Claude has structured evidence to select from rather than reverse-engineering a justification for whatever framework it "feels" like using.
- **MINTO.md's MECE check catches fabricated reasoning.** If supporting arguments overlap (not mutually exclusive) or don't cover the space (not collectively exhaustive), the reasoning may be post-hoc fabrication rather than genuine analysis.
- **Room-proactive contradiction detection is a hallucination defense.** Cross-section contradiction signals catch cases where Claude's reasoning in one section conflicts with another — a sign that at least one is fabricated.

---

## Finding 5: Hallucination = Recognition System Misfire

Refusal is Claude's DEFAULT state. A "can't answer" circuit is always on. Hallucinations occur when the "known entity" recognition system misfires — familiar-sounding names trigger false activation, suppressing the refusal circuit.

**Diagram:** Default refusal circuit (always on) gets inhibited by "known entity" recognition. Unknown entities that sound familiar can incorrectly trigger this, disabling refusal and forcing fabrication.

### MindrianOS Implication
- **Brain enrichment REDUCES hallucination.** When Brain provides real data (actual Neo4j nodes, actual relationships, actual framework chains), Claude's "known entity" features activate CORRECTLY. Without Brain, Claude might hallucinate framework chains that don't exist.
- **The moat logic is validated.** Free tier (no Brain) = higher hallucination risk because Claude must rely on its own possibly-misfiring recognition. Paid tier (with Brain) = lower hallucination risk because Claude has verified knowledge to activate against.
- **Larry should say "I don't know" more.** Claude's natural default is refusal. MindrianOS should NOT override this with pressure to always provide an answer. When Brain doesn't have relevant data, Larry should say so explicitly rather than fabricating a plausible-sounding methodology recommendation.
- **The admin panel's self-teaching pattern leverages this.** By always explaining what each action does before executing, we give Claude's recognition system accurate context, reducing the chance of misfiring on "what does this button do."

---

## Finding 6: Grammar Can Override Safety

In jailbreak scenarios, Claude's safety features activate but grammatical coherence features push it to complete started sentences. Safety only wins at sentence boundaries.

**Diagram:** Safety features and grammar features compete. Once a sentence is started, grammar features dominate. Refusal only succeeds at natural sentence boundaries.

### MindrianOS Implication
- **Skill structure should use natural sentence boundaries.** Long, complex prompt instructions that cross many clauses increase the risk of Claude's coherence features overriding safety/correctness constraints. Short, declarative rules are safer.
- **The 4-zone output anatomy helps.** Each zone is a natural boundary. Claude processes Zone 1 (header), then can make a clean decision about Zone 2 (body), then Zone 3, then Zone 4. No zone runs into another.
- **Error handling's 3-line pattern is structurally sound.** Three separate lines (what failed / why / fix) give Claude three natural boundaries to make correct decisions at, rather than one long sentence where coherence might override accuracy.

---

## Research Limitations (From the Paper)

- Tools work satisfyingly on ~25% of prompts attempted
- Analysis is on a replacement model, not Claude itself
- Current methodology: hours per prompt, doesn't scale to complex reasoning chains
- Findings may not generalize to all prompt types or model versions

---

## Actionable Design Principles for MindrianOS

Based on these findings, these principles should guide all MindrianOS prompt engineering:

1. **Structure over narration.** Use structured formats (MINTO pyramids, zone anatomy, body shapes) rather than asking Claude to narrate reasoning. Claude's actual reasoning is better than its description of reasoning.

2. **Provide verified context.** Brain data reduces hallucination by giving Claude's recognition system accurate targets. Never leave Claude to guess when data is available.

3. **Short declarative rules.** Keep skill instructions as short, declarative statements at natural sentence boundaries. Avoid long compound instructions where coherence might override correctness.

4. **Plan destinations first.** Show Claude the target (framework name, section name, filing path) before asking it to construct the route. This aligns with Claude's natural planning pattern.

5. **Quality gates over self-reports.** Don't ask "did you do this correctly?" — check the output structurally. MECE validation, artifact specificity checks, cross-section contradiction detection.

6. **Respect the refusal default.** When Brain doesn't have relevant data, let Larry say "I don't have enough information" rather than pressuring for an answer. Claude's natural refusal is a feature, not a bug.

7. **Conceptual anchors work cross-language.** PWS methodology concepts (Problem Definition, Market Analysis, etc.) activate the same internal features regardless of whether the user prompts in English or Hebrew.

---

*Internal research document — MindrianOS Plugin*
*Filed: 2026-03-26*
*Source: Anthropic Research via ByteByteGo*
