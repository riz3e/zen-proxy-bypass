"use strict";

// Shared constants and helpers. Loaded in background, popup, and options alike.

const DEFAULTS = {
  enabled: true,
  proxyType: "socks", // "socks" = SOCKS5; other options: "socks4", "http", "https"
  host: "127.0.0.1",
  port: 10808,
  proxyDNS: true, // for SOCKS: resolve names through the proxy
  bypass: [], // domains; an "example.com" entry also covers all subdomains
};

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch (e) {
    return null;
  }
}

// A list entry covers the domain itself and all its subdomains.
function matchesEntry(host, entry) {
  return host === entry || host.endsWith("." + entry);
}

// Reduce a user string to a bare domain:
// "https://www.example.com/page/" -> "www.example.com", "*.site.ru" -> "site.ru"
function normalizeEntry(raw) {
  let s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return null;
  if (s.includes("://") || s.includes("/")) {
    try {
      s = new URL(s.includes("://") ? s : "http://" + s).hostname;
    } catch (e) {
      return null;
    }
  }
  s = s
    .replace(/^\*\./, "")
    .replace(/^\.+/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "");
  if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(s)) return null;
  if (s !== "localhost" && !s.includes(".")) return null;
  return s;
}

// Local and private addresses are always direct, regardless of the list.
function isAlwaysDirect(host) {
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  if (host.includes(":")) {
    // IPv6
    return (
      host === "::1" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd")
    );
  }
  return false;
}
