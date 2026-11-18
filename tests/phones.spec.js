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

// Opens the private host link on its own phone-sized page.
async function addHostPhone(browser, relay, host, code, errors) {
  const key = await host.evaluate(() => net.hostKey);
  const ctx = await relay.newContext(browser, phoneOptions);
  const hp = await relay.newPage(ctx, "/index.html?room=" + code + "&host=" + key);
  hp.on("pageerror", (e) => errors.push("host phone: " + e.message));
  await expect(host.locator(".host-pill")).toBeVisible({ timeout: 15000 });
  return hp;
}

// Puts named players into fixed houses so tests don't depend on the random sort.
async function fixHouses(host, map, turnHouse) {
  await host.evaluate(([m, t]) => {
    teams.sorted = Object.keys(m).map((n) => ({ name: n, house: m[n] }));
    teams.active = Array.from(new Set(Object.values(m))).sort();
    state.turn = teams.active.indexOf(t);
    render();
  }, [map, turnHouse]);
}

async function houseOf(host, name) {
  return host.evaluate((n) => houseOfName(n).house, name);
}

test("without a host phone: phones pick and see the question, the big screen judges", async ({ browser }) => {
  const { host, phones, errors } = await setup(browser, ["Mao", "Sam"]);
  await sortPlayers(host);
  await fixHouses(host, { Mao: 0, Sam: 2 }, 0);
  const [mao, sam] = phones;

  await expect(mao.locator("button.p-tile")).toHaveCount(60);
  await expect(sam.getByText(/is picking/)).toBeVisible();
  await mao.locator("button.p-tile").nth(25).click();

  const question = (await host.locator(".question").textContent()).trim();
  await expect(mao.locator(".p-question")).toHaveText(question);
  await expect(sam.locator(".p-question")).toHaveText(question);
  await expect(sam.locator("#p-buzz")).toHaveCount(0);
  await expect(sam.getByText(/raise your hand to steal/)).toBeVisible();
  expect(await sam.evaluate(() => ph.st.q.answer)).toBeNull();

  // A wrong steal before the reveal costs points.
  await host.locator("details.tv-judge summary").click();
  await host.click("[data-action=penalty][data-team='2']");
  expect(await host.evaluate(() => state.scores[2])).toBe(-5);

  await host.click("[data-action=reveal]");
  await expect(sam.locator(".p-answer")).toBeVisible();
  await host.click("[data-action=award][data-team='0']");
  expect(await host.evaluate(() => state.scores.slice())).toEqual([5, 0, -5, 0]);
  expect(errors).toEqual([]);
});

