import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './style.css';

const SOURCE = '/architecture.excalidraw';
const KEY = 'mindrian-opportunity-scout-architecture-review-v1';

function App() {
  const [initialData, setInitialData] = useState(null);
  const [api, setApi] = useState(null);
  const [status, setStatus] = useState('Loading diagram…');

  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem(KEY);
        const data = saved ? JSON.parse(saved) : await fetch(SOURCE).then((r) => {
          if (!r.ok) throw new Error('Could not load the architecture file');
          return r.json();
        });
        setInitialData(data);
        setStatus(saved ? 'Restored your local review edits' : 'Original architecture loaded');
      } catch (error) {
        setStatus(error.message);
      }
    })();
  }, []);

  const save = () => {
    if (!api) return;
    const data = {
      type: 'excalidraw', version: 2, source: 'https://excalidraw.com',
      elements: api.getSceneElements(),
      appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor, gridSize: api.getAppState().gridSize },
      files: api.getFiles(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opportunity-scout-architecture-review.excalidraw';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Review copy downloaded; browser also keeps a local draft');
  };

  const reset = async () => {
    if (!confirm('Discard this browser’s review edits and reload the original diagram?')) return;
    localStorage.removeItem(KEY);
    const data = await fetch(SOURCE).then((r) => r.json());
    setInitialData(data);
    setStatus('Original architecture reloaded');
  };

  return <>
    <header className="topbar">
      <div><strong>MindrianOS Opportunity Scout</strong><span>Architecture review · local Excalidraw</span></div>
      <div className="actions"><span className="status">{status}</span><button onClick={save}>Save review copy</button><button className="secondary" onClick={reset}>Reset to original</button></div>
    </header>
    <main>{initialData ? <Excalidraw initialData={initialData} excalidrawAPI={setApi} /> : <div className="loading">{status}</div>}</main>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
