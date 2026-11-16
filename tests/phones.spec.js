// Host screen plus phones, each phone in its own iPhone-sized browser context.
const { test, expect, devices } = require("@playwright/test");
const { makeRelay, sortPlayers } = require("./helpers");

const phoneOptions = (() => {
  const d = Object.assign({}, devices["iPhone 13"]);
  delete d.defaultBrowserType; // run the iPhone layout in Chromium
  return d;
})();

async function setup(browser, names) {
  const relay = makeRelay();
  const hostCtx = await relay.newContext(browser, { viewport: { width: 1280, height: 900 } });
  const host = await relay.newPage(hostCtx, "/index.html");
  const errors = [];
  host.on("pageerror", (e) => errors.push("host: " + e.message));
  await host.click("[data-action=enablePhones]");
  const code = (await host.locator(".join-code").textContent()).trim();
  const phones = [];
  for (const name of names) {
    const ctx = await relay.newContext(browser, phoneOptions);
    const p = await relay.newPage(ctx, "/index.html?room=" + code);
    p.on("pageerror", (e) => errors.push(name + ": " + e.message));
    await p.fill("#p-name", name);
    await p.click("button[type=submit]");
    phones.push(p);
  }
  await expect(host.locator(".name-chip")).toHaveCount(names.length);
  return { relay, host, phones, code, errors };
}

async function houseOf(host, name) {
  return host.evaluate((n) => houseOfName(n).house, name);
}

test("phones pick, see the question and timer, and steal in order", async ({ browser }) => {
  const { host, phones, errors } = await setup(browser, ["Mao", "Sam"]);
  await sortPlayers(host);

  // Put Mao in Gryffindor and Sam in Ravenclaw, and make it Gryffindor's turn.
  await host.evaluate(() => {
    teams.sorted = [{ name: "Mao", house: 0 }, { name: "Sam", house: 2 }];
    teams.active = [0, 2];
    state.turn = 0;
    render();
  });
  const samHouse = await houseOf(host, "Sam");

  const [mao, sam] = phones;
  await expect(mao.locator("button.p-tile")).toHaveCount(60);
  await expect(sam.getByText(/is picking/)).toBeVisible();
  await mao.locator("button.p-tile").nth(25).click();

  const question = (await host.locator(".question").textContent()).trim();
  await expect(mao.locator(".p-question")).toHaveText(question);
  await expect(sam.locator(".p-question")).toHaveText(question);
  await expect(mao.locator("#p-timer .timer-num")).toHaveText(/0:\d\d/);

  await sam.click("#p-buzz");
  await expect(host.locator(".buzz-banner")).toContainText("Sam");
  await expect(sam.getByText(/1st in line/)).toBeVisible();

  await host.click("[data-action=reveal]");
  await expect(sam.locator(".p-answer")).toBeVisible();
  const order = await host.locator(".btn.house").allTextContents();
  expect(order[1]).toContain("steals");
  await host.locator(`.btn.house[data-team='${samHouse}']`).click();
  expect(await host.evaluate((h) => state.scores[h], samHouse)).toBe(5);
  expect(errors).toEqual([]);
});

test("final question on phones, then a new game sends phones back to join", async ({ browser }) => {
  const { host, phones, errors } = await setup(browser, ["Mao", "Sam"]);
  await sortPlayers(host);
  const [mao] = phones;

  await host.click("[data-action=startFinal]");
  await mao.fill("#p-wager-in", "7");
  await mao.click("#p-wager button");
  await expect(host.locator(".wager-in")).toContainText("Mao");
  await host.click("[data-action=lockWagers]");
  await expect(mao.locator("#p-timer")).toBeVisible();

  // Typing survives the screen redrawing while the timer runs.
  await mao.fill("#p-answer-in", "Antioch, Cadmus, Ignotus");
  await mao.waitForTimeout(1200);
  await expect(mao.locator("#p-answer-in")).toHaveValue("Antioch, Cadmus, Ignotus");
  await mao.click("#p-answer button");
  await expect(host.getByText(/Answers in from phones: \w/)).toBeVisible();

  await host.click("[data-action=revealFinal]");
  await expect(host.locator(".phone-answer")).toContainText("Antioch");
  const n = await host.locator("[data-right='1']").count();
  for (let i = 0; i < n; i++) await host.locator("[data-right='1']").nth(i).click();
  await host.click("[data-action=finishFinal]");
  await host.click("[data-action=closeSplash]");

  await host.click(".winner ~ .row [data-action=newGame]");
  for (const p of phones) await expect(p.getByText("That game is over.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a host reload keeps the room, and phones show when they lose the connection", async ({ browser }) => {
  const { host, phones, code, errors } = await setup(browser, ["Mao", "Sam"]);
  await sortPlayers(host);
  const [mao] = phones;
  await expect(mao.locator(".p-house")).toBeVisible();

  await host.reload();
  await host.click("[data-action=resume]");
  expect(await host.evaluate(() => net.code)).toBe(code);
  expect(await host.evaluate(() => Object.keys(net.ids).length)).toBe(2);
  await expect(mao.locator(".p-house")).toBeVisible();

  // Cut this phone off: it should say it's reconnecting, then recover.
  await mao.evaluate(() => { window.__mockOffline = true; });
  await expect(mao.getByText("Reconnecting to the game…")).toBeVisible({ timeout: 15000 });
  await mao.evaluate(() => { window.__mockOffline = false; });
  await expect(mao.getByText("Reconnecting to the game…")).toHaveCount(0, { timeout: 15000 });
  expect(errors).toEqual([]);
});
