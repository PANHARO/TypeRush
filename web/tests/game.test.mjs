import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../game.js";

const round = (mode = "speed", duration = 30) =>
  new Game(["hello", "world"], mode, duration, () => 0.999);

test("round waits for the first letter and empty spaces do not start it", () => {
  const game = round();
  game.advance(100000);
  game.type("  ", 100000);
  assert.equal(game.remaining, 30);
  assert.equal(game.running, false);
  game.type("h", 100001);
  game.advance(105001);
  assert.equal(game.remaining, 25);
  assert.equal(game.elapsed, 5);
});
test("WPM and accuracy include correct spaces and partial current words", () => {
  const game = round();
  game.type("hello ", 0);
  game.type("wor", 5000);
  assert.equal(game.correctCharacters, 9);
  assert.equal(game.totalCharacters, 9);
  assert.equal(game.wpm, 21.6);
  assert.equal(game.accuracy, 100);
});
test("wrong words count matching letters and an incorrect separating space", () => {
  const game = round();
  game.type("hallo ", 0);
  assert.equal(game.correctCharacters, 4);
  assert.equal(game.totalCharacters, 6);
  assert.ok(Math.abs(game.accuracy - (100 * 4) / 6) < 1e-9);
  assert.equal(game.target, "world");
});
test("backspace corrections replace mistakes for the current word", () => {
  const game = round();
  game.type("hallo", 0);
  assert.equal(game.accuracy, 80);
  game.type("hello", 1000);
  assert.equal(game.accuracy, 100);
  assert.equal(game.totalCharacters, 5);
});
test("survival starts at 15, gains 2 on correct, loses 1 on wrong, caps at 30", () => {
  const game = round("survival");
  game.type("hello ", 0);
  assert.equal(game.remaining, 17);
  game.type("wrong ", 1000);
  assert.equal(game.remaining, 15);
  for (let i = 0; i < 20; i++) game.type(`${game.target} `, 1000);
  assert.equal(game.remaining, 30);
});
test("late input cannot extend an expired survival game", () => {
  const game = round("survival");
  game.type("h", 0);
  game.type("hello ", 16000);
  assert.equal(game.finished, true);
  assert.equal(game.elapsed, 15);
  assert.equal(game.remaining, 0);
  assert.equal(game.index, 0);
});
test("background time is counted and clamps to the exact speed duration", () => {
  const game = round("speed", 15);
  game.type("hello", 100);
  game.advance(600100);
  assert.equal(game.elapsed, 15);
  assert.equal(game.remaining, 0);
  assert.equal(game.wpm, 4);
  game.type("hello ", 600200);
  assert.equal(game.index, 0);
});
test("word list repeats and history retains the last three submissions", () => {
  const game = round();
  game.type("hello world hello world hello ", 0);
  assert.equal(game.target, "world");
  assert.equal(game.completed.length, 3);
  assert.equal(game.correctCharacters, 30);
});
test("wrong survival submissions can end a round without processing later words", () => {
  const game = round("survival");
  game.type("h", 0);
  game.advance(14500);
  game.type("oops hello ", 14500);
  assert.equal(game.finished, true);
  assert.equal(game.index, 1);
  assert.equal(game.input, "");
});
test("each supported duration ends on its own schedule", () => {
  for (const duration of [15, 30, 60, 120]) {
    const game = round("speed", duration);
    game.type("hello", 1000);
    game.advance(1000 + duration * 1000);
    assert.equal(game.finished, true);
    assert.equal(game.result().duration, duration);
  }
});
