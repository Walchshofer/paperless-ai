# Field Mapping Service Guide

This guide documents how the Field Mapping Service connects Visual RAG labels
to Paperless metadata/custom fields.

Primary implementation:
- `services/experts/FieldMappingService.js`
- `config/schemas/fieldRegistry.json`

Primary tests:
- `test/unit/FieldMappingService.test.js`
- `test/integration/ExpertPipelineFieldMapping.test.js`

## Overview

The Field Mapping Service is used by the Expert Pipeline to:
- Map visual labels to Paperless fields (`mapVisualToPaperless`).
- Map Paperless fields back to expected visual labels
  (`mapPaperlessToVisual`).
- Retrieve required and optional fields by domain.
- Validate candidate values before persistence.

Within pipeline flow, this supports Stage 5.5 (Visual Query Generation) by
detecting missing required fields and generating targeted visual queries.

## Mapping Flow

1. Normalize input label (lowercase, remove punctuation/diacritics).
2. Attempt exact lookup in `visualLabelIndex`.
3. Apply domain filter from `domainMappings`.
4. If no exact match, run fuzzy matching using Levenshtein similarity.
5. Return mapping metadata:
   - `fieldId`
   - `paperlessField`
   - `matchType` (`exact`, `fuzzy`, `none`)
   - `confidence`

Confidence behavior:
- Exact: `confidence * 1.1`, capped at `1.0`.
- Fuzzy: `confidence * similarity`.
- None: `0`.

## Field Registry Schema

The registry is stored in `config/schemas/fieldRegistry.json` and loaded at
service startup.

Minimal field entry example:

```json
{
  "invoice_number": {
    "type": "string",
    "domain": "financial",
    "paperlessField": "custom_field:invoice_number",
    "visualLabels": ["Invoice Number", "Rechnung Nr."],
    "extractionPriority": 0.95,
    "validationRules": {
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[A-Z0-9-]+$"
    },
    "displayName": {
      "en": "Invoice Number",
      "de": "Rechnungsnummer"
    }
  }
}
```

Domain mappings define required and optional fields:

```json
{
  "domainMappings": {
    "financial": {
      "requiredFields": ["invoice_number", "invoice_amount", "document_date"],
      "optionalFields": ["currency", "iban", "payment_due_date"]
    }
  }
}
```

## Adding a New Field

1. Add field definition under `fields` in `fieldRegistry.json`.
2. Add field id to at least one domain in `domainMappings`.
3. If the field is mandatory for that domain, add it to `requiredFields`.
4. Add or update unit tests in `test/unit/FieldMappingService.test.js`.
5. Run test and coverage checks.

Recommended checklist for each new field:
- At least one English and one localized label.
- Validation rules match expected data type.
- `paperlessField` follows `metadata:*` or `custom_field:*` conventions.
- `extractionPriority` is set intentionally.

## Usage Examples

### Visual -> Paperless mapping

```javascript
const { fieldMappingService } = require('../services/experts/FieldMappingService');

const mapping = fieldMappingService.mapVisualToPaperless(
  'Invoice Number',
  'financial',
  0.86
);

// Example output:
// {
//   fieldId: 'invoice_number',
//   paperlessField: 'custom_field:invoice_number',
//   confidence: 0.946,
//   matchType: 'exact',
//   domain: 'financial'
// }
```

### Paperless -> Visual mapping

```javascript
const reverse = fieldMappingService.mapPaperlessToVisual(
  'custom_field:invoice_number',
  'financial'
);
```

### Domain field retrieval

```javascript
const requiredFinancial = fieldMappingService.getRequiredFields('financial');
const optionalFinancial = fieldMappingService.getOptionalFields('financial');
```

### Value validation

```javascript
const valid = fieldMappingService.validateField('invoice_amount', 1234.56);
const invalid = fieldMappingService.validateField('invoice_amount', -10);
```

## Validation Rules

Supported validation behavior:
- Type checks: `string`, `number`, `array`
- String checks: `pattern`, `minLength`, `maxLength`
- Numeric checks: `min`, `max`
- Array checks: `minItems`, `maxItems`
- Format checks: currently supports `date` (`YYYY-MM-DD`)
- Enum checks: if field has `enum` list

Notes:
- Validation is deterministic and field-local.
- Unknown field ids return `{ valid: false, error: 'Unknown field' }`.
- `null` or `undefined` values are rejected.

## Performance Targets

Ticket targets for Field Mapping Service:
- Registry load: `< 50ms`
- Index build: `< 100ms`
- Mapping latency: `< 15ms` average per field
- Batch map latency: `100 mappings < 1500ms`
- Fuzzy matching accuracy: `> 90%` on 100-sample set

Current unit suite validates these as executable benchmarks.

## Testing and CI Integration

Run the unit suite directly:

```bash
npx mocha --require test/ts-node-register.js \
  --require test/setup-env.js \
  test/unit/FieldMappingService.test.js \
  --timeout 60000 --reporter spec --exit
```

Run coverage for service file:

```bash
npx c8 --reporter=text --exclude='test/**' \
  --include='services/experts/FieldMappingService.js' \
  npx mocha --require test/ts-node-register.js \
  --require test/setup-env.js \
  test/unit/FieldMappingService.test.js \
  --timeout 60000 --reporter dot --exit
```

Because `npm test` uses `test/**/*.{test,spec}.js`, the unit file is included
in standard CI runs that execute `npm test`.

## Troubleshooting

### No mappings found for expected label
- Verify label exists in `visualLabels` for the field.
- Check domain passed to mapper (`financial`, `medical`, `legal`, `general`).
- Confirm threshold (`similarityThreshold`) is not too strict.

### Missing required fields for domain
- Verify `domainMappings.<domain>.requiredFields` contains correct field ids.
- Ensure each required id exists under `fields`.

### Validation false positives/negatives
- Review `validationRules` and field `type`.
- Check regex pattern escaping in JSON.
- Confirm date format uses `YYYY-MM-DD`.

### Service not initialized
- Verify `registryPath` exists and is valid JSON.
- Check logs for `[FieldMappingService] Field registry load failed`.

### Performance regression
- Confirm field registry size growth did not introduce duplicate labels.
- Profile fuzzy-heavy labels for threshold tuning.
- Re-run benchmark tests before merging.
