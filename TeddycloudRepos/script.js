// PlugIn Template – Minimal Script
// This script shows the version and serves as the entry point for your own logic.
// Theme/styles are defined in index.html.

(function () {
  "use strict";

  const PLUGIN_NAME = "PlugIn Template";
  const PLUGIN_VERSION = "1.0.0";

  function el(id) {
    return document.getElementById(id);
  }

  function applyVersion() {
    const verEl = el("scriptVersion");
    if (verEl) {
      verEl.textContent = "(v" + PLUGIN_VERSION + ")";
    }
    try {
      document.title = PLUGIN_NAME + " (v" + PLUGIN_VERSION + ")";
    } catch (_) {}
  }

  function init() {
    applyVersion();
    // YOUR CODE STARTS HERE:
    // Example:
    // const btn = el('myButton');
    // if (btn) btn.addEventListener('click', () => { /* ... */ });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();