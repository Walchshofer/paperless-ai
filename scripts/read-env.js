const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
try {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('--- START OF .env ---');
    console.log(content);
    console.log('--- END OF .env ---');
  } else {
    console.log('.env file does not exist at root');
  }
} catch (err) {
  console.error('Error reading .env:', err.message);
}
