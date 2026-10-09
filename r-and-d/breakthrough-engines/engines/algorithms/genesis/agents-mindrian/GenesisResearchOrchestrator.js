// ========================================
// GENESIS RESEARCH ORCHESTRATOR v2.2 (2026 revision)
// Multi-Persona Research Coordination Engine
// Produces a plan object (phases, interaction matrix, controls). The interaction
// values (0.3 to 0.9) and the timeline minutes are fixed heuristics chosen by the
// author, not measured quantities; the output marks them as such.
// ========================================

let _planSeq = 0;

const ResearchOrchestrator = {
    // Set to true to silence progress logging (tests, library use).
    silent: false,

    log: (...args) => {
        if (!ResearchOrchestrator.silent) console.log(...args);
    },

    // Role detection. The original tested p.name.includes('Integration') first, which also
    // matched "Research-Methodology-Integration-Expert", so the methodology expert was
    // treated as the primary synthesizer and the Methodology branches were unreachable.
    // domainCategory is authoritative; the name test is only a fallback for hand-built personas.
    isIntegration: (p) => p.domainCategory
        ? p.domainCategory === 'INTEGRATION'
        : (p.name || '').includes('Integration'),
    isMethodology: (p) => p.domainCategory
        ? p.domainCategory === 'METHODOLOGY'
        : (p.name || '').includes('Methodology'),

    // Orchestrate research across all personas
    orchestrateResearch: async (personas, originalContext) => {
        ResearchOrchestrator.log("\nOrchestrating multi-persona research\n");

        if (!Array.isArray(personas) || personas.length === 0) {
            throw new TypeError("personas must be a non-empty array (output of PersonaGenerator.generatePersonas)");
        }
        if (typeof originalContext !== 'string') {
            throw new TypeError("originalContext must be a string");
        }
        personas.forEach((p, i) => {
            if (!p || typeof p.name !== 'string') throw new TypeError(`personas[${i}] needs a string name`);
            if (!Array.isArray(p.queryStrategies)) throw new TypeError(`personas[${i}] (${p.name}) needs queryStrategies[]`);
        });
        
        const researchPlan = {
            // Date.now() alone collides when two plans are built in the same millisecond.
            planId: `RESEARCH-${Date.now()}-${++_planSeq}`,
            
            context: originalContext.substring(0, 500) + (originalContext.length > 500 ? '...' : ''),
            
            personaCount: personas.length,
            
            personas: personas.map(p => ({
                name: p.name,
                expertise: p.primaryExpertise,
                queries: p.queryStrategies,
                focus: p.researchApproach ? p.researchApproach.primary : null,
                deliverables: p.outputExpectations
            })),
            
            executionPhases: ResearchOrchestrator.defineExecutionPhases(personas),
            
            collaborationMatrix: ResearchOrchestrator.generateCollaborationMatrix(personas),
            
            qualityControls: ResearchOrchestrator.defineQualityControls(personas),
            
            expectedOutcomes: ResearchOrchestrator.defineExpectedOutcomes(personas),
            
            timeline: ResearchOrchestrator.estimateTimeline(personas),
            
            synthesisStrategy: ResearchOrchestrator.defineSynthesisStrategy(personas),

            // additive
            provenance: {
                module: 'GenesisResearchOrchestrator',
                version: '2.2',
                generatedAt: new Date().toISOString(),
                note: 'interaction values and timeline are fixed heuristics, not measurements'
            }
        };
        
        return researchPlan;
    },
    
    // Define execution phases with detailed activities
    defineExecutionPhases: (personas) => {
        const phases = [
            {
                phase: 1,
                name: 'Parallel Domain Research',
                duration: '15-20 minutes',
                parallel: true,
                activities: personas.map(p => ({
                    persona: p.name,
                    action: `Execute Tavily searches`,
                    queries: p.queryStrategies.slice(0, 3),
                    expectedFindings: '5-10 relevant sources per query',
                    analysisDepth: p.expertiseDepth
                })),
                outputs: [
                    'Domain-specific research findings',
                    'Initial breakthrough indicators',
                    'Cross-reference opportunities'
                ]
            },
            {
                phase: 2,
                name: 'Cross-Reference & Validation',
                duration: '10-15 minutes',
                parallel: false,
                activities: [
                    {
                        action: 'Cross-persona finding review',
                        description: 'Each persona reviews findings from related domains',
                        method: 'Systematic cross-validation'
                    },
                    {
                        action: 'Overlap identification',
                        description: 'Identify common themes and contradictions',
                        method: 'Comparative analysis matrix'
                    },
                    {
                        action: 'Breakthrough validation',
                        description: 'Validate potential breakthroughs against multiple domains',
                        method: 'Multi-domain verification protocol'
                    }
                ],
                outputs: [
                    'Validated breakthrough opportunities',
                    'Cross-domain connection map',
                    'Contradiction resolution log'
                ]
            },
            {
                phase: 3,
                name: 'Synthesis Discussion',
                duration: '20-30 minutes',
                parallel: false,
                activities: [
                    {
                        action: 'Expert panel convening',
                        description: 'All personas engage in structured discussion',
                        method: 'Moderated expert panel format'
                    },
                    {
                        action: 'Breakthrough prioritization',
                        description: 'Rank opportunities by impact and feasibility',
                        method: 'Multi-criteria decision analysis'
                    },
                    {
                        action: 'Implementation design',
                        description: 'Design practical pathways for top opportunities',
                        method: 'Collaborative roadmapping'
                    }
                ],
                outputs: [
                    'Prioritized breakthrough list',
                    'Implementation roadmaps',
                    'Risk mitigation strategies',
                    'Next-step recommendations'
                ]
            },
            {
                phase: 4,
                name: 'Consensus & Documentation',
                duration: '10-15 minutes',
                parallel: false,
                activities: [
                    {
                        action: 'Consensus building',
                        description: 'Resolve any remaining disagreements',
                        method: 'Evidence-based consensus protocol'
                    },
                    {
                        action: 'Final documentation',
                        description: 'Compile comprehensive findings report',
                        method: 'Structured synthesis template'
                    }
                ],
                outputs: [
                    'Final breakthrough report',
                    'Executive summary',
                    'Action plan'
                ]
            }
        ];
        
        return phases;
    },
    
    // Generate detailed collaboration matrix
    generateCollaborationMatrix: (personas) => {
        const matrix = {
            primaryInteractions: [],
            synthesisRoles: {},
            conflictResolution: 'Evidence-based consensus with documented dissent',
            interactionProtocol: 'Structured dialogue with clear handoffs'
        };
        
        // Define all pairwise interactions
        personas.forEach((p1, i) => {
            personas.forEach((p2, j) => {
                if (i < j) {
                    const interaction = ResearchOrchestrator.defineInteraction(p1, p2);
                    if (interaction.value > 0.4) {
                        matrix.primaryInteractions.push(interaction);
                    }
                }
            });
        });
        
        // Sort interactions by value
        matrix.primaryInteractions.sort((a, b) => b.value - a.value);
        
        // Assign synthesis roles based on persona type and expertise
        personas.forEach(p => {
            if (ResearchOrchestrator.isIntegration(p)) {
                matrix.synthesisRoles[p.name] = {
                    role: 'PRIMARY_SYNTHESIZER',
                    responsibilities: ['Drive cross-domain connections', 'Identify emergent properties', 'Lead breakthrough identification']
                };
            } else if (ResearchOrchestrator.isMethodology(p)) {
                matrix.synthesisRoles[p.name] = {
                    role: 'QUALITY_VALIDATOR',
                    responsibilities: ['Ensure research rigor', 'Validate methodologies', 'Assess evidence quality']
                };
            } else if (p.expertiseDepth === 'AUTHORITY') {
                matrix.synthesisRoles[p.name] = {
                    role: 'DOMAIN_VALIDATOR',
                    responsibilities: ['Validate domain-specific insights', 'Identify paradigm shifts', 'Assess breakthrough potential']
                };
            } else if (p.domainCategory === 'SUBDOMAIN') {
                matrix.synthesisRoles[p.name] = {
                    role: 'TECHNICAL_VALIDATOR',
                    responsibilities: ['Verify technical feasibility', 'Provide implementation details', 'Assess technical risks']
                };
            } else {
                matrix.synthesisRoles[p.name] = {
                    role: 'INSIGHT_CONTRIBUTOR',
                    responsibilities: ['Contribute domain insights', 'Identify opportunities', 'Support validation']
                };
            }
        });
        
        return matrix;
    },
    
    // Define interaction between two personas with enhanced logic
    defineInteraction: (persona1, persona2) => {
        let value = 0.3; // Base interaction value
        let type = 'STANDARD';
        let purpose = '';
        
        // Integration expert has high interaction with everyone
        if (ResearchOrchestrator.isIntegration(persona1) || ResearchOrchestrator.isIntegration(persona2)) {
            value = 0.9;
            type = 'SYNTHESIS';
            purpose = 'Identify cross-domain breakthrough opportunities and emergent synergies';
        }
        // Methodology expert validates everyone's approach
        else if (ResearchOrchestrator.isMethodology(persona1) || ResearchOrchestrator.isMethodology(persona2)) {
            value = 0.7;
            type = 'VALIDATION';
            purpose = 'Ensure methodological rigor and research quality';
        }
        // Same domain experts collaborate closely
        else if (persona1.primaryExpertise === persona2.primaryExpertise) {
            value = 0.6;
            type = 'COLLABORATION';
            purpose = 'Deep domain exploration and validation';
        }
        // Parent-subdomain relationships
        else if (
            (ResearchOrchestrator.nameHasSegment(persona1.name, persona2.primaryExpertise) ||
             ResearchOrchestrator.nameHasSegment(persona2.name, persona1.primaryExpertise)) &&
            (persona1.domainCategory === 'SUBDOMAIN' || persona2.domainCategory === 'SUBDOMAIN')
        ) {
            value = 0.8;
            type = 'HIERARCHICAL';
            purpose = 'Technical deep-dive and specialized insight integration';
        }
        // Cross-domain authorities have high breakthrough potential
        else if (persona1.expertiseDepth === 'AUTHORITY' && persona2.expertiseDepth === 'AUTHORITY') {
            value = 0.85;
            type = 'BREAKTHROUGH';
            purpose = 'Challenge paradigms and identify revolutionary approaches';
        }
        // Adjacent domain interaction
        else {
            value = 0.5;
            type = 'EXPLORATORY';
            purpose = 'Explore unexpected connections and adjacent possibilities';
        }
        
        return {
            between: [persona1.name, persona2.name],
            value,
            type,
            purpose,
            expectedOutcome: ResearchOrchestrator.defineExpectedInteractionOutcome(type),
            communicationStyle: ResearchOrchestrator.defineCommunicationStyle(type)
        };
    },
    
    // True when `expertise` appears in `name` as whole hyphen-delimited segments
    // ("Machine-Learning" in "Computer-Vision-Machine-Learning-Specialist", not "Learn").
    nameHasSegment: (name, expertise) => {
        if (!name || !expertise) return false;
        return ('-' + name + '-').includes('-' + expertise + '-');
    },

    defineExpectedInteractionOutcome: (type) => {
        const outcomes = {
            'SYNTHESIS': 'Novel integration pathways and emergent breakthrough opportunities',
            'VALIDATION': 'Quality-assured findings with methodological certification',
            'COLLABORATION': 'Deepened domain insights and validated approaches',
            'HIERARCHICAL': 'Technical specifications and implementation pathways',
            'BREAKTHROUGH': 'Paradigm-shifting insights and revolutionary approaches',
            'EXPLORATORY': 'Unexpected connections and adjacent innovation opportunities',
            'STANDARD': 'Shared findings and potential connection points'
        };
        
        return outcomes[type] || outcomes['STANDARD'];
    },
    
    defineCommunicationStyle: (type) => {
        const styles = {
            'SYNTHESIS': 'Integrative dialogue focusing on connections',
            'VALIDATION': 'Critical review with constructive feedback',
            'COLLABORATION': 'Peer exchange with mutual enrichment',
            'HIERARCHICAL': 'Technical mentorship and guidance',
            'BREAKTHROUGH': 'Visionary exploration and paradigm challenging',
            'EXPLORATORY': 'Open-ended discovery and creative ideation',
            'STANDARD': 'Professional knowledge exchange'
        };
        
        return styles[type] || styles['STANDARD'];
    },
    
    // Define quality control measures
    defineQualityControls: (personas) => {
        const hasMethodologyExpert = personas.some(p => ResearchOrchestrator.isMethodology(p));
        const hasAuthorities = personas.filter(p => p.expertiseDepth === 'AUTHORITY').length;
        
        return {
            evidenceStandards: {
                minimum: 'Peer-reviewed sources or validated patents',
                preferred: 'Multiple corroborating sources from different domains',
                breakthrough: 'Novel connections validated by at least 2 domain experts'
            },
            
            validationProtocol: {
                level1: 'Self-validation within domain',
                level2: 'Cross-domain expert validation',
                level3: hasMethodologyExpert ? 'Methodology expert certification' : 'Multi-expert consensus'
            },
            
            conflictResolution: {
                method: 'Evidence-based argumentation',
                escalation: hasAuthorities > 1 ? 'Authority panel review' : 'Integration expert mediation',
                documentation: 'All dissenting views recorded with rationale'
            },
            
            qualityMetrics: [
                'Source credibility score (1-10)',
                'Cross-domain validation count',
                'Implementation feasibility rating',
                'Breakthrough potential score'
            ]
        };
    },
    
    // Define expected outcomes based on persona constellation
    defineExpectedOutcomes: (personas) => {
        const outcomes = {
            immediate: [],
            shortTerm: [],
            longTerm: []
        };
        
        // Base outcomes
        outcomes.immediate.push(
            'Comprehensive domain-specific insights',
            'Validated research findings',
            'Initial breakthrough opportunities'
        );
        
        // Integration-specific outcomes
        if (personas.some(p => ResearchOrchestrator.isIntegration(p))) {
            outcomes.immediate.push('Cross-domain connection map');
            outcomes.shortTerm.push('Integrated breakthrough pathways');
            outcomes.longTerm.push('Emergent innovation ecosystem');
        }
        
        // Authority-specific outcomes
        const authorityCount = personas.filter(p => p.expertiseDepth === 'AUTHORITY').length;
        if (authorityCount > 0) {
            outcomes.shortTerm.push('Paradigm shift opportunities');
            outcomes.longTerm.push('Industry transformation roadmap');
        }
        
        // Subdomain-specific outcomes
        const subdomainCount = personas.filter(p => p.domainCategory === 'SUBDOMAIN').length;
        if (subdomainCount > 0) {
            outcomes.immediate.push('Technical implementation specifications');
            outcomes.shortTerm.push('Proof-of-concept designs');
        }
        
        // Methodology-specific outcomes
        if (personas.some(p => ResearchOrchestrator.isMethodology(p))) {
            outcomes.immediate.push('Research quality certification');
            outcomes.shortTerm.push('Replicable research framework');
        }
        
        return outcomes;
    },
    
    // Estimate timeline based on complexity
    estimateTimeline: (personas) => {
        const baseTime = 45; // minutes
        const personaComplexity = personas.length * 5;
        const interactionComplexity = (personas.length * (personas.length - 1) / 2) * 2;
        const depthComplexity = personas.filter(p => p.expertiseDepth === 'AUTHORITY').length * 10;
        
        const totalMinutes = baseTime + personaComplexity + interactionComplexity + depthComplexity;
        
        return {
            estimated: true,
            basis: 'fixed heuristic: 45 + 5 per persona + 2 per pair + 10 per AUTHORITY; not measured',
            minimum: `${Math.round(totalMinutes * 0.8)} minutes`,
            expected: `${totalMinutes} minutes`,
            maximum: `${Math.round(totalMinutes * 1.3)} minutes`,
            phases: {
                research: '40%',
                validation: '20%',
                synthesis: '30%',
                documentation: '10%'
            }
        };
    },
    
    // Define synthesis strategy
    defineSynthesisStrategy: (personas) => {
        const hasIntegrator = personas.some(p => ResearchOrchestrator.isIntegration(p));
        const domainCount = new Set(personas.map(p => p.primaryExpertise)).size;
        
        return {
            approach: hasIntegrator ? 'Integration-led synthesis' : 'Collaborative emergence',
            
            method: domainCount > 3 ? 'Hierarchical clustering' : 'Full panel discussion',
            
            prioritization: {
                criteria: [
                    'Breakthrough potential (0-10)',
                    'Implementation feasibility (0-10)',
                    'Cross-domain impact (0-10)',
                    'Time to value (months)'
                ],
                weights: {
                    breakthroughPotential: 0.35,
                    feasibility: 0.25,
                    impact: 0.25,
                    timeToValue: 0.15
                }
            },
            
            deliverableFormat: {
                structure: 'Executive summary, detailed findings, implementation roadmap',
                visualizations: ['Opportunity matrix', 'Connection graph', 'Timeline'],
                actionability: 'Each recommendation includes next 3 concrete steps'
            }
        };
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResearchOrchestrator;
}