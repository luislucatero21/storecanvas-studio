import { CAMPAIGN_TEMPLATES, applyCampaignTemplateDefinition, applyCustomColors } from "./campaign-presets";
import type { BrandTokens, CampaignTemplate, ProjectState } from "./types";

export type AppStoreListing = {
  sourceUrl: string;
  appId: string;
  country: string;
  locale: string;
  name: string;
  description: string;
  subtitle?: string;
  genre?: string;
  version?: string;
  artworkUrl?: string;
  screenshotUrls: string[];
  localArtworkPath?: string;
  localScreenshotPaths: string[];
};

export type BrandColorSignals = {
  surface: string;
  ink: string;
  primary: string;
  accent: string;
};

export type CampaignEvidence = {
  id: string;
  label: string;
  detail: string;
};

export type CampaignCopySuggestion = {
  label: string;
  headline: string;
  rationale: string;
  signal: string;
};

export type CampaignImportProposal = {
  listing: AppStoreListing;
  locale: string;
  baseTemplateId: string;
  template: CampaignTemplate;
  palette: {
    name: string;
    themeId: string;
    colors: Required<NonNullable<BrandTokens["colors"]>>;
    rationale: string;
  };
  evidence: CampaignEvidence[];
  copy: CampaignCopySuggestion[];
  summary: string;
  screenshotPolicy: "reference-only" | "capture-ready";
  screenshotRationale: string;
};

export type CampaignImportOptions = {
  applyTemplate?: boolean;
  applyPalette?: boolean;
  applyCopy?: boolean;
  applyAppIcon?: boolean;
  useStoreScreenshots?: boolean;
};

const FALLBACK_SIGNALS: BrandColorSignals = {
  surface: "#F3F6FA",
  ink: "#172033",
  primary: "#5267D8",
  accent: "#F08A5D",
};

function localeForCountry(country: string) {
  const locales: Record<string, string> = {
    es: "es-ES",
    mx: "es-MX",
    ar: "es-AR",
    cl: "es-CL",
    co: "es-CO",
    pe: "es-PE",
    br: "pt-BR",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    jp: "ja-JP",
    kr: "ko-KR",
  };
  return locales[country] || "en-US";
}

