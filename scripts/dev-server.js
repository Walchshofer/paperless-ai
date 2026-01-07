/* Dev server that starts the Express app without performing the DB validation step.
   Useful for local E2E runs when a full DB is not available.
*/

const app = require('../server');
const port = process.env.PAPERLESS_AI_PORT || 3000;

const server = app.listen(port, () => {
  const p = server.address().port;
  console.log(`[DEV SERVER] Dev server started on port ${p} (DB validation bypassed)`);
});

process.on('SIGINT', () => {
  console.log('[DEV SERVER] Shutting down');
  server.close(() => process.exit(0));
});
