const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {execSync} = require('child_process');

const indexPath = path.join(__dirname, '..', 'test-results', 'playwright-report', 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('index.html not found at', indexPath);
  process.exit(2);
}
const html = fs.readFileSync(indexPath, 'utf8');
const m = html.match(/<script id="playwrightReportBase64" type="application\/zip">data:application\/zip;base64,([\s\S]+?)<\/script>/);
if (!m) {
  console.error('embedded base64 zip not found');
  process.exit(2);
}
const b64 = m[1].replace(/\s+/g, '');
const outZip = path.join(__dirname, '..', 'test-results', 'playwright-report.zip');
fs.writeFileSync(outZip, Buffer.from(b64, 'base64'));
console.log('Wrote', outZip);

const extractDir = path.join(__dirname, '..', 'test-results', 'playwright-report-zip');
if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir);

try {
  // Use unzip command if available
  execSync(`powershell -Command "Expand-Archive -Path '${outZip}' -DestinationPath '${extractDir}' -Force"`, {stdio: 'inherit'});
  console.log('Extracted to', extractDir);
} catch (e) {
  console.error('Failed to extract zip via PowerShell Expand-Archive, trying node unzip...');
  const unzipper = require('unzipper');
  fs.createReadStream(outZip).pipe(unzipper.Extract({path: extractDir}))
    .on('close', () => console.log('Extracted to', extractDir))
    .on('error', (err) => { console.error('unzipper error', err); process.exit(3); });
}
