const fs = require('fs');
const path = require('path');

const dataEnv = path.join(__dirname, '..', 'data', '.env');
try {
  if (fs.existsSync(dataEnv)) {
    // Rename to .env.backup instead of deleting
    fs.renameSync(dataEnv, dataEnv + '.backup');
    console.log('Successfully moved data/.env to data/.env.backup to avoid configuration conflicts.');
  } else {
    console.log('data/.env does not exist, no action needed.');
  }
} catch (err) {
  console.error('Error handling data/.env:', err.message);
}
