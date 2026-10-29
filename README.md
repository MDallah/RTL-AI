# RTL AI

A browser extension that automatically detects and fixes RTL (right-to-left) text in AI responses from ChatGPT, Gemini, Claude, and other AI platforms.

## Features

- **Automatic RTL Detection**: Detects Arabic, Persian, Urdu, and other RTL languages in AI responses
- **One-Click Toggle**: Easy toggle button to enable/disable the extension on any page
- **Drag & Drop Position**: Drag the toggle button anywhere on the page; its position is saved automatically
- **Hide Button**: Hide the floating toggle button from the toolbar popup when you don't need it
- **Multi-Platform Support**: Works with ChatGPT, Gemini, Claude, Qwen, Kimi, Google Studio, DeepSeek, Perplexity, and more
- **Iframe Support**: Also runs inside embedded frames and editors (`all_frames`)
- **TextBox Support**: Fixes RTL in textareas and `contenteditable` fields while you type
- **Native Bidi**: Uses `dir="auto"` so the browser applies the Unicode bidi algorithm, giving accurate results for mixed Arabic/English/numbers
- **Smart Detection**: Decides direction from the first strong character (with a percentage fallback for long text), so only genuinely RTL blocks are affected
- **List & Table Support**: Moves list markers to the right side and sets `dir="rtl"` on RTL tables
- **Code Block Preservation**: Keeps code blocks in LTR (left-to-right) format for readability
- **Custom Websites**: Add any site from the toolbar popup (host access is requested on the fly)
- **Toolbar Popup**: All settings in one popup, plus one-click "enable on this site"
- **Configurable**: Default on/off, detection threshold, floating button visibility and drag position, and extra websites
- **Default On**: Extension is enabled by default for immediate use

## Supported Platforms

- ChatGPT (chatgpt.com, chat.openai.com)
- Gemini (gemini.google.com)
- Claude (claude.ai)
- Qwen (qwen.ai)
- Kimi (kimi.ai, kimi.com)
- Google AI Studio (aistudio.google.com)
- DeepSeek (deepseek.com)
- Perplexity (perplexity.ai)
- Microsoft Copilot (copilot.microsoft.com)
- And more with generic selectors

## Installation

### Chrome/Edge/Brave/Vivaldi

1. Download or clone this repository
2. Open your browser and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `RTL AI` folder
5. The extension is now installed!

### Firefox (Permanent Installation)

Requires **Firefox 128 or newer**.

1. Open Firefox and navigate to `about:config`
2. Search for `xpinstall.signatures.required` and set it to `false`
3. Compress the extension files to `.xpi` or `.zip`. Zip the files themselves so `manifest.json` is at the **root** of the archive (do not zip the parent folder).
4. Navigate to `about:addons`
5. Click the gear icon → "Install Add-on From File..."
6. Select the compressed file created earlier
7. The extension is now installed permanently

> Firefox does not support `background.service_worker`, so the manifest declares both `background.service_worker` (for Chrome) and `background.scripts` (for Firefox). Chrome ignores `background.scripts`, Firefox uses it as an event page.

## Usage

1. Navigate to any supported AI platform (ChatGPT, Gemini, Claude, etc.)
2. The extension will automatically detect RTL text in AI responses
3. A toggle button (⇄) will appear on the page (bottom-right by default)
4. Click the button to toggle the extension on/off
5. Drag the button to any spot to save a custom position
6. When enabled, RTL text will be displayed right-to-left for better readability

## Toolbar Popup

Click the RTL AI toolbar icon to open the popup, which contains **all settings**:

- **Enable/disable** the extension everywhere (header switch)
- **This site**: **Enable on this site** for the current website (requests access and applies immediately) or **Disable on this site** to remove it
- **Detection threshold (%)**: Minimum share of RTL characters before a block is treated as RTL (default `10`)
- **Show the floating toggle button**: Uncheck to hide the ⇄ button on all pages. Hiding it does not disable RTL fixing.
- **Drag the button**: Move the ⇄ button anywhere on the page; its position is saved automatically.
- **Additional websites**: Add/remove any site not in the default list

Changes are applied live to open tabs.

## How It Works

The extension uses Unicode character ranges to detect RTL languages:

- Arabic (U+0600–U+06FF)
- Arabic Supplement (U+0750–U+077F)
- Arabic Presentation Forms (U+FB50–U+FDFF, U+FE70–U+FEFF)
- And more

When RTL content is detected, the extension:

- decides direction using the **first strong character** (like the browser's `dir="auto"`), so short mixed sentences such as `Hi محمد` stay LTR while `مرحبا Hi` becomes RTL. Long text that starts with a Latin word but is mostly RTL (e.g. `ChatGPT هو أداة مفيدة`) is still treated as RTL via the percentage fallback;
- adds the `dir="auto"` attribute so the browser resolves direction with the native Unicode bidi algorithm (accurate for mixed Arabic/English/numbers); and
- marks the element with `ai-rtl-fixed`, which isolates it and aligns its content to the right via CSS.

Only the elements whose content is detected as RTL are processed, and only newly added or changed nodes are re-scanned as the page updates.

## Customization

### Settings

All settings live in the toolbar popup: global enable/disable, detection threshold, floating button visibility, and additional websites.

### Adding More Websites

Open the popup and type a domain under **Additional websites** (for example `example.com`, or `http://localhost:3000` for a local site), then click **Add**. The browser asks you to grant access to that site; once granted, the extension starts working there immediately. Remove a site with the **Remove** button. You can also use **Enable on this site** in the popup for the current page.

The browser shows its permission prompt the first time you add each origin (including `http://localhost`). Choose **Allow**. `http://` and `https://` are separate origins and may each need permission once. Sites that are already in the list do not prompt again.

Under the hood, a background script (`background.js`) registers the content script dynamically for the granted sites via `chrome.scripting.registerContentScripts`, since the `manifest.json` `matches` list is fixed at install time.

### Adding Built-in Platforms

To ship a platform by default (for all users), edit `manifest.json` and add the URL to the `matches` array:

```json
"matches": [
  "https://your-platform.com/*"
]
```

Then add any platform-specific selectors to `styles.css`.

### Adjusting RTL Threshold

Open the popup and change **Detection threshold (%)**, or edit the default in `content.js`:

```javascript
var DEFAULT_THRESHOLD = 10; // change to your preferred percentage
```

## Troubleshooting

### Toggle button not appearing

- Refresh the page after installing the extension
- Check that the extension is enabled in your browser's extension manager
- Ensure you're on a supported platform

### Permission prompt keeps appearing

- The prompt is the browser asking for host access to a new origin; it is required before RTL AI can run on that site.
- Choose **Allow** once for the site. If you choose **Deny**, the browser will ask again the next time you try to add it.
- `http://` and `https://` versions of a site, and `localhost` versus `127.0.0.1`, count as different origins.
- Removing a site also removes its permission, so re-adding it asks again.

### RTL not being detected

- The extension requires the configured share of RTL characters to trigger (default 10%)
- Check that the text contains actual RTL Unicode characters
- Lower the threshold in the popup and try again

### Code blocks appearing in RTL

- The extension attempts to keep code blocks in LTR format
- If code blocks are still RTL, you may need to add specific selectors to `styles.css`

## License

MIT License - Feel free to use, modify, and distribute.

## Contributing

Contributions are welcome! Feel free to:

- Add support for more AI platforms
- Improve RTL detection accuracy
- Add new features
- Fix bugs
