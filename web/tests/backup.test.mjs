import test from "node:test";
import assert from "node:assert/strict";
import {
  makeBackup,
  parseBackup,
  mergeScores,
  rankScores,
  validScore,
} from "../backup.js";

const score = (id, wpm = 60, duration = 30) => ({
  id,
  mode: "speed",
  duration,
  wpm,
  accuracy: 95,
  elapsed: duration,
  createdAt: "2026-11-16T12:00:00Z",
});
test("backup round-trip preserves scores and strips profile credentials", () => {
  const text = makeBackup("Player", [
    {
      ...score("one"),
      profileId: "private-id",
      pinHash: "secret",
      salt: "secret",
    },
  ]);
  assert.deepEqual(parseBackup(text), {
    name: "Player",
    scores: [score("one")],
  });
  assert.equal(text.includes("secret"), false);
  assert.equal(text.includes("private-id"), false);
});
test("reimporting a backup is idempotent and cannot overwrite existing IDs", () => {
  const original = [score("one")];
  const merged = mergeScores(original, [score("one", 999), score("two", 70)]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((s) => s.id === "one").wpm, 60);
  assert.deepEqual(mergeScores(merged, merged), merged);
});
test("top ten are independent for each duration and survival ranks by elapsed time", () => {
  const all = [];
  for (const duration of [15, 30, 60, 120])
    for (let i = 0; i < 15; i++)
      all.push(score(`speed-${duration}-${i}`, i, duration));
  for (let i = 0; i < 15; i++)
    all.push({
      ...score(`survival-${i}`, 100 - i),
      mode: "survival",
      duration: 0,
      elapsed: i + 1,
    });
  const ranked = rankScores(all);
  assert.equal(ranked.length, 50);
  assert.equal(ranked.filter((s) => s.duration === 15).length, 10);
  assert.equal(ranked.find((s) => s.mode === "survival").elapsed, 15);
});
test("malformed, future-version, incomplete and impossible backups are rejected", () => {
  assert.throws(() => parseBackup("{oops"));
  const document = JSON.parse(makeBackup("Player", [score("one")]));
  for (const mutation of [
    (d) => (d.version = 2),
    (d) => (d.scores[0].wpm = -1),
    (d) => (d.scores[0].accuracy = 101),
    (d) => (d.scores[0].duration = 45),
    (d) => (d.scores[0].elapsed = 2),
    (d) => (d.scores[0].id = "<script>"),
    (d) => (d.scores[0].createdAt = "invalid"),
    (d) => (d.scores = null),
  ]) {
    const copy = structuredClone(document);
    mutation(copy);
    assert.throws(() => parseBackup(JSON.stringify(copy)));
  }
  assert.equal(validScore({ ...score("one"), wpm: Infinity }), false);
  assert.throws(() => parseBackup(" ".repeat(2 * 1024 * 1024 + 1)));
});
