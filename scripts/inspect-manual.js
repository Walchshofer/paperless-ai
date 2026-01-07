(async ()=>{
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const loginUser = process.env.PAPERLESS_ADMIN_USER || 'elfman';
  const loginPass = process.env.PAPERLESS_ADMIN_PASSWORD || process.env.POSTGRES_PASSWORD || 'P2tr3ck!1976';

  let response = await page.goto('http://localhost:3000/manual');
  await page.waitForLoadState('domcontentloaded');
  console.log('Initial response status:', response && response.status());

  // Login if needed
  const hasLoginForm = await page.locator('form[action="/login"]').count().catch(()=>0);
  if (hasLoginForm > 0) {
    console.log('Login form present, attempting login as', loginUser);
    await page.fill('#username', loginUser);
    await page.fill('#password', loginPass);
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }).catch(()=>null), page.click('button[type="submit"]')]).catch(()=>null);
    response = await page.goto('http://localhost:3000/manual');
    await page.waitForLoadState('domcontentloaded');
    console.log('Manual response after auth:', response && response.status());
  }

  const manual = await page.$('[data-testid="manual-editor-island"]');
  if(!manual){ console.log('No manual anchor found'); await browser.close(); process.exit(0); }
  const html = await manual.evaluate(el=>el.outerHTML);
  console.log('Manual anchor outerHTML:\n', html);
  const root = await page.$('[data-testid="manual-editor-island-root"]');
  console.log('manual-editor-island-root present?', !!root);
  if(root){ console.log('root outerHTML:\n', await root.evaluate(el=>el.outerHTML)); }
  const scripts = await page.evaluate(()=>Array.from(document.scripts).map(s=>({ src: s.src||'inline', body: s.innerText ? (s.innerText.substring(0, 200)) : '' }))); 
  console.log('Scripts on page (first 200 chars):', JSON.stringify(scripts, null, 2));
  const inlineManualScript = scripts.find(s => s.body && s.body.includes('manual-editor-island'));
  console.log('Inline manual script present?', Boolean(inlineManualScript));
  if (inlineManualScript) console.log('Inline manual script preview:', inlineManualScript.body);

  await browser.close();
})();
