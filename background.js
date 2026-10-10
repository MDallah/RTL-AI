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

chrome.runtime.onInstalled.addListener(syncCustomSites);
chrome.runtime.onStartup.addListener(syncCustomSites);
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && changes.customSites) {
    syncCustomSites();
  }
});
