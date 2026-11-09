# teddybridge

Adds an entry to TeddyCloud that opens [teddybridge](https://github.com/urza-lab/teddybridge), a web UI that
transfers audiobooks and music from Audiobookshelf, Navidrome or NAS folders to the TeddyCloud library as TAF files.

The plugin itself is only a launcher: teddybridge runs as its own service (Docker image
`ghcr.io/urza-lab/teddybridge`) and talks to TeddyCloud through its API.

## Usage

On first use the plugin asks for the address at which your browser reaches teddybridge
(e.g. `http://<host>:8085/`) and stores it in that browser. Afterwards it redirects there;
"Change address" is shown for 1.5 s before the redirect.

To preset the address for all browsers, replace `TEDDYBRIDGE_URL` in `index.html` with it.

teddybridge cannot be embedded in a frame (security header `frame-ancestors 'none'`), so the plugin
redirects the whole window. If the browser blocks that, an "Open teddybridge" button stays.

The plugin follows the browser language (English or German).

## License

AGPL-3.0-only, like teddybridge.
