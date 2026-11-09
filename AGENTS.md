# AGENTS.md — Proxy Exclude project context

Only what is NOT visible from the code and structure: why the project exists,
which decisions were made and why, invariants, and known gotchas.

## Why this project exists

The owner lives outside their home country, where the internet is censored, so
a local proxy client (v2rayN/NekoRay-style, SOCKS5 `127.0.0.1:10808`) runs
constantly. But for some sites the proxy only hurts (local banks/services,
speed). The extension gives one click: this site goes direct, everything else
keeps going through the proxy as usual.

Consequence for priorities: **erring toward "direct" is worse than erring
toward "through proxy".** An unknown domain must always go through the proxy;
bypass is only ever an explicit user action. Any change to routing logic must
preserve this property.

## Target platform and environment

- Browser is Zen only (a Firefox fork) on Linux. All development is against
  the `browser.*` API (promise style): no `chrome.*` shims and no dependencies
  at all — the project must stay loadable into `about:debugging` as-is.
- The extension is unsigned. Installation is temporary via `about:debugging`,
  or permanent with `xpinstall.signatures.required` disabled. Hence the fixed
  gecko id `proxy-exclude@local` — don't change it without reason: a new id
  means orphaned storage and a "second instance" for the user.
- All user-facing strings are in English.

## Key decisions (and why)

- **MV2 + persistent background, deliberately.** MV2 is fully alive in
  Firefox/Zen, and a persistent background page guarantees the
  `proxy.onRequest` listener never sleeps, so a proxy decision is made for
  every request. Migrate to MV3 only if Zen actually drops MV2.
- **`proxy.onRequest`, not `browser.proxy.settings` + a passthrough list.**
  Reason: pausing the extension is just `removeListener`, after which the
  browser instantly falls back to ITS OWN proxy settings. Using
  `proxy.settings` would mean taking over the settings (conflicts with other
  extensions) and having to remember what to restore on disable.
- **Pause ≠ "direct for everything".** Returning `{type:"direct"}` while
  paused is forbidden — that would kill the user's proxying entirely. Pause is
  always implemented by removing the listener.
- **The proxy is specified explicitly in the extension's own settings.**
  Firefox `ProxyConfig` has no `system` type — "use system proxy" is not
  reachable from the listener. Hence: the 10808 default + a one-time prefill
  attempt from the browser's manual proxy settings; the user edits the rest.
- **`proxyDNS: true` for SOCKS is a principle, not a default.** DNS resolves
  on the proxy side; the local ISP neither sees nor poisons domain names. For
  bypassed sites DNS deliberately goes direct — by definition those are
  locally reachable.
- **localhost/private ranges are always direct, hardcoded** (`common.js`,
  `isAlwaysDirect`). This is not and must not become configurable: proxying
  LAN traffic is a reliable way to cut yourself off from your own proxy
  client.

## Mechanics that are easy to break

- `common.js` is loaded two ways: via the `background.scripts` array in the
  manifest and via `<script>` tags in popup/options. It must therefore remain
  a flat file with no import/export and no DOM dependencies.
- The storage schema is a single `cfg` key holding the whole object. Any new
  field is added to `DEFAULTS` (common.js): all three contexts do
  `{...DEFAULTS, ...saved}` and survive old storage without migrations.
- The bypass list is stored already normalized (`normalizeEntry`): no scheme,
  path, leading `*.` or `www.`. Matching is suffix-based: an `example.com`
  entry also covers subdomains. The popup strips `www.` before adding, for
  wider coverage — a deliberate UX trade-off.
- The `enabled` flag is only flipped from the popup; options preserves it
  as-is (`enabledNow`) so the settings page never fights the toggle.

## Gotchas we already hit

- Icons: `icon.svg` is the source of truth; PNGs are generated from it
  (`rsvg-convert -w N -h N icons/icon.svg -o icons/icon-N.png` for 48/96/128).
  Editing the PNGs directly is pointless — they get regenerated.
- Building the `.xpi`: it's a plain zip, but inner paths must be preserved
  (`manifest.json` at the root, icons under `icons/`). `python3 -m zipfile -c`
  stores files by basename at the archive root — that's how the icons got
  broken; build with a script using explicit arcnames. Bump the version in
  `manifest.json` and in the `.xpi` filename only together.
- `browser.action` vs `browser.browserAction`: we use
  `browser.browserAction || browser.action` — MV2 first, alias for the future.

## How to verify

There is nothing to test outside the browser (see "no deps, no build"):
the baseline check is `node --check` on every js file plus
`python3 -m json.tool manifest.json`. Real verification happens only in Zen
via `about:debugging`, with this checklist: proxy client on/off, adding and
removing a site from bypass, pausing via the toggle, a private window
(must be explicitly allowed in about:addons), and a non-http(s) tab.
