import { expect, test } from "@playwright/test";
import baseline from "../../app-store-screenshots.json";

test.describe("StoreCanvas editor", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.request.post("/api/project", { data: baseline });
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(900);
    await page.request.post("/api/project", { data: baseline });
  });

  test("loads the Rutmia campaign and exposes the core editing workflow", async ({ page }) => {
    await page.goto("/");
    const firstSlide = baseline.slidesByDevice.iphone[0];
    const initialLocale = baseline.locale as keyof typeof firstSlide.label;

    await expect(page.getByRole("heading", { name: "Screens" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "App name" })).toHaveValue("Rutmia");
    await expect(page.getByRole("button", { name: "Connected", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText(firstSlide.label[initialLocale]).first()).toBeVisible();
    await expect(page.getByRole("main").getByText(firstSlide.headline[initialLocale]).first()).toBeVisible();
    await expect(page.getByText("10 screens")).toBeVisible();
  });

  test("switches locale and edits the active headline", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("combobox", { name: "Locale" }).click();
    await page.getByRole("option", { name: "ES-MX" }).click();

    await expect(page.getByRole("main").getByText("Haz tuyo tu día.").first()).toBeVisible();
    await expect(page.getByLabel("Locale")).toContainText("ES-MX");
    await expect(page.getByLabel("Headline")).toHaveValue("Haz tuyo tu día.");
  });

  test("adds an editable text layer and keeps the export action available", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^Text$/ }).click();
    await expect(page.getByRole("main").getByText("New text").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled();
  });

  test("renders an exact-size export artboard", async ({ page }) => {
    await page.goto("/render?device=iphone&locale=en-US&size=1320x2868");

    const render = page.locator('[data-render-valid="true"]');
    await expect(render).toHaveAttribute("data-render-width", "1320");
    await expect(render.locator("[data-render-slide]")).toHaveCount(10);
    await expect(render.locator("[data-render-slide]").first()).toHaveJSProperty("clientWidth", 1320);
    await expect(render.locator("[data-render-slide]").first()).toHaveJSProperty("clientHeight", 2868);
  });

  test("server-renders editorial copy before the PNG renderer captures the slide", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const baseURL = test.info().project.use.baseURL as string;

    try {
      await page.goto(`${baseURL}/render?device=iphone&locale=es-MX&size=1320x2868`);
      const firstSlide = page.locator('[data-slide-id="rutmia-1-route"]');
      await expect(firstSlide.getByText("UNA RUTINA QUE VA CONTIGO")).toBeVisible();
      await expect(firstSlide.getByText("Haz tuyo tu día.")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("supports hiding and locking the selected canvas element", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Rotate element" }).first().click();
    await expect(page.getByRole("button", { name: "Hide element" })).toBeVisible();
    await page.getByRole("button", { name: "Hide element" }).click();
    await expect(page.getByRole("button", { name: "Show element" })).toBeVisible();
    await page.getByRole("button", { name: "Show element" }).click();
    await page.getByRole("button", { name: "Lock element" }).click();
    await expect(page.getByRole("button", { name: "Unlock element" })).toBeVisible();
  });

  test("applies a dimensional camera angle to the selected phone", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Rotate element" }).first().click();
    await expect(page.getByText("Camera angle")).toBeVisible();
    await page.getByRole("button", { name: "Apply left tilt angle" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].presentations?.device?.preset;
    }).toBe("tilt-left");
  });

  test("lets the user choose an iPhone hardware model", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Rotate element" }).first().click();
    await page.getByRole("combobox", { name: "Device model" }).click();
    await page.getByRole("option", { name: "iPhone 13 Pro Max" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].presentations?.device?.deviceModel;
    }).toBe("iphone-13-pro-max");
  });

  test("renders iPhone 17 Pro Max anatomy while editorial copy stays face-forward", async ({ page }) => {
    await page.goto("/render?device=iphone&locale=es-MX&size=1320x2868");

    const firstSlide = page.locator('[data-slide-id="rutmia-1-route"]');
    const frame = firstSlide.locator('[data-device-model="iphone-17-pro-max"]').first();
    await expect(frame.locator('[data-hardware-feature="dynamic-island"]')).toBeVisible();
    await expect(frame.locator("[data-hardware-button]")).toHaveCount(5);
    await expect(firstSlide.locator('[data-front-facing="caption"]').first()).toBeVisible();
  });

  test("renders a dimensional rig through an Android device frame", async ({ page }) => {
    const androidProject = JSON.parse(JSON.stringify(baseline));
    androidProject.slidesByDevice.android = [{
      ...androidProject.slidesByDevice.iphone[0],
      id: "android-dimensional-proof",
      presentations: {
        device: { preset: "tilt-right", rotateX: 4, rotateY: 22, perspective: 1350, depth: 18 },
      },
    }];
    await page.request.post("/api/project", { data: androidProject });
    await page.goto("/render?device=android&locale=en-US&size=1080x1920");

    const rig = page.locator('[data-device-type="android"][data-device-angle="tilt-right"]');
    await expect(rig).toBeVisible();
  });

  test("reused captures stay independent until transform linking is enabled", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Add device slot" }).click();
    await expect(page.getByText("Extra device 1").first()).toBeVisible();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].deviceSlots?.[0]?.linkedTransforms;
    }).toBe(false);

    await page.getByRole("button", { name: "Link extra device 1 transforms across screens" }).click();
    await page.getByRole("button", { name: "Repeat linked extra device 1 across 2 screens" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].deviceSlots?.[0];
    }).toMatchObject({ spanSlots: 2, linkedTransforms: true });
  });

  test("lets one large message continue across multiple connected slots", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Set message width to 2 screens" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].captionSpan;
    }).toBe(2);
  });

  test("preloads Rutmia with connected art, independent phones and message continuity", async ({ page }) => {
    await page.goto("/render?device=iphone&locale=es-MX&size=1320x2868");

    const captureStart = page.locator('[data-slide-id="rutmia-4-recovery"]');
    const messageStart = page.locator('[data-slide-id="rutmia-8-routine"]');
    await expect(captureStart).toHaveAttribute("data-render-mode", "connected");
    await expect(captureStart.locator('[data-connected-artwork="rutmia-dawn-ribbon"]')).toHaveCount(1);
    await expect(captureStart.locator('[data-device-slot="rutmia-recovery-continuity"]')).toHaveCount(1);
    await expect(page.locator('[data-slide-id="rutmia-5-reflection"] [data-device-slot="rutmia-reflection-independent"]')).toHaveCount(1);
    await expect(messageStart.locator('[data-caption-span="2"]')).toHaveCount(1);
    await expect(page.locator('[data-device-angle="tilt-left"]').first()).toHaveAttribute("data-device-rig", "optical");
  });

  test("template palette and placement overrides remain opt-in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Campaign wardrobe" }).click();
    await page.getByRole("button", { name: "Use template recommended palette" }).click();
    await page.getByRole("button", { name: "Reset built-in placement with template" }).click();
    await page.getByRole("button", { name: "Apply template Product cinema" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return {
        templateId: body.state.templateId,
        paletteId: body.state.paletteId,
        artworkStart: body.state.slidesByDevice.iphone.findIndex((slide: { connectedArtworks?: unknown[] }) => slide.connectedArtworks?.length),
        firstTransform: body.state.slidesByDevice.iphone[0].transforms,
      };
    }).toEqual({ templateId: "product-cinema", paletteId: "midnight-pool", artworkStart: 3, firstTransform: undefined });
  });

  test("generates a two-screen artwork without storing the personal key", async ({ page }) => {
    await page.route("**/api/ai/image", async (route) => {
      const request = route.request().postDataJSON();
      expect(request).toMatchObject({ provider: "openai", model: "gpt-image-2", apiKey: "sk-artwork-ui-test" });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, path: "/screenshots/uploaded/generated-seam.png" }),
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: /Screen 4 · Device top/ }).click();
    await page.getByRole("combobox", { name: "Artwork image provider" }).click();
    await page.getByRole("option", { name: "OpenAI" }).click();
    await page.getByRole("textbox", { name: "Artwork OpenAI API key" }).fill("sk-artwork-ui-test");
    await page.getByRole("button", { name: "Generate connected artwork 1" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[3].connectedArtworks[0].image;
    }).toBe("/screenshots/uploaded/generated-seam.png");
    const saved = await (await page.request.get("/api/project")).text();
    expect(saved).not.toContain("sk-artwork-ui-test");
  });

  test("links localized copy across iPhone and iPad when the user enables continuity", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Link copy across devices" }).click();
    await page.getByLabel("Headline").fill("One promise everywhere.");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "iPad" }).click();

    await expect(page.getByLabel("Headline")).toHaveValue("One promise everywhere.");
  });

  test("changes Rutmia's campaign style without replacing its captures", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Campaign wardrobe" }).click();
    await expect(page.getByRole("heading", { name: "Campaign wardrobe" })).toBeVisible();
    await page.getByRole("button", { name: "Apply template Afterglow rhythm" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.templateId;
    }).toBe("afterglow-rhythm");

    await page.getByRole("tab", { name: "Palettes" }).click();
    await page.getByRole("button", { name: "Apply palette Rutmia afterglow" }).click();

    await expect.poll(async () => {
      const saved = await page.request.get("/api/project");
      const body = await saved.json();
      return body.state.paletteId;
    }).toBe("rutmia-afterglow");

    const response = await page.request.get("/api/project");
    const body = await response.json();
    expect(body.state.paletteId).toBe("rutmia-afterglow");
    expect(body.state.slidesByDevice.iphone[0]).toMatchObject({
      screenshot: "/screenshots/apple/iphone/{locale}/home.png",
      assetRef: "capture:home-dashboard",
    });
  });

  test("tunes campaign colors directly without replacing Rutmia's captures", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Campaign wardrobe" }).click();
    await page.getByRole("tab", { name: "Tune" }).click();
    await page.getByRole("textbox", { name: "Accent hex color" }).fill("#2F6BFF");
    await page.getByRole("button", { name: "Apply custom colors" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.brand.colors.accent;
    }).toBe("#2F6BFF");

    const response = await page.request.get("/api/project");
    const body = await response.json();
    expect(body.state.paletteId).toBe("custom");
    expect(body.state.slidesByDevice.iphone[0]).toMatchObject({
      screenshot: "/screenshots/apple/iphone/{locale}/home.png",
      assetRef: "capture:home-dashboard",
    });
  });

  test("renders Rutmia's native iPad campaign at App Store size", async ({ page }) => {
    await page.goto("/render?device=ipad&locale=en-US&size=2064x2752");

    const render = page.locator('[data-render-valid="true"]');
    await expect(render).toHaveAttribute("data-render-width", "2064");
    await expect(render.locator("[data-render-slide]")).toHaveCount(6);
    await expect(render.locator("[data-render-slide]").first()).toHaveJSProperty("clientWidth", 2064);
    await expect(render.locator("[data-render-slide]").first()).toHaveJSProperty("clientHeight", 2752);
  });

  test("opens an AI polish workspace that keeps a personal key out of project storage", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "AI polish" })).toBeVisible({ timeout: 2_000 });
    await page.getByRole("button", { name: "AI polish" }).click();
    await expect(page.getByRole("heading", { name: "AI polish" })).toBeVisible();
    await expect(page.getByText("never saved in StoreCanvas")).toBeVisible();
  });

  test("reviews AI copy before applying it without changing Rutmia's capture", async ({ page }) => {
    await page.route("**/api/ai/improve", async (route) => {
      const request = route.request().postDataJSON();
      expect(request).toMatchObject({
        provider: "openai",
        appName: "Rutmia",
        locale: "en-US",
      });
      expect(JSON.stringify(request)).not.toContain("/screenshots/");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          proposal: {
            summary: "Lead with ownership, then let the product prove it.",
            slides: [
              {
                id: "rutmia-1-route",
                label: "YOUR DAY, YOUR WAY",
                headline: "Make today yours.",
                rationale: "It is short, outcome-led and easy to read at thumbnail size.",
              },
            ],
          },
        }),
      });
    });
    await page.goto("/");
    await page.getByRole("combobox", { name: "Locale" }).click();
    await page.getByRole("option", { name: "EN-US" }).click();
    await page.getByRole("button", { name: "AI polish" }).click();
    await page.getByRole("textbox", { name: "Personal API key" }).fill("sk-test-key-for-ui");
    await page.getByRole("button", { name: "Generate suggestions" }).click();
    await expect(page.getByText("Make today yours.")).toBeVisible();
    await page.getByRole("button", { name: "Apply 1 suggestion" }).click();

    await expect(page.getByRole("main").getByText("Make today yours.").first()).toBeVisible();
    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].headline["en-US"];
    }).toBe("Make today yours.");
    const response = await page.request.get("/api/project");
    const body = await response.json();
    expect(body.state.slidesByDevice.iphone[0]).toMatchObject({
      headline: { "en-US": "Make today yours." },
      screenshot: "/screenshots/apple/iphone/{locale}/home.png",
      assetRef: "capture:home-dashboard",
    });
  });
});
