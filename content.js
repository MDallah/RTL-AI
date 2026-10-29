// RTL AI - Content Script
(function () {
  "use strict";

  // A page can be injected more than once (for example, once by the popup and
  // once by the background permission handler). Only initialize once.
  if (window.__rtlAiContentLoaded) return;
  window.__rtlAiContentLoaded = true;

  var RTL_PATTERNS = [
    /[\u0600-\u06FF]/,
    /[\u0750-\u077F]/,
    /[\uFB50-\uFDFF]/,
    /[\uFE70-\uFEFF]/,
    /[\u07C0-\u07FA]/,
    /[\u08A0-\u08FF]/,
  ];

  // Strong bidi characters (UAX #9). Weak/neutral characters such as digits,
  // spaces and punctuation are ignored when deciding a text's direction.
  var STRONG_RTL_PATTERN =
    /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}]/u;
  var STRONG_LTR_PATTERN = /\p{L}/u;

  // When a long text starts with a strong LTR letter but is mostly RTL, still
  // treat it as RTL (e.g. "ChatGPT هو أداة مفيدة جدا"). Short text trusts the
  // first strong character, so "Hi محمد" stays LTR.
  var LTR_FIRST_RTL_OVERRIDE = 50;
  var MIN_LENGTH_FOR_STATS = 20;

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
    MAIN: true,
    NAV: true,
    ASIDE: true,
    HEADER: true,
    FOOTER: true,
    DD: true,
    DT: true,
    BODY: true,
    TABLE: true,
    TR: true,
    TH: true,
    THEAD: true,
    CAPTION: true,
    FIGURE: true,
    FIGCAPTION: true,
    DETAILS: true,
    SUMMARY: true,
    DIALOG: true,
    ADDRESS: true,
    LABEL: true,
    FIELDSET: true,
    FORM: true,
  };

  var INPUT_SELECTOR =
    'textarea, input[type="text"], input[type="search"], input:not([type]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

  var DEFAULT_THRESHOLD = 10;
  var DEFAULT_POSITION = "bottom-right";

  var enabledCache = true;
  var thresholdValue = DEFAULT_THRESHOLD;
  var buttonPosition = DEFAULT_POSITION;
  var buttonCoords = null;
  var buttonHidden = false;

  var BUTTON_MARGIN = 6;

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
      var ch = text[i];
      for (var p = 0; p < RTL_PATTERNS.length; p++) {
        if (RTL_PATTERNS[p].test(ch)) {
          rtlChars++;
          break;
        }
      }
    }
    return (rtlChars / text.length) * 100;
  }

  // Returns "rtl", "ltr", or null (no strong character found) based on the
  // first strong character, matching the browser's dir="auto" behavior.
  function getFirstStrong(text) {
    if (!text) return null;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (STRONG_RTL_PATTERN.test(ch)) return "rtl";
      if (STRONG_LTR_PATTERN.test(ch)) return "ltr";
    }
    return null;
  }

  function isRTLText(text) {
    var strong = getFirstStrong(text);

    if (strong === "rtl") return true;
    if (strong === "ltr") {
      return (
        text.length >= MIN_LENGTH_FOR_STATS &&
        getRTLPercentage(text) > LTR_FIRST_RTL_OVERRIDE
      );
    }

    // Only weak/neutral characters: fall back to the configured threshold.
    return getRTLPercentage(text) > thresholdValue;
  }

  // Code must always stay LTR: never mark <pre>/<code> (or anything inside
  // them) as an RTL block, no matter what comments or strings they contain.
  function isCodeContext(el) {
    if (!el || !el.closest) return false;
    return !!el.closest("pre, code, kbd, samp");
  }

  // Let the browser resolve the base direction itself (dir="auto" = native
  // Unicode bidi / first-strong character), then isolate and right-align it
  // via CSS. We only add the attribute if the page did not set one already.
  function applyRTL(element, forceRTL) {
    if (!element || element.classList.contains("ai-rtl-fixed")) return;
    if (element.tagName === "PRE" || element.tagName === "CODE") return;
    if (isCodeContext(element)) return;

    element.classList.add("ai-rtl-fixed");

    if (forceRTL) {
      element.setAttribute("dir", "rtl");
      element.dataset.aiRtlDir = "true";
    } else if (!element.hasAttribute("dir")) {
      element.setAttribute("dir", "auto");
      element.dataset.aiRtlDir = "true";
    }
  }

  function removeRTL(element) {
    if (!element) return;

    element.classList.remove("ai-rtl-fixed");

    if (element.dataset.aiRtlDir) {
      element.removeAttribute("dir");
      delete element.dataset.aiRtlDir;
    }
  }

  // Start from a scope root and query it (including the root itself) plus
  // its descendants, so incrementally added nodes are handled too.
  function eachIn(root, selector, fn) {
    if (!root || !root.querySelectorAll) return;
    if (root.nodeType === 1 && root.matches && root.matches(selector)) {
      fn(root);
    }
    var nodes = root.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      fn(nodes[i]);
    }
  }

  function processInput(el) {
    if (!enabledCache || !el) return;

    var text = el.isContentEditable ? el.textContent : el.value;
    if (!text) text = el.getAttribute("placeholder") || "";

    if (isRTLText(text)) {
      applyRTL(el);
    } else if (el.classList.contains("ai-rtl-fixed")) {
      removeRTL(el);
    }
  }

  function processRoot(root) {
    if (!enabledCache || !root || root.nodeType !== 1) return;

    eachIn(root, INPUT_SELECTOR, processInput);

    eachIn(root, "table", function (table) {
      if (!table.hasAttribute("dir") && containsRTL(table.textContent)) {
        table.setAttribute("dir", "rtl");
        table.dataset.aiRtlDir = "true";
      }
    });

    // Process lists so markers (bullets/numbers) move to the right side.
    // Force dir="rtl" (not auto) so the marker stays on the right even when
    // an item begins with a Latin word or a number.
    eachIn(root, "li", function (li) {
      if (!containsRTL(li.textContent)) return;

      applyRTL(li, true);

      var list = li.parentElement;
      while (list && list.tagName !== "UL" && list.tagName !== "OL") {
        list = list.parentElement;
      }
      if (list) applyRTL(list, true);
    });

    // Walk text nodes and apply RTL to the nearest block ancestor.
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (
          node.parentElement &&
          node.parentElement.closest(".ai-rtl-toggle-btn")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var textNode;
    while ((textNode = walker.nextNode())) {
      if (!isRTLText(textNode.textContent)) continue;

      var el = textNode.parentElement;
      if (!el) continue;

      // If parent is SPAN, go to grandparent (original behavior).
      if (el.tagName === "SPAN") {
        el = el.parentElement;
        if (!el) continue;
      }

      // Walk up to the nearest block-level ancestor (skip inline elements).
      while (el && !BLOCK_TAGS[el.tagName]) {
        el = el.parentElement;
      }
      if (!el) continue;

      if (el.classList.contains("ai-rtl-fixed")) continue;

      applyRTL(el);
    }
  }

  function resetAll() {
    document
      .querySelectorAll(".ai-rtl-fixed, [data-ai-rtl-dir]")
      .forEach(removeRTL);
  }

  function applyEnabledState() {
    updateButtonState(enabledCache);
    resetAll();
    if (enabledCache) {
      processRoot(document.body);
    }
  }

  function sanitizeCoords(value) {
    if (!value || typeof value !== "object") return null;
    var left = Number(value.left);
    var top = Number(value.top);
    if (!isFinite(left) || !isFinite(top)) return null;
    return { left: left, top: top };
  }

  // Keep the button fully inside the viewport after dragging or resizing.
  function clampButtonCoords(left, top, button) {
    var rect = button ? button.getBoundingClientRect() : null;
    var width = rect && rect.width ? rect.width : 36;
    var height = rect && rect.height ? rect.height : 28;
    var maxLeft = Math.max(
      BUTTON_MARGIN,
      window.innerWidth - width - BUTTON_MARGIN,
    );
    var maxTop = Math.max(
      BUTTON_MARGIN,
      window.innerHeight - height - BUTTON_MARGIN,
    );

    return {
      left: Math.min(Math.max(BUTTON_MARGIN, left), maxLeft),
      top: Math.min(Math.max(BUTTON_MARGIN, top), maxTop),
    };
  }

  function moveButtonTo(button, left, top) {
    if (!button) return null;

    var pos = clampButtonCoords(left, top, button);
    button.style.bottom = "";
    button.style.right = "";
    button.style.left = pos.left + "px";
    button.style.top = pos.top + "px";
    return pos;
  }

  function applyButtonPosition() {
    var button = document.querySelector(".ai-rtl-toggle-btn");
    if (!button) return;

    button.style.top = "";
    button.style.bottom = "";
    button.style.left = "";
    button.style.right = "";

    if (buttonPosition === "custom" && buttonCoords) {
      moveButtonTo(button, buttonCoords.left, buttonCoords.top);
      return;
    }

    if (buttonPosition === "top-right") {
      button.style.top = "30px";
      button.style.right = "30px";
    } else if (buttonPosition === "top-left") {
      button.style.top = "30px";
      button.style.left = "30px";
    } else if (buttonPosition === "bottom-left") {
      button.style.bottom = "30px";
      button.style.left = "30px";
    } else {
      button.style.bottom = "30px";
      button.style.right = "30px";
    }
  }

  function updateButtonState(enabled) {
    var button = document.querySelector(".ai-rtl-toggle-btn");
    if (!button) return;

    var isEnabled = enabled !== false;
    button.classList.toggle("disabled", !isEnabled);
    button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    button.setAttribute(
      "aria-label",
      isEnabled
        ? "RTL Fix is enabled. Activate to disable."
        : "RTL Fix is disabled. Activate to enable.",
    );
    button.title = isEnabled
      ? "RTL Fix is enabled (drag to move)"
      : "RTL Fix is disabled (drag to move)";
  }

  function createButtonIcon() {
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    [
      "m16 3 4 4-4 4",
      "M20 7H4",
      "m8 21-4-4 4-4",
      "M4 17h16",
    ].forEach(function (d) {
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    });

    return svg;
  }

  function createToggleButton() {
    if (buttonHidden) return;
    if (document.querySelector(".ai-rtl-toggle-btn")) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "ai-rtl-toggle-btn";
    button.appendChild(createButtonIcon());
    button.setAttribute("aria-label", "Toggle RTL Fix");
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("draggable", "false");
    button.title = "Toggle RTL Fix (drag to move)";

    var dragState = null;
    var lastDragEnd = 0;

    button.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;

      var rect = button.getBoundingClientRect();
      dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false,
      };

      try {
        button.setPointerCapture(e.pointerId);
      } catch (err) {
        // Pointer capture is best-effort.
      }
    });

    button.addEventListener("pointermove", function (e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;

      var dx = e.clientX - dragState.startX;
      var dy = e.clientY - dragState.startY;

      // Wait for a small movement so plain clicks still toggle.
      if (!dragState.moved && Math.abs(dx) + Math.abs(dy) < 5) return;

      if (!dragState.moved) {
        dragState.moved = true;
        button.classList.add("dragging");
      }

      moveButtonTo(
        button,
        e.clientX - dragState.offsetX,
        e.clientY - dragState.offsetY,
      );
    });

    function endDrag(e) {
      if (!dragState || (e && e.pointerId !== dragState.pointerId)) return;

      var moved = dragState.moved;
      dragState = null;
      button.classList.remove("dragging");

      try {
        button.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Nothing captured.
      }

      if (!moved) return;

      lastDragEnd = Date.now();
      var rect = button.getBoundingClientRect();
      buttonCoords = { left: Math.round(rect.left), top: Math.round(rect.top) };
      buttonPosition = "custom";

      chrome.storage.local.set({
        buttonPosition: "custom",
        buttonCoords: buttonCoords,
      });
    }

    button.addEventListener("pointerup", endDrag);
    button.addEventListener("pointercancel", endDrag);

    button.addEventListener("click", function (e) {
      // A drag repositions the button; it should not toggle the extension.
      if (Date.now() - lastDragEnd < 400) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // storage.onChanged applies the new state in every frame.
      chrome.storage.local.set({ enabled: !enabledCache });
    });

    document.body.appendChild(button);
    applyButtonPosition();
    updateButtonState(enabledCache);
  }

  function syncButtonVisibility() {
    var existing = document.querySelector(".ai-rtl-toggle-btn");

    if (buttonHidden) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) createToggleButton();
  }

  function flushRoots() {
    var roots = pendingRoots;
    pendingRoots = [];
    if (!enabledCache) return;

    var filtered = [];
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      if (!r || !r.isConnected) continue;

      var contained = false;
      for (var j = 0; j < filtered.length; j++) {
        if (filtered[j] === r || filtered[j].contains(r)) {
          contained = true;
          break;
        }
      }
      if (!contained) filtered.push(r);
    }

    for (var k = 0; k < filtered.length; k++) {
      processRoot(filtered[k]);
    }
  }

  var pendingRoots = [];
  var flushTimer;

  function queueMutations(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === "characterData") {
        if (m.target && m.target.parentElement) {
          pendingRoots.push(m.target.parentElement);
        }
      } else {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) {
            pendingRoots.push(n);
          } else if (n.parentElement) {
            pendingRoots.push(n.parentElement);
          }
        }
      }
    }

    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushRoots, 100);
  }

  function readSettings(cb) {
    chrome.storage.local.get(
      [
        "enabled",
        "threshold",
        "buttonPosition",
        "buttonCoords",
        "buttonHidden",
      ],
      function (result) {
        enabledCache = result.enabled !== false;
        thresholdValue =
          typeof result.threshold === "number"
            ? result.threshold
            : DEFAULT_THRESHOLD;
        buttonPosition = result.buttonPosition || DEFAULT_POSITION;
        buttonCoords = sanitizeCoords(result.buttonCoords);
        buttonHidden = result.buttonHidden === true;
        if (cb) cb();
      },
    );
  }

  function init() {
    document.addEventListener(
      "input",
      function (e) {
        var el = e.target;
        if (
          el &&
          el.nodeType === 1 &&
          el.matches &&
          el.matches(INPUT_SELECTOR)
        ) {
          processInput(el);
        }
      },
      true,
    );

    var observer = new MutationObserver(queueMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return;

      var reload = false;

      if (changes.enabled) {
        enabledCache = changes.enabled.newValue !== false;
        reload = true;
      }
      if (changes.threshold) {
        thresholdValue =
          typeof changes.threshold.newValue === "number"
            ? changes.threshold.newValue
            : DEFAULT_THRESHOLD;
        reload = true;
      }
      if (changes.buttonPosition) {
        buttonPosition = changes.buttonPosition.newValue || DEFAULT_POSITION;
        applyButtonPosition();
      }
      if (changes.buttonCoords) {
        buttonCoords = sanitizeCoords(changes.buttonCoords.newValue);
        applyButtonPosition();
      }
      if (changes.buttonHidden) {
        buttonHidden = changes.buttonHidden.newValue === true;
        syncButtonVisibility();
      }

      if (reload) applyEnabledState();
    });

    window.addEventListener("resize", function () {
      applyButtonPosition();
    });

    readSettings(function () {
      syncButtonVisibility();
      applyEnabledState();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", function () {
    if (enabledCache) processRoot(document.body);
  });
})();
