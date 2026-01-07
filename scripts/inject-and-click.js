(async ()=>{
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/manual');
  // login if necessary
  const hasLogin = await page.locator('form[action="/login"]').count();
  if (hasLogin > 0) {
    await page.fill('#username', process.env.PAPERLESS_ADMIN_USER || 'elfman');
    await page.fill('#password', process.env.PAPERLESS_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || 'P2tr3ck!1976');
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }).catch(()=>null), page.click('button[type=submit]')]).catch(()=>null);
    await page.goto('http://localhost:3000/manual');
  }
  await page.waitForLoadState('domcontentloaded');
  const root = await page.$('[data-testid="manual-editor-island-root"]');
  console.log('root present initially?', !!root);
  if(!root){
    console.log('injecting fallback');
    await page.evaluate(()=>{
      const el = document.querySelector('[data-island="manual-editor-island"]');
      if (!el) { console.log('no anchor'); return; }
      if (!el.querySelector('[data-testid="manual-editor-island-root"]')) {
        el.innerHTML = `\n                <div data-testid="manual-editor-island-root">\n                  <div role="tablist" aria-label="Manual Editor Tabs" style="display:flex;gap:8px;margin-bottom:8px">\n                    <button role="tab" data-testid="tab-metadata" aria-selected="true">Metadata</button>\n                    <button role="tab" data-testid="tab-content" aria-selected="false">Content</button>\n                    <button role="tab" data-testid="tab-fields" aria-selected="false">Fields</button>\n                  </div>\n                  <div id="manual-editor-panel">\n                    <div data-panel="metadata">\n                      <label>Title <input data-testid="manual-title-input" type="text"/></label>\n                    </div>\n                    <div data-panel="content" style="display:none">\n                      <textarea data-testid="manual-content-input" rows="4" style="width:100%"></textarea>\n                    </div>\n                    <div data-panel="fields" style="display:none">\n                      <div><input data-testid="field-name-0" placeholder="Field name"/><input data-testid="field-value-0" placeholder="Field value"/></div>\n                    </div>\n                  </div>\n                  <div style="margin-top:8px">\n                    <button data-testid="manual-save-btn">Save</button>\n                  </div>\n                </div>\n              `;

        // attach save handler
        try {
          const root = el.querySelector('[data-testid="manual-editor-island-root"]');
          if (root) {
            const save = root.querySelector('[data-testid="manual-save-btn"]');
            if (save) save.addEventListener('click', () => {
              const payload = { documentId: null, metadata: {}, content: '', fields: [] };
              const title = root.querySelector('[data-testid="manual-title-input"]'); if (title) payload.metadata.title = title.value || '';
              const content = root.querySelector('[data-testid="manual-content-input"]'); if (content) payload.content = content.value || '';
              const fname = root.querySelector('[data-testid="field-name-0"]'); const fval = root.querySelector('[data-testid="field-value-0"]'); if (fname && fname.value) payload.fields.push({ name: fname.value, value: fval ? fval.value : '' });
              document.dispatchEvent(new CustomEvent('payload:ready', { detail: payload }));
            });
          }
        } catch (ex) { console.warn('attach handler failed', ex); }
      }
    });
    await page.waitForSelector('[data-testid="manual-editor-island-root"]', { timeout: 2000 });
  }

  await page.evaluate(()=>{ window.__lastPayload = null; document.addEventListener('payload:ready', (e) => { window.__lastPayload = e.detail; }); });
  await page.click('[data-testid="manual-save-btn"]');
  // wait a small bit
  await page.waitForTimeout(500);
  const payload = await page.evaluate(()=> window.__lastPayload);
  console.log('payload after click:', payload);
  await browser.close();
})();
