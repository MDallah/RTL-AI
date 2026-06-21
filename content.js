// RTL AI - Content Script
(function () {
  "use strict";

  var RTL_PATTERNS = [
    /[\u0600-\u06FF]/,
    /[\u0750-\u077F]/,
    /[\uFB50-\uFDFF]/,
    /[\uFE70-\uFEFF]/,
    /[\u07C0-\u07FA]/,
    /[\u08A0-\u08FF]/,
  ];

  var BLOCK_TAGS = {
    P: true,
    DIV: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    LI: true,
    TD: true,
    BLOCKQUOTE: true,
    PRE: true,
    OL: true,
    UL: true,
    SECTION: true,
    ARTICLE: true,
    DD: true,
    DT: true,
    BODY: true,
    TABLE: true,
    TR: true,
    TH: true,
    THEAD: true,
  };

  var enabledCache = true;

  function containsRTL(text) {
    if (!text) return false;
    return RTL_PATTERNS.some(function (p) {
      return p.test(text);
    });
  }

  function getRTLPercentage(text) {
    if (!text || text.length === 0) return 0;
    var rtlChars = 0;
    for (var i = 0; i < text.length; i++) {
      if (
        RTL_PATTERNS.some(function (p) {
          return p.test(text[i]);
        })
      )
        rtlChars++;
    }
    return (rtlChars / text.length) * 100;
  }

  function applyRTL(element) {
    if (!element || element.classList.contains("ai-rtl-fixed")) return;

    if (element.tagName === "P") {
      if (element.dataset.rtlFixed) return;
      element.style.direction = "rtl";
      element.style.textAlign = "right";
      element.dataset.rtlFixed = "true";
      return;
    }

    element.classList.add("ai-rtl-fixed");
    element.style.direction = "rtl";
    element.style.textAlign = "right";
    element.style.unicodeBidi = "plaintext";

    if (element.tagName === "TABLE") {
      element.setAttribute("dir", "rtl");
    }
  }

  function removeRTL(element) {
    if (!element) return;
    element.classList.remove("ai-rtl-fixed");
    element.style.direction = "";
    element.style.textAlign = "";
    element.style.unicodeBidi = "";

    if (element.tagName === "TABLE") {
      element.removeAttribute("dir");
    }

    if (element.dataset.rtlFixed) {
      element.style.direction = "";
      element.style.textAlign = "";
      element.style.unicodeBidi = "";
      delete element.dataset.rtlFixed;
    }

    element.querySelectorAll("[data-rtl-fixed]").forEach(function (el) {
      el.style.direction = "";
      el.style.textAlign = "";
      el.style.unicodeBidi = "";
      delete el.dataset.rtlFixed;
    });
  }

  function processTextNodes() {
    if (!enabledCache) return;

    // Process tables with RTL content first (set dir attribute)
    document.querySelectorAll("table").forEach(function (table) {
      if (!table.hasAttribute("dir") && containsRTL(table.textContent)) {
        table.setAttribute("dir", "rtl");
      }
    });

    // Walk all text nodes and apply RTL to block parents
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (
            node.parentElement &&
            node.parentElement.classList.contains("ai-rtl-toggle-btn")
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    var textNode;
    while ((textNode = walker.nextNode())) {
      var rtlPercentage = getRTLPercentage(textNode.textContent);
      if (rtlPercentage <= 10) continue;

      var el = textNode.parentElement;
      if (!el) continue;

      // If parent is SPAN, go to grandparent (original behavior)
      if (el.tagName === "SPAN") {
        el = el.parentElement;
        if (!el) continue;
      }

      // Walk up to the nearest block-level ancestor (skip inline elements)
      while (el && !BLOCK_TAGS[el.tagName]) {
        el = el.parentElement;
      }
      if (!el) continue;

      if (el.classList.contains("ai-rtl-fixed")) continue;
      if (el.dataset.rtlFixed) continue;

      applyRTL(el);
    }
  }

  function createToggleButton() {
    if (document.querySelector(".ai-rtl-toggle-btn")) return;

    var button = document.createElement("button");
    button.className = "ai-rtl-toggle-btn";
    button.innerHTML = " ⇋ ";
    button.title = "Toggle RTL Fix";

    button.style.position = "fixed";
    button.style.bottom = "30px";
    button.style.right = "30px";
    button.style.zIndex = "999999";
    button.style.padding = "5px 10px";
    button.style.borderRadius = "8px";
    button.style.border = "2px solid #4a8fd9";
    button.style.backgroundColor = "#4a8fd9";
    button.style.color = "white";
    button.style.fontSize = "14px";
    button.style.fontWeight = "bold";
    button.style.cursor = "pointer";
    button.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    button.style.transition = "all 0.3s ease";
    button.style.verticalAlign = "middle";

    function updateButtonState(enabled) {
      var isEnabled = enabled !== false;
      button.classList.toggle("disabled", !isEnabled);
      button.style.backgroundColor = isEnabled ? "#4a8fd9" : "#6b7280";
      button.style.borderColor = isEnabled ? "#4a8fd9" : "#9ca3af";
      button.innerHTML = "⇄";
      button.title = isEnabled ? "RTL Fix is enabled" : "RTL Fix is disabled";
    }

    button.addEventListener("click", function () {
      chrome.storage.local.get(["enabled"], function (result) {
        var newState = result.enabled === false;
        chrome.storage.local.set({ enabled: newState }, function () {
          enabledCache = newState;
          updateButtonState(enabledCache);
          if (enabledCache) {
            processTextNodes();
          } else {
            document
              .querySelectorAll(".ai-rtl-fixed, [data-rtl-fixed]")
              .forEach(removeRTL);
            document.querySelectorAll("table[dir]").forEach(function (t) {
              t.removeAttribute("dir");
            });
          }
        });
      });
    });

    chrome.storage.local.get(["enabled"], function (result) {
      enabledCache = result.enabled !== false;
      updateButtonState(enabledCache);
    });

    document.body.appendChild(button);
  }

  function init() {
    createToggleButton();
    processTextNodes();

    var debounceTimer;
    var observer = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processTextNodes, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", processTextNodes);
})();
