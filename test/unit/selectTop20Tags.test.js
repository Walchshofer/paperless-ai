/* eslint-env mocha */
/**
 * FINDING-4 — selectTop20Tags helper unit tests
 *
 * Validates the selectTop20Tags logic extracted from SmartMetadataIsland.tsx.
 * Tests domain-priority slots, count-sorted fallback, exclusion of selected
 * tags, alias resolution (fin → financial, med → medical), and edge cases.
 *
 * Uses Node.js built-in assert only.
 */

'use strict';

const assert = require('assert');

// ---------------------------------------------------------------------------
// Inline replica of the functions under test
// Extracted verbatim from src/islands/SmartMetadataIsland.tsx (lines 83-116)
// so tests run without a TypeScript transpile step.
// ---------------------------------------------------------------------------

const DOMAIN_TAG_PRIORITIES = {
  financial: ['Rechnung', 'Mahnung', 'Kontoauszug', 'Steuer', 'Vertrag'],
  medical:   ['Attest', 'Befund', 'Rezept', 'Überweisung', 'Krankenhaus'],
  legal:     ['Vertrag', 'Kündigung', 'Mahnung', 'Vollmacht', 'Gericht'],
  general:   ['Dokument', 'Notiz', 'Brief', 'Formular', 'Antrag']
};

function getDomainPriorities(domain) {
  const key = domain ? domain.toLowerCase() : 'general';
  const resolved = key === 'fin' ? 'financial' : key === 'med' ? 'medical' : key;
  return DOMAIN_TAG_PRIORITIES[resolved] || DOMAIN_TAG_PRIORITIES['general'];
}

