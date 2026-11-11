// Local preview/test adapter. Production uses the Cloudflare D1 binding.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

export function openLocalDB(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename);
  const version = sqlite.prepare("PRAGMA user_version").get().user_version;
  for (const file of readdirSync(new URL("./migrations/", import.meta.url)).filter(file => /^\d+_.*\.sql$/.test(file)).sort()) {
    const next = Number(file.split("_")[0]);
    if (next <= version) continue;
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(readFileSync(new URL(`./migrations/${file}`, import.meta.url), "utf8"));
      sqlite.exec(`PRAGMA user_version = ${next}`);
      sqlite.exec("COMMIT");
    } catch (error) { sqlite.exec("ROLLBACK"); sqlite.close(); throw error; }
  }
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let parameters = [];
      const query = {
        bind(...values) { parameters = values; return query; },
        async run() { return {success: true, meta: statement.run(...parameters), results: []}; },
        async all() { return {success: true, results: statement.all(...parameters)}; },
      };
      return query;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const results = await Promise.all(statements.map(statement => statement.all())); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return {DB, sqlite};
}
