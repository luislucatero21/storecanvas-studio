import { resolveScreenshot } from "./locale";
import type { AssetLibrary, ProjectState, SemanticAsset } from "./types";

function firstPath(asset: SemanticAsset | undefined, locale: string): string {
  if (!asset) return "";
  return asset.paths[locale] || asset.paths.en || asset.paths["en-US"] || Object.values(asset.paths)[0] || "";
}

export function resolveAssetPath(
  ref: string | undefined,
  locale: string,
  assets: AssetLibrary | undefined,
  fallback = "",
) {
  const source = ref ? firstPath(assets?.[ref], locale) : "";
  return resolveScreenshot(source || fallback, locale);
}

export function replaceAssetPath(
  assets: AssetLibrary | undefined,
  ref: string,
  locale: string,
  path: string,
): AssetLibrary {
  const current = assets?.[ref] || {
    id: ref,
    type: "screen" as const,
    paths: {},
  };
  return {
    ...(assets || {}),
    [ref]: {
      ...current,
      paths: { ...current.paths, [locale]: path },
    },
  };
}

export function buildAssetLibrary(project: ProjectState): AssetLibrary {
  const assets: AssetLibrary = Object.fromEntries(
    Object.entries(project.assets || {}).map(([id, asset]) => [id, { ...asset, paths: { ...asset.paths } }]),
  );
  for (const slides of Object.values(project.slidesByDevice)) {
    for (const slide of slides) {
      if (slide.assetRef && slide.screenshot && !assets[slide.assetRef]) {
        assets[slide.assetRef] = {
          id: slide.assetRef,
          type: "screen",
          label: slide.assetRef.replace(/^capture:/, "").replace(/[-_]/g, " "),
          paths: { [project.locale]: slide.screenshot },
        };
      }
      if (slide.assetRefSecondary && slide.screenshotSecondary && !assets[slide.assetRefSecondary]) {
        assets[slide.assetRefSecondary] = {
          id: slide.assetRefSecondary,
          type: "screen",
          label: slide.assetRefSecondary.replace(/^capture:/, "").replace(/[-_]/g, " "),
          paths: { [project.locale]: slide.screenshotSecondary },
        };
      }
      for (const slot of slide.deviceSlots || []) {
        if (slot.assetRef && slot.screenshot && !assets[slot.assetRef]) {
          assets[slot.assetRef] = {
            id: slot.assetRef,
            type: "screen",
            label: slot.assetRef.replace(/^capture:/, "").replace(/[-_]/g, " "),
            paths: { [project.locale]: slot.screenshot },
          };
        }
      }
    }
  }
  return assets;
}

export function assetRefsInProject(project: ProjectState): string[] {
  const refs = new Set<string>();
  for (const slides of Object.values(project.slidesByDevice)) {
    for (const slide of slides) {
      if (slide.assetRef) refs.add(slide.assetRef);
      if (slide.assetRefSecondary) refs.add(slide.assetRefSecondary);
      for (const slot of slide.deviceSlots || []) {
        if (slot.assetRef) refs.add(slot.assetRef);
      }
    }
  }
  return [...refs];
}
