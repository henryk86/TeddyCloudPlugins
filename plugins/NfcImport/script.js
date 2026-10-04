(function () {
  "use strict";

  const fileInput = document.getElementById("nfcFile");
  const createButton = document.getElementById("createJson");
  const details = document.getElementById("dumpDetails");
  const status = document.getElementById("status");
  let selectedDump = null;

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind || "";
  }

  function parseDump(text) {
    const values = new Map();
    for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim();
      if (key === "UID" || key === "Data Content") {
        values.set(key, line.slice(separator + 1).trim());
      }
    }

    const uid = values.get("UID");
    const auth = values.get("Data Content");
    if (!uid || !auth) {
      throw new Error("The file must contain UID and Data Content fields.");
    }

    const uidBytes = uid.split(/\s+/);
    if (
      uidBytes.length !== 8 ||
      uidBytes.some((byte) => !/^[\da-f]{2}$/i.test(byte))
    ) {
      throw new Error("The UID must consist of exactly 8 hexadecimal bytes.");
    }

    const cloudAuth = auth.replace(/\s+/g, "").toUpperCase();
    if (!/^[\da-f]{64}$/i.test(cloudAuth)) {
      throw new Error(
        "Data Content must contain exactly 32 authentication bytes (64 hexadecimal characters)."
      );
    }

    const ruid = uidBytes.reverse().join("").toUpperCase();
    return {
      ruid,
      cloudAuth,
      folder: ruid.slice(0, 8),
      file: ruid.slice(8),
    };
  }

  function contentPath(folder, file, extension) {
    return [folder, `${file}.${extension}`]
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  async function ensureContentFolder(folder) {
    const indexResponse = await fetch(
      "/api/fileIndex?special=content&path=/"
    );
    if (!indexResponse.ok) {
      throw new Error(
        `Could not read the content directory (HTTP ${indexResponse.status}).`
      );
    }
    const index = await indexResponse.json();
    const entry = Array.isArray(index.files)
      ? index.files.find((item) => item.name === folder)
      : null;
    if (entry && entry.isDirectory) return;
    if (entry) {
      throw new Error(`The target path ${folder} is not a content directory.`);
    }

    const response = await fetch("/api/dirCreate?special=content", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: `/${folder}`,
    });
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(
        `Could not create the content directory (HTTP ${response.status})${detail ? `: ${detail}` : "."}`
      );
    }
  }

  async function uploadJson(dump) {
    await ensureContentFolder(dump.folder);
    const json = {
      live: false,
      nocloud: false,
      source: "",
      skip_seconds: 0,
      cache: false,
      cloud_ruid: dump.ruid,
      cloud_auth: dump.cloudAuth,
      cloud_override: false,
      tonie_model: "",
      hide: false,
      claimed: false,
      _version: 5,
    };
    const jsonFile = new File(
      [JSON.stringify(json, null, 4)],
      `${dump.file}.json`,
      { type: "application/json" }
    );
    const formData = new FormData();
    formData.append(jsonFile.name, jsonFile);
    const endpoint =
      `/api/fileUpload?special=content&path=${encodeURIComponent(dump.folder)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(
        `JSON upload failed (HTTP ${response.status} ${response.statusText}).`
      );
    }
    return contentPath(dump.folder, dump.file, "json");
  }

  async function fetchAndCacheTaf(dump) {
    const jsonPath = contentPath(dump.folder, dump.file, "json");
    const response = await fetch(`/content/download/${jsonPath}`);
    if (!response.ok) {
      throw new Error(
        `Boxine retrieval failed (HTTP ${response.status} ${response.statusText}).`
      );
    }

    let receivedBytes = 0;
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
      }
    }

    if (receivedBytes === 0) {
      throw new Error(
        "TeddyCloud did not return any TAF data from Boxine."
      );
    }

    setStatus(
      "JSON created and TAF retrieved from Boxine. The TAF file was transferred to TeddyCloud.",
      "success"
    );
  }

  fileInput.addEventListener("change", async () => {
    selectedDump = null;
    createButton.disabled = true;
    details.hidden = true;

    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setStatus("", "");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".nfc")) {
      setStatus("Please select a file with the .nfc extension.", "error");
      return;
    }

    try {
      selectedDump = parseDump(await file.text());
      document.getElementById("fileName").textContent = file.name;
      document.getElementById("ruid").textContent = selectedDump.ruid;
      document.getElementById("jsonPath").textContent = contentPath(
        selectedDump.folder,
        selectedDump.file,
        "json"
      );
      details.hidden = false;
      createButton.disabled = false;
      setStatus("The NFC dump is valid and ready to import.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  createButton.addEventListener("click", async () => {
    if (!selectedDump) return;
    createButton.disabled = true;
    setStatus("Creating content JSON in TeddyCloud …", "");

    try {
      const path = contentPath(
        selectedDump.folder,
        selectedDump.file,
        "json"
      );
      const existing = await fetch(`/api/getFile/content/${path}`);
      if (existing.ok && !window.confirm(`The file ${path} already exists. Overwrite it?`)) {
        setStatus("Import cancelled; the existing JSON file was left unchanged.", "");
        return;
      }
      if (!existing.ok && existing.status !== 404) {
        throw new Error(
          `Could not check the existing content file (HTTP ${existing.status}).`
        );
      }

      const uploadedPath = await uploadJson(selectedDump);
      setStatus(
        `Content JSON created: ${uploadedPath}. TeddyCloud is now retrieving the TAF file from Boxine …`,
        ""
      );
      await fetchAndCacheTaf(selectedDump);
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      createButton.disabled = false;
    }
  });

})();
