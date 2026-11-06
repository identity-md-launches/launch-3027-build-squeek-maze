import test from "node:test";
import assert from "node:assert/strict";
import { loadScores, saveScore, SCORE_KEY } from "../src/storage.js";
let store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
};
test("scores persist and the top 10 are sorted with names and levels", () => {
  store.clear();
  for (let i = 0; i < 14; i++)
    assert.equal(saveScore(` Hamster ${i} `, i * 100, i + 1), true);
  const scores = loadScores();
  assert.equal(scores.length, 10);
  assert.equal(scores[0].score, 1300);
  assert.equal(scores[9].score, 400);
  assert.equal(scores[0].name, "Hamster 13");
  assert.equal(scores[0].level, 14);
});
test("corrupt or malformed browser storage safely recovers to an empty board", () => {
  for (const value of [
    "{no",
    "{}",
    "null",
    '[null, {"name":"Bad","score":-1}]',
  ]) {
    store.set(SCORE_KEY, value);
    assert.deepEqual(loadScores(), []);
  }
});
test("unavailable storage returns failure so the interface can offer a retry", () => {
  const old = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(loadScores(), []);
  assert.equal(saveScore("Hamster", 100, 1), false);
  globalThis.localStorage = old;
});
