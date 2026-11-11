import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {mkdtempSync, rmSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import vm from "node:vm";
import {JSDOM} from "jsdom";
import worker from "../analytics/worker.mjs";
import {openLocalDB} from "../analytics/local-db.mjs";

const ORIGIN = "https://washingapples.github.io";
const KEY = "test-only-dashboard-key-at-least-32-characters";
const url = "https://tracker.example.test";
const today = new Date().toISOString().slice(0, 10);
function fixture(t) {
  const {DB, sqlite} = openLocalDB(); t.after(() => sqlite.close());
  return {sqlite, env: {DB, ADMIN_TOKEN: KEY}};
}
function pageView(body = {path: "/HenryKlattMath/"}, {origin = ORIGIN, cf, agent = "Mozilla/5.0"} = {}) {
  const request = new Request(url + "/collect", {method: "POST", headers: {Origin: origin, "User-Agent": agent}, body: typeof body === "string" ? body : JSON.stringify(body)});
  Object.defineProperty(request, "cf", {value: cf ?? {country: "US", region: "Iowa", city: "Des Moines", latitude: "41", longitude: "-93", postalCode: "50301"}});
  return request;
}
const stats = (env, query = "", token = KEY) => worker.fetch(new Request(url + "/api/stats" + query, {headers: {Authorization: `Bearer ${token}`}}), env);
const history = (env, values = {}, token = KEY) => worker.fetch(new Request(url + "/api/history?" + new URLSearchParams(values), {headers: {Authorization: `Bearer ${token}`}}), env);

test("history migration preserves existing daily counts and is safe to reopen", t => {
  const directory = mkdtempSync(join(tmpdir(), "henry-analytics-migration-"));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const filename = join(directory, "history.sqlite");
  const old = new DatabaseSync(filename);
  old.exec(readFileSync(new URL("../analytics/migrations/0001_location_counts.sql", import.meta.url), "utf8"));
  old.exec("PRAGMA user_version = 1");
  old.prepare("INSERT INTO location_counts VALUES (?, ?, ?, ?, ?, ?)").run(today, "/HenryKlattMath/", "CH", "Zürich", "Zürich", 7);
  old.close();
  for (let opened = 0; opened < 2; opened++) {
    const {sqlite} = openLocalDB(filename);
    assert.equal(sqlite.prepare("SELECT views FROM location_counts").get().views, 7);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM visit_events").get().n, 0);
    assert.equal(sqlite.prepare("PRAGMA user_version").get().user_version, 2);
    sqlite.close();
  }
});

test("real SQLite counts repeat page views and trusts only server-provided coarse location", async t => {
  const {env, sqlite} = fixture(t);
  const payload = {path: "/HenryKlattMath/", country: "XX", city: "Spoofed", ip: "192.0.2.1"};
  assert.equal((await worker.fetch(pageView(payload), env)).status, 204);
  assert.equal((await worker.fetch(pageView(payload), env)).status, 204);
  assert.equal((await worker.fetch(pageView({path: "/HenryKlattMath/cv/"}, {cf: {}}), env)).status, 204);
  const data = await (await stats(env)).json();
  assert.deepEqual(data.summary, {views: 3, countries: 1, cities: 1});
  assert.deepEqual(data.locations[0], {country: "US", region: "Iowa", city: "Des Moines", views: 2});
  assert.equal(data.locations[1].city, "");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM location_counts").get().n, 2);
  assert.deepEqual(sqlite.prepare("PRAGMA table_info(location_counts)").all().map(c => c.name), ["day", "path", "country", "region", "city", "views"]);
  assert.ok(!JSON.stringify(data).includes("192.0.2.1"));
  const events = sqlite.prepare("SELECT * FROM visit_events ORDER BY id").all();
  assert.equal(events.length, 3);
  assert.equal(events[0].city, "Des Moines");
  assert.equal(events[0].occurred_at.slice(0, 10), today);
  assert.deepEqual(Object.keys(events[0]), ["id", "occurred_at", "path", "country", "region", "city"]);
});

test("collection rejects unrelated origins, arbitrary paths, query strings, oversized and malformed bodies", async t => {
  const {env, sqlite} = fixture(t);
  const cases = [
    [pageView(undefined, {origin: "https://elsewhere.example"}), 403],
    [pageView({path: "/HenryKlattMath/?private=example"}), 400],
    [pageView({path: "/another-site/"}), 400],
    [pageView("{"), 400],
    [pageView(" ".repeat(600) + "{}"), 400],
    [pageView(null), 400],
  ];
  for (const [request, expected] of cases) assert.equal((await worker.fetch(request, env)).status, expected);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM location_counts").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM visit_events").get().n, 0);
  const preflight = await worker.fetch(new Request(url + "/collect", {method: "OPTIONS", headers: {Origin: ORIGIN}}), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal((await worker.fetch(new Request(url + "/collect", {headers: {Origin: ORIGIN}}), env)).status, 405);
});

