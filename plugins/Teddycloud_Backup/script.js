// TeddyCloud Backup Plugin
// Vollständiges Backup aller TeddyCloud-Daten inkl. Audio-Dateien
// Unterstützt pro-Toniebox-Overlays mit Größenschätzung

(function () {
  "use strict";

  const PLUGIN_NAME = "TeddyCloud Backup";
  const PLUGIN_VERSION = "1.0.0";

  // ============================================================
  // DOM HELPERS
  // ============================================================
  function el(id) {
    return document.getElementById(id);
  }

  function log(message, type = "info") {
    const logOutput = el("logOutput");
    const timestamp = new Date().toLocaleTimeString("de-DE");
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : type === "warn" ? "⚠️" : "ℹ️";
    logOutput.value += `[${timestamp}] ${prefix} ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function setProgress(containerId, fillId, textId, percent, statusId, statusText) {
    const container = el(containerId);
    const fill = el(fillId);
    const text = el(textId);
    const status = el(statusId);

    container.classList.add("active");
    fill.style.width = percent + "%";
    text.textContent = Math.round(percent) + "%";
    if (status && statusText) {
      status.textContent = statusText;
    }
  }

  function hideProgress(containerId) {
    el(containerId).classList.remove("active");
  }

  // ============================================================
  // API HELPERS
  // ============================================================
  async function apiFetch(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      log(`API-Fehler bei ${endpoint}: ${error.message}`, "error");
      throw error;
    }
  }

  async function apiJson(endpoint, options = {}) {
    const response = await apiFetch(endpoint, options);
    return response.json();
  }

  async function apiBlob(endpoint, options = {}) {
    const response = await apiFetch(endpoint, options);
    return response.blob();
  }

  async function apiText(endpoint, options = {}) {
    const response = await apiFetch(endpoint, options);
    return response.text();
  }

  // ============================================================
  // STATE
  // ============================================================
  let tonieboxes = [];
  let estimatedSize = 0;
  let currentZip = null;
  let parsedBackup = null;

  // ============================================================
  // LOAD TONIEBOXES
  // ============================================================
  async function loadTonieboxes() {
    const boxSelect = el("boxSelect");
    try {
      log("Lade Tonieboxen...");
      const data = await apiJson("/api/getBoxes");
      
      tonieboxes = [];
      boxSelect.innerHTML = "";

      // Add "All boxes" option
      const allOption = document.createElement("option");
      allOption.value = "__all__";
      allOption.textContent = "🎁 Alle Tonieboxen";
      allOption.selected = true;
      boxSelect.appendChild(allOption);

      // Add "Global only" option
      const globalOption = document.createElement("option");
      globalOption.value = "__global__";
      globalOption.textContent = "🌐 Nur globale Daten (keine Box-spezifischen)";
      boxSelect.appendChild(globalOption);

      // Add individual boxes
      const boxes = data && data.boxes ? data.boxes : (Array.isArray(data) ? data : []);
      if (boxes.length > 0) {
        boxes.forEach((box) => {
          tonieboxes.push(box);
          const option = document.createElement("option");
          option.value = box.ID || box.id || box.boxId;
          option.textContent = `📦 ${box.boxName || box.name || box.ID || "Unbekannte Box"}`;
          boxSelect.appendChild(option);
        });
        log(`${tonieboxes.length} Tonieboxen geladen`, "success");
      } else {
        log("Keine Tonieboxen gefunden", "warn");
      }
    } catch (error) {
      boxSelect.innerHTML = '<option value="__global__">🌐 Nur globale Daten</option>';
      log("Konnte Tonieboxen nicht laden - nur globale Daten verfügbar", "warn");
    }
  }

  // ============================================================
  // SIZE ESTIMATION
  // ============================================================
  async function estimateBackupSize() {
    const btnEstimate = el("btnEstimate");
    const btnBackup = el("btnBackup");
    const sizeInfo = el("sizeInfo");
    const sizeValue = el("sizeValue");
    const sizeWarning = el("sizeWarning");

    btnEstimate.disabled = true;
    btnEstimate.textContent = "⏳ Berechne...";
    estimatedSize = 0;

    try {
      const selectedBoxes = getSelectedBoxes();
      const options = getBackupOptions();

      log("Berechne Backup-Größe...");

      // Estimate settings size (small, ~10KB per overlay)
      if (options.settings) {
        estimatedSize += 10 * 1024 * (selectedBoxes.length || 1);
        log(`Einstellungen: ~${formatBytes(10 * 1024 * (selectedBoxes.length || 1))}`);
      }

      // Estimate certificates (small, ~5KB)
      if (options.certs) {
        estimatedSize += 5 * 1024;
        log(`Zertifikate: ~${formatBytes(5 * 1024)}`);
      }

      // Estimate Tonies DB (medium, ~500KB)
      if (options.toniesDb) {
        estimatedSize += 500 * 1024;
        log(`Tonies-DB: ~${formatBytes(500 * 1024)}`);
      }

      // Estimate content metadata and audio from tag index
      if (options.content || options.audio) {
        try {
          const data = await apiJson("/api/getTagIndex");
          const tags = data && data.tags ? data.tags : (Array.isArray(data) ? data : []);
          
          if (tags.length > 0) {
            log(`${tags.length} Tags gefunden`);
            
            // Content metadata (~2KB per tag for JSON files)
            if (options.content) {
              const contentSize = tags.length * 2 * 1024;
              estimatedSize += contentSize;
              log(`Content-Metadaten: ~${formatBytes(contentSize)} (${tags.length} Tags)`);
            }
            
            // Audio files - use actual size from tafHeader if available
            if (options.audio) {
              let audioSize = 0;
              let audioCount = 0;
              for (const tag of tags) {
                // Check if file exists and has size info
                // Try different possible field locations
                let tagSize = 0;
                if (tag.tafHeader && tag.tafHeader.size) {
                  tagSize = tag.tafHeader.size;
                } else if (tag.tafHeader && tag.tafHeader.num_bytes) {
                  tagSize = tag.tafHeader.num_bytes;
                } else if (tag.size) {
                  tagSize = tag.size;
                } else if (tag.tagInfo && tag.tagInfo.tafHeader && tag.tagInfo.tafHeader.size) {
                  tagSize = tag.tagInfo.tafHeader.size;
                }
                
                if (tag.exists && tagSize > 0) {
                  audioSize += tagSize;
                  audioCount++;
                } else if (tag.exists) {
                  // Fallback: estimate ~50MB per existing audio file
                  audioSize += 50 * 1024 * 1024;
                  audioCount++;
                }
              }
              if (audioSize > 0) {
                estimatedSize += audioSize;
                log(`Audio-Dateien: ${formatBytes(audioSize)} (${audioCount} Dateien)`);
              } else {
                log("Keine Audio-Dateien vorhanden", "info");
              }
            }
          } else {
            log("Keine Tags gefunden", "warn");
          }
        } catch (e) {
          // Fallback estimates
          if (options.content) {
            estimatedSize += 50 * 1024;
          }
          log(`Konnte Tag-Index nicht laden: ${e.message}`, "warn");
        }
      }

      // Show result
      sizeInfo.classList.add("active");
      sizeValue.textContent = formatBytes(estimatedSize);

      // Warning for large backups (> 1GB)
      if (estimatedSize > 1024 * 1024 * 1024) {
        sizeWarning.style.display = "block";
        sizeInfo.classList.add("warning");
      } else {
        sizeWarning.style.display = "none";
        sizeInfo.classList.remove("warning");
      }

      btnBackup.disabled = false;
      log(`Geschätzte Größe: ${formatBytes(estimatedSize)}`, "success");

    } catch (error) {
      log(`Fehler bei Größenschätzung: ${error.message}`, "error");
    } finally {
      btnEstimate.disabled = false;
      btnEstimate.textContent = "📊 Größe berechnen";
    }
  }

  function getSelectedBoxes() {
    const boxSelect = el("boxSelect");
    const selected = Array.from(boxSelect.selectedOptions).map((o) => o.value);

    if (selected.includes("__all__")) {
      return tonieboxes.map((b) => b.ID || b.id || b.boxId);
    }
    if (selected.includes("__global__")) {
      return [];
    }
    return selected;
  }

  function getBackupOptions() {
    return {
      certs: el("chkCerts").checked,
      settings: el("chkSettings").checked,
      content: el("chkContent").checked,
      audio: el("chkAudio").checked,
      toniesDb: el("chkToniesDb").checked,
    };
  }

  // ============================================================
  // DIRECTORY DOWNLOAD HELPER
  // ============================================================
  async function downloadDirectoryRecursive(fileIndexUrl, basePath, zipFolder) {
    try {
      const data = await apiJson(fileIndexUrl);
      const files = data.files || [];

      for (const file of files) {
        const fileName = file.name;
        const filePath = basePath + "/" + fileName;
        
        if (file.isDirectory) {
          // Recursively download subdirectory
          const subFolder = zipFolder.folder(fileName);
          const subPath = fileIndexUrl.includes("?") 
            ? fileIndexUrl.replace(/path=[^&]*/, `path=/${filePath}`)
            : `${fileIndexUrl}?path=/${filePath}`;
          await downloadDirectoryRecursive(subPath, filePath, subFolder);
        } else {
          // Download file
          try {
            const specialMatch = fileIndexUrl.match(/special=([^&]*)/);
            const special = specialMatch ? specialMatch[1] : "content";
            const fileUrl = `/api/getFile/${special}/${filePath}`;
            const fileBlob = await apiBlob(fileUrl);
            zipFolder.file(fileName, fileBlob);
            log(`  ${filePath} (${formatBytes(fileBlob.size)})`);
          } catch (e) {
            log(`Fehler beim Download: ${filePath}`, "warn");
          }
        }
      }
    } catch (e) {
      log(`Fehler beim Listen von ${basePath}: ${e.message}`, "warn");
    }
  }

  // ============================================================
  // BACKUP CREATION
  // ============================================================
  async function createBackup() {
    const btnBackup = el("btnBackup");
    const btnEstimate = el("btnEstimate");

    btnBackup.disabled = true;
    btnEstimate.disabled = true;
    btnBackup.textContent = "⏳ Backup läuft...";

    const zip = new JSZip();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `teddycloud-backup-${timestamp}`;

    const selectedBoxes = getSelectedBoxes();
    const options = getBackupOptions();

    let totalSteps = 0;
    let currentStep = 0;

    // Calculate total steps
    if (options.certs) totalSteps += 5;  // ca.der, client.der, private.der, config/, firmware/
    if (options.toniesDb) totalSteps += 4;
    if (options.settings) totalSteps += 1 + selectedBoxes.length;
    if (options.content) totalSteps += 3;  // content/, library/, cache/
    if (options.audio) totalSteps += 1;

    const updateProgress = (status) => {
      currentStep++;
      const percent = (currentStep / totalSteps) * 100;
      setProgress("backupProgress", "backupProgressFill", "backupProgressText", percent, "backupStatus", status);
    };

    try {
      log(`Starte Backup: ${backupName}`);

      // Create manifest
      const manifest = {
        version: PLUGIN_VERSION,
        timestamp: new Date().toISOString(),
        boxes: [],
        components: options,
      };

      // ========== GLOBAL DATA ==========
      const globalFolder = zip.folder("global");

      // Certificates
      if (options.certs) {
        log("Sichere Zertifikate...");
        const certsFolder = globalFolder.folder("certs");
        
        // Download all certificates with original names
        try {
          const caCert = await apiBlob("/api/getFile/ca.der");
          certsFolder.file("ca.der", caCert);
          updateProgress("Zertifikate: ca.der");
        } catch (e) {
          log("ca.der nicht verfügbar", "warn");
          updateProgress("Zertifikate: ca.der (nicht verfügbar)");
        }

        try {
          const clientCert = await apiBlob("/api/getFile/client.der");
          certsFolder.file("client.der", clientCert);
          updateProgress("Zertifikate: client.der");
        } catch (e) {
          log("client.der nicht verfügbar (normal wenn noch nicht erstellt)", "warn");
          updateProgress("Zertifikate: client.der (nicht verfügbar)");
        }

        try {
          const privateCert = await apiBlob("/api/getFile/private.der");
          certsFolder.file("private.der", privateCert);
          updateProgress("Zertifikate: private.der");
        } catch (e) {
          log("private.der nicht verfügbar (normal wenn noch nicht erstellt)", "warn");
          updateProgress("Zertifikate: private.der (nicht verfügbar)");
        }

        // Download config directory recursively
        log("Sichere Config-Verzeichnis...");
        try {
          await downloadDirectoryRecursive("/api/fileIndex?special=config&path=/", "config", globalFolder.folder("config"));
          updateProgress("Config-Verzeichnis");
        } catch (e) {
          log("Config-Verzeichnis nicht verfügbar", "warn");
          updateProgress("Config-Verzeichnis (nicht verfügbar)");
        }

        // Download firmware directory
        log("Sichere Firmware-Verzeichnis...");
        try {
          await downloadDirectoryRecursive("/api/fileIndex?special=firmware&path=/", "firmware", globalFolder.folder("firmware"));
          updateProgress("Firmware-Verzeichnis");
        } catch (e) {
          log("Firmware-Verzeichnis nicht verfügbar", "warn");
          updateProgress("Firmware-Verzeichnis (nicht verfügbar)");
        }
      }

      // Tonies Database
      if (options.toniesDb) {
        log("Sichere Tonies-Datenbank...");
        try {
          const toniesJson = await apiText("/api/toniesJson");
          globalFolder.file("tonies.json", toniesJson);
          updateProgress("Tonies-Datenbank");
        } catch (e) {
          log("tonies.json nicht verfügbar", "warn");
          updateProgress("Tonies-Datenbank (nicht verfügbar)");
        }

        try {
          const toniesCustom = await apiText("/api/toniesCustomJson");
          globalFolder.file("tonies-custom.json", toniesCustom);
          updateProgress("Tonies-Custom");
        } catch (e) {
          updateProgress("Tonies-Custom (nicht verfügbar)");
        }

        try {
          const tonieboxJson = await apiText("/api/tonieboxesJson");
          globalFolder.file("tonieboxes.json", tonieboxJson);
          updateProgress("Toniebox-Modelle");
        } catch (e) {
          updateProgress("Toniebox-Modelle (nicht verfügbar)");
        }

        try {
          const tonieboxCustom = await apiText("/api/tonieboxesCustomJson");
          globalFolder.file("tonieboxes-custom.json", tonieboxCustom);
          updateProgress("Toniebox-Custom");
        } catch (e) {
          updateProgress("Toniebox-Custom (nicht verfügbar)");
        }
      }

      // Global settings
      if (options.settings) {
        log("Sichere globale Einstellungen...");
        try {
          const globalSettings = await apiText("/api/settings/getIndex?internal=true");
          globalFolder.file("settings.json", globalSettings);
          updateProgress("Globale Einstellungen");
        } catch (e) {
          log("Globale Einstellungen nicht verfügbar", "warn");
          updateProgress("Globale Einstellungen (nicht verfügbar)");
        }
      }

      // ========== PER-BOX DATA ==========
      for (const boxId of selectedBoxes) {
        const box = tonieboxes.find((b) => (b.ID || b.id || b.boxId) === boxId);
        const boxName = box ? (box.boxName || box.name || boxId) : boxId;
        const safeBoxName = boxName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const boxFolder = zip.folder(`boxes/${safeBoxName}`);

        manifest.boxes.push({
          id: boxId,
          name: boxName,
          safeName: safeBoxName,
        });

        log(`Sichere Box: ${boxName}`);

        // Box settings
        if (options.settings) {
          try {
            const boxSettings = await apiText(`/api/settings/getIndex?overlay=${boxId}&internal=true`);
            boxFolder.file("settings.json", boxSettings);
            updateProgress(`${boxName}: Einstellungen`);
          } catch (e) {
            log(`Einstellungen für ${boxName} nicht verfügbar`, "warn");
            updateProgress(`${boxName}: Einstellungen (nicht verfügbar)`);
          }
        }

        // Box overlay info
        boxFolder.file("overlay-info.json", JSON.stringify({
          boxId: boxId,
          boxName: boxName,
          backupDate: new Date().toISOString(),
        }, null, 2));
      }

      // ========== CONTENT & AUDIO ==========
      if (options.content || options.audio) {
        log("Sichere Content-Daten...");

        // Download library directory
        if (options.content) {
          log("Sichere Library-Verzeichnis...");
          try {
            await downloadDirectoryRecursive("/api/fileIndex?special=library&path=/", "library", zip.folder("library"));
            updateProgress("Library-Verzeichnis");
          } catch (e) {
            log("Library-Verzeichnis nicht verfügbar", "warn");
            updateProgress("Library-Verzeichnis (nicht verfügbar)");
          }

          // Download cache directory
          log("Sichere Cache-Verzeichnis...");
          try {
            await downloadDirectoryRecursive("/api/fileIndex?special=cache&path=/", "cache", zip.folder("cache"));
            updateProgress("Cache-Verzeichnis");
          } catch (e) {
            log("Cache-Verzeichnis nicht verfügbar", "warn");
            updateProgress("Cache-Verzeichnis (nicht verfügbar)");
          }

          // Download custom images
          log("Sichere Custom-Images...");
          try {
            await downloadDirectoryRecursive("/api/fileIndex?special=www&path=/custom_img", "custom_img", zip.folder("custom_img"));
            updateProgress("Custom-Images");
          } catch (e) {
            log("Custom-Images nicht verfügbar", "warn");
            updateProgress("Custom-Images (nicht verfügbar)");
          }
        }

        updateProgress("Content-Daten");

        try {
          // Get all tags
          const data = await apiJson("/api/getTagIndex");
          const tags = data && data.tags ? data.tags : (Array.isArray(data) ? data : []);
          const contentFolder = zip.folder("content");

          if (tags.length > 0) {
            // Save tag index
            contentFolder.file("tag-index.json", JSON.stringify(tags, null, 2));

            // Process each tag
            let tagCount = 0;
            for (const tag of tags) {
              const ruid = tag.ruid || tag.uid;
              if (!ruid) continue;

              // Content metadata
              if (options.content) {
                try {
                  const contentJson = await apiText(`/content/json/get/${ruid}`);
                  contentFolder.file(`${ruid}/content.json`, contentJson);
                } catch (e) {
                  // Content JSON may not exist for all tags
                }
              }

              // Audio file
              if (options.audio && tag.exists) {
                try {
                  // Use audioUrl from tag info if available, or construct from RUID
                  let audioUrl = tag.audioUrl;
                  if (!audioUrl && ruid) {
                    // Construct path from RUID: first 8 chars = dir, rest = file
                    const dir = ruid.substring(0, 8).toUpperCase();
                    const file = ruid.substring(8).toUpperCase();
                    audioUrl = `/content/${dir}/${file}?ogg=true`;
                  }
                  if (audioUrl) {
                    const audioBlob = await apiBlob(audioUrl);
                    const fileName = `${ruid}.taf`;
                    contentFolder.file(`${ruid}/${fileName}`, audioBlob);
                    log(`Audio: ${fileName} (${formatBytes(audioBlob.size)})`);
                  }
                } catch (e) {
                  log(`Audio für ${ruid} nicht verfügbar`, "warn");
                }
              }

              tagCount++;
              // Update progress periodically
              if (tagCount % 10 === 0) {
                setProgress("backupProgress", "backupProgressFill", "backupProgressText",
                  50 + (tagCount / tags.length) * 40,
                  "backupStatus", `Content: ${tagCount}/${tags.length} Tags`);
              }
            }

            log(`${tagCount} Tags verarbeitet`, "success");
          } else {
            log("Keine Tags gefunden", "warn");
          }
        } catch (e) {
          log(`Fehler beim Content-Backup: ${e.message}`, "error");
        }
      }

      // Save manifest
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      // Generate ZIP
      log("Erstelle ZIP-Archiv...");
      setProgress("backupProgress", "backupProgressFill", "backupProgressText", 95, "backupStatus", "ZIP wird erstellt...");

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      }, (metadata) => {
        setProgress("backupProgress", "backupProgressFill", "backupProgressText",
          95 + (metadata.percent * 0.05),
          "backupStatus", `ZIP: ${Math.round(metadata.percent)}%`);
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${backupName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress("backupProgress", "backupProgressFill", "backupProgressText", 100, "backupStatus", "Fertig!");
      log(`Backup erstellt: ${backupName}.zip (${formatBytes(blob.size)})`, "success");

    } catch (error) {
      log(`Backup fehlgeschlagen: ${error.message}`, "error");
    } finally {
      btnBackup.disabled = false;
      btnEstimate.disabled = false;
      btnBackup.textContent = "💾 Backup starten";
      setTimeout(() => hideProgress("backupProgress"), 3000);
    }
  }

  // ============================================================
  // RESTORE - FILE PARSING
  // ============================================================
  async function handleRestoreFile(file) {
    const restoreInfo = el("restoreInfo");
    const restoreDetails = el("restoreDetails");
    const restoreMapping = el("restoreMapping");
    const mappingContainer = el("mappingContainer");
    const btnRestore = el("btnRestore");

    el("selectedFileName").textContent = file.name;

    try {
      log(`Lade Backup-Datei: ${file.name}`);
      currentZip = await JSZip.loadAsync(file);

      // Parse manifest
      const manifestFile = currentZip.file("manifest.json");
      if (!manifestFile) {
        throw new Error("Keine manifest.json gefunden - ungültiges Backup");
      }

      const manifest = JSON.parse(await manifestFile.async("text"));
      parsedBackup = {
        manifest: manifest,
        zip: currentZip,
      };

      // Show backup info
      restoreInfo.style.display = "block";
      let detailsHtml = `
        <div>📅 Erstellt: ${new Date(manifest.timestamp).toLocaleString("de-DE")}</div>
        <div>📦 Version: ${manifest.version}</div>
        <div>📋 Komponenten:</div>
        <ul style="margin: 4px 0 0 20px;">
      `;

      if (manifest.components.certs) detailsHtml += "<li>🔐 Zertifikate</li>";
      if (manifest.components.settings) detailsHtml += "<li>⚙️ Einstellungen</li>";
      if (manifest.components.content) detailsHtml += "<li>📁 Content-Metadaten</li>";
      if (manifest.components.audio) detailsHtml += "<li>🎵 Audio-Dateien</li>";
      if (manifest.components.toniesDb) detailsHtml += "<li>📚 Tonies-Datenbank</li>";

      detailsHtml += "</ul>";

      if (manifest.boxes && manifest.boxes.length > 0) {
        detailsHtml += `<div style="margin-top: 8px;">📦 Tonieboxen im Backup:</div><ul style="margin: 4px 0 0 20px;">`;
        manifest.boxes.forEach((box) => {
          detailsHtml += `<li>${box.name} (${box.id})</li>`;
        });
        detailsHtml += "</ul>";
      }

      restoreDetails.innerHTML = detailsHtml;

      // Show overlay mapping if boxes in backup
      if (manifest.boxes && manifest.boxes.length > 0) {
        restoreMapping.classList.add("active");
        mappingContainer.innerHTML = "";

        for (const box of manifest.boxes) {
          const mappingItem = document.createElement("div");
          mappingItem.className = "mapping-item";

          const sourceLabel = document.createElement("span");
          sourceLabel.textContent = `📦 ${box.name}`;

          const arrow = document.createElement("span");
          arrow.className = "mapping-arrow";
          arrow.textContent = "→";

          const targetSelect = document.createElement("select");
          targetSelect.id = `mapping_${box.id}`;
          targetSelect.innerHTML = `<option value="__skip__">⏭️ Überspringen</option>`;

          // Add current tonieboxes as targets
          tonieboxes.forEach((tbox) => {
            const tid = tbox.ID || tbox.id || tbox.boxId;
            const tname = tbox.boxName || tbox.name || tid;
            const selected = tid === box.id ? "selected" : "";
            targetSelect.innerHTML += `<option value="${tid}" ${selected}>${tname}</option>`;
          });

          mappingItem.appendChild(sourceLabel);
          mappingItem.appendChild(arrow);
          mappingItem.appendChild(targetSelect);
          mappingContainer.appendChild(mappingItem);
        }
      } else {
        restoreMapping.classList.remove("active");
      }

      btnRestore.disabled = false;
      log("Backup-Datei erfolgreich geladen", "success");

    } catch (error) {
      log(`Fehler beim Laden des Backups: ${error.message}`, "error");
      restoreInfo.style.display = "none";
      restoreMapping.classList.remove("active");
      btnRestore.disabled = true;
    }
  }

  // ============================================================
  // RESTORE - EXECUTION
  // ============================================================
  async function executeRestore() {
    if (!parsedBackup) {
      log("Kein Backup geladen", "error");
      return;
    }

    // Confirmation
    if (!confirm("⚠️ WARNUNG: Die Wiederherstellung überschreibt vorhandene Daten!\n\nFortfahren?")) {
      log("Wiederherstellung abgebrochen", "warn");
      return;
    }

    const btnRestore = el("btnRestore");
    btnRestore.disabled = true;
    btnRestore.textContent = "⏳ Wiederherstellen...";

    const manifest = parsedBackup.manifest;
    const zip = parsedBackup.zip;

    let totalSteps = 0;
    let currentStep = 0;

    // Calculate steps
    if (manifest.components.certs) totalSteps += 3;
    if (manifest.components.toniesDb) totalSteps += 4;
    if (manifest.components.settings) totalSteps += 1;
    if (manifest.boxes) totalSteps += manifest.boxes.length;

    const updateProgress = (status) => {
      currentStep++;
      const percent = (currentStep / totalSteps) * 100;
      setProgress("restoreProgress", "restoreProgressFill", "restoreProgressText", percent, "restoreStatus", status);
    };

    try {
      log("Starte Wiederherstellung...");

      // ========== CERTIFICATES ==========
      if (manifest.components.certs) {
        log("Stelle Zertifikate wieder her...");

        const certFiles = ["ca.der", "client.der", "private.der"];
        for (const certFile of certFiles) {
          const file = zip.file(`global/certs/${certFile}`);
          if (file) {
            try {
              const blob = await file.async("blob");
              const formData = new FormData();
              formData.append("file", blob, certFile);
              await fetch("/api/uploadCert", { method: "POST", body: formData });
              log(`Zertifikat wiederhergestellt: ${certFile}`, "success");
            } catch (e) {
              log(`Fehler bei ${certFile}: ${e.message}`, "error");
            }
          }
          updateProgress(`Zertifikat: ${certFile}`);
        }
      }

      // ========== TONIES DATABASE ==========
      if (manifest.components.toniesDb) {
        log("Stelle Tonies-Datenbank wieder her...");

        const dbFiles = [
          { zip: "tonies.json", endpoint: "/api/toniesJson" },
          { zip: "tonies-custom.json", endpoint: "/api/toniesCustomJson" },
          { zip: "tonieboxes.json", endpoint: "/api/tonieboxesJson" },
          { zip: "tonieboxes-custom.json", endpoint: "/api/tonieboxesCustomJson" },
        ];

        for (const dbFile of dbFiles) {
          const file = zip.file(`global/${dbFile.zip}`);
          if (file) {
            try {
              const content = await file.async("text");
              // Note: TeddyCloud may not have POST endpoints for all these
              // This is a placeholder for when the API supports it
              log(`DB-Datei gefunden: ${dbFile.zip}`, "info");
            } catch (e) {
              log(`Fehler bei ${dbFile.zip}: ${e.message}`, "warn");
            }
          }
          updateProgress(`Datenbank: ${dbFile.zip}`);
        }
      }

      // ========== GLOBAL SETTINGS ==========
      if (manifest.components.settings) {
        log("Stelle globale Einstellungen wieder her...");

        const settingsFile = zip.file("global/settings.json");
        if (settingsFile) {
          try {
            const settingsData = JSON.parse(await settingsFile.async("text"));
            // Settings are in {options: [{ID, value, ...}]} format
            const options = settingsData.options || [];
            for (const opt of options) {
              if (!opt.ID || opt.ID.startsWith("internal.")) continue;
              try {
                const value = String(opt.value);
                await fetch(`/api/settings/set/${opt.ID}`, {
                  method: "POST",
                  headers: { "Content-Type": "text/plain" },
                  body: value,
                });
              } catch (e) {
                // Individual setting errors are not critical
              }
            }
            log("Globale Einstellungen wiederhergestellt", "success");
          } catch (e) {
            log(`Fehler bei Einstellungen: ${e.message}`, "error");
          }
        }
        updateProgress("Globale Einstellungen");
      }

      // ========== BOX-SPECIFIC DATA ==========
      if (manifest.boxes && manifest.boxes.length > 0) {
        for (const box of manifest.boxes) {
          const mappingSelect = el(`mapping_${box.id}`);
          const targetBoxId = mappingSelect ? mappingSelect.value : box.id;

          if (targetBoxId === "__skip__") {
            log(`Überspringe Box: ${box.name}`, "info");
            updateProgress(`Übersprungen: ${box.name}`);
            continue;
          }

          log(`Stelle Box wieder her: ${box.name} → ${targetBoxId}`);

          // Restore box settings
          if (manifest.components.settings) {
            const boxSettingsFile = zip.file(`boxes/${box.safeName}/settings.json`);
            if (boxSettingsFile) {
              try {
                const settingsData = JSON.parse(await boxSettingsFile.async("text"));
                const options = settingsData.options || [];
                for (const opt of options) {
                  if (!opt.ID || opt.ID.startsWith("internal.")) continue;
                  if (!opt.overlayed) continue; // Only restore overlayed settings
                  try {
                    const value = String(opt.value);
                    await fetch(`/api/settings/set/${opt.ID}?overlay=${targetBoxId}`, {
                      method: "POST",
                      headers: { "Content-Type": "text/plain" },
                      body: value,
                    });
                  } catch (e) {
                    // Individual setting errors
                  }
                }
                log(`Einstellungen für ${box.name} wiederhergestellt`, "success");
              } catch (e) {
                log(`Fehler bei Box-Einstellungen: ${e.message}`, "error");
              }
            }
          }

          updateProgress(`Box: ${box.name}`);
        }
      }

      // ========== CONTENT DATA ==========
      if (manifest.components.content) {
        log("Stelle Content-Metadaten wieder her...");

        const contentFolder = zip.folder("content");
        if (contentFolder) {
          const contentFiles = [];
          zip.folder("content").forEach((relativePath, file) => {
            if (relativePath.endsWith("/content.json")) {
              contentFiles.push({ path: relativePath, file: file });
            }
          });

          for (const cf of contentFiles) {
            try {
              const ruid = cf.path.split("/")[0];
              const content = await cf.file.async("text");
              await fetch(`/content/json/set/${ruid}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: content,
              });
            } catch (e) {
              // Individual content restore errors
            }
          }

          log(`${contentFiles.length} Content-Einträge verarbeitet`, "success");
        }
      }

      // ========== AUDIO FILES ==========
      if (manifest.components.audio) {
        log("Audio-Dateien: Upload muss manuell erfolgen (zu große Datenmenge)", "warn");
      }

      // Reload config
      try {
        await fetch("/api/triggerReloadConfig");
        log("Konfiguration neu geladen", "success");
      } catch (e) {
        log("Konnte Konfiguration nicht neu laden", "warn");
      }

      setProgress("restoreProgress", "restoreProgressFill", "restoreProgressText", 100, "restoreStatus", "Fertig!");
      log("Wiederherstellung abgeschlossen!", "success");

    } catch (error) {
      log(`Wiederherstellung fehlgeschlagen: ${error.message}`, "error");
    } finally {
      btnRestore.disabled = false;
      btnRestore.textContent = "⚠️ Wiederherstellen";
      setTimeout(() => hideProgress("restoreProgress"), 3000);
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  function applyVersion() {
    const verEl = el("scriptVersion");
    if (verEl) verEl.textContent = `(v${PLUGIN_VERSION})`;
    try {
      document.title = `${PLUGIN_NAME} (v${PLUGIN_VERSION})`;
    } catch (_) {}
  }

  function bindEvents() {
    // Backup events
    el("btnEstimate").addEventListener("click", estimateBackupSize);
    el("btnBackup").addEventListener("click", createBackup);

    // Restore events
    el("restoreFile").addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleRestoreFile(e.target.files[0]);
      }
    });
    el("btnRestore").addEventListener("click", executeRestore);

    // Log events
    el("btnClearLog").addEventListener("click", () => {
      el("logOutput").value = "";
    });
  }

  async function init() {
    applyVersion();
    bindEvents();
    log(`${PLUGIN_NAME} v${PLUGIN_VERSION} gestartet`);
    await loadTonieboxes();
  }

  if (document.readyState !== "loading") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
