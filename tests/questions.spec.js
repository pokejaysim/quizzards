// Checks the shape of the question library so a typo can't break a game.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "assets", "questions.js"), "utf8");
const { CATS, FINALS } = new Function(src + "; return { CATS: CATS, FINALS: FINALS };")();

test("six categories, ten levels each, at least five questions per tile", () => {
  expect(CATS).toHaveLength(6);
  for (const cat of CATS) {
    expect(cat.name).toBeTruthy();
    expect(cat.qs).toHaveLength(10);
    cat.qs.forEach((pool, level) => {
      expect(pool.length, `${cat.name} level ${level + 1}`).toBeGreaterThanOrEqual(5);
      for (const pair of pool) {
        expect(pair).toHaveLength(2);
        expect(pair[0].trim().length, `${cat.name} level ${level + 1} question`).toBeGreaterThan(5);
        expect(pair[1].trim().length, `answer to: ${pair[0]}`).toBeGreaterThan(0);
      }
    });
  }
});

test("no question appears twice", () => {
  const seen = new Set();
  for (const cat of CATS) for (const pool of cat.qs) for (const [q] of pool) {
    expect(seen.has(q), q).toBe(false);
    seen.add(q);
  }
});

test("final questions are complete", () => {
  expect(FINALS.length).toBeGreaterThanOrEqual(8);
  for (const f of FINALS) {
    expect(f.cat && f.q && f.a, JSON.stringify(f)).toBeTruthy();
  }
});
