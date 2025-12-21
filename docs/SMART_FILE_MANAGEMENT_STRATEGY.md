# 📁 Smart File & Folder Management Strategy for Paperless-AI
## Austrian Medical & Household Document Archive

**User**: Patrick Walchshofer (Linz, Austria)
**Target**: Fully automated, intelligent document organization
**Philosophy**: Simple, effective, future-proof

---

## 🎯 Current State Analysis

### ✅ What's Working Well

**Current Filename Format**:
```env
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ correspondent }}/{{ title }}"
```

**Example Output**:
```
2025/Mag. Simone Parzer/Appointment Schedule for Herr Walchshofer Patrick.pdf
2025/ÖGK/Arbeitsunfähigkeitsmeldung Patrick Walchshofer.pdf
2025/LINZ STROM GAS WÄRME GmbH/Information zu Ihrem Fernwärme-Tarif ab 1. August 2025.pdf
```

**Strengths**:
- ✅ Year-based organization (easy archival)
- ✅ Correspondent grouping (find all docs from same sender)
- ✅ Descriptive titles (human-readable)
- ✅ Automatic folder creation
- ✅ Works perfectly with Vision AI extraction

---

## 🚀 Enhanced File Management Strategy

### Strategy 1: **Hierarchical Organization** (Recommended for Medical/Financial Docs)

**Format**:
```env
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ document_type }}/{{ correspondent }}/{{ created_month }}-{{ title }}"
```

**Benefits**:
- Documents grouped by TYPE first (Medical, Bills, Insurance, etc.)
- Then by SENDER
- Month prefix for chronological sorting within folders
- Perfect for Austrian medical system (ÖGK, private doctors, hospitals)

**Example Structure**:
```
2025/
├── Medical/
│   ├── ÖGK/
│   │   ├── 01-Arbeitsunfähigkeitsmeldung Patrick Walchshofer.pdf
│   │   ├── 04-Überweisung Physiotherapie.pdf
│   │   └── 06-Arbeitsunfähigkeitsmeldung Patrick Walchshofer.pdf
│   ├── Mag. Simone Parzer/
│   │   └── 10-Appointment Schedule for Herr Walchshofer Patrick.pdf
│   └── Ordensklinikum Linz Elisabethinen/
│       └── 09-Rechnung-Nr. 0102739594.pdf
├── Bills/
│   ├── LINZ STROM GAS WÄRME GmbH/
│   │   └── 07-Information zu Ihrem Fernwärme-Tarif.pdf
│   └── LINZAG LINIEN/
│       └── 01-Zahlungsbeleg MAXI-Karte.pdf
└── Tax Documents/
    └── Österreichische Gesundheitskasse/
        └── 08-Bestätigung über die Kostenerstattung.pdf
```

**Configuration**:
```env
# Enhanced hierarchical format
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ document_type }}/{{ correspondent }}/{{ created_month }}-{{ title }}"

# Alternative with document type code
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ document_type }}/{{ correspondent }}/[{{ created_month }}] {{ title }}"
```

---

### Strategy 2: **Medical-Focused Organization** (Best for Healthcare Documents)

**Format**:
```env
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ correspondent }}/{{ created_date }}_{{ document_type }}_{{ title }}"
```

**Benefits**:
- Full date sorting (YYYY-MM-DD prefix)
- Document type visible in filename
- Easy to find documents from specific dates
- Perfect for medical appointment tracking

**Example**:
```
2025/
├── Mag. Simone Parzer/
│   ├── 2025-10-04_appointment_schedule_Appointment Schedule.pdf
│   └── 2025-11-15_therapy_notes_Follow-up Session.pdf
├── ÖGK/
│   ├── 2025-01-20_sick_leave_Arbeitsunfähigkeitsmeldung.pdf
│   ├── 2025-04-22_sick_leave_Arbeitsunfähigkeitsmeldung.pdf
│   └── 2025-06-13_sick_leave_Arbeitsunfähigkeitsmeldung.pdf
└── Ordensklinikum Linz/
    └── 2025-09-08_invoice_Rechnung-Nr. 0102739594.pdf
```

---

### Strategy 3: **Tag-Based Organization** (Maximum Flexibility)

**Format**:
```env
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ tags }}/{{ correspondent }}/{{ title }}"
```

**Benefits**:
- Documents automatically organized by primary tag
- Multi-dimensional organization (tags can represent categories)
- Highly searchable and flexible

