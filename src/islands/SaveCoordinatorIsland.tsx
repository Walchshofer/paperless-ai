import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export default function SaveCoordinatorIsland(_props: { documentId?: number }) {
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [status, setStatus] = useState<'idle'|'saving'|'success'|'failed'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    // import coordinator module and start it (module attaches listeners on window)
    // the coordinator module is pure-js and exposes a startCoordinator function
    let coordinator: any = null;
    try {
      const mod = require('../lib/workspace-save-coordinator');
      coordinator = mod.startCoordinator();
    } catch (err) {
      // If module fails to load, keep island dormant
      console.error('[SaveCoordinatorIsland] failed to start coordinator', err);
      return;
    }

    function onBegin(e: any) {
      setActive(true);
      setStatus('saving');
      setProgress({ completed: 0, total: e?.detail?.total || 0 });
    }
    function onProgress(e: any) {
      setProgress({ completed: e?.detail?.completed || 0, total: e?.detail?.total || 0 });
    }
    function onComplete(_e: any) {
      setStatus('success');
      setActive(false);
      setTimeout(() => setStatus('idle'), 1500);
    }
    function onFailed(e: any) {
      setStatus('failed');
      setLastError(JSON.stringify(e?.detail?.errors || {}));
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
    <div data-testid="save-coordinator-root" aria-hidden={!active} className="">
      {active ? (
        <div className="fixed bottom-6 right-6 bg-white border rounded-lg shadow p-3 z-50" data-testid="save-coordinator-overlay">
          <div className="text-sm font-semibold">Saving progress</div>
          <div className="text-xs text-gray-500">{progress.completed}/{progress.total}</div>
          {status === 'failed' && (
            <div className="mt-2 text-xs text-red-600" role="alert" data-testid="save-coordinator-error">{lastError}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}