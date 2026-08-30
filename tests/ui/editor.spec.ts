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

    await expect(page.getByRole("heading", { name: "Screens" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "App name" })).toHaveValue("Rutmia");
    await expect(page.getByText("Connected")).toBeVisible();
    await expect(page.getByRole("main").getByText("A ROUTINE THAT MOVES WITH YOU").first()).toBeVisible();
    await expect(page.getByRole("main").getByText("Own your day.").first()).toBeVisible();
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

    const response = await page.request.get("/api/project");
    const body = await response.json();
    expect(body.state.paletteId).toBe("rutmia-afterglow");
    expect(body.state.slidesByDevice.iphone[0]).toMatchObject({
      screenshot: "/screenshots/apple/iphone/{locale}/home.png",
      assetRef: "capture:home-dashboard",
    });
  });
});
