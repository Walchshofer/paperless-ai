class PatternDetectionEngine {
    constructor(database) {
        this.db = database;
    }

    analyzePatterns() {
        return {
            trends: this.detectTrends(),
            seasonalPatterns: this.detectSeasonalPatterns(),
            correlations: this.detectCorrelations(),
            anomalies: this.detectAnomalies()
        };
    }

    detectTrends() {
        const biomarkers = this.db.prepare(`
            SELECT DISTINCT biomarker_code FROM health_metrics
        `).all();

        const trends = [];

        for (const row of biomarkers) {
            const readings = this.db.prepare(`
                SELECT test_date, value
                FROM health_metrics
                WHERE biomarker_code = ?
                ORDER BY test_date ASC
            `).all(row.biomarker_code);

            if (readings.length >= 3) {
                const trend = this._calculateTrend(readings);
                trends.push({
                    biomarker: row.biomarker_code,
                    readings_count: readings.length,
                    first_value: readings[0].value,
                    last_value: readings[readings.length - 1].value,
                    trend: trend.direction,
                    change_percent: trend.changePercent,
                    confidence: trend.confidence
                });
            }
        }

        return trends;
    }

    detectSeasonalPatterns() {
        const biomarkers = ['VIT_D', 'IRON', 'FERRITIN', 'HEMOGLOBIN'];
        const patterns = [];

        for (const biomarker of biomarkers) {
            const readings = this.db.prepare(`
                SELECT
                    strftime('%m', test_date) as month,
                    AVG(value) as avg_value,
                    COUNT(*) as count
                FROM health_metrics
                WHERE biomarker_code = ?
                GROUP BY month
                HAVING count >= 2
            `).all(biomarker);

            if (readings.length >= 4) {
                const avgByQuarter = this._groupByQuarter(readings);
                patterns.push({
                    biomarker,
                    quarterly_averages: avgByQuarter,
                    pattern: this._detectSeasonality(avgByQuarter)
                });
            }
        }

        return patterns;
    }

    detectCorrelations() {
        const correlationPairs = [
            ['HDL', 'LDL'],
            ['GOT_AST', 'GPT_ALT'],
            ['GLUCOSE', 'HBA1C'],
            ['IRON', 'FERRITIN'],
            ['TSH', 'FT4'],
            ['CREATININE', 'GFR']
        ];

        const correlations = [];

        for (const [bio1, bio2] of correlationPairs) {
            const data = this.db.prepare(`
                SELECT r1.value as value1, r2.value as value2
                FROM health_metrics r1
                JOIN health_metrics r2 ON r1.test_date = r2.test_date
                WHERE r1.biomarker_code = ? AND r2.biomarker_code = ?
            `).all(bio1, bio2);

            if (data.length >= 5) {
                const correlation = this._pearsonCorrelation(
                    data.map(d => d.value1),
                    data.map(d => d.value2)
                );

                correlations.push({
                    biomarker1: bio1,
                    biomarker2: bio2,
                    correlation: Math.round(correlation * 100) / 100,
                    strength: this._correlationStrength(correlation),
                    data_points: data.length
                });
            }
        }

        return correlations;
    }

    detectAnomalies() {
        const anomalies = [];

        const biomarkers = this.db.prepare(`
            SELECT DISTINCT biomarker_code FROM health_metrics
        `).all();

        for (const row of biomarkers) {
            const readings = this.db.prepare(`
                SELECT document_id, test_date, value
                FROM health_metrics
                WHERE biomarker_code = ?
                ORDER BY test_date ASC
            `).all(row.biomarker_code);

            if (readings.length >= 5) {
                const values = readings.map(r => r.value);
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
                const stdDev = Math.sqrt(variance);

                if (stdDev === 0) continue;

                for (const reading of readings) {
                    const zScore = (reading.value - mean) / stdDev;
                    if (Math.abs(zScore) > 2) {
                        anomalies.push({
                            biomarker: row.biomarker_code,
                            document_id: reading.document_id,
                            test_date: reading.test_date,
                            value: reading.value,
                            mean: Math.round(mean * 10) / 10,
                            z_score: Math.round(zScore * 10) / 10,
                            type: zScore > 0 ? 'unusually_high' : 'unusually_low'
                        });
                    }
                }
            }
        }

        return anomalies;
    }

    _calculateTrend(readings) {
        if (readings.length < 2) {
            return { direction: 'insufficient_data', changePercent: 0, confidence: 0 };
        }

        const firstValue = readings[0].value;
        const lastValue = readings[readings.length - 1].value;
        const changePercent = firstValue ? ((lastValue - firstValue) / firstValue) * 100 : 0;

        const n = readings.length;
        const xMean = (n - 1) / 2;
        const yMean = readings.reduce((sum, r) => sum + r.value, 0) / n;

        let numerator = 0;
        let denominator = 0;

        readings.forEach((r, i) => {
            numerator += (i - xMean) * (r.value - yMean);
            denominator += Math.pow(i - xMean, 2);
        });

        const slope = denominator ? numerator / denominator : 0;

        let direction = 'stable';
        if (changePercent > 5) direction = 'rising';
        if (changePercent < -5) direction = 'falling';

        const predictions = readings.map((_, i) => yMean + slope * (i - xMean));
        const ssRes = readings.reduce((sum, r, i) => sum + Math.pow(r.value - predictions[i], 2), 0);
        const ssTot = readings.reduce((sum, r) => sum + Math.pow(r.value - yMean, 2), 0);
        const rSquared = ssTot ? 1 - (ssRes / ssTot) : 0;

        return {
            direction,
            changePercent: Math.round(changePercent * 10) / 10,
            confidence: Math.round(rSquared * 100) / 100
        };
    }

    _groupByQuarter(monthlyReadings) {
        const quarters = { Q1: [], Q2: [], Q3: [], Q4: [] };

        for (const r of monthlyReadings) {
            const month = parseInt(r.month, 10);
            if (month <= 3) quarters.Q1.push(r.avg_value);
            else if (month <= 6) quarters.Q2.push(r.avg_value);
            else if (month <= 9) quarters.Q3.push(r.avg_value);
            else quarters.Q4.push(r.avg_value);
        }

        return {
            Q1: quarters.Q1.length ? this._average(quarters.Q1) : null,
            Q2: quarters.Q2.length ? this._average(quarters.Q2) : null,
            Q3: quarters.Q3.length ? this._average(quarters.Q3) : null,
            Q4: quarters.Q4.length ? this._average(quarters.Q4) : null
        };
    }

    _detectSeasonality(quarters) {
        const values = [quarters.Q1, quarters.Q2, quarters.Q3, quarters.Q4].filter(v => v !== null);
        if (values.length < 3) return 'insufficient_data';

        const max = Math.max(...values);
        const min = Math.min(...values);
        const variation = (max - min) / ((max + min) / 2) * 100;

        if (variation < 10) return 'no_seasonal_pattern';

        const maxQ = Object.entries(quarters).find(([_, v]) => v === max)?.[0] || 'Q?';
        const minQ = Object.entries(quarters).find(([_, v]) => v === min)?.[0] || 'Q?';

        return `Peak in ${maxQ}, Low in ${minQ} (${Math.round(variation)}% variation)`;
    }

    _pearsonCorrelation(x, y) {
        const n = x.length;
        const xMean = x.reduce((a, b) => a + b, 0) / n;
        const yMean = y.reduce((a, b) => a + b, 0) / n;

        let numerator = 0;
        let denomX = 0;
        let denomY = 0;

        for (let i = 0; i < n; i += 1) {
            const xDiff = x[i] - xMean;
            const yDiff = y[i] - yMean;
            numerator += xDiff * yDiff;
            denomX += xDiff * xDiff;
            denomY += yDiff * yDiff;
        }

        if (denomX === 0 || denomY === 0) return 0;
        return numerator / Math.sqrt(denomX * denomY);
    }

    _correlationStrength(r) {
        const absR = Math.abs(r);
        if (absR >= 0.8) return 'very_strong';
        if (absR >= 0.6) return 'strong';
        if (absR >= 0.4) return 'moderate';
        if (absR >= 0.2) return 'weak';
        return 'very_weak';
    }

    _average(values) {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
}

module.exports = PatternDetectionEngine;
