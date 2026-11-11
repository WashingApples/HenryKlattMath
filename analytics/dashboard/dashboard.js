(() => {
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat();
  const names = new Intl.DisplayNames(["en"], {type: "region"});
  const countryName = code => { try { return code ? names.of(code) : "Unknown"; } catch { return code || "Unknown"; } };
  let accessKey = "", locations = [], generation = 0;
  let historyCursor = null, historyCount = 0, historyGeneration = 0, historySelection = null;
  const timeFormat = new Intl.DateTimeFormat("en-US", {timeZone: "UTC", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"});
  function rows(target, items, append = false) {
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
    if (append) $(target).append(fragment); else $(target).replaceChildren(fragment);
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
  async function loadHistory(more = false) {
    const current = ++historyGeneration, dashboardGeneration = generation;
    if (!more) {
      historyCursor = null; historyCount = 0; $("history").replaceChildren();
      historySelection = {days: $("days").value, mode: $("history-mode").value, search: $("history-search").value.trim()};
    }
    $("history-status").textContent = "Loading visit history…";
    $("history-search-button").disabled = true; $("history-more").disabled = true;
    $("history-more").hidden = true;
    const mode = historySelection.mode;
    $("history-date-heading").textContent = mode === "visits" ? "Date / time (UTC)" : "Date (UTC)";
    const params = new URLSearchParams(historySelection);
    if (more && historyCursor) params.set("cursor", historyCursor);
    try {
      const response = await fetch(`/api/history?${params}`, {headers: {Authorization: `Bearer ${accessKey}`}, cache: "no-store", credentials: "omit"});
      if (current !== historyGeneration || dashboardGeneration !== generation) return;
      const data = await response.json();
      if (current !== historyGeneration || dashboardGeneration !== generation) return;
      if (!response.ok) throw new Error(data.error || "Unable to load visit history.");
      rows("history", data.rows.map(row => [row.occurred_at ? timeFormat.format(new Date(row.occurred_at)) : row.day, row.city || "Unknown", row.region || "Unknown", countryName(row.country), row.views]), more);
      historyCount += data.rows.length; historyCursor = data.next_cursor;
      $("history-more").hidden = !historyCursor;
      $("history-status").textContent = historyCount
        ? `${format.format(historyCount)} rows shown.${historyCursor ? " Load more for earlier activity." : " All matching activity is shown."}`
        : mode === "visits" ? "No individual page views match this selection. Earlier activity is available in Daily location history; individual times are recorded from the history update onward." : "No recorded dates match this selection.";
    } catch (error) {
      if (current === historyGeneration && dashboardGeneration === generation) {
        $("history-status").textContent = error.message || "Unable to connect to visit history.";
        $("history-more").hidden = !historyCursor;
      }
    } finally {
      if (current === historyGeneration && dashboardGeneration === generation) {
        $("history-search-button").disabled = false; $("history-more").disabled = false;
      }
    }
  }
  async function load() {
    const current = ++generation;
    historyGeneration++; historyCursor = null; historyCount = 0;
    $("history").replaceChildren(); $("history-more").hidden = true; $("history-status").textContent = "";
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
      loadHistory();
    } catch (error) { if (current === generation) $("status").textContent = error.message || "Unable to connect to the dashboard."; }
    finally { if (current === generation) $("refresh").disabled = false; }
  }
  $("login-form").addEventListener("submit", event => { event.preventDefault(); accessKey = $("key").value; $("key").value = ""; load(); });
  $("days").addEventListener("change", load);
  $("refresh").addEventListener("click", load);
  $("filter").addEventListener("input", filterLocations);
  $("history-form").addEventListener("submit", event => { event.preventDefault(); loadHistory(); });
  $("history-mode").addEventListener("change", () => loadHistory());
  $("history-more").addEventListener("click", () => loadHistory(true));
  $("logout").addEventListener("click", () => {
    generation++; historyGeneration++; accessKey = ""; locations = []; historyCursor = null; historyCount = 0; historySelection = null;
    $("report").hidden = true; $("login").hidden = false; $("status").textContent = "Signed out.";
    ["locations", "pages", "chart", "history"].forEach(id => $(id).replaceChildren());
    $("history-search").value = ""; $("history-status").textContent = ""; $("history-more").hidden = true;
    $("history-search-button").disabled = false;
    ["views", "countries", "cities"].forEach(id => $(id).textContent = "0");
    $("refresh").disabled = false; $("key").focus();
  });
})();
