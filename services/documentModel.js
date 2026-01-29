// models/document.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../services/logger');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database with WAL mode for better performance
const db = new Database(path.join(dataDir, 'documents.db'), { 
  //verbose: console.log 
});
db.pragma('journal_mode = WAL');

// Create tables
const createTableMain = db.prepare(`
  CREATE TABLE IF NOT EXISTS processed_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER UNIQUE,
    title TEXT,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createTableMain.run();

const createTableMetrics = db.prepare(`
  CREATE TABLE IF NOT EXISTS openai_metrics (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    promptTokens INTEGER,
    completionTokens INTEGER,
    totalTokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createTableMetrics.run();

const createTableHistory = db.prepare(`
  CREATE TABLE IF NOT EXISTS history_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    tags TEXT,
    title TEXT,
    correspondent TEXT,
    username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createTableHistory.run();

// Migration: Add username column if it doesn't exist
try {
  db.prepare("ALTER TABLE history_documents ADD COLUMN username TEXT").run();
  console.log("[MIGRATION] Added username column to history_documents");
} catch (e) {
  // Column might already exist
}

// Migration: Fix NULL usernames
try {
  const result = db.prepare("UPDATE history_documents SET username = 'elfman' WHERE username IS NULL").run();
  if (result.changes > 0) {
    console.log(`[MIGRATION] Updated ${result.changes} history rows with NULL username to 'elfman'`);
  }
} catch (e) {
  console.error("[MIGRATION] Failed to update NULL usernames:", e);
}

const createOriginalDocuments = db.prepare(`
  CREATE TABLE IF NOT EXISTS original_documents (
    id INTEGER PRIMARY KEY,
    document_id INTEGER,
    title TEXT,
    tags TEXT,
    correspondent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
createOriginalDocuments.run();

const userTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
userTable.run();

// Feedback events table (user corrections and annotations)
const createFeedbackEvents = db.prepare(`
  CREATE TABLE IF NOT EXISTS feedback_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    field_name TEXT,
    original_value TEXT,
    corrected_value TEXT,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed INTEGER DEFAULT 0
  );
`);
createFeedbackEvents.run();

// Prepared statements for feedback operations
const insertFeedbackStmt = db.prepare(`
  INSERT INTO feedback_events (document_id, user_id, event_type, field_name, original_value, corrected_value, context)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const getPendingFeedbackStmt = db.prepare(`
  SELECT * FROM feedback_events WHERE processed = 0 ORDER BY created_at ASC LIMIT ?
`);


// Prepare statements for better performance
const insertDocument = db.prepare(`
  INSERT INTO processed_documents (document_id, title) 
  VALUES (?, ?)
  ON CONFLICT(document_id) DO UPDATE SET
    last_updated = CURRENT_TIMESTAMP
  WHERE document_id = ?
`);

const findDocument = db.prepare(
  'SELECT * FROM processed_documents WHERE document_id = ?'
);

const insertMetrics = db.prepare(`
  INSERT INTO openai_metrics (document_id, promptTokens, completionTokens, totalTokens)
  VALUES (?, ?, ?, ?)
`);

const insertOriginal = db.prepare(`
  INSERT INTO original_documents (document_id, title, tags, correspondent)
  VALUES (?, ?, ?, ?)
`);

const insertHistory = db.prepare(`
  INSERT INTO history_documents (document_id, tags, title, correspondent, username)
  VALUES (?, ?, ?, ?, ?)
`);

const insertUser = db.prepare(`
  INSERT INTO users (username, password)
  VALUES (?, ?)
`);

// Add these prepared statements with your other ones at the top
const getHistoryDocumentsCount = db.prepare(`
  SELECT COUNT(*) as count FROM history_documents WHERE username = ?
`);

const getPaginatedHistoryDocuments = db.prepare(`
  SELECT * FROM history_documents 
  WHERE username = ?
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);

const getAllHistoryByUser = db.prepare(`
  SELECT * FROM history_documents WHERE username = ? ORDER BY created_at DESC
`);

const createProcessingStatus = db.prepare(`
  CREATE TABLE IF NOT EXISTS processing_status (
    id INTEGER PRIMARY KEY,
    document_id INTEGER UNIQUE,
    title TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT
  );
`);
createProcessingStatus.run();

// Add with your other prepared statements
const upsertProcessingStatus = db.prepare(`
  INSERT INTO processing_status (document_id, title, status)
  VALUES (?, ?, ?)
  ON CONFLICT(document_id) DO UPDATE SET
    status = excluded.status,
    start_time = CURRENT_TIMESTAMP
  WHERE document_id = excluded.document_id
`);

const clearProcessingStatus = db.prepare(`
  DELETE FROM processing_status WHERE document_id = ?
`);

const getActiveProcessing = db.prepare(`
  SELECT * FROM processing_status 
  WHERE start_time >= datetime('now', '-30 seconds')
  ORDER BY start_time DESC LIMIT 1
`);


module.exports = {
  async addProcessedDocument(documentId, title) {
    try {
      // Bei UNIQUE constraint failure wird der existierende Eintrag aktualisiert
      const result = insertDocument.run(documentId, title, documentId);
      if (result.changes > 0) {
        console.log(`[DEBUG] Document ${title} ${result.lastInsertRowid ? 'added to' : 'updated in'} processed_documents`);
        return true;
      }
      return false;
    } catch (error) {
      // Log error but don't throw
      console.error('[ERROR] adding document:', error);
      return false;
    }
  },

  async addOpenAIMetrics(documentId, promptTokens, completionTokens, totalTokens) {
    try {
      const result = insertMetrics.run(documentId, promptTokens, completionTokens, totalTokens);
      if (result.changes > 0) {
        console.log(`[DEBUG] Metrics added for document ${documentId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ERROR] adding metrics:', error);
      return false;
    }
  },

  async getMetrics() {
    try {
      return db.prepare('SELECT * FROM openai_metrics').all();
    } catch (error) {
      console.error('[ERROR] getting metrics:', error);
      return [];
    }
  },

  async getProcessedDocuments() {
    try {
      return db.prepare('SELECT * FROM processed_documents').all();
    } catch (error) {
      console.error('[ERROR] getting processed documents:', error);
      return [];
    }
  },

  async getProcessedDocumentsCount() {
    try {
      return db.prepare('SELECT COUNT(*) FROM processed_documents').pluck().get();
    } catch (error) {
      console.error('[ERROR] getting processed documents count:', error);
      return 0;
    }
  },

  async isDocumentProcessed(documentId) {
    try {
      const row = findDocument.get(documentId);
      return !!row;
    } catch (error) {
      console.error('[ERROR] checking document:', error);
      // Im Zweifelsfall true zurückgeben, um doppelte Verarbeitung zu vermeiden
      return true;
    }
  },

  async saveOriginalData(documentId, tags, correspondent, title) {
    try {
      const tagsString = JSON.stringify(tags); // Konvertiere Array zu String
      const result = insertOriginal.run(documentId, title, tagsString, correspondent);
      if (result.changes > 0) {
        console.log(`[DEBUG] Original data for document ${title} saved`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ERROR] saving original data:', error);
      return false;
    }
  },

  async addToHistory(documentId, tagIds, title, correspondent, username) {
    if (!username) {
      console.error('[ERROR] adding to history: username is required');
      return false;
    }
    try {
      const tagIdsString = JSON.stringify(tagIds); // Konvertiere Array zu String
      const result = insertHistory.run(documentId, tagIdsString, title, correspondent, username);
      if (result.changes > 0) {
        console.log(`[DEBUG] Document ${title} added to history by ${username}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ERROR] adding to history:', error);
      return false;
    }
  },

  async getHistory(id, username = null) {
    //check if id is provided else get all history
    if (id) {
      try {
        if (username) {
          return db.prepare('SELECT * FROM history_documents WHERE document_id = ? AND username = ?').get(id, username);
        } else {
          //only one document with id exists
          return db.prepare('SELECT * FROM history_documents WHERE document_id = ?').get(id);
        }
      } catch (error) {
        console.error('[ERROR] getting history for id:', id, error);
        return [];
      }
    } else {
      try {
        if (username) {
          return db.prepare('SELECT * FROM history_documents WHERE username = ?').all(username);
        }
        return db.prepare('SELECT * FROM history_documents').all();
      } catch (error) {
        console.error('[ERROR] getting history for id:', id, error);
        return [];
      }
    }
  },

  async getOriginalData(id) {
    //check if id is provided else get all original data
    if (id) {
      try {
        //only one document with id exists
        return db.prepare('SELECT * FROM original_documents WHERE document_id = ?').get(id);
      } catch (error) {
        console.error('[ERROR] getting original data for id:', id, error);
        return [];
      }
    } else {
      try {
        return db.prepare('SELECT * FROM original_documents').all();
      } catch (error) {
        console.error('[ERROR] getting original data for id:', id, error);
        return [];
      }
    }
  },

  async getAllOriginalData() {
    try {
      return db.prepare('SELECT * FROM original_documents').all();
    } catch (error) {
      console.error('[ERROR] getting original data:', error);
      return [];
    }
  },

  async getAllHistory(username = 'elfman') {
    try {
      return getAllHistoryByUser.all(username);
    } catch (error) {
      console.error('[ERROR] getting all history:', error);
      return [];
    }
  },

  async getHistoryDocumentsCount(username = 'elfman') {
    try {
      const result = getHistoryDocumentsCount.get(username);
      return result.count;
    } catch (error) {
      console.error('[ERROR] getting history documents count:', error);
      return 0;
    }
  },
  
  async getPaginatedHistory(limit, offset, username = 'elfman') {
    try {
      return getPaginatedHistoryDocuments.all(username, limit, offset);
    } catch (error) {
      console.error('[ERROR] getting paginated history:', error);
      return [];
    }
  },

  async deleteAllDocuments() {
    try {
      db.prepare('DELETE FROM processed_documents').run();
      logger.debug('All processed_documents deleted');
      db.prepare('DELETE FROM history_documents').run();
      logger.debug('All history_documents deleted');
      db.prepare('DELETE FROM original_documents').run();
      logger.debug('All original_documents deleted');
      return true;
    } catch (error) {
      console.error('[ERROR] deleting documents:', error);
      return false;
    }
  },

  async deleteDocumentsIdList(idList) {
    try {
      logger.debug('Received idList: %o', idList);
  
      const ids = Array.isArray(idList) ? idList : (idList?.ids || []);
  
      if (!Array.isArray(ids) || ids.length === 0) {
        logger.error('Invalid input: must provide an array of ids');
        return false;
      }
  
      // Convert string IDs to integers
      const numericIds = ids.map(id => parseInt(id, 10));
  
      const placeholders = numericIds.map(() => '?').join(', ');
      const query = `DELETE FROM processed_documents WHERE document_id IN (${placeholders})`;
      const query2 = `DELETE FROM history_documents WHERE document_id IN (${placeholders})`;
      const query3 = `DELETE FROM original_documents WHERE document_id IN (${placeholders})`;
      logger.debug('Executing SQL query: %s', query);
      logger.debug('Executing SQL query: %s', query2);
      logger.debug('Executing SQL query: %s', query3);
      logger.debug('With parameters: %o', numericIds);
  
      const stmt = db.prepare(query);
      const stmt2 = db.prepare(query2);
      const stmt3 = db.prepare(query3);
      const result = stmt.run(numericIds);
      const result2 = stmt2.run(numericIds);
      const result3 = stmt3.run(numericIds);

      logger.debug('SQL result: %o', result);
      logger.debug('SQL result: %o', result2);
      logger.debug('SQL result: %o', result3);
      logger.info('Documents with IDs %s deleted', numericIds.join(', '));
      return true;
    } catch (error) {
      console.error('[ERROR] deleting documents:', error);
      return false;
    }
  },


  async insertFeedback(feedback) {
    try {
      // Accept either doc_id or document_id from callers
      const documentId = feedback.document_id || feedback.doc_id;

      // Ensure values are serializable strings where appropriate
      const originalValue = typeof feedback.original_value === 'object' ? JSON.stringify(feedback.original_value) : feedback.original_value || null;
      const correctedValue = typeof feedback.corrected_value === 'object' ? JSON.stringify(feedback.corrected_value) : feedback.corrected_value || null;

      const result = insertFeedbackStmt.run(
        documentId,
        feedback.user_id || null,
        feedback.event_type,
        feedback.field_name || null,
        originalValue,
        correctedValue,
        JSON.stringify(feedback.context || {})
      );

      const id = (result && result.lastInsertRowid) ? result.lastInsertRowid : null;
      if (id) {
        const row = db.prepare('SELECT * FROM feedback_events WHERE id = ?').get(id);
        return row || { id };
      }
      return { id };
    } catch (error) {
      console.error('[ERROR] inserting feedback:', error);
      return null;
    }
  },
 

  async getPendingFeedback(limit = 100) {
    try {
      return getPendingFeedbackStmt.all(limit);
    } catch (error) {
      console.error('[ERROR] getting pending feedback:', error);
      return [];
    }
  },

  async markFeedbackProcessed(ids) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return 0;
      const placeholders = ids.map(() => '?').join(',');
      const stmt = db.prepare(`UPDATE feedback_events SET processed = 1 WHERE id IN (${placeholders})`);
      const result = stmt.run(...ids);
      return result.changes || 0;
    } catch (error) {
      console.error('[ERROR] marking feedback processed:', error);
      return 0;
    }
  },

  async _dbAll(sql) {
    try {
      return db.prepare(sql).all();
    } catch (err) {
      console.error('[ERROR] _dbAll:', err);
      return [];
    }
  },

  async addUser(username, password) {
    try {
      // Lösche alle vorhandenen Benutzer
      const deleteResult = db.prepare('DELETE FROM users').run();
      console.log(`[DEBUG] ${deleteResult.changes} existing users deleted`);
  
      // Füge den neuen Benutzer hinzu
      const result = insertUser.run(username, password);
      if (result.changes > 0) {
        console.log(`[DEBUG] User ${username} added`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ERROR] adding user:', error);
      return false;
    }
  },

  async getUser(username) {
    try {
      return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    } catch (error) {
      console.error('[ERROR] getting user:', error);
      return [];
    }
  },

  async getUsers() {
    try {
      return db.prepare('SELECT * FROM users').all();
    } catch (error) {
      console.error('[ERROR] getting users:', error);
      return [];
    }
  },

  async getProcessingTimeStats() {
    try {
      return db.prepare(`
        SELECT 
          strftime('%H', processed_at) as hour,
          COUNT(*) as count
        FROM processed_documents 
        WHERE date(processed_at) = date('now')
        GROUP BY hour
        ORDER BY hour
      `).all();
    } catch (error) {
      console.error('[ERROR] getting processing time stats:', error);
      return [];
    }
  },
  
  async  getTokenDistribution() {
    try {
      return db.prepare(`
        SELECT 
          CASE 
            WHEN totalTokens < 1000 THEN '0-1k'
            WHEN totalTokens < 2000 THEN '1k-2k'
            WHEN totalTokens < 3000 THEN '2k-3k'
            WHEN totalTokens < 4000 THEN '3k-4k'
            WHEN totalTokens < 5000 THEN '4k-5k'
            ELSE '5k+'
          END as range,
          COUNT(*) as count
        FROM openai_metrics
        GROUP BY range
        ORDER BY range
      `).all();
    } catch (error) {
      console.error('[ERROR] getting token distribution:', error);
      return [];
    }
  },
  
  async getDocumentTypeStats() {
    try {
      return db.prepare(`
        SELECT 
          substr(title, 1, instr(title || ' ', ' ') - 1) as type,
          COUNT(*) as count
        FROM processed_documents
        GROUP BY type
      `).all();
    } catch (error) {
      console.error('[ERROR] getting document type stats:', error);
      return [];
    }
},

async setProcessingStatus(documentId, title, status) {
  try {
      if (status === 'complete') {
          const result = clearProcessingStatus.run(documentId);
          return result.changes > 0;
      } else {
          const result = upsertProcessingStatus.run(documentId, title, status);
          return result.changes > 0;
      }
  } catch (error) {
      console.error('[ERROR] updating processing status:', error);
      return false;
  }
},



async getCurrentProcessingStatus() {
  try {
      const active = getActiveProcessing.get();
      
      // Get last processed document with explicit UTC time
      const lastProcessed = db.prepare(`
          SELECT 
              document_id, 
              title, 
              datetime(processed_at) as processed_at 
          FROM processed_documents 
          ORDER BY processed_at DESC 
          LIMIT 1`
      ).get();

      const processedToday = db.prepare(`
          SELECT COUNT(*) as count 
          FROM processed_documents 
          WHERE date(processed_at) = date('now', 'localtime')`
      ).get();

      return {
          currentlyProcessing: active ? {
              documentId: active.document_id,
              title: active.title,
              startTime: active.start_time,
              status: active.status
          } : null,
          lastProcessed: lastProcessed ? {
              documentId: lastProcessed.document_id,
              title: lastProcessed.title,
              processed_at: lastProcessed.processed_at
          } : null,
          processedToday: processedToday.count,
          isProcessing: !!active
      };
  } catch (error) {
      console.error('[ERROR] getting current processing status:', error);
      return {
          currentlyProcessing: null,
          lastProcessed: null,
          processedToday: 0,
          isProcessing: false
      };
  }
},

  /**
   * Checks the health of the SQLite database by performing a simple count query.
   * @returns {Promise<{healthy: boolean, documentCount?: number, error?: string, timestamp: string}>}
   */
  async checkDatabaseHealth() {
    try {
      const count = db.prepare('SELECT COUNT(*) as count FROM processed_documents').get();
      return { 
        healthy: true, 
        documentCount: count.count, 
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },


  // Utility method to close the database connection
  closeDatabase() {
    return new Promise((resolve, reject) => {
      try {
        db.close();
        logger.info('Database closed successfully');
        resolve();
      } catch (error) {
        logger.error('Error closing database: %o', error);
        reject(error);
      }
    });
  }
};
