import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Sandbox } from './components/ui/Sandbox.jsx'

// TEMP: Phase 1 preview. Flip SHOW_SANDBOX to false to return to the real app.
const SHOW_SANDBOX = false;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {SHOW_SANDBOX ? <Sandbox /> : <App />}
  </StrictMode>,
)
