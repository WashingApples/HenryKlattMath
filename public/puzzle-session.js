import { Chess } from "./vendor/chess.js";

const movePattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const playUci = (chess, uci) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });

export class PuzzleSession {
  constructor(data) {
    const puzzle = data?.puzzle;
    if (!puzzle || typeof puzzle.id !== "string" || !/^[a-zA-Z0-9]+$/.test(puzzle.id) ||
        !Array.isArray(puzzle.solution) || !puzzle.solution.length || !puzzle.solution.every(move => typeof move === "string" && movePattern.test(move))) {
      throw new Error("Invalid puzzle data");
    }
    this.chess = new Chess();
    if (typeof puzzle.fen === "string") {
      this.chess.load(puzzle.fen);
    } else {
      // Older API responses supply the game's PGN instead of a starting FEN.
      if (typeof data.game?.pgn !== "string" || !Number.isInteger(puzzle.initialPly) || puzzle.initialPly < 0) throw new Error("Missing puzzle position");
      this.chess.loadPgn(data.game.pgn);
      const plies = puzzle.initialPly + 1;
      if (this.chess.history().length < plies) throw new Error("Incomplete puzzle game");
      while (this.chess.history().length > plies) this.chess.undo();
    }
    this.initialFen = this.chess.fen();
    this.player = this.chess.turn();
    this.id = puzzle.id;
    this.solution = [...puzzle.solution];
    this.initialLastMove = typeof puzzle.lastMove === "string" && movePattern.test(puzzle.lastMove) ? puzzle.lastMove : null;
    // Reject incomplete/corrupt responses before showing a board that cannot finish.
    const validation = new Chess(this.initialFen);
    for (const move of this.solution) playUci(validation, move);
    this.reset();
  }

  get complete() { return this.index >= this.solution.length; }
  get waitingForReply() { return !this.complete && this.chess.turn() !== this.player; }
  get hint() { return this.complete ? null : this.solution[this.index]; }

  reset() {
    this.chess.load(this.initialFen);
    this.index = 0;
    this.lastMove = this.initialLastMove;
  }

  attempt(from, to, promotion) {
    if (this.complete || this.waitingForReply) return { kind: "blocked" };
    let move;
    try { move = this.chess.move({ from, to, ...(promotion ? { promotion } : {}) }); }
    catch { return { kind: "illegal" }; }
    const uci = move.from + move.to + (move.promotion || "");
    if (uci !== this.solution[this.index]) {
      this.chess.undo();
      return { kind: "wrong" };
    }
    this.index++;
    this.lastMove = uci;
    return { kind: this.complete ? "solved" : "correct", move: move.san };
  }

  reply() {
    if (!this.waitingForReply) return false;
    const uci = this.solution[this.index];
    playUci(this.chess, uci);
    this.index++;
    this.lastMove = uci;
    return true;
  }

  legalMoves(square) {
    return this.complete || this.waitingForReply ? [] : this.chess.moves({ square, verbose: true });
  }
}
