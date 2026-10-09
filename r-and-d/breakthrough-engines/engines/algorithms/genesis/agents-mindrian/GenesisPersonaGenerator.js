// ========================================
// GENESIS PERSONA GENERATOR v2.2 (2026 revision)
// Expert Persona Creation Engine
// Personas are templates (labels, competencies, query lists). They are not
// real experts and carry no knowledge; any output attributed to a persona is a
// simulated AI perspective. Search queries contain only generic domain names
// (never the user's context text), so nothing private leaves the room.
// ========================================

const VALID_DEPTHS = ['SPECIALIST', 'EXPERT', 'AUTHORITY'];

const PersonaGenerator = {
    // Set to true to silence progress logging (tests, library use).
    silent: false,

    options: {
        // Technical domains with no subdomain above 0.5 confidence produced no persona
        // in the original (silently dropped). Set true to give them a SUBDOMAIN-style
        // persona of their own. Default false keeps the original output.
        includeTechnicalDomains: false,
        // Year used in queries. null = current year. Set a number for reproducible output.
        year: null
    },

    log: (...args) => {
        if (!PersonaGenerator.silent) console.log(...args);
    },

    currentYear: () => PersonaGenerator.options.year || new Date().getFullYear(),

    // Generate expert personas for identified domains
    generatePersonas: async (domains, complexity) => {
        PersonaGenerator.log("\nGenerating expert personas\n");

        if (!domains || typeof domains !== 'object') {
            throw new TypeError("domains must be the object returned by DomainIdentifier.identifyDomains");
        }
        const list = (k) => (Array.isArray(domains[k]) ? domains[k] : []);
        const primary = list('primary');
        const technical = list('technical');
        const methodological = list('methodological');

        const personas = [];
        const seen = new Set();
        personas.diagnostics = { droppedTechnical: [], duplicateNamesSkipped: [] };
        const requiredDepth = (complexity && complexity.depthRequired) || 'EXPERT';
        if (!VALID_DEPTHS.includes(requiredDepth)) {
            throw new RangeError("complexity.depthRequired must be one of " + VALID_DEPTHS.join(', ') + ", got " + requiredDepth);
        }
        const add = (persona) => {
            if (seen.has(persona.name)) {
                personas.diagnostics.duplicateNamesSkipped.push(persona.name);
                return;
            }
            seen.add(persona.name);
            personas.push(persona);
            PersonaGenerator.log("Generated: " + persona.name);
        };
        
        // Generate primary domain experts
        primary.forEach(domain => {
            add(PersonaGenerator.createPersona(domain, 'PRIMARY', requiredDepth));
        });
        
        // Generate technical subdomain experts - FIXED
        technical.forEach(domain => {
            let made = 0;
            if (domain.subdomains && domain.subdomains.length > 0) {
                domain.subdomains.forEach(sub => {
                    if (sub.confidence > 0.5) {
                        made += 1;
                        // FIXED: Normalize subdomain object shape
                        const normalizedSub = {
                            domain: domain.domain,          // parent domain for lookup
                            name: sub.name,                 // subdomain name
                            indicators: sub.indicatorTerms || [], // ensure array
                            parentDomain: domain.domain,
                            technical: true,
                            confidence: sub.confidence
                        };
                        
                        add(PersonaGenerator.createPersona(normalizedSub, 'SUBDOMAIN', requiredDepth));
                    }
                });
            }
            if (made === 0) {
                if (PersonaGenerator.options.includeTechnicalDomains) {
                    add(PersonaGenerator.createPersona(domain, 'PRIMARY', requiredDepth));
                } else {
                    personas.diagnostics.droppedTechnical.push(domain.domain);
                }
            }
        });
        
        // Generate methodological expert if needed
        if (methodological.length > 0) {
            add(PersonaGenerator.createMethodologyExpert(methodological[0]));
        }
        
        // Generate cross-domain integration expert
        if (primary.length > 1) {
            add(PersonaGenerator.createIntegrationExpert(primary));
        }
        
        return personas;
    },
    
    // Create individual persona - FIXED competencies handling
    createPersona: (domain, type, depth) => {
        if (!domain || (!domain.domain && !domain.name)) {
            throw new TypeError("domain must have a 'domain' or 'name'");
        }
        if (!VALID_DEPTHS.includes(depth)) {
            // Original produced names like "X-undefined" and a persona with researchApproach undefined.
            throw new RangeError("depth must be one of " + VALID_DEPTHS.join(', ') + ", got " + depth);
        }
        const depthDescriptors = {
            'SPECIALIST': 'Specialist',
            'EXPERT': 'Expert',
            'AUTHORITY': 'Authority'
        };
        
        // Build name based on type
        let personaName;
        if (type === 'SUBDOMAIN') {
            personaName = `${domain.name}-${domain.parentDomain}-${depthDescriptors[depth]}`;
        } else {
            personaName = `${domain.domain}-${depthDescriptors[depth]}`;
        }
        
        const persona = {
            name: personaName,
            
            primaryExpertise: domain.name || domain.domain,
            
            expertiseDepth: depth,
            
            domainCategory: type,
            
            competencies: {
                core: Array.isArray(domain.indicators) ? domain.indicators : [], // FIXED: ensure array
                technical: PersonaGenerator.generateTechnicalCompetencies(domain),
                methodological: PersonaGenerator.generateMethodCompetencies(domain),
                analytical: PersonaGenerator.generateAnalyticalCompetencies(type, depth)
            },
            
            researchApproach: PersonaGenerator.defineResearchApproach(domain, depth),
            
            queryStrategies: PersonaGenerator.generateQueryStrategies(domain, type),
            
            collaborationStyle: PersonaGenerator.defineCollaborationStyle(type, depth),
            
            perspectiveTraits: PersonaGenerator.definePerspectiveTraits(domain, type),
            
            outputExpectations: PersonaGenerator.defineOutputExpectations(type, depth)
        };
        
        return persona;
    },
    
    // Create methodology expert
    createMethodologyExpert: (methodDomain) => {
        return {
            name: 'Research-Methodology-Integration-Expert',
            
            primaryExpertise: 'Cross-Domain Research Methodology',
            
            expertiseDepth: 'EXPERT',
            
            domainCategory: 'METHODOLOGY',
            
            competencies: {
                core: methodDomain.indicators || [],
                technical: ['systematic review', 'meta-analysis', 'experimental design', 'statistical analysis'],
                methodological: ['hypothesis formulation', 'variable control', 'data validation', 'result interpretation'],
                analytical: ['pattern recognition', 'causal inference', 'correlation analysis']
            },
            
            researchApproach: {
                primary: 'Methodological rigor and cross-domain validation',
                methods: [
                    'Systematic literature review',
                    'Methodological framework comparison',
                    'Best practice identification',
                    'Validation protocol design'
                ]
            },
            
            queryStrategies: (() => {
                const year = PersonaGenerator.currentYear();
                return [
                    `"research methodology" advances ${year} interdisciplinary`,
                    '"systematic approach" innovation "cross-domain"',
                    'methodological framework recent research',
                    `"experimental design" novel approach ${year}`
                ];
            })(),
            
            collaborationStyle: {
                role: 'METHODOLOGY_VALIDATOR',
                approach: 'Ensures research rigor and methodological soundness across domains'
            },
            
            perspectiveTraits: {
                focus: 'methodological_integrity',
                bias: 'process_over_outcome',
                blindSpot: 'domain_specific_nuances'
            },
            
            outputExpectations: [
                'Methodological assessment of proposed approaches',
                'Cross-domain validation frameworks',
                'Research design recommendations',
                'Quality assurance protocols'
            ]
        };
    },
    
    // Create integration expert for cross-domain synthesis
    createIntegrationExpert: (primaryDomains) => {
        const domainNames = primaryDomains.map(d => d.domain).join('-');
        const year = PersonaGenerator.currentYear();
        const quoted = primaryDomains.map(d => `"${d.domain}"`);
        
        return {
            name: `${domainNames}-Integration-Architect`,
            
            primaryExpertise: 'Cross-Domain Integration and Breakthrough Synthesis',
            
            expertiseDepth: 'AUTHORITY',
            
            domainCategory: 'INTEGRATION',
            
            competencies: {
                core: ['systems thinking', 'pattern recognition', 'synthesis', 'integration', 'emergence'],
                technical: primaryDomains.flatMap(d => d.indicators || []).slice(0, 10),
                methodological: ['comparative analysis', 'gap bridging', 'synergy identification', 'integration mapping'],
                analytical: ['cross-domain pattern matching', 'emergent property identification', 'synergy quantification']
            },
            
            researchApproach: {
                primary: 'Identify breakthrough connections and emergent opportunities between domains',
                methods: [
                    'Cross-domain pattern matching',
                    'Synergy opportunity analysis',
                    'Integration pathway mapping',
                    'Breakthrough potential assessment',
                    'Emergent property identification'
                ]
            },
            
            queryStrategies: primaryDomains.length === 2 ? [
                `"${primaryDomains[0].domain}" AND "${primaryDomains[1].domain}" convergence ${year}`,
                `integrate "${primaryDomains[0].domain}" "${primaryDomains[1].domain}" novel approach patent`,
                `cross-pollination "${primaryDomains[0].domain}" "${primaryDomains[1].domain}" innovation`,
                `bridge gap between "${primaryDomains[0].domain}" and "${primaryDomains[1].domain}" research`,
                `"${primaryDomains[0].domain}" meets "${primaryDomains[1].domain}" startup success`
            ] : [
                // Original split the joined name on '-', which also split hyphenated
                // domains such as "Machine-Learning" into "Machine" AND "Learning".
                `${quoted.join(' AND ')} convergence innovation`,
                `multi-domain integration ${quoted.join(' ')} advances`,
                `cross-functional synergy ${quoted.join(' ')} ${year}`,
                'interdisciplinary research ' + quoted.join(' ')
            ],
            
            collaborationStyle: {
                role: 'SYNTHESIS_ORCHESTRATOR',
                approach: 'Facilitates cross-domain insights, identifies integration opportunities, drives breakthrough thinking'
            },
            
            perspectiveTraits: {
                focus: 'emergent_breakthroughs',
                bias: 'integration_optimist',
                blindSpot: 'implementation_complexity'
            },
            
            outputExpectations: [
                'Cross-domain breakthrough opportunities (3-5)',
                'Integration pathway recommendations',
                'Synergy quantification metrics',
                'Emergent property identification',
                'Implementation roadmap with milestones'
            ]
        };
    },
    
    // Helper functions for persona generation - FIXED fallback logic
    generateTechnicalCompetencies: (domain) => {
        const baseCompetencies = {
            'Machine-Learning': ['model architecture', 'optimization algorithms', 'evaluation metrics', 'deployment pipelines', 'feature engineering'],
            'Quantum-Computing': ['circuit design', 'gate operations', 'error mitigation', 'hardware constraints', 'quantum advantage assessment'],
            'Blockchain': ['consensus mechanisms', 'smart contract design', 'cryptographic protocols', 'scalability solutions', 'security auditing'],
            'Biotechnology': ['experimental design', 'genomic analysis', 'regulatory compliance', 'lab techniques', 'bioinformatics'],
            'Natural-Language-Processing': ['tokenization strategies', 'embedding techniques', 'model fine-tuning', 'evaluation benchmarks', 'deployment optimization'],
            'Data-Engineering': ['pipeline architecture', 'data quality assurance', 'performance optimization', 'schema design', 'monitoring systems'],
            'Cybersecurity': ['threat modeling', 'vulnerability assessment', 'incident response', 'security architecture', 'compliance frameworks'],
            'Cloud-Architecture': ['service design', 'scalability patterns', 'cost optimization', 'security implementation', 'disaster recovery']
        };
        
        // FIXED: Check both domain and parentDomain
        const key = domain.domain || domain.parentDomain || 'General-Systems';
        return baseCompetencies[key] || ['systems analysis', 'technical implementation', 'performance optimization', 'quality assurance'];
    },
    
    generateMethodCompetencies: (domain) => {
        const depth = domain.confidence || 0.5;
        
        if (depth > 0.7) {
            return [
                'systematic experimentation',
                'hypothesis-driven research',
                'iterative refinement',
                'evidence-based decision making',
                'breakthrough identification'
            ];
        } else {
            return [
                'exploratory analysis',
                'comparative evaluation',
                'feasibility assessment',
                'risk-benefit analysis'
            ];
        }
    },
    
    generateAnalyticalCompetencies: (type, depth) => {
        const baseAnalytical = ['data analysis', 'pattern recognition', 'logical reasoning'];
        
        const typeSpecific = {
            'PRIMARY': ['domain modeling', 'trend analysis', 'competitive analysis'],
            'SUBDOMAIN': ['deep technical analysis', 'specialized tool proficiency', 'niche expertise'],
            'INTEGRATION': ['systems analysis', 'cross-functional mapping', 'synergy identification']
        };
        
        const depthSpecific = {
            'SPECIALIST': ['focused analysis', 'detailed examination'],
            'EXPERT': ['comprehensive analysis', 'strategic assessment'],
            'AUTHORITY': ['paradigm analysis', 'future forecasting']
        };
        
        return [
            ...baseAnalytical,
            ...(typeSpecific[type] || []),
            ...(depthSpecific[depth] || [])
        ];
    },
    
    defineResearchApproach: (domain, depth) => {
        if (!VALID_DEPTHS.includes(depth)) {
            throw new RangeError("depth must be one of " + VALID_DEPTHS.join(', ') + ", got " + depth);
        }
        const approaches = {
            'SPECIALIST': {
                primary: 'Deep-dive investigation within specialized domain boundaries',
                methods: [
                    'Targeted literature search',
                    'Specific case study analysis',
                    'Narrow technical deep dives',
                    'Tool-specific exploration'
                ]
            },
            'EXPERT': {
                primary: 'Comprehensive domain exploration with adjacent area integration',
                methods: [
                    'Systematic domain review',
                    'Comparative methodology analysis',
                    'Trend identification and projection',
                    'Best practice synthesis'
                ]
            },
            'AUTHORITY': {
                primary: 'Frontier-pushing research at paradigm boundaries',
                methods: [
                    'Breakthrough opportunity identification',
                    'Paradigm-challenging investigation',
                    'Future technology forecasting',
                    'Revolutionary approach design'
                ]
            }
        };
        
        return approaches[depth];
    },
    
    generateQueryStrategies: (domain, type) => {
        const domainName = domain.name || domain.domain;
        const year = PersonaGenerator.currentYear();
        
        const baseQueries = [
            `"${domainName}" breakthrough research ${year} ${year + 1}`,
            `"${domainName}" cutting edge developments patent application`,
            `"${domainName}" novel approach startup innovation funding`
        ];
        
        if (type === 'SUBDOMAIN') {
            const parent = domain.parentDomain;
            return [
                ...baseQueries,
                `"${domainName}" advances in "${parent}" ${year}`,
                `integrate "${domainName}" new methodology "${parent}"`,
                `"${domainName}" paradigm shift technical breakthrough`
            ];
        } else if (type === 'PRIMARY') {
            return [
                ...baseQueries,
                `"${domainName}" paradigm shift recent advances review`,
                `overcome "${domainName}" limitations new method ${year}`,
                `"${domainName}" unexpected applications breakthrough`,
                `revolutionary "${domainName}" approach peer reviewed`
            ];
        }
        
        return baseQueries;
    },
    
    defineCollaborationStyle: (type, depth) => {
        const styles = {
            'PRIMARY': {
                'SPECIALIST': { 
                    role: 'DOMAIN_CONTRIBUTOR',
                    approach: 'Provides focused domain insights and technical validation'
                },
                'EXPERT': { 
                    role: 'DOMAIN_ADVISOR',
                    approach: 'Guides domain-specific decisions and validates approaches'
                },
                'AUTHORITY': { 
                    role: 'DOMAIN_LEADER',
                    approach: 'Sets domain research direction and identifies breakthroughs'
                }
            },
            'SUBDOMAIN': {
                role: 'TECHNICAL_SPECIALIST',
                approach: 'Provides deep technical insights and specialized knowledge'
            },
            'METHODOLOGY': {
                role: 'PROCESS_GUARDIAN',
                approach: 'Ensures research quality and methodological soundness'
            },
            'INTEGRATION': {
                role: 'SYNTHESIS_LEADER',
                approach: 'Drives cross-domain connections and breakthrough identification'
            }
        };
        
        return type === 'PRIMARY' ? styles[type][depth] : (styles[type] || styles['PRIMARY']['EXPERT']);
    },
    
    definePerspectiveTraits: (domain, type) => {
        const confidence = domain.confidence || 0.5;
        
        return {
            focus: type === 'PRIMARY' ? 'domain_excellence' : 
                   type === 'SUBDOMAIN' ? 'technical_precision' :
                   type === 'INTEGRATION' ? 'breakthrough_synthesis' : 'quality_assurance',
            
            bias: type === 'PRIMARY' ? 'domain_advocacy' :
                  type === 'SUBDOMAIN' ? 'detail_orientation' :
                  type === 'INTEGRATION' ? 'possibility_thinking' : 'process_focus',
            
            blindSpot: type === 'PRIMARY' ? 'cross_domain_opportunities' :
                       type === 'SUBDOMAIN' ? 'bigger_picture' :
                       type === 'INTEGRATION' ? 'implementation_details' : 'innovation_potential',
            
            confidence: confidence
        };
    },
    
    defineOutputExpectations: (type, depth) => {
        const base = [
            '3-5 key insights from domain perspective',
            'Evidence-based recommendations',
            'Risk and limitation assessment'
        ];
        
        const typeSpecific = {
            'PRIMARY': ['Domain-specific breakthrough opportunities', 'Competitive landscape analysis'],
            'SUBDOMAIN': ['Technical deep-dive findings', 'Specialized implementation guidance'],
            'INTEGRATION': ['Cross-domain synergies', 'Emergent breakthrough pathways'],
            'METHODOLOGY': ['Research quality assessment', 'Methodological recommendations']
        };
        
        const depthSpecific = {
            'SPECIALIST': ['Detailed technical validations'],
            'EXPERT': ['Strategic recommendations'],
            'AUTHORITY': ['Paradigm shift opportunities']
        };
        
        return [
            ...base,
            ...(typeSpecific[type] || []),
            ...(depthSpecific[depth] || [])
        ];
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonaGenerator;
}