**Example**:
```
2025/
├── medical/
│   ├── therapy/
│   │   └── Mag. Simone Parzer/Appointment Schedule.pdf
│   └── insurance/
│       └── ÖGK/Arbeitsunfähigkeitsmeldung.pdf
├── bills/
│   ├── utilities/
│   │   └── LINZ STROM/Fernwärme-Tarif.pdf
│   └── transportation/
│       └── LINZAG/MAXI-Karte Zahlungsbeleg.pdf
└── tax/
    └── deductions/
        └── ÖGK/Kostenerstattung.pdf
```

**Note**: Requires smart tag hierarchy setup in Paperless-AI

---

## 🤖 Enhanced Paperless-AI Capabilities

### 1. **Smart Document Type Detection**

**Current**: Vision model extracts document_type as free text
**Enhancement**: Map to predefined categories

**Implementation**:
```javascript
// Add to config.js
documentTypeMapping: {
  // Medical documents
  'sick_leave': 'Medical/Sick Leave',
  'medical_bill': 'Medical/Bills',
  'prescription': 'Medical/Prescriptions',
  'therapy_notes': 'Medical/Therapy',
  'medical_appointment': 'Medical/Appointments',
  'insurance_claim': 'Medical/Insurance',

  // Financial documents
  'invoice': 'Bills/Invoices',
  'receipt': 'Bills/Receipts',
  'utility_bill': 'Bills/Utilities',
  'bank_statement': 'Financial/Bank Statements',

  // Tax documents
  'tax_document': 'Tax/Declarations',
  'donation_receipt': 'Tax/Deductions',
  'insurance_confirmation': 'Tax/Insurance Confirmations',

  // Government
  'official_letter': 'Government/Official',
  'permit': 'Government/Permits',

  // Personal
  'contract': 'Legal/Contracts',
  'warranty': 'Household/Warranties',
  'manual': 'Household/Manuals'
}
```

---

### 2. **Austrian Medical System Integration**

**Enhancement**: Specialized rules for Austrian healthcare

```javascript
// Add to Visual RAG extraction prompt
austrianMedicalRules: {
  // Recognize Austrian health insurance
  correspondents: {
    'ÖGK': 'Österreichische Gesundheitskasse',
    'OÖGKK': 'OÖ Gebietskrankenkasse',
    'SVA': 'Sozialversicherungsanstalt der Selbständigen',
    'BVAEB': 'Versicherungsanstalt öffentlich Bediensteter'
  },

  // Document type patterns
  documentTypes: {
    'Arbeitsunfähigkeitsmeldung': 'Medical/Sick Leave',
    'Arbeitsfähigkeitsmeldung': 'Medical/Return to Work',
    'Überweisung': 'Medical/Referral',
    'Befund': 'Medical/Medical Report',
    'Honorarnote': 'Medical/Private Practice Bill',
    'Rezept': 'Medical/Prescription'
  },

  // Auto-tag generation
  autoTags: {
    'Arbeitsunfähigkeit': ['medical', 'sick-leave', 'insurance'],
    'Überweisung': ['medical', 'referral'],
    'Honorarnote': ['medical', 'bill', 'tax-deductible']
  }
}
```

---

### 3. **Intelligent Title Generation**

**Enhancement**: Context-aware title shortening

```javascript
titleOptimization: {
  // Remove redundant information
  removePatterns: [
    /^Patrick Walchshofer\s*/i,
    /^Herr\s+Walchshofer\s+Patrick\s*/i,
    /\s+vom\s+\d{2}\.\d{2}\.\d{4}$/,  // "vom DD.MM.YYYY"
    /\s+-\s+Kopie$/,  // "- Kopie"
  ],

  // Shorten common phrases
  replacements: {
    'Bestätigung über die Kostenerstattung': 'Kostenerstattung',
    'Information zu Ihrem': 'Info:',
    'Arbeitsunfähigkeitsmeldung': 'AU-Meldung',
    'Rechnung-Nr.': 'Rechnung',
  },

  // Maximum title length
  maxLength: 80,

  // Add context from tags
  addTagContext: true  // "Rechnung 123" → "Rechnung 123 [Medical]"
}
```

---

### 4. **Multi-Language Document Handling**

**Enhancement**: Language-specific processing

