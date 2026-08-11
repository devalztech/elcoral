import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '../styles/index.css'
import { registerServiceWorker } from '../features/notifications/browserNotify.js'

// The worker is notification-only; registering it early means the first
// alert of a session doesn't wait on it.
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
