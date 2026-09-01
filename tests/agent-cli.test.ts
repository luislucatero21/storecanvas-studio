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
});
