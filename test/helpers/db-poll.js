const { Client } = require('pg');

async function waitForFeedbackEvent(postgresUrl, predicate, timeoutMs = 10000, intervalMs = 500) {
  const client = new Client({ connectionString: postgresUrl });
  await client.connect();
  const started = Date.now();
  try {
    while (Date.now() - started < timeoutMs) {
      const res = await client.query('SELECT * FROM feedback_events ORDER BY created_at DESC LIMIT 5');
      if (predicate(res.rows)) return res.rows;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Timeout waiting for feedback event');
  } finally {
    await client.end();
  }
}

module.exports = { waitForFeedbackEvent };
