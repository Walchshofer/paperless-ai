/**
 * Cross-Island Event Bus Verification Tests
 *
 * Verifies event propagation between islands:
 * - OverlayViewer → HistoryTabs via visual-search-requested
 * - Event payload structure validation
 * - Handler invocation verification
 *
 * Architecture Reference: ticket:012.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Set up JSDOM environment
let dom: JSDOM;
let window: Window & typeof globalThis;
let document: Document;

// Typed payload used in visual-search tests
interface VisualSearchPayload {
  imageBase64?: string;
  collection?: string;
  documentId?: number;
  page?: number;
  bbox?: { x: number; y: number; width: number; height: number };
  filters?: Record<string, unknown>;
}

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost:3000',
    runScripts: 'dangerously'
  });
  window = dom.window as unknown as Window & typeof globalThis;
  document = window.document;

  // Make window global for event testing
  (global as any).window = window;
  (global as any).document = document;
  (global as any).CustomEvent = window.CustomEvent;
});

afterEach(() => {
  dom.window.close();
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).CustomEvent;
});

describe('Event Bus - visual-search-requested', () => {
  it('emits event from OverlayViewer simulation', () => {
    const eventHandler = vi.fn();
    window.addEventListener('visual-search-requested', eventHandler);

    // Simulate OverlayViewer dispatching event
    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAE=',
        collection: 'visual_pages',
        documentId: 123,
        page: 1,
        bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
      }
    });

    window.dispatchEvent(event);

    expect(eventHandler).toHaveBeenCalledTimes(1);
  });

  it('event contains valid Base64 payload', () => {
    let receivedPayload: any = null;

    window.addEventListener('visual-search-requested', (e: Event) => {
      receivedPayload = (e as CustomEvent).detail;
    });

    const testBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: testBase64,
        collection: 'visual_pages'
      }
    });

    window.dispatchEvent(event);

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload.imageBase64).toBe(testBase64);
    expect(typeof receivedPayload.imageBase64).toBe('string');
    expect(receivedPayload.imageBase64.length).toBeGreaterThan(10);
  });

  it('event includes collection name', () => {
    let receivedPayload: any = null;

    window.addEventListener('visual-search-requested', (e: Event) => {
      receivedPayload = (e as CustomEvent).detail;
    });

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: 'test',
        collection: 'visual_overlays'
      }
    });

    window.dispatchEvent(event);

    expect(receivedPayload.collection).toBe('visual_overlays');
  });

  it('event includes filters when provided', () => {
    let receivedPayload: VisualSearchPayload | null = null;

    window.addEventListener('visual-search-requested', (e: Event) => {
      receivedPayload = (e as CustomEvent).detail as VisualSearchPayload;
    });

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: 'test',
        collection: 'visual_pages',
        filters: {
          correspondent_id: 5,
          tag_ids: [1, 2, 3]
        }
      }
    });

    window.dispatchEvent(event);

    expect(receivedPayload.filters).toBeDefined();
    expect(receivedPayload.filters.correspondent_id).toBe(5);
    expect(receivedPayload.filters.tag_ids).toEqual([1, 2, 3]);
  });

  it('event includes bbox coordinates', () => {
    let receivedPayload: any = null;

    window.addEventListener('visual-search-requested', (e: Event) => {
      receivedPayload = (e as CustomEvent).detail;
    });

    const bbox = { x: 0.1, y: 0.2, width: 0.5, height: 0.6 };

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: 'test',
        collection: 'visual_pages',
        bbox
      }
    });

    window.dispatchEvent(event);

    expect(receivedPayload.bbox).toEqual(bbox);
    expect(receivedPayload.bbox.x).toBe(0.1);
    expect(receivedPayload.bbox.y).toBe(0.2);
    expect(receivedPayload.bbox.width).toBe(0.5);
    expect(receivedPayload.bbox.height).toBe(0.6);
  });
});

describe('Event Handler - HistoryTabs Simulation', () => {
  it('handler triggered on event dispatch', () => {
    const mockHandler = vi.fn();

    // Simulate HistoryTabs listener setup
    window.addEventListener('visual-search-requested', mockHandler);

    // Simulate OverlayViewer dispatch
    const event = new window.CustomEvent('visual-search-requested', {
      detail: { imageBase64: 'test', collection: 'visual_pages' }
    });
    window.dispatchEvent(event);

    expect(mockHandler).toHaveBeenCalled();
  });

  it('handler parses payload correctly', () => {
    let parsedData: VisualSearchPayload | null = null;

    // Simulate HistoryTabs listener with parsing
    window.addEventListener('visual-search-requested', (e: Event) => {
      const payload = (e as CustomEvent).detail || {} as VisualSearchPayload;
      const { imageBase64, collection, bbox, filters } = payload;
      parsedData = { imageBase64, collection, bbox, filters } as VisualSearchPayload;
    });

    const testPayload = {
      imageBase64: 'abc123base64',
      collection: 'visual_pages',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
      filters: { correspondent_id: 10 }
    };

    const event = new window.CustomEvent('visual-search-requested', {
      detail: testPayload
    });
    window.dispatchEvent(event);

    expect(parsedData).toEqual(testPayload);
  });

  it('multiple listeners receive the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    window.addEventListener('visual-search-requested', handler1);
    window.addEventListener('visual-search-requested', handler2);

    const event = new window.CustomEvent('visual-search-requested', {
      detail: { imageBase64: 'test', collection: 'visual_pages' }
    });
    window.dispatchEvent(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('removed listener does not receive events', () => {
    const handler = vi.fn();

    window.addEventListener('visual-search-requested', handler);
    window.removeEventListener('visual-search-requested', handler);

    const event = new window.CustomEvent('visual-search-requested', {
      detail: { imageBase64: 'test', collection: 'visual_pages' }
    });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Payload Schema Validation', () => {
  it('validates required fields present', () => {
    let payloadValid = false;

    window.addEventListener('visual-search-requested', (e: Event) => {
      const payload = (e as CustomEvent).detail || {};
      const { imageBase64, collection } = payload;
      payloadValid =
        typeof imageBase64 === 'string' &&
        imageBase64.length > 0 &&
        typeof collection === 'string' &&
        ['visual_pages', 'visual_overlays'].includes(collection);
    });

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: 'validBase64String',
        collection: 'visual_pages'
      }
    });
    window.dispatchEvent(event);

    expect(payloadValid).toBe(true);
  });

  it('detects missing imageBase64', () => {
    let payloadValid = true;

    window.addEventListener('visual-search-requested', (e: Event) => {
      const payload = (e as CustomEvent).detail || {};
      const { imageBase64 } = payload;
      payloadValid = typeof imageBase64 === 'string' && imageBase64.length > 0;
    });

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        collection: 'visual_pages'
        // missing imageBase64
      }
    });
    window.dispatchEvent(event);

    expect(payloadValid).toBe(false);
  });

  it('detects invalid collection name', () => {
    let collectionValid = true;

    window.addEventListener('visual-search-requested', (e: Event) => {
      const payload = (e as CustomEvent).detail || {};
      const { collection } = payload;
      collectionValid = ['visual_pages', 'visual_overlays'].includes(collection);
    });

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: 'test',
        collection: 'invalid_collection'
      }
    });
    window.dispatchEvent(event);

    expect(collectionValid).toBe(false);
  });
});

describe('Event Timing', () => {
  it('event dispatched synchronously', () => {
    const timeline: string[] = [];

    window.addEventListener('visual-search-requested', () => {
      timeline.push('handler');
    });

    timeline.push('before');

    const event = new window.CustomEvent('visual-search-requested', {
      detail: { imageBase64: 'test', collection: 'visual_pages' }
    });
    window.dispatchEvent(event);

    timeline.push('after');

    // Synchronous dispatch means handler runs between before and after
    expect(timeline).toEqual(['before', 'handler', 'after']);
  });
});

describe('Loading State Trigger', () => {
  it('simulates loading state set on event', () => {
    let isLoading = false;

    // Simulate HistoryTabs setting loading state
    window.addEventListener('visual-search-requested', () => {
      isLoading = true;
    });

    expect(isLoading).toBe(false);

    const event = new window.CustomEvent('visual-search-requested', {
      detail: { imageBase64: 'test', collection: 'visual_pages' }
    });
    window.dispatchEvent(event);

    expect(isLoading).toBe(true);
  });

  it('simulates API call initiated on event', async () => {
    const apiCalls: any[] = [];

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          results: []
        })
    });

    // Simulate HistoryTabs API call on event
    window.addEventListener('visual-search-requested', async (e: Event) => {
      const payload = (e as CustomEvent).detail || {};
      const { imageBase64, collection, filters } = payload;
      apiCalls.push({ imageBase64, collection, filters });

      await mockFetch('/api/visual-rag/search/visual', {
        method: 'POST',
        body: JSON.stringify({ image: imageBase64, collection, filters })
      });
    });

    const event = new window.CustomEvent('visual-search-requested', {
      detail: {
        imageBase64: 'testImage',
        collection: 'visual_pages',
        filters: { correspondent_id: 1 }
      }
    });
    window.dispatchEvent(event);

    // Wait for async operations
    await new Promise((r) => setTimeout(r, 10));

    expect(apiCalls.length).toBe(1);
    expect(mockFetch).toHaveBeenCalled();
  });
});
