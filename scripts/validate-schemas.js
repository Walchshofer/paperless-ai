#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const schemaPath = path.join(
  __dirname,
  '..',
  'config',
  'schemas',
  'fieldRegistry.schema.json'
);
const registryPath = path.join(
  __dirname,
  '..',
  'config',
  'schemas',
  'fieldRegistry.json'
);

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function reportErrors(errors) {
  if (!errors || errors.length === 0) return;
  errors.forEach((err) => {
    const pathLabel = err.instancePath || '(root)';
    console.error(`${pathLabel} ${err.message}`);
  });
}

try {
  const schema = readJson(schemaPath);
  const registry = readJson(registryPath);

  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  const validate = ajv.compile(schema);

  const valid = validate(registry);
  if (!valid) {
    console.error('Field registry schema validation failed.');
    reportErrors(validate.errors);
    process.exit(1);
  }

  console.log('Field registry schema validation passed.');
  process.exit(0);
} catch (err) {
  console.error('Schema validation failed to run:', err.message);
  process.exit(2);
}
