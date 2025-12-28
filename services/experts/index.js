/**
 * Expert Pipeline System - Main Entry Point
 *
 * Re-exports all components for backwards compatibility.
 *
 * Usage:
 *   const { expertRegistry, processDocument, ExecutionContext } = require('./services/experts');
 *
 * Module Structure:
 *   - ExpertRegistry: Pipeline registration and routing
 *   - ExpertPipelineExecutor: Stage-by-stage execution engine
 *   - pipelines/: Domain-specific pipeline definitions
 *   - context/: Execution context management
 *   - evaluation/: Condition and validation logic
 *   - utils/: Utility functions
 */

// Core registry and executor
const {
    ExpertRegistry,
    expertRegistry,
    StageType,
    ExecutionMode,
    MODEL_NAMES,
    MedicalPipeline,
    FinancialPipeline,
    LegalPipeline,
    GeneralPipeline
} = require('./ExpertRegistry');

const {
    ExpertPipelineExecutor,
    ExecutionContext,
    ConditionEvaluator,
    ValidationEngine,
    processDocument,
    createPipelineExecutor
} = require('./ExpertPipelineExecutor');

const { LocalTranslator } = require('./translation');

// Re-export everything for backwards compatibility
module.exports = {
    // Registry
    ExpertRegistry,
    expertRegistry,

    // Executor
    ExpertPipelineExecutor,
    ExecutionContext,
    ConditionEvaluator,
    ValidationEngine,
    processDocument,
    createPipelineExecutor,

    // Constants
    StageType,
    ExecutionMode,
    MODEL_NAMES,

    // Pipeline definitions
    MedicalPipeline,
    FinancialPipeline,
    LegalPipeline,
    GeneralPipeline,

    // Translation
    LocalTranslator
};
