import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { registerAssetLoadRecovery } from './utils/assetLoadRecovery.js'

registerAssetLoadRecovery();

// Surface unhandled JS errors in production so the EXE never goes blank.
window.addEventListener('error', (e) => console.error('[window.error]', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.__rtx5SuppressLog) {
    e.preventDefault();
    return;
  }

  console.error('[unhandledrejection]', e.reason);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
