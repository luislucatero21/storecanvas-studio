import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as projectPost } from "@/app/api/project/route";
import { POST as uploadPost } from "@/app/api/upload/route";
import { POST as agentPost } from "@/app/api/agent/route";
import { POST as importPost } from "@/app/api/import/app-store/route";
import { POST as improvePost } from "@/app/api/ai/improve/route";
import { POST as imagePost } from "@/app/api/ai/image/route";
import { crossSiteRequestError } from "@/lib/request-guard";
import { DEFAULT_PROJECT } from "@/lib/defaults";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function forged(url: string, body: unknown, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("cross-site request guard", () => {
  it("accepts same-origin browser requests and header-less JSON clients", () => {
    const base = "http://localhost:3000/api/project";
    expect(crossSiteRequestError(forged(base, {}, { "content-type": "application/json" }))).toBeNull();
    expect(crossSiteRequestError(forged(base, {}, {
      "content-type": "application/json; charset=utf-8",
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "sec-fetch-site": "same-origin",
    }))).toBeNull();
  });

  it("rejects simple-request bodies, other sites and other localhost ports", () => {
    const base = "http://localhost:3000/api/project";
    expect(crossSiteRequestError(forged(base, {}, { "content-type": "text/plain" }))?.status).toBe(415);
    expect(crossSiteRequestError(forged(base, {}, {
      "content-type": "application/json",
      "sec-fetch-site": "cross-site",
    }))?.status).toBe(403);
    expect(crossSiteRequestError(forged(base, {}, {
      "content-type": "application/json",
      "sec-fetch-site": "same-site",
    }))?.status).toBe(403);
    expect(crossSiteRequestError(forged(base, {}, {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      host: "localhost:3000",
    }))?.status).toBe(403);
    expect(crossSiteRequestError(forged(base, {}, {
      "content-type": "application/json",
      origin: "null",
      host: "localhost:3000",
    }))?.status).toBe(403);
  });

  it("guards every state-changing or provider-calling API route", async () => {
    const textPlain = { "content-type": "text/plain;charset=UTF-8", origin: "https://attacker.example", host: "localhost:3000" };
    const routes = [
      projectPost, uploadPost, agentPost, importPost, improvePost, imagePost,
    ];
    for (const post of routes) {
      const response = await post(forged("http://localhost:3000/api/x", { action: "catalog" }, textPlain));
      expect(response.status).toBe(415);
    }
  });
});

describe("local server writes from another site", () => {
  let dir: string;
  let projectFile: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "storecanvas-guard-"));
    projectFile = path.join(dir, "campaign.json");
    writeFileSync(projectFile, "{\"original\":true}\n");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("STORECANVAS_READ_ONLY", "");
    vi.stubEnv("STORECANVAS_PROJECT_FILE", projectFile);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not let a no-cors text/plain post overwrite the configured project file", async () => {
    const response = await projectPost(forged("http://localhost:3000/api/project", DEFAULT_PROJECT, {
      "content-type": "text/plain;charset=UTF-8",
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
      host: "localhost:3000",
    }));
    expect(response.status).toBe(415);
    expect(readFileSync(projectFile, "utf8")).toBe("{\"original\":true}\n");
  });

  it("does not let another site write into public/screenshots/uploaded", async () => {
    const response = await uploadPost(forged("http://localhost:3000/api/upload", { dataUrl: PNG_DATA_URL }, {
      "content-type": "application/json",
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
      host: "localhost:3000",
    }));
    expect(response.status).toBe(403);
  });

  it("still saves the project for the same-origin editor", async () => {
    const response = await projectPost(forged("http://localhost:3000/api/project", DEFAULT_PROJECT, {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      host: "localhost:3000",
    }));
    expect(response.status).toBe(200);
    expect(JSON.parse(readFileSync(projectFile, "utf8"))).toMatchObject({ appName: DEFAULT_PROJECT.appName });
  });
});
