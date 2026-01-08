const http = require('http');
const interval = 15000; // 15s
const maxAttempts = 40; // ~10 min
let attempts = 0;
function check() {
  attempts++;
  http.get('http://localhost:8001/health', res => {
    let buf = '';
    res.on('data', d => buf += d);
    res.on('end', () => {
      try {
        const json = JSON.parse(buf);
        console.log(new Date().toISOString(), 'model_loaded=' + json.model_loaded);
        if (json.model_loaded === true) process.exit(0);
        if (attempts >= maxAttempts) { console.log('TIMEOUT'); process.exit(1); }
        setTimeout(check, interval);
      } catch (e) {
        console.error('ERR parse', e.message);
        if (attempts >= maxAttempts) { console.log('TIMEOUT'); process.exit(1); }
        setTimeout(check, interval);
      }
    });
  }).on('error', err => {
    console.error('ERR', err.message);
    if (attempts >= maxAttempts) { console.log('TIMEOUT'); process.exit(1); }
    setTimeout(check, interval);
  });
}
check();