test("host phone: sees the answer, a miss opens buzzers, and a wrong steal costs points", async ({ browser }) => {
  const { relay, host, phones, code, errors } = await setup(browser, ["Mao", "Sam", "Lee"]);
  await sortPlayers(host);
  await fixHouses(host, { Mao: 0, Sam: 2, Lee: 3 }, 0);
  const hp = await addHostPhone(browser, relay, host, code, errors);
  const [mao, sam, lee] = phones;

  await expect(hp.getByText(/Gryffindor is picking/)).toBeVisible();
  await hp.locator("button.p-tile").nth(13).click(); // a 3-point tile
  await expect(host.locator(".question")).toBeVisible();
  expect(await host.evaluate(() => state.qMode)).toBe("host");

  // Only the host phone has the answer.
  const answer = await host.evaluate(() => currentPair()[1]);
  await expect(hp.locator(".p-answer-text")).toHaveText(answer);
  for (const p of phones) {
    expect(await p.evaluate(() => ph.st.q.answer)).toBeNull();
    await expect(p.locator("#p-buzz")).toHaveCount(0);
  }
  await expect(host.locator(".answer")).toHaveCount(0);

  // Gryffindor misses: no penalty, buzzers open for the other two houses only.
  await hp.click("[data-cmd=wrong]");
  await expect(sam.locator("#p-buzz")).toBeVisible();
  await expect(lee.locator("#p-buzz")).toBeVisible();
  await expect(mao.getByText("Your house already answered.")).toBeVisible();
  await expect(host.locator(".steal-banner")).toBeVisible();
  expect(await host.evaluate(() => state.scores[0])).toBe(0);

  // Ravenclaw buzzes first and gets it wrong.
  await sam.click("#p-buzz");
  await expect(hp.getByText("Ravenclaw is stealing")).toBeVisible();
  await expect(lee.getByText("Ravenclaw is stealing.")).toBeVisible();
  await expect(sam.getByText("You buzzed first!")).toBeVisible();
  await hp.click("[data-cmd=wrong]");
  expect(await host.evaluate(() => state.scores[2])).toBe(-3);

  // Buzzers reopen for Slytherin only. Nobody buzzes, so the window closes.
  await expect(lee.locator("#p-buzz")).toBeVisible();
  await expect(sam.getByText("Your house already answered.")).toBeVisible();
  await host.evaluate(() => { state.timerEnd = Date.now() + 200; });
  await expect(host.locator(".answer-text")).toHaveText(answer);
  await expect(lee.locator(".p-answer-text")).toHaveText(answer);
  await expect(host.getByText("Nobody got this one.")).toBeVisible();

  await hp.click("[data-cmd=next]");
  await expect(host.locator(".tile.used")).toHaveCount(1);
  await expect(hp.getByText(/Ravenclaw is picking/)).toBeVisible();

  // Next question: Ravenclaw gets it right first time.
  await sam.locator("button.p-tile").nth(0).click();
  await expect(hp.locator("[data-cmd=correct]")).toBeVisible();
  await hp.click("[data-cmd=correct]");
  expect(await host.evaluate(() => state.scores.slice())).toEqual([0, 0, -2, 0]);
  await expect(sam.locator(".p-answer")).toBeVisible();

  // Undo from the host phone puts the question back.
  await hp.locator("[data-cmd=undo]").click();
  expect(await host.evaluate(() => state.scores[2])).toBe(-3);
  await expect(hp.locator("[data-cmd=correct]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a steal that gets it right wins the points", async ({ browser }) => {
  const { relay, host, phones, code, errors } = await setup(browser, ["Mao", "Sam"]);
  await sortPlayers(host);
  await fixHouses(host, { Mao: 1, Sam: 3 }, 1);
  const hp = await addHostPhone(browser, relay, host, code, errors);
  const [, sam] = phones;
  await host.locator(".tile").nth(42).click(); // an 8-point tile
  await hp.click("[data-cmd=wrong]");
  await sam.click("#p-buzz");
  await hp.click("[data-cmd=correct]");
  expect(await host.evaluate(() => state.scores.slice())).toEqual([0, 0, 0, 8]);
  await expect(host.getByText("Slytherin stole it! +8")).toBeVisible();
  expect(errors).toEqual([]);
});

test("final question run from the host phone", async ({ browser }) => {
  const { relay, host, phones, code, errors } = await setup(browser, ["Mao", "Sam"]);
  await sortPlayers(host);
  await fixHouses(host, { Mao: 0, Sam: 2 }, 0);
  const hp = await addHostPhone(browser, relay, host, code, errors);
  const [mao] = phones;
  await host.evaluate(() => { state.scores = [20, 0, 6, 0]; render(); });

  await hp.click("[data-cmd=startFinal]");
  await mao.fill("#p-wager-in", "15");
  await mao.click("#p-wager button");
  await expect(hp.locator("#hw-0")).toHaveValue("15");
  await hp.fill("#hw-2", "8");
  await hp.locator(".h-wager[data-house='2'] button").click();
  await expect(host.locator("#wager-2")).toHaveValue("8");
  await hp.click("[data-cmd=lockWagers]");
  await expect(hp.locator(".p-answer-text")).toBeVisible();
  await hp.click("[data-cmd=revealFinal]");
  await hp.click("[data-cmd=judge][data-house='0'][data-right='1']");
  await hp.click("[data-cmd=judge][data-house='2'][data-right='0']");
  await hp.click("[data-cmd=finishFinal]");
  await expect(host.locator(".splash-title")).toContainText("Gryffindor");
  expect(await host.evaluate(() => state.scores.slice())).toEqual([35, 0, -2, 0]);
  await expect(hp.getByText("Game over")).toBeVisible();
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

  const key = await host.evaluate(() => net.hostKey);
  await host.reload();
  await host.click("[data-action=resume]");
  expect(await host.evaluate(() => net.code)).toBe(code);
  expect(await host.evaluate(() => net.hostKey)).toBe(key);
  expect(await host.evaluate(() => Object.keys(net.ids).length)).toBe(2);
  await expect(mao.locator(".p-house")).toBeVisible();

  // Cut this phone off: it should say it's reconnecting, then recover.
  await mao.evaluate(() => { window.__mockOffline = true; });
  await expect(mao.getByText("Reconnecting to the game…")).toBeVisible({ timeout: 15000 });
  await mao.evaluate(() => { window.__mockOffline = false; });
  await expect(mao.getByText("Reconnecting to the game…")).toHaveCount(0, { timeout: 15000 });
  expect(errors).toEqual([]);
});
