# 🩺 Health Metrics Extraction & Pattern Detection System
## Personal Medical Data Digitization for Paperless-AI

**User**: Patrick Walchshofer (Linz, Austria)
**Purpose**: Fully autonomous personal health data tracking
**Privacy**: 100% local processing, no external APIs, GDPR compliant by design

---

## 🎯 Vision

Build an intelligent system that:
1. **Detects** lab reports and medical test documents automatically
2. **Extracts** all biomarkers, values, units, and reference ranges
3. **Stores** structured data for longitudinal tracking
4. **Analyzes** patterns over time (trends, anomalies, correlations)
5. **Alerts** on concerning patterns or values outside reference ranges

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT INGESTION                               │
│              Scanner → Consume Folder → Paperless-NGX                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PAPERLESS-AI DOCUMENT ROUTER                          │
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   PLANNER   │───▶│ TYPE CHECK  │───▶│ MODE SELECT │                 │
│  │  (qwen3-vl) │    │ Lab Report? │    │ Expert/Std  │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│                                              │                          │
│         ┌────────────────────────────────────┼────────────────────┐     │
│         ▼                                    ▼                    ▼     │
│  ┌─────────────────┐    ┌─────────────────────────┐  ┌────────────────┐│
│  │  STANDARD MODE  │    │   MEDICAL EXPERT MODE   │  │  VISION MODE   ││
│  │   (gpt-oss)     │    │   (specialized model)   │  │  (qwen3-vl)    ││
│  │                 │    │                         │  │                ││
│  │ General docs    │    │ Lab reports, prescripts │  │ Complex layout ││
│  │ Bills, letters  │    │ Blood tests, imaging    │  │ Tables, forms  ││
│  └─────────────────┘    └─────────────────────────┘  └────────────────┘│
│                                    │                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     BLOOD TEST EXTRACTION PIPELINE                       │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  BIOMARKER   │─▶│    VALUE     │─▶│    UNIT      │─▶│  REFERENCE  │ │
│  │  DETECTION   │  │  EXTRACTION  │  │   PARSING    │  │    RANGE    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                              │          │
│                                                              ▼          │
│                                                    ┌─────────────────┐  │
│                                                    │  STATUS CHECK   │  │
│                                                    │ Normal/High/Low │  │
│                                                    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      HEALTH METRICS DATABASE                             │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ health_metrics                                                   │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ id | document_id | test_date | biomarker | value | unit | ref_  │   │
│  │    |             |           |           |       |      | range │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 1  | 89          | 2025-10-04| HbA1c     | 5.4   | %    | 4-6   │   │
│  │ 2  | 89          | 2025-10-04| Glucose   | 95    | mg/dL| 70-100│   │
│  │ 3  | 89          | 2025-10-04| HDL       | 55    | mg/dL| >40   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ biomarker_trends                                                 │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ biomarker | date       | value | trend | status                  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ HbA1c     | 2025-10-04 | 5.4   | ↓     | normal                  │   │
│  │ HbA1c     | 2025-07-15 | 5.6   | ↑     | normal                  │   │
│  │ HbA1c     | 2025-04-01 | 5.2   | -     | normal                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PATTERN DETECTION ENGINE                            │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   TRENDS    │  │  ANOMALIES  │  │ CORRELATIONS│  │   ALERTS    │    │
│  │  Detection  │  │  Detection  │  │   Analysis  │  │  Generation │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                          │
│  • Rising/falling trends over time                                       │
│  • Values outside reference ranges                                       │
│  • Correlations between biomarkers                                       │
│  • Seasonal patterns                                                     │
│  • Medication impact tracking                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 Biomarker Extraction Schema

### Common Austrian Lab Report Biomarkers

#### Blood Count (Blutbild)
| Biomarker (German) | Biomarker (English) | Unit | Typical Range |
|-------------------|---------------------|------|---------------|
| Erythrozyten | Red Blood Cells (RBC) | T/L | 4.5-5.5 |
| Hämoglobin | Hemoglobin (Hb) | g/dL | 13.5-17.5 |
| Hämatokrit | Hematocrit (Hct) | % | 40-52 |
| Leukozyten | White Blood Cells (WBC) | G/L | 4.0-10.0 |
| Thrombozyten | Platelets | G/L | 150-400 |
| MCV | Mean Corpuscular Volume | fL | 80-100 |
| MCH | Mean Corpuscular Hemoglobin | pg | 27-33 |
| MCHC | Mean Corpuscular Hb Concentration | g/dL | 32-36 |

#### Metabolic Panel
| Biomarker (German) | Biomarker (English) | Unit | Typical Range |
|-------------------|---------------------|------|---------------|
| Glukose | Glucose (fasting) | mg/dL | 70-100 |
| HbA1c | Glycated Hemoglobin | % | 4.0-5.6 |
| Cholesterin | Total Cholesterol | mg/dL | <200 |
| HDL-Cholesterin | HDL Cholesterol | mg/dL | >40 |
| LDL-Cholesterin | LDL Cholesterol | mg/dL | <100 |
| Triglyceride | Triglycerides | mg/dL | <150 |
| Kreatinin | Creatinine | mg/dL | 0.7-1.2 |
| Harnstoff | Blood Urea Nitrogen | mg/dL | 8-23 |
| Harnsäure | Uric Acid | mg/dL | 3.4-7.0 |
| GFR | Glomerular Filtration Rate | mL/min | >90 |

