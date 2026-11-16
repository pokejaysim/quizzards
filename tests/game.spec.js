// Pass-and-play: one screen, no phones.
const { test, expect } = require("@playwright/test");
const { sortPlayers } = require("./helpers");

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => { throw e; });
  await page.goto("/index.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function scores(page) {
  return page.evaluate(() => state.scores.slice());
}

test("sort, answer a question, undo, and fix a score", async ({ page }) => {
  await sortPlayers(page, "Ana, Ben, Cal, Dee");
  await expect(page.locator(".turn-banner")).toBeVisible();

  await page.locator(".tile").nth(18).click(); // a 4-point tile
  await expect(page.locator(".question")).toBeVisible();
  await expect(page.locator("#h-timer")).toBeVisible();

  await page.click("[data-action=reveal]");
  await expect(page.locator("#h-timer")).toHaveCount(0);
  const team = await page.locator(".btn.house").first().getAttribute("data-team");
  await page.locator(".btn.house").first().click();
  const after = await scores(page);
  expect(after[+team]).toBe(4);
  await expect(page.locator(".tile.used")).toHaveCount(1);

  // Undo goes back to the award buttons with the score removed.
  await page.click("header [data-action=undo]");
  expect((await scores(page))[+team]).toBe(0);
  await expect(page.locator(".btn.house").first()).toBeVisible();
  await page.locator("[data-action=award][data-team='-1']").click();

  // Fix a score by hand from the menu.
  await page.click("[data-action=openMenu]");
  await page.locator(`[data-action=adjust][data-house='${team}'][data-d='5']`).click();
  await expect(page.locator(".modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
  expect((await scores(page))[+team]).toBe(5);
});

test("the timer counts down, pauses and can be turned off", async ({ page }) => {
  await sortPlayers(page, "Ana, Ben");
  await page.locator(".tile").first().click();
  const num = page.locator("#h-timer .timer-num");
  await expect(num).toHaveText(/0:(29|30)/);
  await page.click("[data-action=timerPause]");
  await expect(num).toContainText("Paused");
  const pausedText = await num.textContent();
  await page.waitForTimeout(1300);
  expect(await num.textContent()).toBe(pausedText);
  await page.click("[data-action=timerAdd]");
  await page.click("[data-action=timerPause]");
  await expect(num).not.toContainText("Paused");

  // Force the clock to run out.
  await page.evaluate(() => { state.timerEnd = Date.now() + 300; });
  await expect(num).toHaveText("Time’s up!");

  await page.click("[data-action=back]");
  await page.click("[data-action=openMenu]");
  await page.click("[data-action=setTimer][data-val='0']");
  await page.click("[data-action=closeMenu]");
  await page.locator(".tile").first().click();
  await expect(page.locator("#h-timer")).toHaveCount(0);
});

test("a reload offers to resume the game exactly where it was", async ({ page }) => {
  await sortPlayers(page, "Ana, Ben, Cal");
  await page.locator(".tile").nth(30).click();
  await page.click("[data-action=reveal]");
  await page.locator(".btn.house").first().click();
  const before = await scores(page);
  const turn = await page.evaluate(() => state.turn);

  await page.reload();
  await expect(page.getByText("Pick up where you left off?")).toBeVisible();
  await page.click("[data-action=resume]");
  await expect(page.locator(".tile.used")).toHaveCount(1);
  expect(await scores(page)).toEqual(before);
  expect(await page.evaluate(() => state.turn)).toBe(turn);

  // Starting new instead keeps the player list but drops the old game.
  await page.reload();
  await page.click("[data-action=discardSave]");
  await expect(page.locator(".name-chip")).toHaveCount(3);
});

test("the final question crowns a winner and undo can reopen judging", async ({ page }) => {
  await sortPlayers(page, "Ana, Ben");
  await page.click("[data-action=startFinal]");
  const inputs = page.locator("[data-wager]");
  await inputs.nth(0).fill("10");
  await inputs.nth(1).fill("3");
  await page.click("[data-action=lockWagers]");
  await expect(page.locator("#h-timer")).toBeVisible();
  await page.click("[data-action=revealFinal]");
  await page.locator("[data-right='1']").nth(0).click();
  await page.locator("[data-right='0']").nth(1).click();
  await page.click("[data-action=finishFinal]");
  await expect(page.locator(".splash-title")).toBeVisible();
  await page.click("[data-action=closeSplash]");
  await expect(page.locator(".winner-text")).toContainText("wins the House Cup");

  await page.click("header [data-action=undo]");
  await expect(page.locator("[data-action=finishFinal]")).toBeVisible();
});
