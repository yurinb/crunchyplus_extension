# Crunchyroll Enhancer — Chrome Extension

A Chrome Extension that improves the Crunchyroll viewing experience with auto-skip and episode navigation.

## Features

- **Auto-Skip**: Automatically clicks Skip Intro, Skip Recap, Skip Preview, and Skip Credits buttons when they appear.
- **Episode Navigation**: Injects Previous / Next Episode buttons directly on the player screen so you never have to scroll.
- **Full configurability**: Toggle each feature on/off, change button selectors, and customize the look and position of injected buttons — all from the popup.

## Installation (Developer / Unpacked Mode)

Chrome extensions that aren't published to the Web Store can be loaded directly from your computer.

1. Open Google Chrome.
2. In the address bar, go to: `chrome://extensions`
3. In the top-right corner, enable **Developer mode** (toggle switch).
4. Click **"Load unpacked"** (top-left button).
5. Select the `crunchyroll-extension/` folder (the folder that contains `manifest.json`).
6. The extension will now appear in your extensions list and toolbar.

> The extension only activates on `https://www.crunchyroll.com/*` pages — it has no access to any other site.

## Usage

- Click the orange **C** icon in your Chrome toolbar to open the settings popup.
- Toggle **Auto-Skip** and **Episode Navigation** features on or off.
- Expand each section to customize CSS selectors or button styles.
- Click **Save Settings** to apply changes immediately (no page refresh needed).

## Configuration

### Auto-Skip Selectors
A list of CSS selectors (one per line) that the extension will check every ~750ms. When any matching element is visible, it will be clicked. You can add or remove selectors as Crunchyroll updates its site.

Default selectors target common skip button patterns:
- `.skip-btn`
- `[data-t='skip-button']`
- `[class*='skipContainer'] button`
- and more...

### Episode Navigation Selectors
Two CSS selector strings (comma-separated, like standard `querySelectorAll`) that the extension uses to find the existing Next and Previous Episode links already in the Crunchyroll page, then creates overlay buttons pointing to those links.

### Button Style
Customize the visual appearance of the injected episode navigation buttons:
- Background color, text color
- Font size, padding, border radius, font weight
- Opacity
- Position on screen: Bottom Right, Bottom Left, Top Right, Top Left

## File Structure

```
crunchyroll-extension/
├── manifest.json       # Extension config (Manifest V3)
├── background.js       # Service worker — sets default settings on install
├── content.js          # Main logic injected into Crunchyroll pages
├── popup.html          # Settings popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup logic (read/write settings)
└── icons/              # Extension icons
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Updating Selectors

If Crunchyroll updates their site and the extension stops working:
1. Open Chrome DevTools on a Crunchyroll video page (F12).
2. Use the Inspector to find the skip button or episode link elements.
3. Copy their CSS class names or `data-*` attributes.
4. Open the extension popup and update the selectors accordingly.
5. Save.
