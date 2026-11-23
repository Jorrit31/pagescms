/* Webstudio smoke test: the everyday client tasks, start to finish.
 *
 * Runs against a CMS started with the fake GitHub (github-mock.cjs) and a
 * client seeded by seed.mjs. See README.md in this folder. Exits with 1 when
 * something a client relies on is broken, so a pull request turns red.
 */
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const SITE = process.env.SMOKE_SITE_DIR;
const SITE_PATH = `/${process.env.SMOKE_OWNER || "webstudio"}/${process.env.SMOKE_REPO || "testsite"}/main`;
const COOKIE = fs.readFileSync(process.env.SMOKE_COOKIE_FILE, "utf8").trim();
const SHOTS = process.env.SMOKE_SCREENSHOTS || "";
const TIMEOUT = 120_000;

const results = [];
const step = async (name, fn) => {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}\n    ${String(error?.message || error).split("\n").slice(0, 6).join("\n    ")}`);
  }
};
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const readHome = () => JSON.parse(fs.readFileSync(path.join(SITE, "content/home.json"), "utf8"));

const newContext = async (browser, options) => {
  const context = await browser.newContext({ ...options, locale: "nl-NL" });
  // The first-time tour ("rondleiding") is tested by hand; here it would cover the buttons.
  await context.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (/rondleiding|tour/i.test(String(key))) return original.call(this, key) ?? "1";
      return original.call(this, key);
    };
  });
  await context.addCookies([{ name: "better-auth.session_token", value: encodeURIComponent(COOKIE), domain: new URL(BASE).hostname, path: "/" }]);
  return context;
};

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const pageErrors = [];

  console.log("Computer");
  const desktop = await newContext(browser, { viewport: { width: 1400, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await step("Startscherm opent, zonder GitHub of Pages CMS", async () => {
    await page.goto(`${BASE}${SITE_PATH}/start`, { timeout: TIMEOUT });
    await page.getByText("Wat wil je vandaag aanpassen?").waitFor();
    const text = await page.locator("body").innerText();
    expect(!/github/i.test(text), "Het woord GitHub staat op het scherm van de klant.");
    expect(!/pages ?cms/i.test(text), "Het woord Pages CMS staat op het scherm van de klant.");
    await shot(page, "1-start");
  });

  await step("Tekst aanpassen en opslaan komt in het bestand", async () => {
    const nieuw = `Smoke test ${Date.now()}`;
    await page.goto(`${BASE}${SITE_PATH}/file/home`, { timeout: TIMEOUT });
    const field = page.getByLabel("Titel in Google", { exact: false }).first();
    await field.waitFor();
    await field.fill(nieuw);
    await page.getByRole("button", { name: "Opslaan", exact: true }).first().click();
    // On the live version the CMS first shows what changes ("Weet je het zeker?").
    const confirm = page.getByRole("button", { name: /Ja, zet live/ });
    if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) await confirm.click();
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && readHome()?.seo?.titel !== nieuw) await page.waitForTimeout(500);
    expect(readHome()?.seo?.titel === nieuw, `content/home.json heeft niet de nieuwe titel (staat: ${readHome()?.seo?.titel}).`);
    await shot(page, "2-opgeslagen");
  });

  await step("Foto die nog gebruikt wordt: waarschuwing voor verwijderen", async () => {
    await page.goto(`${BASE}${SITE_PATH}/media/default`, { timeout: TIMEOUT });
    await page.getByText("bloem.jpg", { exact: true }).waitFor();
    await page.getByText("bloem.jpg", { exact: true }).locator("xpath=ancestor::*[.//button][1]").getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Verwijderen" }).click();
    await page.getByText("Deze foto staat nog op je website:").waitFor({ timeout: 30_000 });
    const dialog = await page.getByRole("alertdialog").innerText();
    expect(/Website: teksten en foto's/.test(dialog), `De waarschuwing noemt de pagina niet: ${dialog}`);
    await shot(page, "3-foto-in-gebruik");
    await page.getByRole("button", { name: "Annuleren" }).click();
    expect(fs.existsSync(path.join(SITE, "public/img/bloem.jpg")), "bloem.jpg is toch verwijderd.");
  });

  await step("Foto die niet gebruikt wordt: gewoon verwijderen", async () => {
    await page.getByText("los.jpg", { exact: true }).locator("xpath=ancestor::*[.//button][1]").getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Verwijderen" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes("Even kijken of deze foto"), null, { timeout: 30_000 });
    expect(!(await dialog.innerText()).includes("staat nog op"), "Waarschuwing bij een foto die nergens staat.");
    await dialog.getByRole("button", { name: "Verwijderen" }).click();
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && fs.existsSync(path.join(SITE, "public/img/los.jpg"))) await page.waitForTimeout(500);
    expect(!fs.existsSync(path.join(SITE, "public/img/los.jpg")), "los.jpg is niet verwijderd.");
  });

  console.log("Telefoon");
  const phone = await newContext(browser, { ...devices["iPhone 13"] });
  const mobile = await phone.newPage();
  mobile.setDefaultTimeout(TIMEOUT);
  mobile.on("pageerror", (error) => pageErrors.push(error.message));

  await step("Telefoon: startscherm met de dagelijkse klussen", async () => {
    await mobile.goto(`${BASE}${SITE_PATH}/start`, { timeout: TIMEOUT });
    await mobile.getByText(/Tekst of prijs aanpassen/).first().waitFor();
    await mobile.getByText(/Foto vervangen/).first().waitFor();
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(!overflow, "Het startscherm is breder dan de telefoon.");
    await shot(mobile, "4-telefoon-start");
  });

  await step("Telefoon: bewerken opent met de balk Bewerken / Voorbeeld / Opslaan", async () => {
    await mobile.goto(`${BASE}${SITE_PATH}/file/home`, { timeout: TIMEOUT });
    await mobile.getByLabel("Titel in Google", { exact: false }).first().waitFor();
    await mobile.getByRole("tab", { name: "Bewerken", exact: true }).waitFor();
    await mobile.getByRole("tab", { name: "Voorbeeld", exact: true }).waitFor();
    await mobile.getByRole("button", { name: /^(Opslaan|Opgeslagen)$/ }).last().waitFor();
    await shot(mobile, "5-telefoon-bewerken");
  });

  console.log("Website (openbaar)");
  await step("Bezoekersteller antwoordt 204", async () => {
    const response = await fetch(`${BASE}/api/stats${SITE_PATH.replace(/\/main$/, "")}`, {
      method: "POST", body: JSON.stringify({ p: "/" }),
      headers: { "content-type": "text/plain", "user-agent": "Mozilla/5.0 Smoke", origin: "https://www.example.com" },
    });
    expect(response.status === 204, `Teller gaf ${response.status}.`);
  });

  await step("Geen fouten in de pagina's", async () => {
    const real = pageErrors.filter((message) => !/ResizeObserver loop/.test(message));
    expect(real.length === 0, real.join("\n"));
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} van ${results.length} stappen mislukt.` : `\nAlles goed: ${results.length} stappen.`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
