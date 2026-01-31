import type { JSX as PreactJSX } from 'preact';

/** Attributes allowed on any HTML/SVG element in this codebase. */
interface BaseElementAttributes {
  class?: string;
  className?: string;
  id?: string;
  style?: string | Record<string, string | number>;
  children?: PreactJSX.Element | PreactJSX.Element[] | string | number | null;
  key?: string | number;
  ref?: PreactJSX.Ref<HTMLElement>;
  dangerouslySetInnerHTML?: { __html: string };
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
  [ariaAttr: `aria-${string}`]: string | number | boolean | undefined;
  onClick?: (e: Event) => void;
  onChange?: (e: Event) => void;
  onInput?: (e: Event) => void;
  onSubmit?: (e: Event) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onMouseDown?: (e: MouseEvent) => void;
  onMouseUp?: (e: MouseEvent) => void;
  onMouseMove?: (e: MouseEvent) => void;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onWheel?: (e: WheelEvent) => void;
  onScroll?: (e: Event) => void;
  onLoad?: (e: Event) => void;
  onError?: (e: Event) => void;
}

// Ensure TypeScript knows about JSX.IntrinsicElements when using Preact in .tsx files
declare global {
  namespace JSX {
    // Define common HTML element attributes for intrinsic elements
    interface IntrinsicElements {
      [elemName: string]: BaseElementAttributes & Record<string, unknown>;
    }
  }
}

export {};
