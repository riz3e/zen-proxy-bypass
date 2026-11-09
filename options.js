"use strict";

const $ = (id) => document.getElementById(id);

let enabledNow = DEFAULTS.enabled; // the global toggle from the popup is untouched here

async function load() {
  const { cfg: saved } = await browser.storage.local.get("cfg");
  const cfg = { ...DEFAULTS, ...(saved || {}) };
  enabledNow = cfg.enabled;

  $("type").value = cfg.proxyType;
  $("host").value = cfg.host;
  $("port").value = cfg.port;
  $("proxyDNS").checked = cfg.proxyDNS;
  $("bypass").value = cfg.bypass.join("\n");
  syncDnsRow();
}

function syncDnsRow() {
  const isSocks = $("type").value === "socks";
  $("proxyDNS").closest(".field").classList.toggle("hidden", !isSocks);
}

function setStatus(text, isErr) {
  const el = $("status");
  el.textContent = text;
  el.classList.toggle("err", Boolean(isErr));
}

async function save() {
  const host = $("host").value.trim();
  const port = Number($("port").value);

  if (host && (!(port >= 1 && port <= 65535))) {
    setStatus("Enter a port from 1 to 65535", true);
    return;
  }

  const rawLines = $("bypass")
    .value.split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bypass = [...new Set(rawLines.map(normalizeEntry).filter(Boolean))];
  const invalid = rawLines.length - new Set(rawLines).size > 0 ? 0 : rawLines.filter((l) => !normalizeEntry(l)).length;

  const cfg = {
    enabled: enabledNow,
    proxyType: $("type").value,
    host,
    port: host ? port : 0,
    proxyDNS: $("proxyDNS").checked,
    bypass,
  };
  await browser.storage.local.set({ cfg });

  const extra = invalid > 0 ? `, ${invalid} invalid lines dropped` : "";
  setStatus(`Saved ✓ (${bypass.length} sites${extra})`);
}

async function reset() {
  if (!confirm("Reset settings to defaults (socks5 127.0.0.1:10808, empty list)?")) return;
  await browser.storage.local.set({ cfg: { ...DEFAULTS } });
  await load();
  setStatus("Reset");
}

document.addEventListener("DOMContentLoaded", () => {
  $("type").addEventListener("change", syncDnsRow);
  $("save").addEventListener("click", save);
  $("reset").addEventListener("click", reset);
  load();
});
