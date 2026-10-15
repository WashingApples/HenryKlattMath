(() => {
  // Public site token from Cloudflare Web Analytics → Manage site.
  // Set to an empty string to disable analytics.
  const token = "a70423861aa743168e8f650547828161";
  const hostname = "washingapples.github.io";

  // Keep local previews out of the visitor statistics.
  if (location.protocol !== "https:" || location.hostname !== hostname || !/^[a-f0-9]{32}$/i.test(token)) return;
  if (document.querySelector("script[data-cf-beacon]")) return;

  const beacon = document.createElement("script");
  beacon.type = "module";
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token });
  document.body.append(beacon);
})();