test("statistics fail closed and never expose authentication or database details", async t => {
  const {env} = fixture(t);
  for (const token of ["", "wrong", "x".repeat(600)]) assert.equal((await stats(env, "", token)).status, 401);
  assert.equal((await stats({...env, ADMIN_TOKEN: undefined})).status, 401);
  assert.equal((await stats({...env, ADMIN_TOKEN: "short"}, "", "short")).status, 401);
  const response = await stats(env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await stats(env, "?days=999999")).status, 400);
  const failed = await worker.fetch(pageView(), {DB: {prepare() { throw new Error("private database internals"); }}});
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("private database internals"));
});

test("retention deletes old aggregates; ranges exclude past and future data; bots are skipped", async t => {
  const {env, sqlite} = fixture(t);
  await worker.fetch(pageView(undefined, {agent: "SomeCrawler/1.0"}), env);
  await worker.fetch(pageView(undefined, {cf: {botManagement: {verifiedBot: true}}}), env);
  assert.equal((await (await stats(env)).json()).summary.views, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM visit_events").get().n, 0);
  const insert = sqlite.prepare("INSERT INTO location_counts VALUES (?, ?, ?, ?, ?, ?)");
  const dated = ago => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);
  insert.run(dated(181), "/HenryKlattMath/", "US", "", "", 3);
  insert.run(dated(5), "/HenryKlattMath/", "US", "", "", 4);
  insert.run(today, "/HenryKlattMath/", "BR", "", "", 2);
  insert.run(dated(-1), "/HenryKlattMath/", "GB", "", "", 9);
  const event = sqlite.prepare("INSERT INTO visit_events (occurred_at, path, country, region, city) VALUES (?, ?, ?, ?, ?)");
  event.run(`${dated(181)}T12:00:00.000Z`, "/HenryKlattMath/", "US", "", "Old event");
  event.run(`${dated(179)}T00:00:00.000Z`, "/HenryKlattMath/", "US", "", "Retained event");
  const single = await (await stats(env, "?days=1")).json();
  assert.equal(single.summary.views, 2);
  assert.equal(single.start, today);
  assert.equal((await (await stats(env, "?days=7")).json()).summary.views, 6);
  await worker.scheduled({}, env);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM location_counts WHERE day < ?").get(dated(179)).n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM visit_events").get().n, 1);
  assert.equal(sqlite.prepare("SELECT city FROM visit_events").get().city, "Retained event");
});

test("daily location history preserves older dates without inventing individual times", async t => {
  const {env, sqlite} = fixture(t);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const insert = sqlite.prepare("INSERT INTO location_counts VALUES (?, ?, ?, ?, ?, ?)");
  insert.run(yesterday, "/HenryKlattMath/", "CH", "Zürich", "Zürich", 2);
  insert.run(yesterday, "/HenryKlattMath/research/", "CH", "Zürich", "Zürich", 1);
  insert.run(today, "/HenryKlattMath/", "US", "Iowa", "Des Moines", 5);
  const daily = await (await history(env, {search: "Zürich"})).json();
  assert.deepEqual(daily.rows, [{day: yesterday, country: "CH", region: "Zürich", city: "Zürich", views: 3}]);
  assert.equal(daily.next_cursor, null);
  assert.deepEqual((await (await history(env, {mode: "visits"})).json()).rows, []);
  assert.deepEqual((await (await history(env, {days: "1", search: "Zürich"})).json()).rows, []);
});

