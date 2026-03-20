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
  navActionDelayMs: 1500,
  toastDurationMs: 2500
};

const DEFAULT_THEME = {
  primaryColor: "#f47521",
  onPrimaryColor: "#ffffff",
  hoverBgColorHex: "#f47521",
  hoverBgOpacity: 0.15,
  hoverBgColor: "rgba(244, 117, 33, 0.15)",
  disabledOpacity: "0.5",
  buttonPaddingX: "12px",
  buttonHoverTransitionMs: "200",
  iconSize: "24px",
  toastPositionPreset: "bottom-left",
  toastInset: "20px",
  toastAnimationMs: 300,
  toastPadding: "12px 16px",
  toastBorderRadius: "4px",
  toastFontSize: "13px",
  toastFontWeight: "600",
  toastBoxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  toastProgressTrackColor: "rgba(255,255,255,0.25)",
  toastProgressBarColor: "rgba(255,255,255,0.95)",
  toastGap: "8px"
};

function $(id) {
  return document.getElementById(id);
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hexToRgb(hex) {
  const value = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function toRgbaString(hex, opacity) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(244, 117, 33, 0.15)";
  const alpha = Math.min(Math.max(Number(opacity), 0), 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function darkenHex(hex, amount = 0.12) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#d9621a";
  const factor = 1 - Math.min(Math.max(amount, 0), 1);
  const r = Math.max(0, Math.min(255, Math.round(rgb.r * factor)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g * factor)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b * factor)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function applyThemeToPopup(theme) {
  const root = document.documentElement;
  const primary = theme.primaryColor || "#f47521";
  const onPrimary = theme.onPrimaryColor || "#ffffff";
  const hoverBg = toRgbaString(theme.hoverBgColorHex || "#f47521", theme.hoverBgOpacity ?? 0.15);

  root.style.setProperty("--orange", primary);
  root.style.setProperty("--orange-dark", darkenHex(primary, 0.12));
  root.style.setProperty("--toggle-on", primary);
  root.style.setProperty("--theme-hover-bg", hoverBg);
  root.style.setProperty("--theme-on-primary", onPrimary);
}

function syncToastPositionControls() {
  const preset = $("toastPositionPreset")?.value;
  const inset = $("toastInset");
  if (!inset) return;
  const disabled = preset === "on-action";
  inset.disabled = disabled;
  inset.style.opacity = disabled ? "0.5" : "1";
}

function parseRgbaToHexOpacity(value) {
  const str = String(value || "").trim();
  const rgbaMatch = str.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbaMatch) {
    return { hex: "#f47521", opacity: 0.15 };
  }

  const parts = rgbaMatch[1].split(",").map((p) => p.trim());
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts[3] !== undefined ? Number(parts[3]) : 1;

  if ([r, g, b].some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return { hex: "#f47521", opacity: 0.15 };
  }

  const hex = `#${[r, g, b]
    .map((n) => Math.round(n).toString(16).padStart(2, "0"))
    .join("")}`;

  return {
    hex,
    opacity: Number.isFinite(a) ? Math.min(Math.max(a, 0), 1) : 1
  };
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
  if ($("navActionDelayMs")) $("navActionDelayMs").value = adv.navActionDelayMs || 1500;
  if ($("toastDurationMs")) $("toastDurationMs").value = adv.toastDurationMs || 2500;

  const theme = settings.theme || {};
  if ($("primaryColor")) $("primaryColor").value = theme.primaryColor || "#f47521";
  if ($("onPrimaryColor")) $("onPrimaryColor").value = theme.onPrimaryColor || "#ffffff";
  const hoverParsed = parseRgbaToHexOpacity(theme.hoverBgColor || "rgba(244, 117, 33, 0.15)");
  if ($("hoverBgColorHex")) $("hoverBgColorHex").value = theme.hoverBgColorHex || hoverParsed.hex;
  if ($("hoverBgOpacity")) $("hoverBgOpacity").value = String(theme.hoverBgOpacity ?? hoverParsed.opacity);
  if ($("disabledOpacity")) $("disabledOpacity").value = theme.disabledOpacity || "0.5";
  if ($("buttonPaddingX")) $("buttonPaddingX").value = theme.buttonPaddingX || "12px";
  if ($("buttonHoverTransitionMs")) $("buttonHoverTransitionMs").value = theme.buttonHoverTransitionMs || "200";
  if ($("iconSize")) $("iconSize").value = theme.iconSize || "24px";
  if ($("toastPositionPreset")) $("toastPositionPreset").value = theme.toastPositionPreset || "bottom-left";
  if ($("toastInset")) $("toastInset").value = theme.toastInset || "20px";
  if ($("toastAnimationMs")) $("toastAnimationMs").value = theme.toastAnimationMs || 300;
  if ($("toastPadding")) $("toastPadding").value = theme.toastPadding || "12px 16px";
  if ($("toastBorderRadius")) $("toastBorderRadius").value = theme.toastBorderRadius || "4px";
  if ($("toastFontSize")) $("toastFontSize").value = theme.toastFontSize || "13px";
  if ($("toastFontWeight")) $("toastFontWeight").value = theme.toastFontWeight || "600";
  if ($("toastBoxShadow")) $("toastBoxShadow").value = theme.toastBoxShadow || "0 4px 12px rgba(0,0,0,0.5)";
  if ($("toastProgressTrackColor")) $("toastProgressTrackColor").value = theme.toastProgressTrackColor || "rgba(255,255,255,0.25)";
  if ($("toastProgressBarColor")) $("toastProgressBarColor").value = theme.toastProgressBarColor || "rgba(255,255,255,0.95)";
  if ($("toastGap")) $("toastGap").value = theme.toastGap || "8px";

  applyThemeToPopup(theme);
  syncToastPositionControls();
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
      navActionDelayMs: parseNumber($("navActionDelayMs")?.value, 1500),
      toastDurationMs: parseNumber($("toastDurationMs")?.value, 2500)
    },
    theme: {
      primaryColor: $("primaryColor")?.value || "#f47521",
      onPrimaryColor: $("onPrimaryColor")?.value || "#ffffff",
      hoverBgColorHex: $("hoverBgColorHex")?.value || "#f47521",
      hoverBgOpacity: parseNumber($("hoverBgOpacity")?.value, 0.15),
      hoverBgColor: toRgbaString(
        $("hoverBgColorHex")?.value || "#f47521",
        parseNumber($("hoverBgOpacity")?.value, 0.15)
      ),
      disabledOpacity: $("disabledOpacity")?.value || "0.5",
      buttonPaddingX: $("buttonPaddingX")?.value || "12px",
      buttonHoverTransitionMs: $("buttonHoverTransitionMs")?.value || "200",
      iconSize: $("iconSize")?.value || "24px",
      toastPositionPreset: $("toastPositionPreset")?.value || "bottom-left",
      toastInset: $("toastInset")?.value || "20px",
      toastAnimationMs: parseNumber($("toastAnimationMs")?.value, 300),
      toastPadding: $("toastPadding")?.value || "12px 16px",
      toastBorderRadius: $("toastBorderRadius")?.value || "4px",
      toastFontSize: $("toastFontSize")?.value || "13px",
      toastFontWeight: $("toastFontWeight")?.value || "600",
      toastBoxShadow: $("toastBoxShadow")?.value || "0 4px 12px rgba(0,0,0,0.5)",
      toastProgressTrackColor: $("toastProgressTrackColor")?.value || "rgba(255,255,255,0.25)",
      toastProgressBarColor: $("toastProgressBarColor")?.value || "rgba(255,255,255,0.95)",
      toastGap: $("toastGap")?.value || "8px"
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

  const themeInputs = [
    "primaryColor",
    "onPrimaryColor",
    "hoverBgColorHex",
    "hoverBgOpacity"
  ];
  themeInputs.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      applyThemeToPopup({
        primaryColor: $("primaryColor")?.value || "#f47521",
        onPrimaryColor: $("onPrimaryColor")?.value || "#ffffff",
        hoverBgColorHex: $("hoverBgColorHex")?.value || "#f47521",
        hoverBgOpacity: parseNumber($("hoverBgOpacity")?.value, 0.15)
      });
    });
  });

  $("toastPositionPreset")?.addEventListener("change", syncToastPositionControls);

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
    if ($("navActionDelayMs")) $("navActionDelayMs").value = a.navActionDelayMs;
    if ($("toastDurationMs")) $("toastDurationMs").value = a.toastDurationMs;
  });

  $("resetTheme")?.addEventListener("click", () => {
    const t = DEFAULT_THEME;
    if ($("primaryColor")) $("primaryColor").value = t.primaryColor;
    if ($("onPrimaryColor")) $("onPrimaryColor").value = t.onPrimaryColor;
    if ($("hoverBgColorHex")) $("hoverBgColorHex").value = t.hoverBgColorHex;
    if ($("hoverBgOpacity")) $("hoverBgOpacity").value = String(t.hoverBgOpacity);
    if ($("disabledOpacity")) $("disabledOpacity").value = t.disabledOpacity;
    if ($("buttonPaddingX")) $("buttonPaddingX").value = t.buttonPaddingX;
    if ($("buttonHoverTransitionMs")) $("buttonHoverTransitionMs").value = t.buttonHoverTransitionMs;
    if ($("iconSize")) $("iconSize").value = t.iconSize;
    if ($("toastPositionPreset")) $("toastPositionPreset").value = t.toastPositionPreset;
    if ($("toastInset")) $("toastInset").value = t.toastInset;
    if ($("toastAnimationMs")) $("toastAnimationMs").value = t.toastAnimationMs;
    if ($("toastPadding")) $("toastPadding").value = t.toastPadding;
    if ($("toastBorderRadius")) $("toastBorderRadius").value = t.toastBorderRadius;
    if ($("toastFontSize")) $("toastFontSize").value = t.toastFontSize;
    if ($("toastFontWeight")) $("toastFontWeight").value = t.toastFontWeight;
    if ($("toastBoxShadow")) $("toastBoxShadow").value = t.toastBoxShadow;
    if ($("toastProgressTrackColor")) $("toastProgressTrackColor").value = t.toastProgressTrackColor;
    if ($("toastProgressBarColor")) $("toastProgressBarColor").value = t.toastProgressBarColor;
    if ($("toastGap")) $("toastGap").value = t.toastGap;

    applyThemeToPopup(t);
    syncToastPositionControls();
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
    advanced: { ...DEFAULT_ADVANCED },
    theme: { ...DEFAULT_THEME }
  };
}
