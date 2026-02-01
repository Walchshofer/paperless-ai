const paperlessService = require('../../services/paperlessService');
const documentModel = require('../../services/documentModel');
const setupService = require('../../services/setupService');
const configFile = require('../../config/config');

class DashboardService {
  /**
   * aggregiert alle Metriken für das Dashboard und die API.
   * @param {Object} user - Der Benutzer, für den die Daten abgerufen werden (optional für reine Systemmetriken).
   * @returns {Promise<Object>} Das aggregierte Datenobjekt.
   */
  async getMetrics(user = null) {
    const timestamp = new Date().toISOString();
    const errors = [];

    // Parallel fetch for independent data
    const [
      tagCountResult,
      correspondentCountResult,
      paperlessHealth,
      dbHealth,
      processedDocumentCountResult,
      metricsResult,
      processingTimeStatsResult,
      tokenDistributionResult,
      documentTypesResult,
      processingStatusResult
    ] = await Promise.allSettled([
      paperlessService.getTagCount(),
      paperlessService.getCorrespondentCount(),
      paperlessService.checkHealth(),
      documentModel.checkDatabaseHealth(),
      documentModel.getProcessedDocumentsCount(),
      documentModel.getMetrics(),
      documentModel.getProcessingTimeStats(),
      documentModel.getTokenDistribution(),
      documentModel.getDocumentTypeStats(),
      documentModel.getCurrentProcessingStatus()
    ]);

    // Helper to extract values or defaults
    const getValue = (result, defaultVal, errorLabel) => {
      if (result.status === 'fulfilled') return result.value;
      console.error(`[ERROR] DashboardService: ${errorLabel} failed:`, result.reason?.message);
      errors.push(errorLabel);
      return defaultVal;
    };

    const tagCount = getValue(tagCountResult, 0, 'tagCount');
    const correspondentCount = getValue(correspondentCountResult, 0, 'correspondentCount');
    const paperlessHealthData = getValue(paperlessHealth, { healthy: false, documentCount: 0 }, 'paperlessHealth');
    const dbHealthData = getValue(dbHealth, { healthy: false, documentCount: 0 }, 'dbHealth');
    
    // Fallback for document counts if health check didn't return them
    let documentCount = paperlessHealthData.documentCount;
    if (!documentCount && documentCount !== 0) {
        try {
            documentCount = await paperlessService.getDocumentCount();
        } catch (e) {
            documentCount = 0;
            errors.push('documentCount');
        }
    }

    const processedDocumentCount = getValue(processedDocumentCountResult, dbHealthData.documentCount || 0, 'processedDocumentCount');
    const metrics = getValue(metricsResult, [], 'metrics');
    const processingTimeStats = getValue(processingTimeStatsResult, {}, 'processingTimeStats');
    
    let tokenDistribution = getValue(tokenDistributionResult, [], 'tokenDistribution');
    if (tokenDistribution.length === 0) tokenDistribution = [{ range: 'No data', count: 0 }];

    let documentTypes = getValue(documentTypesResult, [], 'documentTypes');
    if (documentTypes.length === 0) documentTypes = [{ type: 'No data', count: 0 }];

    const processingStatus = getValue(processingStatusResult, { isProcessing: false, processedToday: 0 }, 'processingStatus');

    // Recent Activity (User dependent)
    let recentActivity = [];
    if (user && user.username) {
      try {
        recentActivity = await documentModel.getPaginatedHistory(5, 0, user.username);
      } catch (err) {
        console.error('[ERROR] DashboardService: getPaginatedHistory failed:', err.message);
        errors.push('recentActivity');
      }
    }

    // Token Stats
    const averagePromptTokens = metrics.length > 0 ? Math.round(metrics.reduce((acc, cur) => acc + (cur.promptTokens || 0), 0) / metrics.length) : 0;
    const averageCompletionTokens = metrics.length > 0 ? Math.round(metrics.reduce((acc, cur) => acc + (cur.completionTokens || 0), 0) / metrics.length) : 0;
    const averageTotalTokens = metrics.length > 0 ? Math.round(metrics.reduce((acc, cur) => acc + (cur.totalTokens || 0), 0) / metrics.length) : 0;
    const tokensOverall = metrics.length > 0 ? metrics.reduce((acc, cur) => acc + (cur.totalTokens || 0), 0) : 0;

    // AI Health Check
    let aiHealth = 'offline';
    try {
      const fullConfig = await setupService.loadConfig();
      if (fullConfig && (fullConfig.AI_PROVIDER || fullConfig.OPENAI_API_KEY || fullConfig.OLLAMA_API_URL)) {
        aiHealth = 'online';
      }
    } catch (err) {
      aiHealth = 'error';
    }

    const health = {
      paperless: paperlessHealthData.healthy ? 'online' : 'offline',
      local_db: dbHealthData.healthy ? 'online' : 'offline',
      ai_service: aiHealth
    };

    const version = configFile.PAPERLESS_AI_VERSION || ' ';

    return {
      lastUpdated: timestamp,
      user,
      paperless_data: {
        tagCount,
        correspondentCount,
        documentCount,
        processedDocumentCount,
        processingTimeStats,
        tokenDistribution,
        documentTypes
      },
      openai_data: {
        averagePromptTokens,
        averageCompletionTokens,
        averageTotalTokens,
        tokensOverall
      },
      processingStatus,
      recentActivity,
      health,
      version,
      errors
    };
  }
}

module.exports = new DashboardService();
