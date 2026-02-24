import { vi } from 'vitest';

// Mock Canvas API for JSDOM to prevent "Not implemented" errors
if (typeof HTMLCanvasElement !== 'undefined') {
  const mockCtx = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(0) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillText: vi.fn(),
    getContextAttributes: vi.fn(() => ({})),
    strokeRect: vi.fn(),
  };

  // Object.defineProperty avoids type-assertion gymnastics on the overloaded getContext signature
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => mockCtx),
    writable: true,
    configurable: true,
  });

  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "");
}
