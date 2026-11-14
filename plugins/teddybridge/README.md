# teddybridge

Adds an entry to TeddyCloud that opens [teddybridge](https://github.com/urza-lab/teddybridge), a web UI that
transfers audiobooks and music from Audiobookshelf, Navidrome or NAS folders to the TeddyCloud library as TAF files.

The plugin itself is only a launcher: teddybridge runs as its own service (Docker image
`ghcr.io/urza-lab/teddybridge`) and talks to TeddyCloud through its API.

## Usage

On first use the plugin asks for the address at which your browser reaches teddybridge
(e.g. `http://<host>:8085/`) and stores it in that browser. To change it later, open the plugin
page with `?setup`, or click "Change address" while it opens.

To preset the address for all browsers, replace `TEDDYBRIDGE_URL` in `index.html` with it.

## Inside TeddyCloud or in its own window

teddybridge is shown inside TeddyCloud if teddybridge allows it: set `FRAME_ANCESTORS` in teddybridge's
config to TeddyCloud's address as the browser sees it (e.g. `http://192.0.2.10`). Otherwise the plugin
redirects the whole window to teddybridge.

With teddybridge's login enabled, embedding needs TeddyCloud and teddybridge on the same site (same host
with different ports, or subdomains of one domain), because the session cookie is `SameSite=Strict`.
Otherwise teddybridge shows a link to open it in its own window.

## Language and theme

The plugin follows TeddyCloud's language (English or German; otherwise the browser language) and passes it,
together with TeddyCloud's light/dark theme, on to teddybridge (teddybridge 1.6 or later; older versions
simply ignore it). Works with TeddyCloud's web UI v1 and the new web UI v2.

## License

AGPL-3.0-only, like teddybridge.
