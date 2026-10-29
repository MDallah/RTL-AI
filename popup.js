// RTL AI - Popup
(function () {
  "use strict";

  var DEFAULTS = {
    enabled: true,
    threshold: 10,
  };

  var enabledEl = document.getElementById("enabled");
  var thresholdEl = document.getElementById("threshold");
  var showButtonEl = document.getElementById("showButton");
  var settingsNoteEl = document.getElementById("settingsNote");

  var hostEl = document.getElementById("host");
  var siteNoteEl = document.getElementById("siteNote");
  var addCurrentBtn = document.getElementById("addCurrent");
  var removeCurrentBtn = document.getElementById("removeCurrent");

  var siteInput = document.getElementById("siteInput");
  var addSiteBtn = document.getElementById("addSite");
  var siteListNoteEl = document.getElementById("siteListNote");
  var siteListEl = document.getElementById("siteList");

  var customSites = [];
  var activeTab = null;

  function hostFromPattern(pattern) {
    var match = /^[a-z*]+:\/\/([^/]+)\/\*$/i.exec(pattern);
    return match ? match[1] : pattern;
  }

  function hostMatchesPattern(pattern, hostname) {
    var match = /^[a-z*]+:\/\/([^/]+)\//i.exec(pattern);
    if (!match) return false;
    var host = match[1];
    if (host === "*") return true;
    if (host.indexOf("*.") === 0) {
      var base = host.slice(2);
      return (
        hostname === base || hostname.slice(-(base.length + 1)) === "." + base
      );
    }
    return hostname === host;
  }

  function defaultMatches() {
    var manifest = chrome.runtime.getManifest();
    var scripts = manifest.content_scripts || [];
    var matches = [];
    scripts.forEach(function (script) {
      (script.matches || []).forEach(function (m) {
        matches.push(m);
      });
    });
    return matches;
  }

  function setNote(el, message, kind) {
    el.textContent = message || "";
    el.className = "note" + (kind ? " " + kind : "");
    if (kind === "ok") {
      setTimeout(function () {
        if (el.textContent === message) {
          el.textContent = "";
          el.className = "note";
        }
      }, 2000);
    }
  }

  // example.com -> https://example.com/*; localhost defaults to http.
  function normalizeSite(value) {
    var text = (value || "").trim();
    if (!text) return null;
    if (!/^https?:\/\//i.test(text)) {
      var isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text);
      text = (isLocal ? "http://" : "https://") + text;
    }

    var url;
    try {
      url = new URL(text);
    } catch (e) {
      return null;
    }

    var host = url.hostname;
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !host ||
      (host.indexOf(".") === -1 && host !== "localhost")
    ) {
      return null;
    }

    return {
      hostname: host,
      pattern: url.protocol + "//" + host + "/*",
    };
  }

  function injectIntoCurrentTab(pattern) {
    if (!activeTab || activeTab.id == null || !pattern) return;

    var url;
    try {
      url = new URL(activeTab.url);
    } catch (e) {
      return;
    }
    if (url.protocol + "//" + url.hostname + "/*" !== pattern) return;

    chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      files: ["content.js"],
    });
    chrome.scripting.insertCSS({
      target: { tabId: activeTab.id, allFrames: true },
      files: ["styles.css"],
    });
  }

  function addSite(pattern, hostname, onDone) {
    var alreadyListed = customSites.indexOf(pattern) !== -1;

    // Save first: Chrome closes the popup while showing its permission
    // prompt, so a callback-only save can be lost. The background script only
    // registers origins that actually have permission.
    if (!alreadyListed) {
      customSites.push(pattern);
      chrome.storage.local.set({ customSites: customSites });
    }

    // Keep this call directly in the click handler so the browser keeps the
    // user gesture it requires for showing the permission prompt.
    chrome.permissions.request({ origins: [pattern] }, function (granted) {
      var error = chrome.runtime.lastError;

      if (error || !granted) {
        customSites = customSites.filter(function (site) {
          return site !== pattern;
        });
        chrome.storage.local.set({ customSites: customSites });
        onDone(
          false,
          error
            ? error.message || "Could not request access."
            : "Access was not granted.",
        );
        return;
      }

      injectIntoCurrentTab(pattern);
      onDone(true, "Added " + hostname);
    });
  }

  function pruneUngrantedSites(cb) {
    if (!customSites.length) {
      if (cb) cb();
      return;
    }

    var remaining = customSites.length;
    var granted = [];

    customSites.forEach(function (pattern, index) {
      chrome.permissions.contains({ origins: [pattern] }, function (hasIt) {
        if (hasIt) granted.push({ pattern: pattern, index: index });
        remaining -= 1;

        if (remaining > 0) return;

        granted.sort(function (a, b) {
          return a.index - b.index;
        });
        var next = granted.map(function (entry) {
          return entry.pattern;
        });

        if (next.length !== customSites.length) {
          customSites = next;
          chrome.storage.local.set({ customSites: customSites });
        }

        if (cb) cb();
      });
    });
  }

  function removeSite(pattern, onDone) {
    customSites = customSites.filter(function (s) {
      return s !== pattern;
    });
    chrome.storage.local.set({ customSites: customSites }, function () {
      chrome.permissions.remove({ origins: [pattern] }, function () {
        onDone();
      });
    });
  }

  function renderCurrentSite() {
    if (!activeTab) return;

    var url;
    try {
      url = new URL(activeTab.url);
    } catch (e) {
      url = null;
    }

    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
      hostEl.textContent = "This page can't be used";
      addCurrentBtn.hidden = true;
      removeCurrentBtn.hidden = true;
      setNote(siteNoteEl, "Open an http(s) page to enable RTL AI.");
      return;
    }

    var hostname = url.hostname;
    var currentPattern = url.protocol + "//" + hostname + "/*";
    hostEl.textContent = hostname;

    var isDefault = defaultMatches().some(function (pattern) {
      return hostMatchesPattern(pattern, hostname);
    });

    var customIndex = customSites.indexOf(currentPattern);

    if (isDefault) {
      addCurrentBtn.hidden = true;
      removeCurrentBtn.hidden = true;
      setNote(siteNoteEl, "Supported by default.", "ok");
      return;
    }

    if (customIndex !== -1) {
      addCurrentBtn.hidden = true;
      removeCurrentBtn.hidden = false;
      setNote(siteNoteEl, "Enabled on this site.", "ok");
      removeCurrentBtn.onclick = function () {
        var pattern = customSites[customIndex];
        removeSite(pattern, function () {
          renderCurrentSite();
          setNote(siteNoteEl, "Reload the page to fully disable.");
          renderSiteList();
        });
      };
      return;
    }

    addCurrentBtn.hidden = false;
    removeCurrentBtn.hidden = true;
    setNote(siteNoteEl, "");
    addCurrentBtn.onclick = function () {
      addSite(currentPattern, hostname, function (ok, msg) {
        if (!ok) {
          setNote(siteNoteEl, msg, "err");
          return;
        }
        renderCurrentSite();
        renderSiteList();
        setNote(siteNoteEl, msg, "ok");
      });
    };
  }

  function renderSiteList() {
    siteListEl.textContent = "";

    if (!customSites.length) {
      var empty = document.createElement("li");
      empty.className = "site-empty";
      empty.textContent = "No additional websites yet.";
      siteListEl.appendChild(empty);
      return;
    }

    customSites.forEach(function (pattern) {
      var li = document.createElement("li");

      var name = document.createElement("span");
      name.textContent = hostFromPattern(pattern);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + hostFromPattern(pattern));
      remove.addEventListener("click", function () {
        removeSite(pattern, function () {
          renderSiteList();
          renderCurrentSite();
        });
      });

      li.appendChild(name);
      li.appendChild(remove);
      siteListEl.appendChild(li);
    });
  }

  function saveSettings() {
    var threshold = parseInt(thresholdEl.value, 10);
    if (isNaN(threshold) || threshold < 0) threshold = DEFAULTS.threshold;
    if (threshold > 100) threshold = 100;
    thresholdEl.value = threshold;

    chrome.storage.local.set({ threshold: threshold }, function () {
      setNote(settingsNoteEl, "Saved.", "ok");
    });
  }

  enabledEl.addEventListener("change", function () {
    chrome.storage.local.set({ enabled: enabledEl.checked });
  });

  thresholdEl.addEventListener("change", saveSettings);

  showButtonEl.addEventListener("change", function () {
    var hidden = !showButtonEl.checked;
    var payload = { buttonHidden: hidden };

    // Hiding the floating button must not turn RTL fixing off.
    if (hidden) {
      payload.enabled = true;
      enabledEl.checked = true;
    }

    chrome.storage.local.set(payload);
  });

  addSiteBtn.addEventListener("click", function () {
    var site = normalizeSite(siteInput.value);
    if (!site) {
      setNote(siteListNoteEl, "Enter a valid site, e.g. example.com", "err");
      return;
    }
    addSite(site.pattern, site.hostname, function (ok, msg) {
      if (!ok) {
        setNote(siteListNoteEl, msg, "err");
        return;
      }
      siteInput.value = "";
      setNote(siteListNoteEl, msg, "ok");
      renderSiteList();
      renderCurrentSite();
    });
  });

  siteInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSiteBtn.click();
    }
  });

  chrome.storage.local.get(
    ["enabled", "threshold", "buttonHidden", "customSites"],
    function (result) {
      enabledEl.checked = result.enabled !== false;
      thresholdEl.value =
        typeof result.threshold === "number"
          ? result.threshold
          : DEFAULTS.threshold;

      showButtonEl.checked = result.buttonHidden !== true;

      customSites = Array.isArray(result.customSites) ? result.customSites : [];

      pruneUngrantedSites(function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          activeTab = tabs && tabs[0] ? tabs[0] : null;
          renderCurrentSite();
          renderSiteList();
        });
      });
    },
  );

  // Keep the popup in sync while it is open.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;

    if (changes.enabled) {
      enabledEl.checked = changes.enabled.newValue !== false;
    }
    if (changes.buttonHidden) {
      showButtonEl.checked = changes.buttonHidden.newValue !== true;
    }
  });
})();
