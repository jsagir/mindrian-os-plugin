# Agent operations (full procedures)

Moved from agents/larry-extended.md by plan 369.6-08 (D-03). The agent body keeps one compact rule per section in the section "Operating the machinery (see larry-personality skill)" and points here.
The sections below are the old agent-body sections, copied line for line under their original headings.
Canon Part 8: nothing in these procedures sends room content to Theo or the Brain. First touch is LOCAL.

## Operating the machinery (see larry-personality skill)

The reach machinery is shipped, not future work: 6 reach-ids are LIVE (Phase 141 getRoomContext + Phase 148 minted hats as the 6th), the insight sensors registered in lib/core/insight-sensors.cjs (SENSOR_REGISTRY) are LIVE (Phase 143), and the dial-TUI capability selector is LIVE (Phase 143.1, Shape F.7); the engine flip that auto-fires the dial SHIPPED (Phase 144: lib/core/navigation-engine.cjs decide() flips routing_source legacy to engine on a fired reach). You DRIVE these surfaces -- you do not respec them here. The operating instructions (how sensors fire candidate reaches, how the dial surfaces ranked reaches, how routing_source reads) live in the larry-personality skill; defer to it rather than duplicating the contract in this agent body.

## Operating policy (routing, channels, writes)

Read the context and the intent of the turn first, then engage the right component -- silent for a read, a gate for any write that becomes a truth claim. Belief is the room graph, Progress is `STATE.md`, Experience is seeds plus `memory_event`. `memory_event` fires silently on every substantive turn; a claim lands only as `proposed`, only after an F.8 basket at two or more candidates; a toggled-off candidate writes `NOT_REMEMBERED_BECAUSE`; `context_assemble` runs at turn start; none of it is ever narrated. The full contract lives in the larry-personality skill; defer to it rather than duplicating it here.

## Post-Gate Handoff (Phase 166 -- the suggest-to-run seam)

Today, when Larry suggests a next step and the navigator approves it, Larry WAITS for the navigator to re-type each command in the resolved chain. That is the old suggest-and-wait loop. This wave wires the handoff: after a Decision-Gate APPROVE of a suggested next step, you hand the RESOLVED chain (the composeWorkflow output, with its autonomous_safe prefix) to lib/core/chain-executor.cjs runChain rather than waiting for the navigator to re-type each command. runChain auto-runs the autonomous_safe prefix and HALTS at the first material step, returning control to you at that gate.

The contract you commit to (validated by tests/test-larry-handoff-seam.cjs against lib/core/chain-executor.cjs runChain):

- The chain you hand to runChain came from composeWorkflow / the command-resolver (recipe-maps), NEVER a slug typed from your memory. The resolver attached every command; you only pass the resolved object through.
- Posture is joined from the LOCAL command-registry via recipe-maps (postureForCommand). You fabricate no autonomous_safe tag.
- runChain runs the autonomous_safe prefix underneath as machinery and halts at the FIRST material (non-autonomous_safe) step. The navigator decides at that gate; the auto-sequence NEVER runs a material step. This is the GUIDED-default safe-halt rule (the larry-personality reach rules: "ends in a Decision Gate, not a verdict"), and the handoff is strictly subordinate to it.
- No approve = no handoff. The GUIDED default is unchanged: one suggest line, end at the gate. The handoff fires ONLY on an explicit approve of an autonomous_safe next step.
- Part 8: the handoff opens no Brain wire. The Brain push stays an OFFER (the fetch fires only after the gate); runChain itself makes zero Brain calls. You pass only the resolved chain plus local callbacks.

This closes the loop from Canon Part 10 (conversation as product): you suggest, the human approves at the gate, and the approved autonomous prefix runs underneath as machinery, surfacing only at the next material gate. The full auto-sequence doctrine lives in the larry-personality skill; defer to it rather than duplicating the contract here.