export function parseAppStoreUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Add a complete apps.apple.com URL.");
  }
  if (url.protocol !== "https:" || url.hostname !== "apps.apple.com") {
    throw new Error("Only public https://apps.apple.com URLs are supported.");
  }
  const appId = url.pathname.match(/\/id(\d+)(?:\/|$)/)?.[1];
  if (!appId) throw new Error("StoreCanvas could not find an App Store app ID in this URL.");
  const countryCandidate = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  const country = countryCandidate && /^[a-z]{2}$/.test(countryCandidate) ? countryCandidate : "us";
  const canonicalUrl = `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  return { appId, country, canonicalUrl };
}

function hasAny(text: string, terms: RegExp[]) {
  return terms.some((term) => term.test(text));
}

function collectEvidence(listing: AppStoreListing): CampaignEvidence[] {
  const text = `${listing.name} ${listing.subtitle || ""} ${listing.genre || ""} ${listing.description}`.toLowerCase();
  const spanish = listing.locale.startsWith("es");
  const evidence: CampaignEvidence[] = [];
  const add = (id: string, enLabel: string, esLabel: string, enDetail: string, esDetail: string) =>
    evidence.push({ id, label: spanish ? esLabel : enLabel, detail: spanish ? esDetail : enDetail });

  if (hasAny(text, [/\bai\b/, /\bia\b/, /inteligencia artificial/, /apple intelligence/, /artificial intelligence/])) {
    add(
      "ai-control",
      "AI with approval",
      "IA con aprobación",
      "The listing says AI proposes changes and the person reviews them first.",
      "La ficha explica que la IA propone cambios y la persona los revisa antes.",
    );
  }
  if (hasAny(text, [/privacidad/, /privacy/, /sin cuenta/, /no account/, /rastreo/, /tracking/, /dispositivo/, /on-device/])) {
    add(
      "privacy",
      "Privacy by design",
      "Privacidad por diseño",
      "No account or ad tracking is required; local processing is the first path.",
      "No exige cuenta ni rastreo publicitario; el procesamiento local es la primera vía.",
    );
  }
  if (hasAny(text, [/análisis/, /analytics/, /tendencias/, /trends/, /racha/, /streak/, /progreso/, /progress/])) {
    add(
      "progress",
      "Visible progress",
      "Progreso visible",
      "Trends, streaks and time-based analysis turn activity into useful feedback.",
      "Tendencias, rachas y análisis convierten la actividad en información útil.",
    );
  }
  if (hasAny(text, [/de por vida/, /lifetime/, /one-time purchase/, /una sola compra/])) {
    add(
      "lifetime",
      "Lifetime option",
      "Opción de por vida",
      "The Pro offer is positioned as one purchase instead of a recurring plan.",
      "La oferta Pro se presenta como una compra, no como un pago recurrente.",
    );
  }
  if (hasAny(text, [/metas/, /goals/, /hábitos/, /habits/, /rutina/, /routine/])) {
    add(
      "routine",
      "Adaptive routine",
      "Rutina adaptable",
      "Habits, goals and flexible timing form one daily system.",
      "Hábitos, metas y horarios flexibles forman un solo sistema diario.",
    );
  }
  return evidence;
}

function chooseTemplate(listing: AppStoreListing, evidence: CampaignEvidence[]) {
  const text = `${listing.genre || ""} ${listing.description}`.toLowerCase();
  if (
    evidence.some((item) => item.id === "routine") ||
    hasAny(text, [/fitness/, /wellness/, /salud/, /productivity/, /momentum/, /motion/])
  ) return "afterglow-rhythm";
  if (hasAny(text, [/finance/, /business/, /analytics/, /security/, /data/, /datos/])) return "proof-ledger";
  if (hasAny(text, [/travel/, /photo/, /food/, /music/, /viaje/, /fotograf/])) return "panorama-story";
  if (hasAny(text, [/premium/, /luxury/, /meditation/, /mindfulness/])) return "quiet-luxury";
  return "editorial-route";
}

function normalizeHex(value: string, fallback: string) {
  const hex = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : fallback;
}

function hexRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}

function mixHex(a: string, b: string, amount: number) {
  const first = hexRgb(a);
  const second = hexRgb(b);
  const channel = (key: keyof typeof first) => Math.round(first[key] * (1 - amount) + second[key] * amount);
  return `#${[channel("r"), channel("g"), channel("b")].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function luminance(hex: string) {
  const { r, g, b } = hexRgb(hex);
  const linear = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function rgbHue(hex: string) {
  const { r, g, b } = hexRgb(hex);
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (!delta) return 0;
  const raw = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return (raw * 60 + 360) % 360;
}

function buildPalette(listing: AppStoreListing, colorSignals?: Partial<BrandColorSignals>) {
  const source = { ...FALLBACK_SIGNALS, ...colorSignals };
  const surface = normalizeHex(source.surface, FALLBACK_SIGNALS.surface);
  const ink = normalizeHex(source.ink, FALLBACK_SIGNALS.ink);
  const primary = normalizeHex(source.primary, FALLBACK_SIGNALS.primary);
  const accent = normalizeHex(source.accent, FALLBACK_SIGNALS.accent);
  const lightSurface = luminance(surface) >= 0.56;
  const finalSurface = lightSurface ? surface : "#F3F6FA";
  const finalInk = luminance(ink) <= 0.22 ? ink : "#172033";
  const hue = rgbHue(primary);
  const character = hue >= 175 && hue <= 235 ? "sky rhythm" : hue >= 235 && hue <= 305 ? "violet signal" : "brand signal";
  return {
    name: `${listing.name} ${character}`,
    themeId: "clean-light",
    colors: {
      primary,
      accent,
      surface: finalSurface,
      surfaceAlt: finalInk,
      ink: finalInk,
      inkAlt: "#F8FBFF",
      muted: mixHex(finalInk, finalSurface, 0.48),
    },
    rationale: listing.locale.startsWith("es")
      ? "Extraída del icono y de las superficies dominantes de las capturas publicadas, con contraste verificado para titulares."
      : "Drawn from the icon and dominant surfaces in the published screenshots, with headline contrast preserved.",
  };
}

