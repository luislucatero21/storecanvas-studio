import { writeLocalized } from "./locale";
import type { Device, ProjectState, Slide } from "./types";

type CopyField = "label" | "headline";

function matchForSource(source: Slide, index: number, slides: Slide[]) {
  if (source.copyKey) {
    const semantic = slides.find((slide) => slide.copyKey === source.copyKey);
    if (semantic) return semantic;
  }
  return slides[index];
}

export function setCopyLinking(project: ProjectState, enabled: boolean, sourceDevice: Device): ProjectState {
  if (!enabled) {
    return { ...project, copySync: { enabled: false, sourceDevice, matchBy: "copyKey-or-index" } };
  }
  const sourceSlides = project.slidesByDevice[sourceDevice] || [];
  const slidesByDevice = Object.fromEntries(
    Object.entries(project.slidesByDevice).map(([device, slides]) => {
      if (device === sourceDevice || !slides.length) return [device, slides];
      return [
        device,
        slides.map((slide, index) => {
          const source = sourceSlides.find((candidate) => candidate.copyKey && candidate.copyKey === slide.copyKey) || sourceSlides[index];
          return source ? { ...slide, label: { ...source.label }, headline: { ...source.headline } } : slide;
        }),
      ];
    }),
  ) as ProjectState["slidesByDevice"];
  return {
    ...project,
    copySync: { enabled: true, sourceDevice, matchBy: "copyKey-or-index" },
    slidesByDevice,
  };
}

export function writeLinkedCopy(
  project: ProjectState,
  sourceDevice: Device,
  slideId: string,
  field: CopyField,
  locale: string,
  value: string,
): ProjectState {
  const sourceSlides = project.slidesByDevice[sourceDevice] || [];
  const sourceIndex = sourceSlides.findIndex((slide) => slide.id === slideId);
  if (sourceIndex < 0) return project;
  const source = sourceSlides[sourceIndex];
  const linked = project.copySync?.enabled === true;
  const slidesByDevice = Object.fromEntries(
    Object.entries(project.slidesByDevice).map(([device, slides]) => {
      const target = matchForSource(source, sourceIndex, slides);
      return [
        device,
        slides.map((slide) => {
          const matches = device === sourceDevice ? slide.id === slideId : linked && target?.id === slide.id;
          return matches ? { ...slide, [field]: writeLocalized(slide[field], locale, value) } : slide;
        }),
      ];
    }),
  ) as ProjectState["slidesByDevice"];
  return { ...project, slidesByDevice };
}
