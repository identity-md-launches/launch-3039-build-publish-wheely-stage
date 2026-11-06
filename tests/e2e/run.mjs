// End-to-end checks against the built dist/, served at a gateway-style subpath, with the status
// API mocked so every state can be forced. Usage: npm run build && npm run test:e2e
// BROWSER=webkit runs the same suite in WebKit. API_LIVE=1 adds one read of the real API.
import { chromium, webkit } from "playwright";
import { API, mockApi, serveDist, statusBody } from "./harness.mjs";

const engine = process.env.BROWSER === "webkit" ? webkit : chromium;
const site = await serveDist();
const browser = await engine.launch();
const results = [];

async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok    ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function open(path, body, { viewport = { width: 1280, height: 720 }, reduced = false, permissions } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? "reduce" : "no-preference", permissions });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    if (!r.url().startsWith(API)) problems.push(`requestfailed: ${r.url()}`);
  });
  const state = typeof body === "object" && body && "fail" in body ? body : { body };
  await mockApi(context, state);
  await page.goto(site.url + path);
  return { page, state, problems, close: () => context.close() };
}

const text = (page, field) => page.locator(`[data-field="${field}"]`).first().innerText();
const canvas = (page) => page.locator("canvas");
const waitMode = (page, mode) => page.locator(`canvas[data-mode="${mode}"]`).waitFor({ timeout: 6000 });
const pixels = (page) => page.evaluate(() => document.querySelector("canvas").toDataURL());
const idle = () => statusBody();
const active = (rpmMilli = 72000, speed = 690) => () => statusBody({ core: "ACTIVE", rpmMilli, speed });

await test("overlay: page background is transparent at every level", async () => {
  const { page, close } = await open("overlay/", idle);
  await waitMode(page, "idle");
  const backgrounds = await page.evaluate(() =>
    ["html", "body", "#root", "main"].map((s) => getComputedStyle(document.querySelector(s)).backgroundColor),
  );
  assert(backgrounds.every((b) => b === "rgba(0, 0, 0, 0)"), `backgrounds: ${backgrounds}`);
  const screenshot = await page.screenshot({ omitBackground: true, clip: { x: 1200, y: 5, width: 40, height: 40 } });
  // Fully transparent PNG region: decode in the page to read alpha.
  const alpha = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return Math.max(...ctx.getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 4 === 3));
  }, screenshot.toString("base64"));
  assert(alpha === 0, `corner alpha ${alpha}`);
  await close();
});

