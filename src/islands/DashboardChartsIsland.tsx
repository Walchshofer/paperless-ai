import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// --- Types & Interfaces ---

export interface DashboardMetrics {
  lastUpdated: string;
  documentCount: number;
  processedCount: number;
  tokenDistribution: Array<{ range: string; count: number }>;
  documentTypes: Array<{ type: string; count: number }>;
  processingStatus?: {
    isProcessing: boolean;
    processedToday: number;
    currentlyProcessing?: {
      documentId: number;
      title: string;
    };
    lastProcessed?: {
      processed_at: string;
    };
  };
}

// ChartProps interface removed - not currently used

// Extend Window for dashboard data hydration
interface WindowWithDashboard extends Window {
  dashboardData?: DashboardMetrics;
}

// --- Hook: useDashboardMetrics ---

const useDashboardMetrics = (initialData: DashboardMetrics | null | undefined) => {
  const [metrics, setMetrics] = useState((initialData ?? null) as DashboardMetrics | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);

  useEffect(() => {
    // If no initial data, try to hydrate from window
    const win = window as WindowWithDashboard;
    if (!metrics && win.dashboardData) {
      setMetrics(win.dashboardData);
    }

    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/dashboard/metrics');
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json();
        
        // The API returns a wrapper, likely { lastUpdated, paperless_data: {...}, ... } 
        // We need to map it to our DashboardMetrics structure if it differs, 
        // or ensure the API returns exactly what we need.
        // Based on DashboardService.js, it returns:
        // { 
        //   lastUpdated, 
        //   paperless_data: { documentCount, processedDocumentCount, tokenDistribution, documentTypes, ... }, 
        //   processingStatus 
        // }
        
        // We map it here to be safe and consistent
        const mappedMetrics: DashboardMetrics = {
          lastUpdated: data.lastUpdated,
          documentCount: data.paperless_data?.documentCount || 0,
          processedCount: data.paperless_data?.processedDocumentCount || 0,
          tokenDistribution: data.paperless_data?.tokenDistribution || [],
          documentTypes: data.paperless_data?.documentTypes || [],
          processingStatus: data.processingStatus
        };

        setMetrics(mappedMetrics);
        setError(null);
      } catch (err) {
        console.error('Failed to poll dashboard metrics:', err);
        setError('Failed to update dashboard data');
      }
    };

    // Poll every 5 seconds (more aggressive than 30s to be "reactive")
    const intervalId = setInterval(fetchMetrics, 5000);
    return () => clearInterval(intervalId);
  }, []);

  return { metrics, loading, error };
};

// --- Component: TaskRunnerStatus ---

