import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply stored theme before first render to avoid flash
const stored = localStorage.getItem("ias-theme");
const isDark = stored !== "light";
document.documentElement.classList.toggle("dark", isDark);

// ── Android Chrome viewport-height fix ─────────────────────────────────────
// Android Chrome: window.innerHeight gives the ACTUAL visible viewport
// (address bar excluded), while 100vh/100dvh can be unreliable on older
// Chrome versions. We compute --app-height from innerHeight and use it
// in CSS via calc(var(--app-height, 100dvh)).
// The 'resize' listener fires when the address bar shows/hides or keyboard opens.
function updateAppHeight() {
  document.documentElement.style.setProperty(
    "--app-height",
    `${window.innerHeight}px`
  );
}
updateAppHeight();
window.addEventListener("resize", updateAppHeight);
// Also fire on orientation change (Android sometimes doesn't fire resize)
window.addEventListener("orientationchange", () => {
  // Small delay lets the browser finish adjusting before we measure
  setTimeout(updateAppHeight, 100);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
