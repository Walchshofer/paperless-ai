// Test-only type shims and module declarations

declare global {
  interface Window {
    __DISABLE_GITHUB_FETCH__?: boolean;
    __islandRuntimeMounted?: boolean;
    mountIslands?: (root?: Document | HTMLElement) => void;
  }

  interface HTMLElement {
    __e2e_overlay_helper_attached?: boolean;
  }
}

// Fallback wildcard for @test/* imports used in tests
declare module '@test/*' {
  const whatever: unknown;
  export default whatever;
}

export {};
