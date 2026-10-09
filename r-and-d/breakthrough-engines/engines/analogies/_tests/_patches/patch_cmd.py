import sys
def patch(p):
    s=open(p,encoding='utf-8').read()
    def rep(old,new):
        nonlocal s
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    rep('''- `/mos:find-analogies --brain --external` -- All sources combined
''','''- `/mos:find-analogies --brain --external` -- All sources combined

**Contract (2026).**
- Inputs: an optional focal problem or domain argument; `room/STATE.md` and room entries; for `--brain`, the Brain MCP; for `--external`, the navigator's approval of the audited query set.
- Outputs: a ranked comparison matrix (Step 5) with a band, a measured fused score and its percentile when the engine ran, a per-candidate source trail (source id or URL, retrieval date, the extracted sentence, novelty-check status), and files under `room/<section>/analogies/` only.
- Failure behaviour: no room -> the 3-line error and stop; encoder unavailable -> qualitative band words only, no numbers; Tavily and WebSearch both failing -> say so and continue with the candidates already in hand; fewer than 2 candidates survive -> report that plainly and offer the Step 6 "weak results" move rather than padding the list.
- Stop when: the matrix and the top-2 structural mappings are shown and the single Step 6 card is fired. Do not re-run the engine or re-fetch unless the navigator asks.
''')
    rep('''Display the decomposition:
''','''`triz-matrix.json` is a PARTIAL contradiction matrix (about 45 percent of cells, parameter 32 duplicated). Use the TRIZ parameter names in `triz-principles.md`. If the matrix has no cell for the contradiction, say "no matrix data" and offer principles as hypotheses, never as a matrix result.

Display the decomposition:
''')
    rep('''Prioritize FAR and CROSS-DOMAIN analogies -- near-domain analogies are obvious and less valuable.
''','''Prioritize FAR and CROSS-DOMAIN analogies -- near-domain analogies are obvious and less valuable.

Tier 0 candidates come from model memory, not from a retrieved source: label them "unverified (model recall)", never attach a URL or citation you did not retrieve, and set their `novelty_check` to `not_checked`.
''')
    rep('''default under fork mode, the interactive default since 2.1.232. The platform caps concurrent
subagents at 20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); a handful of query agents stays well
under that cap, but the 20 ceiling is the standing rule so a future author does not reintroduce
an unbounded fan-out.''','''default. Stay within the fan-out cap above and never exceed the platform's concurrent-subagent
limit (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); a handful of query agents is far under it, and
the cap is the standing rule so no one reintroduces an unbounded fan-out.''')
    rep('''`{title, url, source_domain, sapphire{7 fields}, distance_class}`.''','''`{title, url, source_domain, retrieved_at, evidence, sapphire{7 fields}, distance_class, novelty_check}`
  (`evidence` is a verbatim sentence from the result; an unsupported SAPPhIRE field is `""`).''')
    rep('''3. Apply the existing restatement rule verbatim: a restatement can never sit at Rank 1.''','''3. Apply the restatement rule: the runner never places a flagged restatement at Rank 1 while a non-restatement exists (it lifts the best non-restatement; `--legacy-rank` disables this). If EVERY candidate is flagged, say so plainly instead of presenting a leader.
3b. **Novelty status, room scope only.** Compare each top candidate's mechanism with existing `room/**/analogies/*` files. Set `novelty_check` to `prior_found` (cite the file) or `room_checked_no_prior`; otherwise leave `not_checked`. Never write "novel" or "unprecedented": the check covers the room, not the literature.''')
    rep('''3. Use the returned `rows` (rank, band, fused, restatementFlag) and `provenance` to render Step 5. The numbers are MEASURED; never hand-compute a decimal.''','''3. Use the returned `rows` (rank, band, fused, fusedPercentile, restatementFlag, source_trail) and `provenance` to render Step 5. The numbers are MEASURED; never hand-compute a decimal.

   Ranking is band first, then fused score, with ties broken by candidate id, so a rerun gives the same order. By default (`--rank-mode percentile`) the per-layer correspondence thresholds and the restatement trip come from the candidate set itself (needs 5 or more candidates; with fewer the runner uses the fixed 2025 thresholds and prints `threshold mode: fixed`). Pass `--rank-mode fixed` to reproduce the 2025 behaviour. Print the `threshold mode` line the runner returns under the matrix; a percentile is relative to THIS candidate set and says nothing about candidates that were not scored.''')
    rep('''each candidate carries `{id, domain, text, sapphire:{state_change, action, parts, phenomenon, input, real_effect, effect}, source_tier, source_date?}`''','''each candidate carries `{id, domain, text, sapphire:{state_change, action, parts, phenomenon, input, real_effect, effect}, source_tier, source_date?}` plus, for fetched candidates, `{source_url, retrieved_at, evidence, novelty_check}` (flatten each SAPPhIRE layer to one string as described in `sapphire-encoding.md`)''')
    rep('''1. **Strong analogy found (fitness > 0.6):**''','''1. **Strong analogy found (Structural or Deep band, and fused score at or above the 80th percentile of this run when 5 or more candidates were scored):**''')
    rep('''  Rank | Source Domain | Mechanism        | Distance     | Text  | Band       | Fused | Source
  -----|---------------|------------------|--------------|-------|------------|-------|-------
  1    | [domain]      | [what transfers] | cross-domain | [txt] | Structural | [f]   | [tier]
  2    | [domain]      | [what transfers] | far          | [txt] | Behavioral | [f]   | [tier]''','''  Rank | Source Domain | Mechanism        | Distance     | Text  | Band       | Fused | Pctile | Source
  -----|---------------|------------------|--------------|-------|------------|-------|--------|-------
  1    | [domain]      | [what transfers] | cross-domain | [txt] | Structural | [f]   | [p]    | [tier]
  2    | [domain]      | [what transfers] | far          | [txt] | Behavioral | [f]   | [p]    | [tier]''')
    open(p,'w',encoding='utf-8').write(s)
    return s

c=patch('commands/find-analogies.md')
k=patch('skills/find-analogies/SKILL.md')
# tool-name spelling: add alternate Tavily tool to the pre-approval lists
c=c.replace('  - mcp__tavily__tavily-search\n  - AskUserQuestion','  - mcp__tavily__tavily-search\n  - mcp__Tavily__tavily_search\n  - AskUserQuestion',1)
assert 'mcp__Tavily__tavily_search' in c
open('commands/find-analogies.md','w',encoding='utf-8').write(c)
k2=k.replace('mcp__tavily__tavily-search AskUserQuestion Task','mcp__tavily__tavily-search mcp__Tavily__tavily_search AskUserQuestion Task',1)
assert k2!=k
open('skills/find-analogies/SKILL.md','w',encoding='utf-8').write(k2)
print('ok')
