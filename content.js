(() => {
  "use strict";

  let settings          = null;
  let autoSkipInterval  = null;
  let navOverlay        = null;
  let navObserver       = null;
  let skipCooldownUntil = 0;
  let navDebounceTimer  = null;
  let lastNextHref      = null;
  let lastPrevHref      = null;

  const STORAGE_KEY      = "settings";
  const SKIP_COOLDOWN_MS = 3000;
  const NAV_DEBOUNCE_MS  = 400;

  function loadSettings(callback) {
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      settings = data[STORAGE_KEY] || getDefaults();
      callback();
    });
  }

  function getDefaults() {
    return {
      autoSkip: {
        enabled  : true,
        selectors: [
          "button[aria-label^='Skip']",
          "button[aria-label*='Skip Intro']",
          "button[aria-label*='Skip Credits']",
          "button[aria-label*='Skip Recap']",
          "button[aria-label*='Skip Preview']",
          "button[aria-label*='Skip Opening']",
          "[data-t='skip-button']",
          "[data-testid='skip-intro-icon']",
          "[class*='skipContainer'] button",
          "[class*='SkipContainer'] button"
        ]
      },
      episodeNav: {
        enabled     : true,
        nextSelector: "[data-t='next-episode'] a.title, [data-t='next-episode'] a",
        prevSelector: "[data-t='prev-episode'] a.title, [data-t='prev-episode'] a",
        buttonStyle : {
          backgroundColor: "#f47521",
          color          : "#ffffff",
          fontSize       : "14px",
          padding        : "8px 16px",
          borderRadius   : "4px",
          fontWeight     : "600",
          position       : "bottom-right",
          opacity        : "0.9"
        }
      }
    };
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) {
      settings = changes[STORAGE_KEY].newValue;
      restartAll();
    }
  });

  function restartAll() {
    stopAutoSkip();
    removeNavOverlay();
    startAll();
  }

  function startAll() {
    if (!settings) return;
    if (settings.autoSkip && settings.autoSkip.enabled) {
      startAutoSkip();
    }
    if (settings.episodeNav && settings.episodeNav.enabled) {
      startEpisodeNav();
    }
  }

  function stopAutoSkip() {
    if (autoSkipInterval) {
      clearInterval(autoSkipInterval);
      autoSkipInterval = null;
    }
  }

  function startAutoSkip() {
    stopAutoSkip();
    autoSkipInterval = setInterval(tryClickSkip, 750);
  }

  function tryClickSkip() {
    if (!settings || !settings.autoSkip || !settings.autoSkip.enabled) return;
    if (Date.now() < skipCooldownUntil) return;

    const selectors = settings.autoSkip.selectors;
    if (!Array.isArray(selectors)) return;

    for (const selector of selectors) {
      try {
        const candidates = document.querySelectorAll(selector);
        for (const el of candidates) {
          if (isVisible(el)) {
            el.click();
            skipCooldownUntil = Date.now() + SKIP_COOLDOWN_MS;
            return;
          }
        }
      } catch (_) { }
    }
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const  style           = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function removeNavOverlay() {
    clearTimeout(navDebounceTimer);
    navDebounceTimer = null;
    if (navObserver) {
      navObserver.disconnect();
      navObserver = null;
    }
    if (navOverlay) {
      navOverlay.remove();
      navOverlay = null;
    }
    lastNextHref = null;
    lastPrevHref = null;
  }

  function startEpisodeNav() {
    if (!navOverlay) {
      navOverlay    = document.createElement("div");
      navOverlay.id = "cre-nav-overlay";
      applyOverlayStyle();
      document.body.appendChild(navOverlay);
    }

    navObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target === navOverlay || navOverlay.contains(m.target)) return;
      }
      scheduleNavUpdate();
    });

    navObserver.observe(document.body, { childList: true, subtree: true });

    scheduleNavUpdate();
  }

  function scheduleNavUpdate() {
    clearTimeout(navDebounceTimer);
    navDebounceTimer = setTimeout(updateNavOverlay, NAV_DEBOUNCE_MS);
  }

  function applyOverlayStyle() {
    if (!navOverlay) return;
    const pos = 
      settings &&
        settings.episodeNav &&
        settings.episodeNav.buttonStyle &&
        settings.episodeNav.buttonStyle.position
        ? settings.episodeNav.buttonStyle.position
        :   "bottom-right";

    const posMap = {
      "bottom-right": { bottom: "80px", right: "20px", top: "auto", left: "auto" },
      "bottom-left" : { bottom: "80px", left: "20px", top: "auto", right: "auto" },
      "top-right"   : { top: "80px", right: "20px", bottom: "auto", left: "auto" },
      "top-left"    : { top: "80px", left: "20px", bottom: "auto", right: "auto" }
    };
    const coords = posMap[pos] || posMap["bottom-right"];

    Object.assign(navOverlay.style, {
      position     : "fixed",
      zIndex       : "999999",
      display      : "flex",
      flexDirection: "column",
      gap          : "8px",
      pointerEvents: "none",
      ...coords
    });
  }

  function resolveLink(selector) {
    if (!selector) return null;
    try {
      const candidates = document.querySelectorAll(selector);
      for (const el of candidates) {
        if (el === navOverlay || navOverlay.contains(el)) continue;
        if (el.href && isEpisodeLink(el)) return el.href;
      }
    } catch (_) { }
    return null;
  }

  function isEpisodeLink(el) {
    const href = el.href || "";
    return (
      href.includes("/watch/") ||
      href.includes("/episode/") ||
      (href.includes("crunchyroll.com") && href !== window.location.href)
    );
  }

  function updateNavOverlay() {
    if (!navOverlay || !settings || !settings.episodeNav) return;

    const nextHref = resolveLink(settings.episodeNav.nextSelector);
    const prevHref = resolveLink(settings.episodeNav.prevSelector);

    if (nextHref === lastNextHref && prevHref === lastPrevHref) return;

    lastNextHref = nextHref;
    lastPrevHref = prevHref;

    if (navObserver) navObserver.disconnect();

    navOverlay.innerHTML = "";
    applyOverlayStyle();

    const btnStyle = settings.episodeNav.buttonStyle || {};
    if (prevHref) navOverlay.appendChild(makeButton("◀ Previous Episode", prevHref, btnStyle));
    if (nextHref) navOverlay.appendChild(makeButton("Next Episode ▶", nextHref, btnStyle));

    if (navObserver) {
      navObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function makeButton(label, href, btnStyle) {
    const btn             = document.createElement("a");
          btn.href        = href;
          btn.textContent = label;
          btn.target      = "_self";
    Object.assign(btn.style, {
      backgroundColor: btnStyle.backgroundColor || "#f47521",
      color          : btnStyle.color || "#ffffff",
      fontSize       : btnStyle.fontSize || "14px",
      padding        : btnStyle.padding || "8px 16px",
      borderRadius   : btnStyle.borderRadius || "4px",
      fontWeight     : btnStyle.fontWeight || "600",
      opacity        : btnStyle.opacity || "0.9",
      textDecoration : "none",
      display        : "inline-block",
      cursor         : "pointer",
      pointerEvents  : "auto",
      fontFamily     : "inherit",
      lineHeight     : "1.4",
      boxShadow      : "0 2px 8px rgba(0,0,0,0.4)",
      transition     : "opacity 0.15s",
      userSelect     : "none"
      
    });
    btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
    btn.addEventListener("mouseleave", () => { btn.style.opacity = btnStyle.opacity || "0.9"; });
    return btn;
  }

  loadSettings(() => {
    startAll();
  });
})();
