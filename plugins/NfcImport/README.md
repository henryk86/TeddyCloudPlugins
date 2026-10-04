# TeddyCloud NFC Dump Import Plugin

Import Flipper `.nfc` dumps into TeddyCloud as Tonie content. The plugin creates
the content JSON and asks TeddyCloud to retrieve the matching TAF file from
Boxine.

---

## Features

- Upload and parse a Flipper `.nfc` dump in the browser
- Validate the 8-byte UID and 32-byte authentication token
- Create the TeddyCloud content folder and JSON file
- Trigger the Boxine TAF retrieval through TeddyCloud; the TAF is not downloaded
  to the computer
- Adapt to the parent TeddyCloud UI theme

---

## Usage

1. Select a `.nfc` file containing `UID` and `Data Content` fields.
2. Review the calculated rUID and target JSON path.
3. Select **Create JSON in TeddyCloud**.
4. The plugin creates the content JSON and requests the TAF through TeddyCloud's
   `/content/download/` route. TeddyCloud caches the TAF locally when
   `cloud.cacheContent` is enabled.

---

## Installation

1. Copy the `NfcImport` folder into TeddyCloud's plugin directory.
2. Restart TeddyCloud or reload its plugins.
3. Open **NFC Dump Import** from the Tonies section.

---

## Changelog

- **1.0.0** — Initial NFC dump import.

---

## License

MIT License.
