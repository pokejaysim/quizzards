# The Gilded Quill

A wizard-themed trivia board game for game night, played by four houses.

## How to play

- Pick a category and a point value from the board. 1 is the easiest question and 10 is the hardest.
- Reveal the answer, then give the points to the house that got it right.
- When the board is cleared (or whenever you choose to skip ahead), play the Final Question. Each house wagers secretly, and a right answer adds the wager while a wrong one subtracts it.
- The highest score wins the House Cup.

## Judging and steals

Every question works the same way:

- The picking house answers first, out loud. Someone taps **Correct** or **Wrong**.
- A miss costs nothing, and opens buzzers on the other houses' phones for 15 seconds.
- The first house to buzz steals. Right earns the tile's points, and wrong loses them. After a wrong steal, buzzers reopen for houses that haven't tried.
- A house without a phone can raise a hand instead. Tap that house's **steals** button.
- If nobody buzzes in time, the answer is shown and nobody scores.

### Host phone (optional)

For the fairest game, one person hosts from their own phone. In the setup screen (or the menu), choose **Set up the host phone** and scan that QR code on the host's phone only, since it shows every answer. The host sees each question with its answer and judges from the phone.

Without a host phone, judge on the big screen. If you're not sure of an answer, **Peek at the answer** shows it, but only peek if the big screen isn't what everyone is watching. If the host phone drops out mid-game, the big screen's judge buttons come back on their own.

## Question library

There are 300 board questions (5 for every tile) plus 8 final questions. Each new game shuffles which question appears on each tile. The browser remembers which questions you've already played, so they won't repeat until a tile's pool runs out.

All the questions live in `assets/questions.js`, in the `CATS` and `FINALS` lists. Where the books and films disagree, answers follow the books.

## Tests

The tests play through the game in a real browser, including a host screen with phones joining. They run on GitHub after every push, or locally with:

```
npm install
npx playwright install chromium
npm test
```

## Running it

It's a single `index.html` file with no build step. Open it in a browser, or host it with GitHub Pages.

---

Fan-made trivia game, not affiliated with or endorsed by Warner Bros., J.K. Rowling or Wizarding World.
