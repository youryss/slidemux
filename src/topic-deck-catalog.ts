/**
 * Topic-deck theme and recipe ids accepted by the SlideMux API. Mirrors
 * `shared/deck-themes.ts` and `shared/slide-recipes.ts` in the app repo; the
 * package cannot import app sources, so a server test guards against drift.
 */
export const TOPIC_DECK_THEMES = [
  "studio",
  "editorial",
  "midnight",
  "terminal",
  "forest",
  "punch",
  "blush",
  "classic",
] as const;

export const TOPIC_DECK_RECIPES = [
  "title",
  "section",
  "split",
  "full-bleed",
  "screenshot",
  "steps",
  "agenda",
  "checklist",
  "timeline",
  "comparison",
  "choice",
  "stat",
  "quote",
  "close",
] as const;
