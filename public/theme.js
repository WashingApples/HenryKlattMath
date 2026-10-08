(() => {
  const root = document.documentElement;
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;

  const preference = window.matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "henry-klatt-theme";
  const explicitTheme = () => root.dataset.theme === "dark" || root.dataset.theme === "light" ? root.dataset.theme : null;
  const currentTheme = () => explicitTheme() || (preference.matches ? "dark" : "light");

  function update() {
    const theme = currentTheme();
    toggle.hidden = false;
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.content = theme === "dark" ? "#15191f" : "#ffffff";
    });
    const colorScheme = document.querySelector('meta[name="color-scheme"]');
    if (colorScheme) colorScheme.content = explicitTheme() || "light dark";

  }

  function choose(theme) {
    const browserTheme = preference.matches ? "dark" : "light";
    if (theme === browserTheme) theme = null;
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
    try {
      if (theme) sessionStorage.setItem(storageKey, theme);
      else sessionStorage.removeItem(storageKey);
    } catch {
      // The choice still applies to this page when storage is unavailable.
    }
    update();
  }

  toggle.addEventListener("click", () => choose(currentTheme() === "dark" ? "light" : "dark"));
  preference.addEventListener("change", update);
  update();
})();
