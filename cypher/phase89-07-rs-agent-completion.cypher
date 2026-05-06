// Phase 89-07 -- Complete ReverseSalientAgent Brain stub via DELEGATES_TO CrossDomainInnovationAgent.
// Idempotent (MERGE not CREATE). Applied post-release. RESEARCH Q5 (RECOMMENDED).
// Carry-forward from April plan Q6 decision; the agent file at agents/reverse-salient-agent.md
// is the LOCAL plugin-side surface. This Cypher is the BRAIN-side stub completion.

MATCH (rsa:FrameworkAgent {name: 'ReverseSalientAgent'})
MATCH (cdi:FrameworkAgent {name: 'CrossDomainInnovationAgent'})
MERGE (rsa)-[r1:DELEGATES_TO {reason: 'stub-completion-phase89-07', version: '1.13.0-beta.4'}]->(cdi)
RETURN rsa.name AS source, cdi.name AS target, type(r1) AS edge;

// Inherit APPLIES_TO targets from CrossDomainInnovationAgent.
MATCH (rsa:FrameworkAgent {name: 'ReverseSalientAgent'})
MATCH (cdi:FrameworkAgent {name: 'CrossDomainInnovationAgent'})-[:APPLIES_TO]->(target)
MERGE (rsa)-[:APPLIES_TO {inherited_from: 'CrossDomainInnovationAgent', via_phase: '89-07'}]->(target);

// Attach the LOCAL plugin script as IMPLEMENTED_BY for traceability.
MERGE (script:Script {path: 'scripts/rs-engine.py', version: '1.13.0-beta.4'})
MERGE (rsa:FrameworkAgent {name: 'ReverseSalientAgent'})-[:IMPLEMENTED_BY {via_phase: '89-07'}]->(script);

RETURN 'ReverseSalientAgent stub completed via DELEGATES_TO + APPLIES_TO inheritance + IMPLEMENTED_BY' AS status;
