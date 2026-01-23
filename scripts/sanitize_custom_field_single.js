// scripts/sanitize_custom_field_single.js
// Usage: node scripts/sanitize_custom_field_single.js <documentId>
// Requires PAPERLESS_API_URL and PAPERLESS_API_TOKEN in env

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

async function sanitizeDoc(id) {
  try {
    const resp = await api.get(`/documents/${id}/`);
    if (!resp || !resp.data) {
      console.error('Document not found or empty response', id);
      return false;
    }

    const cf = resp.data.custom_fields || [];
    if (cf.length === 0) {
      console.log(`Document ${id} has no custom fields, nothing to sanitize`);
      return true;
    }

    let changed = false;
    const normalized = [];
    for (const item of cf) {
      const val = item.value;
      const norm = normalizeCustomFieldValue(val);
      if (norm !== val) changed = true;
      normalized.push({ field: item.field, value: norm });
    }

    if (changed) {
      console.log(`Patching doc ${id}: ${normalized.length} custom_fields`);
      await api.patch(`/documents/${id}/`, { custom_fields: normalized });
      console.log('Patched successfully');
      return true;
    } else {
      console.log('No changes required');
      return true;
    }
  } catch (err) {
    console.error('Error sanitizing document', id, err?.response?.data || err.message || err);
    return false;
  }
}

(async () => {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/sanitize_custom_field_single.js <documentId>');
    process.exit(1);
  }
  const ok = await sanitizeDoc(id);
  process.exit(ok ? 0 : 1);
})();