function spanishCopy(evidence: CampaignEvidence[], appName: string): CampaignCopySuggestion[] {
  const ids = new Set(evidence.map((item) => item.id));
  const items: CampaignCopySuggestion[] = [
    { label: "LA IDEA PRINCIPAL", headline: "Haz clara tu próxima acción.", rationale: "Abre con el resultado humano, no con una lista de funciones.", signal: "listing" },
  ];
  if (ids.has("ai-control")) {
    items.push(
      { label: "DE IDEA A ACCIÓN", headline: "De tus ideas a un plan.", rationale: "Presenta la IA como un atajo concreto hacia una rutina.", signal: "ai-control" },
      { label: "IA BAJO TU CONTROL", headline: `${appName} propone. Tú decides.`, rationale: "Convierte la revisión previa en una diferencia de confianza.", signal: "ai-control" },
    );
  }
  if (ids.has("privacy")) items.push({ label: "PRIVACIDAD PRIMERO", headline: "Tus datos siguen siendo tuyos.", rationale: "Comunica privacidad sin prometer que toda solicitud queda siempre en el dispositivo.", signal: "privacy" });
  items.push(
    { label: "HOY, SIN FRICCIÓN", headline: "Solo lo que toca ahora.", rationale: "Aterriza la promesa en la vista diaria enfocada.", signal: "routine" },
    { label: "VOLVER TAMBIÉN CUENTA", headline: "Retoma sin empezar de cero.", rationale: "Normaliza la recuperación y reduce culpa.", signal: "routine" },
  );
  if (ids.has("progress")) items.push({ label: "PATRONES, NO PRESIÓN", headline: "Entiende qué sí funciona.", rationale: "Vende el aprendizaje que producen tendencias y actividad.", signal: "progress" });
  items.push(
    { label: "METAS QUE SE ADAPTAN", headline: "Convierte intención en avance.", rationale: "Une metas medibles con flexibilidad cotidiana.", signal: "routine" },
    { label: "A TU MANERA", headline: "Recordatorios que sí encajan.", rationale: "Cierra el núcleo del producto con control de horarios.", signal: "routine" },
  );
  if (ids.has("lifetime")) items.push({ label: "UNA COMPRA. SIN CUOTAS.", headline: `${appName} Pro, de por vida.`, rationale: "Termina con una propuesta comercial simple y diferenciada.", signal: "lifetime" });
  return items;
}

