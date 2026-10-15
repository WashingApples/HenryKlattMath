import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import worker from "./worker.mjs";
import { openLocalDB } from "./local-db.mjs";

// Fictional local fixtures; never sent to Cloudflare or the published website.
const {DB, sqlite} = openLocalDB();
const key = "local-preview-only-not-a-production-key";
const insert = sqlite.prepare("INSERT INTO location_counts VALUES (?, ?, ?, ?, ?, ?)");
for (const [country, region, city, count] of [["US", "District of Columbia", "Washington", 24], ["US", "Iowa", "Des Moines", 12], ["US", "Minnesota", "Minneapolis", 9], ["BR", "São Paulo", "São Paulo", 7], ["GB", "England", "London", 5], ["", "", "", 3]]) {
  for (let ago = 0; ago < 7; ago++) insert.run(new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10), ago % 2 ? "/HenryKlattMath/research/" : "/HenryKlattMath/", country, region, city, Math.max(1, count - ago * 2));
}
const env = {
  DB, ADMIN_TOKEN: key, LOCAL_PREVIEW: "1",
  ASSETS: {async fetch(request) {
    const path = new URL(request.url).pathname;
    const file = path === "/" ? "index.html" : path.slice(1);
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".css") ? "text/css" : "text/javascript";
    return new Response(await readFile(new URL(`./dashboard/${file}`, import.meta.url)), {headers: {"Content-Type": `${type}; charset=utf-8`}});
  }},
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const request = new Request(`http://127.0.0.1:${server.address().port}${incoming.url}`, {method: incoming.method, headers: incoming.headers});
    const response = await worker.fetch(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500); outgoing.end("Preview unavailable"); }
});
server.listen(0, "127.0.0.1", () => {
  console.log(`Local: http://127.0.0.1:${server.address().port}/`);
  console.log(`Demo access key: ${key}`);
  console.log("Fictional sample counts only. No network calls to Cloudflare.");
});
