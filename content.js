(() => {
  if (window.__ytPopOutLoaded) return;
  window.__ytPopOutLoaded = true;

  function findVideo() {
    const selectors = [
      "#movie_player video.html5-main-video",
      ".html5-video-player video.html5-main-video",
      "ytd-player video.html5-main-video",
      "video.html5-main-video",
      "#movie_player video",
      "ytd-player video",
      "video",
    ];

    for (const sel of selectors) {
      const list = [...document.querySelectorAll(sel)].filter(
        (v) => v instanceof HTMLVideoElement
      );
      const ready = list.filter(
        (v) => v.readyState >= 2 && v.videoWidth > 0 && !v.disablePictureInPicture
      );
      if (ready.length) {
        return ready.sort(
          (a, b) =>
            b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
        )[0];
      }
      if (list.length) {
        return list.sort(
          (a, b) =>
            b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
        )[0];
      }
    }
    return null;
  }

  async function openVideoPip(video) {
    // YouTube sometimes blocks PiP on the element
    if (video.disablePictureInPicture) {
      video.disablePictureInPicture = false;
    }
    video.removeAttribute("disablePictureInPicture");

    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture();
      return { mode: "closed" };
    }

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }

    // Must be playing for a stable frame (avoids black PiP)
    if (video.paused || video.readyState < 2) {
      try {
        await video.play();
      } catch {
        /* may still work if already had frames */
      }
    }

    // Wait one frame so decoder has painted
    await new Promise((r) => requestAnimationFrame(() => r()));

    await video.requestPictureInPicture();
    return { mode: "video-pip" };
  }

  async function togglePip() {
    const video = findVideo();
    if (!video) {
      return {
        ok: false,
        error: "No YouTube video found. Play the video first, then try again.",
      };
    }

    try {
      // Native <video> PiP only — Document PiP + moving #movie_player = black screen on YT
      const result = await openVideoPip(video);
      return { ok: true, ...result };
    } catch (err) {
      return {
        ok: false,
        error:
          err?.message ||
          "PiP failed. Play (unmute helps), then click Pop Out again.",
      };
    }
  }

  window.__ytPopOutToggle = togglePip;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "TOGGLE_PIP") {
      togglePip().then(sendResponse);
      return true;
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "hidden") return;

    const { autoPipOnTabHide } = await chrome.storage.sync.get({
      autoPipOnTabHide: false,
    });
    if (!autoPipOnTabHide) return;

    const video = findVideo();
    if (!video || video.paused) return;
    if (document.pictureInPictureElement) return;

    try {
      await togglePip();
    } catch {
      /* activation budget */
    }
  });
})();