```javascript
languageHandling: {
  // Detect and tag language
  autoDetect: true,

  // Apply language-specific rules
  rules: {
    'de': {
      // German-specific date extraction
      datePatterns: [
        /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
        /(\d{4})-(\d{2})-(\d{2})/          // YYYY-MM-DD
      ],
      // German correspondent normalization
      correspondentRules: {
        'GmbH': 'remove',
        'Gesellschaft m.b.H.': 'remove',
        'AG': 'keep as suffix'
      }
    },
    'en': {
      datePatterns: [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,   // MM/DD/YYYY
        /(\d{4})-(\d{2})-(\d{2})/          // YYYY-MM-DD
      ]
    }
  }
}
```

---

### 5. **Custom Field Extraction for Medical Documents**

**Enhancement**: Structured data extraction

```javascript
customFieldExtraction: {
  // Define custom fields in Paperless-NGX first, then extract
  fields: {
    // Medical fields
    'patient_name': {
      patterns: [
        /Patient(?:in)?:\s*(.+)/i,
        /Name:\s*(.+)/i
      ],
      documentTypes: ['Medical']
    },

    'doctor_name': {
      patterns: [
        /(?:Dr\.|Mag\.|Univ\.-Doz\.)\s*(.+)/i,
        /Behandelnde(?:r)? Arzt/Ärztin:\s*(.+)/i
      ],
      documentTypes: ['Medical']
    },

    'diagnosis': {
      patterns: [
        /Diagnose:\s*(.+)/i,
        /ICD-10:\s*([A-Z]\d{2}\.?\d?)/i
      ],
      documentTypes: ['Medical']
    },

    'appointment_date': {
      patterns: [
        /Termin:\s*(\d{2}\.\d{2}\.\d{4})/i,
        /Datum:\s*(\d{2}\.\d{2}\.\d{4})/i
      ],
      documentTypes: ['Medical/Appointments']
    },

    // Financial fields
    'invoice_number': {
      patterns: [
        /Rechnung(?:s)?-?Nr\.?\s*:?\s*(\S+)/i,
        /Invoice\s+(?:No\.?|Number)\s*:?\s*(\S+)/i
      ],
      documentTypes: ['Bills', 'Medical/Bills']
    },

    'amount': {
      patterns: [
        /Betrag:\s*€?\s*([\d,.]+)/i,
        /Summe:\s*€?\s*([\d,.]+)/i,
        /Total:\s*€?\s*([\d,.]+)/i
      ],
      documentTypes: ['Bills', 'Medical/Bills'],
      dataType: 'monetary'
    },

    'due_date': {
      patterns: [
        /Fällig(?:keit)?:\s*(\d{2}\.\d{2}\.\d{4})/i,
        /Zahlbar bis:\s*(\d{2}\.\d{2}\.\d{4})/i
      ],
      documentTypes: ['Bills'],
      dataType: 'date'
    },

    // Insurance fields
    'insurance_number': {
      patterns: [
        /Versicherungsnummer:\s*(\S+)/i,
        /VSNR:\s*(\S+)/i
      ],
      documentTypes: ['Medical/Insurance']
    }
  }
}
```

---

### 6. **Automated Storage Path Assignment**

**Enhancement**: Rule-based storage path selection

```javascript
storagePathRules: {
  // Define storage paths in Paperless-NGX, then auto-assign
  rules: [
    {
      condition: { documentType: 'Medical/*' },
      storagePath: 'Medical Archive',
      retention: 'permanent'  // Austrian: 10 years for medical
    },
    {
      condition: { documentType: 'Tax/*' },
      storagePath: 'Tax Documents',
      retention: '7 years'  // Austrian tax law
    },
    {
      condition: { documentType: 'Bills/*', tags: ['utilities'] },
      storagePath: 'Household Bills',
      retention: '2 years'
    },
    {
      condition: { correspondent: 'ÖGK' },
      storagePath: 'ÖGK Archive',
      retention: 'permanent'
    }
  ]
}
```

---

### 7. **Smart Tag Hierarchy & Auto-Tagging**

**Enhancement**: Hierarchical tag system with auto-assignment

