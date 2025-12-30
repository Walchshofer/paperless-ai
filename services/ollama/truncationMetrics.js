const stats = {
  totalRequests: 0,
  promptTruncations: 0,
  responseTruncations: 0,
  thinkingTokens: 0,
  thinkingSamples: 0,
  byStage: {},
  byModel: {},
  byStageModel: {}
};

function getStage(stage) {
  const key = stage || 'unknown';
  if (!stats.byStage[key]) {
    stats.byStage[key] = {
      totalRequests: 0,
      promptTruncations: 0,
      responseTruncations: 0,
      thinkingTokens: 0,
      thinkingSamples: 0
    };
  }
  return stats.byStage[key];
}

function getModel(model) {
  const key = model || 'unknown';
  if (!stats.byModel[key]) {
    stats.byModel[key] = {
      totalRequests: 0,
      promptTruncations: 0,
      responseTruncations: 0,
      thinkingTokens: 0,
      thinkingSamples: 0
    };
  }
  return stats.byModel[key];
}

function getStageModel(stage, model) {
  const stageKey = stage || 'unknown';
  const modelKey = model || 'unknown';
  if (!stats.byStageModel[stageKey]) {
    stats.byStageModel[stageKey] = {};
  }
  if (!stats.byStageModel[stageKey][modelKey]) {
    stats.byStageModel[stageKey][modelKey] = {
      totalRequests: 0,
      promptTruncations: 0,
      responseTruncations: 0,
      thinkingTokens: 0,
      thinkingSamples: 0
    };
  }
  return stats.byStageModel[stageKey][modelKey];
}

function recordRequest(stage, model) {
  stats.totalRequests += 1;
  const stageStats = getStage(stage);
  stageStats.totalRequests += 1;
  const modelStats = getModel(model);
  modelStats.totalRequests += 1;
  const stageModelStats = getStageModel(stage, model);
  stageModelStats.totalRequests += 1;
}

function recordPromptTruncation(stage, model) {
  stats.promptTruncations += 1;
  const stageStats = getStage(stage);
  stageStats.promptTruncations += 1;
  const modelStats = getModel(model);
  modelStats.promptTruncations += 1;
  const stageModelStats = getStageModel(stage, model);
  stageModelStats.promptTruncations += 1;
}

function recordResponseTruncation(stage, model) {
  stats.responseTruncations += 1;
  const stageStats = getStage(stage);
  stageStats.responseTruncations += 1;
  const modelStats = getModel(model);
  modelStats.responseTruncations += 1;
  const stageModelStats = getStageModel(stage, model);
  stageModelStats.responseTruncations += 1;
}

function recordThinkingTokens(stage, model, tokens) {
  const count = Number.isFinite(tokens) ? Math.max(0, Math.floor(tokens)) : 0;
  stats.thinkingTokens += count;
  stats.thinkingSamples += 1;
  const stageStats = getStage(stage);
  stageStats.thinkingTokens += count;
  stageStats.thinkingSamples += 1;
  const modelStats = getModel(model);
  modelStats.thinkingTokens += count;
  modelStats.thinkingSamples += 1;
  const stageModelStats = getStageModel(stage, model);
  stageModelStats.thinkingTokens += count;
  stageModelStats.thinkingSamples += 1;
}

function buildRates(counts) {
  const total = counts.totalRequests || 0;
  const thinkingSamples = counts.thinkingSamples || 0;
  return {
    promptTruncationRate: total ? counts.promptTruncations / total : 0,
    responseTruncationRate: total ? counts.responseTruncations / total : 0,
    averageThinkingTokens: thinkingSamples
      ? counts.thinkingTokens / thinkingSamples
      : 0
  };
}

function getStats() {
  const byStage = {};
  for (const [stage, counts] of Object.entries(stats.byStage)) {
    byStage[stage] = {
      ...counts,
      ...buildRates(counts)
    };
  }
  const byModel = {};
  for (const [model, counts] of Object.entries(stats.byModel)) {
    byModel[model] = {
      ...counts,
      ...buildRates(counts)
    };
  }
  const byStageModel = {};
  for (const [stage, models] of Object.entries(stats.byStageModel)) {
    const entries = {};
    for (const [model, counts] of Object.entries(models || {})) {
      entries[model] = {
        ...counts,
        ...buildRates(counts)
      };
    }
    byStageModel[stage] = entries;
  }
  return {
    totalRequests: stats.totalRequests,
    promptTruncations: stats.promptTruncations,
    responseTruncations: stats.responseTruncations,
    thinkingTokens: stats.thinkingTokens,
    thinkingSamples: stats.thinkingSamples,
    ...buildRates(stats),
    byStage,
    byModel,
    byStageModel
  };
}

function resetStats() {
  stats.totalRequests = 0;
  stats.promptTruncations = 0;
  stats.responseTruncations = 0;
  stats.thinkingTokens = 0;
  stats.thinkingSamples = 0;
  stats.byStage = {};
  stats.byModel = {};
  stats.byStageModel = {};
}

module.exports = {
  recordRequest,
  recordPromptTruncation,
  recordResponseTruncation,
  recordThinkingTokens,
  getStats,
  resetStats
};
