#!/usr/bin/env node
'use strict';

const paperlessService = require('../services/paperlessService');

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TOP = 15;

function parseArgs(argv) {
  const options = {
    limit: null,
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
Usage: node scripts/analyze_tags.js [options]

Options:
  --limit <n>      Limit number of documents analyzed
  --page-size <n>  Page size for list API (default ${DEFAULT_PAGE_SIZE})
  --top <n>        Show top N tags/sets (default ${DEFAULT_TOP})
  --json           Output results as JSON
  -h, --help       Show this help
`.trim());
}

async function fetchDocumentList(pageSize, limit) {
  let page = 1;
  let hasMore = true;
  const documents = [];

  while (hasMore) {
    const params = {
      page,
      page_size: pageSize,
      fields: 'id,tags'
    };

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

function incrementMap(map, key, delta = 1) {
  map.set(key, (map.get(key) || 0) + delta);
}

function buildTagBuckets() {
  return [
    { label: '0 tags', min: 0, max: 1 },
    { label: '1 tag', min: 1, max: 2 },
    { label: '2 tags', min: 2, max: 3 },
    { label: '3 tags', min: 3, max: 4 },
    { label: '4-5 tags', min: 4, max: 6 },
    { label: '6-10 tags', min: 6, max: 11 },
    { label: '11+ tags', min: 11, max: Infinity }
  ];
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

  let documents;
  try {
    documents = await fetchDocumentList(options.pageSize, options.limit);
  } catch (error) {
    console.warn(`[WARN] List API failed (${error.message}). Falling back to full document list.`);
    const fallbackDocs = await paperlessService.getAllDocumentsUnfiltered();
    documents = Number.isFinite(options.limit)
      ? fallbackDocs.slice(0, options.limit)
      : fallbackDocs;
  }

  const tags = await paperlessService.getTags();
  const tagNameById = new Map(tags.map(tag => [tag.id, tag.name]));

  const tagUsage = new Map();
  const tagSetUsage = new Map();
  const tagCountUsage = new Map();
  const unknownTagIds = new Set();

  let docsWithTags = 0;
  let totalTagAssignments = 0;

  for (const doc of documents) {
    const tagIds = Array.isArray(doc.tags) ? doc.tags : [];
    const tagCount = tagIds.length;
    incrementMap(tagCountUsage, tagCount);
    totalTagAssignments += tagCount;

    if (tagCount > 0) {
      docsWithTags += 1;
    }

    const tagNames = tagIds.map(id => {
      const name = tagNameById.get(id);
      if (!name) {
        unknownTagIds.add(id);
        return `unknown:${id}`;
      }
      return name;
    });

    const uniqueNames = Array.from(new Set(tagNames));
    uniqueNames.forEach(name => incrementMap(tagUsage, name));

    const tagSetKey = uniqueNames.length > 0
      ? uniqueNames.sort((a, b) => a.localeCompare(b)).join('|')
      : '(no tags)';
    incrementMap(tagSetUsage, tagSetKey);
  }

  const uniqueTagsUsed = tagUsage.size;
  const totalDocs = documents.length;

  const tagBuckets = buildTagBuckets().map(bucket => ({
    label: bucket.label,
    count: Array.from(tagCountUsage.entries())
      .filter(([count]) => count >= bucket.min && count < bucket.max)
      .reduce((acc, [, value]) => acc + value, 0)
  }));

  const topTags = Array.from(tagUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.top)
    .map(([name, count]) => ({ name, count }));

  const topTagSets = Array.from(tagSetUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.top)
    .map(([tagSet, count]) => ({ tagSet, count }));

  if (options.json) {
    console.log(JSON.stringify({
      totalDocs,
      docsWithTags,
      totalTagAssignments,
      uniqueTagsUsed,
      unknownTagIds: Array.from(unknownTagIds),
      tagBuckets,
      topTags,
      topTagSets
    }, null, 2));
    return;
  }

  console.log('Tag set analysis');
  console.log('----------------');
  console.log(`Documents analyzed: ${totalDocs}`);
  console.log(`Documents with tags: ${docsWithTags}`);
  console.log(`Documents without tags: ${totalDocs - docsWithTags}`);
  console.log(`Total tag assignments: ${totalTagAssignments}`);
  console.log(`Unique tags referenced: ${uniqueTagsUsed}`);
  if (unknownTagIds.size > 0) {
    console.log(`Unknown tag IDs: ${Array.from(unknownTagIds).join(', ')}`);
  }

  console.log('\nTag count distribution:');
  for (const bucket of tagBuckets) {
    console.log(`- ${bucket.label}: ${bucket.count}`);
  }

  if (topTags.length > 0) {
    console.log(`\nTop ${topTags.length} tags:`);
    for (const entry of topTags) {
      console.log(`- ${entry.name}: ${entry.count}`);
    }
  }

  if (topTagSets.length > 0) {
    console.log(`\nTop ${topTagSets.length} tag sets:`);
    for (const entry of topTagSets) {
      console.log(`- ${entry.tagSet}: ${entry.count}`);
    }
  }
}

main().catch(error => {
  console.error(`[ERROR] Tag analysis failed: ${error.message}`);
  process.exitCode = 1;
});