```javascript
tagHierarchy: {
  // Primary categories (auto-assigned by document type)
  categories: {
    'medical': {
      parent: null,
      color: '#FF4444',
      children: ['therapy', 'sick-leave', 'insurance', 'prescription', 'appointment'],
      autoAssign: {
        documentTypes: ['Medical/*'],
        correspondents: ['ÖGK', 'OÖGKK', /Dr\.\s/, /Mag\.\s/]
      }
    },

    'financial': {
      parent: null,
      color: '#4444FF',
      children: ['bills', 'invoices', 'receipts', 'bank-statements'],
      autoAssign: {
        documentTypes: ['Bills/*', 'Financial/*']
      }
    },

    'tax': {
      parent: null,
      color: '#44FF44',
      children: ['deductible', 'declarations', 'receipts'],
      autoAssign: {
        documentTypes: ['Tax/*'],
        keywords: ['Finanzamt', 'Steuererklärung', 'absetzbar']
      }
    },

    'government': {
      parent: null,
      color: '#FFAA00',
      children: ['official', 'permits', 'certificates'],
      autoAssign: {
        correspondents: ['Magistrat', 'Bezirkshauptmannschaft', 'Finanzamt']
      }
    },

    'household': {
      parent: null,
      color: '#AA00FF',
      children: ['warranties', 'manuals', 'contracts'],
      autoAssign: {
        documentTypes: ['Household/*']
      }
    }
  },

  // Temporal tags (auto-assigned by year)
  temporal: {
    enabled: true,
    pattern: 'year-{YYYY}',  // Creates tags like "year-2025"
    color: '#CCCCCC'
  },

  // Status tags (workflow states)
  status: {
    'to-review': { color: '#FFCC00', workflow: 'initial' },
    'verified': { color: '#00CC00', workflow: 'reviewed' },
    'tax-relevant': { color: '#CC00CC', workflow: 'flagged' },
    'archived': { color: '#999999', workflow: 'completed' }
  }
}
```

---

## 📊 Recommended Configuration

### **Option A: Best for Medical/Financial Separation**

```env
# docker-compose.env
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ document_type }}/{{ correspondent }}/{{ created_month }}-{{ title }}"

# .env (paperless-ai)
ENABLE_VISUAL_RAG=yes
FORCE_VISUAL_RAG=no
TEXT_QUALITY_THRESHOLD=60
VISION_RENDER_DPI=150
MAX_VISION_PAGES=4

# Enhanced AI settings
ENABLE_DOCUMENT_TYPE_MAPPING=yes
ENABLE_AUSTRIAN_MEDICAL_RULES=yes
ENABLE_CUSTOM_FIELD_EXTRACTION=yes
ENABLE_TAG_HIERARCHY=yes
ENABLE_STORAGE_PATH_RULES=yes
```

**Result**:
```
2025/
├── Medical/
│   ├── Sick Leave/
│   │   └── ÖGK/
│   │       ├── 01-AU-Meldung Patrick Walchshofer.pdf
│   │       ├── 04-AU-Meldung Patrick Walchshofer.pdf
│   │       └── 06-AU-Meldung Patrick Walchshofer.pdf
│   ├── Therapy/
│   │   └── Mag. Simone Parzer/
│   │       └── 10-Appointment Schedule.pdf
│   └── Bills/
│       └── Ordensklinikum Linz/
│           └── 09-Rechnung 0102739594.pdf
├── Bills/
│   └── Utilities/
│       └── LINZ STROM/
│           └── 07-Fernwärme-Tarif.pdf
└── Tax/
    └── Insurance Confirmations/
        └── ÖGK/
            └── 08-Kostenerstattung.pdf
```

---

### **Option B: Simple & Effective (Current + Month)**

```env
# Minimal change from current
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ correspondent }}/{{ created_month }}-{{ title }}"
```

**Result**:
```
2025/
├── Mag. Simone Parzer/
│   └── 10-Appointment Schedule for Herr Walchshofer Patrick.pdf
├── ÖGK/
│   ├── 01-Arbeitsunfähigkeitsmeldung Patrick Walchshofer.pdf
│   ├── 04-Überweisung Physiotherapie.pdf
│   └── 06-Arbeitsunfähigkeitsmeldung Patrick Walchshofer.pdf
└── LINZ STROM GAS WÄRME GmbH/
    └── 07-Information zu Ihrem Fernwärme-Tarif.pdf
```

**Pros**:
- ✅ Minimal disruption
- ✅ Chronological sorting within folders
- ✅ Easy to implement
- ✅ Backward compatible

---

### **Option C: Maximum Searchability (Date-First)**

```env
# Best for time-sensitive documents
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ created_month }}/{{ correspondent }}/{{ created_day }}_{{ document_type }}_{{ title }}"
```

