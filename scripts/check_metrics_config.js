#!/usr/bin/env node
const { validateInternalMetricsConfig } = require('../metrics/validateInternalMetricsConfig');

try {
  validateInternalMetricsConfig();
  console.log('Metrics config OK');
  process.exit(0);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
