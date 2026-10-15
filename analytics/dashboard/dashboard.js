(() => {
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat();
  const names = new Intl.DisplayNames(["en"], {type: "region"});
  const countryName = code => { try { return code ? names.of(code) : "Unknown"; } catch { return code || "Unknown"; } };
  let accessKey = "", locations = [], generation = 0;
  function rows(target, items) {
    const fragment = document.createDocumentFragment();
    for (const values of items) {
      const row = document.createElement("tr");
      values.forEach((value, i) => {
        const cell = document.createElement("td");
        cell.textContent = i === values.length - 1 ? format.format(value) : value;
        if (i === values.length - 1) cell.className = "count";
        row.append(cell);
      });
      fragment.append(row);
    }
    $(target).replaceChildren(fragment);
  }
  function filterLocations() {
    const filter = $("filter").value.trim().toLowerCase();
    const matches = locations.filter(row => [row.city, row.region, countryName(row.country)].some(value => value.toLowerCase().includes(filter)));
    rows("locations", matches.map(row => [row.city || "Unknown", row.region || "Unknown", countryName(row.country), row.views]));
    $("empty").hidden = matches.length !== 0;
  }
  function drawChart(data) {
    const values = new Map(data.daily.map(row => [row.day, row.views]));
    const bars = [], maximum = Math.max(1, ...values.values());
    for (let date = Date.parse(data.start); date <= Date.parse(data.end); date += 86400000) {
      const day = new Date(date).toISOString().slice(0, 10), views = values.get(day) || 0;
      const bar = document.createElement("span"); bar.className = "bar";
      bar.style.height = `${views ? Math.max(3, views / maximum * 100) : 1}%`;
      bar.title = `${day}: ${format.format(views)} page views`; bars.push(bar);
    }
    $("chart").replaceChildren(...bars);
    $("chart").setAttribute("aria-label", `${format.format(data.summary.views)} page views from ${data.start} through ${data.end}, UTC. Daily counts: ${data.daily.map(row => `${row.day}: ${row.views}`).join("; ") || "none"}.`);
  }
  async function load() {
    const current = ++generation;
    $("status").textContent = "Loading statistics…"; $("refresh").disabled = true;
    try {
      const response = await fetch(`/api/stats?days=${$("days").value}`, {headers: {Authorization: `Bearer ${accessKey}`}, cache: "no-store", credentials: "omit"});
      if (current !== generation) return;
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || "Unable to load statistics."); }
      const data = await response.json();
      if (current !== generation) return;
      $("login").hidden = true; $("report").hidden = false; $("preview").hidden = !data.preview;
      $("views").textContent = format.format(data.summary.views);
      $("countries").textContent = format.format(data.summary.countries);
      $("cities").textContent = format.format(data.summary.cities);
      $("dates").textContent = `${data.start} through ${data.end} · UTC`;
      locations = data.locations; filterLocations(); drawChart(data);
      rows("pages", data.pages.map(row => [row.path.replace("/HenryKlattMath/", "/"), row.views]));
      $("status").textContent = data.summary.views ? "" : "No page views yet. Statistics will appear after tracking is published and visitors open the site.";
    } catch (error) { if (current === generation) $("status").textContent = error.message || "Unable to connect to the dashboard."; }
    finally { if (current === generation) $("refresh").disabled = false; }
  }
  $("login-form").addEventListener("submit", event => { event.preventDefault(); accessKey = $("key").value; $("key").value = ""; load(); });
  $("days").addEventListener("change", load);
  $("refresh").addEventListener("click", load);
  $("filter").addEventListener("input", filterLocations);
  $("logout").addEventListener("click", () => {
    generation++; accessKey = ""; locations = [];
    $("report").hidden = true; $("login").hidden = false; $("status").textContent = "Signed out.";
    ["locations", "pages", "chart"].forEach(id => $(id).replaceChildren());
    ["views", "countries", "cities"].forEach(id => $(id).textContent = "0");
    $("refresh").disabled = false; $("key").focus();
  });
})();
