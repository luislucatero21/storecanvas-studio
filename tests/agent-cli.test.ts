import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

const run = promisify(execFile);
const cli = resolve(process.cwd(), "scripts/storecanvas.mjs");

async function runCli(...args: string[]) {
  return run(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, OPENAI_API_KEY: "" },
  });
}

describe("StoreCanvas agent CLI", () => {
  it("inspects an explicit checked-in project as machine-readable JSON", async () => {
    const { stdout } = await runCli("inspect", "--project", "example-project.json", "--json");
    const payload = JSON.parse(stdout);

    expect(payload).toMatchObject({
      projectFile: resolve(process.cwd(), "example-project.json"),
      appName: "Ledgerly",
      device: "iphone",
    });
    expect(payload.decks.iphone).toMatchObject({ screens: 10 });
  });

  it("plans a ten-slot background without contacting the app or image provider", async () => {
    const { stdout } = await runCli(
      "generate-background",
      "--project",
      "example-project.json",
      "--device",
      "iphone",
      "--start-slot",
      "1",
      "--slots",
      "10",
      "--prompt",
      "A quiet dusk gradient with violet and amber motion",
      "--dry-run",
      "--json",
    );
    const payload = JSON.parse(stdout);

    expect(payload).toMatchObject({
      command: "generate-background",
      spanSlots: 10,
      startSlot: 1,
      dryRun: true,
    });
  });

  it("plans a canvas layer removal without writing the project", async () => {
    const { stdout } = await runCli(
      "remove-element",
      "--project",
      "example-project.json",
      "--device",
      "iphone",
      "--screen",
      "1",
      "--element",
      "caption",
      "--dry-run",
      "--json",
    );
    const payload = JSON.parse(stdout);

    expect(payload).toMatchObject({
      command: "remove-element",
      action: "hidden",
      screen: 1,
      dryRun: true,
    });
  });

  it("plans placing an external image as connected artwork without contacting the app", async () => {
    const { stdout } = await runCli(
      "set-background",
      "--project",
      "example-project.json",
      "--device",
      "iphone",
      "--slots",
      "10",
      "--image",
      "public/backgrounds/ledgerly-signal.png",
      "--dry-run",
      "--json",
    );
    expect(JSON.parse(stdout)).toMatchObject({
      command: "set-background",
      spanSlots: 10,
      startSlot: 1,
      artworkId: "background-1-10",
      dryRun: true,
    });
  });

  it("rejects unsupported image formats for set-background", async () => {
    await expect(runCli(
      "set-background", "--project", "example-project.json", "--image", "README.md", "--dry-run",
    )).rejects.toThrow(/png, \.jpg/);
  });

  it("lists screens with resolved copy and screenshots offline", async () => {
    const { stdout } = await runCli("screens", "--project", "example-project.json", "--json");
    const payload = JSON.parse(stdout);
    expect(payload.device).toBe("iphone");
    expect(payload.screens).toHaveLength(10);
    expect(payload.screens[0]).toMatchObject({
      screen: 1,
      layout: "hero",
      headline: expect.any(String),
      screenshot: expect.stringMatching(/^\/screenshots\//),
      connectedArtworks: expect.any(Array),
      hiddenElements: expect.any(Array),
    });
  });

  it("plans a screen edit without the app and rejects empty or invalid edits", async () => {
    const { stdout } = await runCli(
      "edit-screen", "--project", "example-project.json", "--screen", "2",
      "--headline", "Fresh headline", "--layout", "hero", "--dry-run", "--json",
    );
    expect(JSON.parse(stdout)).toMatchObject({
      command: "edit-screen",
      screen: 2,
      changes: { headline: "Fresh headline", layout: "hero" },
      dryRun: true,
    });
    await expect(runCli("edit-screen", "--project", "example-project.json", "--screen", "1", "--json"))
      .rejects.toMatchObject({ stdout: expect.stringContaining("at least one change") });
    await expect(runCli("edit-screen", "--project", "example-project.json", "--screen", "1", "--layout", "nope", "--json"))
      .rejects.toMatchObject({ stdout: expect.stringContaining("Valid layouts") });
  });

  it("rejects landscape on devices that do not support it before contacting the app", async () => {
    await expect(runCli("set-project", "--project", "example-project.json", "--device", "android", "--orientation", "landscape"))
      .rejects.toThrow(/does not support landscape/);
  });

  it("emits a machine-readable command manifest", async () => {
    const { stdout } = await runCli("help", "--json");
    const manifest = JSON.parse(stdout);
    const names = manifest.commands.map((command: { name: string }) => command.name);
    expect(names).toEqual(expect.arrayContaining(["screens", "edit-screen", "set-project", "inspect", "render"]));
    const edit = manifest.commands.find((command: { name: string }) => command.name === "edit-screen");
    expect(edit).toMatchObject({ aliases: ["set-copy"], needsApp: true, writes: true });
    expect(edit.flags).toContainEqual(expect.objectContaining({ name: "--screen", value: "1-10", required: true }));
    expect(edit.examples.length).toBeGreaterThan(0);
    expect(JSON.parse((await runCli("commands", "--json")).stdout)).toEqual(manifest);
  });

  it("prints per-command help for `help <command>` and `<command> --help`", async () => {
    const viaHelp = (await runCli("help", "screens")).stdout;
    const viaFlag = (await runCli("screens", "--help")).stdout;
    expect(viaHelp).toBe(viaFlag);
    expect(viaHelp).toContain("Usage:");
    expect((await runCli("help")).stdout).toContain("Typical flow:");
  });

  it("suggests the closest command in a JSON error", async () => {
    const failure = await runCli("screeens", "--json").catch((error) => error);
    expect(failure.code).toBe(1);
    expect(JSON.parse(failure.stdout)).toMatchObject({
      ok: false,
      error: "Unknown command: screeens.",
      hint: expect.stringContaining('"screens"'),
    });
  });
});
