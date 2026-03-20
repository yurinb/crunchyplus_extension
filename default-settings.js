const DEFAULT_SETTINGS = {
  autoSkip: {
    enabled: true,
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
    enabled: true,
    nextSelector: "[data-t='next-episode'] a.title, [data-t='next-episode'] a",
    prevSelector: "[data-t='prev-episode'] a.title, [data-t='prev-episode'] a",
    buttonStyle: {
      backgroundColor: "#f47521",
      color: "#ffffff",
      fontSize: "14px",
      padding: "8px 16px",
      borderRadius: "4px",
      fontWeight: "600",
      position: "bottom-right",
      opacity: "0.9"
    }
  }
};
