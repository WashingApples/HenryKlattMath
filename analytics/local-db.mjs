// Local preview/test adapter. Production uses the Cloudflare D1 binding.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function openLocalDB(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename);
  if (sqlite.prepare("PRAGMA user_version").get().user_version === 0) {
    sqlite.exec(readFileSync(new URL("./migrations/0001_location_counts.sql", import.meta.url), "utf8"));
    sqlite.exec("PRAGMA user_version = 1");
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
