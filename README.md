# RTL AI

A browser extension that automatically detects and fixes RTL (right-to-left) text in AI responses from ChatGPT, Gemini, Claude, and other AI platforms.

## Features

- **Automatic RTL Detection**: Detects Arabic, Persian, Urdu, and other RTL languages in AI responses
- **One-Click Toggle**: Easy toggle button to enable/disable the extension on any page
- **Multi-Platform Support**: Works with ChatGPT, Gemini, Claude, Qwen, Kimi, Google Studio, DeepSeek, Perplexity, and more
- **Smart Detection**: Only applies RTL styling when RTL content is detected (>10% RTL characters)
- **Code Block Preservation**: Keeps code blocks in LTR (left-to-right) format for readability
- **Default On**: Extension is enabled by default for immediate use

## Supported Platforms

- ChatGPT (chatgpt.com, chat.openai.com)
- Gemini (gemini.google.com)
- Claude (claude.ai)
- Qwen (qwen.ai)
- Kimi (kimi.moonshot.cn)
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

1. Open Firefox and navigate to `about:config`
2. Search for `xpinstall.signatures.required` and set it to `false`
3. Compress the extnsion files to `.xpi` or `.zip`
4. Navigate to `about:addons`
5. Click the gear icon → "Install Add-on From File..."
6. Select the compressed file created earlier
7. The extension is now installed permanently

## Usage

1. Navigate to any supported AI platform (ChatGPT, Gemini, Claude, etc.)
2. The extension will automatically detect RTL text in AI responses
3. A toggle button (🔄 RTL) will appear in the top-right corner of the page
4. Click the button to toggle the extension on/off
5. When enabled, RTL text will be displayed right-to-left for better readability

## How It Works

The extension uses Unicode character ranges to detect RTL languages:

- Arabic (U+0600–U+06FF)
- Arabic Supplement (U+0750–U+077F)
- Arabic Presentation Forms (U+FB50–U+FDFF, U+FE70–U+FEFF)
- And more

When RTL content is detected (>10% of text), the extension applies rtl css.

## Customization

### Adding More Platforms

To add support for additional AI platforms, edit `manifest.json` and add the URL to the `matches` array:

```json
"matches": [
  "https://your-platform.com/*"
]
```

Then add appropriate CSS selectors to `content.js` in the `selectors` array.

### Adjusting RTL Threshold

To change the RTL detection threshold, modify the percentage in `content.js`:

```javascript
if (enabled && rtlPercentage > 10) {
  // Change 10 to your desired percentage
  applyRTL(element);
}
```

## Troubleshooting

### Toggle button not appearing

- Refresh the page after installing the extension
- Check that the extension is enabled in your browser's extension manager
- Ensure you're on a supported platform

### RTL not being detected

- The extension requires >10% RTL characters to trigger
- Check that the text contains actual RTL Unicode characters
- Try toggling the extension off and on

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
