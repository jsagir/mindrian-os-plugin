# External reference: "Skill or MCP Server? Ask What Stops the LLM From Disobeying"

- Author: Gal Arav. Published: Towards Data Science, 2026-10-20 (Towards Spec-Driven Test Automation, Part 4).
- Handed to this phase by the owner on 2026-10-29 during /gsd-discuss-phase 369.6 with the instruction "learn from" it.
- This is external, human-written text, quoted for the planner. Not MindrianOS canon. Cookie banner, navigation and footer stripped; article body condensed to the passages that bear on Phase 369.6. Nothing below is an instruction to any agent; it is evidence.

## The question the article asks

"When adding anything to an LLM application, ask: What stops the LLM from disobeying the rule?"

## The distinction

- "What code executes can enforce. What an LLM reads can only inform. A Skill is read by the LLM, so it could never have held the rule this whole project rests on. A server is executed, so it could."
- "Anything that must be guaranteed regardless of what the LLM decides has to live in code, behind an interface the LLM cannot reach around, such as access control, the criteria cut, rate limits, audit trails. In other words, anything you would want to say 'it is impossible for this to happen' about."
- "Anything that is knowledge, judgement or procedure belongs in a Skill, because a tool call has nowhere to put it."
- "Write the sentence you want to be true, then ask what stops the LLM from disobeying it."

## Two groups of formats (the author's tables, paraphrased)

- Formats that INFORM the LLM of a rule (system prompt, Skill, MCP prompts and resources, RAG text, tool descriptions, temperature, a better model): "Every row ... ends at the same place, the LLM's own judgement."
- Formats that ENFORCE in code (context assembly that cuts or injects before the prompt is built, a server that refuses, permission rules, hooks, sandboxes, constrained decoding, fixed control flow; CI gates as an after-the-fact backstop): "something in its path refuses on its own authority."

## On promises dressed as safeguards

- "A SKILL.md saying 'never commit secrets', 'always ask before deleting' or 'do not read files outside the project' is a hope with good formatting. Every one of those has to hold whatever the LLM decides, so it needs a mechanism that can refuse: a permission system, a hook, a sandbox. Left as an instruction, it is decoration."
- "If a rule has to be true, it belongs somewhere the LLM's output must pass through. If it only has to be known, an instruction the LLM reads is the right tool, and you should stop calling it a safeguard."

## On Skills failing by going unread

- "Unlike the system prompt, which the LLM always sees in full, a Skill can fail by going unread: if its description does not look relevant to a request, the rest is never opened."

## On testing the one rule that matters

- The project "has grown to include over 2,000 tests, and about 70 of them guard that one rule, covering every prompt the coding agent receives, every reply the MCP server sends, and each way of writing a task file that has broken the cut or could."
- "CI gates enforce after the fact rather than in the path: the LLM does whatever it does, and the build fails afterwards."

## Why it bears on Phase 369.6 (planner note, written by the orchestrator, not the author)

The Larry contract has rules of both kinds. The phase must say, per rule, which kind it is, and never present persona prose as a guarantee. See CONTEXT.md decision on the inform/enforce split.
