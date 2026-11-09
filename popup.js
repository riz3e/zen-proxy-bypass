"use strict";

const $ = (id) => document.getElementById(id);

let cfg = { ...DEFAULTS };
let host = null; // domain of the active tab

const PROXY_NAMES = { socks: "SOCKS5", socks4: "SOCKS4", http: "HTTP", https: "HTTPS" };

function hasProxy() {
  return Boolean(cfg.host && cfg.port);
}

function proxyLine() {
  return hasProxy()
    ? `${PROXY_NAMES[cfg.proxyType]} · ${cfg.host}:${cfg.port}`
    : "proxy not configured";
}

function entryFor(h) {
  return cfg.bypass.find((e) => matchesEntry(h, e)) || null;
}

// For bypass we add the bare host without "www." — wider coverage.
function hostToAdd() {
  return host.startsWith("www.") ? host.slice(4) : host;
}

async function init() {
  const { cfg: saved } = await browser.storage.local.get("cfg");
  cfg = { ...DEFAULTS, ...(saved || {}) };

  let url = "";
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    url = (tabs[0] && tabs[0].url) || "";
  } catch (e) {
    /* without the tabs permission the url is not visible */
  }
  host = /^(https?|wss?|ftp):/i.test(url) ? hostOf(url) : null;

  render();
}

function render() {
  const dot = $("dot");
  const state = $("siteState");
  const btn = $("toggleSite");
  const hint = $("toggleHint");

  $("enabled").checked = cfg.enabled;
  $("proxyLine").textContent = proxyLine();
  $("count").textContent = `In bypass: ${cfg.bypass.length}`;
  $("warning").classList.toggle("hidden", hasProxy());

  if (!host) {
    $("siteHost").textContent = "—";
    state.textContent = "Not a web page";
    dot.className = "dot";
    btn.disabled = true;
    btn.textContent = "…";
    hint.textContent = "Open a site (http/https) to control its routing.";
    return;
  }

  $("siteHost").textContent = host;

  if (isAlwaysDirect(host)) {
    state.textContent = "Always direct (local address)";
    dot.className = "dot green";
    btn.disabled = true;
    btn.textContent = "…";
    hint.textContent = "localhost and private addresses never go through the proxy anyway.";
    return;
  }

  const entry = entryFor(host);
  btn.disabled = false;

  if (!cfg.enabled) {
    state.textContent = "Extension paused — the browser handles routing";
    dot.className = "dot";
  } else if (entry) {
    state.textContent = "Direct, no proxy";
    dot.className = "dot green";
  } else {
    state.textContent = hasProxy() ? "Through proxy" : "Through proxy (not configured!)";
    dot.className = "dot blue";
  }

  if (entry) {
    btn.textContent = "Use proxy for this site";
    btn.classList.add("danger");
    hint.textContent = `Currently bypassed: ${entry}`;
  } else {
    btn.textContent = "Go direct, no proxy";
    btn.classList.remove("danger");
    hint.textContent = `Add to bypass: ${hostToAdd()} (including subdomains)`;
  }
}

function wire() {
  $("toggleSite").addEventListener("click", async () => {
    if (!host) return;
    const entry = entryFor(host);
    if (entry) {
      cfg.bypass = cfg.bypass.filter((e) => e !== entry);
    } else {
      const add = normalizeEntry(hostToAdd());
      if (add && !cfg.bypass.includes(add)) cfg.bypass.push(add);
    }
    await browser.storage.local.set({ cfg });
    render();
  });

  $("enabled").addEventListener("change", async (ev) => {
    cfg.enabled = ev.target.checked;
    await browser.storage.local.set({ cfg });
    render();
  });

  for (const id of ["openOptions", "warnOptions", "openOptions2"]) {
    $(id).addEventListener("click", (ev) => {
      ev.preventDefault();
      browser.runtime.openOptionsPage();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  wire();
  init();
});
