// TeddycloudKidsUI - Kids Tag Linker Plugin
// A kid-friendly interface for assigning audio to Tonie tags
(function () {
  "use strict";

  const PLUGIN_NAME = "Tonie Auswahl";
  const PLUGIN_VERSION = "0.3.0";

  // Items-per-page default coupled to list icon size: large icons fit fewer per row.
  const ITEMS_PER_PAGE_OPTIONS = [9, 18, 27, 36];
  function itemsPerPageForListSize(size) {
    return size === "L" ? 18 : 27;
  }

  // ============================================
  // Internationalization (i18n)
  // ============================================
  const i18n = {
    de: {
      // Splash Screen
      splash_title: "Lust auf eine neue Geschichte?",
      splash_button: "Los geht's!",

      // Box Selection
      box_title: "Welche Box gehört dir?",
      box_back: "Zurück",

      // Tag Placement
      tag_instruction: "Leg deinen Tonie auf die Box und warte...",
      tag_searching: "Suche...",
      tag_detected: "Tonie erkannt!",
      tag_current: "Aktuell:",
      tag_no_audio: "Noch keine Musik zugewiesen",
      tag_choose_other: "Geschichte wählen",
      tag_switch: "Anderen Tonie wählen",
      tag_back: "Andere Box wählen",
      tag_timeout: "Kein Tonie gefunden. Nochmal versuchen?",

      // Audio Selection
      audio_title: "Welche Geschichte möchtest du auf dem Tonie?",
      audio_back: "Zurück",
      audio_page: "Seite {current} / {total}",
      audio_loading: "Lade Musik...",

      // Confirmation
      confirm_question: "Diese Geschichte abspielen?",
      confirm_yes: "Ja",
      confirm_no: "Nein",

      // Success
      success_title: "Super!",
      success_message: "Dein Tonie spielt jetzt {title}!",
      success_again: "Weiteren Tonie bespielen",

      // Errors
      error_generic: "Etwas ist schief gelaufen",
      error_no_boxes: "Keine Tonieboxen gefunden",
      error_no_audio: "Keine Musik gefunden",
      error_link_failed: "Zuweisen fehlgeschlagen",
      error_retry: "Nochmal versuchen",

      // Fullscreen
      fullscreen_enter: "Vollbild",
      fullscreen_exit: "Vollbild beenden",

      // Settings dialog
      settings_open: "Einstellungen",
      settings_title: "Einstellungen",
      settings_items_per_page: "Einträge pro Seite",
      settings_list_icon: "Symbolgröße (Liste)",
      settings_detail_icon: "Symbolgröße (Detail)",
      settings_language: "Sprache",
      settings_lang_auto: "Automatisch",
      settings_size_s: "Klein",
      settings_size_m: "Mittel",
      settings_size_l: "Groß",
      settings_save: "Speichern",
      settings_cancel: "Abbrechen"
    },
    en: {
      // Splash Screen
      splash_title: "Ready for a new story?",
      splash_button: "Let's go!",

      // Box Selection
      box_title: "Which box is yours?",
      box_back: "Back",

      // Tag Placement
      tag_instruction: "Place your Tonie on the box and wait...",
      tag_searching: "Searching...",
      tag_detected: "Tonie detected!",
      tag_current: "Currently:",
      tag_no_audio: "No audio assigned yet",
      tag_choose_other: "Choose story",
      tag_switch: "Choose different Tonie",
      tag_back: "Choose another box",
      tag_timeout: "No Tonie found. Try again?",

      // Audio Selection
      audio_title: "Which story would you like on the Tonie?",
      audio_back: "Back",
      audio_page: "Page {current} / {total}",
      audio_loading: "Loading audio...",

      // Confirmation
      confirm_question: "Play this story?",
      confirm_yes: "Yes",
      confirm_no: "No",

      // Success
      success_title: "Awesome!",
      success_message: "Your Tonie now plays {title}!",
      success_again: "Set up another Tonie",

      // Errors
      error_generic: "Something went wrong",
      error_no_boxes: "No Tonieboxes found",
      error_no_audio: "No audio found",
      error_link_failed: "Linking failed",
      error_retry: "Try again",

      // Fullscreen
      fullscreen_enter: "Fullscreen",
      fullscreen_exit: "Exit Fullscreen",

      // Settings dialog
      settings_open: "Settings",
      settings_title: "Settings",
      settings_items_per_page: "Items per page",
      settings_list_icon: "Icon size (list)",
      settings_detail_icon: "Icon size (detail)",
      settings_language: "Language",
      settings_lang_auto: "Automatic",
      settings_size_s: "Small",
      settings_size_m: "Medium",
      settings_size_l: "Large",
      settings_save: "Save",
      settings_cancel: "Cancel"
    }
  };

  // ============================================
  // Settings (persistence with TC API + localStorage fallback)
  // ============================================
  const Settings = {
    defaults: {
      itemsPerPage: 27,
      listIconSize: "M",
      detailIconSize: "M",
      lang: "auto"
    },
    KEYS: {
      itemsPerPage: "plugin.kidsui.itemsPerPage",
      listIconSize: "plugin.kidsui.listIconSize",
      detailIconSize: "plugin.kidsui.detailIconSize",
      lang: "plugin.kidsui.lang"
    },
    PROBE_KEY: "plugin.kidsui.probe",
    LOCAL_PREFIX: "kidsui.",
    current: null,
    backend: "local",

    async _probeTC() {
      try {
        const body = new URLSearchParams({ value: "1" });
        const setRes = await fetch(`/api/settings/set/${this.PROBE_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString()
        });
        if (!setRes.ok) return false;
        const getRes = await fetch(
          `/api/settings/get/${this.PROBE_KEY}?_t=` + Date.now()
        );
        if (!getRes.ok) return false;
        const val = (await getRes.text()).replace(/"/g, "").trim();
        return val === "1";
      } catch (_) {
        return false;
      }
    },

    async _readTC(key) {
      try {
        const res = await fetch(`/api/settings/get/${key}?_t=` + Date.now());
        if (!res.ok) return null;
        const raw = (await res.text()).replace(/"/g, "").trim();
        return raw.length ? raw : null;
      } catch (_) {
        return null;
      }
    },

    async _writeTC(key, value) {
      try {
        const body = new URLSearchParams({ value: String(value) });
        const res = await fetch(`/api/settings/set/${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString()
        });
        return res.ok;
      } catch (_) {
        return false;
      }
    },

    _readLocal(key) {
      try {
        const v = localStorage.getItem(this.LOCAL_PREFIX + key);
        return v == null ? null : v;
      } catch (_) {
        return null;
      }
    },

    _writeLocal(key, value) {
      try {
        localStorage.setItem(this.LOCAL_PREFIX + key, String(value));
        return true;
      } catch (_) {
        return false;
      }
    },

    _coerce(name, raw) {
      if (raw == null) return this.defaults[name];
      if (name === "itemsPerPage") {
        const n = parseInt(raw, 10);
        return ITEMS_PER_PAGE_OPTIONS.includes(n) ? n : this.defaults[name];
      }
      if (name === "listIconSize" || name === "detailIconSize") {
        return ["S", "M", "L"].includes(raw) ? raw : this.defaults[name];
      }
      if (name === "lang") {
        return ["auto", "de", "en"].includes(raw) ? raw : this.defaults[name];
      }
      return this.defaults[name];
    },

    async load() {
      // TC settings API integration disabled pending clarification with TeddyCloud devs.
      // See docs/design/settings-persistence-tc-api.md for the deferred integration plan.
      this.current = { ...this.defaults };
      for (const name of Object.keys(this.defaults)) {
        const cached = this._readLocal(name);
        if (cached != null) this.current[name] = this._coerce(name, cached);
      }
      this.backend = "local";
      return this.current;
    },

    async save(partial) {
      Object.assign(this.current, partial);
      for (const [name, value] of Object.entries(partial)) {
        this._writeLocal(name, value);
        if (this.backend === "tc") {
          await this._writeTC(this.KEYS[name], value);
        }
      }
      return this.current;
    },

    get(name) {
      return this.current ? this.current[name] : this.defaults[name];
    }
  };

  // ============================================
  // Settings Dialog UI controller
  // ============================================
  const SettingsDialog = {
    modal: null,
    draft: null,

    init() {
      this.modal = document.getElementById("settings-modal");
      // Segmented buttons
      this.modal.querySelectorAll(".settings-segmented").forEach((group) => {
        const name = group.getAttribute("data-setting");
        group.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            const raw = btn.getAttribute("data-value");
            const value = name === "itemsPerPage" ? parseInt(raw, 10) : raw;
            this.draft[name] = value;
            this._renderActive(group, raw);
            if (name === "listIconSize") {
              const coupled = itemsPerPageForListSize(value);
              this.draft.itemsPerPage = coupled;
              const ippGroup = this.modal.querySelector(
                '.settings-segmented[data-setting="itemsPerPage"]'
              );
              if (ippGroup) this._renderActive(ippGroup, coupled);
            }
          });
        });
      });
      // Language select
      const langSel = this.modal.querySelector('select[data-setting="lang"]');
      langSel.addEventListener("change", () => {
        this.draft.lang = langSel.value;
      });
      // Cancel
      document
        .getElementById("btn-settings-cancel")
        .addEventListener("click", () => this.close());
      // Backdrop click = cancel
      this.modal
        .querySelector(".settings-backdrop")
        .addEventListener("click", () => this.close());
      // Save
      document
        .getElementById("btn-settings-save")
        .addEventListener("click", () => this.saveAndClose());
    },

    _renderActive(group, activeValue) {
      group.querySelectorAll("button").forEach((b) => {
        b.classList.toggle(
          "is-active",
          b.getAttribute("data-value") === String(activeValue)
        );
      });
    },

    _hydrate() {
      this.draft = { ...Settings.current };
      this.modal.querySelectorAll(".settings-segmented").forEach((group) => {
        const name = group.getAttribute("data-setting");
        this._renderActive(group, this.draft[name]);
      });
      this.modal.querySelector('select[data-setting="lang"]').value =
        this.draft.lang;
    },

    open() {
      this._hydrate();
      this.modal.classList.remove("hidden");
    },

    close() {
      this.modal.classList.add("hidden");
    },

    async saveAndClose() {
      const before = { ...Settings.current };
      const partial = {};
      for (const k of Object.keys(this.draft)) {
        if (this.draft[k] !== before[k]) partial[k] = this.draft[k];
      }
      if (Object.keys(partial).length === 0) {
        this.close();
        return;
      }
      await Settings.save(partial);
      if ("lang" in partial) {
        currentLang = detectLanguage();
        applyI18n();
      }
      if ("listIconSize" in partial) {
        document.documentElement.dataset.listSize = partial.listIconSize;
      }
      if ("detailIconSize" in partial) {
        document.documentElement.dataset.detailSize = partial.detailIconSize;
      }
      if ("itemsPerPage" in partial) {
        state.audioPerPage = partial.itemsPerPage;
        state.audioPage = 0;
      }
      this.close();
    }
  };

  // Detect language from settings, URL param (?lang=en), browser, or default to German
  function detectLanguage() {
    const settingsLang = Settings.get("lang");
    if (settingsLang && settingsLang !== "auto" && i18n[settingsLang]) {
      return settingsLang;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get("lang");
    if (urlLang && i18n[urlLang]) return urlLang;

    const browserLang = (navigator.language || navigator.userLanguage || "de").split("-")[0];
    return i18n[browserLang] ? browserLang : "de";
  }

  let currentLang = "de";

  function t(key, params = {}) {
    let text = (i18n[currentLang] && i18n[currentLang][key]) || key;
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      el.setAttribute("title", t(key));
      el.setAttribute("aria-label", t(key));
    });
  }

  // ============================================
  // State Machine
  // ============================================
  const SCREENS = {
    SPLASH: "splash",
    SELECT_BOX: "select_box",
    PLACE_TAG: "place_tag",
    SELECT_AUDIO: "select_audio",
    CONFIRM: "confirm",
    SUCCESS: "success",
    ERROR: "error"
  };

  const state = {
    currentScreen: SCREENS.SPLASH,
    selectedBox: null,      // { ID, boxName, boxModel, imageUrl }
    detectedTag: null,      // { ruid, currentAudio }
    selectedAudio: null,    // { source, title, series, pic }
    availableBoxes: [],
    availableAudio: [],
    filteredAudio: [],
    searchQuery: "",
    audioPage: 0,
    audioPerPage: 20,
    error: null
  };

  function setState(updates) {
    Object.assign(state, updates);
  }

  function navigateTo(screen, options = {}) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.add("hidden");
    });

    // Show target screen
    const targetScreen = document.querySelector(`[data-screen="${screen}"]`);
    if (targetScreen) {
      targetScreen.classList.remove("hidden");
    }

    state.currentScreen = screen;

    // Trigger screen-specific setup
    switch (screen) {
      case SCREENS.SPLASH:
        onSplashEnter();
        break;
      case SCREENS.SELECT_BOX:
        onSelectBoxEnter();
        break;
      case SCREENS.PLACE_TAG:
        onPlaceTagEnter();
        break;
      case SCREENS.SELECT_AUDIO:
        onSelectAudioEnter();
        break;
      case SCREENS.CONFIRM:
        onConfirmEnter();
        break;
      case SCREENS.SUCCESS:
        onSuccessEnter();
        break;
      case SCREENS.ERROR:
        onErrorEnter(options.error);
        break;
    }
  }

  // ============================================
  // API Module
  // ============================================
  const API = {
    async getBoxes() {
      const res = await fetch("/api/getBoxes");
      if (!res.ok) throw new Error("Failed to fetch boxes");
      const data = await res.json();
      return data.boxes || [];
    },

    async getBoxModels() {
      const res = await fetch("/api/tonieboxesJson");
      if (!res.ok) throw new Error("Failed to fetch box models");
      return res.json();
    },

    async getLastRuid(boxId) {
      const res = await fetch(
        `/api/settings/get/internal.last_ruid?overlay=${boxId}`
      );
      if (!res.ok) throw new Error("Failed to get RUID");
      const ruid = await res.text();
      return ruid.replace(/"/g, "").trim();
    },

    async getTagInfo(ruid) {
      // Add cache-busting to get fresh data
      const res = await fetch("/api/getTagIndex?_t=" + Date.now());
      if (!res.ok) throw new Error("Failed to fetch tag index");
      const data = await res.json();
      const tags = data.tags || [];
      console.log("Tag index fetched, looking for ruid:", ruid);
      const found = tags.find((tag) => tag.ruid === ruid);
      console.log("Found tag info:", found);
      return found || null;
    },

    async getAudioContent() {
      // Fetch available audio from the actual library (fileIndexV2 API)
      // This returns TAF files that are physically present on the server
      const allAudio = [];

      // Fetch custom tonie metadata for enrichment (has better title info)
      // Note: We only use this for metadata, NOT for file paths (audio_id != file path)
      let customMetadataMap = new Map();
      try {
        const customRes = await fetch("/api/toniesCustomJson");
        if (customRes.ok) {
          const customData = await customRes.json();
          (Array.isArray(customData) ? customData : []).forEach((item) => {
            if (item.audio_id && item.audio_id.length > 0) {
              // Map by audio_id for lookup during library scan
              customMetadataMap.set(String(item.audio_id[0]), item);
            }
          });
          console.log(`Loaded ${customMetadataMap.size} custom tonie metadata entries`);
        }
      } catch (e) {
        console.error("Error loading custom tonie metadata:", e);
      }

      // Helper to recursively scan library directories
      async function scanLibraryDir(path = "") {
        const url = path
          ? `/api/fileIndexV2?special=library&path=${encodeURIComponent(path)}`
          : "/api/fileIndexV2?special=library";

        const res = await fetch(url);
        if (!res.ok) return [];

        const data = await res.json();
        const files = data.files || [];
        const results = [];

        // Process files in this directory
        for (const file of files) {
          // Skip parent directory entry and non-TAF files
          if (file.name === ".." || file.isDir) continue;
          if (!file.name.toLowerCase().endsWith(".taf")) continue;

          // Only include files with valid tonieInfo (linked files)
          if (file.tonieInfo && file.tonieInfo.picture) {
            const fullPath = path ? `${path}/${file.name}` : file.name;

            // Check if we have enriched metadata from custom JSON (by audio_id)
            const audioId = file.tafHeader && file.tafHeader.audioId;
            const customMeta = audioId ? customMetadataMap.get(String(audioId)) : null;

            // Build title and series from available metadata
            let title, series;
            if (customMeta) {
              // Custom tonie: use title, and episodes as additional info
              title = customMeta.title || file.tonieInfo.series || file.name.replace(".taf", "");
              series = customMeta.episodes || "";
            } else {
              // Regular tonie: use episode as title, series as subtitle
              title = file.tonieInfo.episode || file.tonieInfo.series || file.name.replace(".taf", "");
              series = file.tonieInfo.series || "";
            }

            results.push({
              source: `lib://${fullPath}`,
              title: title,
              series: series,
              pic: file.tonieInfo.picture,
              model: file.tonieInfo.model
            });
          }
        }

        // Recursively scan subdirectories
        const subdirs = files.filter(f => f.isDir && f.name !== ".." && !f.name.startsWith("."));
        for (const dir of subdirs) {
          const subPath = path ? `${path}/${dir.name}` : dir.name;
          const subResults = await scanLibraryDir(subPath);
          results.push(...subResults);
        }

        return results;
      }

      try {
        const libraryAudio = await scanLibraryDir();
        allAudio.push(...libraryAudio);
        console.log(`Loaded ${libraryAudio.length} audio files from library`);
      } catch (e) {
        console.error("Error scanning library:", e);
      }

      // Deduplicate by source path
      const seen = new Set();
      const merged = [];

      allAudio.forEach((item) => {
        if (item.source && !seen.has(item.source)) {
          seen.add(item.source);
          merged.push(item);
        }
      });

      console.log(`Total unique audio items: ${merged.length}`);
      return merged;
    },

    async linkAudioToTag(ruid, sourcePath) {
      const body = new URLSearchParams({
        source: sourcePath,
        nocloud: "true"
      });

      const res = await fetch(`/content/json/set/${ruid}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });

      if (!res.ok) throw new Error("Failed to link audio");
      return true;
    }
  };

  // ============================================
  // Tag Polling
  // ============================================
  class TagPoller {
    constructor(boxId, options = {}) {
      this.boxId = boxId;
      this.onTagDetected = options.onTagDetected || null;
      this.onTagRemoved = options.onTagRemoved || null;
      this.onTimeout = options.onTimeout || null;
      this.interval = options.interval || 1500;
      this.timeout = options.timeout || 60000;
      this.lastRuid = null;
      this.hasTag = false;
      this.timerId = null;
      this.startTime = null;
      this.stopped = false;
    }

    start() {
      this.startTime = Date.now();
      this.stopped = false;
      this.poll();
    }

    stop() {
      this.stopped = true;
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    }

    resetTimeout() {
      this.startTime = Date.now();
    }

    async poll() {
      if (this.stopped) return;

      // Only timeout if no tag is currently detected
      if (!this.hasTag && Date.now() - this.startTime > this.timeout) {
        if (this.onTimeout) this.onTimeout();
        return;
      }

      try {
        const ruid = await API.getLastRuid(this.boxId);
        const isValid =
          /^[0-9a-f]{16}$/i.test(ruid) && ruid !== "ffffffffffffffff" && ruid !== "0000000000000000";

        console.log("Poll result:", { ruid, isValid, hasTag: this.hasTag, lastRuid: this.lastRuid });

        if (isValid) {
          // Tag is present
          if (!this.hasTag || ruid !== this.lastRuid) {
            // New tag detected or tag changed
            this.lastRuid = ruid;
            this.hasTag = true;
            if (this.onTagDetected) this.onTagDetected(ruid);
          }
        } else {
          // No tag present (invalid RUID)
          if (this.hasTag) {
            // Tag was removed
            console.log("Tag removal detected, ruid was:", this.lastRuid, "now:", ruid);
            this.hasTag = false;
            this.lastRuid = null;
            this.resetTimeout(); // Reset timeout when tag is removed
            if (this.onTagRemoved) this.onTagRemoved();
          }
        }
      } catch (e) {
        console.error("Poll error:", e);
      }

      if (!this.stopped) {
        this.timerId = setTimeout(() => this.poll(), this.interval);
      }
    }
  }

  let currentPoller = null;

  // ============================================
  // Screen Handlers
  // ============================================
  function onSplashEnter() {
    // Reset state for new session
    setState({
      selectedBox: null,
      detectedTag: null,
      selectedAudio: null,
      error: null
    });
  }

  async function onSelectBoxEnter() {
    showLoading(true);

    try {
      const [boxes, models] = await Promise.all([
        API.getBoxes(),
        API.getBoxModels()
      ]);

      if (!boxes || boxes.length === 0) {
        navigateTo(SCREENS.ERROR, { error: t("error_no_boxes") });
        return;
      }

      // Map model images to boxes
      const modelMap = new Map();
      (models || []).forEach((m) => modelMap.set(m.id, m));

      const boxesWithImages = boxes.map((box) => {
        const model = modelMap.get(box.boxModel);
        return {
          ...box,
          imageUrl: model ? model.img_src : null,
          modelName: model ? model.name : box.boxModel
        };
      });

      setState({ availableBoxes: boxesWithImages });

      // Auto-select if only one box is registered
      if (boxesWithImages.length === 1) {
        setState({ selectedBox: boxesWithImages[0] });
        showLoading(false);
        navigateTo(SCREENS.PLACE_TAG);
        return;
      }

      renderBoxGrid();
    } catch (e) {
      console.error("Error loading boxes:", e);
      navigateTo(SCREENS.ERROR, { error: t("error_generic") });
    } finally {
      showLoading(false);
    }
  }

  // Get the best content info (sourceInfo has linked content, tonieInfo has original chip info)
  function getContentInfo(tagInfo) {
    if (!tagInfo) return null;
    // Prefer sourceInfo (linked content) over tonieInfo (original chip)
    if (tagInfo.sourceInfo && tagInfo.sourceInfo.picture && !tagInfo.sourceInfo.picture.includes("unknown")) {
      return tagInfo.sourceInfo;
    }
    if (tagInfo.tonieInfo && tagInfo.tonieInfo.picture && !tagInfo.tonieInfo.picture.includes("unknown")) {
      return tagInfo.tonieInfo;
    }
    return tagInfo.sourceInfo || tagInfo.tonieInfo || null;
  }

  // Format tag ID for display (show name if available, otherwise short ID)
  function formatTagId(ruid, tagInfo) {
    const info = getContentInfo(tagInfo);
    if (info) {
      // Prefer series (main title) over episode
      const name = info.series || info.episode;
      if (name) return name;
    }
    // Show short ID (first 4 + last 4 chars)
    if (ruid && ruid.length >= 8) {
      return ruid.substring(0, 4).toUpperCase() + "..." + ruid.substring(ruid.length - 4).toUpperCase();
    }
    return ruid ? ruid.toUpperCase() : "";
  }

  function onPlaceTagEnter() {
    // Show waiting state
    document.getElementById("tag-waiting").classList.remove("hidden");
    document.getElementById("tag-detected").classList.add("hidden");
    document.getElementById("tag-id").textContent = "";

    // Start polling
    if (currentPoller) currentPoller.stop();

    currentPoller = new TagPoller(state.selectedBox.ID, {
      onTagDetected: async (ruid) => {
        console.log("Tag detected:", ruid);

        // Clear previous content first
        const currentContainer = document.getElementById("current-audio-container");
        const noAudioContainer = document.getElementById("no-audio-container");
        currentContainer.classList.add("hidden");
        noAudioContainer.classList.add("hidden");
        document.getElementById("current-audio-img").src = "";
        document.getElementById("current-audio-title").textContent = "";
        document.getElementById("current-audio-series").textContent = "";

        // Tag detected - show detected state immediately with ID
        document.getElementById("tag-waiting").classList.add("hidden");
        document.getElementById("tag-detected").classList.remove("hidden");
        document.getElementById("tag-id").textContent = "(" + ruid.toUpperCase() + ")";

        // Fetch current audio info (always refresh to get latest data)
        try {
          const tagInfo = await API.getTagInfo(ruid);
          console.log("Tag info result:", tagInfo);

          // Get the best content info (sourceInfo for linked content, tonieInfo for original)
          const contentInfo = getContentInfo(tagInfo);
          console.log("Content info:", contentInfo);

          setState({
            detectedTag: {
              ruid,
              currentAudio: contentInfo,
              source: tagInfo ? tagInfo.source : null
            }
          });

          // Update tag ID with name if available
          document.getElementById("tag-id").textContent = "(" + formatTagId(ruid, tagInfo) + ")";

          // Show current audio if exists
          if (contentInfo && contentInfo.picture && !contentInfo.picture.includes("unknown")) {
            document.getElementById("current-audio-img").src = contentInfo.picture;
            // Title should be the series/main name, episode info goes below
            document.getElementById("current-audio-title").textContent =
              contentInfo.series || contentInfo.episode || "Unbekannt";
            document.getElementById("current-audio-series").textContent =
              contentInfo.episode || "";
            currentContainer.classList.remove("hidden");
            noAudioContainer.classList.add("hidden");
          } else {
            currentContainer.classList.add("hidden");
            noAudioContainer.classList.remove("hidden");
          }
        } catch (e) {
          console.error("Error fetching tag info:", e);
          setState({ detectedTag: { ruid, currentAudio: null } });
          noAudioContainer.classList.remove("hidden");
        }
      },

      onTagRemoved: () => {
        console.log("Tag removed");
        // Tag removed - show waiting state again
        document.getElementById("tag-waiting").classList.remove("hidden");
        document.getElementById("tag-detected").classList.add("hidden");
        document.getElementById("tag-id").textContent = "";
        setState({ detectedTag: null });
      },

      onTimeout: () => {
        navigateTo(SCREENS.ERROR, { error: t("tag_timeout") });
      }
    });

    currentPoller.start();
  }

  async function onSelectAudioEnter() {
    if (state.availableAudio.length === 0) {
      // First time loading - reset search state
      setState({ searchQuery: "", audioPage: 0 });
      document.getElementById("audio-search").value = "";
      document.getElementById("btn-search-clear").classList.add("hidden");

      showLoading(true);
      try {
        const audio = await API.getAudioContent();
        if (!audio || audio.length === 0) {
          navigateTo(SCREENS.ERROR, { error: t("error_no_audio") });
          return;
        }
        setState({ availableAudio: audio, filteredAudio: audio, audioPage: 0 });
      } catch (e) {
        console.error("Error loading audio:", e);
        navigateTo(SCREENS.ERROR, { error: t("error_generic") });
        return;
      } finally {
        showLoading(false);
      }
    } else {
      // Returning to audio selection - preserve search state
      // Restore UI from state
      document.getElementById("audio-search").value = state.searchQuery;
      document.getElementById("btn-search-clear").classList.toggle("hidden", !state.searchQuery);
    }

    renderAudioGrid();
  }

  function filterAudio(query) {
    const q = query.toLowerCase().trim();
    setState({ searchQuery: q, audioPage: 0 });

    if (!q) {
      setState({ filteredAudio: state.availableAudio });
    } else {
      const filtered = state.availableAudio.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const series = (item.series || "").toLowerCase();
        return title.includes(q) || series.includes(q);
      });
      setState({ filteredAudio: filtered });
    }

    renderAudioGrid();
  }

  function onConfirmEnter() {
    if (!state.selectedAudio) return;

    document.getElementById("confirm-img").src = state.selectedAudio.pic;
    document.getElementById("confirm-title").textContent = state.selectedAudio.title;
    document.getElementById("confirm-series").textContent = state.selectedAudio.series;
  }

  function onSuccessEnter() {
    const message = t("success_message", { title: state.selectedAudio.title });
    document.getElementById("success-message").textContent = message;
  }

  function onErrorEnter(errorMessage) {
    document.getElementById("error-message").textContent = errorMessage || t("error_generic");
  }

  // ============================================
  // Render Functions
  // ============================================
  function renderBoxGrid() {
    const grid = document.getElementById("box-grid");
    grid.innerHTML = "";

    state.availableBoxes.forEach((box) => {
      const card = document.createElement("div");
      card.className = "box-card";
      card.innerHTML = `
        <div class="box-card-image">
          ${box.imageUrl
            ? `<img src="${box.imageUrl}" alt="${box.modelName}" />`
            : `<div class="box-placeholder"></div>`
          }
        </div>
        <div class="box-card-name">${box.boxName || box.commonName || box.ID}</div>
        <div class="box-card-model">${box.modelName || ""}</div>
      `;

      card.addEventListener("click", () => {
        setState({ selectedBox: box });
        navigateTo(SCREENS.PLACE_TAG);
      });

      grid.appendChild(card);
    });
  }

  function renderAudioGrid() {
    const grid = document.getElementById("audio-grid");
    grid.innerHTML = "";

    const audioList = state.filteredAudio.length > 0 || state.searchQuery ? state.filteredAudio : state.availableAudio;

    const start = state.audioPage * state.audioPerPage;
    const end = start + state.audioPerPage;
    const pageItems = audioList.slice(start, end);

    pageItems.forEach((audio) => {
      const card = document.createElement("div");
      card.className = "audio-card";
      card.innerHTML = `
        <img src="${audio.pic}" alt="${audio.title}" class="audio-card-img" />
        <div class="audio-card-title">${audio.title}</div>
        ${audio.series ? `<div class="audio-card-series">${audio.series}</div>` : ""}
      `;

      card.addEventListener("click", () => {
        setState({ selectedAudio: audio });
        navigateTo(SCREENS.CONFIRM);
      });

      grid.appendChild(card);
    });

    // Update pagination
    const totalPages = Math.max(1, Math.ceil(audioList.length / state.audioPerPage));
    const totalItems = audioList.length;
    document.getElementById("audio-page-info").textContent = t("audio_page", {
      current: state.audioPage + 1,
      total: totalPages
    }) + ` (${totalItems})`;

    document.getElementById("btn-audio-prev").disabled = state.audioPage === 0;
    document.getElementById("btn-audio-next").disabled = state.audioPage >= totalPages - 1;
  }

  function showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    if (show) {
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }

  // ============================================
  // Event Handlers
  // ============================================
  function setupEventListeners() {
    // Splash - Start button
    document.getElementById("btn-start").addEventListener("click", () => {
      navigateTo(SCREENS.SELECT_BOX);
    });

    // Splash - Fullscreen toggle button
    const fullscreenBtn = document.getElementById("btn-fullscreen");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => {
            fullscreenBtn.textContent = t("fullscreen_exit");
          }).catch(() => {});
        } else {
          document.exitFullscreen().then(() => {
            fullscreenBtn.textContent = t("fullscreen_enter");
          }).catch(() => {});
        }
      });

      // Update button text when fullscreen changes (e.g., user presses Escape)
      document.addEventListener("fullscreenchange", () => {
        fullscreenBtn.textContent = document.fullscreenElement
          ? t("fullscreen_exit")
          : t("fullscreen_enter");
      });
    }

    // Settings - Open button (splash only)
    const settingsBtn = document.getElementById("btn-settings");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => SettingsDialog.open());
    }

    // Box Selection - Back button
    document.getElementById("btn-box-back").addEventListener("click", () => {
      navigateTo(SCREENS.SPLASH);
    });

    // Tag Placement - Choose audio button
    document.getElementById("btn-choose-audio").addEventListener("click", () => {
      navigateTo(SCREENS.SELECT_AUDIO);
    });

    // Tag Placement - Switch Tonie button (reset to waiting state)
    document.getElementById("btn-switch-tonie").addEventListener("click", () => {
      // Reset poller state to detect any tag as "new"
      if (currentPoller) {
        currentPoller.lastRuid = null;
        currentPoller.hasTag = false;
      }
      // Show waiting state
      document.getElementById("tag-waiting").classList.remove("hidden");
      document.getElementById("tag-detected").classList.add("hidden");
      document.getElementById("tag-id").textContent = "";
      setState({ detectedTag: null });
    });

    // Tag Placement - Back button
    document.getElementById("btn-tag-back").addEventListener("click", () => {
      if (currentPoller) currentPoller.stop();
      navigateTo(SCREENS.SELECT_BOX);
    });

    // Audio Selection - Back button
    document.getElementById("btn-audio-back").addEventListener("click", () => {
      navigateTo(SCREENS.PLACE_TAG);
    });

    // Audio Selection - Search
    const searchInput = document.getElementById("audio-search");
    const searchClearBtn = document.getElementById("btn-search-clear");

    searchInput.addEventListener("input", (e) => {
      const query = e.target.value;
      searchClearBtn.classList.toggle("hidden", !query);
      filterAudio(query);
    });

    searchClearBtn.addEventListener("click", () => {
      searchInput.value = "";
      searchClearBtn.classList.add("hidden");
      filterAudio("");
      searchInput.focus();
    });

    // Audio Selection - Pagination
    document.getElementById("btn-audio-prev").addEventListener("click", () => {
      if (state.audioPage > 0) {
        setState({ audioPage: state.audioPage - 1 });
        renderAudioGrid();
        document.getElementById("audio-grid").scrollTop = 0;
      }
    });

    document.getElementById("btn-audio-next").addEventListener("click", () => {
      const audioList = state.filteredAudio.length > 0 || state.searchQuery ? state.filteredAudio : state.availableAudio;
      const totalPages = Math.ceil(audioList.length / state.audioPerPage);
      if (state.audioPage < totalPages - 1) {
        setState({ audioPage: state.audioPage + 1 });
        renderAudioGrid();
        document.getElementById("audio-grid").scrollTop = 0;
      }
    });

    // Confirmation - No button
    document.getElementById("btn-confirm-no").addEventListener("click", () => {
      navigateTo(SCREENS.SELECT_AUDIO);
    });

    // Confirmation - Yes button
    document.getElementById("btn-confirm-yes").addEventListener("click", async () => {
      showLoading(true);
      try {
        await API.linkAudioToTag(
          state.detectedTag.ruid,
          state.selectedAudio.source
        );
        navigateTo(SCREENS.SUCCESS);
      } catch (e) {
        console.error("Error linking audio:", e);
        navigateTo(SCREENS.ERROR, { error: t("error_link_failed") });
      } finally {
        showLoading(false);
      }
    });

    // Success - Restart button
    document.getElementById("btn-restart").addEventListener("click", () => {
      setState({ availableAudio: [] }); // Clear cache for fresh content
      navigateTo(SCREENS.SPLASH);
    });

    // Error - Retry button
    document.getElementById("btn-retry").addEventListener("click", () => {
      navigateTo(SCREENS.SPLASH);
    });
  }

  // ============================================
  // Initialization
  // ============================================
  async function init() {
    console.log(`${PLUGIN_NAME} v${PLUGIN_VERSION} initializing...`);

    try {
      await Settings.load();
    } catch (e) {
      console.error("Settings load failed, using defaults:", e);
    }

    currentLang = detectLanguage();
    state.audioPerPage = Settings.get("itemsPerPage");
    document.documentElement.dataset.listSize = Settings.get("listIconSize");
    document.documentElement.dataset.detailSize = Settings.get("detailIconSize");

    applyI18n();
    setupEventListeners();
    SettingsDialog.init();
    navigateTo(SCREENS.SPLASH);

    console.log(`${PLUGIN_NAME} ready (settings backend: ${Settings.backend})`);
  }

  if (document.readyState !== "loading") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
