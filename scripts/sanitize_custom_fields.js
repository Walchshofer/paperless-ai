// scripts/sanitize_custom_fields.js
// One-off script to coerce all custom field values to strings
// Usage: node scripts/sanitize_custom_fields.js

const axios = require('axios');
const path = require('path');
const { normalizeCustomFieldValue } = require('../services/customFieldUtils');

const PAPERLESS_API = process.env.PAPERLESS_API_URL || 'http://localhost:8000/api';
const TOKEN = process.env.PAPERLESS_API_TOKEN || process.env.PAPERLESS_TOKEN;
if (!TOKEN) {
  console.error('Missing PAPERLESS_API_TOKEN in env');
  process.exit(1);
}

const api = axios.create({ baseURL: PAPERLESS_API, headers: { Authorization: `Token ${TOKEN}` } });

async function* paginate(url = '/documents/?page_size=200') {
  let next = url;
  while (next) {
    const res = await api.get(next);
    if (!res || !res.data) break;
    for (const r of res.data.results || []) yield r;
    next = res.data.next;
    if (next) {
      try {
        const nextUrl = new URL(next);
        next = nextUrl.pathname + nextUrl.search;
      } catch (e) {
        next = null;
      }
    }
  }
}

(async () => {
  const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
  let affectedDocs = 0;
  let affectedFields = 0;

  try {
    for await (const doc of paginate('/documents/?page_size=200')) {
      const id = doc.id;
      const resp = await api.get(`/documents/${id}/`);
      const cf = resp.data.custom_fields || [];
      let changed = false;
      const normalized = [];
      const diffs = [];

      for (const item of cf) {
        const val = item.value;
        const norm = normalizeCustomFieldValue(val);
        if (norm !== val) {
          changed = true;
          diffs.push({ field: item.field, original: val, normalized: norm });
        }
        normalized.push({ field: item.field, value: norm });
      }

      if (changed) {
        affectedDocs += 1;
        affectedFields += diffs.length;
        if (dryRun) {
          console.log(`Document ${id} (${resp.data.title || 'no title'}) would be patched:`);
          for (const d of diffs) {
            console.log(`  - field: ${d.field}  original: ${JSON.stringify(d.original)}  normalized: ${JSON.stringify(d.normalized).slice(0, 200)}`);
          }
          console.log('');
        } else {
          console.log(`Patching doc ${id}: ${normalized.length} custom_fields`);
          await api.patch(`/documents/${id}/`, { custom_fields: normalized });
        }
      }
    }

    console.log('--- Summary ---');
    console.log(`Documents affected: ${affectedDocs}`);
    console.log(`Total custom field values changed: ${affectedFields}`);

    if (dryRun && affectedDocs === 0) {
      console.log('No patches required. All custom field values are compliant.');
    } else if (!dryRun) {
      console.log('Sanitization complete');
    }
  } catch (err) {
    console.error('Error sanitizing custom fields:', err.message || err);
    process.exit(1);
  }
})();