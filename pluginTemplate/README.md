# TeddyCloud Plugin Template

This is a minimal starter for creating TeddyCloud plugins.  
It includes theme compatibility, a version display, and a simple `index.html` placeholder section.

---

## Plugin Folder Structure & Requirements

To make your plugin **discoverable** and listed in the **Community navigation**, it must follow this structure and include a valid `index.html` and `plugin.json` file.  
An optional `preview.png` will be shown as an image in the plugin card.

### Folder Structure

```
your-plugin-name/
├── plugin.json
├── index.html
├── script.js (optional)
├── preview.png (optional)
└── (other plugin files)
```

---

## `plugin.json` - Required Metadata

Every plugin must include a **`plugin.json`** file in its root.  
This file describes the plugin and allows it to be displayed properly in the TeddyCloud UI.

### Example

```json
{
  "pluginName": "Awesome Plugin",
  "description": "A short summary of what this plugin does.",
  "author": "Author's name",
  "version": "1.0.0",
  "pluginHomepage": "https://example.com",
  "teddyCloudSection": "tonies",
  "icon": "TrophyOutlined"
}
```

### Fields

- **`pluginName`** *(required)*  
  The title shown in menus.

- **`description`**  
  Short summary of the plugin's purpose.

- **`author`**  
  Name of the author or maintainer.

- **`version`**  
  Version string of the plugin (e.g. `1.0.0`).

- **`pluginHomepage`**  
  Optional link to the plugin's homepage or repository.

- **`teddyCloudSection`**  
  The section in TeddyCloud where the plugin will appear.  
  **Valid values:**  
  - `home`  
  - `tonies`  
  - `tonieboxes`  
  - `settings`  
  - `community`  

- **`icon`**  
  The icon used for the plugin. Must be a valid Ant Design icon component from https://ant.design/components/icon.  
  **Examples:**  
  - `TrophyOutlined`  
  - `TagsOutlined` 

---

## Requirements Summary

- `plugin.json` → **mandatory**  
- `index.html` → **mandatory**  
- `script.js` → optional  
- `preview.png` → optional (displayed in plugin card)  
- Other files → optional (JS, CSS, assets, etc.)  

---

**Tip:** Keep your plugin self-contained. Avoid relying on external CDNs if possible, so your plugin works offline in TeddyCloud.