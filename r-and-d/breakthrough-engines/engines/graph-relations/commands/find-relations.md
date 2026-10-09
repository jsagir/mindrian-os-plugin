---
name: find-relations
description: Find missing or mistaken relationships in the methodology graph and propose them with evidence. Read only; writes need approval.
argument-hint: "[question or node name] [--labels Framework,Technique] [--top 40]"
allowed-tools: Read, Write, Bash, Glob, Grep, Agent, mcp__remote-devices__myneo4j__get_neo4j_schema, mcp__remote-devices__myneo4j__read_neo4j_cypher
---

Run the graph-relationship-agent on: $ARGUMENTS

1. Snapshot the graph (read only), report relationship counts and how many are dated.
2. Run the backtest; state plainly whether any method is validated.
3. Run detection; show the top proposals and the data-quality findings.
4. Ask which proposals to evidence. Do not write to the graph without per-edge approval.
