import type { JSX } from 'preact';

// Ensure TypeScript knows about JSX.IntrinsicElements when using Preact in .tsx files
declare global {
  namespace JSX {
    // Allow any intrinsic element attributes (pragmatic for this codebase)
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