#### Liver Function (Leberwerte)
| Biomarker (German) | Biomarker (English) | Unit | Typical Range |
|-------------------|---------------------|------|---------------|
| GOT/AST | Aspartate Aminotransferase | U/L | <35 |
| GPT/ALT | Alanine Aminotransferase | U/L | <45 |
| GGT | Gamma-Glutamyl Transferase | U/L | <55 |
| Alkalische Phosphatase | Alkaline Phosphatase | U/L | 40-130 |
| Bilirubin | Bilirubin | mg/dL | 0.1-1.2 |
| Albumin | Albumin | g/dL | 3.5-5.0 |

#### Thyroid Function (Schilddrüsenwerte)
| Biomarker (German) | Biomarker (English) | Unit | Typical Range |
|-------------------|---------------------|------|---------------|
| TSH | Thyroid Stimulating Hormone | mU/L | 0.4-4.0 |
| fT3 | Free Triiodothyronine | pg/mL | 2.0-4.4 |
| fT4 | Free Thyroxine | ng/dL | 0.8-1.8 |

#### Vitamins & Minerals
| Biomarker (German) | Biomarker (English) | Unit | Typical Range |
|-------------------|---------------------|------|---------------|
| Vitamin D (25-OH) | Vitamin D | ng/mL | 30-100 |
| Vitamin B12 | Vitamin B12 | pg/mL | 200-900 |
| Folsäure | Folate | ng/mL | 3-17 |
| Ferritin | Ferritin | ng/mL | 30-400 |
| Eisen | Iron | µg/dL | 60-170 |
| Magnesium | Magnesium | mg/dL | 1.7-2.3 |
| Kalzium | Calcium | mg/dL | 8.5-10.5 |
| Kalium | Potassium | mmol/L | 3.5-5.0 |
| Natrium | Sodium | mmol/L | 135-145 |

#### Inflammation Markers
| Biomarker (German) | Biomarker (English) | Unit | Typical Range |
|-------------------|---------------------|------|---------------|
| CRP | C-Reactive Protein | mg/L | <5 |
| BSG | Erythrocyte Sedimentation Rate | mm/h | <20 |

---

## 🧠 Expert Model for Medical Extraction

### Option 1: Fine-tuned Medical Model (Recommended)

**Base Model**: `meditron:7b` or `medllama:7b`

```bash
# Pull medical-focused model
ollama pull meditron:7b

# Or create custom medical model
ollama create medextract -f ./Modelfile.medical
```

**Modelfile.medical**:
```dockerfile
FROM meditron:7b

# Medical extraction system prompt
SYSTEM """
You are a medical laboratory report extraction specialist.
Your task is to extract ALL biomarkers, values, units, and reference ranges from lab reports.

EXTRACTION RULES:
1. Extract EVERY biomarker found in the document
2. Include German AND English names where available
3. Parse numeric values exactly as shown
4. Extract units (mg/dL, g/L, %, etc.)
5. Extract reference ranges (normal values)
6. Determine if value is normal, high, or low
7. Handle Austrian/German lab report formats

OUTPUT FORMAT (JSON):
{
  "test_date": "YYYY-MM-DD",
  "laboratory": "Lab name",
  "patient_id": "ID if visible",
  "biomarkers": [
    {
      "name_de": "German name",
      "name_en": "English name",
      "value": 5.4,
      "unit": "%",
      "reference_low": 4.0,
      "reference_high": 6.0,
      "status": "normal|high|low",
      "category": "Blutbild|Stoffwechsel|Leber|Schilddrüse|Vitamine|Entzündung"
    }
  ]
}

IMPORTANT:
- Never invent or guess values
- Mark unclear values as "unclear"
- Extract ALL values, even partial ones
- Preserve original precision (5.4, not 5.40)
"""

PARAMETER temperature 0.1
PARAMETER num_ctx 8192
```

### Option 2: Vision Model with Medical Prompt

Enhance the existing `qwen3-vl:8b` with specialized prompting:

```javascript
const medicalExtractionPrompt = `
Analyze this medical laboratory report image and extract ALL biomarkers.

For EACH biomarker found, provide:
1. Name (German and English if shown)
2. Numeric value (exactly as shown)
3. Unit of measurement
4. Reference range (normal values)
5. Whether the value is normal, high, or low

Format as JSON array:
{
  "test_date": "YYYY-MM-DD",
  "biomarkers": [
    {
      "name": "Hämoglobin",
      "name_en": "Hemoglobin",
      "value": 14.5,
      "unit": "g/dL",
      "reference": "13.5-17.5",
      "status": "normal"
    }
  ]
}

IMPORTANT: Extract EVERY value visible in the report.
`;
```

---

## 💾 Database Schema

### Option A: Paperless-NGX Custom Fields (Simple)

Create custom fields in Paperless-NGX for key metrics:

