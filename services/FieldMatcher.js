/**
 * Resolves Paperless field names using exact and fuzzy matching.
 */
class FieldMatcher {
    constructor(paperlessFields) {
        this.fields = Array.isArray(paperlessFields) ? paperlessFields : [];
        this.embeddings = null;
        this.semanticIndex = this.fields.map(field => ({
            field,
            tokens: this._tokenize(field?.name),
            bigrams: this._bigrams(field?.name)
        }));
    }

    matchExact(fieldName) {
        const normalized = this._normalize(fieldName);
        return this.fields.find(field => this._normalize(field.name) === normalized) || null;
    }

    matchFuzzy(fieldName, threshold = 0.8) {
        const normalized = this._normalize(fieldName);
        let best = null;
        let bestScore = 0;

        for (const field of this.fields) {
            const score = this.levenshteinSimilarity(normalized, this._normalize(field.name));
            if (score > bestScore) {
                bestScore = score;
                best = field;
            }
        }

        if (best && bestScore >= threshold) {
            return { field: best, score: bestScore };
        }

        return null;
    }

    async matchSemantic(fieldName, threshold = 0.85) {
        const queryTokens = this._tokenize(fieldName);
        const queryBigrams = this._bigrams(fieldName);
        if (queryTokens.size === 0 && queryBigrams.length === 0) return null;

        let best = null;
        let bestScore = 0;

        for (const entry of this.semanticIndex) {
            const tokenScore = this._jaccard(queryTokens, entry.tokens);
            const bigramScore = this._dice(queryBigrams, entry.bigrams);
            const score = (tokenScore * 0.6) + (bigramScore * 0.4);

            if (score > bestScore) {
                bestScore = score;
                best = entry.field;
            }
        }

        if (best && bestScore >= threshold) {
            return { field: best, score: bestScore };
        }

        return null;
    }

    async findBestMatch(fieldName) {
        const exact = this.matchExact(fieldName);
        if (exact) return { field: exact, method: 'exact', confidence: 1.0 };

        const fuzzy = this.matchFuzzy(fieldName);
        if (fuzzy) return { field: fuzzy.field, method: 'fuzzy', confidence: fuzzy.score };

        if (this.embeddings) {
            const semantic = await this.matchSemantic(fieldName);
            if (semantic) return { field: semantic.field, method: 'semantic', confidence: semantic.score };
        }

        return null;
    }

    levenshteinDistance(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;

        const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

        for (let i = 0; i <= a.length; i += 1) {
            matrix[i][0] = i;
        }
        for (let j = 0; j <= b.length; j += 1) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= a.length; i += 1) {
            for (let j = 1; j <= b.length; j += 1) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[a.length][b.length];
    }

    levenshteinSimilarity(a, b) {
        const distance = this.levenshteinDistance(a, b);
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        return 1 - (distance / maxLen);
    }

    _normalize(value) {
        if (!value) return '';
        return String(value).toLowerCase().trim();
    }

    _tokenize(value) {
        if (!value) return new Set();
        const tokens = String(value)
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .filter(Boolean);
        return new Set(tokens);
    }

    _bigrams(value) {
        if (!value) return [];
        const normalized = this._normalize(value).replace(/[^a-z0-9]+/g, ' ');
        const chars = normalized.replace(/\s+/g, ' ').trim();
        if (chars.length < 2) return [];
        const grams = [];
        for (let i = 0; i < chars.length - 1; i += 1) {
            grams.push(chars.slice(i, i + 2));
        }
        return grams;
    }

    _jaccard(aSet, bSet) {
        if (!aSet.size && !bSet.size) return 0;
        let intersection = 0;
        for (const value of aSet) {
            if (bSet.has(value)) intersection += 1;
        }
        const union = aSet.size + bSet.size - intersection;
        return union ? intersection / union : 0;
    }

    _dice(a, b) {
        if (!a.length && !b.length) return 0;
        const counts = new Map();
        for (const gram of a) {
            counts.set(gram, (counts.get(gram) || 0) + 1);
        }
        let intersection = 0;
        for (const gram of b) {
            const count = counts.get(gram) || 0;
            if (count > 0) {
                intersection += 1;
                counts.set(gram, count - 1);
            }
        }
        return (2 * intersection) / (a.length + b.length);
    }
}

module.exports = FieldMatcher;
