// ponytail: duplicate of shared/mcp-narration-slide-target.ts — this package cannot import the monorepo.
export type NarrationSlideLayer = {
  id?: string;
  type?: string;
};

export type NarrationSlideTarget = {
  id: string;
  narration: string;
  layers?: NarrationSlideLayer[];
};

export type NarrationSlideKeys = {
  slideId?: string;
  slug?: string;
};

export type ResolveNarrationSlideSuccess<T extends NarrationSlideTarget> = {
  ok: true;
  slide: T;
};

export type ResolveNarrationSlideFailure = {
  ok: false;
  code: "MISSING_ID" | "UNKNOWN_SLIDE" | "ID_MISMATCH";
  message: string;
};

export type ResolveNarrationSlideResult<T extends NarrationSlideTarget> =
  | ResolveNarrationSlideSuccess<T>
  | ResolveNarrationSlideFailure;

function presentKey(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function slideMatchesKey<T extends NarrationSlideTarget>(slide: T, key: string): boolean {
  if (slide.id === key) {
    return true;
  }
  return Boolean(
    slide.layers?.some((layer) => layer.type === "video" && layer.id === key),
  );
}

function findSlide<T extends NarrationSlideTarget>(slides: T[], key: string): T | undefined {
  return slides.find((slide) => slideMatchesKey(slide, key));
}

function unknownMessage(field: "slideId" | "slug", value: string): string {
  if (field === "slug") {
    return `No slide with step slug ${JSON.stringify(value)}`;
  }
  return `Unknown slide id: ${value}`;
}

function missingIdResult(): ResolveNarrationSlideFailure {
  return {
    ok: false,
    code: "MISSING_ID",
    message: "Expected slideId or slug string, got neither",
  };
}

function resolveOneKey<T extends NarrationSlideTarget>(
  slides: T[],
  field: "slideId" | "slug",
  key: string,
): ResolveNarrationSlideResult<T> {
  const slide = findSlide(slides, key);
  if (!slide) {
    return { ok: false, code: "UNKNOWN_SLIDE", message: unknownMessage(field, key) };
  }
  return { ok: true, slide };
}

function resolveBothKeys<T extends NarrationSlideTarget>(
  slides: T[],
  slideId: string,
  slug: string,
): ResolveNarrationSlideResult<T> {
  const bySlideId = resolveOneKey(slides, "slideId", slideId);
  if (!bySlideId.ok) {
    return bySlideId;
  }
  const bySlug = resolveOneKey(slides, "slug", slug);
  if (!bySlug.ok) {
    return bySlug;
  }
  if (bySlideId.slide.id !== bySlug.slide.id) {
    return {
      ok: false,
      code: "ID_MISMATCH",
      message: `slideId ${JSON.stringify(slideId)} and slug ${JSON.stringify(slug)} resolve to different slides`,
    };
  }
  return bySlideId;
}

/** Resolves a convert-loop slide from slideId and/or Playwright slug. Example: `resolveNarrationSlide(slides, { slug: "open-invite" })` */
export function resolveNarrationSlide<T extends NarrationSlideTarget>(
  slides: T[],
  keys: NarrationSlideKeys,
): ResolveNarrationSlideResult<T> {
  const slideId = presentKey(keys.slideId);
  const slug = presentKey(keys.slug);
  if (slideId && slug) {
    return resolveBothKeys(slides, slideId, slug);
  }
  if (slideId) {
    return resolveOneKey(slides, "slideId", slideId);
  }
  if (slug) {
    return resolveOneKey(slides, "slug", slug);
  }
  return missingIdResult();
}