```javascript
// Required custom fields (create via UI or API)
const healthMetricFields = [
  // Blood sugar
  { name: 'lab_glucose', type: 'number', label: 'Glucose (mg/dL)' },
  { name: 'lab_hba1c', type: 'number', label: 'HbA1c (%)' },

  // Lipids
  { name: 'lab_cholesterol', type: 'number', label: 'Cholesterol (mg/dL)' },
  { name: 'lab_hdl', type: 'number', label: 'HDL (mg/dL)' },
  { name: 'lab_ldl', type: 'number', label: 'LDL (mg/dL)' },
  { name: 'lab_triglycerides', type: 'number', label: 'Triglycerides (mg/dL)' },

  // Liver
  { name: 'lab_got_ast', type: 'number', label: 'GOT/AST (U/L)' },
  { name: 'lab_gpt_alt', type: 'number', label: 'GPT/ALT (U/L)' },
  { name: 'lab_ggt', type: 'number', label: 'GGT (U/L)' },

  // Kidney
  { name: 'lab_creatinine', type: 'number', label: 'Creatinine (mg/dL)' },
  { name: 'lab_gfr', type: 'number', label: 'GFR (mL/min)' },

  // Thyroid
  { name: 'lab_tsh', type: 'number', label: 'TSH (mU/L)' },

  // Vitamins
  { name: 'lab_vitamin_d', type: 'number', label: 'Vitamin D (ng/mL)' },
  { name: 'lab_vitamin_b12', type: 'number', label: 'Vitamin B12 (pg/mL)' },
  { name: 'lab_ferritin', type: 'number', label: 'Ferritin (ng/mL)' },

  // Inflammation
  { name: 'lab_crp', type: 'number', label: 'CRP (mg/L)' },

  // Metadata
  { name: 'lab_test_type', type: 'string', label: 'Test Type' },
  { name: 'lab_laboratory', type: 'string', label: 'Laboratory' },
  { name: 'lab_values_json', type: 'text', label: 'All Values (JSON)' }
];
```

### Option B: SQLite Health Database (Advanced)

Store detailed metrics in a separate SQLite database:

