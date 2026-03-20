(() => {
  "use strict";

  // Inject toast CSS animations immediately
  (() => {
    if (document.head) {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeinup-cre {
          from { 
            opacity: 0; 
            transform: translateY(20px);
          }
          to { 
            opacity: 1; 
            transform: translateY(0);
          }
        }
        @keyframes fadeoutdown-cre {
          from { 
            opacity: 1; 
            transform: translateY(0);
          }
          to { 
            opacity: 0; 
            transform: translateY(20px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  })();

  let settings            = null;
  let autoSkipInterval    = null;
  let skipCooldownMap     = {};
  let navDebounceTimer    = null;
  let navObserver         = null;
  let lastNextHref        = null;
  let lastPrevHref        = null;
  let prevButton          = null;
  let nextButton          = null;
  let autoSkipToggle      = null;
  let episodeNavToggle    = null;
  let toastContainer      = null;

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

    const selectors = settings.autoSkip.selectors;
    if (!Array.isArray(selectors)) return;

    for (const selector of selectors) {
      try {
        const candidates = document.querySelectorAll(selector);
        for (const el of candidates) {
          if (isVisible(el)) {
            // Check per-selector cooldown
            if (Date.now() < (skipCooldownMap[selector] || 0)) return;
            
            el.click();
            skipCooldownMap[selector] = Date.now() + SKIP_COOLDOWN_MS;
            
            // Extract skip type from aria-label or data attributes
            const skipType = extractSkipType(el);
            showToast(`Skip: ${skipType}`);
            return;
          }
        }
      } catch (_) { }
    }
  }

  function extractSkipType(el) {
    const ariaLabel = el.getAttribute('aria-label') || '';
    if (ariaLabel.includes('Intro')) return 'Intro';
    if (ariaLabel.includes('Credits')) return 'Credits';
    if (ariaLabel.includes('Recap')) return 'Recap';
    if (ariaLabel.includes('Preview')) return 'Preview';
    if (ariaLabel.includes('Opening')) return 'Opening';
    if (ariaLabel.includes('Skip')) return 'Skipping';
    return 'Content';
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
    if (prevButton) {
      prevButton.remove();
      prevButton = null;
    }
    if (nextButton) {
      nextButton.remove();
      nextButton = null;
    }
    if (autoSkipToggle) {
      autoSkipToggle.remove();
      autoSkipToggle = null;
    }
    if (episodeNavToggle) {
      episodeNavToggle.remove();
      episodeNavToggle = null;
    }
    lastNextHref = null;
    lastPrevHref = null;
  }

  function startEpisodeNav() {
    navObserver = new MutationObserver((mutations) => {
      scheduleNavUpdate();
    });

    navObserver.observe(document.body, { childList: true, subtree: true });
    injectFeatureToggles();
    scheduleNavUpdate();
  }

  function scheduleNavUpdate() {
    clearTimeout(navDebounceTimer);
    navDebounceTimer = setTimeout(updateNavOverlay, NAV_DEBOUNCE_MS);
  }

  function resolveLink(selector) {
    if (!selector) return null;
    try {
      const candidates = document.querySelectorAll(selector);
      for (const el of candidates) {
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
    if (!settings || !settings.episodeNav) return;

    const nextHref = resolveLink(settings.episodeNav.nextSelector);
    const prevHref = resolveLink(settings.episodeNav.prevSelector);

    if (nextHref === lastNextHref && prevHref === lastPrevHref) return;

    lastNextHref = nextHref;
    lastPrevHref = prevHref;

    injectNavButtonsToPlayer(prevHref, nextHref);
  }

  function injectFeatureToggles() {
    const controlStack = document.querySelector('[data-testid="bottom-right-controls-stack"]');
    if (!controlStack) return;

    // Remove old toggles if they exist
    if (autoSkipToggle && controlStack.contains(autoSkipToggle)) autoSkipToggle.remove();
    if (episodeNavToggle && controlStack.contains(episodeNavToggle)) episodeNavToggle.remove();

    autoSkipToggle = null;
    episodeNavToggle = null;

    // Create auto-skip toggle
    if (settings && settings.autoSkip) {
      autoSkipToggle = createFeatureToggle(
        "Toggle Auto-Skip",
        settings.autoSkip.enabled,
        getAutoSkipIcon,
        () => toggleSetting('autoSkip')
      );
      controlStack.appendChild(autoSkipToggle);
    }

    // Create episode nav toggle
    if (settings && settings.episodeNav) {
      episodeNavToggle = createFeatureToggle(
        "Toggle Episode Navigation",
        settings.episodeNav.enabled,
        getEpisodeNavIcon,
        () => toggleSetting('episodeNav')
      );
      controlStack.appendChild(episodeNavToggle);
    }
  }

  function toggleSetting(feature) {
    if (!settings || !settings[feature]) return;
    settings[feature].enabled = !settings[feature].enabled;
    chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    showToast(`${feature === 'autoSkip' ? 'Auto-Skip' : 'Episode Nav'}: ${settings[feature].enabled ? 'ON' : 'OFF'}`);
  }

  function injectNavButtonsToPlayer(prevHref, nextHref) {
    const controlStack = document.querySelector('[data-testid="bottom-right-controls-stack"]');
    if (!controlStack) return;

    // Remove old buttons if they exist
    if (prevButton && controlStack.contains(prevButton)) prevButton.remove();
    if (nextButton && controlStack.contains(nextButton)) nextButton.remove();

    prevButton = null;
    nextButton = null;

    // Create and inject prev button if href exists
    if (prevHref) {
      prevButton = createNavButton("Previous Episode", prevHref, getPrevIcon(), () => {
        showToast('Previous Episode');
      });
      controlStack.insertBefore(prevButton, controlStack.firstChild);
    }

    // Create and inject next button if href exists, right after prev button
    if (nextHref) {
      nextButton = createNavButton("Next Episode", nextHref, getNextIcon(), () => {
        showToast('Next Episode');
      });
      const insertAfter = prevButton ? prevButton.nextSibling : controlStack.firstChild;
      controlStack.insertBefore(nextButton, insertAfter);
    }
  }

  function createNavButton(label, href, iconSvg, onClickCallback) {
    const btn                      = document.createElement("button");
          btn.type                 = "button";
          btn.ariaLabel            = label;
          btn.style.background     = "none";
          btn.style.border         = "none";
          btn.style.cursor         = "pointer";
          btn.style.padding        = "0 12px";
          btn.style.margin         = "0";
          btn.style.display        = "flex";
          btn.style.alignItems     = "center";
          btn.style.justifyContent = "center";
          btn.style.width          = "auto";
          btn.style.height         = "100%";
          btn.style.transition     = "background-color 0.2s ease";
          btn.innerHTML            = iconSvg;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (onClickCallback) onClickCallback();
      window.location.href = href;
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = "rgba(244, 117, 33, 0.15)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "none";
    });

    return btn;
  }

  function createFeatureToggle(label, isEnabled, iconFn, onToggle) {
    const btn                      = document.createElement("button");
          btn.type                 = "button";
          btn.ariaLabel            = label;
          btn.style.background     = "none";
          btn.style.border         = "none";
          btn.style.cursor         = "pointer";
          btn.style.padding        = "0 12px";
          btn.style.margin         = "0";
          btn.style.display        = "flex";
          btn.style.alignItems     = "center";
          btn.style.justifyContent = "center";
          btn.style.width          = "auto";
          btn.style.height         = "100%";
          btn.style.transition     = "background-color 0.2s ease, opacity 0.2s ease";
          btn.style.opacity        = isEnabled ? "1" : "0.5";
          btn.innerHTML            = iconFn(isEnabled);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onToggle();
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = "rgba(244, 117, 33, 0.15)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "none";
    });

    return btn;
  }

  function showToast(message) {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "cre-toast-container";
      toastContainer.style.position = "fixed";
      toastContainer.style.bottom = "20px";
      toastContainer.style.left = "20px";
      toastContainer.style.zIndex = "999999";
      toastContainer.style.display = "flex";
      toastContainer.style.flexDirection = "column";
      toastContainer.style.gap = "8px";
      toastContainer.style.pointerEvents = "none";
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.style.backgroundColor = "#f47521";
    toast.style.color = "#ffffff";
    toast.style.padding = "12px 16px";
    toast.style.borderRadius = "4px";
    toast.style.fontSize = "13px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
    toast.style.display = "block";
    toast.style.whiteSpace = "nowrap";
    toast.style.willChange = "transform, opacity";
    toast.style.animation = "fadeinup-cre 0.3s ease forwards";
    toast.style.pointerEvents = "auto";
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "fadeoutdown-cre 0.3s ease forwards";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function getPrevIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 24px; height: 24px; fill: currentColor;">
      <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;
  }

  function getNextIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 24px; height: 24px; fill: currentColor;">
      <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;
  }

  function getAutoSkipIcon(isEnabled) {
    const opacity = isEnabled ? "1" : "0.5";
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 24px; height: 24px; fill: currentColor; opacity: ${opacity};">
      <path d="M9 3H15V9H9V3Z" stroke="currentColor" stroke-width="1.5" fill="none"></path>
      <path d="M15 12L9 18M15 18L9 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>`;
  }

  function getEpisodeNavIcon(isEnabled) {
    const opacity = isEnabled ? "1" : "0.5";
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 24px; height: 24px; fill: currentColor; opacity: ${opacity};">
      <path d="M4 6H20V18H4V6Z" stroke="currentColor" stroke-width="1.5" fill="none"></path>
      <path d="M9 10L14 13L9 16V10Z" fill="currentColor"></path>
    </svg>`;
  }

  loadSettings(() => {
    startAll();
  });
})();
