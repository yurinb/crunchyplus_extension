"use strict";

const STORAGE_KEY = "settings";

const DEFAULT_AUTO_SKIP_SELECTORS = [
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
];

const DEFAULT_NEXT_SELECTOR =
  "[data-t='next-episode'] a.title, [data-t='next-episode'] a";
const DEFAULT_PREV_SELECTOR =
  "[data-t='prev-episode'] a.title, [data-t='prev-episode'] a";

const DEFAULT_ADVANCED = {
  skipIntervalMs: 750,
  skipCooldownMs: 3000,
  navDebounceMs: 400,
  toastEnabled: true,
  actionDelayMs: 1500,
  toastPositionX: "20px",
  toastPositionY: "20px",
  toastDurationMs: 2500,
  toastAnimationMs: 300,
  toastBgColor: "#f47521",
  toastTextColor: "#ffffff",
  toastPadding: "12px 16px",
  toastBorderRadius: "4px",
  toastFontSize: "13px",
  toastFontWeight: "600",
  toastBoxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  hoverBgColor: "rgba(244, 117, 33, 0.15)",
  disabledOpacity: "0.5",
  buttonHoverTransitionMs: "200"
};

function $(id) {
  return document.getElementById(id);
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadForm(settings) {
  $("autoSkipEnabled").checked = settings.autoSkip.enabled;
  $("autoSkipSelectors").value = settings.autoSkip.selectors.join("\n");

  $("episodeNavEnabled").checked = settings.episodeNav.enabled;
  $("nextSelector").value = settings.episodeNav.nextSelector;
  $("prevSelector").value = settings.episodeNav.prevSelector;

  // Load advanced settings
  const adv = settings.advanced || {};
  if ($("skipIntervalMs")) $("skipIntervalMs").value = adv.skipIntervalMs || 750;
  if ($("skipCooldownMs")) $("skipCooldownMs").value = adv.skipCooldownMs || 3000;
  if ($("navDebounceMs")) $("navDebounceMs").value = adv.navDebounceMs || 400;
  if ($("toastEnabled")) $("toastEnabled").value = String(adv.toastEnabled !== false);
  if ($("actionDelayMs")) $("actionDelayMs").value = adv.actionDelayMs || 1500;
  if ($("toastPositionX")) $("toastPositionX").value = adv.toastPositionX || "20px";
  if ($("toastPositionY")) $("toastPositionY").value = adv.toastPositionY || "20px";
  if ($("toastDurationMs")) $("toastDurationMs").value = adv.toastDurationMs || 2500;
  if ($("toastAnimationMs")) $("toastAnimationMs").value = adv.toastAnimationMs || 300;
  if ($("toastBgColor")) $("toastBgColor").value = adv.toastBgColor || "#f47521";
  if ($("toastTextColor")) $("toastTextColor").value = adv.toastTextColor || "#ffffff";
  if ($("toastPadding")) $("toastPadding").value = adv.toastPadding || "12px 16px";
  if ($("toastBorderRadius")) $("toastBorderRadius").value = adv.toastBorderRadius || "4px";
  if ($("toastFontSize")) $("toastFontSize").value = adv.toastFontSize || "13px";
  if ($("toastFontWeight")) $("toastFontWeight").value = adv.toastFontWeight || "600";
  if ($("toastBoxShadow")) $("toastBoxShadow").value = adv.toastBoxShadow || "0 4px 12px rgba(0,0,0,0.5)";
  if ($("hoverBgColor")) $("hoverBgColor").value = adv.hoverBgColor || "rgba(244, 117, 33, 0.15)";
  if ($("disabledOpacity")) $("disabledOpacity").value = adv.disabledOpacity || "0.5";
  if ($("buttonHoverTransitionMs")) $("buttonHoverTransitionMs").value = adv.buttonHoverTransitionMs || "200";
}

function readForm() {
  return {
    autoSkip: {
      enabled: $("autoSkipEnabled").checked,
      selectors: $("autoSkipSelectors").value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    },
    episodeNav: {
      enabled: $("episodeNavEnabled").checked,
      nextSelector: $("nextSelector").value.trim(),
      prevSelector: $("prevSelector").value.trim()
    },
    advanced: {
      skipIntervalMs: parseNumber($("skipIntervalMs")?.value, 750),
      skipCooldownMs: parseNumber($("skipCooldownMs")?.value, 3000),
      navDebounceMs: parseNumber($("navDebounceMs")?.value, 400),
      toastEnabled: ($("toastEnabled")?.value || "true") === "true",
      actionDelayMs: parseNumber($("actionDelayMs")?.value, 1500),
      toastPositionX: $("toastPositionX")?.value || "20px",
      toastPositionY: $("toastPositionY")?.value || "20px",
      toastDurationMs: parseNumber($("toastDurationMs")?.value, 2500),
      toastAnimationMs: parseNumber($("toastAnimationMs")?.value, 300),
      toastBgColor: $("toastBgColor")?.value || "#f47521",
      toastTextColor: $("toastTextColor")?.value || "#ffffff",
      toastPadding: $("toastPadding")?.value || "12px 16px",
      toastBorderRadius: $("toastBorderRadius")?.value || "4px",
      toastFontSize: $("toastFontSize")?.value || "13px",
      toastFontWeight: $("toastFontWeight")?.value || "600",
      toastBoxShadow: $("toastBoxShadow")?.value || "0 4px 12px rgba(0,0,0,0.5)",
      hoverBgColor: $("hoverBgColor")?.value || "rgba(244, 117, 33, 0.15)",
      disabledOpacity: $("disabledOpacity")?.value || "0.5",
      buttonHoverTransitionMs: $("buttonHoverTransitionMs")?.value || "200"
    }
  };
}

function showSaved() {
  const el = $("saveStatus");
  el.textContent = "Saved!";
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const settings = data[STORAGE_KEY] || buildDefaults();
    loadForm(settings);
  });

  // Add collapsible click handlers for feature titles
  document.querySelectorAll(".feature-title").forEach((title) => {
    title.style.cursor = "pointer";
    title.addEventListener("click", () => {
      const section = title.closest(".feature-block");
      const config = section.querySelector(".collapsible-section");
      if (config) {
        config.style.display = config.style.display === "none" ? "flex" : "none";
      }
    });
  });

  $("saveBtn").addEventListener("click", () => {
    const settings = readForm();
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
      showSaved();
    });
  });

  $("resetAutoSkipSelectors").addEventListener("click", () => {
    $("autoSkipSelectors").value = DEFAULT_AUTO_SKIP_SELECTORS.join("\n");
  });

  $("resetEpisodeNavSelectors").addEventListener("click", () => {
    $("nextSelector").value = DEFAULT_NEXT_SELECTOR;
    $("prevSelector").value = DEFAULT_PREV_SELECTOR;
  });

  $("resetAdvanced")?.addEventListener("click", () => {
    const a = DEFAULT_ADVANCED;
    if ($("skipIntervalMs")) $("skipIntervalMs").value = a.skipIntervalMs;
    if ($("skipCooldownMs")) $("skipCooldownMs").value = a.skipCooldownMs;
    if ($("navDebounceMs")) $("navDebounceMs").value = a.navDebounceMs;
    if ($("toastEnabled")) $("toastEnabled").value = String(a.toastEnabled);
    if ($("actionDelayMs")) $("actionDelayMs").value = a.actionDelayMs;
    if ($("toastPositionX")) $("toastPositionX").value = a.toastPositionX;
    if ($("toastPositionY")) $("toastPositionY").value = a.toastPositionY;
    if ($("toastDurationMs")) $("toastDurationMs").value = a.toastDurationMs;
    if ($("toastAnimationMs")) $("toastAnimationMs").value = a.toastAnimationMs;
    if ($("toastBgColor")) $("toastBgColor").value = a.toastBgColor;
    if ($("toastTextColor")) $("toastTextColor").value = a.toastTextColor;
    if ($("toastPadding")) $("toastPadding").value = a.toastPadding;
    if ($("toastBorderRadius")) $("toastBorderRadius").value = a.toastBorderRadius;
    if ($("toastFontSize")) $("toastFontSize").value = a.toastFontSize;
    if ($("toastFontWeight")) $("toastFontWeight").value = a.toastFontWeight;
    if ($("toastBoxShadow")) $("toastBoxShadow").value = a.toastBoxShadow;
    if ($("hoverBgColor")) $("hoverBgColor").value = a.hoverBgColor;
    if ($("disabledOpacity")) $("disabledOpacity").value = a.disabledOpacity;
    if ($("buttonHoverTransitionMs")) $("buttonHoverTransitionMs").value = a.buttonHoverTransitionMs;
  });
});

function buildDefaults() {
  return {
    autoSkip: {
      enabled: true,
      selectors: DEFAULT_AUTO_SKIP_SELECTORS
    },
    episodeNav: {
      enabled: true,
      nextSelector: DEFAULT_NEXT_SELECTOR,
      prevSelector: DEFAULT_PREV_SELECTOR
    },
    advanced: { ...DEFAULT_ADVANCED }
  };
}
