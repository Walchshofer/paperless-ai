import { h } from 'preact';

interface ServiceNode {
  id: string;
  label: string;
  status: 'online' | 'offline' | 'error';
}

interface ServiceTopologyProps {
  nodes: ServiceNode[];
  onNodeClick?: (nodeId: string) => void;
}

/**
 * Horizontal service topology strip showing pipeline flow.
 * Nodes are connected with solid (online) or dashed (offline) connectors.
 */
export function ServiceTopology({ nodes, onNodeClick }: ServiceTopologyProps) {
  return (
    <div className="topology-strip" data-testid="service-topology">
      {nodes.map((node, i) => (
        <div key={node.id} style={{ display: 'contents' }}>
          <button
            className="topology-node"
            onClick={() => onNodeClick?.(node.id)}
            data-testid={`topology-node-${node.id}`}
            title={`${node.label}: ${node.status}`}
          >
            <span
              className="topology-node-dot"
              data-status={node.status}
            />
            <span className="topology-node-label">{node.label}</span>
          </button>
          {i < nodes.length - 1 && (
            <span
              className="topology-connector"
              data-connected={String(node.status === 'online' && nodes[i + 1].status === 'online')}
            />
          )}
        </div>
      ))}
    </div>
  );
}