function englishCopy(evidence: CampaignEvidence[], appName: string): CampaignCopySuggestion[] {
  const ids = new Set(evidence.map((item) => item.id));
  const items: CampaignCopySuggestion[] = [
    { label: "THE BIG IDEA", headline: "Make the next step clear.", rationale: "Lead with the human outcome instead of a feature list.", signal: "listing" },
  ];
  if (ids.has("ai-control")) items.push(
    { label: "FROM IDEA TO ACTION", headline: "Turn ideas into a plan.", rationale: "Make AI a concrete shortcut to a workable routine.", signal: "ai-control" },
    { label: "AI, UNDER YOUR CONTROL", headline: "It proposes. You decide.", rationale: "Use review-before-change as a trust differentiator.", signal: "ai-control" },
  );
  if (ids.has("privacy")) items.push({ label: "PRIVACY FIRST", headline: "Your data stays yours.", rationale: "State the privacy benefit without overstating local-only processing.", signal: "privacy" });
  items.push(
    { label: "TODAY, WITHOUT FRICTION", headline: "Only what matters now.", rationale: "Ground the promise in the focused daily view.", signal: "routine" },
    { label: "COMING BACK COUNTS", headline: "Resume without restarting.", rationale: "Normalize recovery and remove guilt.", signal: "routine" },
  );
  if (ids.has("progress")) items.push({ label: "PATTERNS, NOT PRESSURE", headline: "See what actually works.", rationale: "Sell the insight behind trends and activity.", signal: "progress" });
  items.push(
    { label: "GOALS THAT ADAPT", headline: "Turn intention into progress.", rationale: "Connect measurable goals to a flexible day.", signal: "routine" },
    { label: "ON YOUR TERMS", headline: "Reminders that fit.", rationale: "Close the product core with scheduling control.", signal: "routine" },
  );
  if (ids.has("lifetime")) items.push({ label: "ONE PURCHASE. NO DUES.", headline: `${appName} Pro, for life.`, rationale: "End on a simple commercial differentiator.", signal: "lifetime" });
  return items;
}

type ScreenshotIntent = "hero" | "ai-plan" | "focus" | "recovery" | "reflection" | "goals" | "progress" | "privacy" | "reminders" | "lifetime";

function screenshotIntent(rawUrl: string): ScreenshotIntent | undefined {
  const filename = decodeURIComponent(rawUrl).toLowerCase();
  if (/de-por-vida|lifetime|one-time/.test(filename)) return "lifetime";
  if (/recordatorio|reminder|notification|schedule/.test(filename)) return "reminders";
  if (/ai|assistant|coach|plan|prompt/.test(filename)) return "ai-plan";
  if (/focus|timer|session|concentr/.test(filename)) return "focus";
  if (/recovery|resume|continue|recover/.test(filename)) return "recovery";
  if (/reflection|journal|mood|check-in/.test(filename)) return "reflection";
  if (/insight|trend|analytics|progress|statistics/.test(filename)) return "progress";
  if (/goal|target|objective/.test(filename)) return "goals";
  if (/privacy|security|local|data/.test(filename)) return "privacy";
  if (/home|today|overview|dashboard|welcome/.test(filename)) return "hero";
  return undefined;
}