```sql
-- health_metrics.db

-- Main biomarker readings table
CREATE TABLE biomarker_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  test_date DATE NOT NULL,
  laboratory TEXT,

  -- Biomarker data
  biomarker_code TEXT NOT NULL,  -- e.g., 'HBA1C', 'GLUCOSE'
  biomarker_name_de TEXT,
  biomarker_name_en TEXT,
  category TEXT,  -- e.g., 'blood_sugar', 'lipids', 'liver'

  -- Value data
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  reference_low REAL,
  reference_high REAL,
  status TEXT CHECK(status IN ('normal', 'high', 'low', 'critical')),

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(document_id, biomarker_code)
);

-- Biomarker definitions (reference data)
CREATE TABLE biomarker_definitions (
  code TEXT PRIMARY KEY,
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT NOT NULL,
  default_unit TEXT,
  reference_low REAL,
  reference_high REAL,
  critical_low REAL,
  critical_high REAL,
  description TEXT
);

-- Trends table (calculated)
CREATE TABLE biomarker_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  biomarker_code TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value_start REAL,
  value_end REAL,
  trend TEXT CHECK(trend IN ('rising', 'falling', 'stable')),
  change_percent REAL,
  reading_count INTEGER,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE health_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER,
  biomarker_code TEXT NOT NULL,
  alert_type TEXT CHECK(alert_type IN ('out_of_range', 'rapid_change', 'pattern', 'critical')),
  severity TEXT CHECK(severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  value REAL,
  reference TEXT,
  acknowledged INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert biomarker definitions
INSERT INTO biomarker_definitions (code, name_de, name_en, category, default_unit, reference_low, reference_high) VALUES
-- Blood Sugar
('GLUCOSE', 'Glukose', 'Glucose', 'blood_sugar', 'mg/dL', 70, 100),
('HBA1C', 'HbA1c', 'Glycated Hemoglobin', 'blood_sugar', '%', 4.0, 5.6),

-- Lipids
('CHOL_TOTAL', 'Cholesterin', 'Total Cholesterol', 'lipids', 'mg/dL', NULL, 200),
('HDL', 'HDL-Cholesterin', 'HDL Cholesterol', 'lipids', 'mg/dL', 40, NULL),
('LDL', 'LDL-Cholesterin', 'LDL Cholesterol', 'lipids', 'mg/dL', NULL, 100),
('TRIGLYCERIDES', 'Triglyceride', 'Triglycerides', 'lipids', 'mg/dL', NULL, 150),

-- Liver
('GOT_AST', 'GOT/AST', 'Aspartate Aminotransferase', 'liver', 'U/L', NULL, 35),
('GPT_ALT', 'GPT/ALT', 'Alanine Aminotransferase', 'liver', 'U/L', NULL, 45),
('GGT', 'GGT', 'Gamma-Glutamyl Transferase', 'liver', 'U/L', NULL, 55),
('BILIRUBIN', 'Bilirubin', 'Bilirubin', 'liver', 'mg/dL', 0.1, 1.2),

-- Kidney
('CREATININE', 'Kreatinin', 'Creatinine', 'kidney', 'mg/dL', 0.7, 1.2),
('GFR', 'GFR', 'Glomerular Filtration Rate', 'kidney', 'mL/min', 90, NULL),
('UREA', 'Harnstoff', 'Blood Urea Nitrogen', 'kidney', 'mg/dL', 8, 23),
('URIC_ACID', 'Harnsäure', 'Uric Acid', 'kidney', 'mg/dL', 3.4, 7.0),

-- Thyroid
('TSH', 'TSH', 'Thyroid Stimulating Hormone', 'thyroid', 'mU/L', 0.4, 4.0),
('FT3', 'fT3', 'Free Triiodothyronine', 'thyroid', 'pg/mL', 2.0, 4.4),
('FT4', 'fT4', 'Free Thyroxine', 'thyroid', 'ng/dL', 0.8, 1.8),

-- Vitamins
('VIT_D', 'Vitamin D', 'Vitamin D (25-OH)', 'vitamins', 'ng/mL', 30, 100),
('VIT_B12', 'Vitamin B12', 'Vitamin B12', 'vitamins', 'pg/mL', 200, 900),
('FOLATE', 'Folsäure', 'Folate', 'vitamins', 'ng/mL', 3, 17),
('FERRITIN', 'Ferritin', 'Ferritin', 'vitamins', 'ng/mL', 30, 400),
('IRON', 'Eisen', 'Iron', 'vitamins', 'µg/dL', 60, 170),

-- Blood Count
('RBC', 'Erythrozyten', 'Red Blood Cells', 'blood_count', 'T/L', 4.5, 5.5),
('HEMOGLOBIN', 'Hämoglobin', 'Hemoglobin', 'blood_count', 'g/dL', 13.5, 17.5),
('HEMATOCRIT', 'Hämatokrit', 'Hematocrit', 'blood_count', '%', 40, 52),
('WBC', 'Leukozyten', 'White Blood Cells', 'blood_count', 'G/L', 4.0, 10.0),
('PLATELETS', 'Thrombozyten', 'Platelets', 'blood_count', 'G/L', 150, 400),

-- Inflammation
('CRP', 'CRP', 'C-Reactive Protein', 'inflammation', 'mg/L', NULL, 5),
('ESR', 'BSG', 'Erythrocyte Sedimentation Rate', 'inflammation', 'mm/h', NULL, 20);

-- Views for analysis
CREATE VIEW biomarker_history AS
SELECT
  r.biomarker_code,
  d.name_en,
  r.test_date,
  r.value,
  r.unit,
  r.status,
  LAG(r.value) OVER (PARTITION BY r.biomarker_code ORDER BY r.test_date) as prev_value,
  r.value - LAG(r.value) OVER (PARTITION BY r.biomarker_code ORDER BY r.test_date) as change
FROM biomarker_readings r
JOIN biomarker_definitions d ON r.biomarker_code = d.code
ORDER BY r.biomarker_code, r.test_date;

CREATE VIEW out_of_range_values AS
SELECT
  r.*,
  d.name_en,
  d.reference_low,
  d.reference_high,
  CASE
    WHEN r.value < d.reference_low THEN 'LOW'
    WHEN r.value > d.reference_high THEN 'HIGH'
    ELSE 'NORMAL'
  END as range_status
FROM biomarker_readings r
JOIN biomarker_definitions d ON r.biomarker_code = d.code
WHERE r.status != 'normal';
```

---

## 🤖 Implementation: Expert Model Routing

### Multi-Model Configuration

```javascript
// config/models.js

const modelConfig = {
  // Default text model
  text: {
    model: 'gpt-oss:latest',
    timeout: 600000,
    keepAlive: '2m'
  },

  // Vision model
  vision: {
    model: 'qwen3-vl:8b',
    timeout: 600000,
    keepAlive: '5m'
  },

  // Expert models (specialized)
  experts: {
    medical: {
      model: 'meditron:7b',  // Or custom fine-tuned model
      timeout: 300000,
      keepAlive: '10m',
      triggers: [
        'lab report', 'blood test', 'blutbild', 'laborbefund',
        'laborwerte', 'blutwerte', 'medizinisch', 'arztbefund'
      ],
      documentTypes: [
        'Lab Report', 'Blood Test', 'Medical Report',
        'Laborbefund', 'Befund', 'Arztbrief'
      ]
    },

    financial: {
      model: 'gpt-oss:latest',  // Use main model with finance prompt
      timeout: 300000,
      triggers: ['invoice', 'rechnung', 'bill', 'bank'],
      documentTypes: ['Invoice', 'Bill', 'Bank Statement']
    }
  }
};

module.exports = modelConfig;
```

### Model Router Implementation

