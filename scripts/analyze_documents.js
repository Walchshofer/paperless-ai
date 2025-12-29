#!/usr/bin/env node
'use strict';

const paperlessService = require('../services/paperlessService');

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TOP = 10;

const SIZE_FIELDS = [
  'archive_size',
  'original_file_size',
  'file_size',
  'archive_file_size',
  'original_size',
  'file_size_bytes',
  'archive_file_size_bytes'
];

function parseArgs(argv) {
  const options = {
    limit: null,
    concurrency: DEFAULT_CONCURRENCY,
    pageSize: DEFAULT_PAGE_SIZE,
    top: DEFAULT_TOP,
    json: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--limit') {
      options.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--concurrency') {
      options.concurrency = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--page-size') {
      options.pageSize = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--top') {
      options.top = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: node scripts/analyze_documents.js [options]

Options:
  --limit <n>        Limit number of documents analyzed
  --concurrency <n>  Parallel document fetches (default ${DEFAULT_CONCURRENCY})
  --page-size <n>    Page size for list API (default ${DEFAULT_PAGE_SIZE})
  --top <n>          Show top N largest docs (default ${DEFAULT_TOP})
  --json             Output results as JSON
  -h, --help         Show this help
`.trim());
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

function parseSizeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const match = trimmed.match(/^([\d.]+)\s*(b|kb|mb|gb|tb)$/i);
    if (!match) return null;
    const magnitude = Number.parseFloat(match[1]);
    if (!Number.isFinite(magnitude)) return null;

    const unit = match[2].toLowerCase();
    const multipliers = {
      b: 1,
      kb: 1024,
      mb: 1024 ** 2,
      gb: 1024 ** 3,
      tb: 1024 ** 4
    };
    return Math.round(magnitude * multipliers[unit]);
  }

  return null;
}

function extractSize(doc) {
  for (const field of SIZE_FIELDS) {
    if (doc && Object.prototype.hasOwnProperty.call(doc, field)) {
      const value = parseSizeValue(doc[field]);
      if (Number.isFinite(value)) {
        return { bytes: value, field };
      }
    }
  }

  if (doc && typeof doc === 'object') {
    for (const [key, rawValue] of Object.entries(doc)) {
      if (!key.toLowerCase().includes('size')) continue;
      const value = parseSizeValue(rawValue);
      if (Number.isFinite(value)) {
        return { bytes: value, field: key };
      }
    }
  }

  return { bytes: null, field: null };
}

async function fetchDocumentList(fields, pageSize, limit) {
  let page = 1;
  let hasMore = true;
  const documents = [];

  while (hasMore) {
    const params = { page, page_size: pageSize };
    if (fields) {
      params.fields = fields;
    }

    const response = await paperlessService.client.get('/documents/', { params });
    if (!response?.data?.results || !Array.isArray(response.data.results)) {
      throw new Error(`Invalid response while listing documents page ${page}`);
    }

    documents.push(...response.data.results);
    page += 1;
    hasMore = response.data.next !== null;
    if (Number.isFinite(limit) && documents.length >= limit) {
      hasMore = false;
    }
  }

  return Number.isFinite(limit) ? documents.slice(0, limit) : documents;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) break;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

async function fetchDocumentDetails(ids, concurrency) {
  return mapWithConcurrency(ids, concurrency, async (id) => {
    try {
      return await paperlessService.getDocument(id);
    } catch (error) {
      console.error(`[WARN] Failed to fetch document ${id}: ${error.message}`);
      return null;
    }
  });
}

function buildBuckets() {
  return [
    { label: '<100KB', min: 0, max: 100 * 1024 },
    { label: '100KB-1MB', min: 100 * 1024, max: 1024 * 1024 },
    { label: '1-5MB', min: 1024 * 1024, max: 5 * 1024 * 1024 },
    { label: '5-25MB', min: 5 * 1024 * 1024, max: 25 * 1024 * 1024 },
    { label: '25-100MB', min: 25 * 1024 * 1024, max: 100 * 1024 * 1024 },
    { label: '100MB+', min: 100 * 1024 * 1024, max: Infinity }
  ];
}

function summarizeSizes(entries) {
  const known = entries.filter(entry => Number.isFinite(entry.sizeBytes));
  const sizes = known.map(entry => entry.sizeBytes).sort((a, b) => a - b);
  if (sizes.length === 0) {
    return {
      count: entries.length,
      knownCount: 0,
      min: null,
      max: null,
      avg: null,
      median: null
    };
  }

  const sum = sizes.reduce((acc, value) => acc + value, 0);
  const mid = Math.floor(sizes.length / 2);
  const median = sizes.length % 2 === 0
    ? (sizes[mid - 1] + sizes[mid]) / 2
    : sizes[mid];

  return {
    count: entries.length,
    knownCount: sizes.length,
    min: sizes[0],
    max: sizes[sizes.length - 1],
    avg: sum / sizes.length,
    median
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  paperlessService.initialize();
  if (!paperlessService.client) {
    console.error('Paperless API client not initialized. Check PAPERLESS_API_URL and PAPERLESS_API_TOKEN.');
    process.exitCode = 1;
    return;
  }

  const fields = [
    'id',
    'title',
    'original_file_name',
    'archive_file_name',
    'original_file_size',
    'archive_size',
    'file_size',
    'page_count',
    'created',
    'added'
  ].join(',');

  let documents;
  try {
    documents = await fetchDocumentList(fields, options.pageSize, options.limit);
  } catch (error) {
    console.warn(`[WARN] List API failed (${error.message}). Falling back to per-document fetch.`);
    const baseDocs = await paperlessService.getAllDocumentsUnfiltered();
    const ids = (Number.isFinite(options.limit) ? baseDocs.slice(0, options.limit) : baseDocs)
      .map(doc => Number(doc.id))
      .filter(id => Number.isInteger(id));
    documents = await fetchDocumentDetails(ids, options.concurrency);
  }

  const entries = documents
    .filter(Boolean)
    .map(doc => {
      const sizeInfo = extractSize(doc);
      return {
        id: doc.id,
        title: doc.title || null,
        filename: doc.original_file_name || doc.archive_file_name || null,
        sizeBytes: sizeInfo.bytes,
        sizeField: sizeInfo.field
      };
    });

  const summary = summarizeSizes(entries);
  const buckets = buildBuckets().map(bucket => ({
    label: bucket.label,
    count: entries.filter(entry => (
      Number.isFinite(entry.sizeBytes) &&
      entry.sizeBytes >= bucket.min &&
      entry.sizeBytes < bucket.max
    )).length
  }));

  const largest = entries
    .filter(entry => Number.isFinite(entry.sizeBytes))
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, options.top)
    .map(entry => ({
      id: entry.id,
      title: entry.title,
      filename: entry.filename,
      sizeBytes: entry.sizeBytes,
      size: formatBytes(entry.sizeBytes),
      sizeField: entry.sizeField
    }));

  if (options.json) {
    console.log(JSON.stringify({
      summary,
      buckets,
      largest
    }, null, 2));
    return;
  }

  console.log('Document size analysis');
  console.log('-----------------------');
  console.log(`Documents analyzed: ${summary.count}`);
  console.log(`Sizes known: ${summary.knownCount}`);
  console.log(`Sizes unknown: ${summary.count - summary.knownCount}`);
  if (summary.knownCount > 0) {
    console.log(`Min size: ${formatBytes(summary.min)}`);
    console.log(`Max size: ${formatBytes(summary.max)}`);
    console.log(`Average: ${formatBytes(summary.avg)}`);
    console.log(`Median: ${formatBytes(summary.median)}`);
  }

  console.log('\nSize buckets:');
  for (const bucket of buckets) {
    console.log(`- ${bucket.label}: ${bucket.count}`);
  }

  if (largest.length > 0) {
    console.log(`\nTop ${largest.length} largest documents:`);
    for (const entry of largest) {
      console.log(`- ${entry.id} ${entry.size} ${entry.filename || entry.title || ''}`.trim());
    }
  }
}

main().catch(error => {
  console.error(`[ERROR] Document size analysis failed: ${error.message}`);
  process.exitCode = 1;
});
