import { h } from 'preact';

interface PipelineNode {
  id: string;
  label: string;
  modelName: string;
  scrollTarget?: string;
}

interface PipelineDiagramProps {
  nodes: PipelineNode[];
  domainBranches?: string[];
  testId?: string;
}

/**
 * PipelineDiagram - Visual pipeline flow.
 * Pure CSS/HTML flow diagram: horizontal on desktop, vertical on mobile.
 * Clicking a node scrolls to its model card section below.
 */
export function PipelineDiagram({
  nodes,
  domainBranches = ['Medical', 'Financial', 'Legal', 'General'],
  testId = 'pipeline-diagram',
}: PipelineDiagramProps) {
  const handleNodeClick = (node: PipelineNode) => {
    if (!node.scrollTarget) return;
    const target = document.getElementById(node.scrollTarget);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('mc-group--highlight');
      setTimeout(() => target.classList.remove('mc-group--highlight'), 1500);
    }
  };

  const handleKeyDown = (e: KeyboardEvent, node: PipelineNode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNodeClick(node);
    }
  };

  // Find the expert node index to render branches underneath
  const expertIdx = nodes.findIndex((n) => n.id === 'expert');

  return (
    <div className="pd-container" data-testid={testId} role="img" aria-label="Document processing pipeline diagram">
      <div className="pd-flow">
        {nodes.map((node, i) => (
          <div key={node.id} className="pd-step">
            <div
              className="pd-node"
              role="button"
              tabIndex={0}
              aria-label={`${node.label}: ${node.modelName || 'not configured'}`}
              onClick={() => handleNodeClick(node)}
              onKeyDown={(e: KeyboardEvent) => handleKeyDown(e, node)}
              data-testid={`pd-node-${node.id}`}
            >
              <div className="pd-node-icon">
                {getNodeIcon(node.id)}
              </div>
              <span className="pd-node-label">{node.label}</span>
              {node.modelName && (
                <span className="pd-model-name" title={node.modelName}>
                  {truncateModel(node.modelName)}
                </span>
              )}
            </div>

            {/* Domain branches under Expert node */}
            {i === expertIdx && domainBranches.length > 0 && (
              <div className="pd-branches">
                {domainBranches.map((branch) => (
                  <span key={branch} className="pd-branch-label">{branch}</span>
                ))}
              </div>
            )}

            {/* Arrow between nodes */}
            {i < nodes.length - 1 && (
              <div className="pd-arrow" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function truncateModel(name: string): string {
  if (name.length <= 18) return name;
  return name.slice(0, 15) + '...';
}

function getNodeIcon(id: string): preact.VNode {
  switch (id) {
    case 'document':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case 'router':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      );
    case 'planner':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );
    case 'expert':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case 'orchestrator':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case 'output':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
