const SITE_ORIGIN = "https://washingapples.github.io";
const SITE_ROOT = "/HenryKlattMath/";
const PATHS = new Set(["", "research/", "teaching/", "resources/", "service/", "cv/"].map(path => SITE_ROOT + path));
const DAY = 86_400_000;
const SECURITY = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};
const clean = value => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) : "";
const json = (body, status = 200, headers = {}) => Response.json(body, {status, headers: {...SECURITY, ...headers}});

async function authorized(request, env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) return false;
  const token = request.headers.get("Authorization") || "";
  if (token.length > 512) return false;
  const digest = async text => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([digest(token), digest(`Bearer ${env.ADMIN_TOKEN}`)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function smallBody(request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

async function collect(request, env) {
  if (request.headers.get("Origin") !== SITE_ORIGIN) return json({error: "Origin not allowed"}, 403);
  const cors = {"Access-Control-Allow-Origin": SITE_ORIGIN, "Vary": "Origin"};
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: {...SECURITY, ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type"}});
  if (request.method !== "POST") return json({error: "Method not allowed"}, 405, {...cors, Allow: "POST, OPTIONS"});
  const payload = await smallBody(request);
  if (!payload || !PATHS.has(payload.path)) return json({error: "Invalid page"}, 400, cors);
  // These checks reduce obvious crawler noise; origin headers are not authentication.
  if (!request.cf?.botManagement?.verifiedBot && !/bot\b|crawler|spider|headless/i.test(request.headers.get("User-Agent") || "")) {
    const country = /^[A-Z]{2}$/.test(request.cf?.country || "") ? request.cf.country : "";
    const occurredAt = new Date().toISOString();
    const region = clean(request.cf?.region), city = clean(request.cf?.city);
    // Keep the dated event and daily count consistent if either write fails.
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO location_counts (day, path, country, region, city, views)
        VALUES (?1, ?2, ?3, ?4, ?5, 1)
        ON CONFLICT (day, path, country, region, city) DO UPDATE SET views = views + 1`)
        .bind(occurredAt.slice(0, 10), payload.path, country, region, city),
      env.DB.prepare("INSERT INTO visit_events (occurred_at, path, country, region, city) VALUES (?1, ?2, ?3, ?4, ?5)")
        .bind(occurredAt, payload.path, country, region, city),
    ]);
  }
  return new Response(null, {status: 204, headers: {...SECURITY, ...cors}});
}

async function stats(request, env) {
  if (!await authorized(request, env)) return json({error: "Enter a valid dashboard access key."}, 401);
  const days = Number(new URL(request.url).searchParams.get("days") || 30);
  if (![1, 7, 30, 90, 180].includes(days)) return json({error: "Invalid date range"}, 400);
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - (days - 1) * DAY).toISOString().slice(0, 10);
  const statements = [
    `SELECT COALESCE(SUM(views), 0) AS views, COUNT(DISTINCT NULLIF(country, '')) AS countries,
      COUNT(DISTINCT CASE WHEN city != '' THEN country || char(31) || region || char(31) || city END) AS cities
      FROM location_counts WHERE day BETWEEN ?1 AND ?2`,
    `SELECT country, region, city, SUM(views) AS views FROM location_counts WHERE day BETWEEN ?1 AND ?2
      GROUP BY country, region, city ORDER BY views DESC, country, region, city LIMIT 100`,
    `SELECT path, SUM(views) AS views FROM location_counts WHERE day BETWEEN ?1 AND ?2 GROUP BY path ORDER BY views DESC, path`,
    `SELECT day, SUM(views) AS views FROM location_counts WHERE day BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day`,
  ].map(sql => env.DB.prepare(sql).bind(start, end));
  const [summary, locations, pages, daily] = await env.DB.batch(statements);
  return json({start, end, summary: summary.results[0], locations: locations.results, pages: pages.results, daily: daily.results, preview: env.LOCAL_PREVIEW === "1"});
}

async function history(request, env) {
  if (!await authorized(request, env)) return json({error: "Enter a valid dashboard access key."}, 401);
  const params = new URL(request.url).searchParams;
  const days = Number(params.get("days") || 30), mode = params.get("mode") || "daily";
  const search = (params.get("search") || "").trim();
  if (![1, 7, 30, 90, 180].includes(days) || !["daily", "visits"].includes(mode) || search.length > 80) return json({error: "Invalid history selection"}, 400);
  let cursor = null;
  if (params.has("cursor")) {
    try { cursor = JSON.parse(params.get("cursor")); } catch { return json({error: "Invalid history cursor"}, 400); }
    const valid = mode === "daily"
      ? Array.isArray(cursor) && cursor.length === 4 && cursor.every(value => typeof value === "string" && value.length <= 80) && /^\d{4}-\d{2}-\d{2}$/.test(cursor[0])
      : Array.isArray(cursor) && cursor.length === 2 && typeof cursor[0] === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cursor[0]) && Number.isSafeInteger(cursor[1]) && cursor[1] > 0;
    if (!valid) return json({error: "Invalid history cursor"}, 400);
  }
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - (days - 1) * DAY).toISOString().slice(0, 10);
  const afterEnd = new Date(Date.parse(end) + DAY).toISOString();
  const values = mode === "daily" ? [start, end] : [`${start}T00:00:00.000Z`, afterEnd];
  const where = [mode === "daily" ? "day BETWEEN ?1 AND ?2" : "occurred_at >= ?1 AND occurred_at < ?2"];
  if (search) {
    // Treat percent and underscore as literal city-name characters, not wildcards.
    values.push(`%${search.replace(/[\\%_]/g, character => `\\${character}`)}%`);
    where.push("(city LIKE ?3 ESCAPE '\\' OR region LIKE ?3 ESCAPE '\\')");
  }
  if (cursor) {
    const offset = values.length;
    values.push(...cursor);
    where.push(mode === "daily"
      ? `(day < ?${offset + 1} OR (day = ?${offset + 1} AND (country, region, city) > (?${offset + 2}, ?${offset + 3}, ?${offset + 4})))`
      : `(occurred_at, id) < (?${offset + 1}, ?${offset + 2})`);
  }
  const sql = mode === "daily"
    ? `SELECT day, country, region, city, SUM(views) AS views FROM location_counts WHERE ${where.join(" AND ")}
       GROUP BY day, country, region, city ORDER BY day DESC, country, region, city LIMIT 51`
    : `SELECT id, occurred_at, path, country, region, city, 1 AS views FROM visit_events WHERE ${where.join(" AND ")}
       ORDER BY occurred_at DESC, id DESC LIMIT 51`;
  const {results} = await env.DB.prepare(sql).bind(...values).all();
  const more = results.length > 50, rows = results.slice(0, 50), last = rows.at(-1);
  const next = more ? JSON.stringify(mode === "daily" ? [last.day, last.country, last.region, last.city] : [last.occurred_at, last.id]) : null;
  return json({start, end, mode, rows, next_cursor: next});
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/collect") return await collect(request, env);
      if (path === "/api/stats" && request.method === "GET") return await stats(request, env);
      if (path === "/api/history" && request.method === "GET") return await history(request, env);
      if (["/", "/dashboard.js", "/styles.css"].includes(path) && ["GET", "HEAD"].includes(request.method)) {
        const asset = await env.ASSETS.fetch(request);
        const response = new Response(asset.body, asset);
        for (const [name, value] of Object.entries(SECURITY)) response.headers.set(name, value);
        return response;
      }
      return json({error: "Not found"}, 404);
    } catch {
      // Do not log visitor requests or leak database details on failures/quota exhaustion.
      return json({error: "Analytics is temporarily unavailable."}, 503);
    }
  },
  async scheduled(_event, env) {
    const cutoff = new Date(Date.now() - 179 * DAY).toISOString().slice(0, 10);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM location_counts WHERE day < ?1").bind(cutoff),
      env.DB.prepare("DELETE FROM visit_events WHERE occurred_at < ?1").bind(`${cutoff}T00:00:00.000Z`),
    ]);
  },
};
