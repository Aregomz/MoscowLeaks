import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { songs } from './data/songs'
import { registerAppServiceWorker } from './utils/registerServiceWorker'

registerAppServiceWorker(songs.map((song) => song.url))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
