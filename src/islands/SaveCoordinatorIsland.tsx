import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export default function SaveCoordinatorIsland(_props: { documentId?: number }) {
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  // avoid generic type args on useState to satisfy TS in this environment
  const [status, setStatus] = useState('idle' as 'idle'|'saving'|'success'|'failed');
  const [lastError, setLastError] = useState(null as string | null);

  useEffect(() => {
    // import coordinator module and start it (module attaches listeners on window)
    // the coordinator module is pure-js and exposes a startCoordinator function
    let coordinator: { stop?: () => void; _activeSaves?: Record<string, unknown> } | null = null;
    try {
      // use require so islands can be imported as CJS in runtime builds
      const mod = require('../lib/workspace-save-coordinator');
      coordinator = mod.startCoordinator();
    } catch (err) {
      // If module fails to load, keep island dormant
      console.error('[SaveCoordinatorIsland] failed to start coordinator', err);
      return;
    }

    type BeginDetail = { saveId?: string; documentId?: number | null; ts?: number; total?: number };
    type ProgressDetail = { saveId?: string; documentId?: number | null; completed?: number; total?: number };
    type FailedDetail = { saveId?: string; documentId?: number | null; errors?: unknown[] };

    function onBegin(e: Event) {
      const detail = (e as CustomEvent<BeginDetail>)?.detail || {};
      console.debug(`[SaveCoordinator] onBegin: saveId=${detail.saveId}, total=${detail.total}`);
      setActive(true);
      setStatus('saving');
      setProgress({ completed: 0, total: detail.total || 0 });
    }
    function onProgress(e: Event) {
      const detail = (e as CustomEvent<ProgressDetail>)?.detail || {};
      console.debug(`[SaveCoordinator] onProgress: ${detail.completed}/${detail.total}`);
      setProgress({ completed: detail.completed || 0, total: detail.total || 0 });
    }
    function onComplete(e: Event) {
      const detail = (e as CustomEvent) ?.detail || {};
      console.debug(`[SaveCoordinator] onComplete: doc=${detail.documentId}`);
      setStatus('success');
      setActive(false);
      setTimeout(() => setStatus('idle'), 1500);
    }
    function onFailed(e: Event) {
      const detail = (e as CustomEvent<FailedDetail>)?.detail || {};
      console.debug(`[SaveCoordinator] onFailed:`, detail.errors);
      setStatus('failed');
      setLastError(JSON.stringify(detail.errors || {}));
      setActive(false);
    }

    window.addEventListener('workspace:save-begin', onBegin as EventListener);
    window.addEventListener('workspace:save-progress', onProgress as EventListener);
    window.addEventListener('workspace:save-complete', onComplete as EventListener);
    window.addEventListener('workspace:save-failed', onFailed as EventListener);

    return () => {
      try {
        window.removeEventListener('workspace:save-begin', onBegin as EventListener);
        window.removeEventListener('workspace:save-progress', onProgress as EventListener);
        window.removeEventListener('workspace:save-complete', onComplete as EventListener);
        window.removeEventListener('workspace:save-failed', onFailed as EventListener);
        if (coordinator && typeof coordinator.stop === 'function') coordinator.stop();
      } catch (err) { /* ignore */ }
    };
  }, []);

  return (
    <div data-testid="save-coordinator-root" className="">
      {active ? (
        <div className="fixed bottom-6 right-6 bg-white border rounded-lg shadow p-3 z-50" data-testid="save-coordinator-overlay" aria-hidden="false">
          <div className="text-sm font-semibold">Saving progress</div>
          <div className="text-xs text-gray-500">{progress.completed}/{progress.total}</div>
          {status === 'failed' && (
            <div className="mt-2 text-xs text-red-600" role="alert" data-testid="save-coordinator-error">{lastError}</div>
          )}
        </div>
      ) : (
        <div aria-hidden="true" className="hidden" />
      )}
    </div>
  );
}