const config = require('../../config/config');
const logger = require('../logger');

module.exports = {
    /**
     * Analyze document using sequential text-then-vision pipeline
     * @param {number|string} documentId - Document ID
     * @param {string} content - Document text content
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Merged analysis result
     */
    async analyzeDocumentSequential(documentId, content, options = {}) {
        const startTime = Date.now();
        try {
            logger.info(`[SEQUENTIAL] Starting sequential analysis for document ${documentId}`);

            // 1. Text analysis first
            logger.info('[SEQUENTIAL] Step 1: Text analysis');
            const textResult = await this._analyzeDocumentText(
                content,
                options.existingTags || [],
                options.existingCorrespondentList || [],
                options.existingDocumentTypesList || [],
                documentId,
                null,
                options
            );

            // 2. Check if text quality is sufficient
            const quality = this._assessTextQuality(content);
            logger.debug(`[SEQUENTIAL] Text quality: ${quality}, Threshold: ${config.visualRag.textQualityThreshold}`);

            if (quality >= config.visualRag.textQualityThreshold) {
                logger.info('[SEQUENTIAL] Text quality sufficient, skipping vision analysis');
                textResult._analysisMode = 'SEQUENTIAL_TEXT_ONLY';
                return textResult;
            }

            // 3. Vision analysis to enhance results
            logger.info('[SEQUENTIAL] Step 2: Vision analysis for enhancement');
            const visionResult = await this.analyzeDocumentWithVision(documentId, content, options);

            // 4. Merge results
            logger.info('[SEQUENTIAL] Step 3: Merging results');
            const mergedResult = this._mergeAnalysisResults(textResult, visionResult, {
                quality,
                threshold: config.visualRag.textQualityThreshold,
                mode: 'SEQUENTIAL'
            });

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`[SEQUENTIAL] Analysis completed in ${elapsedTime}s`);

            return mergedResult;
        } catch (error) {
            logger.error(`[SEQUENTIAL] Analysis failed: ${error.message}`);
            return {
                document: this._emptyDocument(),
                metrics: null,
                error: error.message
            };
        }
    }
};