**Result**:
```
2025/
├── 01/  # January
│   ├── ÖGK/
│   │   └── 20_sick-leave_AU-Meldung.pdf
│   └── LINZAG/
│       └── 18_receipt_MAXI-Karte.pdf
├── 10/  # October
│   └── Mag. Simone Parzer/
│       └── 04_appointment_Appointment Schedule.pdf
└── 12/  # December
    └── ÖGK/
        └── 19_insurance_Kostenerstattung.pdf
```

**Pros**:
- ✅ Perfect for chronological archives
- ✅ Easy to find "everything from October"
- ✅ Document type visible at glance

---

## 🎯 Implementation Roadmap

### Phase 1: Enhanced Extraction (Week 1-2)
- [ ] Implement Austrian medical system rules
- [ ] Add custom field extraction for medical documents
- [ ] Enhanced title optimization
- [ ] Test with 50+ existing documents

### Phase 2: Smart Organization (Week 3-4)
- [ ] Implement document type mapping
- [ ] Create tag hierarchy system
- [ ] Add storage path rules
- [ ] Migrate existing documents (optional)

### Phase 3: Advanced Features (Week 5-6)
- [ ] Multi-language handling refinements
- [ ] Bulk operations optimization
- [ ] Metadata caching layer
- [ ] API version detection

### Phase 4: Austrian-Specific (Week 7-8)
- [ ] ÖGK-specific extraction rules
- [ ] Tax document classification
- [ ] Retention policy enforcement
- [ ] Insurance claim tracking

---

## 📈 Performance Targets

**Current Performance**:
- Vision analysis: ~50 seconds per document
- Metadata extraction: 95% accuracy
- Tag creation: Manual review needed

**Target Performance**:
- Vision analysis: ~30 seconds (model optimization)
- Metadata extraction: 98% accuracy (Austrian rules)
- Tag creation: Fully automated with hierarchy
- Custom fields: 90% accuracy
- Zero manual intervention for 80% of documents

---

## 🔒 Data Privacy & Compliance

### Austrian Medical Document Regulations

**GDPR Compliance**:
- ✅ All processing happens locally (no cloud)
- ✅ Ollama models run on-premise
- ✅ No data sent to external APIs
- ✅ Full control over retention

**Austrian-Specific**:
- **Medical records**: 10-year retention (§ 51 ÄrzteG)
- **Tax documents**: 7-year retention (§ 132 BAO)
- **Insurance**: Permanent retention recommended
- **Bills**: 2-year retention (consumer protection)

**Implementation**:
```javascript
retentionPolicies: {
  'Medical': { years: 10, autoDelete: false },
  'Tax': { years: 7, autoDelete: false },
  'Bills': { years: 2, autoDelete: 'warn' },
  'Government': { years: 'permanent', autoDelete: false }
}
```

---

## ✅ Quick Start: Apply Best Strategy

### Recommended: **Option A** (Medical/Financial Separation)

**Step 1: Update docker-compose.env**
```bash
PAPERLESS_FILENAME_FORMAT="{{ created_year }}/{{ document_type }}/{{ correspondent }}/{{ created_month }}-{{ title }}"
```

**Step 2: Restart Paperless-NGX**
```bash
cd /c/Users/pwalc/MyApps/paperless-ngx
docker compose restart webserver
```

**Step 3: Enable Enhanced Features in paperless-ai/.env**
```env
ENABLE_VISUAL_RAG=yes
TEXT_QUALITY_THRESHOLD=60
VISION_RENDER_DPI=150
```

**Step 4: Test with New Document**
Upload a test document and verify:
- ✅ Vision model extracts document_type
- ✅ Correspondent is correctly identified
- ✅ File is organized: `2025/Medical/ÖGK/12-Document.pdf`
- ✅ Tags are automatically assigned

**Step 5: Optional Bulk Migration**
```python
# Rename existing documents to new format
# (Paperless-NGX will auto-rename on metadata update)
for doc in documents:
    # Trigger rename by updating metadata
    paperless.update_document(doc.id, {'title': doc.title})
```

---

## 📞 Support & Resources

- **Paperless-NGX Docs**: https://docs.paperless-ngx.com/
- **Filename Format Docs**: https://docs.paperless-ngx.com/configuration/#PAPERLESS_FILENAME_FORMAT
- **API Reference**: See `paperless_ai_automation_reference.md`
- **Audit Report**: See `paperless_ai_audit.md`

---

**Document Version**: 1.0
**Last Updated**: 2025-12-20
**Author**: AI Assistant (based on user requirements)
**Status**: Ready for Implementation 🚀
