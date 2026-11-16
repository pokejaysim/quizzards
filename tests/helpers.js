// Shared test helpers.
// The real game talks to phones through Supabase. Tests swap in a stand-in that
// passes messages between pages through the test runner, so each phone can have
// its own browser context (its own storage and an iPhone-sized screen).

const MOCK_SUPABASE = `
window.__chans = [];
window.supabase = { createClient: function () { return {
  channel: function (name) {
    var ch = { name: name, cb: null, dead: false,
      on: function (t, f, cb) { ch.cb = cb; return ch; },
      subscribe: function (cb) {
        window.__chans.push(ch);
        setTimeout(function () { cb(window.__mockFail ? "CHANNEL_ERROR" : "SUBSCRIBED"); }, 20);
        return ch;
      },
      send: function (m) { if (!ch.dead && !window.__mockOffline) window.__relaySend(name, m.payload); }
    };
    return ch;
  },
  removeChannel: function (ch) { ch.dead = true; }
}; } };
window.__relayDeliver = function (name, payload) {
  if (window.__mockOffline) return;
  window.__chans.forEach(function (ch) { if (ch.name === name && !ch.dead && ch.cb) ch.cb({ payload: payload }); });
};
`;

function makeRelay() {
  const pages = [];
  return {
    pages,
    async newContext(browser, options) {
      const context = await browser.newContext(options || {});
      await context.exposeBinding("__relaySend", async ({ page }, room, payload) => {
        for (const p of pages) {
          if (p === page || p.isClosed()) continue;
          p.evaluate(([r, pl]) => window.__relayDeliver && window.__relayDeliver(r, pl), [room, payload]).catch(() => {});
        }
      });
      await context.addInitScript(MOCK_SUPABASE);
      return context;
    },
    async newPage(context, url) {
      const page = await context.newPage();
      pages.push(page);
      if (url) await page.goto(url);
      return page;
    }
  };
}

// Adds players on the host and sorts them, skipping the slow reveal.
async function sortPlayers(host, names) {
  if (names) {
    await host.fill("#name-input", names);
    await host.click("[data-action=addName]");
  }
  await host.click("[data-action=sortPlayers]");
  await host.click("[data-action=skipReveal]");
  await host.click("[data-action=startGame]");
}

module.exports = { MOCK_SUPABASE, makeRelay, sortPlayers };
