// Runs the game from a local web server and tests it in Chromium.
// Set CHROME_PATH to use an installed Chrome instead of Playwright's own browser.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:8765",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  },
  webServer: {
    command: "python3 -m http.server 8765",
    port: 8765,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "ignore"
  }
});
