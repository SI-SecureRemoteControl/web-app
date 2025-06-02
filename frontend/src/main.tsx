import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {BrowserRouter} from "react-router-dom";
import './index.css'
import App from './App.tsx'
import { SessionTimerProvider } from './contexts/SessionTimerContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionTimerProvider>
      <BrowserRouter>
          <App />
      </BrowserRouter>
    </SessionTimerProvider>
  </StrictMode>,
)
