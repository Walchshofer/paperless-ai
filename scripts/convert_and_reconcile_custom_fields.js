#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TOKEN = process.env.PAPERLESS_API_TOKEN || (() => {
  try { const env = fs.readFileSync(path.join(__dirname,'..','docker-compose.env'),'utf8'); const m = env.match(/PAPERLESS_API_TOKEN=(.+)/); return m && m[1] ? m[1].trim() : null;} catch(e){return null}
})();
if (!TOKEN) { console.error('Missing PAPERLESS_API_TOKEN'); process.exit(2); }

const api = axios.create({ baseURL: 'http://localhost:8000/api', headers: { Authorization: `Token ${TOKEN}` } });

async function getAllFields() {
  const all = [];
  let url = '/custom_fields/?page_size=200';
  while (url) {
    const r = await api.get(url);
    all.push(...(r.data.results || []));
    const next = r.data.next;
    if (next) {
      // extract path+query
      const u = new URL(next);
      url = u.pathname + u.search;
    } else url = null;
  }
  return all;
}

function normalizeName(name) { return (name||'').toLowerCase().replace(/[_\s]+/g,'').replace(/[^a-z0-9]/g,''); }

(async function main(){
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname,'..','config','schemas','fieldRegistry.json'),'utf8'));
    const fields = registry.fields || {};

    const monetaryTargets = ['invoice_amount','invoice_vat','invoice_net','total_gross','total_net','contract_value'];

    const allFields = await getAllFields();

    const result = { converted: [], failedConversions: [], deleted: [], renamed: [] };

    // 1) Attempt to convert monetary targets to monetary with default_currency EUR
    for (const key of monetaryTargets) {
      const matches = allFields.filter(f => normalizeName(f.name) === normalizeName(key));
      if (matches.length === 0) {
        console.log(`No field matched ${key}, skipping`);
        continue;
      }
      // try patching each matched field
      for (const f of matches) {
        console.log(`Attempting to convert ${f.name} (id=${f.id}) -> monetary`);
        try {
          const payload = { data_type: 'monetary', extra_data: { default_currency: 'EUR' } };
          const resp = await api.patch(`/custom_fields/${f.id}/`, payload);
          result.converted.push({ id: f.id, name: resp.data.name, old_type: f.data_type, new_type: resp.data.data_type, extra_data: resp.data.extra_data });
          console.log(` -> success id=${f.id}`);
        } catch (err) {
          console.error(` -> failed id=${f.id}:`, err.response ? err.response.data : err.message);
          result.failedConversions.push({ id: f.id, name: f.name, error: err.response ? err.response.data : String(err.message) });
        }
      }
    }

    // 2) Reconcile duplicates: find normalized name groups with >1 entry
    const groups = {};
    for (const f of allFields) {
      const k = normalizeName(f.name);
      groups[k] = groups[k] || [];
      groups[k].push(f);
    }

    for (const [k, list] of Object.entries(groups)) {
      if (list.length <= 1) continue;
      // sort by document_count desc (keep the one with documents), then by id asc
      list.sort((a,b) => (b.document_count - a.document_count) || (a.id - b.id));
      const keeper = list[0];
      for (let i=1;i<list.length;i++) {
        const f = list[i];
        if (f.document_count === 0) {
          // safe to delete new/unused duplicate
          try {
            console.log(`Deleting unused duplicate ${f.name} (id=${f.id}) - keeper=${keeper.name}(id=${keeper.id})`);
            await api.delete(`/custom_fields/${f.id}/`);
            result.deleted.push({ id: f.id, name: f.name, keeper_id: keeper.id, keeper_name: keeper.name });
            console.log(` -> deleted ${f.id}`);
          } catch (err) {
            console.error(` -> delete failed ${f.id}:`, err.response ? err.response.data : err.message);
          }
        } else {
          // both have documents: rename the one with fewer docs by appending ' (legacy)'
          try {
            const newName = `${f.name} (legacy)`;
            console.log(`Renaming ${f.name} (id=${f.id}) -> ${newName} to avoid collision with keeper ${keeper.name}`);
            const resp = await api.patch(`/custom_fields/${f.id}/`, { name: newName });
            result.renamed.push({ id: f.id, old_name: f.name, new_name: resp.data.name });
            console.log(` -> renamed ${f.id}`);
          } catch (err) {
            console.error(` -> rename failed ${f.id}:`, err.response ? err.response.data : err.message);
          }
        }
      }
    }

    // write artifact
    const out = path.join(__dirname,'..','artifacts','conversion_reconciliation_result.json');
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
    console.log('\nDone. Summary written to', out);
    console.log(JSON.stringify(result, null, 2));

  } catch (e) {
    console.error('Fatal error:', e.message || e);
    process.exit(2);
  }
})();
