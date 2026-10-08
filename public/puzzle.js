import { PuzzleSession } from "./puzzle-session.js";

const widget = typeof document === "undefined" ? null : document.querySelector("[data-daily-puzzle]");
if (widget) startPuzzle(widget);

export function startPuzzle(widget) {
  const document = widget.ownerDocument;
  const window = document.defaultView;
  const fetch = (...args) => window.fetch(...args);
  const setTimeout = window.setTimeout.bind(window);
  const clearTimeout = window.clearTimeout.bind(window);
  const board = widget.querySelector(".puzzle-board");
  const loading = widget.querySelector(".puzzle-loading");
  const status = widget.querySelector(".puzzle-status");
  const instruction = widget.querySelector(".puzzle-instruction");
  const restart = widget.querySelector(".puzzle-restart");
  const hint = widget.querySelector(".puzzle-hint");
  const retry = widget.querySelector(".puzzle-retry");
  const link = widget.querySelector(".puzzle-link");
  const promotionDialog = widget.querySelector(".puzzle-promotion");
  const promotionChoices = widget.querySelector(".promotion-choices");
  const promotionCancel = widget.querySelector(".promotion-cancel");
  const assetRoot = new URL("./chess-pieces/", import.meta.url);
  const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  const colors = { w: "White", b: "Black" };
  let session, selected = null, hintedMove = null, replyTimer, request;
  let drag = null, ghost = null, suppressClick = false, promotion = null, loadedDay = null;
  let focusSquare = "a1", cells = new Map();
  const day = () => new Date().toISOString().slice(0, 10);
  const say = (text, kind = "") => { status.textContent = text; status.dataset.state = kind; };
  const playable = () => session && !session.complete && !session.waitingForReply && !promotion && !request;
  const pieceImage = piece => {
    const image = document.createElement("img");
    image.src = new URL(`${piece.color}${piece.type}.svg`, assetRoot).href;
    image.alt = "";
    image.draggable = false;
    return image;
  };

  function buildBoard() {
    const files = session.player === "w" ? "abcdefgh" : "hgfedcba";
    const ranks = session.player === "w" ? "87654321" : "12345678";
    board.replaceChildren();
    cells = new Map();
    focusSquare = files[0] + ranks[7];
    for (const [row, rank] of [...ranks].entries()) for (const [column, file] of [...files].entries()) {
      const square = file + rank;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.square = square;
      button.className = `chess-square ${(file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0 ? "light-square" : "dark-square"}`;
      const pieceSlot = document.createElement("span");
      pieceSlot.className = "piece-slot";
      button.append(pieceSlot);
      if (column === 0 || row === 7) {
        if (column === 0) {
          const label = document.createElement("span"); label.className = "rank-label"; label.textContent = rank; label.setAttribute("aria-hidden", "true"); button.append(label);
        }
        if (row === 7) {
          const label = document.createElement("span"); label.className = "file-label"; label.textContent = file; label.setAttribute("aria-hidden", "true"); button.append(label);
        }
      }
      const marker = document.createElement("span"); marker.className = "move-marker"; marker.setAttribute("aria-hidden", "true"); button.append(marker);
      cells.set(square, button);
      board.append(button);
    }
    board.hidden = false;
    loading.hidden = true;
    board.setAttribute("aria-label", `Chess board. You play ${colors[session.player]}.`);
  }

  function render() {
    const destinations = new Set(selected ? session.legalMoves(selected).map(move => move.to) : []);
    for (const [square, button] of cells) {
      const piece = session.chess.get(square);
      const key = piece ? piece.color + piece.type : "";
      const slot = button.querySelector(".piece-slot");
      if (slot.dataset.piece !== key) {
        slot.dataset.piece = key;
        slot.replaceChildren(...(piece ? [pieceImage(piece)] : []));
      }
      button.tabIndex = square === focusSquare ? 0 : -1;
      button.setAttribute("aria-label", `${square}, ${piece ? `${colors[piece.color]} ${names[piece.type]}` : "empty"}${destinations.has(square) ? ", legal destination" : ""}`);
      button.setAttribute("aria-pressed", String(square === selected));
      button.classList.toggle("selected-square", square === selected);
      button.classList.toggle("legal-square", destinations.has(square));
      button.classList.toggle("capture-square", destinations.has(square) && Boolean(piece));
      button.classList.toggle("last-move-square", Boolean(session.lastMove?.includes(square)));
      button.classList.toggle("hint-square", Boolean(hintedMove?.includes(square)));
      button.classList.toggle("drag-source", drag?.moved === true && square === drag.from);
    }
    restart.disabled = Boolean(request);
    hint.disabled = !playable();
    board.setAttribute("aria-busy", String(Boolean(request) || session.waitingForReply));
  }

  async function load() {
    request?.abort();
    clearTimeout(replyTimer);
    closePromotion(false);
    clearDrag();
    selected = hintedMove = null;
    const controller = new AbortController();
    request = controller;
    restart.disabled = hint.disabled = true;
    retry.hidden = true;
    say("Loading today’s puzzle…");
    loading.textContent = "Loading today’s puzzle…";
    if (!session) { loading.hidden = false; board.hidden = true; }
    board.setAttribute("aria-busy", "true");
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("https://lichess.org/api/puzzle/daily", { signal: controller.signal, credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error(`Puzzle service returned ${response.status}`);
      const next = new PuzzleSession(await response.json());
      if (request !== controller) return;
      session = next;
      loadedDay = day();
      link.href = `https://lichess.org/training/${session.id}`;
      instruction.textContent = `${colors[session.player]} to move. Select a piece, then its destination, or drag it.`;
      request = null;
      buildBoard();
      render();
      say("Find the best move.");
    } catch {
      if (request !== controller) return;
      request = null;
      say("Couldn’t load today’s puzzle. Retry or open it on Lichess.", "error");
      retry.hidden = false;
      if (session) render();
      else loading.textContent = "Puzzle unavailable";
      board.setAttribute("aria-busy", "false");
    } finally { clearTimeout(timeout); }
  }

  function move(from, to, promoteTo) {
    const outcome = session.attempt(from, to, promoteTo);
    selected = hintedMove = null;
    if (outcome.kind === "wrong" || outcome.kind === "illegal") {
      say(outcome.kind === "wrong" ? "That’s not the solution. Try another move." : "That move isn’t legal. Try again.", "error");
    } else if (outcome.kind === "solved") say("Puzzle solved!", "success");
    else if (outcome.kind === "correct") {
      say("Correct. Your opponent is replying…", "success");
      replyTimer = setTimeout(() => {
        session.reply();
        render();
        say(session.complete ? "Puzzle solved!" : `Correct. Continue with ${colors[session.player]}.`, "success");
      }, 400);
    }
    render();
  }

  function select(square) {
    if (!playable()) return;
    focusSquare = square;
    const piece = session.chess.get(square);
    if (selected && square !== selected) {
      const promotions = session.legalMoves(selected).filter(move => move.to === square && move.promotion);
      if (promotions.length) return choosePromotion(selected, square, promotions);
      if (piece?.color !== session.player) return move(selected, square);
    }
    selected = square === selected ? null : piece?.color === session.player ? square : null;
    hintedMove = null;
    render();
  }

  function choosePromotion(from, to, moves) {
    promotion = { from, to };
    promotionChoices.replaceChildren();
    for (const type of ["q", "r", "b", "n"].filter(type => moves.some(move => move.promotion === type))) {
      const button = document.createElement("button"); button.type = "button"; button.dataset.promotion = type;
      button.setAttribute("aria-label", `Promote to ${names[type]}`);
      button.append(pieceImage({ color: session.player, type }));
      promotionChoices.append(button);
    }
    promotionDialog.hidden = false;
    render();
    promotionChoices.firstElementChild.focus();
  }

  function closePromotion(restoreFocus = true) {
    const from = promotion?.from;
    promotion = null;
    promotionDialog.hidden = true;
    if (restoreFocus && from) { focusSquare = from; cells.get(from)?.focus(); }
  }

  function clearDrag() {
    ghost?.remove(); ghost = null;
    if (drag && board.hasPointerCapture(drag.pointer)) board.releasePointerCapture(drag.pointer);
    drag = null;
  }

  board.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; return; }
    const cell = event.target.closest("[data-square]");
    if (cell) select(cell.dataset.square);
  });
  board.addEventListener("focusin", event => {
    const cell = event.target.closest("[data-square]");
    if (cell) { focusSquare = cell.dataset.square; render(); }
  });
  board.addEventListener("keydown", event => {
    if (event.key === "Escape") { selected = hintedMove = null; render(); return; }
    const change = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[event.key];
    if (!change) return;
    event.preventDefault();
    const squares = [...cells.keys()], index = squares.indexOf(focusSquare), next = index + change;
    if (next < 0 || next >= 64 || (Math.abs(change) === 1 && Math.floor(next / 8) !== Math.floor(index / 8))) return;
    focusSquare = squares[next];
    render();
    cells.get(focusSquare).focus();
  });
  board.addEventListener("pointerdown", event => {
    if (!playable() || !event.isPrimary || event.button !== 0) return;
    const cell = event.target.closest("[data-square]");
    if (!cell || session.chess.get(cell.dataset.square)?.color !== session.player) return;
    drag = { from: cell.dataset.square, x: event.clientX, y: event.clientY, pointer: event.pointerId, moved: false };
    board.setPointerCapture(event.pointerId);
  });
  board.addEventListener("pointermove", event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    if (!drag.moved) {
      drag.moved = true; selected = drag.from; hintedMove = null;
      ghost = pieceImage(session.chess.get(drag.from));
      ghost.className = "chess-drag-ghost";
      ghost.style.width = `${board.getBoundingClientRect().width / 8}px`;
      document.body.append(ghost);
      render();
    }
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
  });
  board.addEventListener("pointerup", event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const moved = drag.moved, from = drag.from;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-square]");
    clearDrag();
    if (moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (target && board.contains(target) && target.dataset.square !== from) {
        selected = from;
        select(target.dataset.square);
      } else { selected = null; render(); }
    } else {
      // Pointer capture can retarget the native click to the board container.
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      select(from);
    }
  });
  board.addEventListener("pointercancel", () => { clearDrag(); selected = null; if (session) render(); });
  promotionChoices.addEventListener("click", event => {
    const button = event.target.closest("[data-promotion]");
    if (!button || !promotion) return;
    const { from, to } = promotion;
    closePromotion(false);
    focusSquare = to;
    move(from, to, button.dataset.promotion);
    cells.get(to)?.focus();
  });
  promotionCancel.addEventListener("click", () => { closePromotion(); render(); });
  promotionDialog.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closePromotion(); render(); }
    if (event.key === "Tab") {
      const buttons = [...promotionDialog.querySelectorAll("button")], first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  restart.addEventListener("click", () => {
    if (!session || request) return;
    clearTimeout(replyTimer); closePromotion(false); clearDrag();
    session.reset(); selected = hintedMove = null;
    render(); say("Find the best move.");
  });
  hint.addEventListener("click", () => {
    if (!playable()) return;
    hintedMove = session.hint; selected = null;
    const from = hintedMove.slice(0, 2), to = hintedMove.slice(2, 4);
    say(`Try ${from} to ${to}${hintedMove[4] ? `, promoting to ${names[hintedMove[4]]}` : ""}.`);
    render();
  });
  retry.addEventListener("click", load);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && loadedDay && loadedDay !== day() && !request) load();
  });
  load();
}
