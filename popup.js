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

const DEFAULT_BTN_STYLE = {
  backgroundColor: "#f47521",
  color: "#ffffff",
  fontSize: "14px",
  padding: "8px 16px",
  borderRadius: "4px",
  fontWeight: "600",
  position: "bottom-right",
  opacity: "0.9"
};

function $(id) {
  return document.getElementById(id);
}

function loadForm(settings) {
  $("autoSkipEnabled").checked = settings.autoSkip.enabled;
  $("autoSkipSelectors").value = settings.autoSkip.selectors.join("\n");

  $("episodeNavEnabled").checked = settings.episodeNav.enabled;
  $("nextSelector").value = settings.episodeNav.nextSelector;
  $("prevSelector").value = settings.episodeNav.prevSelector;

  const style = settings.episodeNav.buttonStyle;
  $("btnBg").value = style.backgroundColor;
  $("btnColor").value = style.color;
  $("btnFontSize").value = style.fontSize;
  $("btnPadding").value = style.padding;
  $("btnBorderRadius").value = style.borderRadius;
  $("btnFontWeight").value = style.fontWeight;
  $("btnOpacity").value = parseFloat(style.opacity);
  $("btnPosition").value = style.position;
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
      prevSelector: $("prevSelector").value.trim(),
      buttonStyle: {
        backgroundColor: $("btnBg").value,
        color: $("btnColor").value,
        fontSize: $("btnFontSize").value.trim(),
        padding: $("btnPadding").value.trim(),
        borderRadius: $("btnBorderRadius").value.trim(),
        fontWeight: $("btnFontWeight").value.trim(),
        position: $("btnPosition").value,
        opacity: parseFloat($("btnOpacity").value).toFixed(2)
      }
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

  $("resetEpisodeNavStyle").addEventListener("click", () => {
    const s = DEFAULT_BTN_STYLE;
    $("btnBg").value = s.backgroundColor;
    $("btnColor").value = s.color;
    $("btnFontSize").value = s.fontSize;
    $("btnPadding").value = s.padding;
    $("btnBorderRadius").value = s.borderRadius;
    $("btnFontWeight").value = s.fontWeight;
    $("btnOpacity").value = parseFloat(s.opacity);
    $("btnPosition").value = s.position;
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
      prevSelector: DEFAULT_PREV_SELECTOR,
      buttonStyle: { ...DEFAULT_BTN_STYLE }
    }
  };
}
