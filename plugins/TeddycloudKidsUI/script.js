// TeddycloudKidsUI - Kids Tag Linker Plugin
// A kid-friendly interface for assigning audio to Tonie tags
(function () {
  "use strict";

  const PLUGIN_NAME = "Tonie Auswahl";
  const PLUGIN_VERSION = "0.1.0";

  // ============================================
  // Internationalization (i18n)
  // ============================================
  const i18n = {
    de: {
      // Splash Screen
      splash_title: "Lust auf eine neue Geschichte?",
      splash_button: "Los geht's!",

      // Box Selection
      box_title: "Welche Box gehoert dir?",
      box_back: "Zurueck",

      // Tag Placement
      tag_instruction: "Leg deinen Tonie auf die Box und warte...",
      tag_searching: "Suche...",
      tag_detected: "Tonie erkannt!",
      tag_current: "Aktuell:",
      tag_no_audio: "Noch keine Musik zugewiesen",
      tag_choose_other: "Musik waehlen",
      tag_switch: "Anderen Tonie waehlen",
      tag_back: "Andere Box waehlen",
      tag_timeout: "Kein Tonie gefunden. Nochmal versuchen?",

      // Audio Selection
      audio_title: "Was soll der Tonie spielen?",
      audio_back: "Zurueck",
      audio_page: "Seite {current} / {total}",
      audio_loading: "Lade Musik...",

      // Confirmation
      confirm_question: "Soll das dein Tonie abspielen?",
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
      error_retry: "Nochmal versuchen"
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
      tag_choose_other: "Choose audio",
      tag_switch: "Choose different Tonie",
      tag_back: "Choose another box",
      tag_timeout: "No Tonie found. Try again?",

      // Audio Selection
      audio_title: "What should the Tonie play?",
      audio_back: "Back",
      audio_page: "Page {current} / {total}",
      audio_loading: "Loading audio...",

      // Confirmation
      confirm_question: "Should your Tonie play this?",
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
      error_retry: "Try again"
    }
  };

  // Detect language from URL param (?lang=en), browser, or default to German
  function detectLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get("lang");
    if (urlLang && i18n[urlLang]) return urlLang;

    const browserLang = (navigator.language || navigator.userLanguage || "de").split("-")[0];
    return i18n[browserLang] ? browserLang : "de";
  }

  let currentLang = detectLanguage();

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
    audioPerPage: 30,
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
            results.push({
              source: `lib://${fullPath}`,
              title: file.tonieInfo.episode || file.tonieInfo.series || file.name.replace(".taf", ""),
              series: file.tonieInfo.series || "",
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

      // Also include custom tonies (toniesCustomJson) as fallback
      try {
        const customRes = await fetch("/api/toniesCustomJson");
        if (customRes.ok) {
          const customData = await customRes.json();
          const customAudio = (Array.isArray(customData) ? customData : [])
            .filter((item) => item.pic && item.audio_id && item.audio_id.length > 0)
            .map((item) => ({
              source: `lib://${item.audio_id.join("/")}`,
              title: item.title || item.series || "Unbekannt",
              series: item.series || "",
              pic: item.pic,
              model: item.model
            }));
          allAudio.push(...customAudio);
          console.log(`Added ${customAudio.length} custom tonies`);
        }
      } catch (e) {
        console.error("Error loading custom tonies:", e);
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
      const name = info.episode || info.series;
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
            document.getElementById("current-audio-title").textContent =
              contentInfo.episode || contentInfo.series || "Unbekannt";
            document.getElementById("current-audio-series").textContent =
              contentInfo.series || "";
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
    // Reset search state
    setState({ searchQuery: "", audioPage: 0 });
    document.getElementById("audio-search").value = "";
    document.getElementById("btn-search-clear").classList.add("hidden");

    if (state.availableAudio.length === 0) {
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
      // Reset filter to show all
      setState({ filteredAudio: state.availableAudio });
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
  function init() {
    console.log(`${PLUGIN_NAME} v${PLUGIN_VERSION} initializing...`);

    applyI18n();
    setupEventListeners();
    navigateTo(SCREENS.SPLASH);

    console.log(`${PLUGIN_NAME} ready`);
  }

  if (document.readyState !== "loading") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
