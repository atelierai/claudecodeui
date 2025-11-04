import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global debug info
console.log('🔧 Main entry point loading');
console.log('📄 Document ready state:', document.readyState);
console.log('🎯 Root element exists:', !!document.getElementById('root'));

// Clean up stale service workers on app load to prevent caching issues after builds
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('🧹 Cleaning up service workers:', registrations.length);
    registrations.forEach(registration => {
      registration.unregister();
    });
  }).catch(err => {
    console.warn('Failed to unregister service workers:', err);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)