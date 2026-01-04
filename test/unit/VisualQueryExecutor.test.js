/**
 * Unit Tests for VisualQueryExecutor (Phase 4)
 *
 * Tests dynamic K calculation, IoU deduplication, confidence fusion,
 * circuit breaker integration, and query execution logic.
 */

const assert = require('assert');
const { VisualQueryExecutor, BASE_K_VALUES, DEFAULT_CONFIG } = require('../../services/experts/VisualQueryExecutor');

describe('VisualQueryExecutor', () => {
    let executor;
    let mockVisualSearchClient;

    beforeEach(() => {
        // Mock Visual Search Client
        mockVisualSearchClient = {
            search: async () => ({
                bounding_boxes: [],
                scores: []
            }),
            isAvailable: async () => true
        };

        executor = new VisualQueryExecutor(mockVisualSearchClient);
    });

    afterEach(() => {
        executor.resetStats();
    });

    describe('Dynamic K Calculation', () => {
        it('should calculate correct base K for field_extraction', () => {
            const query = {
                expected_element_type: 'field_extraction',
                confidence: 1.0,
                rarity_factor: 0
            };

            const k = executor._calculateDynamicK(query);
            assert.strictEqual(k, 3, 'Base K for field_extraction should be 3');
        });

        it('should calculate correct base K for validation', () => {
            const query = {
                expected_element_type: 'validation',
                confidence: 1.0,
                rarity_factor: 0
            };

            const k = executor._calculateDynamicK(query);
            assert.strictEqual(k, 5, 'Base K for validation should be 5');
        });

        it('should calculate correct base K for exploration', () => {
            const query = {
                expected_element_type: 'exploration',
                confidence: 1.0,
                rarity_factor: 0
            };

            const k = executor._calculateDynamicK(query);
            assert.strictEqual(k, 10, 'Base K for exploration should be 10');
        });

        it('should increase K for low confidence fields', () => {
            const highConfQuery = {
                expected_element_type: 'field_extraction',
                confidence: 0.9,
                rarity_factor: 0
            };

            const lowConfQuery = {
                expected_element_type: 'field_extraction',
                confidence: 0.3,
                rarity_factor: 0
            };

            const highK = executor._calculateDynamicK(highConfQuery);
            const lowK = executor._calculateDynamicK(lowConfQuery);

            assert.ok(lowK > highK, 'Lower confidence should result in higher K');
        });

        it('should increase K for rare fields', () => {
            const commonQuery = {
                expected_element_type: 'field_extraction',
                confidence: 0.8,
                rarity_factor: 0.1  // Common field
            };

            const rareQuery = {
                expected_element_type: 'field_extraction',
                confidence: 0.8,
                rarity_factor: 0.9  // Rare field
            };

            const commonK = executor._calculateDynamicK(commonQuery);
            const rareK = executor._calculateDynamicK(rareQuery);

            assert.ok(rareK > commonK, 'Rarer fields should result in higher K');
        });

        it('should apply combined confidence and rarity factors', () => {
            const query = {
                expected_element_type: 'field_extraction',
                confidence: 0.6,      // Low confidence → factor 1.2
                rarity_factor: 0.3    // Some rarity → factor 1.3
            };

            // Formula: K = 3 * 1.2 * 1.3 = 4.68 → 5
            const k = executor._calculateDynamicK(query);
            assert.strictEqual(k, 5, 'Combined factors should multiply correctly');
        });

        it('should return at least K=1', () => {
            const query = {
                expected_element_type: 'field_extraction',
                confidence: 1.0,
                rarity_factor: 0
            };

            const k = executor._calculateDynamicK(query);
            assert.ok(k >= 1, 'K should always be at least 1');
        });

        it('should round K to nearest integer', () => {
            const query = {
                expected_element_type: 'field_extraction',
                confidence: 0.5,
                rarity_factor: 0.2
            };

            const k = executor._calculateDynamicK(query);
            assert.strictEqual(k, Math.round(k), 'K should be an integer');
        });
    });

    describe('IoU Calculation', () => {
        it('should calculate IoU=1.0 for identical boxes', () => {
            const box = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
            const iou = executor._calculateIoU(box, box);
            assert.strictEqual(iou, 1.0, 'Identical boxes should have IoU=1.0');
        });

        it('should calculate IoU=0.0 for non-overlapping boxes', () => {
            const box1 = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
            const box2 = { x: 0.5, y: 0.5, width: 0.2, height: 0.2 };

            const iou = executor._calculateIoU(box1, box2);
            assert.strictEqual(iou, 0.0, 'Non-overlapping boxes should have IoU=0.0');
        });

        it('should calculate correct IoU for partially overlapping boxes', () => {
            const box1 = { x: 0.0, y: 0.0, width: 0.4, height: 0.4 };
            const box2 = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };

            // Intersection: 0.2 * 0.2 = 0.04
            // Union: 0.16 + 0.16 - 0.04 = 0.28
            // IoU: 0.04 / 0.28 ≈ 0.143
            const iou = executor._calculateIoU(box1, box2);
            assert.ok(iou > 0.14 && iou < 0.15, 'Partial overlap IoU should be ~0.143');
        });

        it('should handle edge-touching boxes (IoU=0)', () => {
            const box1 = { x: 0.0, y: 0.0, width: 0.5, height: 0.5 };
            const box2 = { x: 0.5, y: 0.0, width: 0.5, height: 0.5 };

            const iou = executor._calculateIoU(box1, box2);
            assert.strictEqual(iou, 0.0, 'Edge-touching boxes should have IoU=0.0');
        });

        it('should handle boxes where one contains the other', () => {
            const large = { x: 0.0, y: 0.0, width: 0.8, height: 0.8 };
            const small = { x: 0.2, y: 0.2, width: 0.2, height: 0.2 };

            const iou = executor._calculateIoU(large, small);

            // Intersection: 0.04 (small box area)
            // Union: 0.64 (large box area)
            // IoU: 0.04 / 0.64 = 0.0625
            assert.ok(iou > 0.06 && iou < 0.07, 'Containment IoU should be ~0.0625');
        });

        it('should be symmetric (IoU(A,B) = IoU(B,A))', () => {
            const box1 = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };
            const box2 = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };

            const iou1 = executor._calculateIoU(box1, box2);
            const iou2 = executor._calculateIoU(box2, box1);

            assert.strictEqual(iou1, iou2, 'IoU should be symmetric');
        });
    });

    describe('Bounding Box Deduplication', () => {
        it('should remove duplicate boxes above IoU threshold', () => {
            const queryResults = [
                {
                    success: true,
                    query: { field_target: 'field1' },
                    bounding_boxes: [
                        { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                        { x: 0.11, y: 0.11, width: 0.2, height: 0.2 }  // Very similar (IoU > 0.7)
                    ],
                    scores: [0.9, 0.8]
                }
            ];

            const deduped = executor._deduplicateBoundingBoxes(queryResults);

            assert.strictEqual(deduped.length, 1, 'Should deduplicate similar boxes');
            assert.strictEqual(deduped[0].score, 0.9, 'Should keep higher-scoring box');
        });

        it('should keep boxes below IoU threshold', () => {
            const queryResults = [
                {
                    success: true,
                    query: { field_target: 'field1' },
                    bounding_boxes: [
                        { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                        { x: 0.5, y: 0.5, width: 0.2, height: 0.2 }  // Non-overlapping
                    ],
                    scores: [0.9, 0.8]
                }
            ];

            const deduped = executor._deduplicateBoundingBoxes(queryResults);

            assert.strictEqual(deduped.length, 2, 'Should keep non-overlapping boxes');
        });

        it('should prioritize higher-scoring boxes during deduplication', () => {
            const queryResults = [
                {
                    success: true,
                    query: { field_target: 'field1' },
                    bounding_boxes: [
                        { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                        { x: 0.11, y: 0.11, width: 0.2, height: 0.2 }
                    ],
                    scores: [0.7, 0.95]  // Second box has higher score
                }
            ];

            const deduped = executor._deduplicateBoundingBoxes(queryResults);

            assert.strictEqual(deduped.length, 1, 'Should deduplicate');
            assert.strictEqual(deduped[0].score, 0.95, 'Should keep higher-scoring box');
        });

        it('should handle empty results', () => {
            const queryResults = [];
            const deduped = executor._deduplicateBoundingBoxes(queryResults);

            assert.strictEqual(deduped.length, 0, 'Should handle empty results');
        });

        it('should handle failed queries with no bounding boxes', () => {
            const queryResults = [
                { success: false, bounding_boxes: [] }
            ];

            const deduped = executor._deduplicateBoundingBoxes(queryResults);

            assert.strictEqual(deduped.length, 0, 'Should handle failed queries');
        });

        it('should use default IoU threshold of 0.7', () => {
            assert.strictEqual(
                executor.config.iouThreshold,
                0.7,
                'Default IoU threshold should be 0.7'
            );
        });
    });

    describe('Confidence Score Fusion', () => {
        it('should fuse extraction and visual confidence with 0.6/0.4 weights', () => {
            const extractionResults = {
                fields: [
                    { name: 'invoice_number', value: 'INV-001', confidence: 0.8 }
                ]
            };

            const visualResults = [
                {
                    query: { field_target: 'invoice_number' },
                    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                    score: 0.9
                }
            ];

            const merged = executor._mergeResults(extractionResults, visualResults, []);

            const field = merged.find(f => f.name === 'invoice_number');

            // Expected: 0.8 * 0.6 + 0.9 * 0.4 = 0.48 + 0.36 = 0.84
            assert.ok(field.confidence > 0.83 && field.confidence < 0.85, 'Should fuse with 0.6/0.4 weights');
        });

        it('should mark fields with visual confirmation', () => {
            const extractionResults = {
                fields: [
                    { name: 'invoice_number', value: 'INV-001', confidence: 0.8 }
                ]
            };

            const visualResults = [
                {
                    query: { field_target: 'invoice_number' },
                    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                    score: 0.9
                }
            ];

            const merged = executor._mergeResults(extractionResults, visualResults, []);

            const field = merged.find(f => f.name === 'invoice_number');

            assert.strictEqual(field.visual_confirmation, true, 'Should mark visual confirmation');
            assert.ok(field.bounding_box, 'Should include bounding box');
        });

        it('should create newly discovered fields from visual-only results', () => {
            const extractionResults = {
                fields: [
                    { name: 'invoice_number', value: 'INV-001', confidence: 0.8 }
                ]
            };

            const visualResults = [
                {
                    query: { field_target: 'invoice_date' },  // Not in extraction
                    box: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
                    score: 0.85
                }
            ];

            const merged = executor._mergeResults(extractionResults, visualResults, []);

            const newField = merged.find(f => f.name === 'invoice_date');

            assert.ok(newField, 'Should create newly discovered field');
            assert.strictEqual(newField.newly_discovered, true);
            assert.strictEqual(newField.confidence, 0.85, 'Should use visual confidence');
        });

        it('should preserve extraction-only fields without visual confirmation', () => {
            const extractionResults = {
                fields: [
                    { name: 'invoice_number', value: 'INV-001', confidence: 0.8 },
                    { name: 'vendor_name', value: 'Acme Corp', confidence: 0.9 }
                ]
            };

            const visualResults = [
                {
                    query: { field_target: 'invoice_number' },
                    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
                    score: 0.9
                }
            ];

            const merged = executor._mergeResults(extractionResults, visualResults, []);

            const vendorField = merged.find(f => f.name === 'vendor_name');

            assert.ok(vendorField, 'Should preserve extraction-only fields');
            assert.strictEqual(vendorField.visual_confirmation, false);
            assert.strictEqual(vendorField.confidence, 0.9, 'Should keep original confidence');
        });

        it('should use correct default weights (0.6 extraction, 0.4 visual)', () => {
            assert.strictEqual(executor.config.extractionWeight, 0.6);
            assert.strictEqual(executor.config.visualWeight, 0.4);
        });
    });

    describe('Graceful Degradation', () => {
        it('should return extraction-only results when circuit breaker is OPEN', async () => {
            // Force circuit breaker to OPEN state
            executor.circuitBreaker.state = 'OPEN';

            const result = await executor.executeQueries({
                visualQueries: [{ question: 'Test', field_target: 'test_field' }],
                extractionResults: {
                    fields: [{ name: 'test_field', value: 'value', confidence: 0.8 }]
                },
                documentMetadata: { id: 'test-001' },
                documentImage: 'base64-image-data'
            });

            assert.strictEqual(result.execution_metadata.fallback, true);
            assert.strictEqual(result.execution_metadata.fallback_reason, 'circuit_breaker_open');
            assert.strictEqual(result.fields[0].visual_confirmation, false);
        });

        it('should return extraction-only results when no queries provided', async () => {
            const result = await executor.executeQueries({
                visualQueries: [],
                extractionResults: {
                    fields: [{ name: 'test_field', value: 'value', confidence: 0.8 }]
                },
                documentMetadata: { id: 'test-002' },
                documentImage: 'base64-image-data'
            });

            assert.strictEqual(result.execution_metadata.fallback, true);
            assert.strictEqual(result.execution_metadata.fallback_reason, 'no_queries');
        });

        it('should return extraction-only results when no document image', async () => {
            const result = await executor.executeQueries({
                visualQueries: [{ question: 'Test', field_target: 'test_field' }],
                extractionResults: {
                    fields: [{ name: 'test_field', value: 'value', confidence: 0.8 }]
                },
                documentMetadata: { id: 'test-003' },
                documentImage: null  // No image
            });

            assert.strictEqual(result.execution_metadata.fallback, true);
            assert.strictEqual(result.execution_metadata.fallback_reason, 'no_image');
        });
    });

    describe('Overlay Calculation', () => {
        it('should calculate overlay positions in normalized coordinates', () => {
            const visualResults = [
                {
                    query: { field_target: 'invoice_number', expected_element_type: 'field_extraction' },
                    box: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
                    score: 0.9
                }
            ];

            const overlays = executor._calculateOverlays(visualResults);

            assert.strictEqual(overlays.length, 1);
            assert.strictEqual(overlays[0].field_name, 'invoice_number');
            assert.strictEqual(overlays[0].position.x, 0.1);
            assert.strictEqual(overlays[0].position.y, 0.2);
            assert.strictEqual(overlays[0].position.width, 0.3);
            assert.strictEqual(overlays[0].position.height, 0.05);
            assert.strictEqual(overlays[0].confidence, 0.9);
        });

        it('should include query type in overlay metadata', () => {
            const visualResults = [
                {
                    query: { field_target: 'test_field', expected_element_type: 'validation' },
                    box: { x: 0.5, y: 0.5, width: 0.2, height: 0.1 },
                    score: 0.85
                }
            ];

            const overlays = executor._calculateOverlays(visualResults);

            assert.strictEqual(overlays[0].query_type, 'validation');
        });
    });

    describe('Statistics Tracking', () => {
        it('should track execution statistics', () => {
            executor._updateStats(true, false, 150);
            executor._updateStats(true, false, 200);
            executor._updateStats(false, true, 500);

            const stats = executor.getStats();

            assert.strictEqual(stats.totalQueriesExecuted, 3);
            assert.strictEqual(stats.successfulQueries, 2);
            assert.strictEqual(stats.failedQueries, 1);
            assert.strictEqual(stats.timeoutQueries, 1);
            assert.strictEqual(stats.totalLatencyMs, 850);
            assert.ok(stats.averageLatencyMs > 280 && stats.averageLatencyMs < 285);
        });

        it('should reset statistics correctly', () => {
            executor._updateStats(true, false, 150);
            executor.resetStats();

            const stats = executor.getStats();

            assert.strictEqual(stats.totalQueriesExecuted, 0);
            assert.strictEqual(stats.successfulQueries, 0);
            assert.strictEqual(stats.failedQueries, 0);
            assert.strictEqual(stats.timeoutQueries, 0);
        });
    });
});