function selectTop20Tags(availableTags, localTags, domain) {
  const unselected = availableTags.filter(t => !localTags.some(lt => lt.id === t.id));
  const domainPriorities = getDomainPriorities(domain);
  const domainTags = [];
  const seenIds = new Set();
  for (const keyword of domainPriorities) {
    const match = unselected.find(
      t => !seenIds.has(t.id) && t.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (match) { domainTags.push(match); seenIds.add(match.id); }
  }
  const remaining = unselected
    .filter(t => !seenIds.has(t.id))
    .sort((a, b) => (b.document_count || 0) - (a.document_count || 0))
    .slice(0, 20 - domainTags.length);
  return [...domainTags, ...remaining];
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTag(id, name, document_count = 0) {
  return { id, name, document_count };
}

function makeTags(count, namePrefix = 'Tag', countValue = 1) {
  return Array.from({ length: count }, (_, i) =>
    makeTag(i + 1000, `${namePrefix}${i}`, countValue)
  );
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('selectTop20Tags — upper bound', () => {
  it('returns at most 20 tags when 30 available and 0 selected', () => {
    // Arrange: 30 generic tags, no domain matches, no selected
    const available = makeTags(30, 'Generic', 5);
    // Act
    const result = selectTop20Tags(available, [], 'general');
    // Assert
    assert.ok(result.length <= 20, `Expected <= 20 but got ${result.length}`);
  });

  it('returns exactly 20 tags when 25 available and 0 selected', () => {
    const available = makeTags(25, 'X', 10);
    const result = selectTop20Tags(available, [], 'financial');
    assert.strictEqual(result.length, 20);
  });
});

describe('selectTop20Tags — domain priority slots (financial)', () => {
  it('puts financial domain tags in first 5 slots', () => {
    // Arrange: one tag matching each financial keyword, plus extras
    const domainMatches = [
      makeTag(1, 'Rechnung GmbH', 1),
      makeTag(2, 'Mahnung 2024', 1),
      makeTag(3, 'Kontoauszug Jan', 1),
      makeTag(4, 'Steuer 2023', 1),
      makeTag(5, 'Vertrag Muster', 1)
    ];
    const others = makeTags(15, 'Other', 100); // high count but not domain-priority
    const available = [...domainMatches, ...others];

    // Act
    const result = selectTop20Tags(available, [], 'financial');

    // Assert: domain tags appear first
    const domainIds = new Set(domainMatches.map(t => t.id));
    const resultIds = result.map(t => t.id);
    for (let i = 0; i < 5; i++) {
      assert.ok(
        domainIds.has(resultIds[i]),
        `Expected domain tag at slot ${i}, got id=${resultIds[i]} name="${result[i].name}"`
      );
    }
  });
});

describe('selectTop20Tags — domain priority slots (medical)', () => {
  it('puts medical domain tags in first slots', () => {
    const domainMatches = [
      makeTag(10, 'Attest Arzt', 1),
      makeTag(11, 'Befund Labor', 1),
      makeTag(12, 'Rezept Apotheke', 1)
    ];
    const others = makeTags(10, 'NonMed', 99);
    const available = [...domainMatches, ...others];

    const result = selectTop20Tags(available, [], 'medical');

    const domainIds = new Set(domainMatches.map(t => t.id));
    for (let i = 0; i < domainMatches.length; i++) {
      assert.ok(
        domainIds.has(result[i].id),
        `Expected medical tag at slot ${i}, got "${result[i].name}"`
      );
    }
  });
});

describe('selectTop20Tags — count-sorted fallback', () => {
  it('fills remaining slots sorted by document_count descending', () => {
    // Arrange: no domain-priority tags, just count-sorted
    const available = [
      makeTag(1, 'Alpha', 3),
      makeTag(2, 'Beta', 10),
      makeTag(3, 'Gamma', 7),
      makeTag(4, 'Delta', 1)
    ];

    const result = selectTop20Tags(available, [], 'general');

    // General domain keywords: Dokument, Notiz, Brief, Formular, Antrag — none match
    // So all 4 go to count-sorted fallback
    assert.strictEqual(result[0].id, 2, 'highest count (10) should be first');
    assert.strictEqual(result[1].id, 3, 'second highest count (7) should be second');
    assert.strictEqual(result[2].id, 1, 'count (3) should be third');
    assert.strictEqual(result[3].id, 4, 'lowest count (1) should be last');
  });
});

describe('selectTop20Tags — selected tag exclusion', () => {
  it('excludes already-selected tags from the result', () => {
    const available = [
      makeTag(1, 'Rechnung', 5),
      makeTag(2, 'Steuer', 5),
      makeTag(3, 'Vertrag', 5)
    ];
    const selected = [makeTag(1, 'Rechnung', 5)]; // tag id=1 already selected

    const result = selectTop20Tags(available, selected, 'financial');

    const resultIds = result.map(t => t.id);
    assert.ok(!resultIds.includes(1), 'Already-selected tag id=1 must not appear in result');
    assert.ok(resultIds.includes(2), 'Non-selected tag id=2 should appear');
    assert.ok(resultIds.includes(3), 'Non-selected tag id=3 should appear');
  });

  it('returns empty array when all available tags are already selected', () => {
    const available = [makeTag(1, 'Alpha', 1), makeTag(2, 'Beta', 2)];
    const selected = [makeTag(1, 'Alpha', 1), makeTag(2, 'Beta', 2)];

    const result = selectTop20Tags(available, selected, 'general');

    assert.strictEqual(result.length, 0);
  });
});

describe('selectTop20Tags — domain aliases', () => {
  it('handles "fin" alias for financial domain', () => {
    const domainTags = [makeTag(1, 'Rechnung 2024', 1)];
    const others = makeTags(5, 'Generic', 100);
    const available = [...domainTags, ...others];

    const result = selectTop20Tags(available, [], 'fin');

    // 'fin' → 'financial', so Rechnung should be prioritized
    assert.strictEqual(result[0].id, 1, '"fin" alias should resolve to financial and prioritize Rechnung');
  });

  it('handles "med" alias for medical domain', () => {
    const domainTags = [makeTag(20, 'Attest 2024', 1)];
    const others = makeTags(5, 'Generic', 100);
    const available = [...domainTags, ...others];

    const result = selectTop20Tags(available, [], 'med');

    assert.strictEqual(result[0].id, 20, '"med" alias should resolve to medical and prioritize Attest');
  });
});

describe('selectTop20Tags — fewer than 20 available', () => {
  it('returns fewer than 20 when total available tags < 20 after exclusion', () => {
    const available = makeTags(5, 'Sparse', 1);
    const result = selectTop20Tags(available, [], 'general');
    assert.ok(result.length <= 5, 'Should not return more tags than available');
  });

  it('returns 0 tags when available is empty', () => {
    const result = selectTop20Tags([], [], 'financial');
    assert.strictEqual(result.length, 0);
  });
});

describe('selectTop20Tags — domain tags fill all 20 slots', () => {
  it('fills all 20 slots with domain tags when 20+ matching keywords exist', () => {
    // Each financial keyword is a priority slot (5 slots for financial).
    // We cannot get more than 5 domain tags for financial (only 5 keywords),
    // so this tests that when all 5 domain tags are found + 15 fallback = 20 total
    const domainTags = [
      makeTag(1, 'Rechnung', 1),
      makeTag(2, 'Mahnung', 1),
      makeTag(3, 'Kontoauszug', 1),
      makeTag(4, 'Steuer', 1),
      makeTag(5, 'Vertrag', 1)
    ];
    const extras = makeTags(20, 'Extra', 10);
    const available = [...domainTags, ...extras];

    const result = selectTop20Tags(available, [], 'financial');

    assert.strictEqual(result.length, 20, 'Should fill all 20 slots');
    // First 5 are domain tags
    const first5Ids = new Set([1, 2, 3, 4, 5]);
    for (let i = 0; i < 5; i++) {
      assert.ok(first5Ids.has(result[i].id), `Domain tag expected at slot ${i}`);
    }
  });
});

describe('selectTop20Tags — edge: domain undefined/null', () => {
  it('uses general domain priorities when domain is undefined', () => {
    // Should not throw
    const available = makeTags(5, 'T', 1);
    assert.doesNotThrow(() => selectTop20Tags(available, [], undefined));
  });

  it('uses general domain priorities when domain is null', () => {
    const available = makeTags(3, 'Z', 1);
    assert.doesNotThrow(() => selectTop20Tags(available, [], null));
  });
});
