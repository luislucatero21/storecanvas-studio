import { promises as fs } from "node:fs";
import { buildAssetLibrary } from "@/lib/asset-library";
import { DeckCanvas } from "@/components/editor/slide-canvas";
import { getCanvas } from "@/lib/canvas";
import { getExportSizes, themeById } from "@/lib/constants";
import { inheritDefaultDeviceDecks } from "@/lib/device-sync";
import { DEFAULT_PROJECT } from "@/lib/defaults";
import { ProjectStateSchema } from "@/lib/schema";
import { applyBrandTokens } from "@/lib/theme";
import {
  CHECKED_IN_EXAMPLE_PROJECT,
  isLocalPrivateProjectAvailable,
  isProjectFileConfigured,
  projectFilePath,
} from "@/lib/project-file";
import { getLocalProject } from "@/lib/local-project-server";
import type { Device, Orientation, ProjectState } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEVICES: Device[] = ["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDevice(value: string | undefined): value is Device {
  return !!value && DEVICES.includes(value as Device);
}

function isOrientation(value: string | undefined): value is Orientation {
  return value === "portrait" || value === "landscape";
}

async function readProject(options: { preferFile?: boolean; preferExample?: boolean; preferBrowser?: boolean } = {}): Promise<ProjectState> {
  if (options.preferExample) return inheritDefaultDeviceDecks(CHECKED_IN_EXAMPLE_PROJECT);
  if (options.preferBrowser) {
    const localProject = getLocalProject();
    if (localProject) return inheritDefaultDeviceDecks(localProject);
  }
  const preferFile = options.preferFile ?? false;
  if (!preferFile && !isProjectFileConfigured()) {
    const localProject = getLocalProject();
    // An ignored local campaign file is the refreshable source for local
    // previews. It must win over an older browser snapshot after captures or
    // generated artwork are refreshed on disk.
    if (localProject && !isLocalPrivateProjectAvailable()) {
      return inheritDefaultDeviceDecks(localProject);
    }
  }
  try {
    const raw = await fs.readFile(projectFilePath(), "utf8");
    const parsed = ProjectStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? inheritDefaultDeviceDecks(parsed.data as ProjectState) : DEFAULT_PROJECT;
  } catch {
    return isProjectFileConfigured()
      ? DEFAULT_PROJECT
      : inheritDefaultDeviceDecks(CHECKED_IN_EXAMPLE_PROJECT);
  }
}

function requestedSize(value: string | undefined, device: Device, orientation: Orientation) {
  const match = value?.match(/^(\d+)x(\d+)$/);
  if (match) return { w: Number(match[1]), h: Number(match[2]) };
  return getExportSizes(device, orientation)[0] || getCanvas(device, orientation);
}

export default async function RenderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const source = one(params.source);
  const state = await readProject({
    preferFile: source === "file",
    preferExample: source === "example",
    preferBrowser: source === "browser",
  });
  const requestedDevice = one(params.device);
  const requestedOrientation = one(params.orientation);
  const requestedLocale = one(params.locale);
  const device: Device = isDevice(requestedDevice) ? requestedDevice : state.device;
  const orientation: Orientation = isOrientation(requestedOrientation) ? requestedOrientation : state.orientation;
  const locale = requestedLocale && state.locales.includes(requestedLocale) ? requestedLocale : state.locale;
  const size = requestedSize(one(params.size), device, orientation);
  const { cW, cH } = getCanvas(device, orientation);
  const slides = state.slidesByDevice[device] || [];
  const assets = buildAssetLibrary(state);
  const theme = applyBrandTokens(themeById(state.themeId), state.brand);
  const scale = size.w / cW;

  return (
    <main
      data-render-valid="true"
      data-render-device={device}
      data-render-locale={locale}
      data-render-width={size.w}
      data-render-height={size.h}
      style={{ minHeight: "100vh", background: "#fff", color: theme.fg }}
    >
      <div style={{ display: "grid", gap: 24, padding: 24 }}>
        {slides.map((slide, index) => (
          <section
            key={slide.id}
            data-render-slide={index + 1}
            data-slide-id={slide.id}
            data-layout={slide.layout}
            data-render-mode={state.connectedCanvas ? "connected" : "isolated"}
            style={{
              position: "relative",
              width: size.w,
              height: size.h,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: cW,
                height: cH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <div style={{ position: "absolute", left: -index * cW, top: 0 }}>
                <DeckCanvas
                  slides={slides}
                  device={device}
                  orientation={orientation}
                  theme={theme}
                  locale={locale}
                  appName={state.appName}
                  appIcon={state.appIcon}
                  assets={assets}
                  connectedCanvas={state.connectedCanvas}
                  editable={false}
                  hideEmpty
                />
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
