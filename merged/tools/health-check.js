#!/usr/bin/env node
const http = require('http');

function check(path) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: 'localhost', port: 3000, path, timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ path, status: res.statusCode, ok: res.statusCode === 200, body: data.slice(0, 200) }));
    });
    req.on('error', () => resolve({ path, status: null, ok: false, body: 'connection failed' }));
    req.on('timeout', () => { req.destroy(); resolve({ path, status: null, ok: false, body: 'timeout' }); });
  });
}

(async () => {
  const results = await Promise.all([
    check('/api/health'),
    check('/api/ready'),
    check('/api/cache'),
  ]);
  console.log('Health check results:');
  results.forEach(r => console.log(`  ${r.path} -> ${r.ok ? 'OK' : 'FAIL'} (${r.status})`));
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
