/* eslint-env mocha */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const registryPath = path.join(
  __dirname,
  '..',
  '..',
  'config',
  'schemas',
  'fieldRegistry.json'
);

function loadRegistry() {
  const raw = fs.readFileSync(registryPath, 'utf8');
  return JSON.parse(raw);
}

describe('Field Registry v2', () => {
  const registry = loadRegistry();

  it('uses v2.0.0 and defines domain mappings', () => {
    assert.strictEqual(registry._version, '2.0.0');
    assert.ok(registry.domainMappings, 'domainMappings missing');

    const expected = ['financial', 'medical', 'legal', 'general'];
    expected.forEach((domain) => {
      assert.ok(
        registry.domainMappings[domain],
        `domainMappings missing ${domain}`
      );
    });
  });

  it('enforces required metadata per field', () => {
    const fields = registry.fields || {};
    Object.entries(fields).forEach(([fieldId, field]) => {
      assert.ok(field.paperlessField, `${fieldId}: paperlessField missing`);
      assert.ok(
        field.paperlessField.startsWith('custom_field:') ||
          field.paperlessField.startsWith('metadata:'),
        `${fieldId}: paperlessField prefix invalid`
      );

      assert.ok(
        Array.isArray(field.visualLabels),
        `${fieldId}: visualLabels missing`
      );
      assert.ok(
        field.visualLabels.length >= 2,
        `${fieldId}: visualLabels needs 2+ entries`
      );

      assert.ok(field.displayName, `${fieldId}: displayName missing`);
      assert.ok(field.displayName.en, `${fieldId}: displayName.en missing`);
      assert.ok(field.displayName.de, `${fieldId}: displayName.de missing`);

      assert.ok(
        typeof field.extractionPriority === 'number',
        `${fieldId}: extractionPriority missing`
      );
      assert.ok(
        field.extractionPriority >= 0 && field.extractionPriority <= 1,
        `${fieldId}: extractionPriority out of range`
      );

      assert.ok(
        field.validationRules && typeof field.validationRules === 'object',
        `${fieldId}: validationRules missing`
      );
    });
  });

  it('domain mappings reference valid fields and meet minimum counts', () => {
    const ids = new Set(Object.keys(registry.fields || {}));
    const minimums = {
      financial: 15,
      medical: 20,
      legal: 10,
      general: 5
    };

    Object.entries(minimums).forEach(([domain, minimum]) => {
      const mapping = registry.domainMappings[domain];
      const fields = [
        ...(mapping.requiredFields || []),
        ...(mapping.optionalFields || [])
      ];

      assert.ok(
        fields.length >= minimum,
        `${domain}: expected >= ${minimum} fields`
      );

      fields.forEach((fieldId) => {
        assert.ok(ids.has(fieldId), `${domain}: unknown field ${fieldId}`);
      });
    });
  });

  it('covers validation rule types for common patterns', () => {
    const dateRules = registry.fields.document_date.validationRules;
    assert.ok(dateRules.pattern, 'document_date pattern missing');

    const numberRules = registry.fields.invoice_amount.validationRules;
    assert.ok(
      typeof numberRules.min === 'number' &&
        typeof numberRules.max === 'number',
      'invoice_amount numeric rules missing'
    );

    const arrayRules = registry.fields.tags.validationRules;
    assert.ok(
      typeof arrayRules.minItems === 'number' &&
        typeof arrayRules.maxItems === 'number',
      'tags array rules missing'
    );

    const stringRules = registry.fields.invoice_number.validationRules;
    assert.ok(stringRules.pattern, 'invoice_number pattern missing');
  });

  it('includes English and German labels for key fields', () => {
    const invoiceLabels = registry.fields.invoice_number.visualLabels.join(' ');
    assert.ok(/invoice/i.test(invoiceLabels), 'invoice_number English missing');
    assert.ok(
      /rechnung/i.test(invoiceLabels),
      'invoice_number German missing'
    );

    const patientLabels = registry.fields.patient_name.visualLabels.join(' ');
    assert.ok(/patient/i.test(patientLabels), 'patient_name English missing');
    assert.ok(/patienten/i.test(patientLabels), 'patient_name German missing');
  });
});
