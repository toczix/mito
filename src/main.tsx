import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { biomarkerNormalizer } from './lib/biomarker-normalizer'

// ✅ Initialize biomarker normalizer on app startup (non-blocking)
console.log('🚀 Initializing Mito app...')

biomarkerNormalizer.initialize().then(() => {
  console.log('✅ Biomarker normalizer initialized')
}).catch((error) => {
  console.warn('⚠️ Biomarker normalizer initialization failed (will use passthrough):', error)
})

// Bootstrap app immediately
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
