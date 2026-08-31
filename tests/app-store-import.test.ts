import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "@/lib/defaults";
import {
  applyCampaignImport,
  buildCampaignImportProposal,
  parseAppStoreUrl,
  type AppStoreListing,
} from "@/lib/app-store-import";

const demoListing: AppStoreListing = {
  sourceUrl: "https://apps.apple.com/mx/app/demo/id1234567890",
  appId: "1234567890",
  country: "mx",
  locale: "es-MX",
  name: "Example app",
  description: [
    "Organiza tus ideas y conviértelas en próximos pasos.",
    "PLANEA CON IA",
    "Example app puede sugerir acciones. Ves cada sugerencia antes de cambiar nada.",
    "Tú mantienes el control y apruebas cada cambio.",
    "Análisis, tendencias y recordatorios flexibles convierten actividad en señales útiles.",
    "PRIVACIDAD PRIMERO",
    "Example app no requiere una cuenta ni opera sistemas de publicidad o rastreo.",
    "Procesa las solicitudes primero en tu dispositivo y la asistencia segura en la nube es opcional.",
    "Una sola compra Pro desbloquea todas las herramientas.",
  ].join("\n\n"),
  genre: "Productivity",
  version: "1.6.1",
  artworkUrl: "https://is1-ssl.mzstatic.com/demo-icon.jpg",
  screenshotUrls: [
    "iPhone_6.9_01-overview.png",
    "iPhone_6.9_02-ai-plan.png",
    "iPhone_6.9_03-focus-session.png",
    "iPhone_6.9_04-recovery.png",
    "iPhone_6.9_05-reflection.png",
    "iPhone_6.9_06-goals.png",
    "iPhone_6.9_07-progress.png",
    "iPhone_6.9_08-privacy.png",
    "iPhone_6.9_09-reminders.png",
    "iPhone_6.9_10-lifetime.png",
  ].map((name) => `https://is1-ssl.mzstatic.com/${name}`),
  localArtworkPath: "/screenshots/imported/apple-1234567890/icon.jpg",
  localScreenshotPaths: Array.from(
    { length: 10 },
    (_, index) => `/screenshots/imported/apple-1234567890/store-${String(index + 1).padStart(2, "0")}.jpg`,
  ),
};

const demoSignals = {
  surface: "#EAF5FF",
  ink: "#11143B",
  primary: "#18BDEB",
  accent: "#FF9E35",
};

describe("App Store campaign imports", () => {
  it("parses an Apple storefront URL without trusting arbitrary hosts", () => {
    expect(parseAppStoreUrl(demoListing.sourceUrl)).toEqual({
      appId: "1234567890",
      country: "mx",
      canonicalUrl: demoListing.sourceUrl,
    });
    expect(() => parseAppStoreUrl("https://example.com/mx/app/demo/id1234567890")).toThrow(
      "apps.apple.com",
    );
  });

  it("turns the sample listing into a custom Afterglow campaign", () => {
    const proposal = buildCampaignImportProposal(demoListing, {
      colorSignals: demoSignals,
      slideCount: 10,
    });

    expect(proposal.baseTemplateId).toBe("afterglow-rhythm");
    expect(proposal.template).toMatchObject({
      id: "app-store-1234567890-afterglow-rhythm",
      name: "Example app · Afterglow",
      recommendedPaletteId: "custom",
    });
    expect(proposal.palette).toMatchObject({
      name: "Example app sky rhythm",
      themeId: "clean-light",
      colors: {
        surface: "#EAF5FF",
        surfaceAlt: "#11143B",
        ink: "#11143B",
        inkAlt: "#F8FBFF",
        primary: "#18BDEB",
        accent: "#FF9E35",
      },
    });
    expect(proposal.evidence.map((item) => item.id)).toEqual(
      expect.arrayContaining(["ai-control", "privacy", "progress", "lifetime"]),
    );
    expect(proposal.copy.slice(0, 4)).toEqual([
      expect.objectContaining({ label: "LA IDEA PRINCIPAL", headline: "Haz clara tu próxima acción." }),
      expect.objectContaining({ label: "IA QUE PROPONE. TÚ DECIDES.", headline: "De tus ideas a un plan." }),
      expect.objectContaining({ label: "HOY, SIN FRICCIÓN", headline: "Solo lo que toca ahora." }),
      expect.objectContaining({ label: "VOLVER TAMBIÉN CUENTA", headline: "Retoma sin empezar de cero." }),
    ]);
    expect(proposal.screenshotPolicy).toBe("reference-only");
  });

  it("applies template, palette and copy while App Store composites stay opt-in", () => {
    const project = {
      ...DEFAULT_PROJECT,
      appName: "Existing app",
      device: "iphone" as const,
      locale: "es-MX",
      locales: ["en-US", "es-MX"],
    };
    const originalCapture = project.slidesByDevice.iphone[0].screenshot;
    const proposal = buildCampaignImportProposal(demoListing, {
      colorSignals: demoSignals,
      slideCount: project.slidesByDevice.iphone.length,
    });

    const applied = applyCampaignImport(project, proposal, {
      applyTemplate: true,
      applyPalette: true,
      applyCopy: true,
      applyAppIcon: true,
      useStoreScreenshots: false,
    });

    expect(applied).toMatchObject({
      appName: "Example app",
      templateId: proposal.template.id,
      customTemplate: proposal.template,
      paletteId: "custom",
      customPaletteName: "Example app sky rhythm",
      appIcon: demoListing.localArtworkPath,
      campaignSource: {
        provider: "app-store",
        appId: "1234567890",
        sourceUrl: demoListing.sourceUrl,
        screenshotPolicy: "reference-only",
      },
    });
    expect(applied.slidesByDevice.iphone[0]).toMatchObject({
      screenshot: originalCapture,
      label: { "es-MX": "LA IDEA PRINCIPAL" },
      headline: { "es-MX": "Haz clara tu próxima acción." },
    });

    const withStoreComposites = applyCampaignImport(project, proposal, {
      applyTemplate: false,
      applyPalette: false,
      applyCopy: false,
      applyAppIcon: false,
      useStoreScreenshots: true,
    });
    expect(withStoreComposites.slidesByDevice.iphone[0].screenshot).toBe(
      demoListing.localScreenshotPaths[0],
    );
  });
});
