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
    await env.DB.prepare(`INSERT INTO location_counts (day, path, country, region, city, views)
      VALUES (?1, ?2, ?3, ?4, ?5, 1)
      ON CONFLICT (day, path, country, region, city) DO UPDATE SET views = views + 1`)
      .bind(new Date().toISOString().slice(0, 10), payload.path, country, clean(request.cf?.region), clean(request.cf?.city)).run();
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

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/collect") return await collect(request, env);
      if (path === "/api/stats" && request.method === "GET") return await stats(request, env);
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
    await env.DB.prepare("DELETE FROM location_counts WHERE day < ?1").bind(cutoff).run();
  },
};
