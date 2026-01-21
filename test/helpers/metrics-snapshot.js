const fetch = require('node-fetch');

async function snapshotMetrics(metricsUrl, headers = {}) {
  const res = await fetch(metricsUrl, { headers });
  if (!res.ok) throw new Error('Failed to fetch metrics');
  const text = await res.text();
  return text;
}

module.exports = { snapshotMetrics };
