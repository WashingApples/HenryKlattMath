import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import { startPuzzle } from "../public/puzzle.js";

const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");
const daily = { puzzle: { id: "aXDu6", fen: "1k1r1b1r/ppp3p1/5n1p/3b1pq1/3Pp3/1PN1P1P1/PBQN1P1P/2R1K2R w K - 1 1", lastMove: "c8b8", solution: ["c3e4", "f8d6", "e4g5"] } };
const flush = () => new Promise(resolve => setImmediate(resolve));

async function mount(t, data = daily, fetchOverride) {
  const dom = new JSDOM(html, { url: "https://example.test/academic/", pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom, document = window.document, widget = document.querySelector("[data-daily-puzzle]");
  const timers = new Map(); let nextTimer = 0;
  window.setTimeout = (fn, ms) => { timers.set(++nextTimer, { fn, ms }); return nextTimer; };
  window.clearTimeout = id => timers.delete(id);
  window.fetch = fetchOverride || (async () => ({ ok: true, json: async () => data }));
  startPuzzle(widget);
  await flush();
  const query = selector => widget.querySelector(selector);
  const cell = square => query(`[data-square="${square}"]`);
  const runTimers = ms => {
    for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); }
  };
  return { window, document, widget, query, cell, runTimers };
}

test("click moves reject errors, play the opponent, complete and restart the same puzzle", async t => {
  const { query, cell, runTimers } = await mount(t);
  assert.equal(query(".puzzle-board").children.length, 64);
  assert.equal(query(".puzzle-board").hidden, false);
  assert.match(query(".puzzle-instruction").textContent, /White to move/);
  cell("c3").click();
  assert.equal(cell("c3").getAttribute("aria-pressed"), "true");
  cell("b5").click();
  assert.match(query(".puzzle-status").textContent, /not the solution/);
  assert.equal(cell("c3").querySelector(".piece-slot").dataset.piece, "wn");
  cell("c3").click(); cell("e4").click();
  assert.equal(cell("e4").querySelector(".piece-slot").dataset.piece, "wn");
  assert.equal(query(".puzzle-board").getAttribute("aria-busy"), "true");
  runTimers(400);
  assert.equal(cell("d6").querySelector(".piece-slot").dataset.piece, "bb");
  cell("e4").click(); cell("g5").click();
  assert.equal(query(".puzzle-status").textContent, "Puzzle solved!");
  query(".puzzle-restart").click();
  assert.equal(cell("c3").querySelector(".piece-slot").dataset.piece, "wn");
  assert.equal(query(".puzzle-status").textContent, "Find the best move.");
});

test("restarting while a reply is pending cancels the old reply", async t => {
  const { query, cell, runTimers } = await mount(t);
  cell("c3").click(); cell("e4").click();
  query(".puzzle-restart").click(); runTimers(400);
  assert.equal(cell("c3").querySelector(".piece-slot").dataset.piece, "wn");
  assert.equal(cell("f8").querySelector(".piece-slot").dataset.piece, "bb");
  assert.equal(query(".puzzle-board").getAttribute("aria-busy"), "false");
});

test("promotion opens an accessible choice and accepts the correct underpromotion", async t => {
  const { query, cell } = await mount(t, { puzzle: { id: "promotion", fen: "7k/P7/8/8/8/8/8/7K w - - 0 1", solution: ["a7a8n"] } });
  cell("a7").click(); cell("a8").click();
  assert.equal(query(".puzzle-promotion").hidden, false);
  assert.equal(query(".promotion-choices").children.length, 4);
  query('[data-promotion="n"]').click();
  assert.equal(query(".puzzle-promotion").hidden, true);
  assert.equal(cell("a8").querySelector(".piece-slot").dataset.piece, "wn");
  assert.equal(query(".puzzle-status").textContent, "Puzzle solved!");
});

test("keyboard navigation and hints identify squares without consuming moves", async t => {
  const { window, document, query, cell } = await mount(t);
  cell("a1").focus();
  cell("a1").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  assert.equal(document.activeElement.dataset.square, "a2");
  query(".puzzle-hint").click();
  assert.match(query(".puzzle-status").textContent, /c3 to e4/);
  assert.ok(cell("c3").classList.contains("hint-square"));
  assert.ok(cell("e4").classList.contains("hint-square"));
  assert.equal(cell("c3").querySelector(".piece-slot").dataset.piece, "wn");
});

test("pointer taps and dragging work even when pointer capture retargets clicks", async t => {
  const { window, document, query, cell, runTimers } = await mount(t);
  const board = query(".puzzle-board");
  let captured = false;
  board.setPointerCapture = () => { captured = true; };
  board.hasPointerCapture = () => captured;
  board.releasePointerCapture = () => { captured = false; };
  const pointer = (target, type, x, y) => {
    const event = new window.Event(type, { bubbles: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });
    target.dispatchEvent(event);
  };
  document.elementFromPoint = () => cell("c3");
  pointer(cell("c3"), "pointerdown", 20, 20); pointer(board, "pointerup", 20, 20);
  board.click(); runTimers(0);
  assert.equal(cell("c3").getAttribute("aria-pressed"), "true");
  query(".puzzle-restart").click();
  board.getBoundingClientRect = () => ({ width: 400 });
  document.elementFromPoint = () => cell("e4");
  pointer(cell("c3"), "pointerdown", 20, 20); pointer(board, "pointermove", 90, 90); pointer(board, "pointerup", 90, 90);
  board.click(); runTimers(0);
  assert.equal(cell("e4").querySelector(".piece-slot").dataset.piece, "wn");
  assert.equal(document.querySelector(".chess-drag-ghost"), null);
  runTimers(400);
  assert.equal(cell("d6").querySelector(".piece-slot").dataset.piece, "bb");
});

test("a network failure exposes a retry and recovers when the service returns", async t => {
  let failing = true;
  const { query } = await mount(t, daily, async () => {
    if (failing) throw new Error("Offline");
    return { ok: true, json: async () => daily };
  });
  assert.match(query(".puzzle-status").textContent, /Couldn’t load/);
  assert.equal(query(".puzzle-retry").hidden, false);
  assert.equal(query(".puzzle-board").hidden, true);
  failing = false; query(".puzzle-retry").click(); await flush();
  assert.equal(query(".puzzle-retry").hidden, true);
  assert.equal(query(".puzzle-board").children.length, 64);
});

test("black puzzles orient the board with black pieces nearest the player", async t => {
  const { query } = await mount(t, { puzzle: { id: "black", fen: "4k3/8/8/8/8/8/4p3/4K3 b - - 0 1", solution: ["e8d7"] } });
  assert.equal(query(".puzzle-board").firstElementChild.dataset.square, "h1");
  assert.equal(query(".puzzle-board").lastElementChild.dataset.square, "a8");
  assert.match(query(".puzzle-instruction").textContent, /Black to move/);
});
