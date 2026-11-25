import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { requestPersistence } from './db/db'

// Hors connexion : l'appli se met en cache et se met à jour toute seule.
registerSW({ immediate: true })
requestPersistence()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
