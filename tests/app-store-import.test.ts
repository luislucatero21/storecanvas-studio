import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "@/lib/defaults";
import {
  applyCampaignImport,
  buildCampaignImportProposal,
  parseAppStoreUrl,
  type AppStoreListing,
} from "@/lib/app-store-import";

const rutmiaListing: AppStoreListing = {
  sourceUrl: "https://apps.apple.com/mx/app/rutmia/id6757990035",
  appId: "6757990035",
  country: "mx",
  locale: "es-MX",
  name: "Rutmia",
  description: [
    "Crea una rutina que se adapte a tu vida, no al revés.",
    "PLANEA CON RUTMIA AI",
    "Rutmia puede sugerir hábitos y crear metas. Ves cada sugerencia antes de cambiar nada.",
    "Tú mantienes el control y apruebas cada cambio.",
    "Análisis semanal, mensual y trimestral, tendencias, rachas y recordatorios flexibles.",
    "PRIVACIDAD PRIMERO",
    "Rutmia no requiere una cuenta ni opera sistemas de publicidad o rastreo.",
    "Procesa las solicitudes primero en tu dispositivo y la asistencia segura en la nube es opcional.",
    "Una sola compra de Pro de por vida elimina el límite de cinco hábitos.",
  ].join("\n\n"),
  genre: "Productivity",
  version: "1.6.1",
  artworkUrl: "https://is1-ssl.mzstatic.com/rutmia-icon.jpg",
  screenshotUrls: [
    "iPhone_6.9_01-rutinas-que-duran.png",
    "iPhone_6.9_02-metas-con-tus-palabras.png",
    "iPhone_6.9_03-enfoque-sin-fricciones.png",
    "iPhone_6.9_04-recupera-y-continua.png",
    "iPhone_6.9_05-observa-como-te-sientes.png",
    "iPhone_6.9_06-metas-en-progreso.png",
    "iPhone_6.9_07-mira-como-avanzas.png",
    "iPhone_6.9_08-rutina-en-un-lugar.png",
    "iPhone_6.9_09-recordatorios-a-tu-manera.png",
    "iPhone_6.9_10-rutmia-de-por-vida.png",
  ].map((name) => `https://is1-ssl.mzstatic.com/${name}`),
  localArtworkPath: "/screenshots/imported/apple-6757990035/icon.jpg",
  localScreenshotPaths: Array.from(
    { length: 10 },
    (_, index) => `/screenshots/imported/apple-6757990035/store-${String(index + 1).padStart(2, "0")}.jpg`,
  ),
};

const rutmiaSignals = {
  surface: "#EAF5FF",
  ink: "#11143B",
  primary: "#18BDEB",
  accent: "#FF9E35",
};

describe("App Store campaign imports", () => {
  it("parses an Apple storefront URL without trusting arbitrary hosts", () => {
    expect(parseAppStoreUrl(rutmiaListing.sourceUrl)).toEqual({
      appId: "6757990035",
      country: "mx",
      canonicalUrl: rutmiaListing.sourceUrl,
    });
    expect(() => parseAppStoreUrl("https://example.com/mx/app/rutmia/id6757990035")).toThrow(
      "apps.apple.com",
    );
  });

  it("turns the current Rutmia listing into a custom Afterglow campaign", () => {
    const proposal = buildCampaignImportProposal(rutmiaListing, {
      colorSignals: rutmiaSignals,
      slideCount: 10,
    });

    expect(proposal.baseTemplateId).toBe("afterglow-rhythm");
    expect(proposal.template).toMatchObject({
      id: "app-store-6757990035-afterglow-rhythm",
      name: "Rutmia · Afterglow",
      recommendedPaletteId: "custom",
    });
    expect(proposal.palette).toMatchObject({
      name: "Rutmia sky rhythm",
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
      expect.objectContaining({ label: "TU DÍA, A TU MANERA", headline: "Haz tuyo tu día." }),
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
    const proposal = buildCampaignImportProposal(rutmiaListing, {
      colorSignals: rutmiaSignals,
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
      appName: "Rutmia",
      templateId: proposal.template.id,
      customTemplate: proposal.template,
      paletteId: "custom",
      customPaletteName: "Rutmia sky rhythm",
      appIcon: rutmiaListing.localArtworkPath,
      campaignSource: {
        provider: "app-store",
        appId: "6757990035",
        sourceUrl: rutmiaListing.sourceUrl,
        screenshotPolicy: "reference-only",
      },
    });
    expect(applied.slidesByDevice.iphone[0]).toMatchObject({
      screenshot: originalCapture,
      label: { "es-MX": "TU DÍA, A TU MANERA" },
      headline: { "es-MX": "Haz tuyo tu día." },
    });

    const withStoreComposites = applyCampaignImport(project, proposal, {
      applyTemplate: false,
      applyPalette: false,
      applyCopy: false,
      applyAppIcon: false,
      useStoreScreenshots: true,
    });
    expect(withStoreComposites.slidesByDevice.iphone[0].screenshot).toBe(
      rutmiaListing.localScreenshotPaths[0],
    );
  });
});
