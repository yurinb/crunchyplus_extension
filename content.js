(() => {
  "use strict";

      // Inject toast CSS animations immediately
  (() => {
    if (document.head) {
      const style             = document.createElement('style');
            style.textContent = `
        @keyframes fadeinup-cre {
          from { 
            opacity  : 0;
            transform: translateY(20px);
          }
          to { 
            opacity  : 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeoutdown-cre {
          from { 
            opacity  : 1;
            transform: translateY(0);
          }
          to { 
            opacity  : 0;
            transform: translateY(20px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  })();

  let settings         = null;
  let autoSkipInterval = null;
  let skipCooldownMap  = {};
  let navDebounceTimer = null;
  let navObserver      = null;
  let lastNextHref     = null;
  let lastPrevHref     = null;
  let prevButton       = null;
  let nextButton       = null;
  let autoSkipToggle   = null;
  let episodeNavToggle = null;
  let toastContainer   = null;
  let extensionIndicator = null;
  let pendingActionMap = {};

  const STORAGE_KEY = "settings";

  function loadSettings(callback) {
    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      settings = normalizeSettings(data[STORAGE_KEY] || getDefaults());
      callback();
    });
  }

  function normalizeSettings(rawSettings) {
    const defaults = getDefaults();
    const merged = {
      ...defaults,
      ...rawSettings,
      autoSkip: {
        ...defaults.autoSkip,
        ...(rawSettings?.autoSkip || {})
      },
      episodeNav: {
        ...defaults.episodeNav,
        ...(rawSettings?.episodeNav || {})
      },
      theme: {
        ...defaults.theme,
        ...(rawSettings?.theme || {})
      },
      advanced: {
        ...defaults.advanced,
        ...(rawSettings?.advanced || {})
      }
    };

    // Legacy cleanup: navigation button style is no longer used.
    delete merged.episodeNav.buttonStyle;

    // Legacy compatibility: if only rgba hover color exists, keep it working.
    if (!merged.theme.hoverBgColorHex && merged.theme.hoverBgColor) {
      merged.theme.hoverBgColorHex = "#f47521";
      merged.theme.hoverBgOpacity = 0.15;
    }

    // Legacy compatibility: migrate old toast X/Y coordinates to preset model.
    if (!merged.theme.toastPositionPreset) {
      merged.theme.toastPositionPreset = "bottom-left";
      merged.theme.toastInset = merged.theme.toastPositionY || "20px";
    }
    delete merged.theme.toastPositionX;
    delete merged.theme.toastPositionY;

    return merged;
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
        prevSelector: "[data-t='prev-episode'] a.title, [data-t='prev-episode'] a"
      },
      theme: {
        primaryColor          : "#f47521",
        onPrimaryColor        : "#ffffff",
        hoverBgColorHex       : "#f47521",
        hoverBgOpacity        : 0.15,
        hoverBgColor          : "rgba(244, 117, 33, 0.15)",
        disabledOpacity       : "0.5",
        buttonPaddingX        : "12px",
        buttonHoverTransitionMs: "200",
        toastPositionPreset   : "bottom-left",
        toastInset            : "20px",
        toastAnimationMs      : 300,
        toastPadding          : "12px 16px",
        toastBorderRadius     : "4px",
        toastFontSize         : "13px",
        toastFontWeight       : "600",
        toastBoxShadow        : "0 4px 12px rgba(0,0,0,0.5)",
        toastProgressTrackColor: "rgba(255,255,255,0.25)",
        toastProgressBarColor : "rgba(255,255,255,0.95)",
        toastGap              : "8px",
        iconSize              : "24px"
      },
      advanced: {
        skipIntervalMs         : 750,
        skipCooldownMs         : 3000,
        navDebounceMs          : 400,
        toastEnabled           : true,
        actionDelayMs          : 1500,
        navActionDelayMs       : 1500,
        toastDurationMs        : 2500
      }
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function hexToRgb(hex) {
    if (!hex || typeof hex !== "string") return null;
    const value = hex.trim().replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function getHoverBgColor() {
    const theme = settings.theme || {};
    if (theme.hoverBgColorHex) {
      const rgb = hexToRgb(theme.hoverBgColorHex);
      if (rgb) {
        const opacity = clamp(Number(theme.hoverBgOpacity ?? 0.15), 0, 1);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      }
    }
    return theme.hoverBgColor || "rgba(244, 117, 33, 0.15)";
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) {
      settings = normalizeSettings(changes[STORAGE_KEY].newValue);
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
    const interval         = settings.advanced?.skipIntervalMs || 750;
          autoSkipInterval = setInterval(tryClickSkip, interval);
  }

  function tryClickSkip() {
    if (!settings || !settings.autoSkip || !settings.autoSkip.enabled) return;

    const selectors = settings.autoSkip.selectors;
    if (!Array.isArray(selectors)) return;
    
    const cooldownMs = settings.advanced?.skipCooldownMs || 3000;

    for (const selector of selectors) {
      try {
        const candidates = document.querySelectorAll(selector);
        for (const el of candidates) {
          if (isVisible(el)) {
                // Check per-selector cooldown
            if (Date.now() < (skipCooldownMap[selector] || 0)) return;

            const actionKey = `skip:${selector}`;
            if (pendingActionMap[actionKey]) return;
            
                // Extract skip type from aria-label or data attributes
            const skipType = extractSkipType(el);
            runActionWithToast(`Skip ${skipType}`, actionKey, () => {
              if (el.isConnected && isVisible(el)) {
                el.click();
                skipCooldownMap[selector] = Date.now() + cooldownMs;
              }
            }, undefined, el);
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
    const debounceMs       = settings.advanced?.navDebounceMs || 400;
          navDebounceTimer = setTimeout(updateNavOverlay, debounceMs);
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

    autoSkipToggle   = null;
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
      prevButton = createNavButton("Previous Episode", prevHref, getPrevIcon());
      controlStack.insertBefore(prevButton, controlStack.firstChild);
    }

        // Create and inject next button if href exists, right after prev button
    if (nextHref) {
      nextButton = createNavButton("Next Episode", nextHref, getNextIcon());
      const insertAfter = prevButton ? prevButton.nextSibling : controlStack.firstChild;
      controlStack.insertBefore(nextButton, insertAfter);
    }
  }

  function createNavButton(label, href, iconSvg, onClickCallback) {
    const theme        = settings.theme || {};
    const transitionMs = theme.buttonHoverTransitionMs || "200";
    const hoverBg      = getHoverBgColor();
    const buttonPadX   = theme.buttonPaddingX || "12px";
    
    const btn                      = document.createElement("button");
          btn.type                 = "button";
          btn.ariaLabel            = label;
          btn.style.background     = "none";
          btn.style.border         = "none";
          btn.style.cursor         = "pointer";
          btn.style.padding        = `0 ${buttonPadX}`;
          btn.style.margin         = "0";
          btn.style.display        = "flex";
          btn.style.alignItems     = "center";
          btn.style.justifyContent = "center";
          btn.style.width          = "auto";
          btn.style.height         = "100%";
          btn.style.transition     = `background-color ${transitionMs}ms ease`;
          btn.innerHTML            = iconSvg;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const actionKey = `nav:${href}`;
      if (pendingActionMap[actionKey]) return;
      runActionWithToast(label, actionKey, () => {
        if (onClickCallback) onClickCallback();
        window.location.href = href;
      }, settings.advanced?.navActionDelayMs, btn);
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = hoverBg;
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "";
    });

    attachExtensionIndicator(btn, label);

    return btn;
  }

  function runActionWithToast(actionLabel, actionKey, actionFn, delayOverrideMs, targetElement) {
    const adv = settings.advanced || {};
    const theme = settings.theme || {};
    const toastEnabled = adv.toastEnabled !== false;
    const fallbackDelay = Number(adv.actionDelayMs || 0);
    const delayMs = Number(delayOverrideMs ?? fallbackDelay);
    const onActionPosition = theme.toastPositionPreset === "on-action";

    pendingActionMap[actionKey] = true;

    const runAndClear = () => {
      try {
        actionFn();
      } finally {
        delete pendingActionMap[actionKey];
      }
    };

    if (!toastEnabled || delayMs <= 0) {
      runAndClear();
      return;
    }

    if (onActionPosition && targetElement && targetElement.isConnected) {
      showCountdownOnTarget(targetElement, `${actionLabel} in...`, delayMs, runAndClear);
      return;
    }

    showCountdownToast(`${actionLabel} in...`, delayMs, runAndClear);
  }

  function showCountdownOnTarget(target, label, delayMs, onComplete) {
    if (!target || !target.isConnected) {
      showCountdownToast(label, delayMs, onComplete);
      return;
    }

    const theme = settings.theme || {};
    const original = {
      transition: target.style.transition,
      backgroundImage: target.style.backgroundImage,
      backgroundRepeat: target.style.backgroundRepeat,
      backgroundSize: target.style.backgroundSize,
      backgroundPosition: target.style.backgroundPosition,
      outline: target.style.outline,
      outlineOffset: target.style.outlineOffset,
      boxShadow: target.style.boxShadow,
      position: target.style.position,
      overflow: target.style.overflow
    };

    const computedPosition = window.getComputedStyle(target).position;
    if (!computedPosition || computedPosition === "static") {
      target.style.position = "relative";
    }

    target.style.overflow = "hidden";
    target.style.backgroundRepeat = "no-repeat";
    target.style.backgroundPosition = "left top";
    target.style.backgroundImage = `linear-gradient(90deg, ${theme.primaryColor || "#f47521"}33, ${theme.primaryColor || "#f47521"}33)`;

    const badge = document.createElement("span");
    badge.textContent = label;
    badge.style.position = "absolute";
    badge.style.left = "50%";
    badge.style.top = "-20px";
    badge.style.transform = "translateX(-50%)";
    badge.style.fontSize = "10px";
    badge.style.fontWeight = "700";
    badge.style.padding = "2px 6px";
    badge.style.borderRadius = "999px";
    badge.style.background = theme.primaryColor || "#f47521";
    badge.style.color = theme.onPrimaryColor || "#ffffff";
    badge.style.pointerEvents = "none";
    badge.style.whiteSpace = "nowrap";
    badge.style.zIndex = "2";
    target.appendChild(badge);

    const startedAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / delayMs, 1);
      const remainingSeconds = Math.max(Math.ceil((delayMs - elapsed) / 1000), 0);
      target.style.backgroundSize = `${Math.floor(ratio * 100)}% 100%`;
      const blink = Math.floor(elapsed / 180) % 2 === 0;
      target.style.outline = `4px solid ${blink ? (theme.primaryColor || "#f47521") : "transparent"}`;
      target.style.outlineOffset = "-1px";
      target.style.boxShadow = blink
        ? `inset 0 0 0 1px ${(theme.primaryColor || "#f47521")}66`
        : "inset 0 0 0 1px transparent";
      badge.textContent = `${label} ${remainingSeconds}s`;
    };

    tick();
    const timer = setInterval(tick, 100);

    const cleanup = () => {
      clearInterval(timer);
      if (badge.isConnected) badge.remove();
      target.style.transition = original.transition;
      target.style.backgroundImage = original.backgroundImage;
      target.style.backgroundRepeat = original.backgroundRepeat;
      target.style.backgroundSize = original.backgroundSize;
      target.style.backgroundPosition = original.backgroundPosition;
      target.style.outline = original.outline;
      target.style.outlineOffset = original.outlineOffset;
      target.style.boxShadow = original.boxShadow;
      target.style.overflow = original.overflow;
      target.style.position = original.position;
    };

    setTimeout(() => {
      cleanup();
      onComplete();
    }, delayMs);
  }

  function showCountdownToast(label, delayMs, onComplete) {
    const theme = settings.theme || {};
    const toast = createToastBase();
    const text = document.createElement("div");
    const progressTrack = document.createElement("div");
    const progressBar = document.createElement("div");
    const startedAt = Date.now();

    text.style.marginBottom = "8px";
    text.style.fontWeight = theme.toastFontWeight || "600";

    progressTrack.style.height = "4px";
    progressTrack.style.background = theme.toastProgressTrackColor || "rgba(255,255,255,0.25)";
    progressTrack.style.borderRadius = "999px";
    progressTrack.style.overflow = "hidden";

    progressBar.style.height = "100%";
    progressBar.style.width = "0%";
    progressBar.style.background = theme.toastProgressBarColor || "rgba(255,255,255,0.95)";
    progressBar.style.transition = "width 0.1s linear";

    progressTrack.appendChild(progressBar);
    toast.appendChild(text);
    toast.appendChild(progressTrack);
    toastContainer.appendChild(toast);

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / delayMs, 1);
      const remainingSeconds = Math.max(Math.ceil((delayMs - elapsed) / 1000), 0);
      text.textContent = `${label} ${remainingSeconds}s`;
      progressBar.style.width = `${Math.floor(ratio * 100)}%`;
    };

    tick();
    const timer = setInterval(tick, 100);

    setTimeout(() => {
      clearInterval(timer);
      dismissToast(toast, onComplete);
    }, delayMs);
  }

  function createToastBase() {
    const theme = settings.theme || {};
    ensureToastContainer();

    const toast = document.createElement("div");
    toast.style.backgroundColor = theme.primaryColor || "#f47521";
    toast.style.color = theme.onPrimaryColor || "#ffffff";
    toast.style.padding = theme.toastPadding || "12px 16px";
    toast.style.borderRadius = theme.toastBorderRadius || "4px";
    toast.style.fontSize = theme.toastFontSize || "13px";
    toast.style.fontWeight = theme.toastFontWeight || "600";
    toast.style.boxShadow = theme.toastBoxShadow || "0 4px 12px rgba(0,0,0,0.5)";
    toast.style.display = "block";
    toast.style.whiteSpace = "nowrap";
    toast.style.willChange = "transform, opacity";
    toast.style.animation = `fadeinup-cre ${theme.toastAnimationMs || 300}ms ease forwards`;
    toast.style.pointerEvents = "auto";
    return toast;
  }

  function dismissToast(toast, onDone) {
    const theme = settings.theme || {};
    const hideMs = Number(theme.toastAnimationMs || 300);
    toast.style.animation = `fadeoutdown-cre ${hideMs}ms ease forwards`;
    setTimeout(() => {
      toast.remove();
      if (onDone) onDone();
    }, hideMs);
  }

  function ensureToastContainer() {
    const theme = settings.theme || {};
    const preset = theme.toastPositionPreset || "bottom-left";
    const inset = theme.toastInset || "20px";
    const gap = theme.toastGap || "8px";

    if (!toastContainer) {
      toastContainer                     = document.createElement("div");
      toastContainer.id                  = "cre-toast-container";
      toastContainer.style.position      = "fixed";
      toastContainer.style.zIndex        = "999999";
      toastContainer.style.display       = "flex";
      toastContainer.style.flexDirection = "column";
      toastContainer.style.gap           = gap;
      toastContainer.style.pointerEvents = "none";
      document.body.appendChild(toastContainer);
    }

    toastContainer.style.top = "auto";
    toastContainer.style.right = "auto";
    toastContainer.style.bottom = "auto";
    toastContainer.style.left = "auto";

    if (preset === "top-left") {
      toastContainer.style.top = inset;
      toastContainer.style.left = inset;
    } else if (preset === "top-right") {
      toastContainer.style.top = inset;
      toastContainer.style.right = inset;
    } else if (preset === "bottom-right") {
      toastContainer.style.bottom = inset;
      toastContainer.style.right = inset;
    } else {
      toastContainer.style.bottom = inset;
      toastContainer.style.left = inset;
    }

    toastContainer.style.gap = gap;
  }

  function createFeatureToggle(label, isEnabled, iconFn, onToggle) {
    const theme           = settings.theme || {};
    const transitionMs    = theme.buttonHoverTransitionMs || "200";
    const hoverBg         = getHoverBgColor();
    const disabledOpacity = theme.disabledOpacity || "0.5";
    const buttonPadX      = theme.buttonPaddingX || "12px";
    
    const btn                      = document.createElement("button");
          btn.type                 = "button";
          btn.ariaLabel            = label;
          btn.style.background     = "none";
          btn.style.border         = "none";
          btn.style.cursor         = "pointer";
          btn.style.padding        = `0 ${buttonPadX}`;
          btn.style.margin         = "0";
          btn.style.display        = "flex";
          btn.style.alignItems     = "center";
          btn.style.justifyContent = "center";
          btn.style.width          = "auto";
          btn.style.height         = "100%";
          btn.style.transition     = `background-color ${transitionMs}ms ease, opacity ${transitionMs}ms ease`;
          btn.style.opacity        = isEnabled ? "1" : disabledOpacity;
          btn.innerHTML            = iconFn(isEnabled);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onToggle();
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = hoverBg;
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "";
    });

    attachExtensionIndicator(btn, label);

    return btn;
  }

  function ensureExtensionIndicator() {
    if (extensionIndicator) return;
    extensionIndicator = document.createElement("div");
    extensionIndicator.id = "cre-extension-indicator";
    extensionIndicator.style.position = "fixed";
    extensionIndicator.style.zIndex = "1000000";
    extensionIndicator.style.pointerEvents = "none";
    extensionIndicator.style.padding = "4px 8px";
    extensionIndicator.style.borderRadius = "999px";
    extensionIndicator.style.fontSize = "11px";
    extensionIndicator.style.fontWeight = "600";
    extensionIndicator.style.opacity = "0";
    extensionIndicator.style.transform = "translateY(4px)";
    extensionIndicator.style.transition = "opacity 120ms ease, transform 120ms ease";
    extensionIndicator.textContent = "From extension";
    document.body.appendChild(extensionIndicator);
  }

  function showExtensionIndicator(target, label) {
    ensureExtensionIndicator();
    const theme = settings.theme || {};
    const rect  = target.getBoundingClientRect();
    const top   = Math.max(8, rect.top - 28);
    const left  = Math.max(8, rect.left);

    extensionIndicator.textContent = `From extension: ${label}`;
    extensionIndicator.style.top = `${Math.round(top)}px`;
    extensionIndicator.style.left = `${Math.round(left)}px`;
    extensionIndicator.style.backgroundColor = theme.primaryColor || "#f47521";
    extensionIndicator.style.color = theme.onPrimaryColor || "#ffffff";
    extensionIndicator.style.boxShadow = theme.toastBoxShadow || "0 4px 12px rgba(0,0,0,0.5)";
    extensionIndicator.style.opacity = "1";
    extensionIndicator.style.transform = "translateY(0)";
  }

  function hideExtensionIndicator() {
    if (!extensionIndicator) return;
    extensionIndicator.style.opacity = "0";
    extensionIndicator.style.transform = "translateY(4px)";
  }

  function attachExtensionIndicator(element, label) {
    const theme = settings.theme || {};
    const accent = theme.primaryColor || "#f47521";
    element.dataset.creInjected = "true";

    element.addEventListener("mouseenter", () => {
      element.style.outline = `1px solid ${accent}`;
      element.style.outlineOffset = "-1px";
      element.style.boxShadow = `inset 0 0 0 1px ${accent}55`;
      showExtensionIndicator(element, label);
    });

    element.addEventListener("mouseleave", () => {
      element.style.outline = "none";
      element.style.outlineOffset = "0";
      element.style.boxShadow = "none";
      hideExtensionIndicator();
    });
  }

  function showToast(message) {
    if (settings.advanced && settings.advanced.toastEnabled === false) return;
    const toast = createToastBase();
    toast.textContent = message;

    toastContainer.appendChild(toast);

    const durationMs = settings.advanced?.toastDurationMs || 2500;
    setTimeout(() => {
      dismissToast(toast);
    }, durationMs);
  }

  function getPrevIcon() {
    const iconSize = (settings?.theme && settings.theme.iconSize) ? settings.theme.iconSize : "24px";
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: ${iconSize}; height: ${iconSize}; fill: currentColor;">
      <path d = "M15 18L9 12L15 6" stroke = "currentColor" stroke-width = "2" fill = "none" stroke-linecap = "round" stroke-linejoin = "round"></path>
    </svg>`;
  }

  function getNextIcon() {
    const iconSize = (settings?.theme && settings.theme.iconSize) ? settings.theme.iconSize : "24px";
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: ${iconSize}; height: ${iconSize}; fill: currentColor;">
      <path d = "M9 18L15 12L9 6" stroke = "currentColor" stroke-width = "2" fill = "none" stroke-linecap = "round" stroke-linejoin = "round"></path>
    </svg>`;
  }

  function getAutoSkipIcon(isEnabled) {
    const disabledOpacity = (settings?.theme && settings.theme.disabledOpacity) ? settings.theme.disabledOpacity : "0.5";
    const iconSize = (settings?.theme && settings.theme.iconSize) ? settings.theme.iconSize : "24px";
    const opacity = isEnabled ? "1" : disabledOpacity;
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: ${iconSize}; height: ${iconSize}; fill: currentColor; opacity: ${opacity};">
      <path d = "M9 3H15V9H9V3Z" stroke         = "currentColor" stroke-width = "1.5" fill         = "none"></path>
      <path d = "M15 12L9 18M15 18L9 12" stroke = "currentColor" stroke-width = "2" stroke-linecap = "round"></path>
    </svg>`;
  }

  function getEpisodeNavIcon(isEnabled) {
    const disabledOpacity = (settings?.theme && settings.theme.disabledOpacity) ? settings.theme.disabledOpacity : "0.5";
    const iconSize = (settings?.theme && settings.theme.iconSize) ? settings.theme.iconSize : "24px";
    const opacity = isEnabled ? "1" : disabledOpacity;
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: ${iconSize}; height: ${iconSize}; fill: currentColor; opacity: ${opacity};">
      <path d = "M4 6H20V18H4V6Z" stroke    = "currentColor" stroke-width = "1.5" fill = "none"></path>
      <path d = "M9 10L14 13L9 16V10Z" fill = "currentColor"></path>
    </svg>`;
  }

  loadSettings(() => {
    startAll();
  });
})();
