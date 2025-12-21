module.exports = {
  categories: {
    medical: {
      minConfidence: 0.6,
      preferVision: true,
      fallbackToText: true,
      expertPipeline: 'medical',
      modalityRouting: {
        lab: { pipeline: 'lab_ocr_analysis', analysisModel: 'medtext-llama3' },
        radiology: { pipeline: 'radiology_reasoning', analysisModel: 'llava-med-v1.5' },
        prescription: { pipeline: 'standard', analysisModel: null }
      }
    },
    financial: {
      minConfidence: 0.7,
      preferVision: true,
      fallbackToText: true,
      expertPipeline: null,
      modalityRouting: null
    },
    legal: {
      minConfidence: 0.7,
      preferVision: true,
      fallbackToText: true,
      expertPipeline: null,
      modalityRouting: null
    },
    general: {
      minConfidence: 0.5,
      preferVision: false,
      fallbackToText: true,
      expertPipeline: null,
      modalityRouting: null
    }
  },
  expertPipelines: {
    medical: { status: 'active', minConfidence: 0.7 },
    financial: { status: 'planned', minConfidence: 0.75 },
    legal: { status: 'planned', minConfidence: 0.75 }
  },
  modalities: ['lab', 'radiology', 'prescription', 'unknown']
};
