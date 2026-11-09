# AGENTS.md — Proxy Exclude: structural decisions only

Only rules that cannot be inferred from reading the code.

## Core invariant

**Erring toward "direct" is worse than erring toward "through proxy".**
An unknown domain must always go through the proxy; bypass is only ever an
explicit user action. Any change to routing logic must preserve this.

## Non-negotiable platform facts

- Zen only (Firefox fork), `browser.*` API, zero dependencies, loadable into
  `about:debugging` as-is.
- Unsigned extension with fixed gecko id `proxy-exclude@local` — do not change:
  a new id orphans storage and creates a "second instance".
- All user-facing strings in English.

## Key decisions (and why)

- **MV2 + persistent background, deliberately.** A persistent background page
  guarantees the `proxy.onRequest` listener never sleeps, so a proxy decision
  is made for every request. Migrate to MV3 only if Zen actually drops MV2.
- **`proxy.onRequest`, not `browser.proxy.settings`.** Pausing is just
  `removeListener`, after which the browser falls back to ITS OWN proxy
  settings. `proxy.settings` would mean taking over settings (conflicts with
  other extensions) and having to remember what to restore.
- **Pause ≠ "direct for everything".** Returning `{type:"direct"}` while
  paused is forbidden. Pause is always implemented by removing the listener.
- **The proxy is specified explicitly in the extension's own settings.**
  Firefox `ProxyConfig` has no `system` type — "use system proxy" is not
  reachable from the listener. Hence: the 10808 default + one-time prefill
  from the browser's manual proxy settings.
- **`proxyDNS: true` for SOCKS is a principle.** DNS resolves on the proxy
  side; for bypassed sites DNS deliberately goes direct (those are locally
  reachable by definition).
- **localhost/private ranges always direct, hardcoded** (`isAlwaysDirect` in
  `common.js`). Must not become configurable: proxying LAN traffic can cut
  the user off from their own proxy client.

## Mechanics that are easy to break

- `common.js` is loaded two ways (manifest `background.scripts` + `<script>`
  tags in popup/options): must stay a flat file, no import/export, no DOM.
- Storage is a single `cfg` key holding the whole object. New fields go into
  `DEFAULTS` (common.js); all contexts do `{...DEFAULTS, ...saved}` — no
  migrations needed.
- The bypass list is stored already normalized (`normalizeEntry`): no scheme,
  path, leading `*.` or `www.`; matching is suffix-based (entry covers
  subdomains). Popup strips `www.` before adding — deliberate.
- The `enabled` flag is only flipped from the popup; options preserves it
  as-is (`enabledNow`) so settings never fight the toggle.

## Gotchas we already hit

- Icons: `icon.svg` is the source of truth; PNGs are regenerated from it
  (`rsvg-convert`). Editing PNGs directly is pointless.
- Building the `.xpi`: plain zip, but inner paths must be preserved.
  `python3 -m zipfile -c` flattens to basenames — that broke icons once;
  build with explicit arcnames. Bump version in `manifest.json` and in the
  `.xpi` filename only together.
- Use `browser.browserAction || browser.action` (MV2 first, alias later).
