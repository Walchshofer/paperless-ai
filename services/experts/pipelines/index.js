/**
 * Pipeline Definitions Index
 *
 * Exports all pipeline constants, model configurations, and pipeline definitions.
 */

const { StageType, ExecutionMode } = require('./constants');
const { MODEL_NAMES } = require('./models');
const { MedicalPipeline } = require('./MedicalPipeline');
const { FinancialPipeline } = require('./FinancialPipeline');
const { LegalPipeline } = require('./LegalPipeline');
const { GeneralPipeline } = require('./GeneralPipeline');

module.exports = {
    // Constants
    StageType,
    ExecutionMode,
    MODEL_NAMES,

    // Pipeline definitions
    MedicalPipeline,
    FinancialPipeline,
    LegalPipeline,
    GeneralPipeline
};
