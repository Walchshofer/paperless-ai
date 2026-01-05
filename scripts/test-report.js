const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'TEST_RESULTS.md');

if (!fs.existsSync(reportPath)) {
    const content = `# Test Results\n\nGenerated: ${new Date().toISOString()}\n\n- Results pending.\n`;
    fs.writeFileSync(reportPath, content, 'utf8');
    console.log('[test-report] Created TEST_RESULTS.md');
} else {
    console.log('[test-report] TEST_RESULTS.md already exists; no changes made.');
}
