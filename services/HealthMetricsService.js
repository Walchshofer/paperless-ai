const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'health_metrics.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS health_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    test_date DATE,
    laboratory TEXT,
    biomarker_code TEXT NOT NULL,
    biomarker_name_de TEXT,
    biomarker_name_en TEXT,
    category TEXT,
    value REAL NOT NULL,
    unit TEXT,
    reference_low REAL,
    reference_high REAL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, biomarker_code)
  );
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_health_metrics_code ON health_metrics(biomarker_code);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_health_metrics_date ON health_metrics(test_date);`);

const upsertReading = db.prepare(`
  INSERT INTO health_metrics (
    document_id,
    test_date,
    laboratory,
    biomarker_code,
    biomarker_name_de,
    biomarker_name_en,
    category,
    value,
    unit,
    reference_low,
    reference_high,
    status
  ) VALUES (
    @document_id,
    @test_date,
    @laboratory,
    @biomarker_code,
    @biomarker_name_de,
    @biomarker_name_en,
    @category,
    @value,
    @unit,
    @reference_low,
    @reference_high,
    @status
  )
  ON CONFLICT(document_id, biomarker_code) DO UPDATE SET
    test_date = excluded.test_date,
    laboratory = excluded.laboratory,
    biomarker_name_de = excluded.biomarker_name_de,
    biomarker_name_en = excluded.biomarker_name_en,
    category = excluded.category,
    value = excluded.value,
    unit = excluded.unit,
    reference_low = excluded.reference_low,
    reference_high = excluded.reference_high,
    status = excluded.status
`);

class HealthMetricsService {
    storeMetrics(documentId, results) {
        if (!documentId || !results || !Array.isArray(results.biomarkers)) {
            return { inserted: 0, skipped: 0 };
        }

        const testDate = results.test_date || results.testDate || null;
        const laboratory = results.laboratory || null;

        let inserted = 0;
        let skipped = 0;

        for (const biomarker of results.biomarkers) {
            const value = this._toNumber(biomarker?.value);
            if (value === null) {
                skipped += 1;
                continue;
            }

            const code = biomarker?.code
                || this._normalizeCode(biomarker?.name_de || biomarker?.name || biomarker?.name_en);
            if (!code) {
                skipped += 1;
                continue;
            }

            upsertReading.run({
                document_id: documentId,
                test_date: testDate,
                laboratory,
                biomarker_code: code,
                biomarker_name_de: biomarker?.name_de || biomarker?.name || null,
                biomarker_name_en: biomarker?.name_en || null,
                category: biomarker?.category || null,
                value,
                unit: biomarker?.unit || null,
                reference_low: this._toNumber(biomarker?.reference_low),
                reference_high: this._toNumber(biomarker?.reference_high),
                status: biomarker?.status || null
            });
            inserted += 1;
        }

        return { inserted, skipped };
    }

    getDb() {
        return db;
    }

    _toNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(value);
        return Number.isNaN(numeric) ? null : numeric;
    }

    _normalizeCode(name) {
        if (!name || typeof name !== 'string') return null;
        return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    }
}

module.exports = new HealthMetricsService();
