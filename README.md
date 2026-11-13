# Quizzards

A wizard-themed trivia board game for game night, played by four houses.

## How to play

- Pick a category and a point value from the board. 1 is the easiest question and 10 is the hardest.
- Reveal the answer, then give the points to the house that got it right.
- When the board is cleared (or whenever you choose to skip ahead), play the Final Question. Each house wagers secretly, and a right answer adds the wager while a wrong one subtracts it.
- The highest score wins the House Cup.

## Question library

There are 180 board questions (3 for every tile) plus 5 final questions. Each new game shuffles which question appears on each tile. The browser remembers which questions you've already played, so they won't repeat until a tile's pool runs out.

All the questions live in `index.html`, in the `CATS` and `FINALS` lists near the top of the script.

## Running it

It's a single `index.html` file with no build step. Open it in a browser, or host it with GitHub Pages.

---

Fan-made trivia game, not affiliated with or endorsed by Warner Bros., J.K. Rowling or Wizarding World.
