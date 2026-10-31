export type OpeningExplorerMove = {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  opening?: { eco?: string; name: string } | null;
};

export type OpeningExplorerStats = {
  white: number;
  draws: number;
  black: number;
  total: number;
  moves: OpeningExplorerMove[];
  opening?: { eco?: string; name: string } | null;
};

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function opening(value: unknown): OpeningExplorerStats["opening"] {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string") return null;
  return {
    name: item.name,
    ...(typeof item.eco === "string" ? { eco: item.eco } : {}),
  };
}

export async function fetchOpeningExplorerStats(
  uciMoves: string[],
  signal?: AbortSignal,
): Promise<OpeningExplorerStats> {
  const query = new URLSearchParams();
  query.set("variant", "standard");
  query.set("moves", "8");
  if (uciMoves.length) query.set("play", uciMoves.join(","));

  const response = await fetch(
    `/api/lichess/opening-explorer?${query.toString()}`,
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`Opening Explorer request failed (${response.status}).`);
  }

  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object") {
    throw new Error("Opening Explorer returned an invalid response.");
  }

  const data = raw as Record<string, unknown>;
  const white = count(data.white);
  const draws = count(data.draws);
  const black = count(data.black);

  const moves: OpeningExplorerMove[] = Array.isArray(data.moves)
    ? data.moves.flatMap((entry): OpeningExplorerMove[] => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        if (typeof item.uci !== "string" || typeof item.san !== "string") return [];
        return [{
          uci: item.uci,
          san: item.san,
          white: count(item.white),
          draws: count(item.draws),
          black: count(item.black),
          opening: opening(item.opening),
        }];
      })
    : [];

  return {
    white,
    draws,
    black,
    total: white + draws + black,
    moves,
    opening: opening(data.opening),
  };
}

export type LichessConnectionStatus = {
  connected: boolean;
  configured: boolean;
};

export async function getLichessConnectionStatus(
  signal?: AbortSignal,
): Promise<LichessConnectionStatus> {
  const response = await fetch("/api/lichess/status", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Connection status request failed (${response.status}).`);
  }
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") {
    throw new Error("Invalid connection status response.");
  }
  const status = value as Record<string, unknown>;
  return {
    connected: status.connected === true,
    configured: status.configured === true,
  };
}

export async function disconnectLichess(): Promise<void> {
  const response = await fetch("/api/lichess/disconnect", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Disconnect request failed (${response.status}).`);
  }
}
