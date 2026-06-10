// RTL AI - Content Script
(function () {
  "use strict";

  // RTL character ranges for common RTL languages
  const RTL_PATTERNS = [
    /[\u0600-\u06FF]/, // Arabic
    /[\u0750-\u077F]/, // Arabic Supplement
    /[\uFB50-\uFDFF]/, // Arabic Presentation Forms-A
    /[\uFE70-\uFEFF]/, // Arabic Presentation Forms-B
    /[\u07C0-\u07FA]/, // NKo
    /[\u08A0-\u08FF]/, // Arabic Extended-A
  ];

  // Check if text contains RTL characters
  function containsRTL(text) {
    if (!text) return false;
    return RTL_PATTERNS.some((pattern) => pattern.test(text));
  }

  // Get the percentage of RTL characters in text
  function getRTLPercentage(text) {
    if (!text || text.length === 0) return 0;
    let rtlChars = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (RTL_PATTERNS.some((pattern) => pattern.test(char))) {
        rtlChars++;
      }
    }
    return (rtlChars / text.length) * 100;
  }

  // Apply RTL styling to an element
  function applyRTL(element) {
    if (!element || element.classList.contains("ai-rtl-fixed")) return;

    element.classList.add("ai-rtl-fixed");
    element.style.direction = "rtl";
    element.style.textAlign = "right";
    element.style.unicodeBidi = "plaintext";
  }

  // Remove RTL styling from an element
  function removeRTL(element) {
    if (!element) return;
    element.classList.remove("ai-rtl-fixed");
    element.style.direction = "";
    element.style.textAlign = "";
    element.style.unicodeBidi = "";
  }

  // Process all text nodes in the document
  function processTextNodes() {
    chrome.storage.sync.get(["enabled"], function (result) {
      const enabled = result.enabled !== false; // Default to true

      // Find AI response containers based on different platforms
      const selectors = [
        // ChatGPT
        '[data-message-author-role="assistant"]',
        '[data-testid="conversation-turn-3"]',
        ".text-base",
        // Gemini
        '[data-test-id="response-text"]',
        ".model-response-text",
        // Claude
        '[data-is-streamed="true"]',
        ".font-claude-message",
        // Qwen
        ".qwen-response",
        ".assistant-message",
        // Kimi
        ".kimi-message",
        ".message-content",
        // Google Studio
        ".model-response",
        ".response-container",
        // DeepSeek
        ".ds-message",
        ".message-assistant",
        // Perplexity
        '[data-testid="answer"]',
        ".prose",
        // Generic selectors
        '[class*="message"][class*="assistant"]',
        '[class*="response"]',
        '[class*="ai"]',
        '[role="assistant"]',
      ];

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const text = element.textContent;
          const rtlPercentage = getRTLPercentage(text);

          if (enabled && rtlPercentage > 10) {
            // If element is a span, apply RTL to its parent
            if (element.tagName === "SPAN") {
              const parent = element.parentElement;
              if (parent && !parent.classList.contains("ai-rtl-fixed")) {
                applyRTL(parent);
              }
            } else {
              applyRTL(element);
            }
          } else if (!enabled) {
            removeRTL(element);
          }
        });
      });

      // Also check all text nodes directly
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function (node) {
            if (node.parentElement.classList.contains("ai-rtl-toggle-btn")) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );

      let textNode;
      while ((textNode = walker.nextNode())) {
        const text = textNode.textContent;
        const rtlPercentage = getRTLPercentage(text);

        if (enabled && rtlPercentage > 10) {
          const parent = textNode.parentElement;
          if (parent) {
            // If parent is a span, apply RTL to its parent instead
            if (parent.tagName === "SPAN") {
              const grandparent = parent.parentElement;
              if (
                grandparent &&
                !grandparent.classList.contains("ai-rtl-fixed")
              ) {
                applyRTL(grandparent);
              }
            } else if (!parent.classList.contains("ai-rtl-fixed")) {
              applyRTL(parent);
            }
          }
        }
      }
    });
  }

  // Create toggle button
  function createToggleButton() {
    // Check if button already exists
    if (document.querySelector(".ai-rtl-toggle-btn")) return;

    const button = document.createElement("button");
    button.className = "ai-rtl-toggle-btn";
    button.innerHTML = " ⇋ ";
    button.title = "Toggle RTL Fix";

    // Position the button
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
      const isEnabled = enabled !== false;

      button.classList.toggle("disabled", !isEnabled);
      button.style.backgroundColor = isEnabled ? "#4a8fd9" : "#6b7280";
      button.style.borderColor = isEnabled ? "#4a8fd9" : "#9ca3af";
      button.style.color = "white";
      button.innerHTML = "⇄";
      button.title = isEnabled ? "RTL Fix is enabled" : "RTL Fix is disabled";
    }

    // Toggle functionality
    button.addEventListener("click", function () {
      chrome.storage.sync.get(["enabled"], function (result) {
        const currentEnabled = result.enabled !== false;
        const newState = !currentEnabled;

        chrome.storage.sync.set({ enabled: newState }, function () {
          updateButtonState(newState);
          processTextNodes();
        });
      });
    });

    // Check current state and update button
    chrome.storage.sync.get(["enabled"], function (result) {
      updateButtonState(result.enabled);
    });

    document.body.appendChild(button);
  }

  // Initialize
  function init() {
    // Create toggle button
    createToggleButton();

    // Initial processing
    processTextNodes();

    // Observe DOM changes for dynamic content
    const observer = new MutationObserver(function (mutations) {
      processTextNodes();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Also run on window load to catch late-loading content
  window.addEventListener("load", processTextNodes);
})();