```javascript
// services/modelRouter.js

const modelConfig = require('../config/models');

class ModelRouter {
  constructor(ollamaService) {
    this.ollama = ollamaService;
    this.config = modelConfig;
  }

  /**
   * Determine which model to use based on document content and classification
   */
  async routeDocument(documentId, content, classification) {
    // Check if this is a lab report
    if (this._isLabReport(content, classification)) {
      console.log(`[ROUTER] Document ${documentId} → Medical Expert Model`);
      return {
        model: this.config.experts.medical.model,
        mode: 'MEDICAL_EXPERT',
        extractor: 'labReport'
      };
    }

    // Check if this is a financial document
    if (this._isFinancialDocument(content, classification)) {
      console.log(`[ROUTER] Document ${documentId} → Financial Mode`);
      return {
        model: this.config.experts.financial.model,
        mode: 'FINANCIAL',
        extractor: 'invoice'
      };
    }

    // Default to standard routing
    return {
      model: this.config.text.model,
      mode: 'STANDARD',
      extractor: 'general'
    };
  }

  _isLabReport(content, classification) {
    const labKeywords = [
      // German
      'laborbefund', 'blutwerte', 'blutbild', 'laborwerte',
      'referenzbereich', 'normalwert', 'einheit',
      'erythrozyten', 'leukozyten', 'thrombozyten',
      'hämoglobin', 'hämatokrit', 'kreatinin',
      'cholesterin', 'triglyceride', 'glukose', 'hba1c',
      'got', 'gpt', 'ggt', 'bilirubin',
      'tsh', 'ft3', 'ft4',

      // English
      'lab report', 'blood test', 'laboratory', 'reference range',
      'hemoglobin', 'cholesterol', 'glucose', 'creatinine'
    ];

    const contentLower = content.toLowerCase();
    const matchCount = labKeywords.filter(kw => contentLower.includes(kw)).length;

    // Trigger if 3+ lab keywords found
    return matchCount >= 3;
  }

  _isFinancialDocument(content, classification) {
    const finKeywords = [
      'rechnung', 'invoice', 'betrag', 'summe', 'total',
      'zahlbar', 'fällig', 'bankverbindung', 'iban'
    ];

    const contentLower = content.toLowerCase();
    return finKeywords.filter(kw => contentLower.includes(kw)).length >= 2;
  }
}

module.exports = ModelRouter;
```

---

## 📊 Extraction Pipeline

### Lab Report Extractor

```javascript
// services/extractors/labReportExtractor.js

class LabReportExtractor {
  constructor(ollamaService, database) {
    this.ollama = ollamaService;
    this.db = database;

    // Biomarker patterns for Austrian/German lab reports
    this.patterns = {
      // Pattern: Name, Value, Unit, Reference
      'row': /^(.+?)\s+(\d+[\.,]?\d*)\s*(mg\/dL|g\/dL|%|U\/L|mU\/L|pg\/mL|ng\/mL|mmol\/L|G\/L|T\/L|fL|pg)\s*(?:\(?\s*<?(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s*\)?)?/gm,

      // Date patterns
      'date_de': /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      'date_iso': /(\d{4})-(\d{2})-(\d{2})/
    };

    // Biomarker name mapping
    this.biomarkerMap = {
      // German to code mapping
      'glukose': 'GLUCOSE',
      'blutzucker': 'GLUCOSE',
      'hba1c': 'HBA1C',
      'cholesterin': 'CHOL_TOTAL',
      'gesamtcholesterin': 'CHOL_TOTAL',
      'hdl-cholesterin': 'HDL',
      'hdl': 'HDL',
      'ldl-cholesterin': 'LDL',
      'ldl': 'LDL',
      'triglyceride': 'TRIGLYCERIDES',
      'got': 'GOT_AST',
      'ast': 'GOT_AST',
      'gpt': 'GPT_ALT',
      'alt': 'GPT_ALT',
      'ggt': 'GGT',
      'gamma-gt': 'GGT',
      'kreatinin': 'CREATININE',
      'gfr': 'GFR',
      'harnstoff': 'UREA',
      'harnsäure': 'URIC_ACID',
      'tsh': 'TSH',
      'ft3': 'FT3',
      'ft4': 'FT4',
      'vitamin d': 'VIT_D',
      '25-oh-vitamin d': 'VIT_D',
      'vitamin b12': 'VIT_B12',
      'folsäure': 'FOLATE',
      'ferritin': 'FERRITIN',
      'eisen': 'IRON',
      'erythrozyten': 'RBC',
      'hämoglobin': 'HEMOGLOBIN',
      'hämatokrit': 'HEMATOCRIT',
      'leukozyten': 'WBC',
      'thrombozyten': 'PLATELETS',
      'crp': 'CRP',
      'bsg': 'ESR'
    };
  }

  /**
   * Extract biomarkers from lab report using vision + text models
   */
  async extract(documentId, content, thumbnailPath) {
    console.log(`[LAB_EXTRACT] Processing document ${documentId}`);

    // Step 1: Use vision model to extract structured data
    const visionResult = await this._extractWithVision(documentId, thumbnailPath);

    // Step 2: Validate and enhance with text parsing
    const textResult = this._extractFromText(content);

    // Step 3: Merge results (vision takes priority, text fills gaps)
    const mergedResults = this._mergeResults(visionResult, textResult);

    // Step 4: Normalize biomarker codes
    const normalized = this._normalizeBiomarkers(mergedResults);

    // Step 5: Check values against reference ranges
    const withStatus = this._checkStatus(normalized);

    // Step 6: Store in database
    await this._storeResults(documentId, withStatus);

    // Step 7: Check for alerts
    const alerts = await this._checkAlerts(documentId, withStatus);

    return {
      document_id: documentId,
      test_date: withStatus.test_date,
      laboratory: withStatus.laboratory,
      biomarker_count: withStatus.biomarkers.length,
      biomarkers: withStatus.biomarkers,
      alerts: alerts
    };
  }

  async _extractWithVision(documentId, thumbnailPath) {
    const prompt = `
