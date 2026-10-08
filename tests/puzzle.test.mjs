import assert from "node:assert/strict";
import test from "node:test";
import { PuzzleSession } from "../public/puzzle-session.js";

const daily = {
  game: { pgn: "b3 e5 Bb2 d6 e3 Nc6 Bb5 Bd7 Bxc6 Bxc6 Nf3 h6 d4 e4 Nfd2 d5 c4 Qg5 g3 O-O-O Nc3 f5 cxd5 Bxd5 Rc1 Nf6 Qc2 Kb8" },
  puzzle: { id: "aXDu6", fen: "1k1r1b1r/ppp3p1/5n1p/3b1pq1/3Pp3/1PN1P1P1/PBQN1P1P/2R1K2R w K - 1 1", lastMove: "c8b8", initialPly: 27, solution: ["c3e4", "f8d6", "e4g5"] },
};
const position = (fen, solution) => new PuzzleSession({ puzzle: { id: "fixture", fen, solution } });

test("incorrect or illegal moves do not change the position or consume the solution", () => {
  const session = new PuzzleSession(daily), start = session.chess.fen();
  assert.equal(session.attempt("c3", "b5").kind, "wrong");
  assert.equal(session.chess.fen(), start);
  assert.equal(session.index, 0);
  assert.equal(session.attempt("c3", "c4").kind, "illegal");
  assert.equal(session.chess.fen(), start);
});

test("a full puzzle accepts the correct moves, plays replies, finishes and restarts", () => {
  const session = new PuzzleSession(daily), start = session.chess.fen();
  assert.equal(session.player, "w");
  assert.equal(session.attempt("c3", "e4").kind, "correct");
  assert.equal(session.waitingForReply, true);
  assert.equal(session.attempt("e4", "g5").kind, "blocked");
  assert.ok(session.reply());
  assert.equal(session.chess.get("d6").type, "b");
  assert.equal(session.hint, "e4g5");
  assert.equal(session.attempt("e4", "g5").kind, "solved");
  assert.equal(session.complete, true);
  assert.equal(session.chess.get("g5").type, "n");
  assert.equal(session.attempt("g5", "f3").kind, "blocked");
  session.reset();
  assert.equal(session.chess.fen(), start);
  assert.equal(session.lastMove, "c8b8");
  assert.equal(session.complete, false);
});

test("older PGN-only responses reconstruct the position after the opponent's last move", () => {
  const { fen, ...puzzle } = daily.puzzle;
  const session = new PuzzleSession({ game: daily.game, puzzle });
  assert.equal(session.chess.fen().split(" ")[0], fen.split(" ")[0]);
  assert.equal(session.attempt("c3", "e4").kind, "correct");
});

test("black-to-move puzzles, castling and en passant use legal chess rules", () => {
  const black = position("4k3/8/8/8/8/8/4p3/4K3 b - - 0 1", ["e8d7"]);
  assert.equal(black.player, "b");
  assert.equal(black.attempt("e8", "d7").kind, "solved");
  const castle = position("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", ["e1g1"]);
  assert.equal(castle.attempt("e1", "g1").kind, "solved");
  assert.equal(castle.chess.get("f1").type, "r");
  const passant = position("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", ["e5d6"]);
  assert.equal(passant.attempt("e5", "d6").kind, "solved");
  assert.equal(passant.chess.get("d5"), undefined);
});

test("promotion choices are validated, including an underpromotion", () => {
  const session = position("7k/P7/8/8/8/8/8/7K w - - 0 1", ["a7a8n"]);
  const start = session.chess.fen();
  assert.equal(session.legalMoves("a7").filter(move => move.to === "a8").length, 4);
  assert.equal(session.attempt("a7", "a8", "q").kind, "wrong");
  assert.equal(session.chess.fen(), start);
  assert.equal(session.attempt("a7", "a8", "n").kind, "solved");
  assert.equal(session.chess.get("a8").type, "n");
});

test("corrupt API responses fail before exposing an unsolvable board", () => {
  assert.throws(() => new PuzzleSession({ puzzle: { id: "bad", solution: [] } }));
  assert.throws(() => position("not a fen", ["a1a2"]));
  assert.throws(() => position("4k3/8/8/8/8/8/8/4K3 w - - 0 1", ["a1a2"]));
});
