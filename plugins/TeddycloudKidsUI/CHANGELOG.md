# Changelog

All notable changes to the Kids UI plugin will be documented in this file.

## [0.3.0] - 2026-05-14

### Added
- Settings dialog accessible via gear icon on the splash screen
- Configurable items per page (9/18/27/36, multiples of one grid row)
- Configurable icon size for the list view (S/M/L)
- Configurable icon size for the detail view (S/M/L)
- Language override in settings (auto/de/en)
- Settings persisted in browser localStorage (TeddyCloud settings API integration deferred)

### Changed
- Wording shifted from "Musik" to "Geschichte" across the flow
- Audio screen title is now a direct question to the child
- Confirmation question references the specific story
- List icon size auto-couples items-per-page: S/M → 27 (3 rows), L → 18 (2 rows)
- Detail view images enlarged ~25% across all sizes (S 175, M 225, L 300)

### Fixed
- Inconsistent button label on the tag-detected screen ("Musik wählen" → "Geschichte wählen")
- Audio grid no longer triggers pull-to-refresh on tablets
- Audio controls row stays single-line on landscape tablets

## [0.2.2] - 2026-01-05

### Fixed
- Search state is now preserved when returning from the detail/confirmation view
- Previously, the search query and filtered results were reset when going back

## [0.2.1] - 2026-01-04

### Added
- Added `standalone` flag to plugin.json for standalone mode support

## [0.2.0] - 2025-12-31

### Added
- Fullscreen toggle button for immersive experience

### Fixed
- Localization fixes for German Umlaute
- Tonie title now properly shown below detected tonie
- Fixed custom Tonie handling
- Updated English translation for splash title

## [0.1.0] - 2025-12-30

### Added
- Initial release
- Kid-friendly interface for assigning audio to Tonie tags
- Box selection with automatic single-box detection
- Tag detection via polling
- Audio library browsing with search and pagination
- Confirmation flow before linking
- Multi-language support (German/English)
- Theme adaptation from parent TeddyCloud UI
- Docker support
