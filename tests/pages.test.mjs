import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const output = new URL("../out/", import.meta.url);
const paths = ["", "research/", "teaching/", "service/", "cv/", "resources/"];
const pages = await Promise.all(paths.map(async (path) => ({ path, url: new URL(`${path}index.html`, output), html: await readFile(new URL(`${path}index.html`, output), "utf8") })));

test("every exported page links to existing pages, assets, and fragments", async () => {
  for (const page of pages) {
    for (const [, rawTarget] of page.html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^[a-z]+:/i.test(rawTarget)) continue;
      assert.ok(!rawTarget.startsWith("/"), `Root-relative link breaks repository hosting: ${rawTarget}`);
      const target = new URL(rawTarget.replaceAll("&amp;", "&"), page.url);
      const hash = target.hash.slice(1);
      target.hash = "";
      const info = await stat(target);
      const file = info.isDirectory() ? new URL("index.html", target) : target;
      assert.ok((await stat(file)).isFile(), `Missing file: ${file}`);
      if (hash) {
        const targetHtml = await readFile(file, "utf8");
        const ids = new Set([...targetHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
        assert.ok(ids.has(hash), `Missing fragment: ${rawTarget} on ${page.path || "home"}`);
      }
    }
  }
});

test("the home page includes the welcome and daily puzzle; academic content has separate destinations", () => {
  assert.match(pages[0].html, /Welcome to my website\./);
  assert.match(pages[0].html, /data-daily-puzzle=""/);
  assert.match(pages[0].html, /class="puzzle-board"/);
  assert.match(pages[0].html, /src="\.\/puzzle.js" type="module"/);
  assert.doesNotMatch(pages[0].html, /lichess.org\/training\/frame/);
  assert.doesNotMatch(pages[0].html, /On Cohesive Products of Fields|Instructor of Record|Lead organizer/);
  assert.match(pages[1].html, /On Cohesive Products of Fields/);
  assert.match(pages[2].html, /Instructor of Record/);
  assert.match(pages[3].html, /Lead organizer/);
  for (const page of pages) assert.doesNotMatch(page.html, /id="education-title"|Magna cum laude/);
  assert.match(pages[4].html, /href="\.\.\/henry-klatt-cv\.pdf" download="Henry-Klatt-CV\.pdf"/);
  for (const page of pages) assert.equal((page.html.match(/aria-current="page"/g) || []).length, 1);
});

test("the supplied contact image is valid and no page exposes a text email", async () => {
  const png = await readFile(new URL("email-contact.png", output));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.match(pages[0].html, /alt="University email address, displayed as an image"/);
  for (const page of pages) assert.doesNotMatch(page.html, /mailto:|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
});

test("the playable board ships every piece and its locally served rules library", async () => {
  for (const color of ["w", "b"]) for (const piece of ["p", "n", "b", "r", "q", "k"]) {
    const svg = await readFile(new URL(`chess-pieces/${color}${piece}.svg`, output), "utf8");
    assert.match(svg, /<svg\b/);
  }
  for (const path of ["puzzle.js", "puzzle-session.js", "vendor/chess.js", "vendor/chess-LICENSE.txt", "chess-pieces/ATTRIBUTION.md"]) {
    assert.ok((await stat(new URL(path, output))).isFile());
  }
});

test("CV downloads contain the actual PDF and starter metadata is absent", async () => {
  const pdf = await readFile(new URL("henry-klatt-cv.pdf", output));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  for (const page of pages) {
    assert.match(page.html, /<html lang="en">/);
    assert.doesNotMatch(page.html, /codex-preview|Starter Project|react-loading-skeleton/);
  }
});

test("all canonical URLs retain the GitHub repository prefix", () => {
  if (!process.env.SITE_URL) return;
  const base = process.env.SITE_URL.replace(/\/$/, "") + "/";
  for (const page of pages) {
    assert.ok(page.html.includes(`href="${new URL(page.path, base).href}"`));
    assert.ok(page.html.includes(`content="${new URL("og-blue.png", base).href}"`));
  }
});
