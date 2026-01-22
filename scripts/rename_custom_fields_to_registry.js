#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TOKEN = process.env.PAPERLESS_API_TOKEN || (() => {
  try { const env = fs.readFileSync(path.join(__dirname,'..','docker-compose.env'),'utf8'); const m = env.match(/PAPERLESS_API_TOKEN=(.+)/); return m && m[1] ? m[1].trim() : null;} catch(e){return null}
})();
if (!TOKEN) { console.error('Missing PAPERLESS_API_TOKEN'); process.exit(2); }

const api = axios.create({ baseURL: 'http://localhost:8000/api', headers: { Authorization: `Token ${TOKEN}` } });

function normalizeName(name) { return (name||'').toLowerCase().replace(/[_\s\W]+/g,''); }

(async function main(){
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname,'..','config','schemas','fieldRegistry.json'),'utf8'));
    const fieldsList = Object.keys(registry.fields || {});

    const allFields = [];
    let url = '/custom_fields/?page_size=200';
    while (url) {
      const r = await api.get(url);
      allFields.push(...(r.data.results || []));
      const next = r.data.next; if (next) { const u=new URL(next); url = u.pathname + u.search; } else url = null;
    }

    const byNorm = {};
    for (const f of allFields) {
      byNorm[normalizeName(f.name)] = byNorm[normalizeName(f.name)] || [];
      byNorm[normalizeName(f.name)].push(f);
    }

    const renameResults = [];

    for (const key of fieldsList) {
      // skip metadata core fields
      if (['title','correspondent','tags','document_type','document_date','language'].includes(key)) continue;
      const targetName = key; // snake_case from registry
      const targetNorm = normalizeName(targetName);

      // find candidate field whose norm equals target norm but whose name differs
      const matches = byNorm[targetNorm] || [];
      if (matches.length === 0) {
        // try to find a human-friendly variant (e.g., 'Invoice Amount' vs 'invoice_amount') by comparing normalized forms
        // find any field that, when normalized, equals normalized(key) (we already did) - nothing found
        continue;
      }

      // choose keeper candidate (prefer one with documents)
      matches.sort((a,b) => (b.document_count - a.document_count) || (a.id - b.id));
      const keeper = matches[0];

      if (keeper.name === targetName) {
        // already correct
        continue;
      }

      // Check if any other field already has exactly the targetName (conflict)
      const conflict = allFields.find(f => f.name === targetName);
      if (conflict) {
        // If conflict is the keeper itself (unlikely), skip; otherwise skip and log
        if (conflict.id !== keeper.id) {
          console.warn(`Conflict: target name ${targetName} already used by id=${conflict.id}; skipping rename for ${keeper.name}(id=${keeper.id})`);
          renameResults.push({ id: keeper.id, old_name: keeper.name, attempted_new_name: targetName, result: 'skipped_conflict', conflict_id: conflict.id });
          continue;
        }
      }

      // Proceed to rename via PATCH
      try {
        console.log(`Renaming id=${keeper.id} '${keeper.name}' -> '${targetName}'`);
        const resp = await api.patch(`/custom_fields/${keeper.id}/`, { name: targetName });
        renameResults.push({ id: keeper.id, old_name: keeper.name, new_name: resp.data.name, document_count: keeper.document_count, result: 'renamed' });
      } catch (err) {
        console.error(`Failed to rename id=${keeper.id} (${keeper.name}):`, err.response ? err.response.data : err.message);
        renameResults.push({ id: keeper.id, old_name: keeper.name, attempted_new_name: targetName, result: 'failed', error: err.response ? err.response.data : String(err.message) });
      }
    }

    const outPath = path.join(__dirname,'..','artifacts','rename_registry_mapping.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ renamed: renameResults, timestamp: (new Date()).toISOString() }, null, 2));
    console.log('Done. Results written to', outPath);
  } catch (e) {
    console.error('Fatal:', e.message || e);
    process.exit(2);
  }
})();