Analyze this medical laboratory report and extract ALL biomarker values.

For EACH biomarker, provide:
- name (German name as shown)
- name_en (English equivalent)
- value (numeric value exactly as shown)
- unit (measurement unit)
- reference_low (lower reference value if shown)
- reference_high (upper reference value if shown)
- status (normal/high/low based on reference)

Also extract:
- test_date (YYYY-MM-DD format)
- laboratory (name of lab)
- patient_info (if visible and appropriate)

Return as JSON:
{
  "test_date": "YYYY-MM-DD",
  "laboratory": "Lab name",
  "biomarkers": [
    {
      "name": "Glukose",
      "name_en": "Glucose",
      "value": 95,
      "unit": "mg/dL",
      "reference_low": 70,
      "reference_high": 100,
      "status": "normal"
    }
  ]
}

IMPORTANT: Extract EVERY value visible. Include partial or unclear values marked as "unclear".
`;

    try {
      const result = await this.ollama.generateWithVision({
        model: 'qwen3-vl:8b',
        prompt: prompt,
        imagePath: thumbnailPath
      });

      return JSON.parse(result);
    } catch (error) {
      console.error(`[LAB_EXTRACT] Vision extraction failed: ${error.message}`);
      return { biomarkers: [] };
    }
  }

  _extractFromText(content) {
    const biomarkers = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(this.patterns.row);
      if (match) {
        biomarkers.push({
          name: match[1].trim(),
          value: parseFloat(match[2].replace(',', '.')),
          unit: match[3],
          reference_low: match[4] ? parseFloat(match[4].replace(',', '.')) : null,
          reference_high: match[5] ? parseFloat(match[5].replace(',', '.')) : null
        });
      }
    }

    // Extract date
    const dateMatch = content.match(this.patterns.date_de);
    const testDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
      : null;

    return { test_date: testDate, biomarkers };
  }

  _mergeResults(vision, text) {
    // Use vision results as base, fill gaps with text
    const merged = { ...vision };

    if (!merged.test_date && text.test_date) {
      merged.test_date = text.test_date;
    }

    // Add any biomarkers from text that weren't in vision
    const visionNames = new Set(merged.biomarkers.map(b => b.name.toLowerCase()));

    for (const textBiomarker of text.biomarkers) {
      if (!visionNames.has(textBiomarker.name.toLowerCase())) {
        merged.biomarkers.push(textBiomarker);
      }
    }

    return merged;
  }

  _normalizeBiomarkers(results) {
    const normalized = { ...results };

    normalized.biomarkers = results.biomarkers.map(b => {
      const nameLower = b.name.toLowerCase();
      const code = this.biomarkerMap[nameLower] || nameLower.toUpperCase().replace(/[^A-Z0-9]/g, '_');

      return {
        ...b,
        code: code
      };
    });

    return normalized;
  }

  _checkStatus(results) {
    const withStatus = { ...results };

    withStatus.biomarkers = results.biomarkers.map(b => {
      let status = 'normal';

      if (b.reference_low !== null && b.value < b.reference_low) {
        status = 'low';
      } else if (b.reference_high !== null && b.value > b.reference_high) {
        status = 'high';
      }

      return { ...b, status };
    });

    return withStatus;
  }

  async _storeResults(documentId, results) {
    const db = this.db;

    for (const biomarker of results.biomarkers) {
      await db.run(`
        INSERT OR REPLACE INTO biomarker_readings
        (document_id, test_date, biomarker_code, biomarker_name_de,
         value, unit, reference_low, reference_high, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        documentId,
        results.test_date,
        biomarker.code,
        biomarker.name,
        biomarker.value,
        biomarker.unit,
        biomarker.reference_low,
        biomarker.reference_high,
        biomarker.status
      ]);
    }

    console.log(`[LAB_EXTRACT] Stored ${results.biomarkers.length} biomarkers for doc ${documentId}`);
  }

  async _checkAlerts(documentId, results) {
    const alerts = [];

    for (const biomarker of results.biomarkers) {
      // Alert for out-of-range values
      if (biomarker.status !== 'normal') {
        alerts.push({
          document_id: documentId,
          biomarker_code: biomarker.code,
          alert_type: 'out_of_range',
          severity: biomarker.status === 'critical' ? 'critical' : 'warning',
          message: `${biomarker.name} is ${biomarker.status}: ${biomarker.value} ${biomarker.unit} (ref: ${biomarker.reference_low}-${biomarker.reference_high})`,
          value: biomarker.value
        });
      }

      // Check for rapid changes (compare with previous values)
      const previousValue = await this._getPreviousValue(biomarker.code);
      if (previousValue && Math.abs(biomarker.value - previousValue.value) / previousValue.value > 0.2) {
        alerts.push({
          document_id: documentId,
          biomarker_code: biomarker.code,
          alert_type: 'rapid_change',
          severity: 'warning',
          message: `${biomarker.name} changed significantly: ${previousValue.value} → ${biomarker.value} ${biomarker.unit}`,
          value: biomarker.value
        });
      }
    }

    // Store alerts
    for (const alert of alerts) {
      await this.db.run(`
        INSERT INTO health_alerts (document_id, biomarker_code, alert_type, severity, message, value)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [alert.document_id, alert.biomarker_code, alert.alert_type, alert.severity, alert.message, alert.value]);
    }

    return alerts;
  }

  async _getPreviousValue(biomarkerCode) {
    return await this.db.get(`
      SELECT value, test_date
      FROM biomarker_readings
      WHERE biomarker_code = ?
      ORDER BY test_date DESC
      LIMIT 1 OFFSET 1
    `, [biomarkerCode]);
  }
}

module.exports = LabReportExtractor;
```

---

## 📈 Pattern Detection Engine

```javascript
// services/patternDetection.js

class PatternDetectionEngine {
  constructor(database) {
    this.db = database;
  }

  /**
   * Analyze all biomarker data for patterns
   */
  async analyzePatterns() {
    console.log('[PATTERNS] Starting pattern analysis...');

    const results = {
      trends: await this.detectTrends(),
      seasonalPatterns: await this.detectSeasonalPatterns(),
      correlations: await this.detectCorrelations(),
      anomalies: await this.detectAnomalies()
    };

    return results;
  }

  /**
   * Detect trends for each biomarker over time
   */
  async detectTrends() {
    const biomarkers = await this.db.all(`
      SELECT DISTINCT biomarker_code FROM biomarker_readings
    `);

    const trends = [];

    for (const { biomarker_code } of biomarkers) {
      const readings = await this.db.all(`
        SELECT test_date, value
        FROM biomarker_readings
        WHERE biomarker_code = ?
        ORDER BY test_date ASC
      `, [biomarker_code]);

      if (readings.length >= 3) {
        const trend = this._calculateTrend(readings);
        trends.push({
          biomarker: biomarker_code,
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

  _calculateTrend(readings) {
    if (readings.length < 2) return { direction: 'insufficient_data', changePercent: 0, confidence: 0 };

    const firstValue = readings[0].value;
    const lastValue = readings[readings.length - 1].value;
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;

    // Simple linear regression for confidence
    const n = readings.length;
    const xMean = (n - 1) / 2;
    const yMean = readings.reduce((sum, r) => sum + r.value, 0) / n;

    let numerator = 0;
    let denominator = 0;

    readings.forEach((r, i) => {
      numerator += (i - xMean) * (r.value - yMean);
      denominator += Math.pow(i - xMean, 2);
    });

    const slope = numerator / denominator;

    let direction = 'stable';
    if (changePercent > 5) direction = 'rising';
    if (changePercent < -5) direction = 'falling';

    // R-squared as confidence
    const predictions = readings.map((_, i) => yMean + slope * (i - xMean));
    const ssRes = readings.reduce((sum, r, i) => sum + Math.pow(r.value - predictions[i], 2), 0);
    const ssTot = readings.reduce((sum, r) => sum + Math.pow(r.value - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    return {
      direction,
      changePercent: Math.round(changePercent * 10) / 10,
      confidence: Math.round(rSquared * 100) / 100
    };
  }

  /**
   * Detect seasonal patterns (e.g., Vitamin D higher in summer)
   */
  async detectSeasonalPatterns() {
    const biomarkers = ['VIT_D', 'IRON', 'FERRITIN', 'HEMOGLOBIN'];
    const patterns = [];

    for (const biomarker of biomarkers) {
      const readings = await this.db.all(`
        SELECT
          strftime('%m', test_date) as month,
          AVG(value) as avg_value,
          COUNT(*) as count
        FROM biomarker_readings
        WHERE biomarker_code = ?
        GROUP BY month
        HAVING count >= 2
      `, [biomarker]);

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

  _groupByQuarter(monthlyReadings) {
    const quarters = { Q1: [], Q2: [], Q3: [], Q4: [] };

    for (const r of monthlyReadings) {
      const month = parseInt(r.month);
      if (month <= 3) quarters.Q1.push(r.avg_value);
      else if (month <= 6) quarters.Q2.push(r.avg_value);
      else if (month <= 9) quarters.Q3.push(r.avg_value);
      else quarters.Q4.push(r.avg_value);
    }

    return {
      Q1: quarters.Q1.length ? quarters.Q1.reduce((a, b) => a + b) / quarters.Q1.length : null,
      Q2: quarters.Q2.length ? quarters.Q2.reduce((a, b) => a + b) / quarters.Q2.length : null,
      Q3: quarters.Q3.length ? quarters.Q3.reduce((a, b) => a + b) / quarters.Q3.length : null,
      Q4: quarters.Q4.length ? quarters.Q4.reduce((a, b) => a + b) / quarters.Q4.length : null
    };
  }

  _detectSeasonality(quarters) {
    const values = [quarters.Q1, quarters.Q2, quarters.Q3, quarters.Q4].filter(v => v !== null);
    if (values.length < 3) return 'insufficient_data';

    const max = Math.max(...values);
    const min = Math.min(...values);
    const variation = (max - min) / ((max + min) / 2) * 100;

    if (variation < 10) return 'no_seasonal_pattern';

    const maxQ = Object.entries(quarters).find(([_, v]) => v === max)[0];
    const minQ = Object.entries(quarters).find(([_, v]) => v === min)[0];

    return `Peak in ${maxQ}, Low in ${minQ} (${Math.round(variation)}% variation)`;
  }

  /**
   * Detect correlations between biomarkers
   */
  async detectCorrelations() {
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
      const data = await this.db.all(`
        SELECT r1.value as value1, r2.value as value2
        FROM biomarker_readings r1
        JOIN biomarker_readings r2 ON r1.test_date = r2.test_date
        WHERE r1.biomarker_code = ? AND r2.biomarker_code = ?
      `, [bio1, bio2]);

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

  _pearsonCorrelation(x, y) {
    const n = x.length;
    const xMean = x.reduce((a, b) => a + b) / n;
    const yMean = y.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      denomX += xDiff * xDiff;
      denomY += yDiff * yDiff;
    }

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

  /**
   * Detect anomalies (outliers, sudden changes)
   */
  async detectAnomalies() {
    const anomalies = [];

    const biomarkers = await this.db.all(`
      SELECT DISTINCT biomarker_code FROM biomarker_readings
    `);

    for (const { biomarker_code } of biomarkers) {
      const readings = await this.db.all(`
        SELECT document_id, test_date, value
        FROM biomarker_readings
        WHERE biomarker_code = ?
        ORDER BY test_date ASC
      `, [biomarker_code]);

      if (readings.length >= 5) {
        const values = readings.map(r => r.value);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

        // Flag values > 2 standard deviations from mean
        for (const reading of readings) {
          const zScore = (reading.value - mean) / stdDev;
          if (Math.abs(zScore) > 2) {
            anomalies.push({
              biomarker: biomarker_code,
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
}

module.exports = PatternDetectionEngine;
```

---

## 🎯 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create SQLite health metrics database
- [ ] Add biomarker definitions table
- [ ] Create custom fields in Paperless-NGX for key metrics
- [ ] Implement lab report detection in document router

### Phase 2: Extraction (Week 3-4)
- [ ] Implement LabReportExtractor class
- [ ] Create vision-based extraction prompts
- [ ] Add text fallback extraction
- [ ] Test with 10+ lab reports

### Phase 3: Expert Models (Week 5-6)
- [ ] Pull/create medical expert model (meditron or custom)
- [ ] Implement ModelRouter for expert routing
- [ ] Add medical-specific prompts
- [ ] Benchmark extraction accuracy

### Phase 4: Pattern Detection (Week 7-8)
- [ ] Implement PatternDetectionEngine
- [ ] Add trend analysis
- [ ] Add correlation detection
- [ ] Add anomaly detection
- [ ] Create visualization exports (JSON/CSV)

### Phase 5: Integration (Week 9-10)
- [ ] Integrate with paperless-ai pipeline
- [ ] Add health metrics dashboard endpoint
- [ ] Create pattern report generator
- [ ] Add alert notification system (optional)

---

## 📊 Example Output

### After Processing Lab Report

```json
{
  "document_id": 89,
  "test_date": "2025-10-04",
  "laboratory": "Labor Univ.Doz. Dr. Ahmad Hamwi",
  "biomarker_count": 24,
  "biomarkers": [
    {
      "code": "GLUCOSE",
      "name": "Glukose",
      "value": 95,
      "unit": "mg/dL",
      "reference_low": 70,
      "reference_high": 100,
      "status": "normal"
    },
    {
      "code": "HBA1C",
      "name": "HbA1c",
      "value": 5.4,
      "unit": "%",
      "reference_low": 4.0,
      "reference_high": 5.6,
      "status": "normal"
    },
    {
      "code": "LDL",
      "name": "LDL-Cholesterin",
      "value": 128,
      "unit": "mg/dL",
      "reference_low": null,
      "reference_high": 100,
      "status": "high"
    }
  ],
  "alerts": [
    {
      "alert_type": "out_of_range",
      "severity": "warning",
      "message": "LDL-Cholesterin is high: 128 mg/dL (ref: <100)"
    }
  ],
  "trends": [
    {
      "biomarker": "HBA1C",
      "direction": "falling",
      "change_percent": -3.5,
      "message": "HbA1c improving over last 6 months"
    }
  ]
}
```

---

## 🔒 Privacy & Security

- ✅ All processing 100% local (Ollama on host)
- ✅ No external API calls for medical data
- ✅ SQLite database stored locally
- ✅ GDPR compliant by design
- ✅ Medical data retention per Austrian law (10 years)
- ✅ Optional encryption for database at rest

---

**Document Version**: 1.0
**Last Updated**: 2025-12-20
**Status**: Ready for Implementation 🚀