function copyForIntent(intent: ScreenshotIntent, spanish: boolean, appName: string): CampaignCopySuggestion {
  const catalog: Record<ScreenshotIntent, { es: [string, string, string]; en: [string, string, string] }> = {
    hero: {
      es: ["LA IDEA PRINCIPAL", "Haz clara tu próxima acción.", "Abre con el resultado humano que demuestra la pantalla principal."],
      en: ["THE BIG IDEA", "Make the next step clear.", "Lead with the human outcome proven by the main screen."],
    },
    "ai-plan": {
      es: ["IA QUE PROPONE. TÚ DECIDES.", "De tus ideas a un plan.", "La captura demuestra tanto la propuesta de IA como la revisión previa."],
      en: ["AI PROPOSES. YOU DECIDE.", "Turn ideas into a plan.", "The capture proves both the AI proposal and review-before-change."],
    },
    focus: {
      es: ["HOY, SIN FRICCIÓN", "Solo lo que toca ahora.", "Vincula el temporizador de enfoque con un siguiente paso claro."],
      en: ["TODAY, WITHOUT FRICTION", "Only what matters now.", "Connect the focus timer to one clear next step."],
    },
    recovery: {
      es: ["VOLVER TAMBIÉN CUENTA", "Retoma sin empezar de cero.", "Hace que la pantalla de recuperación reduzca culpa, no solo registre una pausa."],
      en: ["COMING BACK COUNTS", "Resume without restarting.", "Make the recovery screen reduce guilt instead of merely logging a pause."],
    },
    reflection: {
      es: ["PROGRESO HUMANO", "Tu energía también importa.", "La reflexión diaria añade contexto humano a la constancia."],
      en: ["HUMAN PROGRESS", "Your energy matters too.", "Daily reflection adds human context to consistency."],
    },
    goals: {
      es: ["METAS QUE SE ADAPTAN", "Convierte intención en avance.", "La meta visible convierte una intención en progreso medible."],
      en: ["GOALS THAT ADAPT", "Turn intention into progress.", "The visible goal turns intent into measurable progress."],
    },
    progress: {
      es: ["PATRONES, NO PRESIÓN", "Entiende qué sí funciona.", "Las tendencias y rachas venden aprendizaje, no vigilancia."],
      en: ["PATTERNS, NOT PRESSURE", "See what actually works.", "Trends and streaks sell learning, not surveillance."],
    },
    privacy: {
      es: ["PRIVACIDAD PRIMERO", "Tus datos siguen siendo tuyos.", "El beat de privacidad sostiene la promesa de propiedad sin exagerar el procesamiento local."],
      en: ["PRIVACY FIRST", "Your data stays yours.", "The privacy beat supports ownership without overstating local processing."],
    },
    reminders: {
      es: ["A TU MANERA", "Recordatorios que sí encajan.", "La pantalla de ajustes demuestra control de horarios."],
      en: ["ON YOUR TERMS", "Reminders that fit.", "The settings screen proves scheduling control."],
    },
    lifetime: {
      es: ["UNA COMPRA. SIN CUOTAS.", `${appName} Pro, de por vida.`, "Cierra con una propuesta comercial simple y diferenciada."],
      en: ["ONE PURCHASE. NO DUES.", `${appName} Pro, for life.`, "End on a simple commercial differentiator."],
    },
  };
  const [label, headline, rationale] = spanish ? catalog[intent].es : catalog[intent].en;
  return { label, headline, rationale, signal: intent };
}

function screenshotLedCopy(listing: AppStoreListing) {
  const intents = listing.screenshotUrls.map(screenshotIntent);
  const recognized = intents.filter(Boolean).length;
  if (recognized < Math.min(3, listing.screenshotUrls.length)) return undefined;
  const spanish = listing.locale.startsWith("es");
  return intents.map((intent) => intent ? copyForIntent(intent, spanish, listing.name) : undefined);
}

function fillCopy(items: CampaignCopySuggestion[], count: number, listing: AppStoreListing) {
  const fallback = listing.locale.startsWith("es")
    ? { label: "LA IDEA PRINCIPAL", headline: "Una propuesta que va contigo.", rationale: "Recupera la promesa central sin añadir una afirmación nueva.", signal: "listing" }
    : { label: "THE BIG IDEA", headline: "A promise that moves with you.", rationale: "Return to the central promise without adding a new claim.", signal: "listing" };
  return Array.from({ length: count }, (_, index) => items[index] || { ...fallback });
}

