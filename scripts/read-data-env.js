const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'data', '.env');
try {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('--- START OF data/.env ---');
    console.log(content);
    console.log('--- END OF data/.env ---');
  } else {
    console.log('data/.env file does not exist');
  }
} catch (err) {
  console.error('Error reading data/.env:', err.message);
}
