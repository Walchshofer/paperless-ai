declare global {
  interface OverlayBbox {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface WorkspaceStateEntry {
    isDirty?: boolean;
    lastDirtyAt?: number;
    lastSavedAt?: number;
  }

  interface Window {
    __last_metadata_locate?: { 
      fieldId: string; 
      handled: boolean; 
      bbox?: OverlayBbox; 
      page?: number 
    };
    __workspaceState?: Record<string, WorkspaceStateEntry>;
    __last_workspace_state_change?: { 
      documentId: number | string; 
      isDirty: boolean 
    };
  }
}

export {};
