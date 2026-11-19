import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // ignore registration error in restricted preview contexts
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
