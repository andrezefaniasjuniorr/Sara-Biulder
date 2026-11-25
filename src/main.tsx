import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  const prevAuthFail = (window as any).gm_authFailure;
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    if (typeof prevAuthFail === 'function') prevAuthFail();
  };

  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const joined = args.map((a) => String(a ?? '')).join(' ');
    if (
      /OverQuotaMapError|QuotaExceededError|OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED/i.test(joined)
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    origConsoleError.apply(console, args);
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {
        // ignore registration error in restricted preview contexts
      });
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);

