import { z } from 'zod';

export const HistoryTagSchema = z.object({
  id: z.number().int(),
  name: z.string()
});

export const HistoryFiltersSchema = z.object({
  tags: z.array(HistoryTagSchema).optional().default([]),
  correspondents: z.array(z.string()).optional().default([])
});

export const HistorySortSchema = z.object({
  column: z.enum(['document_id', 'title', 'created_at', 'tags', 'correspondent'])
    .optional()
    .default('created_at'),
  dir: z.enum(['asc', 'desc']).optional().default('desc')
});

export const HistoryQuerySchema = z.object({
  search: z.string().optional().default(''),
  tag: z.string().nullable().optional().default(null),
  correspondent: z.string().nullable().optional().default(null),
  sort: HistorySortSchema.optional().default({
    column: 'created_at',
    dir: 'desc'
  }),
  page: z.number().int().nonnegative().optional().default(0),
  pageSize: z.number().int().positive().optional().default(10)
});

export const HistoryManagerSchema = z.object({
  filters: HistoryFiltersSchema,
  initialQuery: HistoryQuerySchema.optional().default({})
});

export type HistoryManagerContract = z.infer<typeof HistoryManagerSchema>;
