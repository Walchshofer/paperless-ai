const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return false;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return true;
}

const reportSrc = path.resolve(process.cwd(), 'playwright-report');
const screenshotsSrc = path.resolve(process.cwd(), 'test-results', 'playwright-shadcn-compat');
const destBase = path.resolve(process.cwd(), 'docs', 'settings', 'artifacts', 'p0.0');

try {
  if (!fs.existsSync(destBase)) fs.mkdirSync(destBase, { recursive: true });
  const reportDest = path.join(destBase, 'playwright-report');
  const shotsDest = path.join(destBase, 'screenshots');

  const reportCopied = copyDirSync(reportSrc, reportDest);
  const shotsCopied = copyDirSync(screenshotsSrc, shotsDest);

  console.log('collect-playwright-report: reportCopied=', reportCopied, 'shotsCopied=', shotsCopied);
  console.log('Artifacts available under:', destBase);
} catch (err) {
  console.error('collect-playwright-report failed:', err);
  process.exit(1);
}
