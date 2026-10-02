import { readSlidemuxApiConfig, type SlidemuxApiConfig } from "./api-config.js";
import { apiRequest, layerBoxBytes, type ApiJson, type FetchFn } from "./cloud-api.js";

export type RecipeSlideInput = {
  recipe: string;
  headline: string;
  kicker?: string;
  support?: string;
  name?: string;
  number?: string;
  options?: string[];
  items?: Array<{ title: string; detail?: string }>;
  groundColor?: string;
  narration?: string;
  upload?: { filename: string; filePath?: string; base64?: string };
};

/** Uploads the recipe picture, if any; image recipes without one get a server placeholder. */
async function uploadRecipeImage(
  config: SlidemuxApiConfig,
  fetchFn: FetchFn,
  projectId: string,
  upload: RecipeSlideInput["upload"],
): Promise<string | undefined> {
  if (!upload) {
    return undefined;
  }
  const bytes = await layerBoxBytes({ ...upload, x: 0, y: 0, width: 1, height: 1 });
  const uploaded = await apiRequest(config, fetchFn, `/api/projects/${projectId}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-Asset-Filename": upload.filename },
    body: new Uint8Array(bytes),
  });
  return typeof uploaded.filename === "string" ? uploaded.filename : upload.filename;
}

async function recipeBody(
  config: SlidemuxApiConfig,
  fetchFn: FetchFn,
  projectId: string,
  input: RecipeSlideInput,
): Promise<Record<string, unknown>> {
  const { upload, ...copy } = input;
  return { ...copy, imageAsset: await uploadRecipeImage(config, fetchFn, projectId, upload) };
}

function jsonInit(method: string, body: Record<string, unknown>): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

/**
 * Appends a recipe slide via POST /api/projects/:id/recipe-slides, optionally after `afterSlideId`.
 *
 * @example await appendSlideFromRecipe("p1", { recipe: "title", headline: "Coffee", narration: "Welcome." })
 */
export async function appendSlideFromRecipe(
  projectId: string,
  input: RecipeSlideInput & { afterSlideId?: string },
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const { afterSlideId, ...slide } = input;
  const body = await recipeBody(config, fetchFn, projectId, slide);
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/recipe-slides`, jsonInit("POST", { ...body, afterSlideId }));
}

/**
 * Rebuilds one slide in place via PUT /api/projects/:id/recipe-slides/:slideId.
 *
 * @example await replaceSlideFromRecipe("p1", "s1", { recipe: "stat", headline: "Cups a day", number: "2B" })
 */
export async function replaceSlideFromRecipe(
  projectId: string,
  slideId: string,
  input: RecipeSlideInput,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const body = await recipeBody(config, fetchFn, projectId, input);
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/recipe-slides/${slideId}`, jsonInit("PUT", body));
}

/** Moves a slide after another (front when omitted). Example: `await moveSlide("p1", "s3", "s1")` */
export async function moveSlide(
  projectId: string,
  slideId: string,
  afterSlideId?: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/scenes/${slideId}/move`, jsonInit("POST", { afterSlideId }));
}

/** Server-side deck design check. Example: `(await lintDeck("p1")).deckWarnings` */
export async function lintDeck(projectId: string, fetchFn: FetchFn = fetch): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/deck-lint`);
}
