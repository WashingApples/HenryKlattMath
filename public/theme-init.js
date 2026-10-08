// Follow the browser by default; remember manual changes only for this visit.
try {
  const theme = sessionStorage.getItem("henry-klatt-theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {
  // Storage may be unavailable; the browser preference remains the default.
}
