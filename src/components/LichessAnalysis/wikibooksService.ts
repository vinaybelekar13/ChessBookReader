import type { WikiBookArticle } from "./types";

const API_URL = "https://en.wikibooks.org/w/api.php";

interface MediaWikiPage {
  title?: string;
  missing?: boolean;
  extract?: string;
  fullurl?: string;
}

interface MediaWikiResponse {
  query?: {
    pages?: MediaWikiPage[];
  };
  error?: {
    info?: string;
  };
}

function makeMoveSegment(san: string, ply: number): string {
  const moveNumber = Math.ceil(ply / 2);
  const prefix = ply % 2 === 1 ? `${moveNumber}._` : `${moveNumber}...`;
  return `${prefix}${san}`;
}

function makePageTitle(sanMoves: string[]): string {
  return [
    "Chess_Opening_Theory",
    ...sanMoves.map((san, index) => makeMoveSegment(san, index + 1)),
  ].join("/");
}

async function requestArticle(
  pageTitle: string,
  signal?: AbortSignal
): Promise<WikiBookArticle | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "extracts|info",
    titles: pageTitle,
    redirects: "1",
    explaintext: "1",
    exchars: "1200",
    inprop: "url",
    origin: "*",
  });

  // Correct the MediaWiki parameter name.
  params.delete("explaintext");
  params.set("explaintext", "1");

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Wikibooks request failed (${response.status})`);
  }

  const data = (await response.json()) as MediaWikiResponse;

  if (data.error) {
    throw new Error(data.error.info ?? "Wikibooks API error");
  }

  const page = data.query?.pages?.[0];

  if (!page || page.missing || !page.extract?.trim()) {
    return null;
  }

  return {
    title: page.title ?? pageTitle.replaceAll("_", " "),
    extract: page.extract.trim(),
    url:
      page.fullurl ??
      `https://en.wikibooks.org/wiki/${encodeURIComponent(
        (page.title ?? pageTitle).replaceAll(" ", "_")
      )}`,
    source: "Wikibooks",
  };
}

export async function fetchWikibooksArticle(
  sanMoves: string[],
  signal?: AbortSignal
): Promise<WikiBookArticle | null> {
  if (sanMoves.length === 0) return null;

  for (let length = sanMoves.length; length >= 1; length--) {
    if (signal?.aborted) {
      throw new DOMException("Request aborted", "AbortError");
    }

    const title = makePageTitle(sanMoves.slice(0, length));
    const article = await requestArticle(title, signal);

    if (article) return article;
  }

  return null;
}
