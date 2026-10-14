const toggleBtn = document.getElementById("toggle");
const statusEl = document.getElementById("status");
const autoPip = document.getElementById("autoPip");

const YT_MATCH = /^https?:\/\/(www\.|m\.|music\.)?youtube\.com\//i;

function setStatus(text, isError = false) {
  statusEl.hidden = !text;
  statusEl.textContent = text || "";
  statusEl.classList.toggle("error", isError);
}

chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (cfg) => {
  if (chrome.runtime.lastError || !cfg) return;
  autoPip.checked = Boolean(cfg.autoPipOnTabHide);
});

autoPip.addEventListener("change", () => {
  chrome.runtime.sendMessage({
    type: "SET_SETTINGS",
    settings: { autoPipOnTabHide: autoPip.checked },
  });
});

toggleBtn.addEventListener("click", async () => {
  setStatus("Opening…");

  // Call scripting from popup click — better chance PiP accepts user gesture
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tab?.id || !tab.url || !YT_MATCH.test(tab.url)) {
      setStatus("Open a YouTube tab first.", true);
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__ytPopOutToggle(),
    });

    if (!result?.ok) {
      setStatus(result?.error || "Failed", true);
      return;
    }

    if (result.mode === "closed") {
      setStatus("Pop out closed.");
    } else {
      setStatus("Pop out active — switch tabs freely.");
    }
  } catch (err) {
    setStatus(err?.message || "Failed", true);
  }
});
