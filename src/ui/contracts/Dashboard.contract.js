const { z } = require('zod');

const TokenDistributionItemSchema = z.object({
  range: z.string(),
  count: z.number().int().nonnegative(),
});

const DocumentTypeItemSchema = z.object({
  type: z.string(),
  count: z.number().int().nonnegative(),
});

const DashboardVmSchema = z.object({
  version: z.string(),
  paperless_data: z.object({
    tagCount: z.number().int().nonnegative().default(0),
    correspondentCount: z.number().int().nonnegative().default(0),
    documentCount: z.number().int().nonnegative().default(0),
    processedDocumentCount: z.number().int().nonnegative().default(0),
    processingTimeStats: z.array(z.unknown()).default([]),
    tokenDistribution: z.array(TokenDistributionItemSchema).default([]),
    documentTypes: z.array(DocumentTypeItemSchema).default([]),
  }),
  openai_data: z.object({
    averagePromptTokens: z.number().nonnegative().default(0),
    averageCompletionTokens: z.number().nonnegative().default(0),
    averageTotalTokens: z.number().nonnegative().default(0),
    tokensOverall: z.number().nonnegative().default(0),
  }),
});

module.exports = {
  DashboardVmSchema,
};
