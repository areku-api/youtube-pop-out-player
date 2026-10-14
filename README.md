# YouTube Pop Out Player

Chrome extension — pop YouTube video into always-on-top Picture-in-Picture. Stays visible when you switch tabs or windows.

## Features

- **Toolbar / popup** — click **Pop Out Player**
- **Keyboard** — `Ctrl+Shift+P` (Mac: `⌘⇧P`)
- **Right-click** — “Pop Out YouTube Player” on YouTube pages
- **Document PiP** (Chrome) — moves the whole player into a floating window
- **Fallback** — standard `<video>` Picture-in-Picture if Document PiP fails
- **Optional auto** — pop out when you leave the tab (video must be playing & unmuted)

## Install (Load Unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `extension/` (the one with `manifest.json`)
5. Open a YouTube watch page → click the extension icon → **Pop Out Player**

Pin the extension for faster access. Change the shortcut at `chrome://extensions/shortcuts`.

## How it works (architecture)

```
popup.js / keyboard / context menu
        ↓
  background.js  (service worker)  →  chrome.tabs.sendMessage
        ↓
  content.js     (runs on youtube.com)
        ↓
  documentPictureInPicture.requestWindow()  OR  video.requestPictureInPicture()
```

| File | Role |
|------|------|
| `manifest.json` | MV3 config, permissions, content script matches |
| `background.js` | Commands, context menu, message relay |
| `content.js` | Find video/player, open/close PiP |
| `popup.html/js/css` | UI + settings |
| `icons/` | Extension icons |

## Adapt into your own Chrome extension

### 1. Minimum skeleton

Copy these pieces into any MV3 extension:

1. **`manifest.json`**
   - `"manifest_version": 3`
   - `"permissions": ["activeTab", "scripting", "storage"]` (add `contextMenus` if you want right-click)
   - `"host_permissions"` for sites you target
   - `"background.service_worker"`
   - `"content_scripts"` matching those hosts
   - optional `"commands"` for shortcuts
   - optional `"action.default_popup"`

2. **Background** — receive click/shortcut → `tabs.sendMessage({ type: "TOGGLE_PIP" })`. If content script not injected yet, `scripting.executeScript` then retry.

3. **Content script** — DOM access only happens here (not in the service worker):
   - find `<video>`
   - call PiP API (needs user gesture: click or shortcut)

### 2. Swap YouTube → any site

In `content.js`, change selectors:

```js
// YouTube-specific
document.querySelector("video.html5-main-video");

// Generic: largest playing video
[...document.querySelectorAll("video")]
  .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
```

Update `manifest.json` `matches` / `host_permissions`:

```json
"matches": ["*://*.example.com/*"],
"host_permissions": ["*://*.example.com/*"]
```

### 3. Choose PiP mode

| Mode | API | Pros | Cons |
|------|-----|------|------|
| Document PiP | `documentPictureInPicture.requestWindow()` | Custom HTML/controls, move whole player | Chrome/Edge mainly; needs gesture |
| Video PiP | `video.requestPictureInPicture()` | Wide support, simple | Browser chrome only, one video |

Pattern:

```js
async function popOut(video) {
  if ("documentPictureInPicture" in window) {
    const pip = await documentPictureInPicture.requestWindow({
      width: video.clientWidth,
      height: video.clientHeight,
    });
    // move player node into pip.document.body
    return;
  }
  await video.requestPictureInPicture();
}
```

### 4. Cross-tab / cross-window

PiP window is OS-level always-on-top. After open, user can switch tabs/windows freely — no extra code. Content script must run in the **tab that owns the video** before PiP opens.

### 5. Publish (optional)

1. Zip the folder (include `manifest.json`, exclude `.git`)
2. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → New item → upload zip
3. Fill listing, privacy (state you only run on YouTube), screenshots

### 6. Common pitfalls

- **Service worker cannot touch page DOM** — always use a content script
- **PiP needs a user gesture** — auto-on-tab-hide is limited; unmuted + playing works best
- **YouTube is an SPA** — re-query `video` on each toggle; don’t cache forever
- **CSP** — don’t inject inline `<script>`; keep logic in extension JS files
- **Permissions** — request only hosts you need; prefer `activeTab` when possible

## Usage tips

- Unmute video if using **Auto pop out when leaving tab**
- Click the same button / shortcut again to close PiP
- Document PiP keeps more of the YouTube player UI; fallback is native mini player