export function buildCampaignImportProposal(
  listing: AppStoreListing,
  options: { colorSignals?: Partial<BrandColorSignals>; slideCount?: number } = {},
): CampaignImportProposal {
  const evidence = collectEvidence(listing);
  const baseTemplateId = chooseTemplate(listing, evidence);
  const base = CAMPAIGN_TEMPLATES.find((template) => template.id === baseTemplateId) || CAMPAIGN_TEMPLATES[0];
  const template: CampaignTemplate = {
    ...base,
    id: `app-store-${listing.appId}-${base.id}`,
    name: `${listing.name} · ${base.name.split(" ")[0]}`,
    eyebrow: listing.locale.startsWith("es") ? "Generada desde App Store" : "Generated from App Store",
    description: listing.locale.startsWith("es")
      ? `Una dirección propia para ${listing.name}, derivada de su propuesta, capturas y ritmo de producto.`
      : `A project-owned direction for ${listing.name}, derived from its promise, screenshots and product rhythm.`,
    signature: listing.locale.startsWith("es")
      ? "Alterna superficies de marca mientras la historia pasa de intención a control y prueba."
      : "Alternates brand surfaces as the story moves from intent to control and proof.",
    recommendedPaletteId: "custom",
  };
  const palette = buildPalette(listing, options.colorSignals);
  const rawCopy = listing.locale.startsWith("es") ? spanishCopy(evidence, listing.name) : englishCopy(evidence, listing.name);
  const screenshotCopy = screenshotLedCopy(listing);
  const slideCount = Math.max(1, options.slideCount || listing.screenshotUrls.length || 6);
  return {
    listing,
    locale: listing.locale || localeForCountry(listing.country),
    baseTemplateId,
    template,
    palette,
    evidence,
    copy: fillCopy(
      Array.from({ length: slideCount }, (_, index) => screenshotCopy?.[index] || rawCopy[index] || rawCopy[rawCopy.length - 1]),
      slideCount,
      listing,
    ),
    summary: listing.locale.startsWith("es")
      ? `${listing.name} se presenta con una dirección basada en ${evidence.slice(0, 3).map((item) => item.label.toLowerCase()).join(", ") || "su propuesta principal"}.`
      : `${listing.name} gets a direction built around ${evidence.slice(0, 3).map((item) => item.label.toLowerCase()).join(", ") || "its clearest product promise"}.`,
    screenshotPolicy: "reference-only",
    screenshotRationale: listing.locale.startsWith("es")
      ? "Las capturas publicadas ya contienen titulares y dispositivos. Se usan como evidencia visual para evitar una pantalla dentro de otra."
      : "The published screenshots already contain headlines and device frames. They are used as visual evidence to avoid a screen inside a screen.",
  };
}

export function applyCampaignImport(
  project: ProjectState,
  proposal: CampaignImportProposal,
  options: CampaignImportOptions = {},
): ProjectState {
  const settings = {
    applyTemplate: options.applyTemplate !== false,
    applyPalette: options.applyPalette !== false,
    applyCopy: options.applyCopy !== false,
    applyAppIcon: options.applyAppIcon !== false,
    useStoreScreenshots: options.useStoreScreenshots === true,
  };
  let next: ProjectState = {
    ...project,
    appName: proposal.listing.name,
    customTemplate: proposal.template,
    campaignSource: {
      provider: "app-store",
      appId: proposal.listing.appId,
      sourceUrl: proposal.listing.sourceUrl,
      country: proposal.listing.country,
      ...(proposal.listing.version ? { appVersion: proposal.listing.version } : {}),
      screenshotPolicy: proposal.screenshotPolicy,
    },
    locales: project.locales.includes(proposal.locale) ? project.locales : [...project.locales, proposal.locale],
    ...(settings.applyAppIcon && proposal.listing.localArtworkPath ? { appIcon: proposal.listing.localArtworkPath } : {}),
  };

  if (settings.applyTemplate) {
    next = applyCampaignTemplateDefinition(next, proposal.template, project.device, {
      reflowConnectedArtwork: true,
    });
    next = { ...next, connectedCanvas: true };
  }
  if (settings.applyPalette) {
    next = applyCustomColors(next, proposal.palette.colors);
    next = { ...next, themeId: proposal.palette.themeId, customPaletteName: proposal.palette.name };
  }

  const slides = (next.slidesByDevice[project.device] || []).map((slide, index) => {
    const suggestion = proposal.copy[index];
    const storePath = proposal.listing.localScreenshotPaths[index];
    return {
      ...slide,
      ...(settings.applyCopy && suggestion
        ? {
            label: { ...slide.label, [proposal.locale]: suggestion.label },
            headline: { ...slide.headline, [proposal.locale]: suggestion.headline },
          }
        : {}),
      ...(settings.useStoreScreenshots && storePath
        ? { screenshot: storePath, assetRef: undefined }
        : {}),
    };
  });

  return {
    ...next,
    slidesByDevice: { ...next.slidesByDevice, [project.device]: slides },
  };
}
