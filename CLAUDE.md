# The Gilded Quill

A wizard-themed trivia board game for game night. Six categories × point values 1–10, the four houses as teams, steals, and a wagered final question. Players join on their phones by QR code.

Live at https://pokejaysim.github.io/quizzards. Every push to `main` deploys through GitHub Pages and runs the tests in GitHub Actions.

## How it's built

- **No framework and no build step.** The whole game is `index.html`: vanilla JS that renders into `#app` with `innerHTML`, plus click delegation on `data-action` (big screen) and `data-cmd` (host phone) attributes.
- `assets/questions.js` holds the question library: `CATS` (6 categories × 10 levels × 5 questions) and `FINALS`.
- `assets/supabase.js` is the Supabase client, used only for Realtime broadcast channels. There are no database tables.
- `assets/art/` holds the hand-painted artwork (webp): house crests, category icons, numbers `n1`–`n10`, the hat, the trophy and the paper texture.

## How a game runs

- The **big screen (TV/laptop) is the source of truth**. It holds `state` and broadcasts a public snapshot to phones on every render and every 4 seconds. Answers are only sent after the reveal.
- **Player phones** (`?room=CODE`) join, pick tiles on their house's turn, see the question, buzz to steal, and enter final wagers and answers.
- **Host phone (optional)** (`?room=CODE&host=KEY`) uses a private channel that includes the answers. The host judges with Correct or Wrong. Without a host phone, the big screen shows the same judge buttons and a "Peek at the answer" link.
- **Every question follows the same steps.** The picking house answers. Correct or Wrong is tapped. A miss opens buzzers for the other houses for 15 seconds (`STEAL_MS`). A right steal earns the points, and a wrong one loses them. Houses without a phone can tap their "steals" button.
- Games autosave to `localStorage`, with undo and resume.

## Design language

Hand-drawn **wet ink and watercolour** on dark night-blue paper, with gold accents. Fonts are Alegreya for display and Alegreya Sans for body text.

- Rough painted edges come from SVG filters `#rough` and `#rough-soft`, applied to `::before` layers behind panels, buttons and tiles. Don't put these filters on text, QR codes or tap targets: they warp labels, can break QR scanning, and render badly in iPhone Safari.
- Use the existing art in `assets/art/` rather than adding generic icons or emoji.
- The big screen is seen from across a room, so keep text large and contrast high. Phones are used one-handed, so keep tap targets big.

## Rules for changes

- Keep it a static site: no frameworks, bundlers or build step. If you add a stylesheet or script, `index.html` must load it.
- **Don't rename** the `localStorage` keys (`quizzards-*`), or saved games and phone names are lost.
- The tests rely on these hooks: `data-action` and `data-cmd` names, `.tile`, `.p-tile`, `#p-buzz`, `.question`, `.p-question`, `.answer-text`, `.steal-banner`, `.peek`, `.host-pill`, `.name-chip`, `.join-code`, `#name-input`, `#p-name`. Restyle them freely, but keep the hooks or update the tests to match.
- No Claude or Anthropic branding, and no author or GitHub links on the site itself.
- Keep user-facing copy in plain, friendly language.

## Tests

```sh
npm install
npx playwright install chromium   # first time only; add "webkit" to also test Safari
npx playwright test
```

The tests start a local server on port 8765 and use a mock Supabase relay, so they need no network. They cover the big screen, phones, host phone, steals, final question, resume and the question library. Run them before every push; GitHub Actions runs them too.

To see the game locally, run `python3 -m http.server 8765` and open http://localhost:8765. Real phones can't open `localhost`, so test phone play on the live site after pushing.

## Commits

Commit straight to `main` with short, plain-English messages. Pushing deploys the live site within about a minute.
