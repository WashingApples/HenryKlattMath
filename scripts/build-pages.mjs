import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Export the same pages used by the local preview. GitHub Pages needs no server.
const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "out");
const generated = resolve(root, ".generated-pages");
const source = await readFile(resolve(root, "app/site.tsx"), "utf8");
const escape = (value) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let canonicalRoot = "";
if (process.env.SITE_URL?.trim()) {
  const parsed = new URL(process.env.SITE_URL.trim());
  if (parsed.protocol !== "https:") throw new Error("SITE_URL must use HTTPS.");
  if (parsed.username || parsed.password) throw new Error("SITE_URL must not include credentials.");
  parsed.search = "";
  parsed.hash = "";
  canonicalRoot = parsed.href.replace(/\/$/, "") + "/";
}
await mkdir(generated, { recursive: true });
try {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  await writeFile(resolve(generated, "site.mjs"), compiled.outputText);
  const { AcademicSite, pageInfo } = await import(new URL("../.generated-pages/site.mjs", import.meta.url));
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(resolve(root, "public"), out, { recursive: true });
  await writeFile(resolve(out, "styles.css"), await readFile(resolve(root, "app/globals.css")));
  await writeFile(resolve(out, ".nojekyll"), "");
  for (const [page, info] of Object.entries(pageInfo)) {
    const body = renderToStaticMarkup(createElement(AcademicSite, { page }));
    const rootPath = page === "home" ? "./" : "../";
    const canonical = canonicalRoot ? new URL(info.path, canonicalRoot).href : "";
    const urlMetadata = canonical ? `
  <link rel="canonical" href="${escape(canonical)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:image" content="${escape(new URL("og-blue.png", canonicalRoot).href)}">
  <meta property="og:image:alt" content="Henry Klatt, Ph.D. student in mathematics at the George Washington University">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escape(new URL("og-blue.png", canonicalRoot).href)}">` : '<meta name="twitter:card" content="summary">';
    const html = `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#15191f">
  <title>${escape(info.title)}</title>
  <meta name="description" content="${escape(info.description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(info.title)}">
  <meta property="og:description" content="${escape(info.description)}">
  <meta name="twitter:title" content="${escape(info.title)}">
  <meta name="twitter:description" content="${escape(info.description)}">
  ${urlMetadata}
  <link rel="icon" href="${rootPath}favicon.png" type="image/png">
  <script src="${rootPath}theme-init.js"></script>
  <link rel="stylesheet" href="${rootPath}styles.css">
</head><body>${body}<script src="${rootPath}theme.js" defer></script><script src="${rootPath}puzzle.js" type="module"></script></body></html>`;
    const directory = resolve(out, info.path);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "index.html"), html);
  }
  console.log(`Prepared ${Object.keys(pageInfo).length} GitHub Pages pages in out/ (${canonicalRoot || "hosting URL not yet chosen"}).`);
} finally {
  await rm(generated, { recursive: true, force: true });
}
