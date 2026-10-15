import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
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
  const insert = sqlite.prepare("INSERT INTO location_counts VALUES (?, ?, ?, ?, ?, ?)");
  const dated = ago => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);
  insert.run(dated(181), "/HenryKlattMath/", "US", "", "", 3);
  insert.run(dated(5), "/HenryKlattMath/", "US", "", "", 4);
  insert.run(today, "/HenryKlattMath/", "BR", "", "", 2);
  insert.run(dated(-1), "/HenryKlattMath/", "GB", "", "", 9);
  const single = await (await stats(env, "?days=1")).json();
  assert.equal(single.summary.views, 2);
  assert.equal(single.start, today);
  assert.equal((await (await stats(env, "?days=7")).json()).summary.views, 6);
  await worker.scheduled({}, env);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM location_counts WHERE day < ?").get(dated(179)).n, 0);
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
