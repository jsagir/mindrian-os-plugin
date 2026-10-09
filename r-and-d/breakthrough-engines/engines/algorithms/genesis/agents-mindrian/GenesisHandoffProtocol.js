// Phase 5: Handoff Protocol Generator (2026 revision, v1.1)
// Builds the instruction object an execution agent follows. It performs no search
// itself. Minutes and counts below are planning heuristics, not measurements.

let _handoffSeq = 0;

const HandoffProtocol = {
    // Set to true to silence progress logging (tests, library use).
    silent: false,

    options: {
        // The original looked the domain up with primaryExpertise.split('-')[0] ("Machine"),
        // which never matched "Machine-Learning", so include_domains was empty for most
        // personas. true applies the intended site lists; false restores the old open search.
        restrictToDomainSites: true
    },

    log: (...args) => {
        if (!HandoffProtocol.silent) console.log(...args);
    },

    // Generate complete handoff instructions
    generateHandoff: async (analysis, domains, personas, researchPlan) => {
        HandoffProtocol.log("\nGenerating handoff protocol\n");

        if (!analysis || typeof analysis.originalContext !== 'string') {
            throw new TypeError("analysis.originalContext (string) is required");
        }
        if (!domains || !Array.isArray(domains.primary) || !Array.isArray(domains.technical)) {
            throw new TypeError("domains.primary and domains.technical must be arrays");
        }
        if (!Array.isArray(personas) || personas.length === 0) {
            throw new TypeError("personas must be a non-empty array");
        }
        const plan = researchPlan || {};
        const timeline = plan.timeline;

        // Phase thought counts. The original total (10 + 3n) is smaller than the sum of
        // the phases once n >= 5 (e.g. n = 6: total 28, phases 29); keep the original
        // total when it covers the phases, otherwise use the sum.
        const phaseThoughts = {
            research: personas.length * 2,
            cross: Math.ceil(personas.length * 1.5),
            synthesis: 5,
            implementation: 3
        };
        const phaseSum = phaseThoughts.research + phaseThoughts.cross + phaseThoughts.synthesis + phaseThoughts.implementation;
        
        const handoff = {
            executionId: `GENESIS-${Date.now()}-${++_handoffSeq}`,
            timestamp: new Date().toISOString(),
            
            contextSummary: {
                originalProblem: analysis.originalContext,
                complexity: analysis.complexity,
                domainCount: domains.primary.length + domains.technical.length,
                personaCount: personas.length,
                estimatedResearchTime: (timeline && timeline.minimum && timeline.maximum)
                    ? `${timeline.minimum} to ${timeline.maximum}`
                    : '45-65 minutes',
                estimatedResearchTimeBasis: 'heuristic, not measured'
            },
            
            // Detailed instructions for each persona
            personaInstructions: personas.map(p => ({
                persona: p.name,
                
                missionBrief: `You are ${p.name}, a ${p.expertiseDepth} in ${p.primaryExpertise}. Your mission is to find what the evidence supports at the intersection of your domain and the given problem context. You are a simulated AI perspective, not a real expert; label your output that way.`,
                
                researchFocus: p.researchApproach,
                
                // Tavily queries with execution instructions
                tavilyQueries: (Array.isArray(p.queryStrategies) ? p.queryStrategies : []).map((query, idx) => {
                    const includeDomains = HandoffProtocol.options.restrictToDomainSites
                        ? HandoffProtocol.generateDomainFilters(p) : [];
                    const searchDepth = p.expertiseDepth === 'AUTHORITY' ? 'advanced' : 'basic';
                    return {
                        queryId: `${p.name}-Q${idx + 1}`,
                        query: query,
                        searchDepth,
                        expectedResults: 10,
                        filters: {
                            time_range: 'year',
                            exclude_domains: [],
                            include_domains: includeDomains
                        },
                        // additive: REST-style names. Use the parameter names in the connected
                        // search tool's own schema; the old prompt used camelCase variants.
                        request: {
                            query,
                            search_depth: searchDepth,
                            max_results: 10,
                            time_range: 'year',
                            include_domains: includeDomains,
                            exclude_domains: []
                        }
                    };
                }),
                
                analysisFramework: {
                    primary: `Analyze all findings through the lens of ${p.primaryExpertise}`,
                    secondary: `Identify how your domain expertise reveals hidden opportunities`,
                    synthesis: `Prepare insights for cross-domain integration discussion`,
                    criticalQuestions: HandoffProtocol.generateCriticalQuestions(p)
                },
                
                deliverables: [
                    `Up to 5 evidence-backed insights from ${p.primaryExpertise} perspective (fewer, or none, when the evidence does not support more)`,
                    `2-3 cross-domain connection opportunities`,
                    `1-2 implementation pathways with feasibility assessment`,
                    `Critical risks or limitations from your domain perspective`,
                    `Future research directions that could amplify breakthroughs`
                ],
                
                outputFormat: {
                    structure: 'Structured findings with evidence',
                    tone: p.expertiseDepth === 'AUTHORITY' ? 'Authoritative and visionary' : 'Precise and evidence-based',
                    length: '500-800 words per deliverable section',
                    // additive: every claim carries its source trail
                    evidenceFormat: 'each claim lists source id, URL, retrieval date and the extracted sentence; unsourced claims are marked UNSOURCED'
                }
            })),
            
            // Sequential thinking orchestration
            sequentialThinkingProtocol: {
                totalThoughts: Math.max(10 + (personas.length * 3), phaseSum),
                phaseThoughtSum: phaseSum,
                
                phases: [
                    {
                        phase: 'RESEARCH_EXECUTION',
                        thoughts: phaseThoughts.research,
                        focus: 'Execute Tavily searches and gather domain-specific insights'
                    },
                    {
                        phase: 'CROSS_DOMAIN_ANALYSIS',
                        thoughts: phaseThoughts.cross,
                        focus: 'Identify patterns and connections across domains'
                    },
                    {
                        phase: 'BREAKTHROUGH_SYNTHESIS',
                        thoughts: 5,
                        focus: 'Synthesize breakthrough opportunities from combined insights'
                    },
                    {
                        phase: 'IMPLEMENTATION_DESIGN',
                        thoughts: 3,
                        focus: 'Design concrete implementation pathways'
                    }
                ],
                
                thoughtGuidance: [
                    'Each thought should build on previous insights',
                    'Question assumptions when semantic surprises emerge',
                    'Revise earlier thoughts if new connections are discovered',
                    'Branch thinking when multiple breakthrough paths appear',
                    'Maintain both depth (domain expertise) and breadth (integration)'
                ]
            },
            
            // Collaboration protocol for expert discussion
            collaborationProtocol: {
                discussionStructure: [
                    {
                        round: 1,
                        name: 'Domain Presentations',
                        duration: '15 minutes',
                        format: 'Each persona presents key findings'
                    },
                    {
                        round: 2,
                        name: 'Cross-Domain Connections',
                        duration: '20 minutes',
                        format: 'Personas identify synergies and conflicts'
                    },
                    {
                        round: 3,
                        name: 'Breakthrough Ideation',
                        duration: '15 minutes',
                        format: 'Collaborative breakthrough opportunity design'
                    },
                    {
                        round: 4,
                        name: 'Implementation Planning',
                        duration: '10 minutes',
                        format: 'Concrete next steps and resource requirements'
                    }
                ],
                
                interactionRules: plan.collaborationMatrix,
                
                conflictResolution: {
                    method: 'Evidence-based consensus with documented dissent',
                    escalation: 'Integration-Architect has final synthesis authority',
                    documentation: 'All disagreements must be noted with rationale'
                },
                
                synthesisApproach: {
                    primary: 'Build on highest-potential insights from each domain',
                    integration: 'Identify emergent properties from domain combinations',
                    validation: 'Cross-check breakthrough claims against evidence'
                }
            },
            
            // Output specifications
            outputSpecifications: {
                format: 'Structured expert panel report',
                
                sections: [
                    {
                        title: 'Executive Summary',
                        content: 'Top 3 breakthrough opportunities with implementation feasibility'
                    },
                    {
                        title: 'Individual Domain Insights',
                        content: 'Key findings from each persona with evidence'
                    },
                    {
                        title: 'Cross-Domain Connections',
                        content: 'Synergies and integration opportunities discovered'
                    },
                    {
                        title: 'Breakthrough Opportunities',
                        content: 'Detailed analysis of top opportunities with innovation differentials'
                    },
                    {
                        title: 'Implementation Roadmap',
                        content: 'Phase-gated plan with milestones and resources'
                    },
                    {
                        title: 'Risk Assessment',
                        content: 'Technical, market, and execution risks with mitigation'
                    },
                    {
                        title: 'Future Research Directions',
                        content: 'Next-phase investigations to amplify breakthroughs'
                    }
                ],
                
                deliveryMechanism: 'Multi-perspective synthesis with actionable recommendations',

                // additive: honesty rules carried from the room review of the execution prompt
                honestyRules: [
                    'Persona statements are simulated AI perspectives; never present them as quotes from real experts',
                    'Report what the evidence supports; say so when it supports no breakthrough',
                    'Scores such as innovation differential or success probability are ESTIMATED unless computed; label them',
                    'Search queries contain generic domain terms only, never the user context text'
                ],
                
                qualityChecks: [
                    'Each breakthrough must have supporting evidence',
                    'Implementation steps must be concrete and measurable',
                    'Risks must include probability and impact assessment',
                    'Cross-domain insights must show clear value creation'
                ]
            },
            
            // Execution tracking
            executionTracking: {
                checkpoints: [
                    'All Tavily searches completed',
                    'Individual analyses documented',
                    'Cross-domain connections mapped',
                    'Breakthrough opportunities validated',
                    'Implementation plan feasibility checked',
                    'Final synthesis quality assured'
                ],
                
                metrics: {
                    searchesExecuted: 0,
                    insightsGenerated: 0,
                    connectionsIdentified: 0,
                    breakthroughsValidated: 0
                }
            }
        };
        
        return handoff;
    },
    
    // Generate domain filters for Tavily searches
    generateDomainFilters: (persona) => {
        const domainSites = {
            'Machine-Learning': ['arxiv.org', 'proceedings.neurips.cc', 'papers.nips.cc', 'mlr.press'],
            'Quantum-Computing': ['quantum-journal.org', 'nature.com/nphys', 'arxiv.org'],
            'Blockchain': ['ethereum.org', 'bitcoin.org', 'hyperledger.org'],
            'Biotechnology': ['nature.com/nbt', 'science.org', 'cell.com'],
            'Cybersecurity': ['cve.org', 'cve.mitre.org', 'sans.org', 'owasp.org'],
            'Natural-Language-Processing': ['arxiv.org', 'aclanthology.org'],
            'Computer-Vision': ['arxiv.org', 'openaccess.thecvf.com']
        };

        // Match the persona's expertise exactly, then any known domain that appears as whole
        // hyphen-delimited segments of the persona name (subdomain personas are named
        // "<Sub>-<Parent>-<Depth>"). Longest key first so "Natural-Language-Processing" wins.
        if (!persona || typeof persona.primaryExpertise !== 'string') return [];
        if (domainSites[persona.primaryExpertise]) return domainSites[persona.primaryExpertise].slice();
        const wrapped = '-' + (persona.name || '') + '-';
        const keys = Object.keys(domainSites).sort((a, b) => b.length - a.length);
        const hit = keys.find(k => wrapped.includes('-' + k + '-'));
        return hit ? domainSites[hit].slice() : [];
    },
    
    // Generate critical questions for each persona
    generateCriticalQuestions: (persona) => {
        const depthQuestions = {
            'SPECIALIST': [
                `What specific technical barriers exist in ${persona.primaryExpertise}?`,
                `How can recent advances in ${persona.primaryExpertise} be applied?`,
                `What are the implementation requirements and constraints?`
            ],
            'EXPERT': [
                `What paradigm shifts are occurring in ${persona.primaryExpertise}?`,
                `How does ${persona.primaryExpertise} integrate with adjacent domains?`,
                `What are the scalability implications of proposed solutions?`
            ],
            'AUTHORITY': [
                `What revolutionary approaches could transform ${persona.primaryExpertise}?`,
                `How might ${persona.primaryExpertise} evolve in the next 5-10 years?`,
                `What moonshot opportunities exist at the intersection of domains?`
            ]
        };
        
        return depthQuestions[persona.expertiseDepth] || depthQuestions['EXPERT'];
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandoffProtocol;
}
