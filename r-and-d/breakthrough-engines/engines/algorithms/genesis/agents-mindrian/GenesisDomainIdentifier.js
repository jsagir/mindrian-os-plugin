// ========================================
// GENESIS DOMAIN IDENTIFIER v2.2 (2026 revision)
// Domain & Subdomain Discovery Engine
// Rule based: keyword lexicons per domain. Confidence is a hit-count heuristic
// (hits / 10), not a probability. Ties between domains go to the domain declared
// first in domainPatterns (deterministic).
// ========================================

const DomainIdentifier = {
    // Set to true to silence progress logging (tests, library use).
    silent: false,

    log: (...args) => {
        if (!DomainIdentifier.silent) console.log(...args);
    },

    // Identify domains from decomposed context
    identifyDomains: async (decomposition) => {
        DomainIdentifier.log("\nIdentifying expertise domains\n");

        if (!decomposition || !Array.isArray(decomposition.segments)) {
            throw new TypeError("decomposition.segments must be an array (output of ContextDecomposer.analyzeContext)");
        }
        const methodologies = (decomposition.elements && Array.isArray(decomposition.elements.methodologies))
            ? decomposition.elements.methodologies : [];
        
        const domains = {
            primary: [],
            technical: [],
            adjacent: [],
            methodological: [],
            implementation: []
        };
        
        // Analyze segments for domain indicators
        decomposition.segments.forEach((seg, idx) => {
            const domainAnalysis = DomainIdentifier.analyzeDomainIndicators(seg.text);
            
            DomainIdentifier.log(`Segment ${idx + 1} domain analysis:`, {
                domain: domainAnalysis.domain,
                confidence: domainAnalysis.confidence.toFixed(2),
                technical: domainAnalysis.technical
            });
            
            // Categorize domains
            if (domainAnalysis.confidence > 0.7) {
                domains.primary.push(domainAnalysis);
            } else if (domainAnalysis.technical && domainAnalysis.confidence > 0.4) {
                domains.technical.push(domainAnalysis);
            } else if (domainAnalysis.confidence > 0.2) {
                domains.adjacent.push(domainAnalysis);
            }
        });
        
        // Extract methodological domains from elements
        if (methodologies.length > 2) {
            domains.methodological.push({
                domain: 'Research-Methodology',
                indicators: methodologies,
                confidence: 0.6,
                technical: false
            });
        }
        
        // Deduplicate and prioritize
        domains.primary = DomainIdentifier.deduplicateDomains(domains.primary);
        domains.technical = DomainIdentifier.deduplicateDomains(domains.technical);
        domains.adjacent = DomainIdentifier.deduplicateDomains(domains.adjacent);
        
        return domains;
    },
    
    // Analyze text for domain indicators - ENHANCED
    analyzeDomainIndicators: (text) => {
        const domainPatterns = {
            'Machine-Learning': /\b(neural|network|training|model|dataset|classification|regression|deep learning|supervised|unsupervised|reinforcement)\b/gi,
            'Quantum-Computing': /\b(quantum|qubit|superposition|entanglement|quantum gate|quantum circuit|decoherence|quantum algorithm)\b/gi,
            'Blockchain': /\b(blockchain|cryptocurrency|smart contract|consensus|distributed ledger|mining|defi|web3|dao)\b/gi,
            'Biotechnology': /\b(genetic|dna|rna|protein|cell|organism|crispr|sequencing|bioengineering|synthetic biology)\b/gi,
            'Data-Engineering': /\b(pipeline|etl|data lake|streaming|batch|processing|warehouse|kafka|spark|airflow)\b/gi,
            'Cybersecurity': /\b(security|encryption|vulnerability|threat|authentication|authorization|penetration|firewall|malware)\b/gi,
            'Cloud-Architecture': /\b(cloud|serverless|microservice|container|kubernetes|scaling|aws|azure|gcp|devops)\b/gi,
            'Natural-Language-Processing': /\b(natural language|nlp|tokenization|embedding|transformer|bert|gpt|sentiment|parsing)\b/gi,
            'Robotics': /\b(robot|actuator|sensor|kinematics|control system|autonomous|navigation|manipulation|ros)\b/gi,
            'FinTech': /\b(fintech|trading|portfolio|risk|derivative|market|liquidity|payment|banking|defi)\b/gi,
            'Computer-Vision': /\b(vision|image|video|cnn|detection|segmentation|recognition|opencv|yolo)\b/gi,
            'IoT': /\b(iot|sensor|edge computing|mqtt|embedded|arduino|raspberry|telemetry)\b/gi,
            'AR-VR': /\b(augmented reality|virtual reality|mixed reality|metaverse|oculus|hololens)\b/gi,
            'DevOps': /\b(ci\/cd|continuous integration|deployment|docker|jenkins|gitlab|monitoring|infrastructure)\b/gi
        };
        
        // Short acronyms are matched case-sensitively; as /gi they hit ordinary words.
        const acronymPatterns = {
            'AR-VR': /\b(AR|VR|XR)\b/g
        };

        let bestMatch = { domain: 'General-Systems', score: 0, confidence: 0.3, indicators: [], technical: false };
        
        for (const [domain, pattern] of Object.entries(domainPatterns)) {
            const matches = (text.match(pattern) || []).concat(
                acronymPatterns[domain] ? (text.match(acronymPatterns[domain]) || []) : []
            );
            const score = matches.length;
            
            if (score > bestMatch.score) {
                bestMatch = {
                    domain,
                    score,
                    confidence: Math.min(score / 10, 1.0),
                    indicators: [...new Set(matches.map(m => m.toLowerCase()))].slice(0, 5),
                    technical: score >= 2  // FIXED: only flag technical if sufficient evidence
                };
            }
        }
        
        // Check for subdomain specificity
        bestMatch.subdomains = DomainIdentifier.identifySubdomains(text, bestMatch.domain);
        
        return bestMatch;
    },
    
    // Identify subdomains within a primary domain - EXPANDED
    identifySubdomains: (text, primaryDomain) => {
        const subdomainMap = {
            'Machine-Learning': {
                'Computer-Vision': /\b(image|vision|cnn|object detection|segmentation|yolo|resnet)\b/gi,
                'Reinforcement-Learning': /\b(agent|reward|policy|q-learning|environment|mdp|actor-critic)\b/gi,
                'Generative-AI': /\b(gan|vae|diffusion|generation|synthesis|stable diffusion|midjourney)\b/gi,
                'Time-Series': /\b(lstm|rnn|forecasting|temporal|sequence|arima)\b/gi,
                'MLOps': /\b(mlflow|kubeflow|model serving|deployment|monitoring|drift)\b/gi
            },
            'Quantum-Computing': {
                'Quantum-Algorithms': /\b(shor|grover|vqe|qaoa|quantum algorithm|quantum supremacy)\b/gi,
                'Quantum-Hardware': /\b(ion trap|superconducting|photonic|quantum processor|ibm quantum|rigetti)\b/gi,
                'Quantum-Error-Correction': /\b(error correction|fault tolerant|surface code|logical qubit)\b/gi,
                'Quantum-ML': /\b(quantum machine learning|qml|variational|quantum neural)\b/gi
            },
            'Blockchain': {
                'Smart-Contracts': /\b(solidity|vyper|evm|contract|dapp|chainlink)\b/gi,
                'DeFi': /\b(defi|liquidity pool|amm|yield farming|lending protocol|dex)\b/gi,
                'Layer2': /\b(layer 2|rollup|polygon|arbitrum|optimism|scaling solution)\b/gi,
                'Web3': /\b(web3|ipfs|decentralized|dao|nft|metaverse)\b/gi
            },
            'Natural-Language-Processing': {
                'Large-Language-Models': /\b(llm|gpt|bert|transformer|attention|fine-tuning)\b/gi,
                'Information-Extraction': /\b(ner|entity extraction|relation extraction|knowledge graph)\b/gi,
                'Conversational-AI': /\b(chatbot|dialogue|intent|slot filling|rasa)\b/gi,
                'Multilingual-NLP': /\b(multilingual|translation|cross-lingual|mbert|xlm)\b/gi
            }
        };
        
        const subdomains = [];
        const domainSubdomains = subdomainMap[primaryDomain] || {};
        
        for (const [subdomain, pattern] of Object.entries(domainSubdomains)) {
            const matches = text.match(pattern) || [];
            if (matches.length > 0) {
                subdomains.push({
                    name: subdomain,
                    indicators: matches.length,  // Keep as number for now
                    indicatorTerms: [...new Set(matches.map(m => m.toLowerCase()))],
                    confidence: Math.min(matches.length / 5, 1.0)
                });
            }
        }
        
        return subdomains.sort((a, b) => b.confidence - a.confidence);
    },
    
    // Deduplicate and merge similar domains
    deduplicateDomains: (domains) => {
        const unique = {};
        
        domains.forEach(d => {
            const key = d.domain;
            if (!unique[key]) {
                unique[key] = d;
            } else if (unique[key].confidence < d.confidence) {
                // Original discarded the previous entry's subdomains when replacing it.
                const previous = unique[key];
                unique[key] = d;
                if (previous.subdomains && previous.subdomains.length > 0) {
                    unique[key].subdomains = DomainIdentifier.mergeSubdomains(
                        unique[key].subdomains || [],
                        previous.subdomains
                    );
                }
            } else if (d.subdomains && d.subdomains.length > 0) {
                // Merge subdomains if same primary domain
                unique[key].subdomains = DomainIdentifier.mergeSubdomains(
                    unique[key].subdomains || [],
                    d.subdomains
                );
            }
        });
        
        return Object.values(unique);
    },
    
    // Merge subdomain lists
    mergeSubdomains: (existing, newSubs) => {
        const merged = [...existing];
        
        newSubs.forEach(newSub => {
            const exists = merged.find(s => s.name === newSub.name);
            if (!exists) {
                merged.push(newSub);
            } else if (exists.confidence < newSub.confidence) {
                exists.confidence = newSub.confidence;
                exists.indicators = newSub.indicators;
                exists.indicatorTerms = [...new Set([...exists.indicatorTerms, ...newSub.indicatorTerms])];
            }
        });
        
        return merged.sort((a, b) => b.confidence - a.confidence);
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomainIdentifier;
}