import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ToastProvider from './components/Toast.tsx'
import {UserContextProvider} from "./context/userContext.tsx"
import { FeatureFlagProvider } from "./context/featureFlagContext.tsx"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserContextProvider>
      <FeatureFlagProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </FeatureFlagProvider>
    </UserContextProvider>
  </StrictMode>,
)
