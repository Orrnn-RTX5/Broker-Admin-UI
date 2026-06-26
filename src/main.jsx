import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Sandbox } from './components/ui/Sandbox.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

// TEMP: Phase 1 preview. Flip SHOW_SANDBOX to false to return to the real app.
const SHOW_SANDBOX = false;

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
      {SHOW_SANDBOX ? <Sandbox /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