for (const [width, height] of [[1280, 720], [1920, 1080]]) {
  await test(`overlay: every module fits inside ${width}x${height} and scales`, async () => {
    const { page, problems, close } = await open("overlay/", idle, { viewport: { width, height } });
    await waitMode(page, "idle");
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll(".ov-canvas, .hud, .ticker")].map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.className, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
      }),
    );
    assert(boxes.length === 3, `modules: ${boxes.length}`);
    for (const b of boxes) assert(b.left >= 0 && b.top >= 0 && b.right <= width && b.bottom <= height, `${b.name} out of frame: ${JSON.stringify(b)}`);
    const stage = boxes.find((b) => b.name === "ov-canvas");
    assert(Math.abs(stage.width - (340 * width) / 1280) < 1, `stage width ${stage.width}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(overflow <= 0, `overflow ${overflow}`);
    assert(problems.length === 0, problems.join("; "));
    await close();
  });
}

await test("overlay: URL toggles remove modules, default all on", async () => {
  for (const [query, expected] of [
    ["", [1, 1, 1]],
    ["?hud=1&stage=1&ticker=1", [1, 1, 1]],
    ["?hud=0", [0, 1, 1]],
    ["?stage=0", [1, 0, 1]],
    ["?ticker=0", [1, 1, 0]],
    ["?hud=0&ticker=0", [0, 1, 0]],
  ]) {
    const { page, close } = await open(`overlay/${query}`, idle);
    await page.waitForTimeout(250);
    const counts = await Promise.all([".hud", ".ov-canvas", ".ticker"].map((s) => page.locator(s).count()));
    assert(counts.join() === expected.join(), `${query}: ${counts}`);
    await close();
  }
});

await test("overlay: IDLE shows badge, real numbers and a moving sleepy stage", async () => {
  const { page, problems, close } = await open("overlay/", idle);
  await waitMode(page, "idle");
  assert((await page.locator(".badge").innerText()) === "IDLE", "badge");
  assert((await text(page, "rpm")) === "0.0", "rpm");
  assert((await text(page, "km")) === "6.349", "km");
  assert((await text(page, "round")) === "367", "round");
  assert((await text(page, "block")) === "1,140", "block");
  assert((await page.locator(".chip").count()) === 0, "no chip while fresh");
  assert((await canvas(page).getAttribute("data-speed-lines")) === "0", "no speed lines");
  const before = await pixels(page);
  await page.waitForTimeout(600);
  assert(before !== (await pixels(page)), "breathing should animate");
  assert(problems.length === 0, problems.join("; "));
  await close();
});

await test("overlay: ACTIVE scales lines and sparks with rpmMilli and spin with speed", async () => {
  const state = { body: active(30000, 300) };
  const { page, close } = await open("overlay/", state.body);
  const live = await page.context();
  await waitMode(page, "active");
  assert((await page.locator(".badge").innerText()) === "ACTIVE", "badge");
  assert((await text(page, "rpm")) === "30.0", "rpm");
  const read = async () => ({
    lines: Number(await canvas(page).getAttribute("data-speed-lines")),
    sparks: Number(await canvas(page).getAttribute("data-sparks-per-second")),
    spin: Number(await canvas(page).getAttribute("data-wheel-degrees-per-second")),
  });
  const slow = await read();
  assert(Math.abs(slow.spin - (300 / 880) * 360) < 0.1, `spin ${slow.spin}`);
  await live.unroute(API);
  await mockApi(live, { body: active(100000, 880) });
  await page.locator('[data-field="rpm"]', { hasText: "100.0" }).waitFor({ timeout: 6000 });
  const fast = await read();
  assert(fast.lines > slow.lines && fast.sparks > slow.sparks && fast.spin > slow.spin, `${JSON.stringify({ slow, fast })}`);
  await live.unroute(API);
  await mockApi(live, { body: active(40000, 0) });
  await page.locator('[data-field="rpm"]', { hasText: "40.0" }).waitFor({ timeout: 6000 });
  assert((await read()).spin === 0, "speed 0 stops the wheel");
  await close();
});

await test("overlay: stale by age freezes numbers and stops all motion", async () => {
  const { page, state, close } = await open("overlay/", active(72000, 690));
  await waitMode(page, "active");
  state.body = () => statusBody({ core: "ACTIVE", rpmMilli: 99000, speed: 999, ageSeconds: 500, round: "400", block: "2000", distanceMm: 7000000 });
  await page.locator(".chip-stale").waitFor({ timeout: 6000 });
  assert((await page.locator(".chip").innerText()) === "STALE", "chip");
  assert((await text(page, "rpm")) === "72.0", "rpm frozen");
  assert((await text(page, "km")) === "6.349", "km frozen");
  assert((await text(page, "round")) === "367", "round frozen");
  assert((await canvas(page).getAttribute("data-mode")) === "frozen", "mode");
  const before = await pixels(page);
  await page.waitForTimeout(1000);
  assert(before === (await pixels(page)), "frame must not change while stale");
  await close();
});

await test("overlay: freshness != online shows STALE", async () => {
  const { page, close } = await open("overlay/", () => statusBody({ freshness: "stale" }));
  await page.locator(".chip-stale").waitFor({ timeout: 6000 });
  assert((await canvas(page).getAttribute("data-mode")) === "frozen", "mode");
  await close();
});

await test("overlay: network failure before any data shows OFFLINE and no numbers", async () => {
  const { page, close } = await open("overlay/", { fail: true });
  await page.locator(".chip-offline").waitFor({ timeout: 6000 });
  assert((await page.locator(".chip").innerText()) === "OFFLINE", "chip");
  for (const f of ["rpm", "km", "round", "block"]) assert((await text(page, f)) === "--", `${f} must stay empty`);
  assert((await page.locator(".badge").count()) === 0, "no ACTIVE/IDLE badge without data");
  assert((await canvas(page).getAttribute("data-mode")) === "closed", "curtains closed");
  await close();
});

await test("overlay: network failure after data freezes, then recovers on its own", async () => {
  const { page, state, close } = await open("overlay/", active(72000, 690));
  await waitMode(page, "active");
  state.fail = true;
  await page.locator(".chip-offline").waitFor({ timeout: 6000 });
  assert((await text(page, "rpm")) === "72.0", "rpm frozen");
  const before = await pixels(page);
  await page.waitForTimeout(800);
  assert(before === (await pixels(page)), "frame must not change while offline");
  state.fail = false;
  state.body = active(50000, 500);
  await page.locator('[data-field="rpm"]', { hasText: "50.0" }).waitFor({ timeout: 6000 });
  assert((await page.locator(".chip").count()) === 0, "chip clears");
  await close();
});

await test("overlay: HTTP 500 and malformed JSON both count as offline", async () => {
  const { page, state, close } = await open("overlay/", idle);
  await waitMode(page, "idle");
  state.code = 500;
  await page.locator(".chip-offline").waitFor({ timeout: 6000 });
  state.code = 200;
  state.body = { nope: true };
  await page.waitForTimeout(2500);
  assert((await page.locator(".chip-offline").count()) === 1, "malformed body stays offline");
  await close();
});

await test("overlay: settledThroughRound increase fires one flash and one caption", async () => {
  const { page, state, close } = await open("overlay/", idle);
  await waitMode(page, "idle");
  assert((await canvas(page).getAttribute("data-celebration")) === "0", "no celebration on load");
  assert((await page.locator('[data-testid="caption"]').count()) === 0, "no caption on load");
  state.body = () => statusBody({ round: "368", block: "1141" });
  await page.locator('[data-testid="caption"]').waitFor({ timeout: 6000 });
  const caption = await page.locator('[data-testid="caption"]').innerText();
  assert(/368/.test(caption), `caption: ${caption}`);
  assert((await canvas(page).getAttribute("data-celebration")) === "1", "one celebration");
  assert((await text(page, "round")) === "368", "round");
  state.body = () => statusBody({ round: "369", block: "1142" });
  await page.locator('[data-testid="caption"]', { hasText: "369" }).waitFor({ timeout: 6000 });
  const next = await page.locator('[data-testid="caption"]').innerText();
  assert(next.replace(/\d+/g, "#") !== caption.replace(/\d+/g, "#"), "caption line rotates");
  await close();
});

await test("overlay: missing builder.anchor keeps the last round without going offline", async () => {
  const { page, state, close } = await open("overlay/", idle);
  await waitMode(page, "idle");
  state.body = () => statusBody({ noAnchor: true });
  await page.waitForTimeout(2500);
  assert((await text(page, "round")) === "367", "round kept");
  assert((await page.locator(".chip").count()) === 0, "no chip");
  await close();
});

await test("overlay: bigint strings display exactly", async () => {
  const { page, close } = await open("overlay/", () => statusBody({ round: "9007199254740993", block: "9007199254740995" }));
  await waitMode(page, "idle");
  assert((await text(page, "round")) === "9,007,199,254,740,993", await text(page, "round"));
  assert((await text(page, "block")) === "9,007,199,254,740,995", await text(page, "block"));
  await close();
});

await test("overlay: polls about every 1.5 to 2 seconds", async () => {
  const { page, state, close } = await open("overlay/", idle);
  await page.waitForTimeout(1000);
  const start = state.hits;
  await page.waitForTimeout(7000);
  const perPoll = 7000 / (state.hits - start);
  assert(perPoll >= 1400 && perPoll <= 2100, `one poll per ${perPoll} ms`);
  await close();
});

await test("overlay: reduced motion draws a still frame", async () => {
  const { page, close } = await open("overlay/", active(90000, 800), { reduced: true });
  await waitMode(page, "active");
  await page.waitForTimeout(300);
  const before = await pixels(page);
  await page.waitForTimeout(700);
  assert(before === (await pixels(page)), "no animation under reduced motion");
  await close();
});

await test("overlay: contains no wallet, key or contract surface", async () => {
  const { page, close } = await open("overlay/", idle);
  await waitMode(page, "idle");
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const word of ["wallet", "connect", "private key", "contract", "claim"]) assert(!body.includes(word), word);
  await close();
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
  await test(`desk: no horizontal scroll and main action visible at ${width}`, async () => {
    const { page, problems, close } = await open("", idle, { viewport: { width, height } });
    await waitMode(page, "idle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(overflow <= 0, `overflow ${overflow}`);
    const box = await page.getByRole("button", { name: "Start race" }).boundingBox();
    if (height >= 844) assert(box.y + box.height <= height, `Start race bottom at ${box.y + box.height}`);
    assert(problems.length === 0, problems.join("; "));
    await close();
  });
}

await test("desk: live fields match the feed, offline and stale notices appear", async () => {
  const { page, state, close } = await open("", active(45678, 500));
  await waitMode(page, "active");
  assert((await text(page, "rpm")) === "45.7", "rpm");
  assert((await page.locator(".badge").innerText()) === "ACTIVE", "badge");
  state.fail = true;
  await page.locator(".chip-offline").waitFor({ timeout: 6000 });
  assert((await page.locator('[data-testid="notice"]').innerText()).includes("Unable to reach"), "notice");
  assert((await text(page, "rpm")) === "45.7", "frozen");
  await close();
});

await test("desk: ghost race runs by click and Space, moves only with real wheel distance, saves best", async () => {
  let distanceMm = 6_348_818;
  const { page, state, close } = await open("", () => statusBody({ core: "ACTIVE", rpmMilli: 60000, speed: 500, distanceMm }));
  await waitMode(page, "active");
  const position = (lane) => page.locator(".lane-track").nth(lane).getAttribute("data-position").then(Number);

  await page.getByRole("button", { name: "Start race" }).click();
  await page.getByRole("button", { name: "Run" }).waitFor();
  assert((await page.locator(".race").getAttribute("data-phase")) === "running", "running");

  // Three real clicks on the button
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Run" }).click();
    await page.waitForTimeout(380);
  }
  assert((await position(1)) > 0, "ghost moves");
  assert((await position(0)) === 0, "wheel lane holds until a new reading");

  // A real reading moves the wheel lane
  distanceMm += 3000;
  await page.waitForFunction(() => Number(document.querySelector(".lane-track").getAttribute("data-position")) > 0, null, { timeout: 6000 });
  const wheel = await position(0);
  assert(Math.abs(wheel - 3 / 30) < 0.001, `wheel lane ${wheel}`);

  // Finish on the keyboard, steady rhythm
  for (let i = 0; i < 80; i += 1) {
    if ((await page.locator(".race").getAttribute("data-phase")) !== "running") break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(380);
  }
  assert((await page.locator(".race").getAttribute("data-phase")) === "done", "heat finished");
  const result = await page.locator(".race-hint").innerText();
  assert(/You beat the wheel by .* Score \d+\. New best\./.test(result), result);
  const best = await page.evaluate(() => localStorage.getItem("wheely-stage.best-score"));
  assert(Number(best) > 300, `best ${best}`);
  assert((await page.locator(".race-best").innerText()).includes(`Best score: ${best}.`), "best shown");

  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Race again" }).click();
  assert((await page.locator(".race").getAttribute("data-phase")) === "running", "second heat");
  await page.reload();
  await waitMode(page, "active");
  assert((await page.locator(".race-best").innerText()).includes(`Best score: ${best}.`), "best survives reload");
  assert(state.hits > 0, "polled");
  await close();
});

await test("desk: a caption or offline notice does not move the Run button", async () => {
  const { page, state, close } = await open("", idle, { viewport: { width: 390, height: 844 } });
  await waitMode(page, "idle");
  const button = page.locator(".action");
  await button.click();
  const y = async () => (await button.boundingBox()).y;
  const before = await y();
  state.body = () => statusBody({ round: "368", block: "1141" });
  await page.locator('[data-testid="caption"]').waitFor({ timeout: 6000 });
  assert((await y()) === before, "caption moved the button");
  state.fail = true;
  await page.locator(".chip-offline").waitFor({ timeout: 6000 });
  assert((await y()) === before, "offline notice moved the button");
  await close();
});

await test("desk: mashing makes the ghost stumble with a visible message", async () => {
  const { page, close } = await open("", idle);
  await waitMode(page, "idle");
  await page.getByRole("button", { name: "Start race" }).click();
  await page.evaluate(() => {
    const b = document.querySelector(".action");
    for (let i = 0; i < 2; i += 1) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  });
  await page.locator(".race-hint", { hasText: "Stumbled" }).waitFor({ timeout: 2000 });
  await close();
});

await test("desk: a heat without a live signal is practice and saves nothing", async () => {
  const { page, close } = await open("", { fail: true });
  await page.locator(".chip-offline").waitFor({ timeout: 6000 });
  assert((await page.locator(".race-hint").innerText()).includes("practice"), "explains practice");
  await page.getByRole("button", { name: "Start race" }).click();
  assert((await page.locator(".lane-track").nth(0).getAttribute("data-position")) === "0.000", "wheel lane stays at 0");
  await close();
});

await test("desk: OBS panel builds, opens and copies the overlay URL", async () => {
  const { page, close } = await open("", idle, { permissions: engine === chromium ? ["clipboard-read", "clipboard-write"] : undefined });
  await waitMode(page, "idle");
  const url = page.locator('[data-testid="overlay-url"]');
  assert((await url.innerText()) === `${site.url}overlay/?hud=1&stage=1&ticker=1`, await url.innerText());
  await page.getByLabel("Show the ticker").uncheck();
  assert((await url.innerText()).endsWith("?hud=1&stage=1&ticker=0"), await url.innerText());
  await page.getByRole("button", { name: "Copy URL" }).click();
  await page.locator(".obs-copied").filter({ hasText: /Copied|Unable/ }).waitFor();
  if (engine === chromium) {
    assert((await page.evaluate(() => navigator.clipboard.readText())).endsWith("ticker=0"), "clipboard");
  }
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "Open the overlay" }).click()]);
  await popup.locator(".ov-canvas").waitFor({ timeout: 6000 });
  assert((await popup.locator(".ticker").count()) === 0, "ticker off in the opened URL");
  await close();
});

await test("desk: head tags for sharing, footer copy and keyboard focus", async () => {
  const { page, close } = await open("", idle);
  await waitMode(page, "idle");
  const meta = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    ogImage: document.querySelector('meta[property="og:image"]')?.content,
    icon: document.querySelector('link[rel="icon"]')?.getAttribute("href"),
  }));
  for (const [k, v] of Object.entries(meta)) assert(v, `${k} missing`);
  for (const file of [meta.ogImage, meta.icon]) {
    assert((await page.request.get(new URL(file, page.url()).href)).ok(), `${file} does not load`);
  }
  const footer = (await page.locator("footer").innerText()).toLowerCase();
  for (const part of ["community stream companion", "api.squeekchain.com", "not financial advice"]) assert(footer.includes(part), part);
  await page.keyboard.press("Tab");
  assert((await page.evaluate(() => document.activeElement?.textContent)) === "Set up OBS", "first tab stop");
  await page.keyboard.press("Tab");
  assert((await page.evaluate(() => document.activeElement?.textContent)) === "Start race", "second tab stop");
  await page.keyboard.press("Enter");
  assert((await page.locator(".race").getAttribute("data-phase")) === "running", "Enter starts the race");
  await close();
});

if (process.env.API_LIVE) {
  await test("live API: real data renders with no console errors", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const problems = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto(`${site.url}overlay/`);
    await page.waitForFunction(() => document.querySelector('[data-field="km"]')?.textContent !== "--", null, { timeout: 15000 });
    const values = await page.locator(".hud").innerText();
    console.log(`      ${values.replace(/\s+/g, " ")}`);
    await page.waitForTimeout(5000);
    assert(problems.length === 0, problems.join("; "));
    await context.close();
  });
}

await browser.close();
site.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed (${engine.name()})`);
process.exit(failed.length ? 1 : 0);
