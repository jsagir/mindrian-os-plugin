// ========================================
// GENESIS CONTEXT DECOMPOSER v2.2 (2026 revision)
// Paragraph/sentence segmentation and keyword-pattern element extraction.
// This is rule based (regex lexicons). It is not a language model and not
// semantic segmentation; element lists are lexical hits, not understanding.
// ========================================

const ContextDecomposer = {
    // Set to true to silence progress logging (tests, library use).
    silent: false,

    // Tunable limits. Override by assigning to ContextDecomposer.limits.
    limits: {
        minContextChars: 50,       // original behaviour
        maxContextChars: 200000,   // bound memory and regex work
        chunkChars: 300,           // paragraph length that triggers sentence chunking
        minAtomicChars: 50         // shorter paragraphs are reported in diagnostics.droppedShort
    },

    log: (...args) => {
        if (!ContextDecomposer.silent) console.log(...args);
    },

    // Main entry point
    analyzeContext: async (contextText) => {
        ContextDecomposer.log("Genesis: initializing context analysis");

        if (typeof contextText !== 'string') {
            throw new TypeError("contextText must be a string");
        }
        if (contextText.trim().length < ContextDecomposer.limits.minContextChars) {
            throw new Error("Context too short for meaningful analysis (min " + ContextDecomposer.limits.minContextChars + " chars)");
        }
        let truncated = false;
        if (contextText.length > ContextDecomposer.limits.maxContextChars) {
            contextText = contextText.slice(0, ContextDecomposer.limits.maxContextChars);
            truncated = true;
        }

        // Step 1: segmentation
        const diagnostics = { droppedShort: 0, droppedShortExamples: [], truncated };
        const segments = ContextDecomposer.semanticSegmentation(contextText, diagnostics);
        ContextDecomposer.log("Identified " + segments.length + " segments");

        // Step 2: element extraction
        const elements = ContextDecomposer.extractCoreElements(segments);

        // Step 3: complexity analysis
        const complexity = ContextDecomposer.analyzeComplexity(elements);

        return {
            originalContext: contextText,
            segments,
            elements,
            complexity,
            timestamp: new Date().toISOString(),
            // additive keys
            diagnostics,
            provenance: {
                module: 'GenesisContextDecomposer',
                version: '2.2',
                method: 'regex segmentation and keyword lexicons (rule based, not a model)',
                limits: Object.assign({}, ContextDecomposer.limits)
            }
        };
    },

    // Sentence splitter that does not break decimals ("3.5") or lowercase continuations.
    splitSentences: (para) => {
        const parts = para.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/).map(s => s.trim()).filter(Boolean);
        return parts.length ? parts : [para.trim()];
    },

    // Paragraph segmentation, then sentence-boundary chunking of long paragraphs.
    semanticSegmentation: (text, diagnostics) => {
        ContextDecomposer.log("Segmenting context");
        const diag = diagnostics || { droppedShort: 0, droppedShortExamples: [] };
        const lim = ContextDecomposer.limits;
        const wc = (s) => s.trim().split(/\s+/).filter(Boolean).length;

        const rawSegments = text.split(/\n\s*\n+/).filter(s => s.trim().length > 0);
        const segments = [];

        rawSegments.forEach(para => {
            if (para.length > lim.chunkChars) {
                const sentences = ContextDecomposer.splitSentences(para);
                let chunk = "";

                const flush = () => {
                    const t = chunk.trim();
                    if (t) {
                        segments.push({ text: t, type: 'composite', wordCount: wc(t) });
                    }
                    chunk = "";
                };

                sentences.forEach(sent => {
                    // Original pushed an empty chunk when the first sentence alone exceeded the limit.
                    if (chunk && chunk.length + sent.length > lim.chunkChars) {
                        flush();
                    }
                    chunk += (chunk ? " " : "") + sent;
                });
                flush();
            } else if (para.trim().length > lim.minAtomicChars) {
                const t = para.trim();
                segments.push({ text: t, type: 'atomic', wordCount: wc(t) });
            } else {
                diag.droppedShort += 1;
                if (diag.droppedShortExamples.length < 5) {
                    diag.droppedShortExamples.push(para.trim().slice(0, 60));
                }
            }
        });

        return segments;
    },

    // Extract core conceptual elements (lexical hits only)
    extractCoreElements: (segments) => {
        ContextDecomposer.log("Extracting core elements");

        const elements = {
            concepts: new Map(),   // lower-case key -> first-seen surface form
            technologies: new Set(),
            methodologies: new Set(),
            challenges: new Set(),
            opportunities: new Set()
        };

        // Capitalised words that start sentences are not concepts.
        const notConcepts = new Set(['the', 'this', 'that', 'these', 'those', 'there', 'their', 'then', 'they', 'when',
            'where', 'while', 'with', 'what', 'which', 'who', 'why', 'how', 'and', 'but', 'for', 'our', 'its', 'also',
            'however', 'because', 'since', 'if', 'it', 'we', 'you', 'in', 'on', 'at', 'as', 'by', 'an', 'a', 'one',
            'each', 'some', 'many', 'most', 'such', 'both', 'all', 'any', 'can', 'will', 'should', 'would', 'could']);

        const techPatterns = /\b(algorithm|system|platform|framework|protocol|architecture|model|network|database|api|interface|software|hardware|cloud|edge|iot|blockchain|quantum|ai|ml|deep learning)\b/gi;
        const methodPatterns = /\b(approach|method|technique|strategy|process|procedure|analysis|optimization|implementation|design|development)\b/gi;
        const challengePatterns = /\b(challenge|problem|issue|constraint|limitation|bottleneck|obstacle|difficulty|barrier|gap)\b/gi;
        const oppPatterns = /\b(opportunity|potential|enables?|allows?|unlocks?|opens up|breakthrough|innovation|advantage|benefit)\b/gi;
        // Capitalised phrases, plus acronyms such as IBM, GPT-4, OpenAI-style mixed case.
        const conceptPattern = /\b(?:[A-Z][a-z0-9\-]{2,}(?:\s[A-Z][a-z0-9\-]{2,})*|[A-Z]{2,}[A-Z0-9\-]*|[A-Z][a-z]+[A-Z][A-Za-z0-9]*)\b/g;

        segments.forEach(seg => {
            const text = seg.text;
            const textLower = text.toLowerCase();

            (text.match(conceptPattern) || []).forEach(c => {
                const trimmed = c.trim();
                const key = trimmed.toLowerCase();
                if (!notConcepts.has(key) && !elements.concepts.has(key)) {
                    elements.concepts.set(key, trimmed);
                }
            });
            (textLower.match(techPatterns) || []).forEach(t => elements.technologies.add(t));
            (textLower.match(methodPatterns) || []).forEach(m => elements.methodologies.add(m));
            (textLower.match(challengePatterns) || []).forEach(c => elements.challenges.add(c));
            (textLower.match(oppPatterns) || []).forEach(o => elements.opportunities.add(o));
        });

        return {
            concepts: Array.from(elements.concepts.values()),
            technologies: Array.from(elements.technologies),
            methodologies: Array.from(elements.methodologies),
            challenges: Array.from(elements.challenges),
            opportunities: Array.from(elements.opportunities)
        };
    },

    // Analyze complexity and depth required
    analyzeComplexity: (elements) => {
        ContextDecomposer.log("Analyzing complexity levels");

        const len = (k) => (elements && Array.isArray(elements[k]) ? elements[k].length : 0);
        const techComplexity = len('technologies');
        const methodComplexity = len('methodologies');
        const challengeComplexity = len('challenges');
        const conceptComplexity = len('concepts');

        const totalComplexity = techComplexity + methodComplexity + challengeComplexity + (conceptComplexity * 0.5);

        return {
            level: totalComplexity > 20 ? 'HIGH' : totalComplexity > 10 ? 'MEDIUM' : 'LOW',
            techComplexity,
            methodComplexity,
            challengeComplexity,
            conceptComplexity,
            totalComplexity: Math.round(totalComplexity),
            depthRequired: totalComplexity > 20 ? 'AUTHORITY' : totalComplexity > 10 ? 'EXPERT' : 'SPECIALIST'
        };
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContextDecomposer;
}
