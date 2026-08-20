import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ToastProvider from './components/Toast.tsx'
import {UserContextProvider} from "./context/userContext.tsx"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserContextProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </UserContextProvider>
  </StrictMode>,
)