test("private history validates selections and searches literal city names", async t => {
  const {env} = fixture(t);
  assert.equal((await history(env, {}, "wrong")).status, 401);
  for (const values of [{mode: "unknown"}, {days: "300"}, {search: "a".repeat(81)}, {cursor: "{"}, {cursor: "null"}, {mode: "visits", cursor: '["bad",1]'}]) assert.equal((await history(env, values)).status, 400);
  await worker.fetch(pageView(undefined, {cf: {country: "US", region: "Iowa", city: "O'Brien%_"}}), env);
  await worker.fetch(pageView(), env);
  for (const mode of ["daily", "visits"]) {
    const response = await history(env, {mode, search: "%_"});
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const data = await response.json();
    assert.equal(data.rows.length, 1);
    assert.equal(data.rows[0].city, "O'Brien%_");
    assert.equal((await (await history(env, {mode, search: "' OR 1=1--"})).json()).rows.length, 0);
  }
});

test("both history modes paginate all matching rows, including equal timestamps and Unicode city names", async t => {
  const {env, sqlite} = fixture(t);
  const count = sqlite.prepare("INSERT INTO location_counts VALUES (?, ?, ?, ?, ?, ?)");
  const event = sqlite.prepare("INSERT INTO visit_events (occurred_at, path, country, region, city) VALUES (?, ?, ?, ?, ?)");
  for (let i = 0; i < 113; i++) {
    const city = `Zürich ${String(i).padStart(3, "0")}`;
    count.run(today, "/HenryKlattMath/", "CH", "Zürich", city, 1);
    event.run(`${today}T10:00:00.000Z`, "/HenryKlattMath/", "CH", "Zürich", city);
  }
  for (const mode of ["daily", "visits"]) {
    const seen = []; let cursor = null, requests = 0;
    do {
      const data = await (await history(env, {mode, search: "Zürich", ...(cursor ? {cursor} : {})})).json();
      assert.ok(data.rows.length <= 50);
      seen.push(...data.rows.map(row => row.city)); cursor = data.next_cursor;
      assert.ok(++requests <= 3);
    } while (cursor);
    assert.equal(seen.length, 113);
    assert.equal(new Set(seen).size, 113);
  }
});

test("a failed event insert rolls back the daily counter too", async t => {
  const {env, sqlite} = fixture(t);
  sqlite.exec("CREATE TRIGGER reject_event BEFORE INSERT ON visit_events BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  assert.equal((await worker.fetch(pageView(), env)).status, 503);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM location_counts").get().n, 0);
});

test("browser beacon sends only approved paths, excludes local previews, and tolerates network failure", async () => {
  const source = await readFile(new URL("../public/city-analytics.js", import.meta.url), "utf8");
  const configured = source.replace(/const endpoint = "[^"]*";/, 'const endpoint = "https://tracker.example.test";');
  const disabled = source.replace(/const endpoint = "[^"]*";/, 'const endpoint = "";');
  const requests = [];
  const location = {protocol: "https:", hostname: "washingapples.github.io", pathname: "/HenryKlattMath/cv/", search: "?private=value", hash: "#private"};
  const window = {};
  const context = {location, window, Blob, navigator: {sendBeacon: (url, body) => { requests.push({url, body}); return true; }}, fetch: () => { throw new Error("Unexpected fetch"); }};
  vm.runInNewContext(disabled, context); assert.equal(requests.length, 0);
  vm.runInNewContext(configured, {...context, location: {...location, hostname: "localhost"}}); assert.equal(requests.length, 0);
  vm.runInNewContext(configured, context); vm.runInNewContext(configured, context);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://tracker.example.test/collect");
  assert.deepEqual(JSON.parse(await requests[0].body.text()), {path: "/HenryKlattMath/cv/"});
  let fallback;
  vm.runInNewContext(configured, {...context, window: {}, navigator: {}, fetch: (url, options) => {fallback = {url, options}; return Promise.reject(new Error("offline"));}});
  assert.equal(fallback.options.credentials, "omit");
  await new Promise(resolve => setImmediate(resolve));
});

