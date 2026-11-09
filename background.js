"use strict";

// Proxy Exclude: all browser traffic goes through the proxy,
// except sites on the bypass list (and local addresses).

let cfg = { ...DEFAULTS };

const FILTER = { urls: ["<all_urls>"] };
const action = browser.browserAction || browser.action;

function proxyConfig() {
  // No proxy configured — go direct (and show "!" on the icon).
  if (!cfg.host || !cfg.port) return { type: "direct" };
  const c = { type: cfg.proxyType, host: cfg.host, port: cfg.port };
  if (cfg.proxyType === "socks") c.proxyDNS = cfg.proxyDNS;
  return c;
}

// browser.proxy.onRequest listener: decides the fate of every request.
function onRequest(details) {
  const host = hostOf(details.url);
  if (host && (isAlwaysDirect(host) || cfg.bypass.some((e) => matchesEntry(host, e)))) {
    return [{ type: "direct" }];
  }
  return [proxyConfig()];
}

function updateBadge() {
  let text = "";
  if (!cfg.enabled) text = "OFF";
  else if (!cfg.host || !cfg.port) text = "!";
  action.setBadgeText({ text });
  if (text) {
    action.setBadgeBackgroundColor({ color: text === "!" ? "#e06c75" : "#6b7280" });
  }
}

// Paused = the extension does not intervene at all: the browser uses its
// own proxy settings (as if the extension were not there).
function applyState() {
  try {
    browser.proxy.onRequest.removeListener(onRequest);
  } catch (e) {
    /* listener not added yet — fine */
  }
  if (cfg.enabled) {
    browser.proxy.onRequest.addListener(onRequest, FILTER);
  }
  updateBadge();
}

// On first run, try to pick up the proxy from the browser settings,
// if a SOCKS/HTTP proxy is manually configured there.
async function prefillFromBrowserSettings() {
  try {
    const { value } = await browser.proxy.settings.get({});
    if (!value || value.proxyType !== "manual") return;
    if (value.socks && value.socksPort) {
      cfg.proxyType = value.socksVersion === 4 ? "socks4" : "socks";
      cfg.host = value.socks;
      cfg.port = value.socksPort;
    } else if (value.http && value.httpPort) {
      cfg.proxyType = "http";
      cfg.host = value.http;
      cfg.port = value.httpPort;
    } else if (value.ssl && value.sslPort) {
      cfg.proxyType = "https";
      cfg.host = value.ssl;
      cfg.port = value.sslPort;
    }
  } catch (e) {
    /* not critical */
  }
}

async function init() {
  try {
    const { cfg: saved } = await browser.storage.local.get("cfg");
    if (saved) {
      cfg = { ...DEFAULTS, ...saved };
    } else {
      await prefillFromBrowserSettings();
      await browser.storage.local.set({ cfg });
    }
  } catch (e) {
    console.warn("[proxy-exclude] failed to read settings:", e);
  }
  applyState();
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.cfg && changes.cfg.newValue) {
    cfg = { ...DEFAULTS, ...changes.cfg.newValue };
    applyState();
  }
});

browser.proxy.onError.addListener((error) => {
  console.warn("[proxy-exclude] proxy error:", error && (error.message || error));
});

// On first install, open the settings right away to check the proxy.
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    browser.runtime.openOptionsPage();
  }
});

init();