const TaskRunnerStatus = ({ metrics }: { metrics: DashboardMetrics }) => {
  if (!metrics) return null;

  const { processingStatus, processedCount, documentCount } = metrics;
  const isProcessing = processingStatus?.isProcessing || false;
  const processedToday = processingStatus?.processedToday || 0;
  
  // Calculate pending
  const pendingCount = Math.max(0, documentCount - processedCount);
  const totalDocs = documentCount || 1; // avoid divide by zero
  const progressPercent = Math.min(100, Math.round((processedCount / totalDocs) * 100));

  // Time ago helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="material-card col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-title mb-0">Task Runner Status</h3>
        <span className="text-sm text-gray-500">
          Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
        </span>
      </div>

      {/* Active Processing / Idle State */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
        {isProcessing ? (
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-file text-blue-500 text-sm"></i>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Processing Document</span>
                {processingStatus?.currentlyProcessing?.documentId && (
                  <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    #{processingStatus.currentlyProcessing.documentId}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 truncate max-w-md">
                {processingStatus?.currentlyProcessing?.title || 'Unknown Document'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <i className="fas fa-check text-gray-400"></i>
            </div>
            <div>
              <div className="font-medium">System Idle</div>
              <div className="text-sm text-gray-600">Waiting for new documents</div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
           <span className="text-gray-600">Total Progress</span>
           <span className="font-medium">{progressPercent}% ({processedCount} / {documentCount})</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
           <div className="progress-bar-fill bg-blue-500 h-2.5 rounded-full" style={{ '--progress-width': `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm text-gray-600 mb-1">Processed Today</div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold">{processedToday}</span>
            <span className="text-sm text-gray-500 mb-1">docs</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
           <div className="text-sm text-gray-600 mb-1">Pending</div>
           <div className="flex items-end gap-2">
             <span className="text-2xl font-bold">{pendingCount}</span>
             <span className="text-sm text-gray-500 mb-1">docs</span>
           </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm text-gray-600 mb-1">Last Processed</div>
          <div className="text-sm font-medium pt-2">
            {processingStatus?.lastProcessed 
              ? formatTime(processingStatus.lastProcessed.processed_at) 
              : 'No recent data'}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Component: ChartCanvas ---

// Chart.js types for the canvas component
interface ChartData {
  labels: string[];
  datasets: Array<{
    label?: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
}

interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: Record<string, unknown>;
  scales?: Record<string, unknown>;
}

interface ChartInstance {
  destroy: () => void;
}

const ChartCanvas = ({ id, type, data, options }: { id: string, type: string, data: ChartData, options?: ChartOptions }) => {
  const canvasRef = useRef(null as HTMLCanvasElement | null);
  const chartInstance = useRef(null as ChartInstance | null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // @ts-ignore - access global Chart
    if (typeof window.Chart !== 'undefined') {
      // @ts-ignore
      chartInstance.current = new window.Chart(ctx, {
        type,
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...options
        }
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [JSON.stringify(data)]); // Re-create when data changes

  return (
    <div className="chart-container dynamic-height-chart relative" style={{ '--chart-height': '300px' }}>
      <canvas ref={canvasRef} id={id}></canvas>
      {(!data || !data.datasets || data.datasets[0].data.length === 0 || data.datasets[0].data.every((v: number) => v === 0)) && (
         <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 rounded-lg">
           <span className="text-sm text-gray-500">No data available</span>
         </div>
      )}
    </div>
  );
};

// --- Main Island Component ---

export default function DashboardChartsIsland({ initialData }: { initialData?: DashboardMetrics | null }) {
  // Use the hook to manage state
  const { metrics } = useDashboardMetrics(initialData);

  if (!metrics) {
    return <div className="p-4 text-center text-gray-500">Loading dashboard metrics...</div>;
  }

  // Prepare Chart Data
  
  // 1. Token Distribution (Stacked Bar or Bar)
  // The backend returns { range: string, count: number }[]
  const tokenLabels = metrics.tokenDistribution.map((d: { range: string; count: number }) => d.range);
  const tokenCounts = metrics.tokenDistribution.map((d: { range: string; count: number }) => d.count);
  
  const tokenChartData = {
    labels: tokenLabels,
    datasets: [{
      label: 'Documents',
      data: tokenCounts,
      backgroundColor: '#3b82f6', // blue-500
      borderRadius: 4,
    }]
  };

  const tokenOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
         mode: 'index',
         intersect: false,
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { display: true, drawBorder: false } },
      x: { grid: { display: false } }
    }
  };

  // 2. Document Types (Doughnut)
  // The backend returns { type: string, count: number }[]
  const docTypeLabels = metrics.documentTypes.map((d: { type: string; count: number }) => d.type);
  const docTypeCounts = metrics.documentTypes.map((d: { type: string; count: number }) => d.count);
  const docTypeColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#6366f1'
  ];

  const docTypeChartData = {
    labels: docTypeLabels,
    datasets: [{
      data: docTypeCounts,
      backgroundColor: docTypeColors.slice(0, docTypeCounts.length),
      borderWidth: 0,
      spacing: 2
    }]
  };

  const docTypeOptions = {
    cutout: '60%',
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true } }
    }
  };

  return (
    <Fragment>
      <div className="card-grid mt-6">
        {/* Task Runner Status Widget */}
        <TaskRunnerStatus metrics={metrics} />

        {/* Token Distribution Chart */}
        <div className="material-card">
          <h3 className="card-title">Token Usage Distribution</h3>
          <ChartCanvas 
            id="tokenDistributionChart" 
            type="bar" 
            data={tokenChartData} 
            options={tokenOptions} 
          />
        </div>

        {/* Document Types Chart */}
        <div className="material-card">
          <h3 className="card-title">Document Type Distribution</h3>
          <ChartCanvas 
            id="documentTypesChart" 
            type="doughnut" 
            data={docTypeChartData} 
            options={docTypeOptions} 
          />
        </div>
      </div>
    </Fragment>
  );
}