const assert = require('assert');
const dashboardService = require('../../src/services/dashboardService');
const paperlessService = require('../../services/paperlessService');
const documentModel = require('../../services/documentModel');
const setupService = require('../../services/setupService');

describe('DashboardService', () => {
  let originalMethods = {};

  before(() => {
    // Backup original methods
    originalMethods = {
      getTagCount: paperlessService.getTagCount,
      getCorrespondentCount: paperlessService.getCorrespondentCount,
      checkHealth: paperlessService.checkHealth,
      getDocumentCount: paperlessService.getDocumentCount,
      checkDatabaseHealth: documentModel.checkDatabaseHealth,
      getProcessedDocumentsCount: documentModel.getProcessedDocumentsCount,
      getMetrics: documentModel.getMetrics,
      getProcessingTimeStats: documentModel.getProcessingTimeStats,
      getTokenDistribution: documentModel.getTokenDistribution,
      getDocumentTypeStats: documentModel.getDocumentTypeStats,
      getCurrentProcessingStatus: documentModel.getCurrentProcessingStatus,
      getPaginatedHistory: documentModel.getPaginatedHistory,
      loadConfig: setupService.loadConfig
    };
  });

  after(() => {
    // Restore original methods
    Object.assign(paperlessService, {
      getTagCount: originalMethods.getTagCount,
      getCorrespondentCount: originalMethods.getCorrespondentCount,
      checkHealth: originalMethods.checkHealth,
      getDocumentCount: originalMethods.getDocumentCount
    });
    Object.assign(documentModel, {
      checkDatabaseHealth: originalMethods.checkDatabaseHealth,
      getProcessedDocumentsCount: originalMethods.getProcessedDocumentsCount,
      getMetrics: originalMethods.getMetrics,
      getProcessingTimeStats: originalMethods.getProcessingTimeStats,
      getTokenDistribution: originalMethods.getTokenDistribution,
      getDocumentTypeStats: originalMethods.getDocumentTypeStats,
      getCurrentProcessingStatus: originalMethods.getCurrentProcessingStatus,
      getPaginatedHistory: originalMethods.getPaginatedHistory
    });
    setupService.loadConfig = originalMethods.loadConfig;
  });

  it('should return aggregated metrics with timestamp', async () => {
    // Setup Mocks
    paperlessService.getTagCount = async () => 10;
    paperlessService.getCorrespondentCount = async () => 5;
    paperlessService.checkHealth = async () => ({ healthy: true, documentCount: 100 });
    paperlessService.getDocumentCount = async () => 100;

    documentModel.checkDatabaseHealth = async () => ({ healthy: true, documentCount: 80 });
    documentModel.getProcessedDocumentsCount = async () => 80;
    documentModel.getMetrics = async () => [
      { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    ];
    documentModel.getProcessingTimeStats = async () => ({ avg: 500 });
    documentModel.getTokenDistribution = async () => [{ range: '0-1k', count: 5 }];
    documentModel.getDocumentTypeStats = async () => [{ type: 'Invoice', count: 10 }];
    documentModel.getCurrentProcessingStatus = async () => ({ isProcessing: false });
    documentModel.getPaginatedHistory = async () => [{ title: 'Doc 1' }];

    setupService.loadConfig = async () => ({ AI_PROVIDER: 'openai' });

    // Act
    const result = await dashboardService.getMetrics({ username: 'testuser' });

    // Assert
    assert.ok(result.lastUpdated, 'Should have lastUpdated timestamp');
    assert.strictEqual(result.paperless_data.tagCount, 10);
    assert.strictEqual(result.paperless_data.correspondentCount, 5);
    assert.strictEqual(result.paperless_data.documentCount, 100);
    assert.strictEqual(result.paperless_data.processedDocumentCount, 80);
    assert.strictEqual(result.health.paperless, 'online');
    assert.strictEqual(result.health.local_db, 'online');
    assert.strictEqual(result.openai_data.averageTotalTokens, 30);
    assert.strictEqual(result.recentActivity.length, 1);
  });

  it('should handle errors gracefully', async () => {
    // Setup Mocks to fail
    paperlessService.getTagCount = async () => { throw new Error('Fail'); };
    paperlessService.checkHealth = async () => ({ healthy: false });
    
    // Act
    const result = await dashboardService.getMetrics();

    // Assert
    assert.ok(result.errors.includes('tagCount'));
    assert.strictEqual(result.paperless_data.tagCount, 0, 'Should default to 0 on error');
    assert.strictEqual(result.health.paperless, 'offline');
  });
});
