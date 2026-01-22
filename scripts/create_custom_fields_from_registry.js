#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const REG_PATH = path.join(__dirname, '..', 'config', 'schemas', 'fieldRegistry.json');
const ENV_PATH = path.join(__dirname, '..', 'docker-compose.env');

function loadEnvToken() {
  if (process.env.PAPERLESS_API_TOKEN) return process.env.PAPERLESS_API_TOKEN;
  try {
    const env = fs.readFileSync(ENV_PATH, 'utf8');
    const m = env.match(/PAPERLESS_API_TOKEN=(.+)/);
    if (m && m[1]) return m[1].trim();
  } catch (e) {
    // ignore
  }
  throw new Error('PAPERLESS_API_TOKEN not found in environment or docker-compose.env');
}

function mapDataType(field, meta) {
  const t = (meta.type || '').toLowerCase();
  if (t === 'string' || t === 'date' || t === 'number') return t === 'number' ? 'number' : (t === 'date' ? 'date' : 'string');
  if (t === 'array' || t === 'object') return 'string'; // store JSON
  // Heuristics for monetary fields
  if (/amount|total|value|price|cost|invoice_amount|contract_value/.test(field)) return 'monetary';
  return 'string';
}

(async function main(){
  try {
    const token = loadEnvToken();
    const api = axios.create({ baseURL: 'http://localhost:8000/api', headers: { Authorization: `Token ${token}` } });

    const registry = JSON.parse(fs.readFileSync(REG_PATH, 'utf8'));
    const fields = registry.fields || {};

    // Fetch existing custom fields
    const existingRes = await api.get('/custom_fields/');
    const existing = existingRes.data?.results || [];

    const normalize = (s) => (s||'').toLowerCase().replace(/[_\s]+/g, '');
    const existingKeys = new Set(existing.map(f => normalize(f.name)));

    const created = [];

    // Skip core metadata that aren't custom fields
    const skipped = new Set(['title','correspondent','tags','document_type','document_date','language']);

    for (const [key, meta] of Object.entries(fields)) {
      if (skipped.has(key)) continue;
      const candidateNames = [key, key.replace(/_/g,' '), key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())];
      const exists = candidateNames.some(n => existingKeys.has(normalize(n)) );
      if (exists) continue;

      const data_type = mapDataType(key, meta);
      const payload = { name: key, data_type, extra_data: null };

      // Extra data: currency for monetary
      if (data_type === 'monetary') {
        payload.extra_data = { default_currency: 'EUR' };
      }
      // For object/array stored as string, mark as json
      if (meta.type === 'array' || meta.type === 'object') {
        payload.extra_data = payload.extra_data || {};
        payload.extra_data.format = 'json';
      }

      try {
        console.log(`Creating custom field: ${key} (${data_type})`);
        const resp = await api.post('/custom_fields/', payload);
        console.log(` -> Created id=${resp.data.id}`);
        created.push({ id: resp.data.id, name: resp.data.name, data_type: resp.data.data_type, extra_data: resp.data.extra_data });
        // Add to existingKeys so subsequent runs don't duplicate
        existingKeys.add(normalize(resp.data.name));
      } catch (err) {
        // If Paperless API rejects the data_type (e.g., 'number' not allowed), try sensible fallbacks
        console.error(`Failed to create ${key} (attempted ${data_type}):`, err.response ? err.response.data : err.message);

        if (data_type === 'number') {
          // Heuristic: monetary for amount-like fields, otherwise fallback to string
          if (/amount|total|value|price|cost|invoice|contract_value/.test(key)) {
            const tryPayload = Object.assign({}, payload, { data_type: 'monetary' });
            try {
              console.log(`Retrying ${key} as monetary`);
              const r2 = await api.post('/custom_fields/', tryPayload);
              console.log(` -> Created id=${r2.data.id} (monetary)`);
              created.push({ id: r2.data.id, name: r2.data.name, data_type: r2.data.data_type, extra_data: r2.data.extra_data });
              existingKeys.add(normalize(r2.data.name));
              continue;
            } catch (err2) {
              console.error(`Retry monetary failed for ${key}:`, err2.response ? err2.response.data : err2.message);
              // fallthrough to string
            }
          }

          // Fallback: create as string and tag extra_data.format=number
          payload.data_type = 'string';
          payload.extra_data = payload.extra_data || {};
          payload.extra_data.format = 'number';
          try {
            console.log(`Retrying ${key} as string (number formatted)`);
            const r3 = await api.post('/custom_fields/', payload);
            console.log(` -> Created id=${r3.data.id} (string, number)`);
            created.push({ id: r3.data.id, name: r3.data.name, data_type: r3.data.data_type, extra_data: r3.data.extra_data });
            existingKeys.add(normalize(r3.data.name));
            continue;
          } catch (err3) {
            console.error(`Retry string failed for ${key}:`, err3.response ? err3.response.data : err3.message);
          }
        }
      }
    }

    // Write results to a small artifact file
    const outPath = path.join(__dirname, '..', 'artifacts', 'created_custom_fields.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ created, timestamp: new Date().toISOString() }, null, 2));

    console.log('\nSummary:');
    console.log(`Created: ${created.length} new custom fields`);
    created.forEach(c => console.log(` - ${c.name} (id=${c.id}, type=${c.data_type})`));

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(2);
  }
})();
