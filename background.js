// RTL AI - Background Service Worker
// Registers the content script dynamically for user-added websites, because
// manifest content_scripts matches are fixed at install time.

var SCRIPT_ID = "rtl-ai-custom-sites";

function getCustomSites() {
  return new Promise(function (resolve) {
    chrome.storage.local.get("customSites", function (result) {
      resolve(Array.isArray(result.customSites) ? result.customSites : []);
    });
  });
}

function hasOrigin(origin) {
  return new Promise(function (resolve) {
    chrome.permissions.contains({ origins: [origin] }, function (granted) {
      resolve(!!granted);
    });
  });
}

async function syncCustomSites() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch (e) {
    // Not registered yet; ignore.
  }

  var sites = await getCustomSites();
  var granted = [];
  for (var i = 0; i < sites.length; i++) {
    if (await hasOrigin(sites[i])) granted.push(sites[i]);
  }

  if (!granted.length) return;

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        matches: granted,
        js: ["content.js"],
        css: ["styles.css"],
        runAt: "document_end",
        allFrames: true,
      },
    ]);
  } catch (e) {
    console.error("RTL AI: failed to register custom sites", e);
  }
}

function urlMatchesPattern(url, pattern) {
  var match = /^([a-z*]+):\/\/([^/]+)\/\*$/i.exec(pattern);
  if (!match) return false;

  var parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return false;
  }

  var protocol = match[1].toLowerCase();
  if (protocol !== "*" && protocol + ":" !== parsed.protocol) return false;

  var host = match[2];
  if (host.indexOf("*.") === 0) {
    var base = host.slice(2);
    return (
      parsed.hostname === base ||
      parsed.hostname.slice(-(base.length + 1)) === "." + base
    );
  }
  return parsed.hostname === host;
}

function isDefaultPattern(pattern) {
  var scripts = chrome.runtime.getManifest().content_scripts || [];
  return scripts.some(function (script) {
    return (script.matches || []).indexOf(pattern) !== -1;
  });
}

async function injectIntoActiveTab(origins) {
  try {
    var tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    var tab = tabs && tabs[0];
    if (!tab || tab.id == null || !tab.url) return;

    var matches = origins.some(function (pattern) {
      return urlMatchesPattern(tab.url, pattern);
    });
    if (!matches) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["content.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id, allFrames: true },
      files: ["styles.css"],
    });
  } catch (e) {
    // The tab may have navigated or closed. The registered content script
    // will handle future page loads.
  }
}

chrome.runtime.onInstalled.addListener(syncCustomSites);
chrome.runtime.onStartup.addListener(syncCustomSites);
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && changes.customSites) {
    syncCustomSites();
  }
});

chrome.permissions.onAdded.addListener(function (permissions) {
  var origins = (permissions.origins || []).filter(function (pattern) {
    return !isDefaultPattern(pattern);
  });
  if (!origins.length) return;

  syncCustomSites();
  injectIntoActiveTab(origins);
});

chrome.permissions.onRemoved.addListener(function (permissions) {
  if (permissions.origins && permissions.origins.length) {
    syncCustomSites();
  }
});
