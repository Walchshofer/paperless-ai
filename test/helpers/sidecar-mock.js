const http = require('http');

function startSidecarMock(port = 3001, behavior = { healthy: true }) {
  const server = http.createServer((req, res) => {
    if (!behavior.healthy) {
      res.statusCode = 500;
      return res.end('sidecar failing');
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, hits: [] }));
  });
  return new Promise(resolve => server.listen(port, () => resolve({ server, port, stop: () => server.close() })));
}

module.exports = { startSidecarMock };
