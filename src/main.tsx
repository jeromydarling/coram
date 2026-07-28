import "./lib/sentry";
import { createRoot } from "react-dom/client";
import { Suspense } from "react";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('[main] Service worker registration failed:', err);
  });

  // Listen for notification click messages from SW (fallback navigation)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
      const url = new URL(event.data.url);
      window.location.href = url.pathname + url.search + url.hash;
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div>Loading...</div>}>
    <App />
  </Suspense>
);