test("dashboard signs in, filters escaped locations, and clears private data on sign-out", async t => {
  const html = await readFile(new URL("../analytics/dashboard/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../analytics/dashboard/dashboard.js", import.meta.url), "utf8");
  const dom = new JSDOM(html, {url, runScripts: "outside-only"}); t.after(() => dom.window.close());
  const {window} = dom, document = window.document;
  let header;
  window.fetch = async (_url, options) => {
    header = options.headers.Authorization;
    if (_url.startsWith("/api/history")) return {ok: true, json: async () => ({rows: [], next_cursor: null})};
    return {ok: true, json: async () => ({start: today, end: today, preview: true, summary: {views: 5, countries: 1, cities: 1}, locations: [{country: "US", region: "Iowa", city: "<img src=x onerror=alert(1)>", views: 5}], pages: [{path: "/HenryKlattMath/", views: 5}], daily: [{day: today, views: 5}]})};
  };
  window.eval(script);
  document.getElementById("key").value = KEY;
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", {bubbles: true, cancelable: true}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(header, `Bearer ${KEY}`);
  assert.equal(document.getElementById("report").hidden, false);
  assert.equal(document.getElementById("preview").hidden, false);
  assert.equal(document.getElementById("locations").querySelector("img"), null);
  assert.ok(document.getElementById("locations").textContent.includes("<img"));
  const filter = document.getElementById("filter"); filter.value = "Brazil";
  filter.dispatchEvent(new window.Event("input"));
  assert.equal(document.getElementById("empty").hidden, false);
  document.getElementById("logout").click();
  assert.equal(document.getElementById("report").hidden, true);
  assert.equal(document.getElementById("locations").children.length, 0);
  assert.equal(document.getElementById("key").value, "");
});

test("dashboard searches and paginates dated history, switches to individual times and ignores replies after sign-out", async t => {
  const html = await readFile(new URL("../analytics/dashboard/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../analytics/dashboard/dashboard.js", import.meta.url), "utf8");
  const dom = new JSDOM(html, {url, runScripts: "outside-only"}); t.after(() => dom.window.close());
  const {window} = dom, document = window.document;
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const dayRow = {day: today, country: "CH", region: "Zürich", city: "Zürich", views: 2};
  let defer = false, reply, lastQuery;
  window.fetch = async (relative, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    if (relative.startsWith("/api/stats")) return {ok: true, json: async () => ({start: today, end: today, summary: {views: 2, countries: 1, cities: 1}, locations: [dayRow], pages: [], daily: [{day: today, views: 2}]})};
    lastQuery = new URL(relative, url).searchParams;
    if (defer) return new Promise(resolve => {reply = resolve;});
    const row = lastQuery.get("search") ? {...dayRow, city: "<img src=x onerror=alert(1)>"}
      : lastQuery.get("mode") === "visits" ? {...dayRow, occurred_at: `${today}T10:32:04.000Z`, views: 1} : dayRow;
    return {ok: true, json: async () => ({rows: [row], next_cursor: lastQuery.has("cursor") ? null : '["cursor"]'})};
  };
  window.eval(script);
  document.getElementById("key").value = KEY;
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", {bubbles: true, cancelable: true}));
  await tick();
  assert.ok(document.getElementById("history").textContent.includes(today));
  assert.equal(document.getElementById("history-more").hidden, false);
  document.getElementById("history-search").value = "Unsubmitted search";
  document.getElementById("history-more").click(); await tick();
  assert.equal(lastQuery.get("search"), "");
  document.getElementById("history-search").value = "";
  assert.equal(document.getElementById("history").children.length, 2);
  assert.equal(document.getElementById("history-more").hidden, true);
  document.getElementById("history-mode").value = "visits";
  document.getElementById("history-mode").dispatchEvent(new window.Event("change")); await tick();
  assert.ok(document.getElementById("history").textContent.includes("10:32:04"));
  assert.ok(document.getElementById("history-date-heading").textContent.includes("UTC"));
  document.getElementById("history-search").value = "Zürich";
  document.getElementById("history-form").dispatchEvent(new window.Event("submit", {bubbles: true, cancelable: true})); await tick();
  assert.equal(lastQuery.get("search"), "Zürich");
  assert.equal(document.getElementById("history").querySelector("img"), null);
  assert.ok(document.getElementById("history").textContent.includes("<img"));
  defer = true;
  document.getElementById("history-form").dispatchEvent(new window.Event("submit", {bubbles: true, cancelable: true})); await tick();
  document.getElementById("logout").click();
  reply({ok: true, json: async () => ({rows: [dayRow], next_cursor: null})}); await tick();
  assert.equal(document.getElementById("history").children.length, 0);
  assert.equal(document.getElementById("report").hidden, true);
  assert.equal(document.getElementById("history-search").value, "");
});
