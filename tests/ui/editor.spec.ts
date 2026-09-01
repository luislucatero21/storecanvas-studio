import { expect, test, type Page } from "@playwright/test";
import baseline from "../../example-project.json";
import { buildCampaignImportProposal, type AppStoreListing } from "../../src/lib/app-store-import";

async function gotoRender(page: Page, url: string) {
  await expect.poll(async () => (await page.request.get(url)).status(), { timeout: 15_000 }).toBe(200);
  await page.goto(url);
}

function firstDeviceEditor(page: Page) {
  return page.locator(".rnd-editable").filter({ has: page.locator("[data-device-model]") }).first();
}

async function waitForStableBox(locator: ReturnType<Page["locator"]>) {
  let previous: { x: number; y: number; width: number; height: number } | null = null;
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box) return "missing";
        const current = { x: box.x, y: box.y, width: box.width, height: box.height };
        const stable = previous &&
          Math.abs(current.x - previous.x) < 0.25 &&
          Math.abs(current.y - previous.y) < 0.25 &&
          Math.abs(current.width - previous.width) < 0.25 &&
          Math.abs(current.height - previous.height) < 0.25;
        previous = current;
        return stable ? "stable" : "moving";
      },
      { timeout: 5_000, intervals: [100, 150, 250] },
    )
    .toBe("stable");
}

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

  test("loads the example campaign and exposes the core editing workflow", async ({ page }) => {
    await page.goto("/");
    const firstSlide = baseline.slidesByDevice.iphone[0];
    const initialLocale = baseline.locale as keyof typeof firstSlide.label;

    await expect(page.getByRole("heading", { name: "Screens" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "App name" })).toHaveValue("Ledgerly");
    await expect(page.getByRole("button", { name: "Connected", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText(firstSlide.label[initialLocale]).first()).toBeVisible();
    await expect(page.getByRole("main").getByText(firstSlide.headline[initialLocale]).first()).toBeVisible();
    await expect(page.getByText("10 screens")).toBeVisible();
  });

  test("keeps the canvas usable and exposes every editor panel on mobile", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");

      await expect(page.getByTestId("mobile-editor-nav")).toBeVisible();
      const layout = await page.evaluate(() => {
        const main = document.querySelector("main");
        const exportButton = document.querySelector('button[title^="Export selected sizes"]');
        const exportBox = exportButton?.getBoundingClientRect();
        return {
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          canvasHeight: main?.getBoundingClientRect().height || 0,
          exportFits: !exportBox || exportBox.right <= window.innerWidth + 1,
          navTabHeights: [...document.querySelectorAll('[data-testid="mobile-editor-nav"] [role="tab"]')]
            .map((tab) => tab.getBoundingClientRect().height),
        };
      });
      expect(layout.horizontalOverflow).toBe(false);
      expect(layout.canvasHeight).toBeGreaterThan(200);
      expect(layout.exportFits).toBe(true);
      expect(layout.navTabHeights.every((height) => height >= 40)).toBe(true);

      await page.getByRole("tab", { name: "Screens", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Screens", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Settings", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Screen settings", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Canvas", exact: true }).click();
      await expect(page.locator(".store-canvas-well")).toBeVisible();
    }
  });

  test("keeps both panels inside a small desktop window and lets the user dock them", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");

    const workspace = page.locator(".editor-workspace");
    await expect(workspace.locator('[data-editor-panel="screens"]')).toBeVisible();
    await expect(workspace.locator('[data-editor-panel="settings"]')).toBeVisible();
    const initialLayout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>(".editor-workspace");
      const screens = document.querySelector<HTMLElement>('[data-editor-panel="screens"]');
      const settings = document.querySelector<HTMLElement>('[data-editor-panel="settings"]');
      const canvas = document.querySelector<HTMLElement>("[data-editor-canvas]");
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        workspaceWidth: workspace?.getBoundingClientRect().width || 0,
        screensWidth: screens?.getBoundingClientRect().width || 0,
        settingsWidth: settings?.getBoundingClientRect().width || 0,
        canvasWidth: canvas?.getBoundingClientRect().width || 0,
      };
    });
    expect(initialLayout.overflow).toBe(false);
    expect(initialLayout.workspaceWidth).toBeGreaterThan(0);
    expect(initialLayout.screensWidth).toBeGreaterThan(150);
    expect(initialLayout.settingsWidth).toBeGreaterThan(190);
    expect(initialLayout.canvasWidth).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Workspace panels" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Settings panel" }).click();
    await expect(workspace.locator('[data-editor-panel="settings"]')).toBeHidden();

    await page.getByRole("button", { name: "Workspace panels" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Settings panel" }).click();
    await page.getByRole("button", { name: "Workspace panels" }).click();
    await page.getByRole("menuitem", { name: /Settings left · Screens right/ }).click();
    await expect(workspace).toHaveAttribute("data-panel-order", "settings-left");
    const reordered = await page.evaluate(() => {
      const screens = document.querySelector<HTMLElement>('[data-editor-panel="screens"]');
      const settings = document.querySelector<HTMLElement>('[data-editor-panel="settings"]');
      return { screensLeft: screens?.getBoundingClientRect().left || 0, settingsLeft: settings?.getBoundingClientRect().left || 0 };
    });
    expect(reordered.settingsLeft).toBeLessThan(reordered.screensLeft);
  });

  test("imports a private project and switches local campaigns from the visible selector", async ({ page }) => {
    await page.goto("/");
    const projectMenu = page.getByRole("button", { name: "Project menu" });
    await projectMenu.click();
    await expect(page.getByText("Local projects")).toBeVisible();

    const imported = { ...baseline, appName: "Imported campaign" };
    await page.getByLabel("Import project JSON").setInputFiles({
      name: "private-campaign.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imported)),
    });
    await expect(projectMenu).toContainText("Imported campaign");
    await expect(page.getByLabel("App name")).toHaveValue("Imported campaign");

    await projectMenu.click();
    await page.getByRole("menuitem", { name: /Ledgerly/ }).click();
    await expect(page.getByLabel("App name")).toHaveValue("Ledgerly");
    await expect(page.getByRole("button", { name: "Project menu" })).toContainText("Ledgerly");
  });

  test("auto-loads the local private campaign discovered by the local server", async ({ page }) => {
    const localCampaign = {
      ...baseline,
      appName: "Local campaign",
      campaignSource: {
        provider: "app-store" as const,
        appId: "1234567890",
        sourceUrl: "https://apps.apple.com/mx/app/demo/id1234567890",
        country: "mx",
        screenshotPolicy: "reference-only" as const,
      },
    };
    await page.route("**/api/project*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, state: localCampaign, persisted: "browser", source: "local-private-file" }),
      });
    });
    await page.goto("/");

    await expect(page.getByLabel("App name")).toHaveValue("Local campaign");
    await expect(page.getByRole("button", { name: "Project menu" })).toContainText("Local campaign");
  });

  test("refreshes a stale local campaign panorama from the project file", async ({ page }) => {
    const cached = JSON.parse(JSON.stringify(baseline));
    cached.appName = "Local campaign";
    cached.campaignSource = {
      provider: "app-store",
      appId: "1234567890",
      sourceUrl: "https://apps.apple.com/mx/app/demo/id1234567890",
      country: "mx",
      screenshotPolicy: "reference-only",
    };
    cached.slidesByDevice.iphone[0].connectedArtworks[0].spanSlots = 2;
    cached.slidesByDevice.iphone[0].connectedArtworks[0].transform.width = 2640;

    const expanded = JSON.parse(JSON.stringify(cached));
    expanded.slidesByDevice.iphone[0].connectedArtworks[0].id = "local-campaign-panorama";
    expanded.slidesByDevice.iphone[0].connectedArtworks[0].spanSlots = 10;
    expanded.slidesByDevice.iphone[0].connectedArtworks[0].transform.width = 13200;

    await page.goto("/");
    const projectMenu = page.getByRole("button", { name: "Project menu" });
    await projectMenu.click();
    await page.getByLabel("Import project JSON").setInputFiles({
      name: "local-campaign-cached.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(cached)),
    });
    await expect(page.getByLabel("App name")).toHaveValue("Local campaign");

    await page.route("**/api/project*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      if (!route.request().url().includes("prefer=file")) {
        await route.continue();
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, state: expanded, persisted: "browser", source: "local-private-file" }),
      });
    });
    await page.reload();
    await expect(page.locator('.store-canvas-well [data-connected-artwork="local-campaign-panorama"]').first()).toHaveAttribute("data-artwork-span", "10");
  });

  test("configured project files override a stale browser project on reload", async ({ page }) => {
    await page.goto("/");
    const projectMenu = page.getByRole("button", { name: "Project menu" });
    await projectMenu.click();
    await page.getByLabel("Import project JSON").setInputFiles({
      name: "cached-campaign.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...baseline, appName: "Cached campaign" })),
    });
    await expect(page.getByLabel("App name")).toHaveValue("Cached campaign");

    const configuredCampaign = { ...baseline, appName: "Configured campaign" };
    await page.route("**/api/project*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, state: configuredCampaign, persisted: "browser", source: "configured-file" }),
      });
    });
    await page.reload();

    await expect(page.getByLabel("App name")).toHaveValue("Configured campaign");
    await expect(page.getByRole("button", { name: "Project menu" })).toContainText("Configured campaign");
  });

  test("restores the active local project after reload without importing again", async ({ page }) => {
    await page.goto("/");
    const projectMenu = page.getByRole("button", { name: "Project menu" });
    await projectMenu.click();

    await page.getByLabel("Import project JSON").setInputFiles({
      name: "local-campaign.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...baseline, appName: "Local campaign" })),
    });
    await expect(projectMenu).toContainText("Local campaign");
    await page.waitForTimeout(800);
    await page.reload();

    await expect(page.getByLabel("App name")).toHaveValue("Local campaign");
    await expect(page.getByRole("button", { name: "Project menu" })).toContainText("Local campaign");
  });

  test("switches locale and edits the active headline", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("combobox", { name: "Locale" }).click();
    await page.getByRole("option", { name: "ES-MX" }).click();

    await expect(page.getByRole("main").getByText("Entiende a dónde va tu dinero.").first()).toBeVisible();
    await expect(page.getByLabel("Locale")).toContainText("ES-MX");
    await expect(page.getByLabel("Headline")).toHaveValue("Entiende a dónde va tu dinero.");
  });

  test("adds an editable text layer and keeps the export action available", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^Text$/ }).click();
    await expect(page.getByRole("main").getByText("New text").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled();
  });

  test("deletes a selected canvas layer with the Delete key and offers undo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Text$/ }).click();

    const text = page.getByRole("main").getByText("New text").first();
    const editable = text.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rnd-editable ")]');
    await expect(editable).toHaveCount(1);
    await text.click();
    const moveHandle = editable.getByRole("button", { name: "Move text" });
    await expect(moveHandle).toBeVisible();
    await moveHandle.click();
    await page.keyboard.press("Delete");

    await expect(page.getByRole("main").getByText("New text")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].textElements?.length || 0;
    }).toBe(0);
  });

  test("restores text typography, color and position after reopening the project", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Text$/ }).click();
    const text = page.getByRole("main").getByText("New text").first();
    const editable = text.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rnd-editable ")]');
    await text.click();
    const moveHandle = editable.getByRole("button", { name: "Move text" });
    const handleBox = await moveHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    const start = { x: handleBox!.x + handleBox!.width / 2, y: handleBox!.y + handleBox!.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 24, start.y + 14, { steps: 5 });
    await page.mouse.up();
    await waitForStableBox(editable);
    await page.getByLabel("Text size").fill("88");
    await page.getByLabel("Text color").fill("#123456");

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].textElements?.[0];
    }).toMatchObject({ fontSize: 88, color: "#123456" });
    const before = await (await page.request.get("/api/project")).json();
    const beforeElement = before.state.slidesByDevice.iphone[0].textElements[0];

    await page.reload();
    await expect(page.getByRole("main").getByText("New text").first()).toBeVisible();
    const reopened = page.getByRole("main").getByText("New text").first();
    await reopened.click();
    await expect(page.getByLabel("Text size")).toHaveValue("88");
    await expect(page.getByLabel("Text color")).toHaveValue("#123456");
    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].textElements?.[0].transform;
    }).toEqual(beforeElement.transform);
  });

  test("defaults to Apple's global export size and lets the user opt into more targets", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Export sizes for iPhone" }).click();
    await expect(page.getByRole("heading", { name: "Export sizes · iPhone" })).toBeVisible();
    const globalSize = page.getByRole("checkbox", { name: /Export 6\.9/ });
    const nextSize = page.getByRole("checkbox", { name: /Export 6\.5/ });
    await expect(globalSize).toHaveAttribute("aria-checked", "true");
    await expect(nextSize).toHaveAttribute("aria-checked", "false");

    await nextSize.click();
    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.exportSizeIds.iphone;
    }).toEqual(["iphone-6.9", "iphone-6.5"]);

    await globalSize.click();
    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.exportSizeIds.iphone;
    }).toEqual(["iphone-6.5"]);

    await page.getByRole("button", { name: "Apple default" }).click();
    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.exportSizeIds.iphone;
    }).toEqual(["iphone-6.9"]);
  });

  test("renders an exact-size export artboard", async ({ page }) => {
    await gotoRender(page, "/render?source=example&device=iphone&locale=en-US&size=1320x2868");

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
      await gotoRender(page, `${baseURL}/render?source=example&device=iphone&locale=es-MX&size=1320x2868`);
      const firstSlide = page.locator('[data-slide-id="demo-1-route"]');
      await expect(firstSlide.getByText("DINERO, A LA VISTA").first()).toBeVisible();
      await expect(firstSlide.getByText("Entiende a dónde va tu dinero.").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("supports hiding and locking the selected canvas element", async ({ page }) => {
    await page.goto("/");

    await firstDeviceEditor(page).getByRole("button", { name: "Rotate element" }).click();
    await expect(page.getByRole("button", { name: "Hide element" })).toBeVisible();
    await page.getByRole("button", { name: "Hide element" }).click();
    await expect(page.getByRole("button", { name: "Show element" })).toBeVisible();
    await page.getByRole("button", { name: "Show element" }).click();
    await page.getByRole("button", { name: "Lock element" }).click();
    await expect(page.getByRole("button", { name: "Unlock element" })).toBeVisible();
  });

  test("applies a dimensional camera angle to the selected phone", async ({ page }) => {
    await page.goto("/");

    await firstDeviceEditor(page).getByRole("button", { name: "Rotate element" }).click();
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

    await firstDeviceEditor(page).getByRole("button", { name: "Rotate element" }).click();
    await page.getByRole("combobox", { name: "Device model" }).click();
    await page.getByRole("option", { name: "iPhone 13 Pro Max" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].presentations?.device?.deviceModel;
    }).toBe("iphone-13-pro-max");
  });

  test("renders iPhone 17 Pro Max anatomy while editorial copy stays face-forward", async ({ page }) => {
    await gotoRender(page, "/render?source=example&device=iphone&locale=es-MX&size=1320x2868");

    const firstSlide = page.locator('[data-slide-id="demo-1-route"]');
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
    await page.goto("/render?source=browser&device=android&locale=en-US&size=1080x1920");

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

  test("preloads the finance example with connected art, single devices and message continuity", async ({ page }) => {
    await gotoRender(page, "/render?source=example&device=iphone&locale=es-MX&size=1320x2868");

    const opening = page.locator('[data-slide-id="demo-1-route"]');
    const paired = page.locator('[data-slide-id="demo-2-ai"]');
    const captureStart = page.locator('[data-slide-id="demo-4-recovery"]');
    const messageStart = page.locator('[data-slide-id="demo-8-routine"]');
    await expect(opening).toHaveAttribute("data-render-mode", "connected");
    await expect(opening.locator('[data-connected-artwork="ledgerly-opening-signal"]')).toHaveCount(1);
    await expect(opening.locator('[data-caption-span="2"]').first()).toBeVisible();
    await expect(paired.locator('[data-device-model="iphone-14-pro-max"]')).toHaveCount(0);
    await expect(paired.locator('[data-device-model="iphone-13-pro-max"]')).toHaveCount(0);
    await expect(paired.locator('[data-device-model="iphone-17-pro-max"]').first()).toBeVisible();
    await expect(captureStart).toHaveAttribute("data-render-mode", "connected");
    await expect(captureStart.locator('[data-connected-artwork="ledgerly-decision-signal"]')).toHaveCount(1);
    await expect(captureStart.locator("[data-device-slot]")).toHaveCount(0);
    await expect(captureStart.locator('[data-caption-span="2"]').first()).toBeVisible();
    await expect(messageStart.locator('[data-caption-span="2"]').first()).toBeVisible();
    await expect(page.locator('[data-device-angle="tilt-left"]').first()).toHaveAttribute("data-device-rig", "optical");
  });

  test("paints each shared demo caption once across its connected slots", async ({ page }) => {
    await gotoRender(page, "/render?source=example&device=iphone&locale=en-US&size=1320x2868");

    for (const headline of [
      "Know where your money is going.",
      "Make confident moves.",
      "Your money stays yours.",
    ]) {
      await expect(
        page.locator("[data-render-slide] [data-caption-headline]").filter({ hasText: headline }),
      ).toHaveCount(10);
    }
  });

  test("uses the full connected deck when rendering sidebar thumbnails", async ({ page }) => {
    await page.goto("/");
    const secondScreen = page.getByRole("button", { name: /Screen 2 ·/ });
    await expect(secondScreen.locator('[data-connected-artwork="ledgerly-opening-signal"]')).toHaveCount(1);
  });

  test("applies contrast to each slot of a shared example caption", async ({ page }) => {
    await page.goto("/render?source=example&device=iphone&locale=es-MX&size=1320x2868");

    const headline = page
      .locator('[data-slide-id="demo-8-routine"] [data-caption-headline]')
      .filter({ hasText: "Tu dinero sigue siendo tuyo." })
      .first();
    await expect(headline).toHaveAttribute("data-caption-contrast", "per-slot");
    await expect(headline).toHaveAttribute("data-caption-segment-colors", "#131B2C,#FFF9F0");
    await expect(headline).toHaveCSS("background-clip", "text");

    const continuationHeadline = page
      .locator('[data-slide-id="demo-9-reminders"] [data-caption-headline]')
      .filter({ hasText: "Tu dinero sigue siendo tuyo." })
      .first();
    await expect(continuationHeadline).toHaveAttribute("data-caption-segment-colors", "#131B2C,#FFF9F0");
  });

  test("samples a connected artwork instead of trusting an inverted slot hint", async ({ page }) => {
    const toneProject = JSON.parse(JSON.stringify(baseline));
    const lightArtwork = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2640" height="2868" viewBox="0 0 2640 2868"><rect width="1320" height="2868" fill="#F8EEDB"/><rect x="1320" width="1320" height="2868" fill="#D9E7F5"/></svg>',
    )}`;
    const first = toneProject.slidesByDevice.iphone[0];
    first.inverted = false;
    first.captionSpan = 2;
    first.connectedArtworks = [{
      id: "light-two-slot-artwork",
      image: lightArtwork,
      spanSlots: 2,
      opacity: 1,
      transform: { x: 0, y: 0, width: 2640, height: 2868 },
    }];
    first.textStyles = {
      ...(first.textStyles || {}),
      headline: {
        ...(first.textStyles?.headline || {}),
        color: "#FFFFFF",
        adaptiveColor: true,
      },
    };
    toneProject.slidesByDevice.iphone[1].inverted = true;

    await page.request.post("/api/project", { data: toneProject });
    await page.goto("/");

    const headline = page.locator('.store-canvas-well [data-caption-headline]').first();
    await expect.poll(
      async () => headline.getAttribute("data-caption-segment-colors"),
      { timeout: 8_000 },
    ).toMatch(/^#[0-9A-F]{6},#[0-9A-F]{6}$/i);
    const colors = (await headline.getAttribute("data-caption-segment-colors"))!.split(",");
    expect(colors).toHaveLength(2);
    expect(colors.every((color) => color.toUpperCase() !== "#FFFFFF")).toBe(true);
  });

  test("moves a shared caption by the pointer delta without jumping on drop", async ({ page }) => {
    const dragProject = JSON.parse(JSON.stringify(baseline));
    dragProject.slidesByDevice.iphone[7] = {
      ...dragProject.slidesByDevice.iphone[7],
      transforms: undefined,
      constraints: undefined,
    };
    await page.request.post("/api/project", { data: dragProject });
    await page.goto("/");
    await page.getByRole("button", { name: /Screen 8 ·/ }).click();
    await page.waitForTimeout(650);

    const caption = page
      .locator('.store-canvas-well [data-caption-span="2"]')
      .filter({ hasText: "Your money stays yours." })
      .first();
    const editable = caption.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rnd-editable ")]');
    await expect(editable).toHaveCount(1);
    await waitForStableBox(editable);
    const initial = await editable.boundingBox();
    expect(initial).not.toBeNull();

    await caption.locator("[data-caption-headline]").click();
    const moveHandle = editable.getByRole("button", { name: "Move text" });
    await expect(moveHandle).toBeVisible();
    const handle = await moveHandle.boundingBox();
    expect(handle).not.toBeNull();

    const delta = { x: 36, y: 18 };
    const start = { x: handle!.x + handle!.width / 2, y: handle!.y + handle!.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 });
    await page.mouse.up();
    await waitForStableBox(editable);

    const after = await editable.boundingBox();
    expect(after).not.toBeNull();
    const actualDelta = { x: after!.x - initial!.x, y: after!.y - initial!.y };
    expect(Math.abs(actualDelta.x - delta.x), `x moved ${actualDelta.x}px; expected ${delta.x}px`).toBeLessThan(4);
    expect(Math.abs(actualDelta.y - delta.y), `y moved ${actualDelta.y}px; expected ${delta.y}px`).toBeLessThan(4);
    expect(Math.abs(after!.width - initial!.width), "shared caption width changed after drag").toBeLessThan(2);
    expect(Math.abs(after!.height - initial!.height), "shared caption height changed after drag").toBeLessThan(2);
  });

  test("refits a shared caption when it returns to one screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Screen 8 ·/ }).click();
    await page.getByRole("button", { name: "Set message width to 1 screen" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      const slide = body.state.slidesByDevice.iphone[7];
      return { span: slide.captionSpan || 1, width: slide.transforms?.caption?.width || 1108.8 };
    }).toEqual({ span: 1, width: 1108.8 });
    const headline = page.locator('.store-canvas-well [data-caption-headline]').filter({ hasText: "Your money stays yours." }).first();
    await expect(headline).toHaveAttribute("data-caption-contrast", "single-slot");
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

  test("lets the user apply a campaign type direction and adaptive accent mode", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Campaign wardrobe" }).click();
    await page.getByRole("tab", { name: "Type", exact: true }).click();
    await expect(page.getByLabel("Display font")).toBeVisible();
    await expect(page.getByLabel("Display / headlines")).toHaveAttribute("data-typography-effective-family", "fraunces");
    await expect(page.getByLabel("Body / labels")).toHaveAttribute("data-typography-effective-family", "manrope");
    await expect(page.getByLabel("Body / labels")).toHaveAttribute("data-typography-effective-color", "#FF765D");
    await expect(page.getByLabel("Body / labels")).toContainText("Adaptive per surface");
    await page.getByLabel("Display font").click();
    await page.getByRole("option", { name: "Space Grotesk" }).click();
    await page.getByLabel("Adaptive accent color").uncheck();
    await page.getByRole("button", { name: "Apply typography" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return {
        family: body.state.brand.typography.display.family,
        accentMode: body.state.brand.accentMode,
      };
    }).toEqual({ family: "space-grotesk", accentMode: "fixed" });
  });

  test("exposes per-layer and per-caption typography overrides", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Text$/ }).click();
    await expect(page.getByLabel("Text styling")).toBeVisible();
    await expect(page.getByLabel("Text font")).toContainText("Manrope");
    await page.getByLabel("Text font").click();
    await page.getByRole("option", { name: "Space Grotesk" }).click();
    await page.getByLabel("Text font").click();
    await page.getByRole("option", { name: "Manrope" }).click();
    await page.getByLabel("Text weight").click();
    await page.getByRole("option", { name: "Heavy" }).click();
    await page.getByLabel("Italic text").click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].textElements?.[0];
    }).toMatchObject({ fontFamily: "manrope", fontWeight: 800, fontStyle: "italic" });

    await page.locator('.store-canvas-well [data-caption-headline]').first().click();
    await expect(page.getByLabel("Caption typography")).toBeVisible();
    await expect(page.getByLabel("Label / eyebrow font")).toContainText("Manrope");
    await expect(page.getByLabel("Headline font")).toContainText("Fraunces");
    const renderedHeadlineColor = await page.locator('.store-canvas-well [data-caption-headline]').first().getAttribute("data-caption-effective-color");
    expect(renderedHeadlineColor).toBeTruthy();
    await expect(page.locator('[aria-label="Headline rendered color"]')).toHaveAttribute(
      "data-typography-effective-color",
      renderedHeadlineColor!,
    );
    await page.getByLabel("Headline italic").click();
    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].textStyles?.headline?.style;
    }).toBe("italic");
  });

  test("generates a two-screen artwork without storing the personal key", async ({ page }) => {
    await page.route("**/api/ai/image", async (route) => {
      const request = route.request().postDataJSON();
      expect(request).toMatchObject({
        provider: "openai",
        model: "gpt-image-2",
        apiKey: "sk-artwork-ui-test",
        spanSlots: 2,
        tone: "mixed",
        tonePattern: ["dark", "light"],
      });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, path: "/screenshots/uploaded/generated-seam.png" }),
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: /Screen 4 ·/ }).click();
    await page.getByText("Seam artwork 1", { exact: true }).click();
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

  test("lets a connected background span the full ten-screen deck", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Screen 1 ·/ }).click();
    await page.getByText("Seam artwork 1", { exact: true }).click();
    await page.getByRole("combobox", { name: "Set connected artwork 1 span" }).click();
    await expect(page.getByRole("option", { name: "10 screens" })).toBeVisible();
    await page.getByRole("option", { name: "10 screens" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return body.state.slidesByDevice.iphone[0].connectedArtworks[0].spanSlots;
    }).toBe(10);
  });

  test("links localized copy across iPhone and iPad when the user enables continuity", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Link copy across devices" }).click();
    await page.getByLabel("Headline").fill("One promise everywhere.");
    await page.getByRole("combobox", { name: "Device" }).click();
    await expect(page.getByRole("option", { name: "iPad" })).toBeVisible();
    await page.getByRole("option", { name: "iPad" }).click();

    await expect(page.getByLabel("Headline")).toHaveValue("One promise everywhere.");
  });

  test("changes the sample's campaign style without replacing its captures", async ({ page }) => {
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
    await page.getByRole("button", { name: "Apply palette Afterglow pulse" }).click();

    await expect.poll(async () => {
      const saved = await page.request.get("/api/project");
      const body = await saved.json();
      return body.state.paletteId;
    }).toBe("afterglow-pulse");

    const response = await page.request.get("/api/project");
    const body = await response.json();
    expect(body.state.paletteId).toBe("afterglow-pulse");
    expect(body.state.slidesByDevice.iphone[0]).toMatchObject({
      screenshot: "/screenshots/demo/ledgerly/dashboard.png",
      assetRef: "capture:ledgerly-dashboard",
    });
  });

  test("reviews an App Store URL and applies a custom campaign without nesting published composites", async ({ page }) => {
    const listing: AppStoreListing = {
      sourceUrl: "https://apps.apple.com/mx/app/demo/id1234567890",
      appId: "1234567890",
      country: "mx",
      locale: "es-MX",
      name: "Example app",
      description: "PLANEA CON IA. Tú apruebas cada cambio. PRIVACIDAD PRIMERO. Metas, tendencias y recordatorios.",
      genre: "Productivity",
      version: "1.6.1",
      artworkUrl: "https://is1-ssl.mzstatic.com/icon.jpg",
      screenshotUrls: ["https://is1-ssl.mzstatic.com/store-01-overview.jpg", "https://is1-ssl.mzstatic.com/store-02-ai-plan.jpg"],
      localArtworkPath: "/app-icon.svg",
      localScreenshotPaths: ["/screenshots/imported/apple-1234567890/store-01.jpg", "/screenshots/imported/apple-1234567890/store-02.jpg"],
    };
    const proposal = buildCampaignImportProposal(listing, {
      colorSignals: { surface: "#EAF5FF", ink: "#11143B", primary: "#18BDEB", accent: "#FF9E35" },
      slideCount: baseline.slidesByDevice.iphone.length,
    });
    await page.route("**/api/import/app-store", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ url: listing.sourceUrl });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, listing, proposal }) });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Build campaign from App Store" }).click();
    const listingUrl = page.getByRole("textbox", { name: "App Store URL" });
    await expect(listingUrl).toHaveValue("");
    await listingUrl.fill(listing.sourceUrl);
    await page.getByRole("button", { name: "Analyze listing" }).click();

    const importer = page.getByRole("dialog", { name: "Build from an App Store listing" });
    await expect(importer.getByText("Example app · Afterglow")).toBeVisible();
    await expect(importer.getByText("Example app sky rhythm")).toBeVisible();
    await expect(importer.getByText("IA con aprobación", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use published App Store screenshots as device captures" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Apply custom campaign" }).click();

    await expect.poll(async () => {
      const response = await page.request.get("/api/project");
      const body = await response.json();
      return {
        templateId: body.state.templateId,
        paletteName: body.state.customPaletteName,
        primary: body.state.brand.colors.primary,
        headline: body.state.slidesByDevice.iphone[0].headline["es-MX"],
        screenshot: body.state.slidesByDevice.iphone[0].screenshot,
      };
    }).toEqual({
      templateId: "app-store-1234567890-afterglow-rhythm",
      paletteName: "Example app sky rhythm",
      primary: "#18BDEB",
      headline: "Haz clara tu próxima acción.",
      screenshot: baseline.slidesByDevice.iphone[0].screenshot,
    });
  });

  test("tunes campaign colors without replacing the sample's captures", async ({ page }) => {
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
      screenshot: "/screenshots/demo/ledgerly/dashboard.png",
      assetRef: "capture:ledgerly-dashboard",
    });
  });

  test("renders the example's native iPad campaign at App Store size", async ({ page }) => {
    await gotoRender(page, "/render?source=example&device=ipad&locale=en-US&size=2064x2752");

    const render = page.locator('[data-render-valid="true"]');
    await expect(render).toHaveAttribute("data-render-width", "2064");
    await expect(render.locator("[data-render-slide]")).toHaveCount(10);
    await expect(render.locator("[data-render-slide]").first()).toHaveJSProperty("clientWidth", 2064);
    await expect(render.locator("[data-render-slide]").first()).toHaveJSProperty("clientHeight", 2752);
  });

  test("starts iPad with the same ten-screen story as iPhone", async ({ page }) => {
    await page.goto("/");
    const response = await page.request.get("/api/project");
    const body = await response.json();
    const headlines = (slides: Array<{ headline: Record<string, string> }>) => slides.map((slide) => slide.headline);
    expect(headlines(body.state.slidesByDevice.ipad)).toEqual(headlines(body.state.slidesByDevice.iphone));
    expect(body.state.slidesByDevice.ipad).toHaveLength(10);
    expect(body.state.exportSizeIds.ipad).toEqual(["ipad-13"]);
  });

  test("mirrors the example story to Android phones and tablets within store limits", async ({ page }) => {
    await page.goto("/");
    const response = await page.request.get("/api/project");
    const body = await response.json();
    const decks = body.state.slidesByDevice as Record<string, Array<{ layout: string; deviceSlots?: unknown[]; screenshot?: string }>>;

    expect(decks.android).toHaveLength(8);
    expect(decks["android-7"]).toHaveLength(8);
    expect(decks["android-10"]).toHaveLength(8);
    for (const device of ["android", "android-7", "android-10"]) {
      expect(decks[device].every((slide) => slide.layout !== "two-devices" && !slide.deviceSlots && slide.screenshot)).toBe(true);
    }

    await gotoRender(page, "/render?source=example&device=android-7&locale=en-US&size=1200x1920");
    await expect(page.locator('[data-render-valid="true"] [data-render-slide]')).toHaveCount(8);
  });

  test("opens an AI polish workspace that keeps a personal key out of project storage", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "AI polish" })).toBeVisible({ timeout: 2_000 });
    await page.getByRole("button", { name: "AI polish" }).click();
    await expect(page.getByRole("heading", { name: "AI polish" })).toBeVisible();
    await expect(page.getByText("never saved in StoreCanvas")).toBeVisible();
  });

  test("reviews AI copy before applying it without changing the sample's capture", async ({ page }) => {
    await page.route("**/api/ai/improve", async (route) => {
      const request = route.request().postDataJSON();
      expect(request).toMatchObject({
        provider: "openai",
        appName: "Ledgerly",
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
                id: "demo-1-route",
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
      screenshot: "/screenshots/demo/ledgerly/dashboard.png",
      assetRef: "capture:ledgerly-dashboard",
    });
  });
});
