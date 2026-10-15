(() => {
  const endpoint = "https://henry-klatt-location-analytics.henry-klatt.workers.dev";
  if (!endpoint || location.protocol !== "https:" || location.hostname !== "washingapples.github.io") return;
  const paths = ["", "research/", "teaching/", "resources/", "service/", "cv/"].map(path => "/HenryKlattMath/" + path);
  const path = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/";
  if (!paths.includes(path) || window.henryCityAnalyticsSent) return;
  window.henryCityAnalyticsSent = true;
  // Send only the page path; omit query strings, fragments, and visitor identifiers.
  const body = JSON.stringify({path});
  const url = endpoint.replace(/\/$/, "") + "/collect";
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], {type: "text/plain;charset=UTF-8"}))) return;
  } catch { /* Fall back to a non-blocking request. */ }
  fetch(url, {method: "POST", body, credentials: "omit", keepalive: true, referrerPolicy: "origin"}).catch(() => {});
})();
