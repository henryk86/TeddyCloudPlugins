# TeddyCloud Backup Plugin

Vollständiges Backup aller TeddyCloud-Daten inkl. Zertifikate, Einstellungen, Content-Metadaten und Audio-Dateien. Unterstützt pro-Toniebox-Overlays mit Größenschätzung vor Download.

---

## Features

- 💾 **Vollbackup** aller wichtigen TeddyCloud-Daten
- 📦 **Pro-Toniebox-Overlays** - jede Box separat sichern/wiederherstellen
- 📊 **Größenschätzung** vor dem Backup mit Warnung bei großen Dateien (>1GB)
- 🔄 **Flexible Wiederherstellung** mit Overlay-Mapping (Backup von Box A auf Box B wiederherstellen)
- 📋 **Detailliertes Status-Log** für Transparenz

---

## Backup-Komponenten

| Komponente | Beschreibung |
|------------|--------------|
| 🔐 **Zertifikate** | CA, Client und Private Key (`.der` Dateien) |
| ⚙️ **Einstellungen** | Alle Konfigurationen (global + pro Box) |
| 📁 **Content-Metadaten** | Tag-Zuweisungen, `content.json` für jeden RUID |
| 🎵 **Audio-Dateien** | TAF-Dateien (kann sehr groß werden!) |
| 📚 **Tonies-Datenbank** | `tonies.json`, `tonies-custom.json`, Toniebox-Modelle |

---

## Installation

1. Diesen Ordner (`teddycloud-backup`) in das TeddyCloud Plugin-Verzeichnis kopieren
2. TeddyCloud neu starten oder Plugins neu laden
3. Das Plugin erscheint im Bereich **Einstellungen**

---

## Backup erstellen

1. **Tonieboxen auswählen**
   - "Alle Tonieboxen" für vollständiges Backup
   - "Nur globale Daten" für Daten ohne Box-spezifische Overlays
   - Einzelne Boxen bei gedrückter Strg-Taste auswählen

2. **Komponenten wählen**
   - Standardmäßig sind alle Komponenten aktiviert
   - Audio-Dateien können bei Platzmangel deaktiviert werden

3. **Größe berechnen** (empfohlen)
   - Zeigt geschätzte Backup-Größe an
   - Warnung bei Backups >1GB

4. **Backup starten**
   - Fortschrittsanzeige zeigt aktuellen Status
   - ZIP-Datei wird automatisch heruntergeladen

---

## Backup wiederherstellen

1. **Backup-Datei auswählen**
   - ZIP-Datei aus vorherigem Backup wählen
   - Inhalt wird automatisch analysiert und angezeigt

2. **Overlay-Zuweisung prüfen**
   - Quell-Box → Ziel-Box Mapping
   - Boxen können übersprungen werden
   - Backup von Box A kann auf Box B wiederhergestellt werden

3. **Wiederherstellen starten**
   - ⚠️ **WARNUNG**: Überschreibt vorhandene Daten!
   - Reihenfolge: Zertifikate → Datenbanken → Einstellungen → Content

---

## ZIP-Struktur

```
teddycloud-backup-2024-12-27T14-30-00/
├── manifest.json              # Backup-Metadaten
├── global/
│   ├── certs/
│   │   ├── ca.der
│   │   ├── client.der
│   │   └── private.der
│   ├── settings.json          # Globale Einstellungen
│   ├── tonies.json
│   ├── tonies-custom.json
│   ├── toniebox.json
│   └── toniebox-custom.json
├── boxes/
│   ├── MeineBox1/
│   │   ├── settings.json      # Box-spezifische Einstellungen
│   │   └── overlay-info.json
│   └── MeineBox2/
│       ├── settings.json
│       └── overlay-info.json
└── content/
    ├── tag-index.json         # Alle bekannten Tags
    ├── E0040301AABBCCDD/
    │   ├── content.json       # Tag-Metadaten
    │   └── 500304E0.taf       # Audio-Datei
    └── .../
```

---

## API-Endpunkte (verwendet)

### Backup
- `GET /api/getBoxes` - Liste aller Tonieboxen
- `GET /api/getIndex?overlay={id}` - Einstellungen
- `GET /api/tagIndex` - Alle Tags
- `GET /api/content/json/get/{ruid}` - Tag-Metadaten
- `GET /api/content/{path}?ogg=true` - Audio-Dateien
- `GET /api/getCaDer`, `/api/getClientDer`, `/api/getPrivateDer` - Zertifikate
- `GET /api/toniesJson`, `/api/toniesCustomJson` - Tonies-Datenbank
- `GET /api/fileIndexV2` - Dateiliste für Größenschätzung

### Restore
- `POST /api/uploadCert` - Zertifikat hochladen
- `POST /api/settings/set/{key}?overlay={id}` - Einstellung setzen
- `POST /api/content/json/set/{ruid}` - Tag-Metadaten setzen
- `POST /api/triggerReloadConfig` - Konfiguration neu laden

---

## Hinweise

- **Audio-Dateien** können mehrere GB groß sein. Bei begrenztem Speicher diese Option deaktivieren.
- **Zertifikate** sind sensibel! Backup-Dateien sicher aufbewahren.
- **Wiederherstellung** überschreibt vorhandene Daten unwiderruflich.
- Bei Problemen das Status-Log prüfen.

---

## Changelog

### v1.0.0
- Initiale Version
- Vollbackup mit allen Komponenten
- Pro-Toniebox-Overlay Support
- Größenschätzung
- Wiederherstellung mit Overlay-Mapping

---

## Lizenz

MIT License - Frei zur Nutzung und Modifikation.

---

## Links

- [TeddyCloud GitHub](https://github.com/toniebox-reverse-engineering/teddycloud)
- [Toniebox Reverse Engineering](https://github.com/toniebox-reverse-engineering)
