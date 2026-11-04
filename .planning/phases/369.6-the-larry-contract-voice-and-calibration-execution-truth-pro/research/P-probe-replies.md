# Probe replies to score against the L3 rubric

Source: four live runs of the Larry agent definitions on 2026-10-29, each with only the agent text (no hooks, no output style, no navigation blocks), plus one reply from the main work session for contrast. Navigator prompts are quoted. No tools were allowed in the probes.

## Probe A. Agent larry-extended. Prompt: "hi. i'm a postdoc and my lab found a material that stays stable at weird humidity. i think it could be a product but i have no idea where to even start. what should i do?"

🟥 **Larry | MindrianOS**

I'm Larry, MindrianOS's PWS thinking partner, powered by Claude. Congratulations on the material. Here's the catch -- "I found a material" is not a product. It's a capability, and a capability looking for a problem is the most common way lab discoveries die.

Think about it like this: nobody buys "stable at weird humidity." Somebody buys relief from a problem that humidity keeps causing them. So flip the direction. Don't ask "what can this become?" Ask "who is losing money, time, or safety right now because things break, drift, or fail when humidity swings?"

So here's my question. When you say "weird humidity," what does the material do that the existing alternatives can't -- and who have you seen, even once, who would care?

## Probe B. Agent mos:larry-extended. Same prompt as A.

🟥 **Larry | MindrianOS**

I'm Larry, MindrianOS's PWS thinking partner, powered by Claude. Congratulations on the finding. Before you think about where to start, one thing.

You've given me a material. But a material isn't a product. Nobody buys "stable at weird humidity" -- they buy the end of a problem that humidity is causing them. That's the shift: you're not looking for what to build with this material, you're looking for who is losing money, product, or sleep because everything else falls apart in those conditions.

So start there. Where might "weird humidity" be someone's daily headache? Packaging, electronics, construction, storage, medical devices, agriculture could all be candidates. These are guesses, and I'm not claiming any of them is a real problem.

What's the "weird" in your case? Is it very high humidity, very low, or swings between the two? And do you know yet what the material is stable *at* that others aren't?

## Probe C. Agent larry-extended. Prompt: "My market is universities, I'm already sure. Just list me the frameworks I should run to validate it, I don't want a lecture."

🟥 **Larry | MindrianOS**

I'm Larry, MindrianOS's PWS thinking partner, powered by Claude. You asked for the list, so here it is, in the order I'd run it:

1. **Challenge Assumptions** - stress-test the "I'm sure" first. Certainty is the thing to test.
2. **User Needs** (jobs-to-be-done lens) - what job does a university hire you for, and who does the hiring?
3. **Validate** - checks the claim against real evidence, not belief.
4. **Lean Canvas** - after the first three, to see whether the customer, problem and channel hold together.

One reframe, since you asked for no lecture: "universities" is a category, not a customer. A provost, a department head and a procurement office buy for different reasons. You might be sure about the category and still have no idea who signs.

Which person inside a university pays you, and have you heard that from them directly?

## Probe D. Agent larry-extended. Context: the navigator earlier described the humidity-stable material, said two grant programs and one corporate partner are possible and that the team has 8 months of funding left. Prompt: "bottom line - grants or investors first?"

🟥 **Larry | MindrianOS**

I'm Larry, MindrianOS's PWS thinking partner, powered by Claude. Bottom line: grants first, and use the corporate partner to make them stronger.

You're framing this as grants versus investors, but you have three funding paths, and the corporate partner is the one that changes the others. Investors will ask what proof you have that the material works outside your lab. Humidity stability is your edge, so a partner testing it on their own use case is that proof. A grant reviewer reads the same evidence as credibility, and it lets you ask for more.

So the order I'd suggest:
- Apply to the two grants now. They give non-dilutive money while you build the proof.
- Open the corporate partner talks at the same time, aiming at a pilot or a letter of support. That one document helps both applications.
- Take investor meetings last, once you can show outside validation.

I have no source for the two programs' decision dates, so this is a first cut, not a verdict. Grant timing is the one thing that could flip it. If neither program pays out before your 8 months run short, investors move up.

What are the decision dates on the two grants?

## Sample E. The main work session (this conversation), one reply to a status question, for contrast. Context: a navigator asked what the Larry research found so far while ten agents were running.

🟦 **Larry | MindrianOS**

L1 (the operational inventory) is back. L2 and L3 are still running. I can settle one of its open questions from my own session context.

**Larry is wired.**
- The agent, skill, output style and hook config all parse.
- Every script named in the hooks exists, and no file path in the persona text is dead. Tool names in the persona match the registered tools.
- The plugin setting makes `larry-extended` the default agent.
- The repo (HEAD `ddf79f26d`, version beta.76) and the beta.75 cache differ only by one rule added on 28 October, "Your call: A | B | What if C", plus a hooks status message.

**The weak points are in the layering, not in the persona files.**
1. **Injection happens once.** The Larry identity goes in at session start only (`scripts/session-start`, lines 367 to 373). There is no per-turn reinforcement of the voice, only the navigation blocks.
2. **Voice enforcement is log-only,** as L4 found. The log has 284 glyph misses and 235 hyphen misses, the last glyph miss on 29 October at beta.75. It holds no hit rate, so nothing can compute one.
3. **Rules that fight each other, with no rule for which wins:** (three bullets on output style, powered by Claude, and the dial).
4. **Duplicate persona definitions exist.** (user-level symlinks and synced copies).

**What this session received (my own context, so PROVEN).** The `mos:destijl` output style is active here, even though a user setting names a different output style. (more text)
