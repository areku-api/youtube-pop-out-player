const YT_MATCH =
  /^https?:\/\/(www\.|m\.|music\.)?youtube\.com\//i;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "yt-popout",
    title: "Pop Out YouTube Player",
    contexts: ["page", "video"],
    documentUrlPatterns: [
      "*://www.youtube.com/*",
      "*://youtube.com/*",
      "*://m.youtube.com/*",
      "*://music.youtube.com/*",
    ],
  });

  chrome.storage.sync.get({ autoPipOnTabHide: false }, (cfg) => {
    if (chrome.runtime.lastError) return;
    chrome.storage.sync.set(cfg);
  });
});

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function toggleOnTab(tabId) {
  // Inject first so TOGGLE runs under extension user-gesture chain when possible
  await ensureContentScript(tabId);
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (typeof window.__ytPopOutToggle === "function") {
        return window.__ytPopOutToggle();
      }
      return Promise.resolve({
        ok: false,
        error: "Content script not ready. Refresh the YouTube tab.",
      });
    },
  });
  return result;
}

async function toggleOnActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!tab?.id || !tab.url || !YT_MATCH.test(tab.url)) {
    return { ok: false, error: "Open a YouTube tab first." };
  }
  try {
    return await toggleOnTab(tab.id);
  } catch (err) {
    return { ok: false, error: err?.message || "Could not inject into tab." };
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-pip") await toggleOnActiveTab();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "yt-popout" && tab?.id) {
    try {
      await toggleOnTab(tab.id);
    } catch {
      /* ignore */
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "POPUP_TOGGLE") {
    toggleOnActiveTab().then(sendResponse);
    return true;
  }
  if (msg?.type === "GET_SETTINGS") {
    chrome.storage.sync.get({ autoPipOnTabHide: false }, sendResponse);
    return true;
  }
  if (msg?.type === "SET_SETTINGS") {
    chrome.storage.sync.set(msg.settings || {}, () => sendResponse({ ok: true }));
    return true;
  }
});
